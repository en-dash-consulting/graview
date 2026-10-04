import { UNSET, type Primitive } from "../graph/primitives.js";
import type { Author, Operation } from "./types.js";

/**
 * A LOG A SEAT MAY NOT FULLY SEE IS REDACTED, NOT GAPPED (FR-16).
 *
 * A store that keeps some records from a seat cannot simply drop the ops
 * that touched them: a log is contiguous by construction (undo, replay and
 * `OperationLog.from` all count on it), and a hole would also say less than
 * the truth — something did happen there. So the op stays, as a WITHHELD
 * op: its place in the log and nothing that says what it was.
 */

/** What a withheld op says it was, wherever it is read out. */
export const WITHHELD_INTENT = "A change you cannot see";

/** Who a withheld op says made it: nobody this seat may be told about. */
export const WITHHELD_AUTHOR: Author = { kind: "system", id: "withheld", name: "Someone" };

/** Whether an op is one a store withheld from the seat reading it. */
export function isWithheld(op: Pick<Operation, "withheld">): boolean {
  return op.withheld === true;
}

/** The record ids a primitive touches. */
export function touchedBy(primitive: Primitive): readonly string[] {
  switch (primitive.op) {
    case "add-node":
    case "remove-node":
      return [primitive.node.id];
    case "patch-node":
      return [primitive.id];
    case "add-edge":
    case "remove-edge":
      return [primitive.edge.from, primitive.edge.to];
  }
}

/**
 * WHAT ONE SEAT IS SERVED (FR-55): the judgement a log is redacted by.
 * `sees` is the seat's sight — the ids it may be told. `shows` is what it
 * is served: a record it sees, unless a field the record cannot do without
 * names one it may not see. `served` is a record as the seat receives it,
 * and `optional` says whether a kind's field may be left off one. A bare
 * `(id) => boolean` is a lens that clears nothing: a record whose field
 * names an unseen id is not served at all.
 */
export interface SeatLens {
  readonly sees: (id: string) => boolean;
  readonly shows: (id: string) => boolean;
  readonly served: <N extends { readonly id: string; readonly kind: string }>(node: N) => N | undefined;
  readonly optional: (kind: string, field: string) => boolean;
  /** The kind of a record, by id, when it is known: for a patch, whose primitive does not say. */
  readonly kindOf: (id: string) => string | undefined;
}

/** Whether any field of a record — not its id or kind — names what `sees` says no to. */
const fieldsNameUnseen = (node: object, sees: (id: string) => boolean): boolean =>
  Object.entries(node).some(([key, value]) => key !== "id" && key !== "kind" && namesUnseen(value, sees));

/** A lens over a bare sight: it serves a record whole or not at all. */
export function lensOf(seeing: SeatLens | ((id: string) => boolean)): SeatLens {
  if (typeof seeing !== "function") return seeing;
  const sees = seeing;
  return {
    sees,
    shows: sees,
    served: (node) => (sees(node.id) && !fieldsNameUnseen(node, sees) ? node : undefined),
    optional: () => false,
    kindOf: () => undefined,
  };
}

/**
 * WHETHER A VALUE NAMES ANYTHING THE SEAT MAY NOT SEE (FR-55): any string
 * in it, at any depth, a value or a key, that is an unseen record's id. An
 * id is minted from a label, so an id a seat is served is the name of what
 * it was kept from.
 */
export function namesUnseen(value: unknown, sees: (id: string) => boolean): boolean {
  if (typeof value === "string") return !sees(value);
  if (Array.isArray(value)) return value.some((inner) => namesUnseen(inner, sees));
  if (value !== null && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) if (!sees(key) || namesUnseen(inner, sees)) return true;
  }
  return false;
}

/**
 * Whether an op touched, read or named anything `sees` says no to: then it
 * is withheld whole, because its sentence ("Book a test drive for Freya")
 * names what it touched as surely as its primitives do.
 */
