/**
 * Outbound port wrapping the user's existing ~/bin tooling. We never reimplement
 * worktree/branch/focus logic — we shell out to the canonical scripts.
 */
export interface WorktreeActionsPort {
  /** Create a worktree + branch + start Claude via `c -wt <slug>`. Returns the new worktree root. */
  spawn(slug: string): { worktreeRoot: string } | null;
  /** Write `.wt-focus` and rename the tmux window via `set-focus`. */
  setFocus(worktreeRoot: string, label: string): void;
  /** Tear down via `wtrm` (refuses dirty unless backup). Returns false on non-zero exit. */
  teardown(worktreeRoot: string, opts?: { backup?: boolean }): boolean;
}
