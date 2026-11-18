/**
 * `@graview/core/binding` — A MEMBER WHO JOINS IS THE PERSON ENTERED FOR
 * THEM (Roadmap f-invite-binds-existing-person). An organizer enters Bud
 * before he joins — his household, his lists — and when his account accepts
 * an invitation, the host binds it to that record rather than making a
 * second Bud (`bindPerson`). Bound to the wrong record, he is moved to the
 * right one with what he did there (`rebindPerson`); joined with a record
 * of his own, it is merged into the one entered for him (`mergePerson`). A
 * host's, on no page: loading it teaches every store the `bind-person`,
 * `rebind-person` and `bind-own-record` acts, that the host's own seat
 * (`hostSeat`) alone runs them, and when they may be taken back
 * (`BINDING`). Resolving a seat to its record is the main entry's.
 */
import { BIND_PERSON, BINDING, boundAtHorizon, isBindingAct, BIND_OWN_RECORD, REBIND_PERSON, takesBindingBack } from "./binding-served.js";
import { ARCHIVED, isArchived, PERSON_SEAT, personSeatOf } from "./graph/archived.js";
import { edgeId, type GraphEdge } from "./graph/types.js";
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
 * EACH SEAT ONE OP MOVED FROM ONE RECORD TO ANOTHER (Roadmap
 * f-rebind-after-acting): the first record the op touched the seat's mark
 * on, and the last — a `rebind-person`, its undo, or its redo. A move of a
 * binding that had ended puts the mark on each record and takes it off
 * again, so it reads the same way and leaves both nobody's. A merge
 * (Roadmap f-merge-own-record-into-person) puts the seat on a record and
 * sets aside the seat's own record, whose id is the seat's: a move from it;
 * taken back, a move to it. The op is the record of the move; nothing
 * before it in the log is rewritten.
 */
function movesIn(op: Operation): readonly { readonly seat: string; readonly from: string; readonly to: string }[] {
  const touched = new Map<string, { records: string[]; on: boolean }>();
  const setAside = new Set<string>();
  const broughtBack = new Set<string>();
  for (const primitive of op.primitives) {
    if (primitive.op !== "patch-node") continue;
    if (Object.hasOwn(primitive.after, ARCHIVED)) (primitive.after[ARCHIVED] === true ? setAside : broughtBack).add(primitive.id);
    if (!Object.hasOwn(primitive.after, PERSON_SEAT)) continue;
    const now = primitive.after[PERSON_SEAT];
    const was = primitive.before[PERSON_SEAT];
    const on = typeof now === "string" && !isUnset(now);
    const seat = on ? (now as string) : typeof was === "string" && !isUnset(was) ? was : undefined;
    if (seat === undefined) continue;
    const one = touched.get(seat) ?? { records: [], on };
    if (one.records.at(-1) !== primitive.id) one.records.push(primitive.id);
    one.on = on;
    touched.set(seat, one);
  }
  return [...touched].flatMap(([seat, { records, on }]) => {
    if (records.length > 1) return records[0] !== records.at(-1) ? [{ seat, from: records[0]!, to: records.at(-1)! }] : [];
    if (on && setAside.has(seat)) return [{ seat, from: seat, to: records[0]! }];
    if (!on && broughtBack.has(seat)) return [{ seat, from: records[0]!, to: seat }];
    return [];
  });
}

/**
 * WHO WAS DONE AS WHICH RECORD, read from the log: each op's author as the
 * seat it was, and the record that seat was bound to then — followed through
 * every binding, its undo and a record put back — or the seat's own id where
 * it was bound to none. A binding's own op is the binder's, not the seat's.
 * A seat moved to another record takes what it did as the first with it
 * (`movesIn`), and a move taken back brings it back.
 */
