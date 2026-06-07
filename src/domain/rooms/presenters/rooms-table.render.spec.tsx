import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { RoomsTable } from "./rooms-table.js";
import { Session, type SessionParams } from "../../session/domain/session.model.js";

const now = Date.now();
function mk(o: Partial<SessionParams> & { id: string }): Session {
  return new Session({
    filePath: "/p",
    project: "proj",
    gitBranch: "feat/x",
    messageCount: 10,
    preview: "",
    modifiedAt: new Date(now - 60_000),
    cwd: "/x",
    provider: "Claude",
    ...o,
  });
}

function frameFor(sessions: Session[]): string {
  const { lastFrame } = render(
    <RoomsTable
      sessions={sessions}
      totalCount={sessions.length}
      filter=""
      onSetFilter={vi.fn()}
      onIntent={vi.fn()}
      onPreview={vi.fn()}
    />,
  );
  return lastFrame()!;
}

describe("RoomsTable (render e2e)", () => {
  it("renders sections, live count, focus labels, and ⎇/✎ markers", () => {
    const f = frameFor([
      mk({
        id: "a",
        focusLabel: "token burn",
        isLive: true,
        hasWorktree: true,
        tmuxTarget: { session: "main", window: 1 },
      }),
      mk({ id: "c", focusLabel: "old sweep" }),
      mk({ id: "d", focusLabel: "dashboard parity", hasWorktree: true, handoffPath: "/h/x.md" }),
    ]);
    expect(f).toContain("HOME");
    expect(f).toContain("1 live");
    expect(f).toContain("● LIVE");
    expect(f).toContain("○ DORMANT");
    expect(f).toContain("token burn");
    expect(f).toContain("⎇"); // active worktree
    expect(f).toContain("✎"); // handoff
    expect(f).toContain("Enter Jump"); // context-aware hint for the live top row
  });

  it("shows the machine in the Where column for remote rows", () => {
    const f = frameFor([mk({ id: "p", focusLabel: "remote one", machine: "pippen" })]);
    expect(f).toContain("pippen");
  });

  it("renders the empty state when there are no sessions", () => {
    expect(frameFor([])).toContain("Press N to start");
  });
});
