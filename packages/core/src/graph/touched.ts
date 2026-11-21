import { writesOf, type Primitive } from "./primitives.js";
import type { AnyGraphNode } from "./types.js";

/**
 * WHEN A RECORD WAS MADE AND LAST TOUCHED, AND BY WHOM (Graview HQ
 * feature:f-record-last-touched). Every record keeps four values the
 * framework writes and no act may: `createdAt` and `createdBy`, set by the
 * op that adds it, and `updatedAt` and `updatedBy`, set by every op that
 * touches it — a field, a file, a link at either end, an import, a tidying,
 * an undo. They are the record's own, kept on it under these names, so they
 * go wherever it goes (the log's checkpoints, a snapshot, the archive, the
 * wire) and are read wherever a field is: a view's nodes, a seat's view
 * (judged by sight like any field), a list's sort and filter, a template,
 * a rule. A kind may not declare a field of one of these names
 * (`graview check`, `touched-field-taken`).
 *
 * Written by the fold, not by primitives: each op, as it lands, stamps the
 * records it wrote with its own time and author (`touchedBy`). An op's
 * primitives never carry them, so an undo puts back what an act changed and
 * then stamps its own time, and two people editing two fields of one
 * record never conflict over a stamp. The fingerprint of a graph
 * (`snapshotHash`) leaves them out, so a store from before them folds to
 * the same hash.
 *
 * `…At` is an ISO instant. `…By` is who acted, delegation read through,
 * as `$me` says them: the record of the people kind the seat is bound to,
 * where it is bound when the change lands; else the account's id — with a
 * profile, the account's and the profile's, `~` between; a seat with no
 * id is its kind ("system", "rule").
 */
export const CREATED_AT = "createdAt";
export const CREATED_BY = "createdBy";
export const UPDATED_AT = "updatedAt";
export const UPDATED_BY = "updatedBy";

/** The four, in the order they are said. */
export const TOUCHED_FIELDS: readonly string[] = [CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY];
const TOUCHED: ReadonlySet<string> = new Set(TOUCHED_FIELDS);

/** Whether a key is one of the four the framework keeps. */
export const isTouchedField = (key: string): boolean => TOUCHED.has(key);

/** The two that are moments, which a list sorts, filters and groups by as dates. */
export const TOUCHED_MOMENTS: readonly string[] = [CREATED_AT, UPDATED_AT];

/** What an op that touches records says of them: when, and who — nobody, for an op a seat is served withheld. */
export interface Touch {
  readonly at: string;
  readonly by?: string;
}

/** An author as `touchedBy` reads one: the op's own, delegation and profile included. */
interface TouchingAuthor {
  readonly kind: string;
  readonly id?: string;
  readonly profile?: { readonly id: string };
  readonly onBehalfOf?: TouchingAuthor;
}

/** Who an op's author is, as `createdBy` and `updatedBy` keep it. */
export function toucherOf(author: TouchingAuthor): string {
  const person = author.onBehalfOf ?? author;
  const account = person.id ?? author.id;
  if (account === undefined || account.includes("~")) return author.kind;
  const profile = person.kind === "human" ? person.profile?.id : undefined;
  return profile ? `${account}~${profile}` : account;
}

/** The touch an op makes: its time, and its author as kept — none, for an op served withheld, whose author is not the seat's to be told. */
export function touchOf(op: { readonly at: string; readonly author: TouchingAuthor; readonly withheld?: true }): Touch {
  return op.withheld ? { at: op.at } : { at: op.at, by: toucherOf(op.author) };
}

/** What a record says of when it was made and last touched: only what it holds, never a time made up. */
export interface Touched {
  readonly createdAt?: string;
  readonly createdBy?: string;
  readonly updatedAt?: string;
  readonly updatedBy?: string;
}

/** The four of a record, as it holds them. */
export function touchedOf(node: unknown): Touched {
  const record = (node ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of TOUCHED_FIELDS) if (typeof record[key] === "string") out[key] = record[key] as string;
  return out as Touched;
}

/** A record without the four: what its kind's declaration judges. */
export function untouched<N extends object>(node: N): N {
  const record = node as Record<string, unknown>;
  if (!TOUCHED_FIELDS.some((key) => Object.hasOwn(record, key))) return node;
  const out = { ...record };
  for (const key of TOUCHED_FIELDS) delete out[key];
  return out as N;
}

/**
 * A record stamped by a touch. `made`: the op added it as a write, and its
 * making is this touch's; otherwise what it says of its making stays as it
 * holds it — a record an undo put back keeps when it was first made, and a
 * record from before these were kept says none rather than a time made up.
 */
