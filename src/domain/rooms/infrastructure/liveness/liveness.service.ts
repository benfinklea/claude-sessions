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

/**
 * Classify a worktree as live / dormant / stale by correlating its `.wt-session`
 * lock (pid alive + ttl) with whether a tmux window is actually sitting in it.
 * The pane map is computed once per refresh and passed in — never per session.
 */
export class LivenessService {
  classify(worktreeRoot: string | undefined, deps: LivenessDeps): Liveness {
    if (!worktreeRoot) return { isLive: false, isStale: false };

    const tmuxTarget = deps.paneMap.get(worktreeRoot);
    const lock = parseWtSession(worktreeRoot);

    // No lock → plain dormant history (even if a window happens to sit there).
    if (!lock) return { isLive: false, isStale: false, worktreeRoot, tmuxTarget };

    const pidAlive = (deps.pidAlive ?? defaultPidAlive)(lock.pid);
    const now = deps.now ?? Date.now();
    const expired = lock.started.getTime() + lock.ttlHours * 3_600_000 < now;

    const isLive = pidAlive && !expired && tmuxTarget !== undefined;
    return { isLive, isStale: !isLive, worktreeRoot, tmuxTarget };
  }
}
