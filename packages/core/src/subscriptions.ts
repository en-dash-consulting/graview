/**
 * `@graview/core/subscriptions` — NOTIFY ME WHEN X HAPPENS
 * (Roadmap f-notify-subscriptions).
 *
 * A person says once what they want to hear about — an act being run (any,
 * one by name, or one on one record), a record of a kind being added, a
 * record of a kind or one record changing, or a record coming to satisfy a
 * condition in the app's own expression language (`done == true`) — and
 * every committed batch is judged against it AS THAT PERSON MAY SEE IT. A
 * change to a record they cannot see is never a match, and what a match
 * says is only what their sight shows: the same lens the log is served
 * through (`seatLens`, `redact`), so a notification cannot tell anybody
 * more than their own Activity would.
 *
 * The framework stops at a hook. `matchSubscriptions` is pure: a store, the
 * ops one commit landed, the subscriptions — and back come the matches, at
 * most one per batch per subscription, each with what changed. A host calls
 * it where commits happen (`watchSubscriptions` over a store, `@graview/
 * ship`'s handler over a served one) and hands each match to its own
 * `onSubscriptionMatch` — Graview Cloud delivers it by email or push.
 *
 * WHERE SUBSCRIPTIONS ARE KEPT is a seam (`SubscriptionStore`: `list`,
 * `add`, `remove`), never the graph: a subscription is about the app, not
 * part of it, so it is not in the op log, not undone with a change, not in
 * an export and not visible to anybody else. `memorySubscriptions()` (on the main entry, `@graview/core`) keeps
 * them for one page or one process; `@graview/ship` keeps them in a file
 * beside the store (`fileSubscriptions`) and serves them on the wire; a host
 * keeps them wherever it keeps its users.
 *
 * Its own entry: a page that never subscribes carries none of it.
 */
import { parseExpr, type Expr } from "./document/expr/parse.js";
import { evaluateExpr, ExprEvalError, type KindShape } from "./document/expr/evaluate.js";
import { shapesOfSchema } from "./document/rules.js";
import type { Primitive } from "./graph/primitives.js";
import { isUnset, splicedRecord } from "./graph/primitives.js";
import type { AnyGraphNode, GraphReader } from "./graph/types.js";
import type { Author, Operation } from "./ops/types.js";
import { joinRuns, typedRun, typingSentence, typingWords, type TypedRun } from "./text/typing-words.js";
import { joinSpans } from "./text/typing-spans.js";
import type { TextSplice } from "./text/splice.js";
import { isWithheld, redact, WITHHELD_AUTHOR } from "./ops/withheld.js";
import { actingAs } from "./permissions/policy.js";
import type { Principal } from "./permissions/types.js";
import { actTitle, fieldWords, humanizeField, labelOf, nounOf, pluralOf, withArticle } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import { readsPublished } from "./publish.js";
import { seatLens, seenBy } from "./seen.js";
import type { Store } from "./store.js";
import { nameOfAuthor } from "./who.js";

// ── the shape ───────────────────────────────────────────────────────────────

// The shapes and the store a page keeps them in are the main entry's (`@graview/core`): a page holds them before it judges anything.
export type { MatchedRecord, OnSubscriptionMatch, Subscription, SubscriptionDraft, SubscriptionMatch, SubscriptionStore, SubscriptionWhen } from "./subscription-shape.js";
import type { MatchedRecord, OnSubscriptionMatch, Subscription, SubscriptionMatch, SubscriptionStore, SubscriptionWhen } from "./subscription-shape.js";

// ── what a subscription may say ────────────────────────────────────────────

/** What a subscription is judged against: the app's kinds, its acts, and the records there are. */
interface Declared {
  readonly schema: AnySchema;
  allMutations?(): readonly { readonly name: string; readonly title?: string }[];
  readonly graph?: { getNode(id: string): AnyGraphNode | undefined };
}