function doneAs(store: Held): readonly { readonly seq: number; readonly seat: string; readonly record: string }[] {
  const bound = boundAtHorizon(store);
  let done: { seq: number; seat: string; record: string }[] = [];
  for (const op of store.log.all()) {
    const moves = movesIn(op);
    if (moves.length > 0) done = done.map((one) => {
      const move = moves.find((it) => it.seat === one.seat && it.from === one.record);
      return move ? { ...one, record: move.to } : one;
    });
    for (const primitive of op.primitives) {
      if (primitive.op === "add-node" && personSeatOf(primitive.node)) bound.set(primitive.node.id, personSeatOf(primitive.node)!);
      else if (primitive.op === "remove-node") bound.delete(primitive.node.id);
      else if (primitive.op === "patch-node" && Object.hasOwn(primitive.after, PERSON_SEAT)) {
        const seat = primitive.after[PERSON_SEAT];
        if (isUnset(seat) || typeof seat !== "string") bound.delete(primitive.id);
        else bound.set(primitive.id, seat);
      }
    }
    if (isBindingAct(op.mutation?.name) || (op.author.onBehalfOf ?? op.author).kind !== "human") continue;
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
  if (isArchived(node)) return `${named} is set aside: bring them back before they are someone's record here.`;
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
      if (own && (schema.tryDefinition(own.kind) as { readonly people?: boolean } | undefined)?.people) throw new ActRefusal(`That account already has its own record here, ${named(own)}: merge it into ${named(node)} instead.`);
      ctx.patchNode(record, { [PERSON_SEAT]: seat });
    },
  } as AnyMutationDefinition;
}

/**
 * The `rebind-person` act for a store, where a kind is its people (Roadmap
 * f-rebind-after-acting): the seat bound to `from` is `to`'s from now on,
 * `from` is nobody's again, and what the seat did as `from` is done as
 * `to` — read so from this op on (`doneAs`), with nothing before it
 * rewritten. One change, which undo takes back whole.
 */
function rebindPersonMutation(store: Held): AnyMutationDefinition | undefined {
  const schema = store.schema;
  const people = schema.definitions.find((definition) => definition.people);
  if (!people) return undefined;
  const noun = nounOf(people, people.kind);
  const named = (node: Node) => labelOf(schema.tryDefinition(node.kind), node as never);
  return {
    name: REBIND_PERSON,
    title: `Move an account to this ${noun}`,
    description: `The account bound to another ${noun} is this ${noun} from now on, and what it did as the other is done as this one; the other is nobody's again.`,
    subject: { kinds: [people.kind], arg: "to" },
    input: z.object({ seat: z.string().check(z.regex(SEAT)), from: z.string().check(z.minLength(1)), to: z.string().check(z.minLength(1)) }) as never,
    describe: (args, graph) => {
      const { from, to } = args as { from?: unknown; to?: unknown };
      const was = graph.getNode(String(from)) as Node | undefined;
      const now = graph.getNode(String(to)) as Node | undefined;
      return `Move the account from ${was ? named(was) : `one ${noun}`} to ${now ? named(now) : `another ${noun}`}`;
    },
    apply(ctx, args) {
      const { seat, from, to } = args as { seat: string; from: string; to: string };
      const full = store.graph;
      const was = full.getNode(from) as Node | undefined;
      const now = full.getNode(to) as Node | undefined;
      if (!was || !ctx.graph.getNode(from)) throw new MissingRecordError(from, NO_SUCH_RECORD.change);
      if (!now || !ctx.graph.getNode(to)) throw new MissingRecordError(to, NO_SUCH_RECORD.change);
      // Bound to `from` now, or bound to it last and ended since (Roadmap f-rebind-follow-ups).
      const bound = personSeatOf(was) === seat;
      if (!bound && !(full.personBoundTo(seat) === undefined && endedIn(store).get(seat) === from)) throw new ActRefusal(`That account is not ${named(was)} here.`);
      if (from === to) throw new ActRefusal(`That account is ${named(was)} here already.`);
      const refused = recordRefusal(store, now, seat);
      if (refused) throw new ActRefusal(refused);
      // The links its acts made as `from` where their call never named it (`$me`) go with it.
      const links = linksMadeAs(store, seat, from);
      if (bound) {
        ctx.patchNode(from, { [PERSON_SEAT]: UNSET });
        ctx.patchNode(to, { [PERSON_SEAT]: seat });
      } else {
        // An ended binding moved stays ended, on `to`: the mark put on each record and taken off again, so the op says both (`movesIn`).
        for (const id of [from, to]) {
          ctx.emit({ op: "patch-node", id, before: { [PERSON_SEAT]: UNSET }, after: { [PERSON_SEAT]: seat } });
          ctx.emit({ op: "patch-node", id, before: { [PERSON_SEAT]: seat }, after: { [PERSON_SEAT]: UNSET } });
        }
      }
      moveLinks(ctx, store.graph, links, from, to);
    },
  } as AnyMutationDefinition;
}

