import { dayOfMoment, dayOfMonthAsRead, isoToday, wallIn, zoneFor } from "../days.js";
import { isAutomated } from "./tidying.js";
import type { Author, Batch, Operation } from "./types.js";
import { fieldWords } from "../schema/define-node.js";
import { TYPE_TEXT } from "../text/typing-hook.js";

/*
 * A DIGEST IN ACTIVITY (`@graview/core/tidying`): the app's own actor's run
 * of changes read as one row. Apart from what the store holds the actor to,
 * so a page carries it only with the Activity that draws it.
 */

/** Whether a batch is a suggestion, or the declining of one: said in the Suggested tray, not as a row of Activity. */
export function isSuggestionBatch(batch: Pick<Batch, "ops">, find: (id: string) => Operation | undefined): boolean {
  return batch.ops.length > 0 && batch.ops.every((op) => op.suggests !== undefined || (op.undoes !== undefined && find(op.undoes)?.suggests !== undefined));
}

/** One row of Activity: a batch as it is, or a run of one automated author's batches folded into one. */
export type ActivityRow =
  | {
      /** The batch; for a run of typing, its last. */
      readonly batch: Batch;
      /**
       * A RUN OF TYPING (Roadmap f-collab-text): consecutive batches of one
       * person typing into one field, one row — every batch, oldest first,
       * the field, and how much they put in and took out (`typedRowWords`).
       */
      readonly typed?: TypedRow;
    }
  | {
      readonly digest: {
        /** Who made them: the one automated author of every batch in the run. */
        readonly author: Author;
        /** The batches folded, oldest first. */
        readonly batches: readonly Batch[];
        /** How many things it did: the ops of the batches, not counting what it took back. */
        readonly things: number;
        /** When the last of them was made. */
        readonly at: string;
        /** The run they were made in (`Lineage.run`), when the actor said one: a night's tidying, read as one row. */
        readonly run?: string;
      };
    };

/** A run of typing as Activity folds it. */
export interface TypedRow {
  readonly batches: readonly Batch[];
  readonly node: string;
  readonly field: string;
  /** Characters put in and taken out, an emoji one. */
  readonly inserted: number;
  readonly removed: number;
}

const characters = (text: string) => [...text].length;

/**
 * THE FIELD A BATCH TYPED INTO, AND HOW MUCH: when every op of it is a
 * keystroke (`type-text`) into one field. Kept here, small, rather than read
 * from `@graview/core/history`'s `typedRun`, so Activity folds typing with
 * what a page first loads and nothing more.
 */
function typedIn(batch: Batch): Omit<TypedRow, "batches"> | undefined {
  let into: { node: string; field: string } | undefined;
  let inserted = 0;
  let removed = 0;
  for (const op of batch.ops) {
    const args = op.mutation?.name === TYPE_TEXT && op.withheld !== true && op.undoes === undefined ? (op.mutation.args as { node?: unknown; field?: unknown }) : undefined;
    if (typeof args?.node !== "string" || typeof args.field !== "string" || (into && (into.node !== args.node || into.field !== args.field))) return undefined;
    into = { node: args.node, field: args.field };
    for (const one of op.primitives) {
      if (one.op === "splice-text") (inserted += characters(one.inserted)), (removed += characters(one.removed));
      // The first text, written whole into a field holding none.
      else if (one.op === "patch-node" && typeof one.after[args.field] === "string") inserted += characters(one.after[args.field] as string);
    }
  }
  return into && { ...into, inserted, removed };
}

/** A run of typing in Activity, said: "Wrote in Notes (+42 −3)" — the record is named beside it. */
export function typedRowWords(row: Omit<TypedRow, "batches">, schema: { tryDefinition(kind: string): unknown }, graph: { getNode(id: string): unknown }): string {
  const kind = (graph.getNode(row.node) as { kind?: string } | undefined)?.kind;
  const counts = [...(row.inserted > 0 || row.removed === 0 ? [`+${row.inserted}`] : []), ...(row.removed > 0 ? [`\u2212${row.removed}`] : [])];
  return `Wrote in ${fieldWords(kind ? (schema.tryDefinition(kind) as never) : undefined, row.field)} (${counts.join(" ")})`;
}

/** Who an author is, for folding: the same kind, id and name. */
const authorKey = (author: Author) => JSON.stringify([author.kind, author.id ?? "", author.name ?? ""]);

