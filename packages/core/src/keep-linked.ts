import { ARCHIVED, isArchived } from "./graph/archived.js";
import type { Primitive } from "./graph/primitives.js";
import type { AnyGraphNode, GraphReader } from "./graph/types.js";
import type { AnySchema } from "./schema/schema.js";

/*
 * KEEP-LINKED RECORDS (Roadmap f-keep-linked).
 *
 * A kind may say it DERIVES from another: an event follows the plan item it
 * is linked to, its title the item's name. The store keeps the two in step
 * in the same change as the edit that moved one of them — never on a
 * schedule — so one undo takes the edit and what followed it back together,
 * and a connection's next pass sends what the derived record now says.
 *
 * - FORWARD: a source record made, changed, or newly linked hands its
 *   derived records the values `values` works out from it.
 * - BACK: a field of the derived record set from one of the source's own
 *   fields (`back`) changed on the derived side — a person on the event's
 *   page, a calendar's edit landing — goes to the source, when whoever
 *   changed it may change the source too, and from there to the source's
 *   other derived records. A field worked out any other way cannot go back;
 *   it stays as it was changed, and `validateGraph` says it is out of step
 *   (`derived-out-of-step`) with the repair that sets it again.
 * - ARCHIVED: a source archived, or brought back, takes its derived
 *   records with it; a source removed archives them (they are kept, and say
 *   what they were).
 */

/** How a kind follows another: on its definition (`derives`), compiled from a document's `kinds.<kind>.derives` or written in TypeScript. */
export interface DerivesDeclaration {
  /** The kind it follows. */
  readonly from: string;
  /** The relation joining a record of it to the record it follows. */
  readonly via: string;
  /** Which end of `via` the source stands on: `"from"` when the relation is declared on the source, `"to"` when on this kind. */
  readonly sourceEnd: "from" | "to";
  /** This kind's field → the source's own field it is set from as it is: a change to it here goes back. */
  readonly back: Readonly<Record<string, string>>;
  /** The fields this record takes from `source`, worked out over `graph`. */
  values(graph: GraphReader, source: AnyGraphNode, derived: AnyGraphNode): Readonly<Record<string, unknown>>;
}

/** The kinds that follow another, by the kind they follow; and each follower's declaration by its own kind. */
interface Followers {
  readonly bySource: ReadonlyMap<string, readonly (readonly [string, DerivesDeclaration])[]>;
  readonly byKind: ReadonlyMap<string, DerivesDeclaration>;
}
const FOLLOWERS = new WeakMap<AnySchema, Followers>();

function followersOf(schema: AnySchema): Followers {
  let found = FOLLOWERS.get(schema);
  if (found) return found;
  const bySource = new Map<string, [string, DerivesDeclaration][]>();
  const byKind = new Map<string, DerivesDeclaration>();
  for (const definition of schema.definitions) {
    const derives = (definition as { derives?: DerivesDeclaration }).derives;
    if (!derives) continue;
    byKind.set(definition.kind, derives);
    bySource.set(derives.from, [...(bySource.get(derives.from) ?? []), [definition.kind, derives]]);
  }
  FOLLOWERS.set(schema, (found = { bySource, byKind }));
  return found;
}

/** Whether any kind of the app follows another: a store with none does no more work than before. */
export const keepsLinked = (schema: AnySchema): boolean => followersOf(schema).byKind.size > 0;

/** The records a derived record follows, through its declaration's relation. */
export function sourcesOf(graph: GraphReader, derives: DerivesDeclaration, derived: string): AnyGraphNode[] {
  const options = { archived: "all" as const };
  return (derives.sourceEnd === "to" ? graph.out(derived, derives.via, options) : graph.in(derived, derives.via, options)).filter((node) => node.kind === derives.from);
}

/** The records of a kind that follow a source record. */
function derivedOf(graph: GraphReader, kind: string, derives: DerivesDeclaration, source: string): AnyGraphNode[] {
  const options = { archived: "all" as const };
  return (derives.sourceEnd === "to" ? graph.in(source, derives.via, options) : graph.out(source, derives.via, options)).filter((node) => node.kind === kind);
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A patch that moves a record to `fields`, saying only what changes; undefined when nothing does. */
function patchTo(node: AnyGraphNode, fields: Readonly<Record<string, unknown>>): Primitive | undefined {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(fields)) {
    const current = (node as Record<string, unknown>)[field];
    if (same(current, value)) continue;
    before[field] = current;
    after[field] = value;
  }
  return Object.keys(after).length > 0 ? { op: "patch-node", id: node.id, before, after } : undefined;
}

/** A graph the follow-up changes are applied to as they are worked out, so each reads the one before. */
export interface KeptGraph extends GraphReader {
  applyPrimitives(primitives: readonly Primitive[]): unknown;
}

export interface KeepLinkedOptions {
  /** Whether the change's author may set the source's field (its own edit); unsaid, it may. */
  readonly mayWriteBack?: (source: AnyGraphNode, field: string, value: unknown) => boolean;
}

/**
 * THE CHANGES THAT KEEP DERIVED RECORDS IN STEP WITH `made`, a change just
 * applied to `graph`: applied to it here, one at a time, and returned, for
 * the store to keep in the same operation. Nothing when no kind derives.
 */