/**
 * WHETHER A SUBSCRIPTION CAN EVER BE TOLD ANYTHING: its kind is a kind of
 * the app, its act one of the app's acts, its record one the subscriber
 * sees (in `store`, which is the store as they see it), and its condition
 * an expression the rule language reads. Answers the sentence that says
 * what is wrong, or undefined.
 */
export function subscriptionProblem(store: Declared, when: SubscriptionWhen): string | undefined {
  const kinds = store.schema.kinds as readonly string[];
  const kind = "kind" in when ? when.kind : undefined;
  if (kind !== undefined && !kinds.includes(kind)) return `There is no kind "${kind}" in this app. Its kinds are: ${kinds.join(", ")}.`;
  if (when.on === "act" && when.act !== undefined && store.allMutations && !store.allMutations().some((act) => act.name === when.act)) {
    return `There is no act "${when.act}" in this app.`;
  }
  const record = "record" in when ? when.record : undefined;
  if (record !== undefined && store.graph && !store.graph.getNode(record)) return `No record "${record}" is here to be told about.`;
  if (record !== undefined && kind !== undefined && store.graph && store.graph.getNode(record)?.kind !== kind) return `“${record}” is not ${withArticle(kind)}.`;
  if (when.on === "changed" && when.kind === undefined && when.record === undefined) return "Say which kind, or which record, to be told about.";
  if (when.on === "reaches") {
    if (when.condition.trim() === "") return "Say what it should reach: a condition like done == true.";
    try {
      parseExpr(when.condition);
    } catch (error) {
      return `The condition does not read: ${error instanceof Error ? error.message : String(error)}.`;
    }
  }
  return undefined;
}

/** A record's name, from the store as a seat sees it, else its id. */
function nameIn(store: Declared, id: string): string {
  const node = store.graph?.getNode(id);
  return node ? labelOf(store.schema.tryDefinition(node.kind) as never, node) : id;
}

/** An act's own title, else its name said. */
function actWords(store: Declared, act: string): string {
  const declared = store.allMutations?.().find((one) => one.name === act);
  return declared ? actTitle(declared) : humanizeField(act);
}

/**
 * A SUBSCRIPTION IN WORDS: "When “Buy milk” changes", "When a task is
 * added", "When someone runs “Mark it done” on “Buy milk”", "When a task
 * reaches done == true". What the sheet, the list and a tool say it as.
 */
export function subscriptionWords(store: Declared, subscription: Pick<Subscription, "when" | "alsoMine">): string {
  const { when } = subscription;
  const someone = subscription.alsoMine ? "anyone" : "someone else";
  const noun = (kind: string) => nounOf(store.schema.tryDefinition(kind) as never, kind);
  const a = (kind: string) => {
    const word = noun(kind);
    return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
  };
  switch (when.on) {
    case "act": {
      const what = when.act !== undefined ? `“${actWords(store, when.act)}”` : "an act";
      return `When ${someone} runs ${what}${when.record !== undefined ? ` on “${nameIn(store, when.record)}”` : ""}`;
    }
    case "created":
      return `When ${someone} adds ${a(when.kind)}`;
    case "changed":
      return when.record !== undefined ? `When ${someone} changes “${nameIn(store, when.record)}”` : `When ${someone} changes any of the ${pluralOf(store.schema, when.kind!)}`;
    case "reaches":
      return `When ${when.record !== undefined ? `“${nameIn(store, when.record)}”` : a(when.kind)} reaches ${when.condition}${subscription.alsoMine ? "" : " (by someone else)"}`;
  }
}

// ── the matcher ─────────────────────────────────────────────────────────────

const SHAPES = new WeakMap<object, Map<string, KindShape>>();
const shapesFor = (schema: AnySchema): Map<string, KindShape> => {
  let shapes = SHAPES.get(schema);
  if (!shapes) SHAPES.set(schema, (shapes = shapesOfSchema(schema)));
  return shapes;
};

