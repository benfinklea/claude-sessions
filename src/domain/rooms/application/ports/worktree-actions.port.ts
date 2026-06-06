/**
 * Outbound port wrapping the user's existing ~/bin tooling. We never reimplement
 * worktree/branch/focus logic — we shell out to the canonical scripts.
 *
 * The actual `c -wt` launch runs *inside a tmux window* (so Claude lives in the
 * lobby), so this port returns the command to run rather than running it here.
 */
export interface WorktreeActionsPort {
  /** The `{command,args}` for `c -wt <slug>` (run by the orchestrator in a window). */
  spawnCommand(slug: string): { command: string; args: string[] };
  /** Predict the worktree dir `c -wt <slug>` will create: `<mainRepoRoot>-<slug-tail>`. */
  predictWorktreeRoot(mainRepoRoot: string, slug: string): string;
  /** Write `.wt-focus` and rename the tmux window via `set-focus`. */
  setFocus(worktreeRoot: string, label: string): void;
  /** Tear down via `wtrm` (refuses dirty unless backup). Returns false on non-zero exit. */
  teardown(worktreeRoot: string, opts?: { backup?: boolean }): boolean;
}
