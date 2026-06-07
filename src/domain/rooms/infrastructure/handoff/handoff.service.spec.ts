import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HandoffService } from "./handoff.service.js";

describe("HandoffService", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "handoffs-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, body: string) => fs.writeFileSync(path.join(dir, name), body);

  it("indexes handoffs by Dir with title and when", () => {
    write(
      "handoff-2026-05-17-090000-foo.md",
      "# Handoff: Foo Work\n\n**When:** 2026-05-17 09:00\n**Branch:** feat/foo\n**Dir:** /Volumes/Development/coppermind-foo\n\n## Done\n- stuff\n",
    );
    const idx = new HandoffService(dir).index();
    const ref = idx.get("/Volumes/Development/coppermind-foo");
    expect(ref).toBeDefined();
    expect(ref!.title).toBe("Foo Work");
    expect(ref!.when).toBe("2026-05-17 09:00");
    expect(ref!.path).toContain("handoff-2026-05-17-090000-foo.md");
  });

  it("newest handoff per dir wins (by sortable filename timestamp)", () => {
    const dirLine = "**Dir:** /repo/x\n";
    write("handoff-2026-05-01-090000-a.md", `# Handoff: Old\n${dirLine}`);
    write("handoff-2026-05-20-090000-b.md", `# Handoff: New\n${dirLine}`);
    const ref = new HandoffService(dir).index().get("/repo/x");
    expect(ref!.title).toBe("New");
  });

  it("ignores files without a Dir line", () => {
    write("handoff-2026-05-01-090000-nodir.md", "# Handoff: No Dir\n\nbody only\n");
    expect(new HandoffService(dir).index().size).toBe(0);
  });

  it("returns an empty index when the dir is missing", () => {
    expect(new HandoffService(path.join(dir, "nope")).index().size).toBe(0);
  });
});