const PARSED = new Map<string, Expr | null>();
/** A condition parsed once; null when it does not read. */
function parsed(condition: string): Expr | null {
  let held = PARSED.get(condition);
  if (held === undefined) {
    try {
      held = parseExpr(condition);
    } catch {
      // A condition that does not read can never be reached: `subscriptionProblem` says so when it is made.
      held = null;
    }
    if (PARSED.size > 500) PARSED.clear();
    PARSED.set(condition, held);
  }
  return held;
}

/** The ids a primitive is about. */
function aboutOf(primitive: Primitive): readonly string[] {
  switch (primitive.op) {
    case "add-node":
    case "remove-node":
      return [primitive.node.id];
    case "patch-node":
    case "splice-text":
      return [primitive.id];
    case "add-edge":
    case "remove-edge":
      return [primitive.edge.from, primitive.edge.to];
  }
}

/** Whether a value names an id anywhere in it. */
function names(value: unknown, id: string): boolean {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some((one) => names(one, id));
  if (value !== null && typeof value === "object") return Object.values(value).some((one) => names(one, id));
  return false;
}

/**
 * ONE RECORD AS IT STOOD JUST AFTER `seq`: the graph's record now, with what
 * the log did to it after `seq` taken back — so a batch judged a moment
 * later (a host whose subscriptions answer a promise) is judged as it was.
 */
function nodeAfter(store: Store<AnySchema>, id: string, seq: number): AnyGraphNode | undefined {
  let node = store.graph.getNode(id) as AnyGraphNode | undefined;
  const ops = store.log.all();
  for (let at = ops.length - 1; at >= 0 && ops[at]!.seq > seq; at--) {
    const primitives = ops[at]!.primitives;
    for (let one = primitives.length - 1; one >= 0; one--) {
      const primitive = primitives[one]!;
      if (primitive.op === "add-node" && primitive.node.id === id) node = undefined;
      else if (primitive.op === "remove-node" && primitive.node.id === id) node = primitive.node;
      else if (primitive.op === "patch-node" && primitive.id === id && node) node = patched(node, primitive.before);
      else if (primitive.op === "splice-text" && primitive.id === id && node) node = splicedRecord(node, primitive, true);
    }
  }
  return node;
}

/** A record with these values written over it; a value that says "unset" takes the field off. */
function patched(node: AnyGraphNode, values: Readonly<Record<string, unknown>>): AnyGraphNode {
  const next: Record<string, unknown> = { ...node };
  for (const [field, value] of Object.entries(values)) {
    if (isUnset(value)) delete next[field];
    else next[field] = value;
  }
  return next as AnyGraphNode;
}

/** A record as it stood before a batch, from how it stood after and the batch's primitives on it; undefined when the batch made it. */
function nodeBefore(after: AnyGraphNode | undefined, id: string, primitives: readonly Primitive[]): AnyGraphNode | undefined {
  let node = after;
  for (let one = primitives.length - 1; one >= 0; one--) {
    const primitive = primitives[one]!;
    if (primitive.op === "add-node" && primitive.node.id === id) node = undefined;
    else if (primitive.op === "remove-node" && primitive.node.id === id) node = primitive.node;
    else if (primitive.op === "patch-node" && primitive.id === id && node) node = patched(node, primitive.before);
    else if (primitive.op === "splice-text" && primitive.id === id && node) node = splicedRecord(node, primitive, true);
  }
  return node;
}

/** Whether a condition holds of a record, read as the subscriber sees the app; a mistake or a missing record is false. */
function holds(condition: Expr, node: AnyGraphNode | undefined, graph: GraphReader, schema: AnySchema): boolean {
  if (!node) return false;
  try {
    return evaluateExpr(condition, { graph, subject: node, kinds: shapesFor(schema) }) === true;
  } catch (error) {
    if (error instanceof ExprEvalError) return false;
    throw error;
  }
}

