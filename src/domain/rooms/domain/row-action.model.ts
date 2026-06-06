import type { TmuxTarget } from "./liveness.model.js";

/**
 * What pressing Enter on a row resolves to. A LIVE row jumps to its window
 * (never resumes — that would spawn a duplicate); a dormant/stale row resumes
 * in a new window.
 */
export type RowAction =
  | { readonly kind: "JUMP"; readonly target: TmuxTarget }
  | {
      readonly kind: "RESUME";
      readonly sessionId: string;
      readonly providerName: string;
      readonly cwd: string;
      readonly label: string;
      /** true when resuming a stale row — the dead lock should be cleared first. */
      readonly clean: boolean;
    };
