import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Reads a handoff markdown file — locally, or over SSH when it lives on another
 * machine (e.g. a pippen session's handoff). Returns the text, or an error note.
 */
export class HandoffReader {
  read(handoffPath: string, machine?: string): { title: string; content: string } {
    const title = path
      .basename(handoffPath)
      .replace(/^handoff-/, "")
      .replace(/\.md$/, "");
    if (machine) {
      const res = spawnSync(
        "ssh",
        ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", machine, `cat '${handoffPath}'`],
        {
          encoding: "utf8",
          timeout: 20_000,
          maxBuffer: 16 * 1024 * 1024,
        },
      );
      if (res.status !== 0 || !res.stdout) {
        return {
          title,
          content: `(couldn't read handoff on ${machine}: ${res.stderr?.trim() || "no output"})`,
        };
      }
      return { title, content: res.stdout };
    }
    try {
      return { title, content: fs.readFileSync(handoffPath, "utf8") };
    } catch (err) {
      return { title, content: `(couldn't read handoff: ${(err as Error).message})` };
    }
  }
}
