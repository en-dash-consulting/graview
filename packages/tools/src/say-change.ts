import { labelOf, nodeRefArgs, pluralOf, type AnySchema, type Store } from "@graview/core";

/**
 * WHAT WILL HAPPEN, IN PLAIN WORDS (Roadmap f-menu-type-anything). The card
 * said "Mark it done — each of the 6 tasks in This week" while acting on
 * 5, and "Rename — on Book the van itself" without the name. It says the act
 * with its values and its exact records now: "Mark the 5 open tasks in This
 * week done.", "Rename to “Return the keys”.", "Move it to Today.", "Move
 * the date to Monday, Sep 7.", "Drop the 1 done task in This week." — from
 * the act's title, the values it was filled with, and the records it acts
 * on, counted as it will act on them.
 */
export interface ChangeSaid {
  readonly act: { readonly name: string; readonly title?: string; readonly input?: unknown; readonly subject?: { readonly arg: string } };
  readonly args: Readonly<Record<string, unknown>>;
  /** The records it will act on, as many as it will act on. */
  readonly records: readonly string[];
  /** Where they are ("in This week"), and what narrowed them ("open", "done"). */
  readonly where?: string;
  readonly narrowed?: string;
  /** Whether the words were about the record itself, said "it". */
  readonly itself?: boolean;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-07" → "Monday, Sep 7". */
export function dayWords(value: string): string | undefined {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!day) return undefined;
  const at = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
  return `${DAYS[at.getUTCDay()]}, ${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`;
}

/** The change said as one sentence, its values and its count in it. */
export function sayChange<S extends AnySchema>(store: Store<S>, change: ChangeSaid): string {
  const schema = store.schema as AnySchema;
  const nameOf = (id: string) => {
    const node = store.graph.getNode(id);
    return node ? labelOf(schema.tryDefinition(node.kind), node as never) : undefined;
  };
  const refs = nodeRefArgs(change.act.input);
  const subject = change.act.subject?.arg;
  // The values, said: a record by its name, a day by its name, words in quotes, a number as it is.
  const values = Object.entries(change.args)
    .filter(([arg, value]) => arg !== subject && value !== undefined && value !== null && value !== "")
    .map(([arg, value]) => {
      const ref = refs.find((one) => one.name === arg);
      if (ref && typeof value === "string") return { arg, said: nameOf(value) ?? value, ref: true };
      if (typeof value === "string") return { arg, said: dayWords(value) ?? `“${value}”`, ref: false };
      return { arg, said: String(value), ref: false };
    });
  const first = change.records[0] ? store.graph.getNode(change.records[0]) : undefined;
  const kind = first?.kind;
  const noun = kind ? ((schema.tryDefinition(kind) as { noun?: string } | undefined)?.noun ?? kind).toLowerCase() : "record";
  const count = change.records.length;
  const object =
    change.itself && count === 1 && change.records[0]
      ? (nameOf(change.records[0]) ?? "it")
      : `the ${count}${change.narrowed ? ` ${change.narrowed}` : ""} ${count === 1 ? noun : (kind ? pluralOf(schema, kind).toLowerCase() : "records")}${change.where ? ` ${change.where}` : ""}`;
  let words = (change.act.title ?? change.act.name).trim().replace(/[.!]+$/, "");
  // The records: where the title says "it" (or "the task", "this"), else just after its first word.
  const pronoun = /\b(it|this|the (?:task|list|shift|record|song|item))\b/i;
  // "Move the date" acts on a part of each: "Move the date of the 5 tasks in This week".
  words = pronoun.test(words) ? words.replace(pronoun, object) : /^\S+ the \w+$/i.test(words) ? `${words} of ${object}` : words.replace(/^(\S+)/, `$1 ${object}`);
  // The values: in place of "another …" where the title says so, else "to …", or "with …" for a person.
  for (const value of values) {
    if (/\b(?:to|into|on) another \w+/i.test(words)) words = words.replace(/\b(to|into|on) another \w+/i, `$1 ${value.said}`);
    else if (/\banother \w+/i.test(words)) words = words.replace(/\banother \w+/i, value.said);
    else words = `${words} ${value.ref && !/\bto\b/i.test(words) && /^(cover|assign|give)/i.test(words) ? "with" : "to"} ${value.said}`;
  }
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}
