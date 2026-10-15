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
import type { Author, Batch } from "./ops/types.js";
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
  /** The declaration from this seq on; absent, the past is drawn under the next one the host does say, else the store's own. */
  readonly declaration?: PastDeclaration;
}

/** What a host keeps of a script (worker) view: its code at a moment, as it registers it. */
export type ViewVersion = { readonly source: string } | Readonly<Record<string, unknown>>;

/**
 * WHAT THE HOST KEEPS OUTSIDE THE LOG, handed to playback: the declaration
 * changes it knows (with the declaration each began), and a script view's
 * code as it stood at a seq — `null` when the view did not exist then,
 * `undefined` when the host does not know (the view is drawn as it is now).
 */
export interface HistoryHost {
  readonly declarations?: readonly DeclarationMark[];
  readonly viewAt?: (name: string, seq: number) => ViewVersion | null | undefined;
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
}

/** Who made a change, for the reader `me`. A system or a rule is the app itself; an agent acting for a person is still an agent. */
export function makerOf(author: Author, me?: Principal): Maker {
  if (author.kind === "agent") return "agent";
  if (author.kind !== "human") return "app";
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
  const ticks: PlaybackTick[] = store.batches().map((batch) => {
    const first = batch.ops[0]!;
    const last = batch.ops.at(-1)!;
    const withheld = opsSeen(batch).length === 0;
    return {
      seq: last.seq + 1,
      from: first.seq,
      at: last.at,
      batch: batch.id,
      maker: withheld ? "person" : makerOf(batch.author, options.me),
      author: withheld ? undefined : batch.author,
      said: batch.intent,
      declaration: false,
      withheld,
    };
  });
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
