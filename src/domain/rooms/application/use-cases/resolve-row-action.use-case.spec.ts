import { describe, it, expect } from "vitest";
import { ResolveRowActionUseCase } from "./resolve-row-action.use-case.js";
import { Session, type SessionParams } from "../../../session/domain/session.model.js";

function session(extra: Partial<SessionParams>): Session {
  return new Session({
    id: "sess-1",
    filePath: "/p/sess-1.jsonl",
    project: "coppermind",
    gitBranch: "feat/x",
    messageCount: 10,
    preview: "first message preview",
    modifiedAt: new Date(),
    cwd: "/Volumes/Development/coppermind-x/src",
    provider: "Claude",
    ...extra,
  });
}

describe("ResolveRowActionUseCase", () => {
  const uc = new ResolveRowActionUseCase();

  it("LIVE row with a tmux target → JUMP", () => {
    const a = uc.resolve(session({ isLive: true, tmuxTarget: { session: "sessions", window: 4 } }));
    expect(a).toEqual({ kind: "JUMP", target: { session: "sessions", window: 4 } });
  });

  it("dormant row → RESUME (clean=false), using worktreeRoot as cwd and focusLabel as label", () => {
    const a = uc.resolve(
      session({
        isLive: false,
        isStale: false,
        worktreeRoot: "/Volumes/Development/coppermind-x",
        focusLabel: "token burn",
      }),
    );
    expect(a).toEqual({
      kind: "RESUME",
      sessionId: "sess-1",
      providerName: "Claude",
      cwd: "/Volumes/Development/coppermind-x",
      label: "token burn",
      clean: false,
    });
  });

  it("stale row → RESUME with clean=true", () => {
    const a = uc.resolve(session({ isStale: true }));
    expect(a.kind).toBe("RESUME");
    expect(a.kind === "RESUME" && a.clean).toBe(true);
  });

  it("falls back to preview + cwd when focusLabel/worktreeRoot are absent", () => {
    const a = uc.resolve(session({}));
    expect(a.kind === "RESUME" && a.label).toBe("first message preview");
    expect(a.kind === "RESUME" && a.cwd).toBe("/Volumes/Development/coppermind-x/src");
  });

  it("live but no tmuxTarget → RESUME (never jump to nowhere)", () => {
    const a = uc.resolve(session({ isLive: true }));
    expect(a.kind).toBe("RESUME");
  });
});