export function touchesUnseen(op: Operation, sees: (id: string) => boolean): boolean {
  if (op.primitives.some((primitive) => touchedBy(primitive).some((id) => !sees(id)))) return true;
  if (op.writes.some((id) => !sees(id)) || op.reads.some((id) => !sees(id))) return true;
  return op.mutation !== null && namesUnseen(op.mutation.args, sees);
}

/**
 * A PRIMITIVE AS A SEAT RECEIVES IT, or nothing (FR-55). One that touches a
 * record the seat is not served goes. A record it adds is served as the
 * seat's view serves it — a field naming an unseen record cleared, or the
 * primitive dropped when that field is one the record cannot do without,
 * so a client never adds a record that fails its own declaration. A patch
 * that wrote such a field says the field was cleared, as the view shows
 * it; one it cannot clear goes. A removal needs only the record's id.
 */
function servedPrimitive(primitive: Primitive, lens: SeatLens): Primitive | undefined {
  if (!touchedBy(primitive).every(lens.shows)) return undefined;
  switch (primitive.op) {
    case "add-node": {
      const node = lens.served(primitive.node);
      return node ? (node === primitive.node ? primitive : { op: "add-node", node }) : undefined;
    }
    case "remove-node": {
      const node = primitive.node;
      if (!fieldsNameUnseen(node, lens.sees)) return primitive;
      return { op: "remove-node", node: Object.fromEntries(Object.entries(node).filter(([key, value]) => key === "id" || key === "kind" || !namesUnseen(value, lens.sees))) as typeof node };
    }
    case "patch-node": {
      const kind = lens.kindOf(primitive.id);
      const after: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(primitive.after)) {
        if (!namesUnseen(value, lens.sees)) after[field] = value;
        else if (kind !== undefined && lens.optional(kind, field)) after[field] = UNSET;
        else return undefined;
      }
      const before = Object.fromEntries(Object.entries(primitive.before).filter(([, value]) => !namesUnseen(value, lens.sees)));
      return { op: "patch-node", id: primitive.id, before, after };
    }
    case "add-edge":
    case "remove-edge":
      return namesUnseen(primitive.edge, lens.sees) ? undefined : primitive;
  }
}

/**
 * THE OP AS A SEAT THAT MAY NOT SEE IT RECEIVES IT. Its id, seq, batch and
 * time stand; who made it, what it meant, the call and the inverse go. Its
 * primitives keep the ones that touch only what the seat is served, as it
 * is served them (FR-55) — a change to a record the seat can see still
 * reaches it, or its copy of the graph would go stale, and no id of what it
 * may not see rides along in a field — and its reads and writes keep only
 * served ids, so an undo the seat asks for is still blocked by it where it
 * should be.
 */
export function withhold(op: Operation, seeing: SeatLens | ((id: string) => boolean)): Operation {
  const lens = lensOf(seeing);
  return {
    id: op.id,
    seq: op.seq,
    batch: op.batch,
    author: WITHHELD_AUTHOR,
    intent: WITHHELD_INTENT,
    mutation: null,
    primitives: op.primitives.flatMap((primitive) => {
      const served = servedPrimitive(primitive, lens);
      return served ? [served] : [];
    }),
    inverse: [],
    reads: op.reads.filter(lens.shows),
    writes: op.writes.filter(lens.shows),
    at: op.at,
    ...(op.undoes !== undefined ? { undoes: op.undoes } : {}),
    withheld: true,
  };
}

/**
 * Every op of a log as a seat receives it: what it may see as it is, the
 * rest withheld in place. An op is withheld when it touches a record the
 * seat is not served, or names one it may not see ANYWHERE — its call, its
 * sentence, its author, a field value in a primitive or its inverse
 * (FR-55). One withheld already is withheld again under this seat's lens.
 */
export function redact(ops: readonly Operation[], seeing: SeatLens | ((id: string) => boolean)): Operation[] {
  const lens = lensOf(seeing);
  return ops.map((op) => (!op.withheld && !touchesUnseen(op, lens.shows) && !namesUnseen(op, lens.sees) ? op : withhold(op, lens)));
}
