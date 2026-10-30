import { labelOf, nodeRefArgs, pluralOf, type AnySchema, type Store } from "@graview/core";
import { peopleKinds } from "./graph-plan.js";

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
  readonly act: { readonly name: string; readonly title?: string; readonly input?: unknown; readonly subject?: { readonly arg: string }; readonly describe?: (args: never, graph: never) => string };
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
  /*
   * ONE RECORD: the act's own sentence for it, where the app wrote one
   * ("Bo Ferreira steps back", "Move "Book the van" to Today"), its quotes
   * made a person's and its days said by name. A title is not a sentence
   * about a record: "They have stepped back" read as "They Bo Ferreira…".
   */
  if (change.records.length === 1 && typeof change.act.describe === "function" && change.act.subject) {
    try {
      const said = change.act.describe({ ...change.args, [change.act.subject.arg]: change.records[0] } as never, store.graph as never);
      if (typeof said === "string" && said.trim()) {
        // A record's name in quotes, so it is never read as the act's own words ("Move “Move the broadband” to Someday"); a person's name as it is.
        const people = peopleKinds(store);
        // The record acted on is quoted; where it goes ("to Someday") is said as it is.
        const named = [change.records[0]!]
          .filter((id) => store.graph.getNode(id) !== undefined)
          .map((id) => store.graph.getNode(id)!)
          .filter((node) => !people.includes(node.kind))
          .map((node) => labelOf(schema.tryDefinition(node.kind), node as never))
          .sort((a, b) => b.length - a.length);
        let quoted = said.trim().replace(/"([^"]*)"/g, "“$1”");
        for (const name of named) if (!quoted.includes(`“${name}”`)) quoted = quoted.replace(name, `“${name}”`);
        const words = quoted
          .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (day) => dayWords(day) ?? day)
          .replace(/[.!]+$/, "");
        return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
      }
    } catch {
      // A sentence that could not be written for these values: the title, said below.
    }
  }
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
      if (ref && typeof value === "string") {
        const node = store.graph.getNode(value);
        const name = nameOf(value) ?? value;
        return { arg, said: node ? name : value, ref: true };
      }
      if (typeof value === "string") return { arg, said: dayWords(value) ?? `“${value}”`, ref: false };
      return { arg, said: String(value), ref: false };
    });
  const first = change.records[0] ? store.graph.getNode(change.records[0]) : undefined;
  const kind = first?.kind;
  const noun = kind ? ((schema.tryDefinition(kind) as { noun?: string } | undefined)?.noun ?? kind).toLowerCase() : "record";
  const count = change.records.length;
  const object =
    change.itself && count === 1 && change.records[0]
      ? (nameOf(change.records[0]) ? `“${nameOf(change.records[0])}”` : "it")
      : `the ${count}${change.narrowed ? ` ${change.narrowed}` : ""} ${count === 1 ? noun : (kind ? pluralOf(schema, kind).toLowerCase() : "records")}${change.where ? ` ${change.where}` : ""}`;
  let words = (change.act.title ?? change.act.name).trim().replace(/[.!]+$/, "");
  // The records: where the title says "it" (or "the task", "this"), else just after its first word.
  const pronoun = /\b(it|this|the (?:task|list|shift|record|song|item))\b/i;
  // A title that is a sentence about its record ("They have stepped back", "It is done"): the record in the pronoun's place.
  if (/^(they|it|this|she|he|somebody|someone)\b/i.test(words)) {
    words = words.replace(/^(they|it|this|she|he|somebody|someone)\b/i, object).replace(/^(\S.*?)\s+\b(have|are)\b/i, (_, who: string, verb: string) => `${who} ${count === 1 ? (verb.toLowerCase() === "have" ? "has" : "is") : verb}`);
    return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
  }
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

/**
 * NOTHING TO CHANGE, SAID FROM THE RECORDS: where every record is already as
 * the act would leave it, the card says what each already is — "“Order
 * boxes” is already done.", "Ada Nowak's status is already available." —
 * from the fields the act writes and their values now, never the act's
 * title in quotes or a record "itself".
 */
