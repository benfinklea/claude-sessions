import fs from "node:fs";
import path from "node:path";

interface CacheEntry {
  readonly mtimeMs: number;
  readonly label: string | undefined;
}

const MISSING = -1;
const MAX_LABEL = 60;

/**
 * Read `<worktreeRoot>/.wt-focus` (the human ≤60-char session label). Cached by
 * file mtime so re-reads across refreshes don't re-parse unchanged files.
 */
export class FocusLabelService {
  private readonly cache = new Map<string, CacheEntry>();

  get(worktreeRoot: string): string | undefined {
    const file = path.join(worktreeRoot, ".wt-focus");

    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(file).mtimeMs;
    } catch {
      this.cache.set(worktreeRoot, { mtimeMs: MISSING, label: undefined });
      return undefined;
    }

    const cached = this.cache.get(worktreeRoot);
    if (cached && cached.mtimeMs === mtimeMs) return cached.label;

    let label: string | undefined;
    try {
      const firstLine = fs.readFileSync(file, "utf8").split("\n")[0]?.trim() ?? "";
      label = firstLine.length ? firstLine.slice(0, MAX_LABEL) : undefined;
    } catch {
      label = undefined;
    }

    this.cache.set(worktreeRoot, { mtimeMs, label });
    return label;
  }

  invalidate(worktreeRoot?: string): void {
    if (worktreeRoot) this.cache.delete(worktreeRoot);
    else this.cache.clear();
  }
}
