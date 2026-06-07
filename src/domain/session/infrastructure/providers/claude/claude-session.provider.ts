import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { SessionProviderPort } from "../../../application/ports/session-provider.port.js";
import { Session } from "../../../domain/session.model.js";
import { SessionDetail } from "../../../domain/session-detail.model.js";
import { parseSessionFileAsync, parseSessionDetail } from "../../parsers/jsonl-parser.js";
import { decodeProjectPath } from "../../../../../common/helpers/path.helper.js";

/**
 * Files that are NOT real interactive sessions: workflow subagent transcripts
 * (`agent-<id>.jsonl`) and infrastructure logs. Excluded by default so the list
 * shows the sessions a human actually drove. Set CLAUDE_SESSIONS_INCLUDE_AGENTS=1
 * (the `--all` flag) to show everything.
 */
function isAgentFile(basename: string): boolean {
  return (
    basename.startsWith("agent-") ||
    basename === "skill-injections.jsonl" ||
    basename === "journal.jsonl"
  );
}

/**
 * Automation/worker sessions run in temp dirs (workflow lanes, cmf build
 * workers, smoke tests like "Reply with exactly: CLAUDE_OK"). A human never
 * sits in /tmp, so these are hidden by default — the noise the list is full of.
 */
function isAutomationCwd(cwd: string): boolean {
  return (
    cwd.startsWith("/tmp/") ||
    cwd.startsWith("/private/tmp/") ||
    cwd === "/tmp" ||
    cwd === "/private/tmp"
  );
}

export class ClaudeSessionProvider implements SessionProviderPort {
  readonly name = "Claude";
  buildResumeArgs(sessionId: string) {
    return { command: "claude", args: ["--resume", sessionId] };
  }
  private readonly sessionsDir: string;

  constructor(sessionsDir?: string) {
    this.sessionsDir =
      sessionsDir ??
      process.env.CLAUDE_SESSIONS_DIR ??
      path.join(os.homedir(), ".claude", "projects");
  }

  private includeAgents(): boolean {
    return process.env.CLAUDE_SESSIONS_INCLUDE_AGENTS === "1";
  }

  async findAll(): Promise<Session[]> {
    if (!fs.existsSync(this.sessionsDir)) return [];

    const results: { filePath: string; dirName: string; mtime: Date }[] = [];

    for (const dir of fs.readdirSync(this.sessionsDir, {
      withFileTypes: true,
    })) {
      if (!dir.isDirectory()) continue;

      const projectPath = path.join(this.sessionsDir, dir.name);
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(projectPath, { withFileTypes: true });
      } catch {
        continue;
      }

      const includeAgents = this.includeAgents();
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        // Skip workflow/agent/infra transcripts before parsing (fast, and the bulk of files).
        if (!includeAgents && isAgentFile(entry.name)) continue;

        const filePath = path.join(projectPath, entry.name);
        try {
          const stat = fs.statSync(filePath);
          results.push({ filePath, dirName: dir.name, mtime: stat.mtime });
        } catch {
          continue;
        }
      }
    }

    // Fast-open cap: collecting stats is cheap, but parsing the first message of
    // every .jsonl is not. When CLAUDE_SESSIONS_LIMIT is set (e.g. by the
    // dashboard), only the most-recent N files are parsed. Unset = parse all.
    results.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    const limit = Number(process.env.CLAUDE_SESSIONS_LIMIT);
    const capped = Number.isInteger(limit) && limit > 0 ? results.slice(0, limit) : results;

    const includeAgents = this.includeAgents();
    const parsed = await Promise.all(
      capped.map(async (file) => {
        const metadata = await parseSessionFileAsync(file.filePath);
        return { file, metadata };
      }),
    );

    return (
      parsed
        // Sidechain transcripts (Task/Agent subagents) and /tmp automation/worker
        // runs aren't sessions a human drove — hidden unless --all.
        .filter(
          ({ metadata }) =>
            includeAgents || (!metadata.isSidechain && !isAutomationCwd(metadata.cwd)),
        )
        .map(
          ({ file, metadata }) =>
            new Session({
              id: path.basename(file.filePath, ".jsonl"),
              filePath: file.filePath,
              project: decodeProjectPath(file.dirName),
              gitBranch: metadata.gitBranch,
              messageCount: metadata.messageCount,
              preview: metadata.preview,
              modifiedAt: file.mtime,
              cwd: metadata.cwd,
              provider: this.name,
            }),
        )
    );
  }

  async getDetail(filePath: string): Promise<SessionDetail> {
    const parsed = parseSessionDetail(filePath);
    return new SessionDetail({
      messages: parsed.messages,
      totalMessages: parsed.totalMessages,
      cwd: parsed.cwd,
      gitBranch: parsed.gitBranch,
    });
  }
}
