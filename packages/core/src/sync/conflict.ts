import { defineInvariant } from "../invariants/engine.js";
import type { InvariantDefinition, Violation } from "../invariants/types.js";
import type { AnySchema } from "../schema/schema.js";
import type { SyncConflict } from "./engine.js";

/** Where an app threads the run's conflicts into invariant evaluation. */
export const SYNC_CONFLICTS = "syncConflicts";

export interface SyncConflictOptions {
  readonly system: string;
  /**
   * The app's own inbound mutation — the same one the engine writes through.
   *
   * "Take theirs" is not a special operation. It is the ordinary inbound
   * change, applied deliberately instead of automatically, so it lands in the
   * log with the same author and comes back out the same way.
   */
  readonly mutation: string;
  /** Builds that mutation's arguments for one conflict. */
  argsFor(conflict: SyncConflict): Record<string, unknown>;
}

/**
 * A conflict, as a VIOLATION with a repair.
 *
 * A field both sides changed since they last agreed is not something a sync
 * layer should decide. Picking a winner is a domain decision made quietly in a
 * place nobody looks — and the framework already has the right shape for
 * "something is wrong and here is what would fix it", so a conflict uses it
 * rather than inventing a parallel notification nobody reads.
 *
 * Yours stands until somebody chooses. That is the safe default and the honest
 * one: the value on screen is the value you put there.
 *
 * The conflicts arrive through the invariant CONTEXT rather than the graph,
 * because they are not facts about the graph — they are facts about the last
 * conversation with the remote, and writing them into the graph would mean
 * inventing a node kind every app has to know about.
 */
export function syncConflictInvariant<S extends AnySchema>(
  options: SyncConflictOptions,
): InvariantDefinition<S> {
  return defineInvariant<S>(`sync-conflict:${options.system}`, {
    scope: "graph",
    label: `${options.system} disagrees`,
    description: `A field ${options.system} and this changed since they last agreed.`,
    repairs: [options.mutation],
    evaluate({ graph, context }) {
      const conflicts = (context[SYNC_CONFLICTS] ?? []) as readonly SyncConflict[];
      const violations: Violation[] = [];
      for (const conflict of conflicts) {
        const node = graph.getNode(conflict.localId) as
          | ({ id: string } & Record<string, unknown>)
          | undefined;
        if (!node) continue;
        const name = typeof node["label"] === "string" ? node["label"] : node.id;
        violations.push({
          invariant: `sync-conflict:${options.system}`,
          subjectId: conflict.localId,
          label: `${options.system} disagrees`,
          // Says what each side thinks, because "there is a conflict" is not
          // something anyone can act on.
          message: `${options.system} has "${name}" ${conflict.field} as ${String(
            conflict.theirs,
          )}; here it is ${String(conflict.ours)}. Yours stands until you choose.`,
          nodeIds: [conflict.localId],
          repairs: [
            {
              mutation: options.mutation,
              args: options.argsFor(conflict),
              label: `Take ${options.system}'s ${conflict.field} — ${String(conflict.theirs)}`,
            },
          ],
        });
      }
      return violations;
    },
  });
}
