import type { TmuxTarget } from "../../domain/liveness.model.js";

export interface SpawnWindowOpts {
  readonly name: string;
  readonly cwd: string;
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * Hides every tmux command behind a tiny interface. The UI only ever says
 * "jump here" or "open this" — never `select-window`, `switch-client`, etc.
 */
export interface TmuxOrchestratorPort {
  isInsideTmux(): boolean;
  /** True if the dedicated lobby session exists (implies a server is running). */
  lobbyExists(): boolean;
  /** Bootstrap the lobby session (and the server, if absent). Returns false if tmux is unavailable. */
  ensureLobby(homeCwd: string): boolean;
  /** Bind Ctrl-Space → HOME (window 0). Idempotent. */
  installGlobalBindings(): void;
  /** Map of pane_current_path → window, built from one `list-windows -a` call. */
  paneMap(): Map<string, TmuxTarget>;
  /** Switch the client to the given window (no new process). */
  jumpTo(target: TmuxTarget): void;
  /** Open a new lobby window running command+args in cwd; returns its target. */
  spawnWindow(opts: SpawnWindowOpts): TmuxTarget | null;
  /** The lobby session name (default "sessions"). */
  readonly lobbySession: string;
}
