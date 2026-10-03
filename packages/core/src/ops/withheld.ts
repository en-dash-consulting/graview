import type { Primitive } from "../graph/primitives.js";
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

/** Every string a call's arguments hold, at any depth: where a record's id would be. */
function strings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) for (const inner of value) strings(inner, into);
  else if (value !== null && typeof value === "object") for (const inner of Object.values(value)) strings(inner, into);
  return into;
}

/**
 * Whether an op touched, read or named anything `sees` says no to: then it
 * is withheld whole, because its sentence ("Book a test drive for Freya")
 * names what it touched as surely as its primitives do.
 */
export function touchesUnseen(op: Operation, sees: (id: string) => boolean): boolean {
  if (op.primitives.some((primitive) => touchedBy(primitive).some((id) => !sees(id)))) return true;
  if (op.writes.some((id) => !sees(id)) || op.reads.some((id) => !sees(id))) return true;
  return op.mutation !== null && strings(op.mutation.args).some((value) => !sees(value));
}

/**
 * THE OP AS A SEAT THAT MAY NOT SEE IT RECEIVES IT. Its id, seq, batch and
 * time stand; who made it, what it meant, the call and the inverse go. Its
 * primitives keep the ones that touch only what the seat sees — a change to
 * a record the seat can see still reaches it, or its copy of the graph
 * would go stale — and its reads and writes keep only seen ids, so an undo
 * the seat asks for is still blocked by it where it should be.
 */
export function withhold(op: Operation, sees: (id: string) => boolean): Operation {
  return {
    id: op.id,
    seq: op.seq,
    batch: op.batch,
    author: WITHHELD_AUTHOR,
    intent: WITHHELD_INTENT,
    mutation: null,
    primitives: op.primitives.filter((primitive) => touchedBy(primitive).every(sees)),
    inverse: [],
    reads: op.reads.filter(sees),
    writes: op.writes.filter(sees),
    at: op.at,
    ...(op.undoes !== undefined ? { undoes: op.undoes } : {}),
    withheld: true,
  };
}

/** Every op of a log as a seat receives it: what it may see as it is, the rest withheld in place. */
export function redact(ops: readonly Operation[], sees: (id: string) => boolean): Operation[] {
  return ops.map((op) => (op.withheld || !touchesUnseen(op, sees) ? op : withhold(op, sees)));
}
