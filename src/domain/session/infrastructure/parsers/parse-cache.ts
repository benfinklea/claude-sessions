import fs from "node:fs";
import path from "node:path";
import os from "node:os";

interface CachedMeta {
  preview: string;
  gitBranch: string;
  cwd: string;
  messageCount: number;
  isSidechain: boolean;
}

interface CacheEntry {
  mtimeMs: number;
  meta: CachedMeta;
}

/**
 * Disk-backed, mtime-keyed cache of parsed session metadata. Parsing the first
 * message of every .jsonl is the cold-start cost; once a file is parsed its
 * metadata never changes unless the file does, so we key on mtime. Repeat
 * launches (and --all) reuse the cache and skip the parse entirely.
 *
 * Stale entries (files no longer present) are dropped on save, so it self-prunes.
 */
export class ParseCache {
  private readonly file: string;
  private readonly entries = new Map<string, CacheEntry>();
  private readonly touched = new Set<string>();
  private dirty = false;
  private loaded = false;

  constructor(cacheFile?: string) {
    this.file =
      cacheFile ??
      process.env.CLAUDE_SESSIONS_CACHE_FILE ??
      path.join(os.homedir(), ".cache", "claude-sessions", "parse-cache.json");
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      for (const [k, v] of Object.entries(raw as Record<string, CacheEntry>)) {
        this.entries.set(k, v);
      }
    } catch {
      // no cache yet / unreadable — start empty
    }
  }

  /** Cached metadata if present and the file's mtime is unchanged. */
  get(filePath: string, mtimeMs: number): CachedMeta | null {
    this.load();
    this.touched.add(filePath);
    const e = this.entries.get(filePath);
    return e && e.mtimeMs === mtimeMs ? e.meta : null;
  }

  set(filePath: string, mtimeMs: number, meta: CachedMeta): void {
    this.load();
    this.touched.add(filePath);
    this.entries.set(filePath, { mtimeMs, meta });
    this.dirty = true;
  }

  /**
   * Persist. Pass prune=true only after a FULL scan (no --limit) to drop entries
   * for files we didn't see; a partial/limited scan must not prune unscanned
   * files. No-op if nothing changed.
   */
  save(prune = false): void {
    if (!this.loaded) return;
    if (prune) {
      for (const key of this.entries.keys()) {
        if (!this.touched.has(key)) {
          this.entries.delete(key);
          this.dirty = true;
        }
      }
    }
    if (!this.dirty) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const obj: Record<string, CacheEntry> = {};
      for (const [k, v] of this.entries) obj[k] = v;
      fs.writeFileSync(this.file, JSON.stringify(obj));
      this.dirty = false;
    } catch {
      // best-effort cache; never fail the run over it
    }
  }
}