/** A batch's ops, in the order they landed, grouped by batch id. */
function batchesIn(ops: readonly Operation[]): readonly (readonly Operation[])[] {
  const groups = new Map<string, Operation[]>();
  for (const op of ops) {
    const group = groups.get(op.batch);
    if (group) group.push(op);
    else groups.set(op.batch, [op]);
  }
  return [...groups.values()];
}

/**
 * WHAT A PUBLISH BRINGS A READER (FR-206): for each publish among `ops`,
 * the ops readers were not served until it — from the publish before it
 * that stands (or the start of the log) to the seq it publishes through —
 * in the order they landed. An op since taken back, and the undo that took
 * it back, both in what is published, are no change to a reader and are
 * left out; a publish that takes readers back brings nothing.
 */
function publishedBy(store: Store<AnySchema>, ops: readonly Operation[]): Operation[] {
  const { horizon } = store.log;
  const all = store.log.all();
  const out: Operation[] = [];
  let undone: ReadonlySet<string> | undefined;
  for (const publish of ops) {
    if (publish.publishedThrough === undefined) continue;
    undone ??= store.log.undoneIds();
    let was = horizon;
    for (let at = publish.seq - 1 - horizon; at >= 0; at--) {
      const one = all[at]!;
      if (one.publishedThrough !== undefined && !undone.has(one.id)) {
        was = one.publishedThrough;
        break;
      }
    }
    const brought = all.slice(Math.max(was, horizon) - horizon, publish.publishedThrough - horizon).filter((one) => one.publishedThrough === undefined);
    const ids = new Set(brought.map((one) => one.id));
    out.push(...brought.filter((one) => !undone!.has(one.id) && !(one.undoes !== undefined && ids.has(one.undoes))));
  }
  return out;
}

export interface MatchOptions {
  /** The app these ops are of: only subscriptions to it are judged. Unsaid, every subscription handed in is. */
  readonly app?: string;
  /** The host's directory of seats and people, so `byName` says a person's name. */
  readonly seats?: readonly { readonly label: string; readonly principal: Principal }[];
}

/**
 * WHICH SUBSCRIPTIONS A COMMIT MATCHES — pure, and judged as each
 * subscriber may see. `ops` are the ops one commit landed (what a store's
 * `subscribe` hands its listener); a commit of several batches is judged
 * batch by batch. For each subscription, the batch is read through its
 * subscriber's lens: an op that touched a record they cannot see is
 * withheld from them and matches nothing, a record they cannot see is never
 * in a match, and a field kept from them is neither said nor read by a
 * condition. A batch the subscriber made is no match unless `alsoMine`.
 * At most one match per batch per subscription.
 *
 * A reader of an app that publishes (FR-206) is served the app as it stood
 * at the last publish, so a batch is no news to them when it lands: it is
 * held until a publish brings it, and judged then, each batch the publish
 * brings as its own, against the app as they are served it now.
 */
export function matchSubscriptions<S extends AnySchema>(store: Store<S>, ops: readonly Operation[], subscriptions: readonly Subscription[], options: MatchOptions = {}): SubscriptionMatch[] {
  const any = store as unknown as Store<AnySchema>;
  const judged = subscriptions.filter((one) => options.app === undefined || one.app === options.app);
  if (judged.length === 0 || ops.length === 0) return [];
  const readers = judged.filter((one) => readsPublished(any.publishing, one.who));
  const working = readers.length === 0 ? judged : judged.filter((one) => !readers.includes(one));
  return [...matchBatches(any, batchesIn(ops), working, options), ...(readers.length === 0 ? [] : matchBatches(any, batchesIn(publishedBy(any, ops)), readers, options))];
}

