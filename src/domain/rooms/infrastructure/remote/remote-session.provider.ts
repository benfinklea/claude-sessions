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
    private readonly remoteBin: string = process.env.ROOMS_REMOTE_BIN ?? "claude-sessions",
  ) {}

  async findAll(): Promise<Session[]> {
    // -o BatchMode=yes: never hang on a password prompt; fail fast instead.
    const res = spawnSync(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=8",
        this.host,
        // login shell so PATH includes the user's bin dirs
        `$SHELL -lc '${this.remoteBin} --json --limit ${this.limit}'`,
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
