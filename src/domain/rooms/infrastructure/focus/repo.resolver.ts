import fs from "node:fs";
import path from "node:path";

/**
 * Derives a stable repo name shared across a repo's worktrees, so "filter by
 * repo" groups e.g. coppermind-cmo + coppermind-cmo-tweaks + coppermind-cmo-foo
 * under one label.
 *
 * - Linked worktree (`.git` is a `gitdir: …/<repo>/.git/worktrees/<name>` file)
 *   → the main repo's directory name.
 * - Main checkout (`.git` is a directory) → the directory's own name.
 * Cached per worktree root.
 */
export class RepoResolver {
  private readonly cache = new Map<string, string>();

  resolve(worktreeRoot: string): string {
    const cached = this.cache.get(worktreeRoot);
    if (cached !== undefined) return cached;

    let repo = path.basename(worktreeRoot);
    try {
      const gitPath = path.join(worktreeRoot, ".git");
      const stat = fs.statSync(gitPath);
      if (stat.isFile()) {
        const pointer = fs.readFileSync(gitPath, "utf8").trim(); // "gitdir: /a/b/<repo>/.git/worktrees/x"
        const m = pointer.match(/gitdir:\s*(.+?)\/\.git\/worktrees\//);
        if (m?.[1]) repo = path.basename(m[1]);
      }
    } catch {
      // fall back to the basename
    }
    this.cache.set(worktreeRoot, repo);
    return repo;
  }
}