export function stamped<N extends AnyGraphNode>(node: N, touch: Touch, made: boolean): N {
  const record = node as Record<string, unknown>;
  if (!made && record[UPDATED_AT] === touch.at && record[UPDATED_BY] === touch.by) return node;
  const out: Record<string, unknown> = { ...node, ...(made ? { [CREATED_AT]: touch.at } : {}), [UPDATED_AT]: touch.at };
  for (const [key, made_] of [[CREATED_BY, made], [UPDATED_BY, true]] as const) {
    if (!made_) continue;
    if (touch.by === undefined) delete out[key];
    else out[key] = touch.by;
  }
  return out as N;
}

/**
 * THE RECORDS AN OP MAKES: each it adds with no word of when it was made.
 * One it adds saying so — a record an undo puts back, as it was removed —
 * keeps that; one added bare, by an act, or by an undo whose payload never
 * held them (a record from before they were kept, an act's add put back),
 * is made by this op. What an op makes is its own, so every copy that
 * folds it says the same.
 */
export function madeIn(op: { readonly primitives: readonly Primitive[] }): Set<string> {
  const made = new Set<string>();
  for (const primitive of op.primitives) if (primitive.op === "add-node" && typeof (primitive.node as Record<string, unknown>)[CREATED_AT] !== "string") made.add(primitive.node.id);
  return made;
}

/** An op as `foldedTouches` reads one. */
interface TouchingOp {
  readonly primitives: readonly Primitive[];
  readonly at: string;
  readonly author: TouchingAuthor;
  readonly undoes?: string;
  readonly withheld?: true;
}

/**
 * WHAT FOLDING `ops` ONTO `base` SAYS OF EACH RECORD'S FOUR, as
 * `Graph.touch` says them, without folding anything else: the records
 * `base` holds and the ops add, each with what it was last stamped, up to
 * the op before seq `until`. What a seat is served is worked out so (`seatView`),
 * so a copy that folds the log it is served says what it is served.
 */
export function foldedTouches(
  base: readonly AnyGraphNode[],
  ops: readonly (TouchingOp & { readonly seq: number })[],
  until = Infinity,
  onto?: Map<string, Touched>,
  /** The record a seat is bound to, as `Graph.touch` reads it: the person, never the account. */
  bound: (seat: string) => string | undefined = () => undefined,
): Map<string, Touched> {
  // Onto what an earlier read folded, where the log only grew since: changed in place.
  const held = onto ?? new Map<string, Touched>();
  for (const node of base) held.set(node.id, touchedOf(node));
  for (const op of ops) {
    if (op.seq >= until) break;
    for (const primitive of op.primitives) {
      if (primitive.op === "remove-node") held.delete(primitive.node.id);
      else if (primitive.op === "add-node") held.set(primitive.node.id, touchedOf(primitive.node));
    }
    const touch = touchOf(op);
    const at = touch.at;
    const by = touch.by === undefined ? undefined : (bound(touch.by) ?? touch.by);
    const whom = by === undefined ? {} : { [UPDATED_BY]: by };
    const makes = madeIn(op);
    for (const primitive of op.primitives) {
      for (const id of writesOf(primitive)) {
        const was = held.get(id);
        if (!was) continue;
        // Made by this op: all four are its own; otherwise when it was made stays as it was.
        const made = primitive.op === "add-node" && makes.has(id);
        const making = made ? { [CREATED_AT]: at, ...(by === undefined ? {} : { [CREATED_BY]: by }) } : was.createdAt === undefined ? {} : { [CREATED_AT]: was.createdAt, ...(was.createdBy === undefined ? {} : { [CREATED_BY]: was.createdBy }) };
        held.set(id, { ...making, [UPDATED_AT]: at, ...whom } as Touched);
      }
    }
  }
  return held;
}

/** A record with its four as `told` says them, the ones it says nothing of taken off. */
export function withTouches<N extends object>(node: N, told: Touched | undefined): N {
  const out = untouched(node) as Record<string, unknown>;
  return (told && Object.keys(told).length > 0 ? { ...out, ...told } : out) as N;
}

/** A primitive without the four in what it carries: what a seat is served, so it is told them by its own log's ops alone. */
export function untouchedPrimitive<P extends { readonly op: string }>(primitive: P): P {
  const one = primitive as unknown as { op: string; node?: object; before?: Record<string, unknown>; after?: Record<string, unknown> };
  if ((one.op === "add-node" || one.op === "remove-node") && one.node) return untouched(one.node) === one.node ? primitive : ({ ...one, node: untouched(one.node) } as unknown as P);
  if (one.op === "patch-node" && one.before && one.after && TOUCHED_FIELDS.some((key) => Object.hasOwn(one.before!, key) || Object.hasOwn(one.after!, key))) {
    const without = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).filter(([key]) => !TOUCHED.has(key)));
    return { ...one, before: without(one.before), after: without(one.after) } as unknown as P;
  }
  return primitive;
}