export function keepLinked(schema: AnySchema, graph: KeptGraph, made: readonly Primitive[], options: KeepLinkedOptions = {}): Primitive[] {
  const { bySource, byKind } = followersOf(schema);
  if (byKind.size === 0) return [];
  const out: Primitive[] = [];
  const apply = (primitive: Primitive | undefined) => {
    if (!primitive) return;
    graph.applyPrimitives([primitive]);
    out.push(primitive);
  };
  const kindOf = (id: string) => graph.getNode(id)?.kind;
  // Each source to hand its values on, with whether its archived mark moved in this change.
  const touched = new Map<string, boolean>();
  const touch = (id: string, archivedMoved = false) => touched.set(id, (touched.get(id) ?? false) || archivedMoved);
  const removed = new Set(made.flatMap((p) => (p.op === "remove-node" ? [p.node.id] : [])));
  // What the change set on a source itself: that wins over the same field changed on a derived record in it.
  const setOnSource = new Map<string, Set<string>>();
  // And what it set on a derived record: kept, unless its source was changed itself.
  const setOnDerived = new Map<string, Set<string>>();
  for (const p of made) {
    if (p.op === "patch-node" && byKind.has(kindOf(p.id) ?? "")) setOnDerived.set(p.id, new Set([...(setOnDerived.get(p.id) ?? []), ...Object.keys(p.after)]));
    if (p.op === "add-node" && bySource.has(p.node.kind)) touch(p.node.id);
    else if (p.op === "patch-node") {
      const kind = kindOf(p.id);
      if (kind && bySource.has(kind)) {
        touch(p.id, ARCHIVED in p.after);
        setOnSource.set(p.id, new Set([...(setOnSource.get(p.id) ?? []), ...Object.keys(p.after)]));
      }
    } else if (p.op === "add-edge") {
      // A link made between a source and a record that follows it: the record takes the source's values now.
      const from = graph.getNode(p.edge.from);
      const to = graph.getNode(p.edge.to);
      for (const [source, derived] of [
        [from, to],
        [to, from],
      ] as const) {
        const derives = derived ? byKind.get(derived.kind) : undefined;
        if (source && derives && derives.via === p.edge.kind && derives.from === source.kind) touch(source.id);
      }
    } else if (p.op === "remove-edge" && (removed.has(p.edge.from) || removed.has(p.edge.to))) {
      // A source removed: the records that followed it are archived, and kept.
      const gone = removed.has(p.edge.from) ? p.edge.from : p.edge.to;
      const other = graph.getNode(gone === p.edge.from ? p.edge.to : p.edge.from);
      const derives = other ? byKind.get(other.kind) : undefined;
      const goneKind = made.find((q): q is Extract<Primitive, { op: "remove-node" }> => q.op === "remove-node" && q.node.id === gone)?.node.kind;
      if (other && derives && derives.via === p.edge.kind && derives.from === goneKind && !isArchived(other)) apply(patchTo(other, { [ARCHIVED]: true }));
    }
  }
  // Back: a field set from the source's own field, changed on the derived side.
  for (const p of made) {
    if (p.op !== "patch-node") continue;
    const derived = graph.getNode(p.id);
    const derives = derived ? byKind.get(derived.kind) : undefined;
    if (!derived || !derives) continue;
    const fields = Object.keys(p.after).filter((field) => Object.hasOwn(derives.back, field));
    if (fields.length === 0) continue;
    const sources = sourcesOf(graph, derives, derived.id);
    if (sources.length !== 1) continue;
    const source = sources[0]!;
    const patch: Record<string, unknown> = {};
    for (const field of fields) {
      const theirs = derives.back[field]!;
      if (setOnSource.get(source.id)?.has(theirs)) continue;
      const value = (derived as Record<string, unknown>)[field];
      // A field the source says never changes once set stays as it is; so does one whoever changed this may not change there.
      if ((schema.tryDefinition(source.kind) as { fixed?: Record<string, string> } | undefined)?.fixed?.[theirs] !== undefined) continue;
      if (options.mayWriteBack && !options.mayWriteBack(source, theirs, value)) continue;
      patch[theirs] = value;
    }
    const back = patchTo(source, patch);
    if (back) {
      apply(back);
      touch(source.id);
    }
  }
  // Forward, through every kind that follows each source — and on, where a derived record is itself followed.
  const done = new Set<string>();
  for (const [id, archivedMoved] of touched) {
    if (done.has(id)) continue;
    done.add(id);
    const source = graph.getNode(id);
    if (!source) continue;
    for (const [kind, derives] of bySource.get(source.kind) ?? []) {
      for (const derived of derivedOf(graph, kind, derives, source.id)) {
        const fields: Record<string, unknown> = { ...derives.values(graph, source, derived) };
        if (!setOnSource.has(source.id)) for (const field of setOnDerived.get(derived.id) ?? []) delete fields[field];
        if (archivedMoved) fields[ARCHIVED] = isArchived(source) ? true : undefined;
        const patch = patchTo(derived, fields);
        if (!patch) continue;
        apply(patch);
        if (bySource.has(kind)) touched.set(derived.id, archivedMoved);
      }
    }
  }
  return out;
}

/** One derived record's field that says other than its source works out: what `validateGraph` flags. */
export interface OutOfStep {
  readonly id: string;
  readonly source: string;
  readonly field: string;
  readonly holds: unknown;
  readonly follows: unknown;
}

/** Every field of a derived record that says other than what its source works out (`derived-out-of-step`). */
export function outOfStep(schema: AnySchema, graph: GraphReader, nodes: Iterable<AnyGraphNode>): OutOfStep[] {
  const { byKind } = followersOf(schema);
  if (byKind.size === 0) return [];
  const out: OutOfStep[] = [];
  for (const node of nodes) {
    const derives = byKind.get(node.kind);
    if (!derives) continue;
    const sources = sourcesOf(graph, derives, node.id);
    if (sources.length !== 1) continue;
    for (const [field, value] of Object.entries(derives.values(graph, sources[0]!, node))) {
      const holds = (node as Record<string, unknown>)[field];
      if (!same(holds, value)) out.push({ id: node.id, source: sources[0]!.id, field, holds, follows: value });
    }
  }
  return out;
}
