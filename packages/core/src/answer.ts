/**
 * `@graview/core/answer` — WHAT A CHANGE DID, AS A SEAT MAY BE TOLD IT,
 * fetched with the seat that answers.
 *
 * A seat's tools hand back what an act, an undo or a preview did; an act
 * may touch what its own seat may not see, so the answer is served as the
 * seat's view and log are (`seen.ts`). Its own entry because only an
 * answering seat needs it: `@graview/core`'s index reaches every file it
 * names, and a hosted page imports that index up front.
 */
import type { GraphDiff, NodeChange } from "./graph/diff.js";
import type { AnyGraphNode, GraphEdge, GraphNodeBase } from "./graph/types.js";
import type { Primitive } from "./graph/primitives.js";
import type { InvariantDefinition, Violation } from "./invariants/types.js";
import type { Operation } from "./ops/types.js";
import { servePrimitives, type FieldWriter } from "./ops/served.js";
import { writersOf } from "./ops/writers.js";
import { namesUnseen, partly, redact, touchedBy, WITHHELD_INTENT, type SeatLens } from "./ops/withheld.js";
import { actingAs } from "./permissions/policy.js";
import { recordsOf, sees } from "./permissions/sight.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import { hidesFrom, seatLens, seenBy, type Judged } from "./seen.js";
import type { Store } from "./store.js";

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
  const seen = seatLens(store, principal);
  /*
   * WHAT A PREVIEW WOULD MAKE, AS THE SEAT WOULD SEE IT (FR-55). A record a
   * preview makes is not in the graph yet, so the seat's sight finds
   * nothing there to keep from it: it is judged by its kind and by the
   * links the preview gives it, as made by the seat. One the seat would not
   * see is kept from it as one in the graph is.
   */
  const unseen = new Set<string>();
  if (!answer.ops) {
    const made = (answer.primitives ?? []) as readonly Primitive[];
    const links = made.flatMap((one) => (one.op === "add-edge" ? [one.edge] : []));
    const joined = (from: "from" | "to", to: "from" | "to") => (id: string, kind?: string) => links.filter((edge) => edge[from] === id && (!kind || edge.kind === kind)).map((edge) => ({ id: edge[to] }));
    const graph = { out: joined("from", "to"), in: joined("to", "from") };
    for (const one of made) {
      if (one.op === "add-node" && !store.graph.getNode(one.node.id) && !sees(store.policy, principal, one.node, graph, { creatorOf: () => actingAs(principal).id })) unseen.add(one.node.id);
    }
  }
  const lens: SeatLens = unseen.size ? { ...seen, sees: (id) => !unseen.has(id) && seen.sees(id), shows: (id) => !unseen.has(id) && seen.shows(id) } : seen;
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
      : (lens.timeline
          ? servePrimitives(answer.primitives as readonly Primitive[], lens.timeline, { served: (node, writer) => lens.servedWith(node, writer), edgeClean: (edge) => !namesUnseen(edge, lens.sees), sees: lens.sees }, actingAs(principal).id)
          : redact([{ id: "", seq: 0, batch: "", author: { kind: "system" }, intent: "", mutation: null, primitives: answer.primitives as never, inverse: [], reads: [], writes: [], at: "" }], lens)[0]!.primitives
        ).filter((one) => !touchedBy(one).some((id) => unseen.has(id)));
  }
  // Records the seat is served, and no id that names nothing: a hidden record and an absent one are left out alike (FR-55).
  if (answer.reads) out["reads"] = answer.reads.filter((id) => lens.shows(id) && has(id));
  if (answer.writes) out["writes"] = answer.writes.filter(lens.shows);
  /*
   * ITS SENTENCE, AS THE SEAT IS SERVED WHAT IT DID (FR-55). An apply or an
   * undo the seat is served only part of — an op withheld, or a link left
   * out — is said again from the ops it is served, each judged as its log
   * judges it: a caller's sentence for the whole is free text no check can
   * clear. Served none of them, it is a change the seat cannot see. A
   * preview has no ops to say it from, and its sentence stands only when
   * every record it would touch is served.
   */
  const ops = out["ops"] as readonly Operation[] | undefined;
  const kept = new Set(((out["primitives"] ?? []) as readonly Primitive[]).flatMap(touchedBy));
  if (answer.intent !== undefined)
    out["intent"] = (ops ? partly(answer.ops!, ops).size : !((answer.primitives ?? []) as readonly Primitive[]).flatMap(touchedBy).every((id) => kept.has(id)))
      ? ops?.flatMap((op) => (op.withheld ? [] : [op.intent])).join("; ") || WITHHELD_INTENT
      : namesUnseen(answer.intent, lens.sees)
        ? WITHHELD_INTENT
        : answer.intent;
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
