/**
 * THE APP'S HISTORY, PLAYED BACK (Roadmap f-playback): `@graview/core/history`.
 *
 * `pastOf(store, when)` (`@graview/core/past`) is the app as it stood;
 * this is what a timeline reads around it — one tick per gesture, marked by
 * who made it, the bigger ticks where the declaration changed with the
 * sentence it said, and the gestures a "Restore to here" takes back as one
 * change. Its own entry, because nothing here is needed before somebody
 * opens the past: the timeline fetches it when they do.
 *
 * What the log does not hold — a script view's code, an asset's bytes —
 * is the host's, and it hands it through `HistoryHost`.
 */
import { capitalize } from "./capital.js";
import { humanizeField, nounOf } from "./schema/define-node.js";
import { nameOfAuthor } from "./who.js";
import type { Epoch } from "./ops/log.js";
import { joinRuns, sameTypist, typedRun, typingSentence, typingWords, type TypedRun } from "./text/typing-words.js";
import { typedSpans } from "./text/typing-spans.js";
import type { TextSplice } from "./text/splice.js";
import { authorKindOf, type Author, type Batch, type Operation } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import type { PastDeclaration, Store } from "./store.js";

/** Who made a change, as a timeline marks it: the reader, another person, an agent, or the app itself (a rule, a sync, a migration). */
export type Maker = "you" | "person" | "agent" | "app";

/**
 * A CHANGE TO THE DECLARATION AT A MOMENT, as the host knows it: the seq it
 * took effect at (the ops before it were made under the one before), the
 * sentence it said ("Added a Budget kind"), and — so the past is drawn
 * under it — the declaration itself. An epoch with a `change` (a migration)
 * is one too, read from the log without the host.
 */
export interface DeclarationMark {
  readonly seq: number;
  readonly sentence: string;
  readonly at?: string;
  readonly author?: Author;
  /**
   * The declaration from this seq on. Absent, the host is asked for it
   * (`HistoryHost.declarationAt`) when playback reaches it; with nothing
   * to ask, or no answer, the past is drawn under the last one the host
   * did hand, else the store's own.
   */
  readonly declaration?: PastDeclaration;
}

/** What a host keeps of a script (worker) view: its code at a moment, as it registers it. */
export type ViewVersion = { readonly source: string } | Readonly<Record<string, unknown>>;

/**
 * WHAT A HOST'S ARCHIVE HANDS BACK FOR A RANGE BEHIND THE UNDO HORIZON
 * (FR-196): the ops it holds of the range, oldest first, each with its
 * `seq`, and the epochs among them — a checkpoint an earlier compaction
 * made, a seed's at seq 0 — that a moment is folded from. A `LogArchive`
 * as `store.compact` returned it is one, as is a slice of it. More than was
 * asked is kept; an op of the range missing from it is a gap, which the
 * timeline says it could not read. Without an epoch at or before a
 * moment, the fold reaches back to seq 0, an empty graph.
 */
export interface ArchivedOps {
  readonly ops: readonly Operation[];
  readonly epochs?: readonly Epoch[];
  /**
   * WHERE THE ARCHIVE HOLDS EVERY OP FROM (FR-213): behind this seq it
   * holds none — a plan keeps a window of history, and the host kept only
   * the epoch it began at (`archiveFrom`, FR-214) and any it kept whole
   * before it. Playback stops behind it only at the epochs handed, and a
   * moment between them is before what is kept: said quietly, never as a
   * refusal, and never asked of the archive again.
   */
  readonly keptFrom?: number;
}

/**
 * HOW FAR BACK A HOST KEEPS THE HISTORY (FR-213), as a plan says it: the
 * time the full history is kept since, the sentence a timeline says when
 * it is scrubbed to a moment at or before it ("The Free plan keeps 30 days
 * of history."), and what a person may do about it — a link the line
 * carries. A range of the archive wholly before `since` is never asked.
 */
export interface KeptHistory {
  /** An ISO time: the changes made before it are not kept whole. */
  readonly since: string;
  readonly sentence: string;
  readonly action?: { readonly label: string; readonly href: string };
}