type Edges = { outEdges(id: string): readonly GraphEdge[]; inEdges(id: string): readonly GraphEdge[] };

/**
 * THE LINKS A SEAT'S ACTS MADE AS A RECORD (Roadmap f-rebind-follow-ups):
 * each link an act it did as `record` added at that record, where the act's
 * call never named the record — made through `$me` — and that is still
 * there. A link a call named was the call's to make, and stays.
 */
function linksMadeAs(store: Held, seat: string, record: string): readonly GraphEdge[] {
  const ops = new Map(store.log.all().map((op) => [op.seq, op]));
  const named = JSON.stringify(record);
  const found = new Map<string, GraphEdge>();
  for (const one of doneAs(store)) {
    if (one.seat !== seat || one.record !== record) continue;
    const op = ops.get(one.seq);
    if (!op?.mutation || (JSON.stringify(op.mutation.args) ?? "").includes(named)) continue;
    for (const primitive of op.primitives) {
      if (primitive.op !== "add-edge" || (primitive.edge.from !== record && primitive.edge.to !== record)) continue;
      const held = (store.graph as unknown as Edges).outEdges(primitive.edge.from).find((edge) => edgeId(edge) === edgeId(primitive.edge));
      if (held) found.set(edgeId(held), held);
    }
  }
  return [...found.values()];
}

/** Each link moved from one record to another in the act being made, as a merge moves them: never onto itself or onto one the record has. */
function moveLinks(ctx: { readonly graph: { getNode(id: string): unknown }; removeEdge(edge: GraphEdge): void; addEdge(edge: GraphEdge): void }, graph: Held["graph"], links: readonly GraphEdge[], from: string, to: string): void {
  const edges = graph as unknown as Edges;
  const has = new Set([...edges.outEdges(to), ...edges.inEdges(to)].map(edgeId));
  for (const edge of links) {
    ctx.graph.getNode(edge.from);
    ctx.graph.getNode(edge.to);
    ctx.removeEdge(edge);
    const next = { ...edge, from: edge.from === from ? to : edge.from, to: edge.to === from ? to : edge.to };
    if (next.from !== next.to && !has.has(edgeId(next))) {
      has.add(edgeId(next));
      ctx.addEdge(next);
    }
  }
}

/**
 * The `bind-own-record` act for a store, where a kind is its people (Roadmap
 * f-merge-own-record-into-person): a seat with a record of its own — the
 * record whose id is the seat's, made as it joined or first opened the app
 * — is bound to `record`, entered for it and nobody's, and its own record
 * is merged into `record`: its links moved there and it set aside. What
 * the seat did as its own record is done as `record` from this op on
 * (`doneAs`, `movesIn`). One change, which undo takes back whole.
 */
