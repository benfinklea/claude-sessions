import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseWtSession } from "./wt-session.parser.js";

describe("parseWtSession", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "wtsession-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when the file is absent", () => {
    expect(parseWtSession(dir)).toBeNull();
  });

  it("parses a well-formed lock", () => {
    fs.writeFileSync(
      path.join(dir, ".wt-session"),
      "pid=12345\nstarted=2026-06-06T10:00:00Z\nhost=Bens-Mac\nttl_hours=4\n",
    );
    const lock = parseWtSession(dir);
    expect(lock).not.toBeNull();
    expect(lock!.pid).toBe(12345);
    expect(lock!.host).toBe("Bens-Mac");
    expect(lock!.ttlHours).toBe(4);
    expect(lock!.started.toISOString()).toBe("2026-06-06T10:00:00.000Z");
  });

  it("returns null when pid is missing or invalid", () => {
    fs.writeFileSync(path.join(dir, ".wt-session"), "host=x\nttl_hours=4\n");
    expect(parseWtSession(dir)).toBeNull();
    fs.writeFileSync(path.join(dir, ".wt-session"), "pid=notanumber\n");
    expect(parseWtSession(dir)).toBeNull();
  });

  it("defaults ttl_hours to 4 and started to epoch when missing/bad", () => {
    fs.writeFileSync(path.join(dir, ".wt-session"), "pid=7\n");
    const lock = parseWtSession(dir);
    expect(lock!.ttlHours).toBe(4);
    expect(lock!.started.getTime()).toBe(0);
  });
});
