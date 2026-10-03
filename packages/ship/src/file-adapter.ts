import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Epoch, LogArchive, Operation, PersistenceAdapter } from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";
import type { StoredMeta } from "./meta.js";

/**
 * Persistence a self-hoster can READ: a directory per scope holding
 * `snapshot.json` (the current graph), `log.jsonl` (one operation per line,
 * append-only — history as plain lines a person can grep), `meta.json`
 * (the stored schema version the migration engine compares against),
 * `epochs.json` (the base graphs the log folds from, FR-27), and, once the
 * log has been compacted behind an undo horizon (FR-23), `archive/` with
 * the ops and epochs from before it, as `log.jsonl` and `epochs.json` again.
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
  /** Written whole and moved into place, so a crash leaves the old file or the new one. */
  const replace = (path: string, text: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, text);
    renameSync(`${path}.tmp`, path);
  };
  const lines = (path: string): Operation[] =>
    existsSync(path)
      ? readFileSync(path, "utf8")
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .map((line) => JSON.parse(line) as Operation)
      : [];
  const jsonl = (ops: readonly Operation[]) => ops.map((op) => `${JSON.stringify(op)}\n`).join("");
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  /** The seq the log begins at: its checkpoint's, once compacted (FR-23). */
  const horizonOf = (scope: string): number =>
    [...(read<Epoch[]>(place(scope, "epochs.json")) ?? [])].reverse().find((epoch) => epoch.horizon)?.seq ?? 0;
  const archiveOf = (scope: string): LogArchive => ({
    ops: lines(place(scope, join("archive", "log.jsonl"))),
    epochs: read<Epoch[]>(place(scope, join("archive", "epochs.json"))) ?? [],
  });

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
      /*
       * From the horizon on. A compaction writes the archive, then the
       * checkpoint, then the tail: a crash before the tail is rewritten
       * leaves ops behind the checkpoint here, already archived, and they
       * are not loaded twice.
       */
      const horizon = horizonOf(scope);
      const ops = lines(place(scope, "log.jsonl"));
      return horizon > 0 ? ops.filter((op) => op.seq >= horizon) : ops;
    },
    async appendOps(scope, ops) {
      if (ops.length === 0) return;
      const path = place(scope, "log.jsonl");
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, ops.map((op) => JSON.stringify(op)).join("\n") + "\n");
    },
    async loadEpochs(scope) {
      return read<Epoch[]>(place(scope, "epochs.json")) ?? [];
    },
    async saveEpochs(scope, epochs) {
      write(place(scope, "epochs.json"), epochs);
    },
    async compact(scope, checkpoint) {
      const at = checkpoint.seq;
      const ops = lines(place(scope, "log.jsonl"));
      const epochs = read<Epoch[]>(place(scope, "epochs.json")) ?? [];
      const held = archiveOf(scope);
      // Keyed, so a compaction run again after a crash archives nothing twice.
      const archivedOps = new Map(held.ops.map((op) => [op.seq, op]));
      for (const op of ops) if (op.seq < at) archivedOps.set(op.seq, op);
      const archivedEpochs = new Map(held.epochs.map((epoch) => [JSON.stringify(epoch), epoch]));
      for (const epoch of epochs) if (epoch.seq < at) archivedEpochs.set(JSON.stringify(epoch), epoch);
      replace(place(scope, join("archive", "log.jsonl")), jsonl([...archivedOps.values()].sort((a, b) => a.seq - b.seq)));
      replace(place(scope, join("archive", "epochs.json")), json([...archivedEpochs.values()]));
      replace(place(scope, "epochs.json"), json([{ ...checkpoint, horizon: true }, ...epochs.filter((epoch) => epoch.seq > at)]));
      replace(place(scope, "log.jsonl"), jsonl(ops.filter((op) => op.seq >= at)));
    },
    async loadArchive(scope) {
      return archiveOf(scope);
    },
    loadMeta(scope) {
      return read<StoredMeta>(place(scope, "meta.json"));
    },
    saveMeta(scope, meta) {
      write(place(scope, "meta.json"), meta);
    },
  };
}
