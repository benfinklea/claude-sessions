import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ParseCache } from "./parse-cache.js";

const META = { preview: "hi", gitBranch: "main", cwd: "/x", messageCount: 3, isSidechain: false };

describe("ParseCache", () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pcache-"));
    file = path.join(dir, "cache.json");
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("misses when empty, hits after set with matching mtime", () => {
    const c = new ParseCache(file);
    expect(c.get("/a.jsonl", 100)).toBeNull();
    c.set("/a.jsonl", 100, META);
    expect(c.get("/a.jsonl", 100)).toEqual(META);
  });

  it("misses when the mtime changed (file was modified)", () => {
    const c = new ParseCache(file);
    c.set("/a.jsonl", 100, META);
    expect(c.get("/a.jsonl", 200)).toBeNull();
  });

  it("persists across instances", () => {
    const c1 = new ParseCache(file);
    c1.get("/a.jsonl", 100); // mark touched
    c1.set("/a.jsonl", 100, META);
    c1.save();
    const c2 = new ParseCache(file);
    expect(c2.get("/a.jsonl", 100)).toEqual(META);
  });

  it("prunes entries for files not seen this run (only when prune=true)", () => {
    const c1 = new ParseCache(file);
    c1.set("/a.jsonl", 100, META);
    c1.set("/b.jsonl", 100, META);
    c1.save();

    // new run touches only /a, saves WITHOUT prune → /b survives
    const c2 = new ParseCache(file);
    c2.get("/a.jsonl", 100);
    c2.save(false);
    expect(new ParseCache(file).get("/b.jsonl", 100)).toEqual(META);

    // new run touches only /a, saves WITH prune → /b dropped
    const c3 = new ParseCache(file);
    c3.get("/a.jsonl", 100);
    c3.save(true);
    expect(new ParseCache(file).get("/b.jsonl", 100)).toBeNull();
  });

  it("never throws when the cache file path is unwritable", () => {
    const c = new ParseCache("/proc/nonexistent/cache.json");
    c.set("/a.jsonl", 1, META);
    expect(() => c.save(true)).not.toThrow();
  });
});
