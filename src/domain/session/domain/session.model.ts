export interface TmuxTargetRef {
  readonly session: string;
  readonly window: number;
}

export interface SessionParams {
  readonly id: string;
  readonly filePath: string;
  readonly project: string;
  readonly gitBranch: string;
  readonly messageCount: number;
  readonly preview: string;
  readonly modifiedAt: Date;
  readonly cwd: string;
  readonly provider: string;
  // --- claude-sessions enrichment (optional; absent on upstream paths) ---
  readonly worktreeRoot?: string;
  readonly focusLabel?: string;
  readonly isLive?: boolean;
  readonly isStale?: boolean;
  readonly tmuxTarget?: TmuxTargetRef;
  /** Which machine this session lives on. undefined = local. e.g. "pippen". */
  readonly machine?: string;
}

export class Session {
  readonly id: string;
  readonly filePath: string;
  readonly project: string;
  readonly gitBranch: string;
  readonly messageCount: number;
  readonly preview: string;
  readonly modifiedAt: Date;
  readonly cwd: string;
  readonly provider: string;
  readonly worktreeRoot?: string;
  readonly focusLabel?: string;
  readonly isLive?: boolean;
  readonly isStale?: boolean;
  readonly tmuxTarget?: TmuxTargetRef;
  readonly machine?: string;

  constructor(params: SessionParams) {
    this.id = params.id;
    this.filePath = params.filePath;
    this.project = params.project;
    this.gitBranch = params.gitBranch;
    this.messageCount = params.messageCount;
    this.preview = params.preview;
    this.modifiedAt = params.modifiedAt;
    this.cwd = params.cwd;
    this.provider = params.provider;
    this.worktreeRoot = params.worktreeRoot;
    this.focusLabel = params.focusLabel;
    this.isLive = params.isLive;
    this.isStale = params.isStale;
    this.tmuxTarget = params.tmuxTarget;
    this.machine = params.machine;
  }

  /** A new Session with the enrichment fields overlaid (upstream fields preserved). */
  withEnrichment(extra: {
    worktreeRoot?: string;
    focusLabel?: string;
    isLive?: boolean;
    isStale?: boolean;
    tmuxTarget?: TmuxTargetRef;
  }): Session {
    return new Session({ ...this, modifiedAt: this.modifiedAt, ...extra });
  }

  matchesFilter(query: string): boolean {
    if (!query) return true;
    const lower = query.toLowerCase();
    const searchable =
      `${this.provider} ${this.project} ${this.gitBranch} ${this.preview} ${this.cwd} ${this.focusLabel ?? ""} ${this.machine ?? ""}`.toLowerCase();
    return searchable.includes(lower);
  }
}
