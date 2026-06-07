import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LivenessService } from "./liveness.service.js";
import type { TmuxTarget } from "../../domain/liveness.model.js";

describe("LivenessService", () => {
  let root: string;
  const svc = new LivenessService();
  const NOW = Date.parse("2026-06-06T12:00:00Z");
  const target: TmuxTarget = { session: "main", window: 3 };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "live-"));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const writeLock = (startedISO: string, ttl = 4, pid = 999999) =>
    fs.writeFileSync(
      path.join(root, ".wt-session"),
      `pid=${pid}\nstarted=${startedISO}\nhost=h\nttl_hours=${ttl}\n`,
    );

  const map = (entries: Array<[string, TmuxTarget]> = []) => new Map(entries);

  it("undefined worktree → not live, not stale", () => {
    expect(svc.classify(undefined, { paneMap: map(), now: NOW })).toEqual({
      isLive: false,
      isStale: false,
    });
  });

  it("a tmux window sitting in the worktree → LIVE (no lock needed)", () => {
    const r = svc.classify(root, { paneMap: map([[root, target]]), now: NOW });
    expect(r.isLive).toBe(true);
    expect(r.isStale).toBe(false);
    expect(r.tmuxTarget).toEqual(target);
  });

  it("a tmux window in a SUBDIR of the worktree → LIVE", () => {
    const r = svc.classify(root, { paneMap: map([[root + "/src/app", target]]), now: NOW });
    expect(r.isLive).toBe(true);
    expect(r.tmuxTarget).toEqual(target);
  });

  it("no window but lock pid-alive + ttl ok → LIVE (no target)", () => {
    writeLock("2026-06-06T11:30:00Z");
    const r = svc.classify(root, { paneMap: map(), now: NOW, pidAlive: () => true });
    expect(r.isLive).toBe(true);
    expect(r.tmuxTarget).toBeUndefined();
  });

  it("no window, lock dead pid → stale", () => {
    writeLock("2026-06-06T11:30:00Z");
    const r = svc.classify(root, { paneMap: map(), now: NOW, pidAlive: () => false });
    expect(r.isLive).toBe(false);
    expect(r.isStale).toBe(true);
  });

  it("no window, lock expired ttl → stale", () => {
    writeLock("2026-06-06T00:00:00Z", 4); // 12h ago, ttl 4h
    const r = svc.classify(root, { paneMap: map(), now: NOW, pidAlive: () => true });
    expect(r.isStale).toBe(true);
  });

  it("no window, no lock → dormant", () => {
    const r = svc.classify(root, { paneMap: map(), now: NOW });
    expect(r.isLive).toBe(false);
    expect(r.isStale).toBe(false);
  });
});
