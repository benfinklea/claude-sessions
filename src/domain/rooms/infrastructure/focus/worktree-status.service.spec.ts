import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WorktreeStatusService } from "./worktree-status.service.js";

describe("WorktreeStatusService", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "wtstatus-"));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("true when .git is a FILE (linked worktree)", () => {
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /repo/.git/worktrees/x");
    expect(new WorktreeStatusService().isLinkedWorktree(root)).toBe(true);
  });

  it("false when .git is a DIRECTORY (main checkout)", () => {
    fs.mkdirSync(path.join(root, ".git"));
    expect(new WorktreeStatusService().isLinkedWorktree(root)).toBe(false);
  });

  it("false when .git is missing (worktree torn down)", () => {
    expect(new WorktreeStatusService().isLinkedWorktree(root)).toBe(false);
  });

  it("caches per root (only stats once)", () => {
    fs.writeFileSync(path.join(root, ".git"), "gitdir: x");
    const svc = new WorktreeStatusService();
    const spy = vi.spyOn(fs, "statSync");
    svc.isLinkedWorktree(root);
    svc.isLinkedWorktree(root);
    svc.isLinkedWorktree(root);
    expect(spy.mock.calls.filter((c) => String(c[0]).includes(root)).length).toBe(1);
    spy.mockRestore();
  });
});
