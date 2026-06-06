import { createSessionModule } from "../session/session.module.js";
import { ListSessionsUseCase } from "../session/application/use-cases/list-sessions.use-case.js";
import { TmuxOrchestratorAdapter } from "./infrastructure/tmux/tmux-orchestrator.adapter.js";
import { LivenessEnrichingRepository } from "./infrastructure/liveness-enriching.repository.js";
import { WorktreeActionsAdapter } from "./infrastructure/worktree/worktree-actions.adapter.js";
import { ResolveRowActionUseCase } from "./application/use-cases/resolve-row-action.use-case.js";

/**
 * Composes the upstream session module with the rooms (tmux/liveness/worktree)
 * layer. The session list flows through the LivenessEnrichingRepository so every
 * row carries its focus label + live/dormant/stale state and tmux target.
 */
export function createRoomsModule() {
  const base = createSessionModule();
  const orchestrator = new TmuxOrchestratorAdapter();
  const enrichedRepository = new LivenessEnrichingRepository(
    base.multiAgentRepository,
    orchestrator,
  );

  return {
    ...base,
    // Override list to run through enrichment (detail/resume/delete stay upstream).
    listSessionsUseCase: new ListSessionsUseCase(enrichedRepository),
    enrichedRepository,
    orchestrator,
    worktreeActions: new WorktreeActionsAdapter(),
    resolveRowAction: new ResolveRowActionUseCase(),
  };
}

export type RoomsModule = ReturnType<typeof createRoomsModule>;
