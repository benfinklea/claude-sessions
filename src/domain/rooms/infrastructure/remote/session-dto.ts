import { Session } from "../../../session/domain/session.model.js";

/** Wire format for a session passed between machines (via `--json` over SSH). */
export interface SessionDTO {
  id: string;
  project: string;
  gitBranch: string;
  messageCount: number;
  preview: string;
  modifiedAt: string; // ISO
  cwd: string;
  provider: string;
  worktreeRoot?: string;
  focusLabel?: string;
  isLive?: boolean;
  isStale?: boolean;
  tmuxTarget?: { session: string; window: number };
  hasWorktree?: boolean;
  handoffPath?: string;
  repo?: string;
}

export function toDTO(s: Session): SessionDTO {
  return {
    id: s.id,
    project: s.project,
    gitBranch: s.gitBranch,
    messageCount: s.messageCount,
    preview: s.preview,
    modifiedAt: s.modifiedAt.toISOString(),
    cwd: s.cwd,
    provider: s.provider,
    worktreeRoot: s.worktreeRoot,
    focusLabel: s.focusLabel,
    isLive: s.isLive,
    isStale: s.isStale,
    tmuxTarget: s.tmuxTarget,
    hasWorktree: s.hasWorktree,
    handoffPath: s.handoffPath,
    repo: s.repo,
  };
}

/** Rebuild a Session from a remote DTO, tagging the machine it came from. */
export function fromDTO(dto: SessionDTO, machine: string): Session {
  return new Session({
    id: dto.id,
    // filePath is remote — keep the remote absolute path for reference/preview.
    filePath: dto.cwd,
    project: dto.project,
    gitBranch: dto.gitBranch,
    messageCount: dto.messageCount,
    preview: dto.preview,
    modifiedAt: new Date(dto.modifiedAt),
    cwd: dto.cwd,
    provider: dto.provider,
    worktreeRoot: dto.worktreeRoot,
    focusLabel: dto.focusLabel,
    isLive: dto.isLive,
    isStale: dto.isStale,
    tmuxTarget: dto.tmuxTarget,
    hasWorktree: dto.hasWorktree,
    handoffPath: dto.handoffPath,
    repo: dto.repo,
    machine,
  });
}
