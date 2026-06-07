import fs from "node:fs";
import path from "node:path";

/**
 * Is this worktree a *linked* git worktree still on disk — i.e. a `c -wt`
 * feature worktree that hasn't been torn down with wtrm? A linked worktree has
 * a `.git` FILE (a `gitdir:` pointer); the main checkout has a `.git` DIRECTORY.
 * Cached per root (cheap statSync, but roots repeat across many sessions).
 */
export class WorktreeStatusService {
  private readonly cache = new Map<string, boolean>();

  isLinkedWorktree(worktreeRoot: string): boolean {
    const cached = this.cache.get(worktreeRoot);
    if (cached !== undefined) return cached;

    let result: boolean;
    try {
      result = fs.statSync(path.join(worktreeRoot, ".git")).isFile();
    } catch {
      result = false; // .git missing → worktree gone / not a git dir
    }
    this.cache.set(worktreeRoot, result);
    return result;
  }
}
