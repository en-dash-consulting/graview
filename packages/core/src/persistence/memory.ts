import type { GraphSnapshot } from "../graph/types.js";
import type { Epoch, LogArchive } from "../ops/log.js";
import type { Operation } from "../ops/types.js";
import type { PersistenceAdapter } from "./types.js";

/** In-memory adapter. Deep-copies on the way in and out, so a stored graph
 * cannot be mutated behind the store's back. */
export function createMemoryAdapter(
  seed: Record<string, GraphSnapshot> = {},
): PersistenceAdapter<string> {
  const graphs = new Map<string, GraphSnapshot>(
    Object.entries(seed).map(([k, v]) => [k, clone(v)]),
  );
  const logs = new Map<string, Operation[]>();
  const epochs = new Map<string, Epoch[]>();
  // What a compaction moved behind the undo horizon (FR-23): kept, never loaded on open.
  const archives = new Map<string, LogArchive>();

  return {
    name: "memory",
    async load(scope) {
      const found = graphs.get(scope);
      return found ? clone(found) : null;
    },
    async save(scope, snapshot) {
      graphs.set(scope, clone(snapshot));
    },
    async delete(scope) {
      graphs.delete(scope);
      logs.delete(scope);
      epochs.delete(scope);
      archives.delete(scope);
    },
    async loadLog(scope) {
      return clone(logs.get(scope) ?? []);
    },
    async appendOps(scope, ops) {
      const existing = logs.get(scope) ?? [];
      logs.set(scope, [...existing, ...clone([...ops])]);
    },
    async loadEpochs(scope) {
      return clone(epochs.get(scope) ?? []);
    },
    async saveEpochs(scope, list) {
      epochs.set(scope, clone([...list]));
    },
    async compact(scope, checkpoint) {
      const log = logs.get(scope) ?? [];
      const marks = epochs.get(scope) ?? [];
      const held = archives.get(scope) ?? { ops: [], epochs: [] };
      archives.set(scope, {
        ops: [...held.ops, ...clone(log.filter((op) => op.seq < checkpoint.seq))],
        epochs: [...held.epochs, ...clone(marks.filter((epoch) => epoch.seq < checkpoint.seq))],
      });
      logs.set(scope, log.filter((op) => op.seq >= checkpoint.seq));
      epochs.set(scope, [clone({ ...checkpoint, horizon: true as const }), ...marks.filter((epoch) => epoch.seq > checkpoint.seq)]);
    },
    async loadArchive(scope) {
      return clone(archives.get(scope) ?? { ops: [], epochs: [] });
    },
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
