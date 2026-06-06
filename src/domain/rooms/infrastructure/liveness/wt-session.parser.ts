import fs from "node:fs";
import path from "node:path";
import type { WtSessionLock } from "../../domain/liveness.model.js";

/**
 * Parse `<worktreeRoot>/.wt-session` (key=value lines: pid, started, host,
 * ttl_hours). Returns null if absent or pid is missing/invalid. Reads the file
 * by literal path — safe for paths with spaces/apostrophes.
 */
export function parseWtSession(worktreeRoot: string): WtSessionLock | null {
  const file = path.join(worktreeRoot, ".wt-session");
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }

  const kv: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    kv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }

  const pid = Number(kv.pid);
  if (!Number.isInteger(pid) || pid <= 0) return null;

  const startedRaw = kv.started ?? "";
  const startedDate = startedRaw ? new Date(startedRaw) : new Date(0);
  const started = Number.isNaN(startedDate.getTime()) ? new Date(0) : startedDate;

  const ttl = Number(kv.ttl_hours);
  const ttlHours = Number.isFinite(ttl) && ttl > 0 ? ttl : 4;

  return { pid, started, host: kv.host ?? "", ttlHours };
}
