import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FocusLabelService } from "./focus-label.service.js";

describe("FocusLabelService", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "focus-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (text: string) => fs.writeFileSync(path.join(dir, ".wt-focus"), text);

  it("returns the first line, trimmed", () => {
    write("  xscape paid-search attribution  \nsecond line\n");
    expect(new FocusLabelService().get(dir)).toBe("xscape paid-search attribution");
  });

  it("truncates to 60 chars", () => {
    write("x".repeat(100));
    expect(new FocusLabelService().get(dir)!.length).toBe(60);
  });

  it("returns undefined when the file is missing or empty", () => {
    expect(new FocusLabelService().get(dir)).toBeUndefined();
    write("\n");
    expect(new FocusLabelService().get(dir)).toBeUndefined();
  });

  it("reflects an updated label after the file's mtime changes", () => {
    const svc = new FocusLabelService();
    write("before");
    expect(svc.get(dir)).toBe("before");
    // bump mtime forward so the cache invalidates
    const future = new Date(Date.now() + 5000);
    write("after");
    fs.utimesSync(path.join(dir, ".wt-focus"), future, future);
    expect(svc.get(dir)).toBe("after");
  });

  it("handles a label containing an apostrophe", () => {
    write("ben's secret-scrub");
    expect(new FocusLabelService().get(dir)).toBe("ben's secret-scrub");
  });
});
