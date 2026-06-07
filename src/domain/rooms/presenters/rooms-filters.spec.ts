import { describe, it, expect } from "vitest";
import { distinctRepos, applyToggleFilters, nextRepo, enterLabel } from "./rooms-filters.js";
import { Session, type SessionParams } from "../../session/domain/session.model.js";

function mk(o: Partial<SessionParams> & { id: string }): Session {
  return new Session({
    filePath: "/p",
    project: "p",
    gitBranch: "b",
    messageCount: 1,
    preview: "",
    modifiedAt: new Date(),
    cwd: "/x",
    provider: "Claude",
    ...o,
  });
}

const S = [
  mk({ id: "a", repo: "coppermind-cmo", hasWorktree: true, isLive: true }),
  mk({ id: "b", repo: "xscape", hasWorktree: true }),
  mk({ id: "c", repo: "coppermind-cmo", hasWorktree: false }),
  mk({ id: "d", repo: "cmf", hasWorktree: true, isStale: true }),
];

describe("rooms-filters", () => {
  it("distinctRepos returns sorted unique repos", () => {
    expect(distinctRepos(S)).toEqual(["cmf", "coppermind-cmo", "xscape"]);
  });

  it("worktrees-only hides rows without a worktree", () => {
    const out = applyToggleFilters(S, { worktreesOnly: true, repoFilter: null });
    expect(out.map((s) => s.id)).toEqual(["a", "b", "d"]); // c (no worktree) gone
  });

  it("repo filter keeps only that repo", () => {
    const out = applyToggleFilters(S, { worktreesOnly: false, repoFilter: "coppermind-cmo" });
    expect(out.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("the two filters COMPOSE (worktrees-only AND repo)", () => {
    const out = applyToggleFilters(S, { worktreesOnly: true, repoFilter: "coppermind-cmo" });
    expect(out.map((s) => s.id)).toEqual(["a"]); // c excluded by no-worktree
  });

  it("no filters → everything", () => {
    expect(applyToggleFilters(S, { worktreesOnly: false, repoFilter: null })).toHaveLength(4);
  });

  it("nextRepo cycles null → first → … → last → null", () => {
    const repos = ["cmf", "coppermind-cmo", "xscape"];
    expect(nextRepo(repos, null)).toBe("cmf");
    expect(nextRepo(repos, "cmf")).toBe("coppermind-cmo");
    expect(nextRepo(repos, "xscape")).toBeNull(); // wraps back to All
    expect(nextRepo([], null)).toBeNull(); // no repos
  });

  it("enterLabel is context-aware", () => {
    expect(enterLabel(undefined)).toBe("—");
    expect(enterLabel(mk({ id: "x", isLive: true }))).toBe("Jump");
    expect(enterLabel(mk({ id: "x", isStale: true }))).toBe("Resume (clean)");
    expect(enterLabel(mk({ id: "x" }))).toBe("Resume");
  });
});
