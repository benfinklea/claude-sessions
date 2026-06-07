import type { SessionRepositoryPort } from "../../../session/application/ports/session-repository.port.js";
import type { Session } from "../../../session/domain/session.model.js";
import type { SessionDetail } from "../../../session/domain/session-detail.model.js";
import type { RemoteSessionProvider } from "./remote-session.provider.js";

/**
 * Merges the local (enriched) session list with one or more remote machines'
 * lists. Remote fetches run concurrently and failures are swallowed — if pippen
 * is unreachable you still get your local sessions.
 */
export class CompositeSessionRepository implements SessionRepositoryPort {
  constructor(
    private readonly local: SessionRepositoryPort,
    private readonly remotes: RemoteSessionProvider[],
  ) {}

  async findAll(): Promise<Session[]> {
    const [localSessions, ...remoteResults] = await Promise.all([
      this.local.findAll(),
      ...this.remotes.map((r) => r.findAll().catch(() => [] as Session[])),
    ]);
    return [...localSessions, ...remoteResults.flat()];
  }

  getDetail(filePath: string, providerName?: string): Promise<SessionDetail> {
    // Peek currently reads local files only; remote peek is future work.
    return this.local.getDetail(filePath, providerName);
  }
}
