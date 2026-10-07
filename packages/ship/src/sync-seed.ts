import {
  invert,
  normalize,
  writesOf,
  type AnySchema,
  type Operation,
  type Principal,
  type Store,
} from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";
import { primitivesForSteps, sayStep, type MigrationStep } from "./steps.js";

/**
 * THE SEED IS A BOOTSTRAP SNAPSHOT, and the live store is the truth.
 *
 * Every product that shipped a default graph met the same afternoon: the
 * example changed — a list renamed, a question added to the interview — and
 * the only way to see the change in a store that already existed was to
 * delete the store. So `?fresh=1` became the redesign tool, and an agent
 * asked to evolve the app learned to rewrite `example.json` and wipe,
 * because the seed was the only thing it could reach.
 *
 * This is the other way. The seed and the live snapshot are diffed into
 * content steps — put what is missing, patch what the seed says differently,
 * tie what is untied — and the steps land as ONE logged, attributed,
 * undoable operation, the way a schema migration does. What a person made
 * that the seed never had is left exactly alone unless `prune` is asked for
 * by name.
 */

export interface SeedSyncOptions {
  /**
   * Also drop what the live graph has and the seed does not. Off by
   * default, because the live graph is where people have been working, and
   * a sync that quietly removed their records would be the wipe this exists
   * to replace.
   */
  readonly prune?: boolean;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * The steps that make `live` contain `seed`.
 *
 * Only the fields the seed SETS are compared: a record the live graph has
 * given a field the seed never mentions keeps it. A record whose kind has
 * changed is dropped and put again, because a kind is a record's identity
 * to the schema and no patch can move it.
 */
export function seedSteps(seed: GraphSnapshot, live: GraphSnapshot, options: SeedSyncOptions = {}): MigrationStep[] {
  const steps: MigrationStep[] = [];
  const liveNodes = new Map(live.nodes.map((node) => [node.id, node]));
  const seedNodes = new Map(seed.nodes.map((node) => [node.id, node]));

  for (const wanted of seed.nodes) {
    const have = liveNodes.get(wanted.id);
    if (!have) {
      steps.push({ what: "put-node", node: wanted });
      continue;
    }
    if (have.kind !== wanted.kind) {
      steps.push({ what: "drop-node", id: wanted.id }, { what: "put-node", node: wanted });
      continue;
    }
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(wanted)) {
      if (key === "id" || key === "kind" || same(have[key], value)) continue;
      fields[key] = value;
    }
    if (Object.keys(fields).length > 0) steps.push({ what: "patch-node", id: wanted.id, fields });
  }

  for (const edge of seed.edges) {
    if (live.edges.some((have) => have.kind === edge.kind && have.from === edge.from && have.to === edge.to)) continue;
    steps.push({ what: "put-edge", edge });
  }

  if (options.prune) {
    for (const edge of live.edges) {
      if (seed.edges.some((want) => want.kind === edge.kind && want.from === edge.from && want.to === edge.to)) continue;
      // An edge whose end is going goes with it; saying so twice is harmless and deduped.
      steps.push({ what: "drop-edge", edge });
    }
    for (const node of live.nodes) if (!seedNodes.has(node.id)) steps.push({ what: "drop-node", id: node.id });
  }

  return steps;
}

export const SEED_SYNC_AUTHOR: Principal = { kind: "system", id: "ship:sync-seed" };

/**
 * Content steps as ONE OPERATION against a live graph: authored, stating
 * what it did, carrying its inverse — the same shape a migration run
 * appends, so the activity shows it, `undo` takes it back, and a host's
 * adapter persists it like any other change. Null when the steps come to
 * nothing against this graph, which is the honest answer to a second run.
 */
export function contentOperation(
  steps: readonly MigrationStep[],
  live: GraphSnapshot,
  options: {
    readonly author?: Principal;
    readonly intent?: string;
    readonly id?: string;
    readonly batch?: string;
    readonly now?: () => string;
  } = {},
): Operation | null {
  const primitives = primitivesForSteps(steps, live).map(normalize);
  if (primitives.length === 0) return null;
  const now = options.now ?? (() => new Date().toISOString());
  const at = now();
  const author = options.author ?? SEED_SYNC_AUTHOR;
  return {
    id: options.id ?? `sync:${at}`,
    seq: -1,
    batch: options.batch ?? `sync:${at}`,
    author,
    intent: options.intent ?? `seed sync: ${steps.map(sayStep).join("; ")}`,
    mutation: null,
    primitives,
    inverse: [...primitives].reverse().map(invert),
    reads: [],
    writes: [...new Set(primitives.flatMap(writesOf))],
    at,
  };
}

/**
 * Lands content steps on an open store. Through `receive`, so the op keeps
 * its author and intent, the subscribers — persistence among them — hear
 * it exactly as they hear a person's change, and `store.undo(op.batch)` is
 * the way back. Returns what landed, or null when there was nothing to do.
 */
export function applySteps<S extends AnySchema>(
  store: Store<S>,
  steps: readonly MigrationStep[],
  options: Parameters<typeof contentOperation>[2] = {},
): Operation | null {
  const op = contentOperation(steps, store.graph.snapshot() as GraphSnapshot, options);
  if (!op) return null;
  const [landed] = store.receive([op]);
  return landed ?? null;
}