/**
 * WHAT THE HOST KEEPS OUTSIDE THE LOG, handed to playback: the declaration
 * changes it knows (with the declaration each began, or a way to ask for
 * it), a script view's code as it stood at a seq — `null` when the
 * view did not exist then, `undefined` when the host does not know (the
 * view is drawn as it is now) — and the ops a compaction archived.
 */
export interface HistoryHost {
  readonly declarations?: readonly DeclarationMark[];
  /**
   * THE DECLARATION A MARK BEGAN, ASKED FOR WHEN IT IS NEEDED: called with
   * the `seq` of a mark handed without its `declaration`, the first time
   * playback reaches a moment under it, and asked once per mark while it
   * is the same function. Until it answers the moment is held, then drawn
   * under today's declaration if the answer is slow; an answer of
   * `undefined`, or one that fails, is as if the mark had none. A page
   * that never opens the past asks nothing.
   */
  readonly declarationAt?: (seq: number) => Promise<PastDeclaration | undefined> | PastDeclaration | undefined;
  readonly viewAt?: (name: string, seq: number) => ViewVersion | null | undefined;
  /**
   * THE OPS BEHIND THE UNDO HORIZON, ASKED FOR WHEN THEY ARE NEEDED
   * (FR-196): called with a range of seqs, `from` up to but not including
   * `to`, both at or before `store.log.horizon`, the first time the
   * timeline is moved to a moment the compacted log no longer holds. It
   * is asked in chunks aligned to 256 seqs, newest first until an epoch
   * (or seq 0) is reached, and each chunk once while it is the same
   * function; the answer is `ArchivedOps`, or the ops alone. With it, the
   * timeline reaches back to the start; without it, it begins at the
   * horizon and says the changes before were archived. A refusal or a
   * failure is said on the timeline, and the present is untouched. The
   * past it folds is read, never changed: undo still stops at the horizon.
   */
  readonly archived?: (from: number, to: number) => Promise<ArchivedOps | readonly Operation[]>;
  /**
   * WHERE THE HOST'S HISTORY STOPS (FR-213): the time it keeps the full
   * history since. The timeline says `sentence` in a quiet line when it is
   * at or before it, and `archived` is never asked for a range made wholly
   * before it.
   */
  readonly kept?: KeptHistory;
}

/** One gesture on the timeline, or one declaration change made outside the log. */
export interface PlaybackTick {
  /** The moment just after it: `pastOf(store, seq)` shows it made. */
  readonly seq: number;
  /** The seq of its first op; equal to `seq` for a declaration change the log holds no op of. */
  readonly from: number;
  /** When it was made, when said. */
  readonly at: string | undefined;
  readonly batch: string | undefined;
  readonly maker: Maker;
  readonly author: Author | undefined;
  /** What it was, in a sentence: the gesture's intent, or the declaration's change. */
  readonly said: string;
  /** A change to the declaration: a bigger tick. */
  readonly declaration: boolean;
  /** Something this seat may not see happened here (FR-16): said, and nothing more. */
  readonly withheld: boolean;
  /**
   * A RUN OF TYPING (Roadmap f-collab-text): consecutive gestures by one
   * person typing into one field are one tick — every gesture's batch,
   * oldest first (`batch` is the last), and what they typed, said as
   * "Wrote in Notes (+42 −3)".
   */
  readonly batches?: readonly string[];
  readonly typed?: TypedRun;
}

/** Who made a change, for the reader `me`. A system or a rule is the app itself, as is a kind this build does not know; an agent acting for a person is still an agent; a visitor is a person. */
export function makerOf(author: Author, me?: Principal): Maker {
  const kind = authorKindOf(author);
  if (kind === "agent") return "agent";
  if (kind !== "human" && kind !== "visitor") return "app";
  if (author.onBehalfOf !== undefined) return "person";
  return author.id === undefined || me?.id === undefined || author.id === me.id ? "you" : "person";
}

const opsSeen = (batch: Batch) => batch.ops.filter((op) => op.withheld !== true);