export function sayNothingToChange<S extends AnySchema>(store: Store<S>, act: { readonly writes?: readonly string[] }, records: readonly string[]): string {
  const schema = store.schema as AnySchema;
  const people = peopleKinds(store);
  const nameOf = (id: string) => {
    const node = store.graph.getNode(id);
    if (!node) return id;
    const name = labelOf(schema.tryDefinition(node.kind), node as never);
    return people.includes(node.kind) ? name : `“${name}”`;
  };
  const field = act.writes?.[0];
  const first = records[0] ? (store.graph.getNode(records[0]) as Record<string, unknown> | undefined) : undefined;
  const value = field && first ? first[field] : undefined;
  const who = records.length === 1 ? nameOf(records[0]!) : `All ${records.length} of them`;
  const are = records.length === 1 ? "is" : "are";
  if (field && typeof value === "boolean") return `Nothing to change: ${who} ${are} already ${value ? "" : "not "}${field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}.`;
  if (field && (typeof value === "string" || typeof value === "number")) return `Nothing to change: ${records.length === 1 ? `${who}'s` : "their"} ${field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)} ${are === "is" ? "is" : "are"} already ${dayWords(String(value)) ?? value}.`;
  return `Nothing to change: ${who} ${are} already as that would leave ${records.length === 1 ? "it" : "them"}.`;
}

/** Said where an instruction found nothing here to do it with. */
export const CANNOT_DO_IT = "I can't do that here: nothing in this app does what you asked. Try saying it another way.";

/** Words that tell of a change as made ("is taken off the shift", "has been moved", "Marked it done"), with no "can't" or "not" in them. */
export function saysDone(text: string): boolean {
  if (/\b(can'?t|cannot|couldn'?t|won'?t|not|no|isn'?t|doesn'?t|don'?t|unable|nothing|never)\b/i.test(text)) return false;
  return /\b(is|are|was|were|has been|have been|got|gets)\s+(now\s+)?(\w+ed|done|taken|set|put|given|made|gone|off|out|away|moved|removed)\b/i.test(text) || /^(i'?ve|i have|done|marked|moved|removed|archived|renamed|assigned|added|scheduled|deleted|dropped|finished|closed|updated|changed|set|put|took|taken)\b/i.test(text.trim()) || /\b(i'?ve|i have)\s+\w+ed\b/i.test(text);
}

/** Words that say someone or something is not here. */
const ABSENT = /\b(not in (this|the) app|isn'?t in (this|the) app|is not in (this|the) app|not (yet )?(a|one of the) (user|member|person|people|volunteer|record)s?|doesn'?t exist|does not exist|no one (called|named)|nobody (called|named)|not found|no such|there is no|there'?s no|no (user|person|member|volunteer|record|one) (called|named))\b/i;

/**
 * NEVER SOMETHING FALSE ABOUT THE APP: the records an answer says are not
 * here, where the graph holds them — "Sam is not in this app yet" while Sam
 * is one of its users. Answers the records it named and said were absent.
 */
export function claimedAbsent<S extends AnySchema>(store: Store<S>, text: string): readonly { readonly id: string; readonly name: string; readonly kind: string }[] {
  if (!ABSENT.test(text)) return [];
  const schema = store.schema as AnySchema;
  const people = peopleKinds(store);
  const words = text.toLowerCase();
  return store.graph
    .allNodes()
    .flatMap((node) => {
      const name = labelOf(schema.tryDefinition(node.kind), node as never);
      const first = name.split(/\s+/)[0]!;
      const named = name.length >= 3 && (words.includes(name.toLowerCase()) || (people.includes(node.kind) && first.length >= 3 && new RegExp(`\\b${first.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")}\\b`, "u").test(words)));
      return named ? [{ id: node.id, name, kind: node.kind }] : [];
    })
    .slice(0, 5);
}
