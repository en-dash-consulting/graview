import { dayOfMoment, dayOfMonthAsRead, isoToday, wallIn, zoneFor } from "../days.js";
import { isAutomated } from "./tidying.js";
import type { Author, Batch, Operation } from "./types.js";

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
  | { readonly batch: Batch }
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
 */
export function foldDigests(batches: readonly Batch[], find: (id: string) => Operation | undefined = () => undefined): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const batch of batches) {
    if (isSuggestionBatch(batch, find)) continue;
    if (!isAutomated(batch.author)) {
      rows.push({ batch });
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
 * "Tidied 12 things overnight".
 */
export function digestWords(digest: { readonly things: number; readonly at: string; readonly run?: string; readonly batches?: readonly Pick<Batch, "at">[] }, today: string = dayOfMoment(new Date().toISOString()) ?? isoToday()): string {
  const day = dayOfMoment(digest.at) ?? digest.at.slice(0, 10);
  const overnight = digest.run !== undefined && day === today && [digest.at, ...(digest.batches ?? []).map((batch) => batch.at)].every(atNight);
  const when = overnight ? "overnight" : day === today ? "today" : `on ${dayOfMonthAsRead(day)}`;
  return `Tidied ${digest.things === 1 ? "one thing" : `${digest.things} things`} ${when}`;
}
