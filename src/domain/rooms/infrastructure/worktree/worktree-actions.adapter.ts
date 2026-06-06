import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { WorktreeActionsPort } from "../../application/ports/worktree-actions.port.js";

/** Resolve a helper binary, honoring an env override, else ~/bin/<name>. */
function bin(envVar: string, name: string): string {
  return process.env[envVar] ?? path.join(os.homedir(), "bin", name);
}

/** The `c` slug → folder tail: everything after the last "/" (feat/x → x). */
function slugTail(slug: string): string {
  const parts = slug.split("/");
  return parts[parts.length - 1] || slug;
}

/**
 * Shells out to the user's canonical worktree tooling (`c`, `set-focus`,
 * `wtrm`) via argv arrays and real ~/bin paths (no shell — avoids both
 * injection and the alias-vs-script problem). Paths are passed literally so
 * spaces/apostrophes are safe.
 */
export class WorktreeActionsAdapter implements WorktreeActionsPort {
  spawnCommand(slug: string): { command: string; args: string[] } {
    return { command: bin("ROOMS_C_BIN", "c"), args: ["-wt", slug] };
  }

  predictWorktreeRoot(mainRepoRoot: string, slug: string): string {
    return `${mainRepoRoot}-${slugTail(slug)}`;
  }

  setFocus(worktreeRoot: string, label: string): void {
    spawnSync(bin("ROOMS_SETFOCUS_BIN", "set-focus"), [label], {
      cwd: worktreeRoot,
      stdio: "ignore",
    });
  }

  teardown(worktreeRoot: string, opts: { backup?: boolean } = {}): boolean {
    const args = opts.backup ? ["--backup", worktreeRoot] : [worktreeRoot];
    const res = spawnSync(bin("ROOMS_WTRM_BIN", "wtrm"), args, {
      stdio: "pipe",
      encoding: "utf8",
    });
    return res.status === 0;
  }
}
