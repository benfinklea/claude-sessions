import { createSessionModule } from "../session/session.module.js";
import { ListSessionsUseCase } from "../session/application/use-cases/list-sessions.use-case.js";
import { TmuxOrchestratorAdapter } from "./infrastructure/tmux/tmux-orchestrator.adapter.js";
import { LivenessEnrichingRepository } from "./infrastructure/liveness-enriching.repository.js";
import { WorktreeActionsAdapter } from "./infrastructure/worktree/worktree-actions.adapter.js";
import { ResolveRowActionUseCase } from "./application/use-cases/resolve-row-action.use-case.js";
import { RemoteSessionProvider } from "./infrastructure/remote/remote-session.provider.js";
import { CompositeSessionRepository } from "./infrastructure/remote/composite-session.repository.js";
import { HandoffReader } from "./infrastructure/handoff/handoff-reader.js";

/** Parse ROOMS_REMOTE_HOSTS ("pippen,gandalf") into a host list. */
function remoteHosts(): string[] {
  return (process.env.ROOMS_REMOTE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

/**
 * Composes the upstream session module with the rooms (tmux/liveness/worktree)
 * layer. The local list flows through LivenessEnrichingRepository so every row
 * carries focus label + live/dormant/stale + tmux target. When ROOMS_REMOTE_HOSTS
 * is set, the dashboard list also merges those machines' sessions over SSH.
 */
export function createRoomsModule() {
  const base = createSessionModule();
  const orchestrator = new TmuxOrchestratorAdapter();
  const enrichedRepository = new LivenessEnrichingRepository(
    base.multiAgentRepository,
    orchestrator,
  );

  const remoteLimit = Number(process.env.CLAUDE_SESSIONS_LIMIT) || 300;
  const remotes = remoteHosts().map((h) => new RemoteSessionProvider(h, remoteLimit));
  const dashboardRepository =
    remotes.length > 0
      ? new CompositeSessionRepository(enrichedRepository, remotes)
      : enrichedRepository;

  return {
    ...base,
    // Dashboard list = local (enriched) + any remote machines.
    listSessionsUseCase: new ListSessionsUseCase(dashboardRepository),
    // Local-only list, used by `--json` so a remote host reports just itself (no recursion).
    localListUseCase: new ListSessionsUseCase(enrichedRepository),
    enrichedRepository,
    orchestrator,
    worktreeActions: new WorktreeActionsAdapter(),
    resolveRowAction: new ResolveRowActionUseCase(),
    handoffReader: new HandoffReader(),
    remoteHosts: remoteHosts(),
  };
}

export type RoomsModule = ReturnType<typeof createRoomsModule>;
