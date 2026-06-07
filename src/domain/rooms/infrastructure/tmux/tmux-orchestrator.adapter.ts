import { spawnSync } from "node:child_process";
import type {
  TmuxOrchestratorPort,
  SpawnWindowOpts,
} from "../../application/ports/tmux-orchestrator.port.js";
import type { TmuxTarget } from "../../domain/liveness.model.js";

const FIELD_SEP = "\t";

/**
 * All tmux interaction. Every call uses an argv array (never a shell string),
 * so worktree paths containing spaces or apostrophes are always safe.
 */
export class TmuxOrchestratorAdapter implements TmuxOrchestratorPort {
  readonly lobbySession: string;

  constructor(lobbySession: string = process.env.ROOMS_LOBBY_SESSION ?? "sessions") {
    this.lobbySession = lobbySession;
  }

  private run(args: string[], inherit = false) {
    return spawnSync("tmux", args, {
      stdio: inherit ? "inherit" : "pipe",
      encoding: "utf8",
    });
  }

  isInsideTmux(): boolean {
    return Boolean(process.env.TMUX);
  }

  lobbyExists(): boolean {
    return this.run(["has-session", "-t", this.lobbySession]).status === 0;
  }

  ensureLobby(homeCwd: string): boolean {
    if (!this.lobbyExists()) {
      const created = this.run([
        "new-session",
        "-d",
        "-s",
        this.lobbySession,
        "-n",
        "HOME",
        "-c",
        homeCwd,
      ]);
      if (created.status !== 0) return false;
    }
    this.installGlobalBindings();
    return true;
  }

  installGlobalBindings(): void {
    this.run(["bind-key", "-n", "C-Space", "select-window", "-t", `${this.lobbySession}:0`]);
  }

  paneMap(): Map<string, TmuxTarget> {
    const map = new Map<string, TmuxTarget>();
    const res = this.run([
      "list-windows",
      "-a",
      "-F",
      `#{session_name}${FIELD_SEP}#{window_index}${FIELD_SEP}#{pane_current_path}`,
    ]);
    if (res.status !== 0 || !res.stdout) return map;

    for (const line of res.stdout.split("\n")) {
      if (!line.trim()) continue;
      const [session, windowStr, panePath] = line.split(FIELD_SEP);
      if (!session || windowStr === undefined || !panePath) continue;
      // Skip the dashboard's own HOME window so it never lists/jumps to itself.
      if (session === this.lobbySession && Number(windowStr) === 0) continue;
      map.set(panePath, { session, window: Number(windowStr) });
    }
    return map;
  }

  jumpTo(target: TmuxTarget): void {
    const dest = `${target.session}:${target.window}`;
    if (this.isInsideTmux()) {
      // switch-client moves the attached client to the target session+window,
      // covering both same-session and cross-session jumps.
      this.run(["switch-client", "-t", dest]);
    } else {
      // No client attached → attach (hands the terminal to tmux).
      this.run(["attach-session", "-t", dest], true);
    }
  }

  spawnWindow(opts: SpawnWindowOpts): TmuxTarget | null {
    const res = this.run([
      "new-window",
      "-d",
      "-t",
      this.lobbySession,
      "-n",
      opts.name,
      "-c",
      opts.cwd,
      "-P",
      "-F",
      `#{session_name}${FIELD_SEP}#{window_index}`,
      opts.command,
      ...opts.args,
    ]);
    if (res.status !== 0 || !res.stdout) return null;

    const [session, windowStr] = res.stdout.trim().split(FIELD_SEP);
    if (!session || windowStr === undefined) return null;
    return { session, window: Number(windowStr) };
  }
}