/** The run a batch was made in: the first `Lineage.run` its ops say. */
const runOf = (batch: Batch): string | undefined => batch.ops.find((op) => op.lineage?.run !== undefined)?.lineage?.run;

/**
 * A DIGEST IN ACTIVITY: batches as Activity lists them, oldest first, with
 * each RUN of the app's own actor (`Lineage.run`: a night's tidying) folded
 * into one row, which stands where the run's last batch does, whatever came
 * between; and, where an actor said no run, each stretch of consecutive
 * batches by one automated author folded into one. A person's change and a
 * chat seat's never fold: a chat seat is an agent, but not the app's own
 * actor (`automated`). A batch that is a suggestion or the declining of one
 * is left out — the Suggested tray says those — and does not break a run.
 * A person's consecutive runs of typing into one field are one row (`typed`).
 */
export function foldDigests(batches: readonly Batch[], find: (id: string) => Operation | undefined = () => undefined): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const batch of batches) {
    if (isSuggestionBatch(batch, find)) continue;
    if (!isAutomated(batch.author)) {
      const into = typedIn(batch);
      const last = rows.at(-1);
      // A run of typing joins the row before it when that is the same person typing into the same field.
      const was = into && last && "batch" in last && authorKey(last.batch.author) === authorKey(batch.author) && last.typed?.node === into.node && last.typed.field === into.field ? last.typed : undefined;
      if (was) rows[rows.length - 1] = { batch, typed: { ...was, batches: [...was.batches, batch], inserted: was.inserted + into!.inserted, removed: was.removed + into!.removed } };
      else rows.push(into ? { batch, typed: { batches: [batch], ...into } } : { batch });
      continue;
    }
    const run = runOf(batch);
    const key = authorKey(batch.author);
    // The row this batch joins: its run's, wherever it stands; else the last row, when it is the same author's and no run's.
    const at = run !== undefined ? rows.findIndex((row) => "digest" in row && row.digest.run === run && authorKey(row.digest.author) === key) : rows.length - 1;
    const last = rows[at];
    const joins = last !== undefined && "digest" in last && authorKey(last.digest.author) === key && last.digest.run === run ? last.digest : undefined;
    const folded = [...(joins?.batches ?? []), batch];
    if (joins) rows.splice(at, 1);
    rows.push({ digest: { author: batch.author, batches: folded, things: thingsIn(folded), at: batch.at, ...(run !== undefined ? { run } : {}) } });
  }
  return rows;
}

const thingsIn = (batches: readonly Batch[]) => batches.reduce((sum, batch) => sum + (batch.undone ? 0 : batch.ops.length), 0);

/** Whether a moment fell in the night on the app's clock: from nine in the evening to six in the morning. */
const atNight = (at: string): boolean => {
  const stamp = Date.parse(at);
  if (Number.isNaN(stamp)) return false;
  const { minutes } = wallIn(stamp, zoneFor());
  return minutes < 6 * 60 || minutes >= 21 * 60;
};

/**
 * A digest said as Activity says a change: "Tidied 6 things today",
 * "Tidied a thing on Oct 12" — the day it fell on the app's clock (Roadmap
 * f-app-time-zone). A run made wholly in the night, ending today, is
 * "Tidied 12 things overnight". A workflow's run is said by its title:
 * "Fill out next week's events: 6 things today".
 */
export function digestWords(digest: { readonly things: number; readonly at: string; readonly run?: string; readonly batches?: readonly Pick<Batch, "at">[]; readonly author?: Pick<Author, "id" | "name"> }, today: string = dayOfMoment(new Date().toISOString()) ?? isoToday()): string {
  const day = dayOfMoment(digest.at) ?? digest.at.slice(0, 10);
  const overnight = digest.run !== undefined && day === today && [digest.at, ...(digest.batches ?? []).map((batch) => batch.at)].every(atNight);
  const when = overnight ? "overnight" : day === today ? "today" : `on ${dayOfMonthAsRead(day)}`;
  const things = digest.things === 1 ? "one thing" : `${digest.things} things`;
  // A workflow's run (Roadmap f-jobs-declared) is said by the workflow's title: "Fill out next week's events: 6 things today".
  if (digest.author?.id?.startsWith("workflow:") && digest.author.name) return `${digest.author.name}: ${things} ${when}`;
  return `Tidied ${things} ${when}`;
}
