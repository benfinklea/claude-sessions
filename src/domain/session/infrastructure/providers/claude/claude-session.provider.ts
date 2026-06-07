import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { SessionProviderPort } from "../../../application/ports/session-provider.port.js";
import { Session } from "../../../domain/session.model.js";
import { SessionDetail } from "../../../domain/session-detail.model.js";
import { parseSessionFileAsync, parseSessionDetail } from "../../parsers/jsonl-parser.js";
import { ParseCache } from "../../parsers/parse-cache.js";
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

/**
 * Scheduled/headless agents (e.g. "You are a meeting note sync agent…") open
 * with a system-prompt-style first message. Hidden by default. A human can
 * still see them with --all if they ever typed such a prompt interactively.
 */
function isAgentPreview(preview: string): boolean {
  return /^you are an? /i.test(preview.trim());
}

export class ClaudeSessionProvider implements SessionProviderPort {
  readonly name = "Claude";
  buildResumeArgs(sessionId: string) {
    return { command: "claude", args: ["--resume", sessionId] };
  }
  private readonly sessionsDir: string;
  // Disk parse-cache only when running against the default location (production),
  // not when a test passes an explicit dir — keeps tests hermetic.
  private readonly cache: ParseCache | null;

  constructor(sessionsDir?: string) {
    this.sessionsDir =
      sessionsDir ??
      process.env.CLAUDE_SESSIONS_DIR ??
      path.join(os.homedir(), ".claude", "projects");
    this.cache = sessionsDir || process.env.CLAUDE_SESSIONS_NO_CACHE ? null : new ParseCache();
  }

  /** Parse a file's metadata, reusing the mtime-keyed cache when valid. */
  private async metaFor(filePath: string, mtimeMs: number) {
    const hit = this.cache?.get(filePath, mtimeMs);
    if (hit) return hit;
    const meta = await parseSessionFileAsync(filePath);
    this.cache?.set(filePath, mtimeMs, {
      preview: meta.preview,
      gitBranch: meta.gitBranch,
      cwd: meta.cwd,
      messageCount: meta.messageCount,
      isSidechain: meta.isSidechain,
    });
    return meta;
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

    // Newest first.
    results.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    const includeAgents = this.includeAgents();

    const keep = (m: { isSidechain: boolean; cwd: string; preview: string }) =>
      includeAgents || (!m.isSidechain && !isAutomationCwd(m.cwd) && !isAgentPreview(m.preview));

    const toSession = (
      file: (typeof results)[number],
      metadata: { gitBranch: string; messageCount: number; preview: string; cwd: string },
    ) =>
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
      });

    const limit = Number(process.env.CLAUDE_SESSIONS_LIMIT);
    // No limit → parse everything, then filter.
    if (!Number.isInteger(limit) || limit <= 0) {
      const parsed = await Promise.all(
        results.map(async (file) => ({
          file,
          metadata: await this.metaFor(file.filePath, file.mtime.getTime()),
        })),
      );
      this.cache?.save(true); // full scan → safe to prune stale entries
      return parsed.filter((p) => keep(p.metadata)).map((p) => toSession(p.file, p.metadata));
    }

    // Limit counts REAL (surviving) sessions, not raw files: parse newest-first
    // in batches, applying the filter, until we have `limit` survivors. Avoids
    // returning only a handful when recent files are mostly /tmp automation.
    const BATCH = 200;
    const out: Session[] = [];
    for (let i = 0; i < results.length && out.length < limit; i += BATCH) {
      const batch = results.slice(i, i + BATCH);
      const parsed = await Promise.all(
        batch.map(async (file) => ({
          file,
          metadata: await this.metaFor(file.filePath, file.mtime.getTime()),
        })),
      );
      for (const p of parsed) {
        if (keep(p.metadata)) out.push(toSession(p.file, p.metadata));
        if (out.length >= limit) break;
      }
    }
    this.cache?.save();
    return out;
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
