import {
  labelOf,
  readableFields,
  violationsTouching,
  type AnySchema,
  type Principal,
  type ReadableField,
  type Store,
  type Violation,
} from "@graview/core";
import { deriveAffordances, type AffordanceSet } from "@graview/tools";

/**
 * Everything a record page says, derived ONCE.
 *
 * The parity contract: a record page and the spatial detail of the same node
 * must state identical facts, and the only way that stays true is if there
 * is exactly one derivation for the page to render — the same label helper,
 * the same readable fields, the same violation filter, the same affordance
 * set the strip uses. This module composes those sources; it invents nothing.
 */

export interface RecordLinkGroup {
  readonly edgeKind: string;
  readonly direction: "out" | "in";
  /** The edge declaration's own description, when it has one. */
  readonly description?: string;
  readonly targets: readonly { readonly id: string; readonly kind: string; readonly label: string }[];
}

export interface RecordFacts {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly fields: readonly ReadableField[];
  readonly links: readonly RecordLinkGroup[];
  readonly violations: readonly Violation[];
  readonly actions: AffordanceSet;
}

export interface FactsOptions {
  readonly principal?: Principal;
  readonly context?: Readonly<Record<string, unknown>>;
}

export function recordFacts<S extends AnySchema>(
  store: Store<S>,
  id: string,
  options: FactsOptions = {},
): RecordFacts | undefined {
  const node = store.graph.getNode(id);
  if (!node) return undefined;
  const definition = store.schema.tryDefinition(node.kind);
  const name = (candidate: { id: string; kind: string }): string =>
    labelOf(
      store.schema.tryDefinition(candidate.kind),
      candidate as { id: string; kind: string } & Record<string, unknown>,
    );

  /*
   * Every edge, BOTH directions. A traditional face's whole navigational
   * promise is that relationships are links; an edge visible only from the
   * end that declared it would break half the journeys.
   */
  interface MutableGroup {
    edgeKind: string;
    direction: "out" | "in";
    description?: string;
    targets: { id: string; kind: string; label: string }[];
  }
  const groups = new Map<string, MutableGroup>();
  for (const edge of store.graph.allEdges()) {
    const direction = edge.from === id ? "out" : edge.to === id ? "in" : null;
    if (!direction) continue;
    const otherId = direction === "out" ? edge.to : edge.from;
    const other = store.graph.getNode(otherId);
    if (!other) continue;
    const key = `${edge.kind}|${direction}`;
    /*
     * The caption, from the end that declared the edge — its `description`
     * read from the declaring side, its `inverse` read from the other end,
     * because one sentence does not work in both places ("the tasks on this
     * list" is not what a task is to its list). Without an inverse, the
     * declaring side's words are still better than none.
     */
    const declaredOn = direction === "out" ? definition : store.schema.tryDefinition(other.kind);
    const declaration = (
      declaredOn?.edges as Record<string, { description?: string; inverse?: string }> | undefined
    )?.[edge.kind];
    const description =
      direction === "in" ? (declaration?.inverse ?? declaration?.description) : declaration?.description;
    const group =
      groups.get(key) ??
      (() => {
        const made: MutableGroup = {
          edgeKind: edge.kind,
          direction,
          ...(description ? { description } : {}),
          targets: [],
        };
        groups.set(key, made);
        return made;
      })();
    group.targets.push({ id: other.id, kind: other.kind as string, label: name(other) });
  }

  return {
    id,
    kind: node.kind as string,
    label: name(node),
    fields: readableFields(node as Record<string, unknown>, definition),
    violations: violationsTouching(store.violations(options.context), [id]),
    actions: deriveAffordances(store, [id], {
      ...(options.principal ? { principal: options.principal } : {}),
      ...(options.context ? { context: options.context } : {}),
    }),
    links: [...groups.values()].map((group) => ({
      ...group,
      targets: [...group.targets].sort((a, b) => a.label.localeCompare(b.label)),
    })),
  };
}
