import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface HandoffRef {
  readonly path: string;
  readonly title: string;
  readonly dir: string;
  readonly when: string;
}

/**
 * Indexes `~/.claude/handoffs/*.md` (saved by the /handoff skill). Each handoff
 * carries a `**Dir:**` line, so we can attach the newest handoff to the session
 * whose worktree matches — letting you pick up a closed session right where you
 * left off. Files are small and few; we read the header of each once.
 */
export class HandoffService {
  private readonly dir: string;
  private cache: Map<string, HandoffRef> | null = null;

  constructor(dir?: string) {
    this.dir =
      dir ?? process.env.ROOMS_HANDOFFS_DIR ?? path.join(os.homedir(), ".claude", "handoffs");
  }

  /** dir → newest handoff for that worktree. */
  index(): Map<string, HandoffRef> {
    if (this.cache) return this.cache;
    const byDir = new Map<string, HandoffRef>();
    let files: string[];
    try {
      files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".md"));
    } catch {
      this.cache = byDir;
      return byDir;
    }

    // Filename embeds a sortable timestamp (handoff-YYYY-MM-DD-HHMMSS-slug.md),
    // so a lexical sort puts the newest last → it wins the per-dir slot.
    files.sort();
    for (const file of files) {
      const full = path.join(this.dir, file);
      const ref = this.parseHeader(full);
      if (ref?.dir) byDir.set(ref.dir, ref);
    }
    this.cache = byDir;
    return byDir;
  }

  /** Read up to 4KB and pull the title / Dir / When out of the header. */
  private parseHeader(full: string): HandoffRef | null {
    let head: string;
    try {
      const fd = fs.openSync(full, "r");
      const buf = Buffer.alloc(4096);
      const n = fs.readSync(fd, buf, 0, 4096, 0);
      fs.closeSync(fd);
      head = buf.toString("utf8", 0, n);
    } catch {
      return null;
    }
    const dir = head.match(/^\*\*Dir:\*\*\s*(.+)$/m)?.[1]?.trim() ?? "";
    if (!dir) return null;
    const title =
      head.match(/^#\s*Handoff:\s*(.+)$/m)?.[1]?.trim() ??
      head.match(/^#\s*(.+)$/m)?.[1]?.trim() ??
      path.basename(full);
    const when = head.match(/^\*\*When:\*\*\s*(.+)$/m)?.[1]?.trim() ?? "";
    return { path: full, title, dir, when };
  }
}