function mergePersonMutation(store: Held): AnyMutationDefinition | undefined {
  const schema = store.schema;
  const people = schema.definitions.find((definition) => definition.people);
  if (!people) return undefined;
  const noun = nounOf(people, people.kind);
  const named = (node: Node) => labelOf(schema.tryDefinition(node.kind), node as never);
  const isPerson = (node: Node | undefined) => (schema.tryDefinition(node?.kind ?? "") as { readonly people?: boolean } | undefined)?.people === true;
  return {
    name: BIND_OWN_RECORD,
    title: `Merge an account's own record into this ${noun}`,
    description: `The account that joined is this ${noun} from now on, what it did as its own record is done as them, and its own record's links move here; its own record is set aside.`,
    subject: { kinds: [people.kind], arg: "record" },
    input: z.object({ seat: z.string().check(z.regex(SEAT)), record: z.string().check(z.minLength(1)) }) as never,
    describe: (args, graph) => {
      const node = graph.getNode(String((args as { record?: unknown }).record)) as Node | undefined;
      return `Merge the account's own record into ${node ? named(node) : `the ${noun}`}`;
    },
    apply(ctx, args) {
      const { seat, record } = args as { seat: string; record: string };
      const full = store.graph;
      const own = full.getNode(seat) as Node | undefined;
      if (!own || !isPerson(own)) throw new ActRefusal(`That account has no record of its own here: bind it to the ${noun} entered for it instead.`);
      if (!ctx.graph.getNode(seat)) throw new MissingRecordError(seat, NO_SUCH_RECORD.change);
      const node = full.getNode(record) as Node | undefined;
      if (!node || !ctx.graph.getNode(record)) throw new MissingRecordError(record, NO_SUCH_RECORD.change);
      if (record === seat) throw new ActRefusal(`That account's own record is ${named(own)}: merge it into the ${noun} entered for it.`);
      const other = full.personBoundTo(seat);
      const theirs = other === undefined ? undefined : (full.getNode(other) as Node | undefined);
      if (other !== undefined && other !== seat) throw new ActRefusal(`That account is already ${theirs ? named(theirs) : `another ${noun}`} here.`);
      const ended = endedIn(store).get(seat);
      const was = ended === undefined ? undefined : (full.getNode(ended) as Node | undefined);
      if (ended !== undefined) throw new ActRefusal(`That account was ${was ? named(was) : `another ${noun}`} here: bind it to them again.`);
      if (isArchived(own)) throw new ActRefusal(`${named(own)} is set aside: bring them back before merging them.`);
      const refused = recordRefusal(store, node, seat);
      if (refused) throw new ActRefusal(refused);
      ctx.patchNode(record, { [PERSON_SEAT]: seat });
      ctx.mergeNode(seat, record);
    },
  } as AnyMutationDefinition;
}

const refused = (call: MutationCall, message: string, wouldNeed: readonly string[] = []): { readonly ok: false; readonly refusal: Refusal } => ({ ok: false, refusal: { mutation: call.name, wouldNeed: [...wouldNeed], message } });

/** What marks the host's own seat: carried by the object a host mints (`hostSeat`) and its copies in memory, and by nothing written as JSON — a record, the wire, a sync, a suggestion. */
const HOST = Symbol.for("@graview/core:host-seat");

/**
 * THE HOST'S OWN SEAT (Roadmap f-rebind-follow-ups): the system seat a host
 * binds, moves, merges and ends a person's binding as, and takes one back
 * as. Every other system seat is refused those: one a sync or another app
 * writes as, a migration, the app's own actor, a workflow, and one that is
 * only called what the host is. `id` and `name` say who it is in the log.
 */
export function hostSeat(seat: { readonly id?: string; readonly name?: string } = {}): Principal {
  return Object.freeze({ kind: "system" as const, ...(seat.id !== undefined ? { id: seat.id } : {}), ...(seat.name !== undefined ? { name: seat.name } : {}), [HOST]: true }) as Principal;
}

/** Whether a seat is the host's own (`hostSeat`), and not set to run unattended. */
const isHostSeat = (principal: Principal): boolean => isSystem(principal) && (principal as unknown as Record<symbol, unknown>)[HOST] === true && principal.automated !== true;

/**
 * WHO MAY BIND A SEAT TO A PERSON: the host's system seat, acting for the
 * app's owner when an invitation is accepted — and nobody else. No grant
 * gives it, whatever a policy names (`graview check` refuses one that does,
 * `grant-gives-binding`): a role that could bind could bind any seat,
 * itself among them. Never a seat no one person holds, a visitor, one
 * signed out, an agent or anybody acting for another.
 */
