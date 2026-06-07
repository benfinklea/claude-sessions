import { spawnSync } from "node:child_process";
import { Session } from "../../../session/domain/session.model.js";
import { fromDTO, type SessionDTO } from "./session-dto.js";

/**
 * Pulls another machine's session list over SSH by running `claude-sessions
 * --json` there (that host computes its own liveness from its own tmux + locks).
 * Requires passwordless SSH and claude-sessions installed on the remote.
 */
export class RemoteSessionProvider {
  constructor(
    private readonly host: string,
    private readonly limit: number = 300,
    // Reference the binary by an absolute path (remote $HOME expands), not PATH —
    // SSH's non-interactive shell often won't have ~/.npm-global/bin on PATH.
    // ROOMS_REMOTE_BIN overrides the command verbatim.
    private readonly remoteBin: string = process.env.ROOMS_REMOTE_BIN ??
      '"$HOME/bin/claude-sessions"',
  ) {}

  async findAll(): Promise<Session[]> {
    // Single-quoted remote command so the REMOTE shell expands $HOME.
    // -o BatchMode=yes: never hang on a password prompt; fail fast instead.
    const res = spawnSync(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=8",
        this.host,
        `${this.remoteBin} --json --limit ${this.limit}`,
      ],
      { encoding: "utf8", timeout: 25_000, maxBuffer: 64 * 1024 * 1024 },
    );

    if (res.status !== 0 || !res.stdout) return [];
    let dtos: SessionDTO[];
    try {
      dtos = JSON.parse(res.stdout);
    } catch {
      return [];
    }
    return dtos.map((d) => fromDTO(d, this.host));
  }
}
