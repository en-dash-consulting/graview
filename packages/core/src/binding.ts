/**
 * `@graview/core/binding` — A MEMBER WHO JOINS IS THE PERSON ENTERED FOR
 * THEM (Roadmap f-invite-binds-existing-person). An organizer enters Bud
 * before he joins — his household, his lists — and when his account accepts
 * an invitation, the host binds it to that record rather than making a
 * second Bud (`bindPerson`). A host's, on no page: loading it teaches every
 * store the `bind-person` act, who may run it and when it may be taken back
 * (`BINDING`). Resolving a seat to its record is the main entry's.
 */
import { BIND_PERSON, BINDING } from "./binding-served.js";
import { PERSON_SEAT, personSeatOf } from "./graph/archived.js";
import { isUnset } from "./graph/primitives.js";
import { MissingRecordError, NO_SUCH_RECORD } from "./graph/graph.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import { signedOutSeat } from "./mutations/vote-suggestion.js";
import type { Operation } from "./ops/types.js";
import { actingAs, bindable, isSystem, ownsId, seatPersonOf, withValidProfile } from "./permissions/policy.js";
import type { Principal, Refusal } from "./permissions/types.js";
import { ActRefusal } from "./refused.js";
import { labelOf, nounOf, withArticle } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import * as z from "./schema/zod.js";
import type { ApplyOptions, ApplyResult, Store } from "./store.js";


/** A seat as a binding names it: an account's id, or an account's id and a profile's (`profilePersonId`). */
const SEAT = /^[^~]+(~[\w-]{1,64})?$/;

type Held = Store<AnySchema>;
type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

/**
 * WHO WAS DONE AS WHICH RECORD, read from the log: each op's author as the
 * seat it was, and the record that seat was bound to then — followed through
 * every binding, its undo and a record put back — or the seat's own id where
 * it was bound to none. A binding's own op is the binder's, not the seat's.
 */
function doneAs(store: Held): readonly { readonly seq: number; readonly seat: string; readonly record: string }[] {
  const bound = new Map<string, string>();
  const done: { seq: number; seat: string; record: string }[] = [];
  for (const op of store.log.all()) {
    for (const primitive of op.primitives) {
      if (primitive.op === "add-node" && personSeatOf(primitive.node)) bound.set(primitive.node.id, personSeatOf(primitive.node)!);
      else if (primitive.op === "remove-node") bound.delete(primitive.node.id);
      else if (primitive.op === "patch-node" && Object.hasOwn(primitive.after, PERSON_SEAT)) {
        const seat = primitive.after[PERSON_SEAT];
        if (isUnset(seat) || typeof seat !== "string") bound.delete(primitive.id);
        else bound.set(primitive.id, seat);
      }
    }
    if (op.mutation?.name === BIND_PERSON || (op.author.onBehalfOf ?? op.author).kind !== "human") continue;
    const seat = seatPersonOf(op.author);
    if (seat === undefined) continue;
    const record = [...bound].find(([, one]) => one === seat)?.[0] ?? seat;
    done.push({ seq: op.seq, seat, record });
  }
  return done;
}

/** The `bind-person` act for a store, where a kind is its people. */
function bindPersonMutation(store: Held): AnyMutationDefinition | undefined {
  const schema = store.schema;
  const people = schema.definitions.find((definition) => definition.people);
  if (!people) return undefined;
  const noun = nounOf(people, people.kind);
  const named = (node: Node) => labelOf(schema.tryDefinition(node.kind), node as never);
  return {
    name: BIND_PERSON,
    title: `Bind an account to this ${noun}`,
    description: `The account that joined is this ${noun} from now on: what it does is done as them, and no second ${noun} is made.`,
    subject: { kinds: [people.kind], arg: "record" },
    idempotent: true,
    input: z.object({ record: z.string().check(z.minLength(1)), seat: z.string().check(z.regex(SEAT)) }) as never,
    describe: (args, graph) => {
      const node = graph.getNode(String((args as { record: unknown }).record)) as Node | undefined;
      return `Bind ${node ? named(node) : `the ${noun}`} to the account that joined`;
    },
    apply(ctx, args) {
      const { record, seat } = args as { record: string; seat: string };
      const full = store.graph;
      const node = full.getNode(record) as Node | undefined;
      if (!node || !ctx.graph.getNode(record)) throw new MissingRecordError(record, NO_SUCH_RECORD.change);
      const definition = schema.tryDefinition(node.kind) as { readonly people?: boolean; readonly noun?: string } | undefined;
      if (!definition?.people) throw new ActRefusal(`${named(node)} is ${withArticle(nounOf(definition, node.kind))}, not ${withArticle(noun)}: only ${withArticle(noun)} can be someone's record here.`);
      const bound = personSeatOf(node);
      // Bound to this seat already, or this seat's own record: nothing to do.
      if (bound === seat || (bound === undefined && record === seat)) return;
      // Somebody's already: bound to another seat, a profile's own person, or a record somebody else was ever done as here.
      if (bound !== undefined || record.includes("~") || doneAs(store).some((one) => one.record === record && one.seat !== seat)) throw new ActRefusal(`${named(node)} is already someone else's record here.`);
      const other = full.personBoundTo(seat);
      const theirs = other === undefined ? undefined : (full.getNode(other) as Node | undefined);
      if (theirs) throw new ActRefusal(`That account is already ${named(theirs)} here.`);
      const own = full.getNode(seat) as Node | undefined;
      if (own && (schema.tryDefinition(own.kind) as { readonly people?: boolean } | undefined)?.people) throw new ActRefusal(`That account already has its own record here, ${named(own)}: merge the two instead.`);
      ctx.patchNode(record, { [PERSON_SEAT]: seat });
    },
  } as AnyMutationDefinition;
}

