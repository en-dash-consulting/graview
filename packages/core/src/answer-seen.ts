import type { GraphDiff, NodeChange } from "./graph/diff.js";
import type { Primitive } from "./graph/primitives.js";
import type { AnyGraphNode, GraphEdge, GraphNodeBase } from "./graph/types.js";
import type { InvariantDefinition, Violation } from "./invariants/types.js";
import type { Operation } from "./ops/types.js";
import { servePrimitives, type FieldWriter } from "./ops/served.js";
import { writersOf } from "./ops/writers.js";
import { withoutKeptFields } from "./ops/kept-fields.js";
import { namesUnseen, redact, WITHHELD_INTENT } from "./ops/withheld.js";
import { actingAs } from "./permissions/policy.js";
import { recordsOf } from "./permissions/sight.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import type { Judged } from "./permissions/sight.js";
import { hidesFrom, seatLens, seenBy } from "./seen.js";
import type { Store } from "./store.js";

/*
 * A file of its own (FR-179): what a seat's tools hand back after an act is
 * fetched with those tools (`@graview/core/seat`), and a page that only
 * draws what its seat sees (`./seen.ts`) carries none of it up front.
 */

/**
 * A CHANGE'S ANSWER AS ONE SEAT MAY BE TOLD IT (FR-55) — the diff, the
 * primitives, the ops and the rules it would break or mend of a preview,
 * an apply or an undo, for a surface that hands a seat what its own act
 * did: an act may touch what its own seat may not see. Records and edges
 * it is not served go, a field naming one it may not see is cleared as
 * the view clears it, the ops are redacted as its log is, and a sentence
 * that names what it may not see says only that a change it cannot see
 * happened. With nothing kept from the seat, the answer as it is.
 */
export function answerSeenBy<
  A extends {
    readonly diff?: GraphDiff<GraphNodeBase>;
    readonly primitives?: readonly unknown[];
    readonly reads?: readonly string[];
    readonly writes?: readonly string[];
    readonly intent?: string;
    readonly introduces?: readonly Violation[];
    readonly resolves?: readonly Violation[];
    readonly violationsAfter?: readonly Violation[];
    readonly ops?: readonly Operation[];
  },
