import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const spawnSync = vi.fn();
vi.mock("node:child_process", () => ({ spawnSync: (...a: unknown[]) => spawnSync(...a) }));

const { WorktreeActionsAdapter } = await import("./worktree-actions.adapter.js");

describe("WorktreeActionsAdapter", () => {
  const env = { ...process.env };
  beforeEach(() => {
    spawnSync.mockReset();
    spawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "" });
    delete process.env.ROOMS_C_BIN;
    delete process.env.ROOMS_SETFOCUS_BIN;
    delete process.env.ROOMS_WTRM_BIN;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("predictWorktreeRoot follows the `c` convention <mainRepoRoot>-<slug-tail>", () => {
    const a = new WorktreeActionsAdapter();
    expect(a.predictWorktreeRoot("/Volumes/Development/coppermind-cmo", "burn")).toBe(
      "/Volumes/Development/coppermind-cmo-burn",
    );
    // explicit prefix → tail after the slash
    expect(a.predictWorktreeRoot("/Volumes/Development/cmf", "fix/cache-bug")).toBe(
      "/Volumes/Development/cmf-cache-bug",
    );
  });

  it("spawnCommand returns the c launcher invocation", () => {
    const { command, args } = new WorktreeActionsAdapter().spawnCommand("demo");
    expect(command.endsWith("/bin/c")).toBe(true);
    expect(args).toEqual(["-wt", "demo"]);
  });

  it("setFocus shells set-focus with the label in the worktree cwd", () => {
    new WorktreeActionsAdapter().setFocus("/Volumes/Dev/Ben's Vault", "xscape attribution");
    const [bin, args, opts] = spawnSync.mock.calls[0]!;
    expect(String(bin).endsWith("/bin/set-focus")).toBe(true);
    expect(args).toEqual(["xscape attribution"]);
    expect((opts as { cwd: string }).cwd).toBe("/Volumes/Dev/Ben's Vault");
  });

  it("teardown passes --backup only when requested and returns success on exit 0", () => {
    const a = new WorktreeActionsAdapter();
    expect(a.teardown("/wt")).toBe(true);
    expect(spawnSync.mock.calls[0]![1]).toEqual(["/wt"]);
    a.teardown("/wt", { backup: true });
    expect(spawnSync.mock.calls[1]![1]).toEqual(["--backup", "/wt"]);
  });

  it("teardown returns false on non-zero exit (e.g. dirty worktree refused)", () => {
    spawnSync.mockReturnValue({ status: 1, stdout: "", stderr: "dirty" });
    expect(new WorktreeActionsAdapter().teardown("/wt")).toBe(false);
  });

  it("honors binary overrides via env", () => {
    process.env.ROOMS_WTRM_BIN = "/custom/wtrm";
    new WorktreeActionsAdapter().teardown("/wt");
    expect(spawnSync.mock.calls[0]![0]).toBe("/custom/wtrm");
  });
});
