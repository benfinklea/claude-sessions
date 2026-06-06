import { describe, it, expect, vi } from "vitest";
import { LivenessEnrichingRepository } from "./liveness-enriching.repository.js";
import { Session } from "../../session/domain/session.model.js";
import type { SessionRepositoryPort } from "../../session/application/ports/session-repository.port.js";
import type { TmuxOrchestratorPort } from "../application/ports/tmux-orchestrator.port.js";
import type { TmuxTarget } from "../domain/liveness.model.js";

function baseSession(cwd: string): Session {
  return new Session({
    id: "s",
    filePath: "/p/s.jsonl",
    project: "proj",
    gitBranch: "feat/x",
    messageCount: 1,
    preview: "p",
    modifiedAt: new Date(),
    cwd,
    provider: "Claude",
  });
}

describe("LivenessEnrichingRepository", () => {
  it("overlays worktreeRoot, focusLabel and liveness onto each session", async () => {
    const inner: SessionRepositoryPort = {
      findAll: async () => [baseSession("/wt/src")],
      getDetail: vi.fn(),
    };
    const target: TmuxTarget = { session: "sessions", window: 2 };
    const paneMap = vi.fn(() => new Map([["/wt", target]]));
    const orchestrator = { paneMap } as unknown as TmuxOrchestratorPort;

    const repo = new LivenessEnrichingRepository(inner, orchestrator, {
      resolver: { resolve: () => "/wt" },
      focus: { get: () => "my focus" },
      liveness: {
        classify: () => ({ isLive: true, isStale: false, worktreeRoot: "/wt", tmuxTarget: target }),
      },
    });

    const [s] = await repo.findAll();
    expect(s!.worktreeRoot).toBe("/wt");
    expect(s!.focusLabel).toBe("my focus");
    expect(s!.isLive).toBe(true);
    expect(s!.tmuxTarget).toEqual(target);
    // preserves upstream fields
    expect(s!.provider).toBe("Claude");
    expect(s!.cwd).toBe("/wt/src");
  });

  it("fetches the tmux pane map exactly once per findAll, not per session", async () => {
    const inner: SessionRepositoryPort = {
      findAll: async () => [baseSession("/a"), baseSession("/b"), baseSession("/c")],
      getDetail: vi.fn(),
    };
    const paneMap = vi.fn(() => new Map());
    const orchestrator = { paneMap } as unknown as TmuxOrchestratorPort;
    const repo = new LivenessEnrichingRepository(inner, orchestrator, {
      resolver: { resolve: (c) => c },
      focus: { get: () => undefined },
      liveness: { classify: () => ({ isLive: false, isStale: false }) },
    });

    await repo.findAll();
    expect(paneMap).toHaveBeenCalledTimes(1);
  });

  it("delegates getDetail to the inner repository", async () => {
    const getDetail = vi.fn().mockResolvedValue({});
    const inner = { findAll: async () => [], getDetail } as unknown as SessionRepositoryPort;
    const repo = new LivenessEnrichingRepository(inner, { paneMap: () => new Map() } as never);
    await repo.getDetail("/p/x.jsonl", "Claude");
    expect(getDetail).toHaveBeenCalledWith("/p/x.jsonl", "Claude");
  });
});