function judgedBinding(_store: object, call: MutationCall, principal: Principal): { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal } {
  const moving = call.name === REBIND_PERSON;
  const merging = call.name === BIND_OWN_RECORD;
  const doing = moving ? "move an account from one record to another" : merging ? "merge an account's own record into another" : "bind an account to a record";
  const hostOnly = moving
    ? "Not permitted: only the host moves an account from one record to another here."
    : merging
      ? "Not permitted: only the host merges an account's own record into another here."
      : "Not permitted: only the host binds an account to a record here, as an invitation is accepted.";
  if (signedOutSeat(principal)) return refused(call, `Sign in to ${doing} here.`);
  // A person binds, never an agent nor anybody acting for one: what an agent reads in a record could steer it to.
  if (principal.kind === "agent" || principal.onBehalfOf !== undefined) return refused(call, `An agent cannot ${doing} here: a person who runs this app does that.`);
  /*
   * The host's own seat (`hostSeat`), and nothing else that writes as the
   * system: never the app's own actor or a workflow (`automated`), whose
   * suggestion a vote could carry in, another app's change arriving here,
   * a sync, a migration, or a seat only called what the host is.
   */
  if (isSystem(principal)) return isHostSeat(principal) ? { ok: true } : refused(call, hostOnly);
  const seat = call.args["seat"];
  const records = [call.args["record"], call.args["from"], call.args["to"]];
  const account = actingAs(principal).id;
  if ((typeof seat === "string" && account !== undefined && (seat === account || seat.startsWith(`${account}~`))) || records.some((record) => typeof record === "string" && ownsId(principal, record))) {
    return refused(call, moving ? "You cannot move yourself to another record here: only the host does that." : merging ? "You cannot merge your own record here: only the host does that." : "You cannot bind yourself to a record here: only the host does that, as an invitation is accepted.");
  }
  return refused(call, hostOnly);
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
  if (root.mutation?.name === REBIND_PERSON || root.mutation?.name === BIND_OWN_RECORD) return moveKept(held, op, root.mutation.name === BIND_OWN_RECORD ? "the merge" : "the move");
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
    if ((bound !== undefined && bound !== record) || ownPerson || (node !== undefined && personSeatOf(node) !== undefined && personSeatOf(node) !== seat)) return "This cannot be taken back: that account, or this record, is someone else's here now.";
    return node !== undefined && isArchived(node) ? setAside(held, node) : undefined;
  }
  if (args.end === true) return undefined;
  if (!doneAs(held).some((one) => one.seq > op.seq && one.seat === seat && one.record === record)) return undefined;
  const name = node ? labelOf(held.schema.tryDefinition(node.kind), node as never) : "They";
  return `${name} has acted here: unbinding would hand what they did to someone else.`;
}

/** Why a seat is not put back on a record set aside since: it is brought back first. */
const setAside = (store: Held, node: Node): string => `This cannot be taken back: ${labelOf(store.schema.tryDefinition(node.kind), node as never)} is set aside. Bring them back first.`;

/**
 * Why a move (Roadmap f-rebind-after-acting) may not be taken back, or put
 * back: the record it would put the seat on again is somebody else's by
 * then — bound to another seat, or one another seat was done as or whose
 * binding ended.
 */
function moveKept(store: Held, op: Operation, what: string): string | undefined {
  for (const { seat, from, to } of movesIn(op)) {
    // Taking it back takes the seat off the record it moved to: refused once the seat has acted as that record since, as an unbinding is.
    if (doneAs(store).some((one) => one.seq > op.seq && one.seat === seat && one.record === to)) {
      const moved = store.graph.getNode(to) as Node | undefined;
      const name = moved ? labelOf(store.schema.tryDefinition(moved.kind), moved as never) : "They";
      return `${name} has acted here: undoing ${what} would hand what they did to someone else.`;
    }
    // Taking this op back puts the seat on the record it took it off.
    const node = store.graph.getNode(from) as Node | undefined;
    if (!node) return "This cannot be taken back: the record was removed since.";
    // A merge set the own record aside itself, and taking it back brings it back.
    const setAsideHere = op.primitives.some((one) => one.op === "patch-node" && one.id === from && one.after[ARCHIVED] === true);
    if (isArchived(node) && !setAsideHere) return setAside(store, node);
    const bound = personSeatOf(node);
    if ((bound !== undefined && bound !== seat) || doneAs(store).some((one) => one.record === from && one.seat !== seat) || [...endedIn(store)].some(([one, was]) => was === from && one !== seat)) {
      return "This cannot be taken back: that record is someone else's here now.";
    }
  }
  return undefined;
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
    const marks = op.primitives.flatMap((primitive) => (primitive.op === "patch-node" && Object.hasOwn(primitive.after, PERSON_SEAT) ? [primitive] : []));
    marks.forEach((primitive, at) => {
      const seat = primitive.after[PERSON_SEAT];
      const was = primitive.before[PERSON_SEAT];
      if (typeof seat === "string" && !isUnset(seat)) ended.delete(seat);
      // A seat put on another record later in the same op was moved, which ends nothing (Roadmap f-rebind-after-acting): the record it left is nobody's again.
      else if (typeof was === "string" && !isUnset(was) && !marks.slice(at + 1).some((next) => next.after[PERSON_SEAT] === was) && !takesBindingBack(op, get)) ended.set(was, primitive.id);
    });
  }
  return ended;
}

