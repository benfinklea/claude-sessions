import type { Session } from "../../session/domain/session.model.js";

export interface ToggleFilters {
  worktreesOnly: boolean;
  repoFilter: string | null;
}

/** Distinct repo names present, sorted — what `R` cycles through. */
export function distinctRepos(sessions: Session[]): string[] {
  return [...new Set(sessions.map((s) => s.repo).filter((r): r is string => !!r))].sort();
}

/** Apply the composable toggle filters (worktrees-only + repo) to a list. */
export function applyToggleFilters(sessions: Session[], f: ToggleFilters): Session[] {
  return sessions.filter(
    (s) =>
      (!f.worktreesOnly || Boolean(s.hasWorktree)) &&
      (f.repoFilter === null || s.repo === f.repoFilter),
  );
}

/** Cycle: null → repos[0] → … → repos[last] → null. */
export function nextRepo(repos: string[], current: string | null): string | null {
  if (repos.length === 0) return null;
  if (current === null) return repos[0]!;
  const i = repos.indexOf(current);
  return i < 0 || i === repos.length - 1 ? null : repos[i + 1]!;
}

/** The context-aware label for what Enter does on a row. */
export function enterLabel(session: Session | undefined): string {
  if (!session) return "—";
  if (session.isLive) return "Jump";
  if (session.isStale) return "Resume (clean)";
  return "Resume";
}
