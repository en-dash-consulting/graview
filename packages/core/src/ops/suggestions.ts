import type { MutationCall } from "../mutations/types.js";
import type { Lineage } from "./lineage.js";
import { undoneIn } from "./log.js";
import type { Author, Operation } from "./types.js";

/*
 * THE SUGGESTIONS WAITING IN A LOG (`@graview/core/tidying`): read only by
 * what draws or answers them — the Suggested tray, an agent's tools — so
 * apart from what the store holds the actor to (`tidying.ts`), and none
 * of a page's weight before one is drawn.
 */

/** A suggestion that waits: what it proposes, who proposed it, on what basis, and how sure. */
export interface Suggestion {
  /** The id of the op that holds it: what `acceptSuggestion` and `declineSuggestion` take. */
  readonly id: string;
  readonly batch: string;
  readonly calls: readonly MutationCall[];
  /** What it would do, in the acts' own sentences. */
  readonly intent: string;
  readonly author: Author;
  readonly lineage?: Lineage;
  readonly at: string;
  /** The records its calls name, so a tray can point at them. */
  readonly about: readonly string[];
}

/**
 * THE SUGGESTIONS STILL WAITING in a log, oldest first: each op that
 * suggests, unless an op accepted it (its lineage names it, whether or not
 * that was taken back later) or a live undo declined it. A withheld op is
 * no suggestion for the seat it was withheld from. `has` keeps, of the ids
 * its calls name, the records (`about`).
 */
export function suggestionsIn(ops: readonly Operation[], has: (id: string) => boolean = () => true): Suggestion[] {
  const undone = undoneIn(ops);
  const accepted = new Set(ops.map((op) => op.lineage?.suggestion));
  return ops
    .filter((op) => op.suggests && !op.withheld && !undone.has(op.id) && !accepted.has(op.id))
    .map(({ id, batch, suggests, intent, author, lineage, at }) => {
      const about = new Set<string>();
      // Every string its calls hold, kept where it is a record.
      JSON.stringify(suggests!.map((call) => call.args), (_, value) => (typeof value === "string" && has(value) && about.add(value), value));
      return { id, batch, calls: suggests!, intent, author, ...(lineage ? { lineage } : {}), at, about: [...about] };
    });
}
