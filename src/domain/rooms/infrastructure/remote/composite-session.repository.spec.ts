import { describe, it, expect, vi } from "vitest";
import { CompositeSessionRepository } from "./composite-session.repository.js";
import { Session } from "../../../session/domain/session.model.js";
import type { SessionRepositoryPort } from "../../../session/application/ports/session-repository.port.js";
import type { RemoteSessionProvider } from "./remote-session.provider.js";

function s(id: string, machine?: string): Session {
  return new Session({
    id,
    filePath: "/p",
    project: "p",
    gitBranch: "b",
    messageCount: 1,
    preview: "",
    modifiedAt: new Date(),
    cwd: "/x",
    provider: "Claude",
    machine,
  });
}

const localRepo = (sessions: Session[]): SessionRepositoryPort => ({
  findAll: async () => sessions,
  getDetail: vi.fn().mockResolvedValue({ messages: [] }),
});

const remote = (sessions: Session[] | Error) =>
  ({
    findAll: async () => {
      if (sessions instanceof Error) throw sessions;
      return sessions;
    },
  }) as unknown as RemoteSessionProvider;

describe("CompositeSessionRepository", () => {
  it("merges local + remote sessions", async () => {
    const repo = new CompositeSessionRepository(localRepo([s("a")]), [
      remote([s("p1", "pippen"), s("p2", "pippen")]),
    ]);
    const all = await repo.findAll();
    expect(all.map((x) => x.id).sort()).toEqual(["a", "p1", "p2"]);
    expect(all.find((x) => x.id === "p1")!.machine).toBe("pippen");
  });

  it("swallows a remote failure and still returns local sessions", async () => {
    const repo = new CompositeSessionRepository(localRepo([s("a"), s("b")]), [
      remote(new Error("ssh down")),
    ]);
    const all = await repo.findAll();
    expect(all.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("merges multiple remotes", async () => {
    const repo = new CompositeSessionRepository(localRepo([]), [
      remote([s("p1", "pippen")]),
      remote([s("g1", "gandalf")]),
    ]);
    const all = await repo.findAll();
    expect(all.map((x) => x.machine).sort()).toEqual(["gandalf", "pippen"]);
  });

  it("delegates getDetail to the local repository", async () => {
    const local = localRepo([]);
    const repo = new CompositeSessionRepository(local, []);
    await repo.getDetail("/p/x.jsonl", "Claude");
    expect(local.getDetail).toHaveBeenCalledWith("/p/x.jsonl", "Claude");
  });
});
