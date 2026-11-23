import { agoWords } from "./ago-words.js";
import { TOUCHED_FIELDS, touchedOf, untouched } from "./graph/touched.js";

/**
 * WHEN AND BY WHOM A RECORD WAS LAST CHANGED, SAID ONCE (Graview HQ
 * feature:f-touched-size-on-agent-read-surfaces). A record keeps four
 * values the framework writes (`createdAt`, `createdBy`, `updatedAt`,
 * `updatedBy`, `graph/touched.ts`), about 155 characters of JSON on every
 * record: on a page of records a model reads, that is most of what the
 * page says. Where a model reads many records at once — the agent's page
 * of the graph, the facts an inline ask is told, a host's own page of
 * found records — each says one entry instead, `changed: "3 days ago by
 * Ann"`. A read of one record (`get_node`) keeps all four.
 */
export const CHANGED = "changed";

/** Who a `…By` value is, where nothing names it as a record: by what it is, never by an id. */
const WHO_WORDS: Readonly<Record<string, string>> = { someone: "someone", human: "someone", agent: "an agent", rule: "a rule", system: "the system", visitor: "a visitor" };

export interface ChangedOptions {
  /** The moment "3 days ago" is counted back from. Unsaid, the clock's. */
  readonly now?: string | number | Date;
  /**
   * The words for who: given a `…By` value as the reader is told it (the
   * record of the person, for a model `touchesSaid`), its name — none where
   * it names nobody this reader may be told, who is then "someone".
   */
  readonly name?: (who: string) => string | undefined;
}

/** "3 days ago by Ann", "just now by an agent", "yesterday": when a record was last changed and by whom; none where it says no time. */
export function changedWords(node: unknown, options: ChangedOptions = {}): string | undefined {
  const { updatedAt, updatedBy } = touchedOf(node);
  if (updatedAt === undefined) return undefined;
  const when = agoWords(updatedAt, options.now ?? Date.now());
  if (updatedBy === undefined) return when;
  return `${when} by ${options.name?.(updatedBy) ?? WHO_WORDS[updatedBy] ?? "someone"}`;
}

/**
 * A record with its four said once: without them, and with `changed`
 * (`changedWords`) where it says a time. The record itself where it holds
 * none of the four, or holds a value of its own under `changed`, which is
 * never written over.
 */
export function changedOnce<N extends object>(node: N, options: ChangedOptions = {}): N {
  const record = node as Record<string, unknown>;
  if (!TOUCHED_FIELDS.some((key) => Object.hasOwn(record, key)) || Object.hasOwn(record, CHANGED)) return node;
  const said = changedWords(node, options);
  const out = untouched(node);
  return (said === undefined ? out : { ...out, [CHANGED]: said }) as N;
}
