import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WorktreeRootResolver } from "./worktree-root.resolver.js";

describe("WorktreeRootResolver", () => {
  let root: string;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wtroot-")));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("walks up to the dir containing a .git marker", () => {
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /somewhere");
    const deep = path.join(root, "src", "nested");
    fs.mkdirSync(deep, { recursive: true });
    expect(new WorktreeRootResolver().resolve(deep)).toBe(root);
  });

  it("recognizes .wt-session and .wt-focus markers too", () => {
    fs.writeFileSync(path.join(root, ".wt-focus"), "demo");
    expect(new WorktreeRootResolver().resolve(root)).toBe(root);
  });

  it("returns undefined when no marker is found", () => {
    const deep = path.join(root, "a", "b");
    fs.mkdirSync(deep, { recursive: true });
    // root itself has no marker
    expect(new WorktreeRootResolver().resolve(deep)).toBeUndefined();
  });

  it("memoizes and returns a stable result for the same cwd", () => {
    fs.writeFileSync(path.join(root, ".git"), "x");
    const r = new WorktreeRootResolver();
    const first = r.resolve(root);
    fs.rmSync(path.join(root, ".git")); // would change result if not cached
    expect(r.resolve(root)).toBe(first);
  });

  it("handles paths with spaces and apostrophes", () => {
    const weird = path.join(root, "Ben's Vault", "sub dir");
    fs.mkdirSync(weird, { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "x");
    expect(new WorktreeRootResolver().resolve(weird)).toBe(root);
  });
});