/** Each batch judged for each subscription, as its subscriber is served the app now. */
function matchBatches(any: Store<AnySchema>, batches: readonly (readonly Operation[])[], judged: readonly Subscription[], options: MatchOptions): SubscriptionMatch[] {
  const matches: SubscriptionMatch[] = [];
  if (judged.length === 0) return matches;
  for (const batch of batches) {
    const first = batch[0]!;
    // A suggestion that waits changes nothing; a batch of no change is nobody's news.
    if (batch.every((op) => op.primitives.length === 0)) continue;
    const by = first.author;
    const maker = actingAs(by as Principal).id;
    for (const subscription of judged) {
      const who = subscription.who;
      if (!subscription.alsoMine && maker !== undefined && maker === who.id) continue;
      const lens = seatLens(any, who);
      /*
       * THE BATCH AS THE SUBSCRIBER IS SERVED IT. An op that touched what
       * they may not see is withheld from them: it says nothing of who or
       * why, and carries only the changes to records they may see (none, for
       * a record they cannot see at all) — so it can match what changed, and
       * never an act, and its maker is "Someone".
       */
      const served = redact(batch, lens);
      if (served.every((op) => op.primitives.length === 0)) continue;
      const seen = seenBy(any, who);
      const records = matchOne(any, seen, subscription, served);
      if (!records) continue;
      const last = batch.at(-1)!;
      const open = served.filter((op) => !isWithheld(op));
      const whole = open.length === served.length;
      const shownBy = whole ? by : WITHHELD_AUTHOR;
      const byName = whole ? nameOfAuthor(by, { graph: seen.graph as never, schema: any.schema, ...(options.seats ? { seats: options.seats } : {}) }) : (WITHHELD_AUTHOR.name ?? "Someone");
      // A run of typing is said as one: "Wrote in Kitchen's notes (+5 −1)", read over what the subscriber is served.
      const typed = whole ? typedRun(served) : undefined;
      const intent = typed ? typingWords(typed, any.schema, seen.graph) : ((whole ? first.batchIntent : undefined) ?? (open.length > 0 ? open.map((op) => op.intent).join("; ") : recordsSaid(records)));
      const match: SubscriptionMatch = {
        subscription,
        app: subscription.app,
        batch: first.batch,
        ops: served.map((op) => op.id),
        seq: last.seq,
        by: shownBy,
        byName,
        intent,
        acts: [...new Set(open.flatMap((op) => (op.mutation ? [op.mutation.name] : [])))],
        records,
        said: typed ? typingSentence(byName, typed, any.schema, seen.graph) : `${byName}: ${intent}`,
        at: last.at,
      };
      if (typed) typing.set(match, { run: typed, author: by, schema: any.schema, graph: seen.graph });
      matches.push(match);
    }
  }
  return matches;
}

/** The run of typing a match is, kept beside it: what holding it until the run ends reads. */
const typing = new WeakMap<SubscriptionMatch, { readonly run: TypedRun; readonly author: Author; readonly schema: AnySchema; readonly graph: { getNode(id: string): unknown } }>();

/**
 * HOW LONG A RUN OF TYPING IS HELD before it is told (Roadmap f-collab-text,
 * phase 5): a person writing a paragraph sends a run every word, and a
 * subscriber hears of it once, when they stop — this long after their last
 * keystroke into the field, or as soon as anything else matches the same
 * subscription.
 */
export const TYPING_QUIET_MS = 5_000;

/** What `holdTypingRuns` answers: tell it each match, and flush it when the watching stops. */
export interface HeldTyping {
  /** A match to tell: at once, unless it is a run of typing, which is held until the typist stops. */
  tell(match: SubscriptionMatch): void;
  /** Tells every run held, now. */
  flush(): void;
}

/**
 * TYPING TOLD AT THE END OF A RUN, NOT EVERY WORD (Roadmap f-collab-text,
 * phase 5). Between `matchSubscriptions` and a host's hook: a match that is
 * a run of typing is held, and the next run by the same person into the
 * same field for the same subscription joins it — one match, every batch
 * (`batches`), the counts added and the spans one after the other, said
 * again ("Ada wrote in Kitchen's notes (+42 −3)") — until `quietMs` pass
 * with no more, or another match for that subscription comes, which is
 * told after it so the order holds. Any other match is told at once.
 * `watchSubscriptions` and `@graview/ship`'s handler both hold through it.
 */
