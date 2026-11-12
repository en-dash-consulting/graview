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
import { bindable, isSystem, seatPersonOf } from "./permissions/policy.js";
import type { Policy, Principal, Refusal } from "./permissions/types.js";

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
 * account's to know, and the host's and whoever binds people's. The op
 * itself where it names none.
 */
export function unseatedOp(op: Operation, keeps: KeepsSeat = NO_SEAT): Operation {
  const seat = op.mutation?.name === BIND_PERSON ? (op.mutation.args as Record<string, unknown> | undefined)?.["seat"] : undefined;
  const binds = op.mutation?.name === BIND_PERSON && Object.hasOwn(op.mutation.args ?? {}, "seat") && !(typeof seat === "string" && keeps(seat));
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

/**
 * WHETHER A SEAT BINDS PEOPLE HERE: a person — no agent, nobody acting for
 * another — holding a role a grant names `bind-person` for, by name. What
 * may bind (`@graview/core/binding`), and what is told who is bound.
 */
export function bindsPeople(policy: Policy | undefined, principal: Principal): boolean {
  if (principal.kind !== "human" || principal.onBehalfOf !== undefined || principal.shared === true) return false;
  const roles = principal.roles ?? [];
  return (policy?.grants ?? []).some((grant) => Array.isArray(grant.mutations) && grant.mutations.includes(BIND_PERSON) && Array.isArray(grant.roles) && !grant.self && !grant.ownEnd && (grant.roles as readonly string[]).some((role) => roles.includes(role)));
}

/** The seats a reader may be told a record is bound to: every one for the host and whoever binds people; its own for a person; none for anybody else. */
export function seatsKept(policy: Policy | undefined, principal: Principal): KeepsSeat {
  if (isSystem(principal) || bindsPeople(policy, principal)) return () => true;
  const own = bindable(principal) ? seatPersonOf(principal) : undefined;
  return own === undefined ? NO_SEAT : (seat) => seat === own;
}
