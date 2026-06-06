import type { Session } from "../../../session/domain/session.model.js";
import type { RowAction } from "../../domain/row-action.model.js";

/**
 * Decide what Enter does on a row. A LIVE session jumps to its window (resuming
 * would spawn a duplicate); everything else resumes in a new window — "clean"
 * when the row is stale so the dead lock can be cleared first.
 */
export class ResolveRowActionUseCase {
  resolve(session: Session): RowAction {
    if (session.isLive && session.tmuxTarget) {
      return { kind: "JUMP", target: session.tmuxTarget };
    }
    return {
      kind: "RESUME",
      sessionId: session.id,
      providerName: session.provider,
      cwd: session.worktreeRoot ?? session.cwd,
      label: session.focusLabel ?? session.preview,
      clean: Boolean(session.isStale),
    };
  }
}