/**
 * THE TIMELINE OF A STORE: one tick per gesture, in the order they ended,
 * then each declaration change at its seq — on the gesture that made it
 * when one ends there, else a tick of its own. Read through a seat's view
 * of the store (`seenBy`), a change it may not see is a tick that says only
 * that something happened.
 */
export function ticksOf<S extends AnySchema>(store: Store<S>, options: { readonly me?: Principal; readonly declarations?: readonly DeclarationMark[] } = {}): PlaybackTick[] {
  const ticks: PlaybackTick[] = [];
  for (const batch of store.batches()) {
    const first = batch.ops[0]!;
    const last = batch.ops.at(-1)!;
    const withheld = opsSeen(batch).length === 0;
    const typed = withheld ? undefined : typedRun(batch.ops);
    // A run of typing joins the tick before it when that is the same person typing into the same field (Roadmap f-collab-text).
    const before = ticks.at(-1);
    if (typed && before?.typed && before.author && sameTypist(before.author, batch.author) && before.typed.node === typed.node && before.typed.field === typed.field) {
      const joined = joinRuns(before.typed, typed);
      ticks[ticks.length - 1] = { ...before, seq: last.seq + 1, at: last.at, batch: batch.id, batches: [...(before.batches ?? []), batch.id], typed: joined, said: typingWords(joined, store.schema, store.graph, false) };
      continue;
    }
    ticks.push({
      seq: last.seq + 1,
      from: first.seq,
      at: last.at,
      batch: batch.id,
      maker: withheld ? "person" : makerOf(batch.author, options.me),
      author: withheld ? undefined : batch.author,
      said: typed ? typingWords(typed, store.schema, store.graph, false) : batch.intent,
      declaration: false,
      withheld,
      ...(typed ? { batches: [batch.id], typed } : {}),
    });
  }
  const marks: DeclarationMark[] = [
    ...store.log
      .epochs()
      .filter((epoch) => epoch.change !== undefined)
      .map((epoch) => ({ seq: epoch.seq, sentence: epoch.change!, ...(epoch.at ? { at: epoch.at } : {}) })),
    ...(options.declarations ?? []),
  ];
  for (const mark of marks) {
    if (mark.seq < store.log.horizon || mark.seq > store.log.length) continue;
    const at = ticks.findIndex((tick) => tick.seq === mark.seq);
    if (at >= 0 && !ticks[at]!.withheld) {
      ticks[at] = { ...ticks[at]!, declaration: true, said: mark.sentence };
      continue;
    }
    ticks.push({
      seq: mark.seq,
      from: mark.seq,
      at: mark.at,
      batch: undefined,
      maker: mark.author ? makerOf(mark.author, options.me) : "app",
      author: mark.author,
      said: mark.sentence,
      declaration: true,
      withheld: false,
    });
  }
  return ticks.sort((a, b) => a.seq - b.seq || Number(a.batch !== undefined) - Number(b.batch !== undefined));
}

/** What an app that publishes has not published yet (`unpublished`). */
export interface Unpublished {
  /** How far readers are served: the last publish, or undefined when nothing was ever published. */
  readonly publishedSeq: number | undefined;
  /** The head: what collaborators are served. */
  readonly head: number;
  /** One tick per gesture made after the publish and standing now, oldest first — none of them a publish. */
  readonly ticks: readonly PlaybackTick[];
  /** The badge's words: "3 changes are not published yet.", "Everything is published.", "Nothing is published yet." */
  readonly sentence: string;
}

/**
 * WHAT IS NOT PUBLISHED YET (Roadmap f-publishing-lifecycle): the gestures
 * between what readers are served (`publishedSeq`) and the head, in words
 * — what a "not published" badge counts and a diff lists. The change
 * itself is `pastOf(store, publishedSeq)` against the head. Read through a
 * seat's view, a change it may not see is a tick that says only that.
 */
