/**
 * Value objects describing whether a session is currently running (live),
 * and where its tmux window is, so the UI can JUMP instead of resuming a dup.
 */

export interface TmuxTarget {
  readonly session: string;
  readonly window: number;
}

/** Parsed contents of a worktree's `.wt-session` lock file. */
export interface WtSessionLock {
  readonly pid: number;
  readonly started: Date;
  readonly host: string;
  readonly ttlHours: number;
}

export interface Liveness {
  /** A running agent: lock present, pid alive, ttl not expired, tmux window exists. */
  readonly isLive: boolean;
  /** Lock present but not actually live (dead pid / expired ttl / window gone). */
  readonly isStale: boolean;
  readonly worktreeRoot?: string;
  readonly tmuxTarget?: TmuxTarget;
}
