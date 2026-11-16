/**
 * `@graview/core/binding` — A MEMBER WHO JOINS IS THE PERSON ENTERED FOR
 * THEM (Roadmap f-invite-binds-existing-person). An organizer enters Bud
 * before he joins — his household, his lists — and when his account accepts
 * an invitation, the host binds it to that record rather than making a
 * second Bud (`bindPerson`). A host's, on no page: loading it teaches every
 * store the `bind-person` act, that the host alone runs it, and when it may be taken back
 * (`BINDING`). Resolving a seat to its record is the main entry's.
 */
import { BIND_PERSON, BINDING, takesBindingBack } from "./binding-served.js";
import { PERSON_SEAT, personSeatOf } from "./graph/archived.js";
import { isUnset, UNSET } from "./graph/primitives.js";
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


/** A seat as a binding names it: an account's id, or an account's id and a profile's (`seatPersonOf`). */
const SEAT = /^[^~]+(~[\w-]{1,64})?$/;

type Held = Store<AnySchema>;

const NOBODY_BINDABLE = "Nobody here can be bound to a record: this app says of no kind that it is its people.";
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

/**
 * Why this record may not be anybody's (else `seat`'s) here, in the sentence
 * a binding gives: not the people, or somebody's already — bound to another
 * seat, a profile's own person, or a record somebody else was ever done as
 * or whose binding ended.
 */
function recordRefusal(store: Held, node: Node, seat?: string): string | undefined {
  const schema = store.schema;
  const people = schema.definitions.find((definition) => definition.people);
  const noun = people ? nounOf(people, people.kind) : "person";
  const named = labelOf(schema.tryDefinition(node.kind), node as never);
  const definition = schema.tryDefinition(node.kind) as { readonly people?: boolean; readonly noun?: string } | undefined;
  if (!definition?.people) return `${named} is ${withArticle(nounOf(definition, node.kind))}, not ${withArticle(noun)}: only ${withArticle(noun)} can be someone's record here.`;
  const bound = personSeatOf(node);
  if ((bound !== undefined && bound !== seat) || doneAs(store).some((one) => one.record === node.id && one.seat !== seat) || [...endedIn(store)].some(([one, was]) => was === node.id && one !== seat)) return `${named} is already someone else's record here.`;
  return undefined;
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
    input: z.object({ record: z.string().check(z.minLength(1)), seat: z.string().check(z.regex(SEAT)), end: z.optional(z.literal(true)) }) as never,
    describe: (args, graph) => {
      const node = graph.getNode(String((args as { record: unknown }).record)) as Node | undefined;
      const who = node ? named(node) : `the ${noun}`;
      return (args as { end?: unknown }).end === true ? `End ${who}'s binding to the account that joined` : `Bind ${who} to the account that joined`;
    },
    apply(ctx, args) {
      const { record, seat, end } = args as { record: string; seat: string; end?: true };
      const full = store.graph;
      const node = full.getNode(record) as Node | undefined;
      if (!node || !ctx.graph.getNode(record)) throw new MissingRecordError(record, NO_SUCH_RECORD.change);
      /*
       * ENDING A BINDING (Roadmap f-unbind-person): the seat is this record no
       * more, and what it did as them stays theirs — the log says who it was
       * then, and nobody else is bound here after (below).
       */
      if (end === true) {
        if (personSeatOf(node) !== seat) throw new ActRefusal(`That account is not ${named(node)} here.`);
        ctx.patchNode(record, { [PERSON_SEAT]: UNSET });
        return;
      }
      const bound = personSeatOf(node);
      // Bound to this seat already, or this seat's own record: nothing to do.
      if ((schema.tryDefinition(node.kind) as { readonly people?: boolean } | undefined)?.people && (bound === seat || (bound === undefined && record === seat))) return;
      const refused = recordRefusal(store, node, seat);
      if (refused) throw new ActRefusal(refused);
      const ended = endedIn(store);
      const other = full.personBoundTo(seat);
      const theirs = other === undefined ? undefined : (full.getNode(other) as Node | undefined);
      if (theirs) throw new ActRefusal(`That account is already ${named(theirs)} here.`);
      // A binding ended stays that person's: neither the seat nor the record is bound to another after it.
      const was = ended.get(seat) ?? doneAs(store).find((one) => one.seat === seat && one.record !== seat && one.record !== record)?.record;
      const before = was === undefined ? undefined : (full.getNode(was) as Node | undefined);
      if (was !== undefined && was !== record) throw new ActRefusal(`That account was ${before ? named(before) : `another ${noun}`} here: bind it to them again.`);
      const own = full.getNode(seat) as Node | undefined;
      if (own && (schema.tryDefinition(own.kind) as { readonly people?: boolean } | undefined)?.people) throw new ActRefusal(`That account already has its own record here, ${named(own)}: merge the two instead.`);
      ctx.patchNode(record, { [PERSON_SEAT]: seat });
    },
  } as AnyMutationDefinition;
}