const refused = (call: MutationCall, message: string, wouldNeed: readonly string[] = []): { readonly ok: false; readonly refusal: Refusal } => ({ ok: false, refusal: { mutation: call.name, wouldNeed: [...wouldNeed], message } });

/**
 * WHO MAY BIND A SEAT TO A PERSON: the host's system seat, and a seat a grant
 * names `bind-person` for, by its name and for a role the seat holds — never
 * a grant to every role, never every act (`*`), never a grant held to the
 * seat's own record or end. With no policy, the host alone. Never a seat no
 * one person holds, a visitor, or one signed out; never a seat binding
 * itself, whatever it is granted.
 */
function judgedBinding(store: object, call: MutationCall, principal: Principal): { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal } {
  const held = store as Held;
  if (signedOutSeat(principal)) return refused(call, "Sign in to bind an account to a record here.");
  if (isSystem(principal)) return { ok: true };
  const seat = call.args["seat"];
  const record = call.args["record"];
  const acting = actingAs(principal);
  const account = acting.id;
  if ((typeof seat === "string" && account !== undefined && (seat === account || seat.startsWith(`${account}~`))) || (typeof record === "string" && ownsId(principal, record))) {
    return refused(call, "You cannot bind yourself to a record here: somebody who runs this app does that.");
  }
  const naming = (held.policy?.grants ?? []).filter((grant) => Array.isArray(grant.mutations) && grant.mutations.includes(BIND_PERSON) && Array.isArray(grant.roles) && !grant.self && !grant.ownEnd);
  const kind = typeof record === "string" ? held.graph.getNode(record)?.kind : undefined;
  const roles = acting.roles ?? [];
  const granted = naming.some((grant) => (grant.roles as readonly string[]).some((role) => roles.includes(role)) && (grant.kinds === undefined || grant.kinds === "*" || (kind !== undefined && grant.kinds.includes(kind))));
  if (granted) return { ok: true };
  const who = [...new Set(naming.flatMap((grant) => grant.roles as readonly string[]))];
  return refused(call, who.length > 0 ? "Not permitted: only the people who run this app bind an account to a record here." : "Not permitted: only the host binds an account to a record here.", who);
}

/** Why a binding may not be taken back: the seat has acted as the record since, and unbinding would hand what it did to somebody else. */
function bindingKept(store: object, op: Operation): string | undefined {
  const held = store as Held;
  const args = (op.mutation?.args ?? {}) as { readonly record?: unknown; readonly seat?: unknown };
  if (typeof args.record !== "string" || typeof args.seat !== "string") return undefined;
  if (!doneAs(held).some((one) => one.seq > op.seq && one.seat === args.seat && one.record === args.record)) return undefined;
  const node = held.graph.getNode(args.record) as Node | undefined;
  const name = node ? labelOf(held.schema.tryDefinition(node.kind), node as never) : "They";
  return `${name} has acted here: unbinding would hand what they did to someone else.`;
}

BINDING.act = (store) => bindPersonMutation(store as Held);
BINDING.judged = judgedBinding;
BINDING.undo = bindingKept;

/**
 * BIND A JOINING ACCOUNT TO THE PERSON ENTERED FOR IT: what a host calls as
 * an invitation is accepted. `joining` is the seat as the host will serve it
 * (its account, and the profile it acts as, if any); `record` the person's
 * id. The `bind-person` act, applied as `options.author` — the host's system
 * seat, or somebody a grant names the act for — and so blamed on them and
 * undone like any act, until the seat has acted as the record. Refused
 * (`ActRefusal`, or `PermissionDeniedError` for who may) in a sentence a
 * host can show.
 */
export function bindPerson<S extends AnySchema>(store: Store<S>, joining: Principal, record: string, options: ApplyOptions = {}): ApplyResult<S> {
  if (!store.schema.definitions.some((definition) => definition.people)) throw new ActRefusal("Nobody here can be bound to a record: this app says of no kind that it is its people.");
  const seat = bindable(withValidProfile(joining)) ? seatPersonOf(withValidProfile(joining)) : undefined;
  if (seat === undefined) throw new ActRefusal("Only somebody who signed in can be bound to a record here.");
  return store.apply({ name: BIND_PERSON, args: { record, seat } }, options);
}
