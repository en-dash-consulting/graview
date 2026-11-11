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
import type { Primitive } from "./graph/primitives.js";
import type { MutationCall } from "./mutations/types.js";
import type { Operation } from "./ops/types.js";
import type { Principal, Refusal } from "./permissions/types.js";

/** The name of the act that binds a seat to a person already entered. */
export const BIND_PERSON = "bind-person";

/** What `@graview/core/binding` teaches the store when it is loaded, as `PUBLISHING` does for a publish. */
export interface BindingServed {
  /** The `bind-person` act for this store, or none where no kind is the people. */
  act?: (store: object) => unknown;
  /** Whether this seat may run this binding: the host's system seat, or a grant that names the act for one of its roles. */
  judged?: (store: object, call: MutationCall, principal: Principal) => { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal };
  /** Why this binding's op may not be taken back, in a sentence; undefined when it may. */
  undo?: (store: object, op: Operation) => string | undefined;
}
/* One object for the store and `@graview/core/binding`, found by a key every copy agrees on. */
export const BINDING: BindingServed = ((globalThis as Record<symbol, BindingServed | undefined>)[Symbol.for("@graview/core:binding")] ??= {});

/** A record without the seat it is bound to: what anybody but the host is handed. The record itself where it carries none. */
export function unseated<N>(node: N): N {
  if (node === null || typeof node !== "object" || !Object.hasOwn(node, PERSON_SEAT)) return node;
  const { [PERSON_SEAT]: _seat, ...rest } = node as Record<string, unknown>;
  return rest as N;
}

/** A primitive without the seat a record is bound to; undefined where that was all it said. */
export function unseatedPrimitive(primitive: Primitive): Primitive | undefined {
  switch (primitive.op) {
    case "add-node":
    case "remove-node": {
      const node = unseated(primitive.node);
      return node === primitive.node ? primitive : { ...primitive, node };
    }
    case "patch-node": {
      if (!Object.hasOwn(primitive.after, PERSON_SEAT) && !Object.hasOwn(primitive.before, PERSON_SEAT)) return primitive;
      const after = unseated(primitive.after);
      const before = unseated(primitive.before);
      return Object.keys(after).length === 0 && Object.keys(before).length === 0 ? undefined : { ...primitive, before, after };
    }
    default:
      return primitive;
  }
}

/**
 * AN OP WITHOUT A SEAT IN IT: its primitives, what puts it back and, for a
 * binding, its call, with no seat a record is bound to — the seat is an
 * account's id, the host's to know. The op itself where it names none.
 */
export function unseatedOp(op: Operation): Operation {
  const binds = op.mutation?.name === BIND_PERSON && op.mutation.args && Object.hasOwn(op.mutation.args, "seat");
  const primitives = op.primitives.flatMap((one) => unseatedPrimitive(one) ?? []);
  const inverse = op.inverse?.flatMap((one) => unseatedPrimitive(one) ?? []);
  const same = !binds && primitives.length === op.primitives.length && primitives.every((one, at) => one === op.primitives[at]) && (op.inverse === undefined || (inverse!.length === op.inverse.length && inverse!.every((one, at) => one === op.inverse![at])));
  if (same) return op;
  const { seat: _seat, ...args } = (op.mutation?.args ?? {}) as Record<string, unknown>;
  return { ...op, primitives, ...(inverse ? { inverse } : {}), ...(binds ? { mutation: { ...op.mutation!, args } } : {}) };
}

/** A snapshot with no record bound to a seat: what leaves this installation (an export, a seed, a template). */
export function unseatedSnapshot<T extends { readonly nodes: readonly unknown[] }>(snapshot: T): T {
  return snapshot.nodes.some((node) => unseated(node) !== node) ? { ...snapshot, nodes: snapshot.nodes.map(unseated) } : snapshot;
}
