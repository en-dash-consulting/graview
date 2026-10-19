import { dayOfMoment, dayOfMonthAsRead, isoToday } from "../days.js";
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
      };
    };

/** Who an author is, for folding: the same kind, id and name. */
const authorKey = (author: Author) => JSON.stringify([author.kind, author.id ?? "", author.name ?? ""]);

/**
 * A DIGEST IN ACTIVITY: batches as Activity lists them, oldest first, with
 * each run of consecutive batches by one automated author folded into one
 * row. A person's change and a chat seat's never fold: a chat seat is an
 * agent, but not the app's own actor (`automated`). A batch that is a
 * suggestion or the declining of one is left out — the Suggested tray says
 * those — and does not break a run.
 */
export function foldDigests(batches: readonly Batch[], find: (id: string) => Operation | undefined = () => undefined): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const batch of batches) {
    if (isSuggestionBatch(batch, find)) continue;
    const last = rows.at(-1);
    if (!isAutomated(batch.author)) {
      rows.push({ batch });
      continue;
    }
    if (last && "digest" in last && authorKey(last.digest.author) === authorKey(batch.author)) {
      const folded = [...last.digest.batches, batch];
      rows[rows.length - 1] = { digest: { author: last.digest.author, batches: folded, things: thingsIn(folded), at: batch.at } };
    } else rows.push({ digest: { author: batch.author, batches: [batch], things: thingsIn([batch]), at: batch.at } });
  }
  return rows;
}

const thingsIn = (batches: readonly Batch[]) => batches.reduce((sum, batch) => sum + (batch.undone ? 0 : batch.ops.length), 0);

/** A digest said as Activity says a change: "Tidied 6 things today", "Tidied a thing on Oct 12" — the day it fell on the app's clock (Roadmap f-app-time-zone). */
export function digestWords(digest: { readonly things: number; readonly at: string }, today: string = dayOfMoment(new Date().toISOString()) ?? isoToday()): string {
  const day = dayOfMoment(digest.at) ?? digest.at.slice(0, 10);
  const when = day === today ? "today" : `on ${dayOfMonthAsRead(day)}`;
  return `Tidied ${digest.things === 1 ? "one thing" : `${digest.things} things`} ${when}`;
}