export function holdTypingRuns(hook: (match: SubscriptionMatch) => void, options: { readonly quietMs?: number } = {}): HeldTyping {
  const quiet = options.quietMs ?? TYPING_QUIET_MS;
  const held = new Map<string, { match: SubscriptionMatch; timer: ReturnType<typeof setTimeout> | undefined }>();
  const keyOf = (match: SubscriptionMatch, run: TypedRun, author: Author) => JSON.stringify([match.subscription.id, author.kind, author.id ?? "", author.name ?? "", run.node, run.field]);
  const release = (key: string) => {
    const one = held.get(key);
    if (!one) return;
    held.delete(key);
    if (one.timer) clearTimeout(one.timer);
    hook(one.match);
  };
  const releaseFor = (subscription: string, except?: string) => {
    for (const [key, one] of [...held]) if (one.match.subscription.id === subscription && key !== except) release(key);
  };
  return {
    tell(match) {
      const typed = typing.get(match);
      if (!typed || quiet <= 0) {
        releaseFor(match.subscription.id);
        hook(match);
        return;
      }
      const key = keyOf(match, typed.run, typed.author);
      releaseFor(match.subscription.id, key);
      const was = held.get(key);
      const joined = was ? joinMatches(was.match, match) : match;
      if (was?.timer) clearTimeout(was.timer);
      const timer = setTimeout(() => release(key), quiet);
      (timer as { unref?: () => void }).unref?.();
      held.set(key, { match: joined, timer });
    },
    flush() {
      for (const key of [...held.keys()]) release(key);
    },
  };
}

/** Two matches of one person's typing into one field, as one: the later's moment, both runs' counts and spans. */
function joinMatches(a: SubscriptionMatch, b: SubscriptionMatch): SubscriptionMatch {
  const one = typing.get(a)!;
  const two = typing.get(b)!;
  const run = joinRuns(one.run, two.run);
  const records = b.records.map((record) => {
    const before = a.records.find((other) => other.id === record.id);
    if (!before?.fields || !record.fields) return record;
    return {
      ...record,
      fields: [
        ...before.fields.filter((field) => !record.fields!.some((other) => other.field === field.field)),
        ...record.fields.map((field) => {
          const was = before.fields!.find((other) => other.field === field.field);
          if (!was?.typed || !field.typed) return was && "before" in was ? { ...field, before: was.before } : field;
          return { ...field, typed: { inserted: was.typed.inserted + field.typed.inserted, removed: was.typed.removed + field.typed.removed, spans: joinSpans(was.typed.spans, field.typed.spans) } };
        }),
      ],
    };
  });
  const intent = typingWords(run, two.schema, two.graph);
  const joined: SubscriptionMatch = {
    ...b,
    batches: [...(a.batches ?? [a.batch]), ...(b.batches ?? [b.batch])],
    ops: [...a.ops, ...b.ops],
    intent,
    records,
    said: typingSentence(b.byName, run, two.schema, two.graph),
  };
  typing.set(joined, { ...two, run });
  return joined;
}

/** What happened to the records, said without who or why: "Added “Call the plumber”". */
function recordsSaid(records: readonly MatchedRecord[]): string {
  const verb = { created: "Added", changed: "Changed", removed: "Removed" } as const;
  return records.map((record) => `${verb[record.change]} “${record.label}”`).join("; ") || "A change";
}

