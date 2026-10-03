import { mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Operation, PersistenceAdapter } from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";
import type { StoredMeta } from "./meta.js";

/**
 * Persistence a self-hoster can READ: a directory per scope holding
 * `snapshot.json` (the current graph), `log.jsonl` (one operation per line,
 * append-only — history as plain lines a person can grep), and `meta.json`
 * (the stored schema version the migration engine compares against).
 *
 * Deliberately boring. The core's sqlite adapter exists for scale; this one
 * exists so "where is my data" has an answer anyone can open.
 */
export interface FileAdapter extends PersistenceAdapter<string> {
  loadMeta(scope: string): StoredMeta | null;
  saveMeta(scope: string, meta: StoredMeta): void;
  /**
   * The directory it writes into.
   *
   * Said out loud because "where is my data" is the question this adapter
   * exists to answer, and a health report that could only repeat the scope
   * name was answering a different one.
   */
  readonly root: string;
}

export function createFileAdapter(root: string): FileAdapter {
  const place = (scope: string, file: string) => join(root, scope, file);
  const read = <T>(path: string): T | null => {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  };
  const write = (path: string, value: unknown) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  };

  return {
    name: "file",
    root,
    async load(scope) {
      return read<GraphSnapshot>(place(scope, "snapshot.json"));
    },
    async save(scope, snapshot) {
      write(place(scope, "snapshot.json"), snapshot);
    },
    async delete(scope) {
      rmSync(join(root, scope), { recursive: true, force: true });
    },
    async loadLog(scope) {
      const path = place(scope, "log.jsonl");
      if (!existsSync(path)) return [];
      return readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Operation);
    },
    async appendOps(scope, ops) {
      if (ops.length === 0) return;
      const path = place(scope, "log.jsonl");
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, ops.map((op) => JSON.stringify(op)).join("\n") + "\n");
    },
    loadMeta(scope) {
      return read<StoredMeta>(place(scope, "meta.json"));
    },
    saveMeta(scope, meta) {
      write(place(scope, "meta.json"), meta);
    },
  };
}