const refused = (call: MutationCall, message: string, wouldNeed: readonly string[] = []): { readonly ok: false; readonly refusal: Refusal } => ({ ok: false, refusal: { mutation: call.name, wouldNeed: [...wouldNeed], message } });

/**
 * WHO MAY BIND A SEAT TO A PERSON: the host's system seat, acting for the
 * app's owner when an invitation is accepted — and nobody else. No grant
 * gives it, whatever a policy names (`graview check` refuses one that does,
 * `grant-gives-binding`): a role that could bind could bind any seat,
 * itself among them. Never a seat no one person holds, a visitor, one
 * signed out, an agent or anybody acting for another.
 */
function judgedBinding(_store: object, call: MutationCall, principal: Principal): { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal } {
  if (signedOutSeat(principal)) return refused(call, "Sign in to bind an account to a record here.");
  // A person binds, never an agent nor anybody acting for one: what an agent reads in a record could steer it to.
  if (principal.kind === "agent" || principal.onBehalfOf !== undefined) return refused(call, "An agent cannot bind an account to a record here: a person who runs this app does that.");
  /*
   * The host itself, and nothing else that writes as the system: never the
   * app's own actor or a workflow (`automated`), whose suggestion a vote
   * could carry in, nor another app's change arriving here.
   */
  if (isSystem(principal)) {
    if (principal.automated === true || /^(workflow|app|template):/.test(principal.id ?? "")) return refused(call, "Not permitted: only the host binds an account to a record here, as an invitation is accepted.");
    return { ok: true };
  }
  const seat = call.args["seat"];
  const record = call.args["record"];
  const account = actingAs(principal).id;
  if ((typeof seat === "string" && account !== undefined && (seat === account || seat.startsWith(`${account}~`))) || (typeof record === "string" && ownsId(principal, record))) {
    return refused(call, "You cannot bind yourself to a record here: only the host does that, as an invitation is accepted.");
  }
  return refused(call, "Not permitted: only the host binds an account to a record here, as an invitation is accepted.");
}

/**
 * Why an op of a binding may not be taken back (`root` the change its undo
 * chain begins with). Taking a seat off its record is refused once the seat
 * has acted as the record since, which would hand what it did to somebody
 * else, unless it is an ending put back, ended again. Putting a seat back
 * on its record is refused where either is somebody else's by then.
 */
function bindingKept(store: object, op: Operation, root: Operation): string | undefined {
  const held = store as Held;
  const args = (root.mutation?.args ?? {}) as { readonly record?: unknown; readonly seat?: unknown; readonly end?: unknown };
  if (typeof args.record !== "string" || typeof args.seat !== "string") return undefined;
  const record = args.record;
  const seat = args.seat;
  const node = held.graph.getNode(record) as Node | undefined;
  const seated = op.primitives.some((one) => one.op === "patch-node" && one.id === record && typeof one.after[PERSON_SEAT] === "string" && !isUnset(one.after[PERSON_SEAT]));
  if (!seated) {
    const bound = held.graph.personBoundTo(seat);
    const own = held.graph.getNode(seat) as Node | undefined;
    const ownPerson = own !== undefined && (held.schema.tryDefinition(own.kind) as { readonly people?: boolean } | undefined)?.people === true;
    return (bound !== undefined && bound !== record) || ownPerson || (node !== undefined && personSeatOf(node) !== undefined && personSeatOf(node) !== seat) ? "This cannot be taken back: that account, or this record, is someone else's here now." : undefined;
  }
  if (args.end === true) return undefined;
  if (!doneAs(held).some((one) => one.seq > op.seq && one.seat === seat && one.record === record)) return undefined;
  const name = node ? labelOf(held.schema.tryDefinition(node.kind), node as never) : "They";
  return `${name} has acted here: unbinding would hand what they did to someone else.`;
}