/** The records a batch, as the subscriber is served it, touched that the subscription is about — or undefined when it is no match. */
function matchOne(store: Store<AnySchema>, seen: Store<AnySchema>, subscription: Subscription, ops: readonly Operation[]): MatchedRecord[] | undefined {
  const { when } = subscription;
  const primitives = ops.flatMap((op) => op.primitives);
  const last = ops.at(-1)!.seq;
  const kindOf = (id: string): string | undefined => {
    for (const primitive of primitives) if ((primitive.op === "add-node" || primitive.op === "remove-node") && primitive.node.id === id) return primitive.node.kind;
    return seen.graph.getNode(id)?.kind;
  };
  /** A record the batch touched, as the subscriber is served it now — or as it was removed. */
  const record = (id: string): MatchedRecord | undefined => {
    const kind = kindOf(id);
    if (kind === undefined) return undefined;
    const added = primitives.some((p) => p.op === "add-node" && p.node.id === id);
    const removed = primitives.some((p) => p.op === "remove-node" && p.node.id === id);
    const now = seen.graph.getNode(id) as AnyGraphNode | undefined;
    const gone = primitives.find((p): p is Extract<Primitive, { op: "remove-node" }> => p.op === "remove-node" && p.node.id === id)?.node;
    const node = now ?? gone;
    const definition = store.schema.tryDefinition(kind);
    const label = node ? labelOf(definition as never, node) : id;
    const change: MatchedRecord["change"] = added && !removed ? "created" : removed && !now ? "removed" : "changed";
    const fields = new Map<string, { before?: unknown; after?: unknown; typed?: { inserted: number; removed: number; spans: readonly TextSplice[] } }>();
    for (const primitive of primitives) {
      if (primitive.op === "splice-text" && primitive.id === id) {
        // A splice says part of the text, and is said as that part — what was put in and taken out — never the text whole twice (Roadmap f-collab-text, phase 5).
        const held = fields.get(primitive.field);
        const span = { at: primitive.at, removed: primitive.removed, inserted: primitive.inserted };
        const typed = { inserted: [...primitive.inserted].length + (held?.typed?.inserted ?? 0), removed: [...primitive.removed].length + (held?.typed?.removed ?? 0), spans: joinSpans(held?.typed?.spans ?? [], [span]) };
        if (held && !held.typed) fields.set(primitive.field, { ...held, ...(now?.[primitive.field] === undefined ? {} : { after: now[primitive.field] }) });
        else fields.set(primitive.field, { typed });
        continue;
      }
      if (primitive.op !== "patch-node" || primitive.id !== id) continue;
      for (const [field, after] of Object.entries(primitive.after)) {
        const held = fields.get(field);
        const before = held ? held.before : primitive.before[field];
        fields.set(field, { ...(isUnset(before) ? {} : { before }), ...(isUnset(after) ? {} : { after }) });
      }
    }
    return {
      id,
      kind,
      label,
      change,
      ...(fields.size > 0
        ? {
            fields: [...fields].map(([field, { typed, ...values }]) => ({
              field,
              words: fieldWords(definition as never, field),
              ...values,
              ...(typed ? { typed: { inserted: typed.inserted, removed: typed.removed, spans: typed.spans } } : {}),
            })),
          }
        : {}),
    };
  };
  const touched = [...new Set(primitives.flatMap(aboutOf))];
  const records = (ids: readonly string[]): MatchedRecord[] => ids.flatMap((id) => record(id) ?? []);

  switch (when.on) {
    case "act": {
      const ran = ops.filter((op) => !isWithheld(op) && op.mutation !== null && op.undoes === undefined && (when.act === undefined || op.mutation.name === when.act));
      const on = when.record === undefined ? ran : ran.filter((op) => op.writes.includes(when.record!) || names(op.mutation!.args, when.record!));
      if (on.length === 0) return undefined;
      const ids = when.record !== undefined ? [when.record] : [...new Set(on.flatMap((op) => op.primitives.flatMap(aboutOf)))];
      return records(ids.filter((id) => kindOf(id) !== undefined));
    }
    case "created": {
      const made = ops.filter((op) => op.undoes === undefined).flatMap((op) => op.primitives.flatMap((p) => (p.op === "add-node" && p.node.kind === when.kind ? [p.node.id] : [])));
      return made.length > 0 ? records([...new Set(made)]) : undefined;
    }
    case "changed": {
      const ids = touched.filter((id) => (when.record !== undefined ? id === when.record : kindOf(id) === when.kind));
      return ids.length > 0 ? records(ids) : undefined;
    }
    case "reaches": {
      const condition = parsed(when.condition);
      if (!condition) return undefined;
      const candidates = touched.filter((id) => (when.record !== undefined ? id === when.record : true) && kindOf(id) === when.kind);
      const reached = candidates.filter((id) => {
        // As the subscriber is served it: a field kept from them is not there to be read.
        const after = nodeAfter(store, id, last);
        const servedAfter = after ? (seen.graph.getNode(id) === undefined ? undefined : servedAs(seen, after)) : undefined;
        const before = nodeBefore(after, id, primitives);
        const servedBefore = before ? servedAs(seen, before) : undefined;
        return holds(condition, servedAfter, seen.graph as GraphReader, store.schema) && !holds(condition, servedBefore, seen.graph as GraphReader, store.schema);
      });
      return reached.length > 0 ? records(reached) : undefined;
    }
  }
}

