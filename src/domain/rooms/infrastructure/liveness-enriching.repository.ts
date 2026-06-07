import type { SessionRepositoryPort } from "../../session/application/ports/session-repository.port.js";
import type { Session } from "../../session/domain/session.model.js";
import type { SessionDetail } from "../../session/domain/session-detail.model.js";
import type { TmuxOrchestratorPort } from "../application/ports/tmux-orchestrator.port.js";
import { WorktreeRootResolver } from "./focus/worktree-root.resolver.js";
import { FocusLabelService } from "./focus/focus-label.service.js";
import { LivenessService } from "./liveness/liveness.service.js";

interface Enrichers {
  readonly resolver: Pick<WorktreeRootResolver, "resolve">;
  readonly focus: Pick<FocusLabelService, "get">;
  readonly liveness: Pick<LivenessService, "classify">;
}

/**
 * Decorates the session repository: after the base list is built, overlay each
 * session with its worktree root, focus label, and liveness. The tmux pane map
 * is fetched once per findAll() — never per session.
 */
export class LivenessEnrichingRepository implements SessionRepositoryPort {
  private readonly enrichers: Enrichers;

  constructor(
    private readonly inner: SessionRepositoryPort,
    private readonly orchestrator: TmuxOrchestratorPort,
    enrichers?: Partial<Enrichers>,
  ) {
    this.enrichers = {
      resolver: enrichers?.resolver ?? new WorktreeRootResolver(),
      focus: enrichers?.focus ?? new FocusLabelService(),
      liveness: enrichers?.liveness ?? new LivenessService(),
    };
  }

  async findAll(): Promise<Session[]> {
    const sessions = await this.inner.findAll();
    const paneMap = this.orchestrator.paneMap();
    const { resolver, focus, liveness } = this.enrichers;

    const enriched = sessions.map((session) => {
      const worktreeRoot = resolver.resolve(session.cwd);
      const focusLabel = worktreeRoot ? focus.get(worktreeRoot) : undefined;
      const live = liveness.classify(worktreeRoot, { paneMap });
      return session.withEnrichment({
        worktreeRoot,
        focusLabel,
        isLive: live.isLive,
        isStale: live.isStale,
        tmuxTarget: live.tmuxTarget,
      });
    });

    // One worktree can have many past sessions but only one running now. Keep
    // the most-recent session per worktree live; demote its older siblings to
    // dormant so the live section reflects reality, not history.
    const newestLiveByRoot = new Map<string, number>();
    for (const s of enriched) {
      if (s.isLive && s.worktreeRoot) {
        const t = s.modifiedAt.getTime();
        const prev = newestLiveByRoot.get(s.worktreeRoot);
        if (prev === undefined || t > prev) newestLiveByRoot.set(s.worktreeRoot, t);
      }
    }
    return enriched.map((s) => {
      if (!s.isLive || !s.worktreeRoot) return s;
      if (s.modifiedAt.getTime() === newestLiveByRoot.get(s.worktreeRoot)) return s;
      return s.withEnrichment({ isLive: false, isStale: false, tmuxTarget: undefined });
    });
  }

  getDetail(filePath: string, providerName?: string): Promise<SessionDetail> {
    return this.inner.getDetail(filePath, providerName);
  }
}
