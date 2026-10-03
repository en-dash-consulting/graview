import type { GraphSnapshot } from "../graph/types.js";
import type { Epoch } from "../ops/log.js";
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
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
