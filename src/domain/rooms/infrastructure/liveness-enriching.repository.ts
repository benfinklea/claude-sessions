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

    return sessions.map((session) => {
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
  }

  getDetail(filePath: string, providerName?: string): Promise<SessionDetail> {
    return this.inner.getDetail(filePath, providerName);
  }
}
