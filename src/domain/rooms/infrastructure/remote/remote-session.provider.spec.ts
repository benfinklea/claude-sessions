import { describe, it, expect, beforeEach, vi } from "vitest";

const spawnSync = vi.fn();
vi.mock("node:child_process", () => ({ spawnSync: (...a: unknown[]) => spawnSync(...a) }));

const { RemoteSessionProvider } = await import("./remote-session.provider.js");

const dto = {
  id: "x",
  project: "p",
  gitBranch: "b",
  messageCount: 3,
  preview: "hi",
  modifiedAt: "2026-06-06T10:00:00.000Z",
  cwd: "/Volumes/Development/p",
  provider: "Claude",
  isLive: true,
  tmuxTarget: { session: "main", window: 2 },
};

describe("RemoteSessionProvider", () => {
  beforeEach(() => spawnSync.mockReset());

  it("invokes ssh with BatchMode and the remote-expanded $HOME/bin path", async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify([dto]), stderr: "" });
    await new RemoteSessionProvider("pippen", 250).findAll();
    const [cmd, args] = spawnSync.mock.calls[0]!;
    expect(cmd).toBe("ssh");
    expect(args).toContain("pippen");
    expect(args).toContain("-o");
    expect(args).toContain("BatchMode=yes");
    const remoteCmd = (args as string[])[args.length - 1];
    expect(remoteCmd).toContain('"$HOME/bin/claude-sessions"');
    expect(remoteCmd).toContain("--json");
    expect(remoteCmd).toContain("--limit 250");
  });

  it("parses DTOs and tags them with the host machine", async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify([dto]), stderr: "" });
    const sessions = await new RemoteSessionProvider("pippen").findAll();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.machine).toBe("pippen");
    expect(sessions[0]!.isLive).toBe(true);
    expect(sessions[0]!.tmuxTarget).toEqual({ session: "main", window: 2 });
  });

  it("returns [] on non-zero exit (host down / not installed)", async () => {
    spawnSync.mockReturnValue({ status: 255, stdout: "", stderr: "conn refused" });
    expect(await new RemoteSessionProvider("pippen").findAll()).toEqual([]);
  });

  it("returns [] on unparseable output", async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: "not json", stderr: "" });
    expect(await new RemoteSessionProvider("pippen").findAll()).toEqual([]);
  });

  it("honors ROOMS_REMOTE_BIN override", async () => {
    const provider = new RemoteSessionProvider("pippen", 300, "/opt/cs");
    spawnSync.mockReturnValue({ status: 0, stdout: "[]", stderr: "" });
    await provider.findAll();
    const args = spawnSync.mock.calls[0]![1] as string[];
    expect(args[args.length - 1]).toContain("/opt/cs --json");
  });
});