/** A record as the subscriber is served it: only the fields their view of it carries. */
function servedAs(seen: Store<AnySchema>, node: AnyGraphNode): AnyGraphNode | undefined {
  const shown = seen.graph.getNode(node.id) as AnyGraphNode | undefined;
  if (!shown) return undefined;
  return Object.fromEntries(Object.entries(node).filter(([field]) => field === "id" || field === "kind" || field in shown)) as AnyGraphNode;
}

// ── watching a store ────────────────────────────────────────────────────────

export interface WatchSubscriptionsOptions extends MatchOptions {
  readonly subscriptions: SubscriptionStore;
  readonly onSubscriptionMatch: OnSubscriptionMatch;
  /** Told when the hook throws or the store cannot list; unsaid, the error is reported on the console. */
  readonly onError?: (error: unknown) => void;
  /** How long a run of typing is held before it is told (`holdTypingRuns`); `TYPING_QUIET_MS` unsaid, 0 tells every run at once. */
  readonly typingQuietMs?: number;
}

/**
 * EVERY COMMIT OF A STORE, MATCHED: subscribes to the store, lists the
 * subscriptions on each commit, and hands each match to the hook. A store
 * that lists at once is matched at once; one that answers a promise is
 * matched when it answers, against each record as it stood just after the
 * batch. A run of typing is told once the typist stops (`holdTypingRuns`).
 * Answers the way to stop, which tells what it held.
 */
export function watchSubscriptions<S extends AnySchema>(store: Store<S>, options: WatchSubscriptionsOptions): () => void {
  const report = options.onError ?? ((error: unknown) => console.error("A subscription could not be judged:", error));
  const held = holdTypingRuns(
    (match) => {
      try {
        const told = options.onSubscriptionMatch(match);
        if (told && typeof (told as Promise<void>).then === "function") (told as Promise<void>).catch(report);
      } catch (error) {
        report(error);
      }
    },
    options.typingQuietMs !== undefined ? { quietMs: options.typingQuietMs } : {},
  );
  const tell = (matches: readonly SubscriptionMatch[]) => {
    for (const match of matches) held.tell(match);
  };
  const stop = store.subscribe((_diff, ops) => {
    if (ops.length === 0) return;
    try {
      const listed = options.subscriptions.list();
      if (Array.isArray(listed)) tell(matchSubscriptions(store, ops, listed as readonly Subscription[], options));
      else void (listed as Promise<readonly Subscription[]>).then((all) => tell(matchSubscriptions(store, ops, all, options)), report);
    } catch (error) {
      report(error);
    }
  });
  // Stopping tells what typing it held: nothing matched is lost.
  return () => {
    stop();
    held.flush();
  };
}
