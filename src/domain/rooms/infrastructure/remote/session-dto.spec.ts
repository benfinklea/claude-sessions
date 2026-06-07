import { describe, it, expect } from "vitest";
import { toDTO, fromDTO } from "./session-dto.js";
import { Session } from "../../../session/domain/session.model.js";

function session(extra: Partial<ConstructorParameters<typeof Session>[0]> = {}): Session {
  return new Session({
    id: "s1",
    filePath: "/p/s1.jsonl",
    project: "coppermind",
    gitBranch: "feat/x",
    messageCount: 42,
    preview: "hello",
    modifiedAt: new Date("2026-06-06T10:00:00.000Z"),
    cwd: "/Volumes/Development/coppermind-x",
    provider: "Claude",
    worktreeRoot: "/Volumes/Development/coppermind-x",
    focusLabel: "token burn",
    isLive: true,
    isStale: false,
    tmuxTarget: { session: "main", window: 3 },
    hasWorktree: true,
    ...extra,
  });
}

describe("session DTO", () => {
  it("serializes modifiedAt to ISO and carries enrichment fields", () => {
    const dto = toDTO(session());
    expect(dto.modifiedAt).toBe("2026-06-06T10:00:00.000Z");
    expect(dto.focusLabel).toBe("token burn");
    expect(dto.isLive).toBe(true);
    expect(dto.tmuxTarget).toEqual({ session: "main", window: 3 });
    expect(dto.hasWorktree).toBe(true);
  });

  it("round-trips through JSON and tags the machine", () => {
    const dto = JSON.parse(JSON.stringify(toDTO(session())));
    const back = fromDTO(dto, "pippen");
    expect(back.machine).toBe("pippen");
    expect(back.id).toBe("s1");
    expect(back.focusLabel).toBe("token burn");
    expect(back.isLive).toBe(true);
    expect(back.tmuxTarget).toEqual({ session: "main", window: 3 });
    expect(back.hasWorktree).toBe(true);
    expect(back.modifiedAt.toISOString()).toBe("2026-06-06T10:00:00.000Z");
  });

  it("preserves matchesFilter searchability incl. machine after round-trip", () => {
    const back = fromDTO(toDTO(session()), "pippen");
    expect(back.matchesFilter("pippen")).toBe(true);
    expect(back.matchesFilter("token")).toBe(true);
  });
});
