/**
 * WHAT A PAGE CARRIES OF BINDING A SEAT TO A PERSON (Roadmap
 * f-invite-binds-existing-person): the act's name, the one object
 * `@graview/core/binding` fills in when a host loads it, and taking the
 * mark off what is handed to anybody but the host. Resolving a seat to the
 * record it was bound to (`seatedIn`, `Graph.personBoundTo`) is the main
 * entry's; making a binding, judging who may and taking one back are the
 * host's entry's alone, so no page pays for them.
 */
import { PERSON_SEAT } from "./graph/archived.js";
import { isUnset, type Primitive } from "./graph/primitives.js";
import type { MutationCall } from "./mutations/types.js";
import type { Operation } from "./ops/types.js";
import { bindable, isSystem, seatPersonOf } from "./permissions/policy.js";
import type { Principal, Refusal } from "./permissions/types.js";

/** The name of the act that binds a seat to a person already entered. */
export const BIND_PERSON = "bind-person";

/** The name of the act that moves a seat, and what it did, from the record it is bound to onto another (Roadmap f-rebind-after-acting). */
export const REBIND_PERSON = "rebind-person";

/** The name of the act that binds a seat with a record of its own to a person entered for it, the own record merged in (Roadmap f-merge-own-record-into-person). */
export const BIND_OWN_RECORD = "bind-own-record";

/** The acts that say whose record a person is: the framework's own, the host's alone, and never an app's. */
export const BINDING_ACTS: readonly string[] = [BIND_PERSON, REBIND_PERSON, BIND_OWN_RECORD];

/** Whether a name is one of the binding acts (`BINDING_ACTS`). */
export const isBindingAct = (name: string | undefined): boolean => name === BIND_PERSON || name === REBIND_PERSON || name === BIND_OWN_RECORD;

/** What `@graview/core/binding` teaches the store when it is loaded, as `PUBLISHING` does for a publish. */
export interface BindingServed {
  /** The binding act of this name (`bind-person`, `rebind-person`, `bind-own-record`) for this store, or none where no kind is the people. */
  act?: (store: object, name: string) => unknown;
  /** Whether this seat may run this binding: the host's system seat alone, acting for the app's owner; no grant gives it. */
  judged?: (store: object, call: MutationCall, principal: Principal) => { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal };
  /** Why this op of a binding's (`root` the change its undo chain begins with) may not be taken back, in a sentence; undefined when it may. */
  undo?: (store: object, op: Operation, root: Operation) => string | undefined;
}
/* One object for the store and `@graview/core/binding`, found by a key every copy agrees on. */
export const BINDING: BindingServed = ((globalThis as Record<symbol, BindingServed | undefined>)[Symbol.for("@graview/core:binding")] ??= {});

/** The op an undo chain begins with: the change itself, however often it was taken back and put back. */
export function rootOfChain(op: Operation, get: (id: string) => Operation | undefined): Operation {
  let at = op;
  for (let next = at.undoes === undefined ? undefined : get(at.undoes); next !== undefined; next = at.undoes === undefined ? undefined : get(at.undoes)) at = next;
  return at;
}

/**
 * Whether an op that takes a seat off a record TAKES A BINDING BACK (Roadmap
 * f-unbind-person) — the seat is nobody's again, as if never bound — rather
 * than ending one, or a host's own repair, after which what the seat did
 * there stays said as that person.
 */
export function takesBindingBack(op: Operation, get: (id: string) => Operation | undefined): boolean {
  if (op.undoes === undefined) return false;
  const root = rootOfChain(op, get);
  // A merge taken back makes the seat its own record's again (Roadmap f-merge-own-record-into-person).
  if (root.mutation?.name === BIND_OWN_RECORD) return true;
  return root.mutation?.name === BIND_PERSON && (root.mutation.args as Record<string, unknown> | undefined)?.["end"] !== true;
}

/**
 * WHOSE RECORD EACH WAS WHERE THE LOG BEGINS, record by record: the graph's
 * bindings now, with every binding the log holds taken back, newest first.
 * A store loaded from a snapshot, or compacted, bound people behind its
 * horizon; what they did after it is theirs as those records.
 */