/**
 * THE BINDINGS ENDED, AND NOT TAKEN BACK (Roadmap f-unbind-person): each
 * seat whose binding ended, and the record it was. What it did is said as
 * that person still (`everBound`), so neither is bound to another.
 */
function endedIn(store: Held): ReadonlyMap<string, string> {
  const ended = new Map<string, string>();
  const get = (id: string) => store.log.get(id);
  for (const op of store.log.all()) {
    for (const primitive of op.primitives) {
      if (primitive.op !== "patch-node" || !Object.hasOwn(primitive.after, PERSON_SEAT)) continue;
      const seat = primitive.after[PERSON_SEAT];
      const was = primitive.before[PERSON_SEAT];
      if (typeof seat === "string" && !isUnset(seat)) ended.delete(seat);
      else if (typeof was === "string" && !isUnset(was) && !takesBindingBack(op, get)) ended.set(was, primitive.id);
    }
  }
  return ended;
}

BINDING.act = (store) => bindPersonMutation(store as Held);
BINDING.judged = judgedBinding;
BINDING.undo = bindingKept;

/**
 * BIND A JOINING ACCOUNT TO THE PERSON ENTERED FOR IT: what a host calls as
 * an invitation is accepted. `joining` is the seat as the host will serve it
 * (its account, and the profile it acts as, if any); `record` the person's
 * id. The `bind-person` act, applied as `options.author` — the host's system
 * seat, acting for the app's owner; no grant gives it — and so blamed on it and
 * undone like any act, until the seat has acted as the record. Refused
 * (`ActRefusal`, or `PermissionDeniedError` for who may) in a sentence a
 * host can show.
 */
export function bindPerson<S extends AnySchema>(store: Store<S>, joining: Principal, record: string, options: ApplyOptions = {}): ApplyResult<S> {
  if (!store.schema.definitions.some((definition) => definition.people)) throw new ActRefusal(NOBODY_BINDABLE);
  const seat = bindable(withValidProfile(joining)) ? seatPersonOf(withValidProfile(joining)) : undefined;
  if (seat === undefined) throw new ActRefusal("Only somebody who signed in can be bound to a record here.");
  return store.apply({ name: BIND_PERSON, args: { record, seat } }, options);
}

/**
 * END A SEAT'S BINDING (Roadmap f-unbind-person): what a host calls when a
 * member leaves. `leaving` is the seat as the host served it; the record it
 * is bound to is its record no more — not its `$me`, its sight or its own
 * acts — while what it did there is still said as that person, and nobody
 * else is bound to the record after it. The `bind-person` act, ending, run
 * as `options.author`, the host's system seat, as a binding is; undone like
 * any act, which binds the seat again. Refused (`ActRefusal`, or
 * `PermissionDeniedError` for who may) in a sentence a host can show.
 */
export function unbindPerson<S extends AnySchema>(store: Store<S>, leaving: Principal, options: ApplyOptions = {}): ApplyResult<S> {
  const seat = bindable(withValidProfile(leaving)) ? seatPersonOf(withValidProfile(leaving)) : undefined;
  const record = seat === undefined ? undefined : store.graph.personBoundTo(seat);
  if (seat === undefined || record === undefined) throw new ActRefusal("That account is nobody's record here.");
  return store.apply({ name: BIND_PERSON, args: { record, seat, end: true } }, options);
}

/**
 * WHETHER A RECORD MAY BE BOUND, ASKED BEFORE THERE IS A SEAT TO BIND
 * (Roadmap f-binding-dry-run-and-seat-rules): what a host asks as it offers
 * an invitation for a person already entered. `{ ok: true }` where the
 * record may be someone's here, else the sentence `bindPerson` would refuse
 * it with. Nothing is applied or rehearsed; what depends on the account that
 * joins — one already somebody here — is asked by `bindPerson` itself.
 */
export function mayBind<S extends AnySchema>(store: Store<S>, record: string): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  const held = store as unknown as Held;
  if (!held.schema.definitions.some((definition) => definition.people)) return { ok: false, reason: NOBODY_BINDABLE };
  const node = held.graph.getNode(record) as Node | undefined;
  if (!node) return { ok: false, reason: NO_SUCH_RECORD.change };
  const refused = recordRefusal(held, node);
  return refused ? { ok: false, reason: refused } : { ok: true };
}
