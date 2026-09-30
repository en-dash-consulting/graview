import {
  labelOf,
  readableFields,
  tellApart,
  violationsTouching,
  type AnySchema,
  type Principal,
  type ReadableField,
  type Repair,
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
  /**
   * `apart` is what tells a target from another of the same name in this
   * group — a vehicle's two "Check engine light on" appointments, by when.
   */
  readonly targets: readonly { readonly id: string; readonly kind: string; readonly label: string; readonly apart?: string }[];
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
    /*
     * The record IS the focus: a page about one task leads with that task's
     * own repair, not with the first repair a rule implicating six of them
     * happened to list. Same rank the strip and the pointer menu read.
     */
    actions: deriveAffordances(store, [id], {
      focus: id,
      ...(options.principal ? { principal: options.principal } : {}),
      ...(options.context ? { context: options.context } : {}),
    }),
    links: [...groups.values()].map((group) => {
      const apart = tellApart(
        group.targets.flatMap((target) => {
          const other = store.graph.getNode(target.id);
          return other ? [other as { id: string; kind: string } & Record<string, unknown>] : [];
        }),
        (kind) => store.schema.tryDefinition(kind),
      );
      return {
        ...group,
        targets: [...group.targets]
          .map((target) => (apart.has(target.id) ? { ...target, apart: apart.get(target.id)! } : target))
          .sort((a, b) => a.label.localeCompare(b.label)),
      };
    }),
  };
}

export interface KindFacts {
  readonly kind: string;
  readonly members: readonly { readonly id: string; readonly kind: string }[];
  /**
   * The acts that can BEGIN this kind, as the derivation offers them — and
   * the ones this seat may not take, with the policy's own sentence.
   */
  readonly actions: AffordanceSet;
}

/**
 * Everything a LIST page says about a kind, derived once — the sibling of
 * `recordFacts` for the surface that is about a kind rather than a node.
 *
 * The list page had no derivation to ask, so it filtered `store.allMutations()`
 * by `creates` and checked `store.permits` — which is the exact thing
 * `graview-pages` tells an app's own page not to do, done by the framework's
 * own page. The two answers differ: the derivation also drops an act it
 * cannot ASK for. A creating act that needs a node reference with no
 * candidates — "add an item for someone", with nobody yet — is withheld in
 * the scene and was offered on the list page as a live form whose picker was
 * empty and whose submit could only refuse.
 *
 * Same call the scene makes for a selected district: an empty selection,
 * with the kind named.
 */
export function kindFacts<S extends AnySchema>(
  store: Store<S>,
  kind: string,
  options: FactsOptions = {},
): KindFacts {
  return {
    kind,
    members: store.graph.nodesOfKind(kind) as readonly { id: string; kind: string }[],
    actions: deriveAffordances(store, [], {
      kindSelection: [kind],
      ...(options.principal ? { principal: options.principal } : {}),
      ...(options.context ? { context: options.context } : {}),
    }),
  };
}

/**
 * A RULE'S REPAIRS IN THE ONE ORDER THE DERIVATION RANKED THEM.
 *
 * A rule that implicates five late tasks names ten repairs in a single
 * violation, in whatever order it walked its subjects — so a record page
 * rendering `violation.repairs` straight led the page about the fifth task
 * with the first task's repair. The derivation already knows better: asked
 * with this record as its focus, it puts the record's own repairs at the
 * front. This reads that answer back rather than sorting again, so the page,
 * the strip and the pointer menu cannot arrive at different firsts.
 *
 * Repairs the derivation did not produce — withheld for reasons other than
 * permission, or named by a violation this set was not derived from — keep
 * their declared order at the end rather than being dropped.
 */
export function rankedRepairs(actions: AffordanceSet, repairs: readonly Repair[]): readonly Repair[] {
  const key = (mutation: string, args: Readonly<Record<string, unknown>>): string =>
    `${mutation}|${JSON.stringify(args)}`;
  const ranks = new Map<string, number>();
  for (const affordance of [...actions.affordances, ...actions.withheld]) {
    if (affordance.provider !== "invariant") continue;
    const at = key(affordance.mutation, affordance.args);
    if (!ranks.has(at)) ranks.set(at, affordance.rank ?? Number.MAX_SAFE_INTEGER);
  }
  const unranked = Number.MAX_SAFE_INTEGER;
  return [...repairs]
    .map((repair, declared) => ({ repair, declared }))
    .sort(
      (a, b) =>
        (ranks.get(key(a.repair.mutation, a.repair.args ?? {})) ?? unranked) -
          (ranks.get(key(b.repair.mutation, b.repair.args ?? {})) ?? unranked) ||
        a.declared - b.declared,
    )
    .map((entry) => entry.repair);
}

/* ------------------------------------------------------- the map of kinds */

/** One declared relation between two kinds, with how many of it there are. */
export interface KindRelation {
  readonly edgeKind: string;
  readonly from: string;
  /** The kind at the far end — or "*" when the declaration allows any. */
  readonly to: string;
  /** How the edge reads from the kind that declares it. */
  readonly description?: string;
  /** How it reads from the other end. */
  readonly inverse?: string;
  readonly count: number;
}

export interface KindMap {
  readonly kinds: readonly { readonly kind: string; readonly plural: string; readonly count: number }[];
  readonly relations: readonly KindRelation[];
}

/**
 * HOW THE KINDS FIT TOGETHER, derived once: every kind with how many of it
 * there are, and every declared edge between kinds with its own words and
 * the live count — the routed face's roads and relation key. A declaration
 * that allows any kind at the far end ("*") is listed once per kind the
 * graph actually joins it to, and once as "*" when it joins none yet.
 */
export function kindMap<S extends AnySchema>(store: Store<S>): KindMap {
  const kinds = (store.schema.kinds as readonly string[]).map((kind) => ({
    kind,
    plural: store.schema.tryDefinition(kind)?.plural ?? kind,
    count: store.graph.nodesOfKind(kind).length,
  }));
  const counts = new Map<string, number>();
  for (const edge of store.graph.allEdges()) {
    const from = store.graph.getNode(edge.from);
    const to = store.graph.getNode(edge.to);
    if (!from || !to) continue;
    const key = `${edge.kind}|${from.kind}|${to.kind}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const relations: KindRelation[] = [];
  for (const { kind } of kinds) {
    const declared = (store.schema.tryDefinition(kind)?.edges ?? {}) as Record<
      string,
      { to?: readonly string[] | "*"; description?: string; inverse?: string }
    >;
    for (const [edgeKind, declaration] of Object.entries(declared)) {
      const targets =
        declaration.to === "*" || declaration.to === undefined
          ? (() => {
              const seen = [...counts.keys()]
                .filter((key) => key.startsWith(`${edgeKind}|${kind}|`))
                .map((key) => key.split("|")[2]!);
              return seen.length > 0 ? seen : ["*"];
            })()
          : declaration.to;
      for (const to of targets) {
        relations.push({
          edgeKind,
          from: kind,
          to,
          ...(declaration.description ? { description: declaration.description } : {}),
          ...(declaration.inverse ? { inverse: declaration.inverse } : {}),
          count: counts.get(`${edgeKind}|${kind}|${to}`) ?? 0,
        });
      }
    }
  }
  return { kinds, relations };
}