export function boundAtHorizon(store: { readonly graph: object; readonly log: { all(): readonly Operation[] } }): Map<string, string> {
  const seats = new Map<string, string>();
  const seatOf = (node: object): string | undefined => {
    const seat = (node as Record<string, unknown>)[PERSON_SEAT];
    return typeof seat === "string" && !isUnset(seat) ? seat : undefined;
  };
  for (const node of (store.graph as { allNodes?(options: { archived: "all" }): readonly { readonly id: string }[] }).allNodes?.({ archived: "all" }) ?? []) {
    const seat = seatOf(node);
    if (seat !== undefined) seats.set(node.id, seat);
  }
  const ops = store.log.all();
  for (let at = ops.length - 1; at >= 0; at--) {
    const primitives = ops[at]!.primitives;
    for (let one = primitives.length - 1; one >= 0; one--) {
      const primitive = primitives[one]!;
      if (primitive.op === "add-node" && seatOf(primitive.node)) seats.delete(primitive.node.id);
      else if (primitive.op === "remove-node" && seatOf(primitive.node)) seats.set(primitive.node.id, seatOf(primitive.node)!);
      else if (primitive.op === "patch-node" && Object.hasOwn(primitive.after, PERSON_SEAT)) {
        const was = seatOf(primitive.before);
        if (was !== undefined) seats.set(primitive.id, was);
        else seats.delete(primitive.id);
      }
    }
  }
  return seats;
}

/** Which seats a reader may be told a record is bound to: none (`NO_SEAT`), its own, or all of them. */
export type KeepsSeat = (seat: string) => boolean;
const NO_SEAT: KeepsSeat = () => false;

/** Whether a node says a seat this reader may not be told. */
const tellsOther = (node: object, keeps: KeepsSeat): boolean => {
  if (!Object.hasOwn(node, PERSON_SEAT)) return false;
  const seat = (node as Record<string, unknown>)[PERSON_SEAT];
  return typeof seat !== "string" || !keeps(seat);
};

/** A record without the seat it is bound to — unless it is one `keeps` says this reader may be told. The record itself where nothing goes. */
export function unseated<N>(node: N, keeps: KeepsSeat = NO_SEAT): N {
  if (node === null || typeof node !== "object" || !tellsOther(node, keeps)) return node;
  const { [PERSON_SEAT]: _seat, ...rest } = node as Record<string, unknown>;
  return rest as N;
}

/** A primitive without a seat its reader may not be told; undefined where that was all it said. */
export function unseatedPrimitive(primitive: Primitive, keeps: KeepsSeat = NO_SEAT): Primitive | undefined {
  switch (primitive.op) {
    case "add-node":
    case "remove-node": {
      const node = unseated(primitive.node, keeps);
      return node === primitive.node ? primitive : { ...primitive, node };
    }
    case "patch-node": {
      if (!tellsOther(primitive.after, keeps) && !tellsOther(primitive.before, keeps)) return primitive;
      // A seat bound or unbound: told whole only where both ends are this reader's to know.
      const after = unseated(primitive.after);
      const before = unseated(primitive.before);
      return Object.keys(after).length === 0 && Object.keys(before).length === 0 ? undefined : { ...primitive, before, after };
    }
    default:
      return primitive;
  }
}

/**
 * AN OP WITHOUT A SEAT ITS READER MAY NOT BE TOLD: its primitives, what puts
 * it back and, for a binding, its call. A seat is an account's id: its own
 * account's to know, and the host's, which binds people. The op
 * itself where it names none.
 */
export function unseatedOp(op: Operation, keeps: KeepsSeat = NO_SEAT): Operation {
  const seat = isBindingAct(op.mutation?.name) ? (op.mutation!.args as Record<string, unknown> | undefined)?.["seat"] : undefined;
  const binds = isBindingAct(op.mutation?.name) && Object.hasOwn(op.mutation!.args ?? {}, "seat") && !(typeof seat === "string" && keeps(seat));
  const primitives = op.primitives.flatMap((one) => unseatedPrimitive(one, keeps) ?? []);
  const inverse = op.inverse?.flatMap((one) => unseatedPrimitive(one, keeps) ?? []);
  const same = !binds && primitives.length === op.primitives.length && primitives.every((one, at) => one === op.primitives[at]) && (op.inverse === undefined || (inverse!.length === op.inverse.length && inverse!.every((one, at) => one === op.inverse![at])));
  if (same) return op;
  const { seat: _seat, ...args } = (op.mutation?.args ?? {}) as Record<string, unknown>;
  return { ...op, primitives, ...(inverse ? { inverse } : {}), ...(binds ? { mutation: { ...op.mutation!, args } } : {}) };
}

/** A snapshot with no record bound to a seat: what leaves this installation (an export, a seed, a template). */
export function unseatedSnapshot<T extends { readonly nodes: readonly unknown[] }>(snapshot: T): T {
  return snapshot.nodes.some((node) => unseated(node) !== node) ? { ...snapshot, nodes: snapshot.nodes.map((node) => unseated(node)) } : snapshot;
}

/** The seats a reader may be told a record is bound to: every one for the host, which binds people; its own for a person; none for anybody else. */
export function seatsKept(principal: Principal): KeepsSeat {
  if (isSystem(principal)) return () => true;
  const own = bindable(principal) ? seatPersonOf(principal) : undefined;
  return own === undefined ? NO_SEAT : (seat) => seat === own;
}