>(store: Judged & { allInvariants(): readonly InvariantDefinition[] }, principal: Principal, answer: A): A {
  if (!hidesFrom(store, principal)) return answer;
  const lens = seatLens(store, principal);
  const has = (id: string) => store.graph.getNode(id) !== undefined || recordsOf(store.log).kindOf(id) !== undefined;
  const out: Record<string, unknown> = { ...answer };
  if (answer.diff) {
    const diff = answer.diff as GraphDiff;
    /*
     * EACH SIDE AS WHO WROTE IT THEN (FR-55): the seat's own words are served
     * as written, and the words a change replaced were somebody's before it.
     * Before is judged as of the first op the answer made (now, for a
     * preview); after as of now — and, for a preview, what it would write
     * is the caller's.
     */
    const writers = writersOf(store.log as never);
    const end = (store.log as { readonly length?: number }).length ?? store.log.all().length;
    const first = answer.ops?.[0]?.seq ?? end;
    const actor = actingAs(principal).id;
    const wroteAt = (id: string, seq: number) => (field: string) => writers.writerAt(id, field, seq);
    const node = <N extends { id: string; kind: string }>(one: N, writer: FieldWriter) => (lens.shows(one.id) ? lens.servedWith(one, writer) : undefined);
    const nodes = <N extends { id: string; kind: string }>(all: readonly N[], writer: (id: string) => FieldWriter) => all.flatMap((one) => node(one, writer(one.id)) ?? []);
    const edge = (one: GraphEdge) => lens.shows(one.from) && lens.shows(one.to) && !namesUnseen(one, lens.sees);
    const madeBy = (id: string, fields?: readonly string[]): FieldWriter =>
      answer.ops ? wroteAt(id, end) : (field) => (fields === undefined || fields.includes(field) ? actor : writers.writerAt(id, field, end));
    const changed = diff.changedNodes.flatMap((change: NodeChange) => {
      const before = node(change.before, wroteAt(change.before.id, first));
      const after = node(change.after, madeBy(change.after.id, change.fields));
      return before && after ? [{ before, after, fields: change.fields.filter((field) => field in before || field in after) }] : [];
    });
    /*
     * A WRITE THAT CHANGED NOTHING BUT WHOSE WORDS THEY ARE. A seat that
     * wrote the value a field already held, naming what it may not see, made
     * those words its own (FR-55): the store's graph did not move, and the
     * seat's view of the record did. Said as a change, so the answer reads
     * as it would had the field held anything else.
     */
    const listed = new Set(diff.changedNodes.map((change: NodeChange) => change.after.id));
    const patched = new Map<string, string[]>();
    for (const primitive of (answer.ops?.flatMap((op) => op.primitives) ?? (answer.primitives as readonly Primitive[] | undefined) ?? [])) {
      if (primitive.op !== "patch-node" || listed.has(primitive.id)) continue;
      patched.set(primitive.id, [...(patched.get(primitive.id) ?? []), ...Object.keys(primitive.after)]);
    }
    const kept = () =>
      [...patched].flatMap(([id, fields]) => {
        const held = store.graph.getNode(id) as AnyGraphNode | undefined;
        if (!held) return [];
        const before = node(held, wroteAt(id, first));
        const after = node(held, madeBy(id, fields));
        return before && after && JSON.stringify(before) !== JSON.stringify(after) ? [{ before, after, fields }] : [];
      });
    const madeTheirs = kept();
    out["diff"] = {
      addedNodes: nodes(diff.addedNodes, (id) => madeBy(id)),
      removedNodes: nodes(diff.removedNodes, (id) => wroteAt(id, first)),
      changedNodes: [...changed, ...madeTheirs],
      addedEdges: diff.addedEdges.filter(edge),
      removedEdges: diff.removedEdges.filter(edge),
      touched: [...diff.touched.filter(lens.shows), ...[...patched.keys()].filter((id) => lens.shows(id) && !diff.touched.includes(id))],
    };
  }
  if (answer.ops) out["ops"] = redact(answer.ops, lens);
  if (answer.primitives) {
    // An apply's primitives are its ops'; a preview's are not in the log yet, and are judged from the graph as it stands.
    const ops = out["ops"] as readonly Operation[] | undefined;
    out["primitives"] = ops
      ? ops.flatMap((op) => op.primitives)
      : lens.timeline
        ? servePrimitives(answer.primitives as readonly Primitive[], lens.timeline, { served: (node, writer) => lens.servedWith(node, writer), edgeClean: (edge) => !namesUnseen(edge, lens.sees), sees: lens.sees }, actingAs(principal).id)
        : redact([{ id: "", seq: 0, batch: "", author: { kind: "system" }, intent: "", mutation: null, primitives: answer.primitives as never, inverse: [], reads: [], writes: [], at: "" }], lens)[0]!.primitives;
  }
  // What a change wrote of a field the seat may not see is no part of what it is told (Roadmap f-field-sight).
  if (lens.kept && out["primitives"]) out["primitives"] = withoutKeptFields(out["primitives"] as readonly Primitive[], lens);
  // Records the seat is served, and no id that names nothing: a hidden record and an absent one are left out alike (FR-55).
  if (answer.reads) out["reads"] = answer.reads.filter((id) => lens.shows(id) && has(id));
  if (answer.writes) out["writes"] = answer.writes.filter(lens.shows);
  if (answer.intent !== undefined && namesUnseen(answer.intent, lens.sees)) out["intent"] = WITHHELD_INTENT;
  /*
   * THE RULES IT BROKE OR MENDED, AS THE SEAT JUDGES THEM (FR-55). Judged
   * over the whole graph, whether a rule that counts, sweeps or walks was
   * broken or mended depends on records this seat may not see, and its
   * title alone says so. So they are judged again over the seat's own
   * world: what it is served now, and that world with the change it is
   * served taken back — or, for a preview, put on. The judging is
   * `@graview/core/lines`', which a seat's tools load before they answer;
   * without it, nothing judged over the whole graph is said.
   */
  if (answer.violationsAfter) Object.assign(out, judgedForASeat ? judgedForASeat(store as never, seenBy(store as never, principal), !!answer.ops, (out["primitives"] ?? []) as readonly Primitive[]) : { introduces: [], resolves: [], violationsAfter: [] });
  return out as A;
}

/** A change's problems as a seat judges them over its own world: `@graview/core/lines` hands it over as it loads. */
type SeatJudged = (store: Store<AnySchema>, seat: Store<AnySchema>, made: boolean, served: readonly Primitive[]) => Record<"introduces" | "resolves" | "violationsAfter", Violation[]>;
let judgedForASeat: SeatJudged | undefined;

/** Hands `answerSeenBy` what judges a change's problems over a seat's world. */
export const answersJudgedWith = (judge: SeatJudged): void => void (judgedForASeat = judge);

