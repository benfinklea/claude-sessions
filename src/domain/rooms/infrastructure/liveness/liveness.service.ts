import { parseWtSession } from "./wt-session.parser.js";
import type { Liveness, TmuxTarget } from "../../domain/liveness.model.js";

export interface LivenessDeps {
  /** pane_current_path → tmux window, built once per refresh. */
  readonly paneMap: Map<string, TmuxTarget>;
  readonly now?: number;
  readonly pidAlive?: (pid: number) => boolean;
}

/** Default liveness probe: signal 0 doesn't kill, just tests existence. */
function defaultPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = process exists but isn't ours; ESRCH = no such process.
    return (err as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

/** Find a tmux window whose pane is sitting in (or under) the worktree. */
function findWindowFor(
  worktreeRoot: string,
  paneMap: Map<string, TmuxTarget>,
): TmuxTarget | undefined {
  const exact = paneMap.get(worktreeRoot);
  if (exact) return exact;
  for (const [panePath, target] of paneMap) {
    if (panePath.startsWith(worktreeRoot + "/")) return target;
  }
  return undefined;
}

/**
 * Classify a worktree as live / dormant / stale.
 *
 * Primary signal: a tmux window is sitting in the worktree → live (works on any
 * machine, no hook required). Secondary: a `.wt-session` lock with a live pid +
 * unexpired ttl → live even if we can't see the window (rare). A lock that's
 * present but neither pid-alive nor backed by a window → stale.
 *
 * Note: "newest session per worktree wins" is enforced by the enriching
 * repository, since only it sees all sessions for a given worktree.
 */
export class LivenessService {
  classify(worktreeRoot: string | undefined, deps: LivenessDeps): Liveness {
    if (!worktreeRoot) return { isLive: false, isStale: false };

    const tmuxTarget = findWindowFor(worktreeRoot, deps.paneMap);
    if (tmuxTarget) {
      return { isLive: true, isStale: false, worktreeRoot, tmuxTarget };
    }

    const lock = parseWtSession(worktreeRoot);
    if (!lock) return { isLive: false, isStale: false, worktreeRoot };

    const pidAlive = (deps.pidAlive ?? defaultPidAlive)(lock.pid);
    const now = deps.now ?? Date.now();
    const expired = lock.started.getTime() + lock.ttlHours * 3_600_000 < now;
    const isLive = pidAlive && !expired;
    return { isLive, isStale: !isLive, worktreeRoot };
  }
}
