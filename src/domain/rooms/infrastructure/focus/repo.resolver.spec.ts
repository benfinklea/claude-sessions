import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RepoResolver } from "./repo.resolver.js";

describe("RepoResolver", () => {
  let base: string;
  beforeEach(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "repo-")));
  });
  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("linked worktree → the MAIN repo name (shared across worktrees)", () => {
    const wt = path.join(base, "coppermind-cmo-tweaks");
    fs.mkdirSync(wt);
    fs.writeFileSync(
      path.join(wt, ".git"),
      `gitdir: ${base}/coppermind-cmo/.git/worktrees/tweaks\n`,
    );
    expect(new RepoResolver().resolve(wt)).toBe("coppermind-cmo");
  });

  it("two worktrees of the same repo resolve to the same repo name", () => {
    const r = new RepoResolver();
    const mk = (name: string, wtName: string) => {
      const wt = path.join(base, name);
      fs.mkdirSync(wt);
      fs.writeFileSync(path.join(wt, ".git"), `gitdir: ${base}/cmf/.git/worktrees/${wtName}\n`);
      return r.resolve(wt);
    };
    expect(mk("cmf-a", "a")).toBe("cmf");
    expect(mk("cmf-b", "b")).toBe("cmf");
  });

  it("main checkout (.git is a dir) → its own dir name", () => {
    const repo = path.join(base, "xscape");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    expect(new RepoResolver().resolve(repo)).toBe("xscape");
  });

  it("no .git → falls back to the basename", () => {
    const dir = path.join(base, "loose");
    fs.mkdirSync(dir);
    expect(new RepoResolver().resolve(dir)).toBe("loose");
  });
});