BINDING.act = (store, name) => (name === REBIND_PERSON ? rebindPersonMutation(store as Held) : name === BIND_OWN_RECORD ? mergePersonMutation(store as Held) : bindPersonMutation(store as Held));
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
 * MOVE A PERSON BOUND TO THE WRONG RECORD, AND WHAT THEY DID, TO THE RIGHT
 * ONE (Roadmap f-rebind-after-acting): what a host calls when an owner says
 * the account that joined is somebody else entered here. `person` is the
 * seat as the host serves it; `record` the right record, of the people and
 * nobody's. The seat is `record` from now on, the record it was bound to is
 * nobody's again and may be bound to somebody else, and every act the seat
 * did as that record is said as `record`. The `rebind-person` act, run as
 * `options.author`, the host's system seat, as a binding is: one change,
 * which undo takes back whole — the seat, the records and what it did as
 * each. Refused (`ActRefusal`, or `PermissionDeniedError` for who may) in a
 * sentence a host can show.
 */
export function rebindPerson<S extends AnySchema>(store: Store<S>, person: Principal, record: string, options: ApplyOptions = {}): ApplyResult<S> {
  if (!store.schema.definitions.some((definition) => definition.people)) throw new ActRefusal(NOBODY_BINDABLE);
  const seat = bindable(withValidProfile(person)) ? seatPersonOf(withValidProfile(person)) : undefined;
  // Bound now, or bound last to a record whose binding ended (Roadmap f-rebind-follow-ups).
  const from = seat === undefined ? undefined : (store.graph.personBoundTo(seat) ?? endedIn(store as unknown as Held).get(seat));
  if (seat === undefined || from === undefined) throw new ActRefusal("That account is nobody's record here.");
  return store.apply({ name: REBIND_PERSON, args: { seat, from, to: record } }, options);
}

/**
 * MERGE A MEMBER'S OWN RECORD INTO THE PERSON ENTERED FOR THEM (Roadmap
 * f-merge-own-record-into-person): what a host calls where `bindPerson`
 * says the account that joined already has its own record. `person` is the
 * seat as the host serves it; `record` the person entered for it, of the
 * people and nobody's. The seat is `record` from now on, every act it did
 * as its own record is said as `record`, its own record's links move to
 * `record`, and its own record is set aside. The `bind-own-record` act, run as
 * `options.author`, the host's own seat (`hostSeat`), as a binding is: one
 * change, which undo takes back whole — until the person has acted as
 * `record`. Refused (`ActRefusal`, or `PermissionDeniedError` for who may)
 * in a sentence a host can show.
 */
export function mergePerson<S extends AnySchema>(store: Store<S>, person: Principal, record: string, options: ApplyOptions = {}): ApplyResult<S> {
  if (!store.schema.definitions.some((definition) => definition.people)) throw new ActRefusal(NOBODY_BINDABLE);
  const seat = bindable(withValidProfile(person)) ? seatPersonOf(withValidProfile(person)) : undefined;
  if (seat === undefined) throw new ActRefusal("Only somebody who signed in can be bound to a record here.");
  return store.apply({ name: BIND_OWN_RECORD, args: { seat, record } }, options);
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