export function unpublished<S extends AnySchema>(store: Store<S>, options: { readonly me?: Principal } = {}): Unpublished {
  const publishedSeq = store.publishedSeq;
  const from = publishedSeq ?? store.log.horizon;
  // A gesture taken back since, a publish, and an undo of a gesture made since are not changes readers will meet.
  const seqOf = new Map(store.log.all().map((op) => [op.id, op.seq]));
  const since = (op: Operation) => op.undoes !== undefined && (seqOf.get(op.undoes) ?? -1) >= from;
  const standing = new Set(store.batches().filter((batch) => !batch.undone && !batch.ops.some((op) => op.publishedThrough !== undefined || since(op))).map((batch) => batch.id));
  const ticks = ticksOf(store, options).filter((tick) => tick.from >= from && tick.batch !== undefined && (tick.batches ?? [tick.batch]).some((batch) => standing.has(batch)));
  const sentence = publishedSeq === undefined ? "Nothing is published yet." : ticks.length === 0 ? "Everything is published." : `${ticks.length === 1 ? "1 change is" : `${ticks.length} changes are`} not published yet.`;
  return { publishedSeq, head: store.log.length, ticks, sentence };
}

type Declared = Pick<AnySchema, "kinds" | "tryDefinition">;
const fieldsOf = (schema: Declared, kind: string): readonly string[] => {
  const fields = schema.tryDefinition(kind)?.fields as { readonly shape?: object } | undefined;
  return Object.keys(fields?.shape ?? {});
};
const edgesOf = (schema: Declared, kind: string): readonly string[] => Object.keys((schema.tryDefinition(kind) as { readonly edges?: object } | undefined)?.edges ?? {});
const kindWords = (schema: Declared, kind: string) => capitalize(nounOf(schema.tryDefinition(kind) as never, kind));
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const listed = (items: readonly string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/**
 * WHAT A DECLARATION CHANGE DID, IN A SENTENCE, from the one before and the
 * one after: "Added a Budget kind", "Added due and priority to Task",
 * "Removed the Note kind". Kinds first, then fields and links of the kinds
 * both have. "Changed the declaration" when nothing it names moved.
 */
export function declarationSentence(before: Declared | undefined, after: Declared): string {
  const was = new Set<string>(before?.kinds ?? []);
  const now = new Set<string>(after.kinds);
  const parts: string[] = [];
  const added = [...now].filter((kind) => !was.has(kind));
  const removed = [...was].filter((kind) => !now.has(kind));
  if (added.length === 1) parts.push(`added ${article(kindWords(after, added[0]!))} ${kindWords(after, added[0]!)} kind`);
  else if (added.length > 1) parts.push(`added the ${listed(added.map((kind) => kindWords(after, kind)))} kinds`);
  if (removed.length > 0) parts.push(`removed the ${listed(removed.map((kind) => kindWords(before!, kind)))} kind${removed.length > 1 ? "s" : ""}`);
  for (const kind of [...now].filter((one) => was.has(one))) {
    const then = new Set([...fieldsOf(before!, kind), ...edgesOf(before!, kind)]);
    const since = [...fieldsOf(after, kind), ...edgesOf(after, kind)];
    const more = since.filter((name) => !then.has(name)).map((name) => humanizeField(name).toLowerCase());
    const fewer = [...then].filter((name) => !since.includes(name)).map((name) => humanizeField(name).toLowerCase());
    if (more.length > 0) parts.push(`added ${listed(more)} to ${kindWords(after, kind)}`);
    if (fewer.length > 0) parts.push(`removed ${listed(fewer)} from ${kindWords(after, kind)}`);
  }
  return parts.length > 0 ? capitalize(parts.join("; ")) : "Changed the declaration";
}

/**
 * THE GESTURES "RESTORE TO HERE" TAKES BACK, as one undo (`store.undo`):
 * every gesture after `seq` still standing, but not an undo whose every
 * target came after `seq` too — those two cancel already, and taking the
 * undo back would put its target back. Empty when nothing after `seq`
 * stands. Whether the undo may run is the store's to judge (`canUndo`,
 * and the policy when it runs).
 */
export function restoreBatches<S extends AnySchema>(store: Store<S>, seq: number): string[] {
  const ops = store.log.all();
  const position = new Map(ops.map((op) => [op.id, op.seq]));
  return store
    .batches()
    .filter((batch) => !batch.undone && batch.ops[0]!.seq >= seq)
    // What a connection sent out changed nothing here, and is not taken back (Roadmap f-sync-guest-changes-in-history).
    .filter((batch) => !batch.ops.every((op) => op.sentOut !== undefined))
    .filter((batch) => !batch.ops.every((op) => op.undoes !== undefined && (position.get(op.undoes) ?? -1) >= seq))
    .map((batch) => batch.id);
}

/** Who made a tick, in words, for a reader who has the app's people and seats: "you", "Claude", "Ann". */
export function makerWords(tick: PlaybackTick, context: Parameters<typeof nameOfAuthor>[1]): string {
  if (tick.withheld) return "Someone";
  if (tick.maker === "you") return "you";
  if (!tick.author) return "the app";
  return nameOfAuthor(tick.author, context);
}

/** One change in a history said in words: who, what, and the sentence that says both. */
export interface ChangeSaid {
  /** The moment just after it (`pastOf(store, seq)`). */
  readonly seq: number;
  readonly at: string | undefined;
  /** Its gestures' batches, oldest first: several for a run of typing. */
  readonly batches: readonly string[];
  /** Who made it, as `makerWords` says them. */
  readonly by: string;
  /** What it was: the gesture's intent, or "Wrote in Kitchen's notes (+42 −3)" for typing. */
  readonly said: string;
  /** Who and what in one sentence: "Ada wrote in Kitchen's notes (+42 −3)", "Ben: Added “Call the plumber”". */
  readonly sentence: string;
  /** For typing: the field, the counts and the spans put in and taken out — never the text whole. */
  readonly typed?: TypedRun & { readonly spans: readonly TextSplice[] };
}

/**
 * A STORE'S HISTORY IN WORDS, newest first — what an agent's history answer
 * says (Roadmap f-collab-text, phase 5): one entry per gesture, a run of one
 * person's typing into one field one entry, said as "Ada wrote in Kitchen's
 * notes (+42 −3)" with the spans it put in and took out rather than the
 * field's text. Read through a seat's view (`seenBy`), a change it may not
 * see is "Someone changed something you cannot see". Declaration changes
 * are left out: `ticksOf` has them.
 */
export function historyInWords<S extends AnySchema>(store: Store<S>, options: { readonly me?: Principal; readonly limit?: number; readonly context?: Omit<Parameters<typeof nameOfAuthor>[1], "graph" | "schema"> } = {}): ChangeSaid[] {
  const where = { graph: store.graph as never, schema: store.schema as AnySchema, ...options.context };
  const ticks = ticksOf(store, options.me ? { me: options.me } : {}).filter((tick) => tick.batch !== undefined);
  const opsOf = new Map<string, readonly Operation[]>(store.batches().map((batch) => [batch.id, batch.ops]));
  return ticks
    .reverse()
    .slice(0, options.limit ?? ticks.length)
    .map((tick) => {
      // Without a reader, nobody is "you": each author by name.
      const by = options.me || tick.withheld || !tick.author ? makerWords(tick, where) : nameOfAuthor(tick.author, where);
      const said = tick.withheld ? "changed something you cannot see" : tick.typed ? typingWords(tick.typed, store.schema, store.graph) : tick.said;
      const sentence = tick.typed && !tick.withheld ? typingSentence(by, tick.typed, store.schema, store.graph) : tick.withheld ? `${capitalize(by)} ${said}` : `${capitalize(by)}: ${said}`;
      const batches = tick.batches ?? [tick.batch!];
      const spans = () => typedSpans(batches.flatMap((batch) => opsOf.get(batch) ?? []), tick.typed!.node, tick.typed!.field);
      return { seq: tick.seq, at: tick.at, batches, by, said, sentence, ...(tick.typed && !tick.withheld ? { typed: { ...tick.typed, spans: spans() } } : {}) };
    });
}

export { typedCounts, typedRun, typingSentence, typingWords } from "./text/typing-words.js";
export { typedSpans } from "./text/typing-spans.js";
export type { TypedRun } from "./text/typing-words.js";
