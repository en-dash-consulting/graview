import type { Primitive } from "./primitives.js";

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
  // A visitor answering a form is said by no token (Roadmap f-public-forms): what it makes says when, and not who.
  return op.withheld || op.author.kind === "visitor" ? { at: op.at } : { at: op.at, by: toucherOf(op.author) };
}

/** An instant as the framework writes one: what `createdAt` and `updatedAt` hold; a day or a word a kind kept under the name is not one. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Whether a value is a stamp the framework could have written: an instant for a time, a word for who. */
const isStamp = (key: string, value: unknown): boolean => typeof value === "string" && (key === CREATED_AT || key === UPDATED_AT ? INSTANT.test(value) : value.length > 0);

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
  // Who, only beside when: a word a kind kept under one of these names is not a stamp.
  for (const [at, by] of [[CREATED_AT, CREATED_BY], [UPDATED_AT, UPDATED_BY]] as const) {
    if (!isStamp(at, record[at])) continue;
    out[at] = record[at] as string;
    if (isStamp(by, record[by])) out[by] = record[by] as string;
  }
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
 * HOW AN OP SAYS EACH RECORD IT ADDS WAS MADE: `null`, made by this op;
 * otherwise when and by whom it was made, kept. A record an undo puts back
 * keeps what its payload says — the framework's own, as the record was
 * removed — and one an op removes and adds again (a kind renamed) keeps
 * what its removal carried. Any other add is made by its op, whatever its
 * payload says: no act, host or import writes them. What an op says is
 * its own, so every copy that folds it says the same.
 */
export function makingIn(op: { readonly primitives: readonly Primitive[]; readonly undoes?: string }): Map<string, Touched | null> {
  const removed = new Map<string, Touched>();
  for (const primitive of op.primitives) if (primitive.op === "remove-node") removed.set(primitive.node.id, madeOf(primitive.node));
  const making = new Map<string, Touched | null>();
  for (const primitive of op.primitives) {
    if (primitive.op !== "add-node") continue;
    const id = primitive.node.id;
    const said = madeOf(primitive.node);
    making.set(id, op.undoes !== undefined ? (said.createdAt !== undefined ? said : null) : (removed.get(id) ?? null));
  }
  return making;
}

/** When and by whom a record says it was made, alone. */
export const madeOf = (node: unknown): Touched => {
  const { createdAt, createdBy } = touchedOf(node);
  return createdAt === undefined ? {} : { createdAt, ...(createdBy !== undefined ? { createdBy } : {}) };
};

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
