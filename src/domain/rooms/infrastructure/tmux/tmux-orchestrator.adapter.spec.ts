import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const spawnSync = vi.fn();
vi.mock("node:child_process", () => ({ spawnSync: (...a: unknown[]) => spawnSync(...a) }));

const { TmuxOrchestratorAdapter } = await import("./tmux-orchestrator.adapter.js");

function ok(stdout = "") {
  return { status: 0, stdout, stderr: "" };
}
function fail() {
  return { status: 1, stdout: "", stderr: "no server running" };
}

describe("TmuxOrchestratorAdapter", () => {
  const origTmux = process.env.TMUX;
  beforeEach(() => {
    spawnSync.mockReset();
    delete process.env.TMUX;
  });
  afterEach(() => {
    if (origTmux === undefined) delete process.env.TMUX;
    else process.env.TMUX = origTmux;
  });

  const lastCalls = () => spawnSync.mock.calls.map((c) => c[1] as string[]);

  it("never builds a shell string — every call is tmux + argv array", () => {
    spawnSync.mockReturnValue(ok());
    const a = new TmuxOrchestratorAdapter("sessions");
    a.installGlobalBindings();
    a.paneMap();
    for (const call of spawnSync.mock.calls) {
      expect(call[0]).toBe("tmux");
      expect(Array.isArray(call[1])).toBe(true);
    }
  });

  it("ensureLobby creates a detached HOME session when absent, then binds C-Space", () => {
    spawnSync.mockReturnValueOnce(fail()); // has-session → absent
    spawnSync.mockReturnValue(ok()); // new-session, bind-key
    const a = new TmuxOrchestratorAdapter("sessions");
    expect(a.ensureLobby("/home/ben")).toBe(true);
    const calls = lastCalls();
    expect(calls[0]).toEqual(["has-session", "-t", "sessions"]);
    expect(calls[1]).toEqual([
      "new-session",
      "-d",
      "-s",
      "sessions",
      "-n",
      "HOME",
      "-c",
      "/home/ben",
    ]);
    expect(calls).toContainEqual([
      "bind-key",
      "-n",
      "C-Space",
      "select-window",
      "-t",
      "sessions:0",
    ]);
  });

  it("ensureLobby skips new-session when the lobby already exists", () => {
    spawnSync.mockReturnValue(ok()); // has-session → exists, then bind
    const a = new TmuxOrchestratorAdapter("sessions");
    a.ensureLobby("/home/ben");
    expect(lastCalls().some((c) => c[0] === "new-session")).toBe(false);
  });

  it("jumpTo uses switch-client when inside tmux", () => {
    process.env.TMUX = "/tmp/tmux-501/default,123,0";
    spawnSync.mockReturnValue(ok());
    new TmuxOrchestratorAdapter("sessions").jumpTo({ session: "sessions", window: 2 });
    expect(lastCalls()).toContainEqual(["switch-client", "-t", "sessions:2"]);
  });

  it("jumpTo attaches when outside tmux", () => {
    delete process.env.TMUX;
    spawnSync.mockReturnValue(ok());
    new TmuxOrchestratorAdapter("sessions").jumpTo({ session: "sessions", window: 2 });
    expect(lastCalls()).toContainEqual(["attach-session", "-t", "sessions:2"]);
  });

  it("spawnWindow passes the command as trailing argv and parses the new target", () => {
    spawnSync.mockReturnValue(ok("sessions\t5"));
    const t = new TmuxOrchestratorAdapter("sessions").spawnWindow({
      name: "demo",
      cwd: "/Volumes/Dev/Ben's Vault",
      command: "claude",
      args: ["--resume", "abc-123"],
    });
    const argv = lastCalls()[0]!;
    expect(argv.slice(0, 6)).toEqual(["new-window", "-d", "-t", "sessions", "-n", "demo"]);
    expect(argv).toContain("/Volumes/Dev/Ben's Vault");
    expect(argv.slice(-3)).toEqual(["claude", "--resume", "abc-123"]);
    expect(t).toEqual({ session: "sessions", window: 5 });
  });

  it("paneMap parses session/window/path triples", () => {
    spawnSync.mockReturnValue(ok("sessions\t0\t/home\nsessions\t1\t/Volumes/x\n"));
    const m = new TmuxOrchestratorAdapter("sessions").paneMap();
    expect(m.get("/home")).toEqual({ session: "sessions", window: 0 });
    expect(m.get("/Volumes/x")).toEqual({ session: "sessions", window: 1 });
  });
});
