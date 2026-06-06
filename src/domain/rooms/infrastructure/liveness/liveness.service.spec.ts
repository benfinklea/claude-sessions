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
  const target: TmuxTarget = { session: "sessions", window: 3 };

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
    const r = svc.classify(undefined, { paneMap: map(), now: NOW });
    expect(r).toEqual({ isLive: false, isStale: false });
  });

  it("no lock → dormant (not stale) even if a window sits there", () => {
    const r = svc.classify(root, {
      paneMap: map([[root, target]]),
      now: NOW,
      pidAlive: () => true,
    });
    expect(r.isLive).toBe(false);
    expect(r.isStale).toBe(false);
    expect(r.tmuxTarget).toEqual(target);
  });

  it("lock + pid alive + ttl ok + window present → LIVE", () => {
    writeLock("2026-06-06T11:30:00Z");
    const r = svc.classify(root, {
      paneMap: map([[root, target]]),
      now: NOW,
      pidAlive: () => true,
    });
    expect(r.isLive).toBe(true);
    expect(r.isStale).toBe(false);
    expect(r.tmuxTarget).toEqual(target);
  });

  it("stale: dead pid", () => {
    writeLock("2026-06-06T11:30:00Z");
    const r = svc.classify(root, {
      paneMap: map([[root, target]]),
      now: NOW,
      pidAlive: () => false,
    });
    expect(r.isLive).toBe(false);
    expect(r.isStale).toBe(true);
  });

  it("stale: expired ttl", () => {
    writeLock("2026-06-06T00:00:00Z", 4); // 12h ago, ttl 4h
    const r = svc.classify(root, {
      paneMap: map([[root, target]]),
      now: NOW,
      pidAlive: () => true,
    });
    expect(r.isStale).toBe(true);
  });

  it("stale: no tmux window for the worktree", () => {
    writeLock("2026-06-06T11:30:00Z");
    const r = svc.classify(root, { paneMap: map(), now: NOW, pidAlive: () => true });
    expect(r.isLive).toBe(false);
    expect(r.isStale).toBe(true);
    expect(r.tmuxTarget).toBeUndefined();
  });
});
