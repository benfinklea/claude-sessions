import fs from "node:fs";
import path from "node:path";

const MARKERS = [".wt-session", ".wt-focus", ".git"] as const;

/**
 * Resolve the worktree root for a session by walking up from its `cwd` until a
 * directory contains a `.wt-session`, `.wt-focus`, or `.git` marker. Results are
 * memoized per cwd (session cwds repeat heavily across the ~1000-session list).
 */
export class WorktreeRootResolver {
  private readonly cache = new Map<string, string | undefined>();

  resolve(cwd: string): string | undefined {
    if (!cwd) return undefined;
    const cached = this.cache.get(cwd);
    if (cached !== undefined || this.cache.has(cwd)) return cached;

    let dir = cwd;
     
    while (true) {
      for (const marker of MARKERS) {
        if (fs.existsSync(path.join(dir, marker))) {
          this.cache.set(cwd, dir);
          return dir;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    this.cache.set(cwd, undefined);
    return undefined;
  }
}
