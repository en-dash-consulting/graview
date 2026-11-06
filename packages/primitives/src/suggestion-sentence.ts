import { counted, fieldInPassing, humanizeValue, labelOf, nodeRefArgs, pluralOf, type AnyMutationDefinition, type AnySchema, type Lineage, type Suggestion } from "@graview/core";

/*
 * A SUGGESTION SAID AS ONE QUESTION (Roadmap f-suggestion-card-one-line).
 * A book app's inbox said one placement three times — "Graview, tidying
 * suggests Place in chapter: What I steer by", then "Jev: 0.95 that the in
 * chapter of … is …", then two chips naming both records — with its
 * confidence twice and a model's id. Here it is one sentence a person reads
 * at a glance, its records named in it so a page can make each a link:
 * "Put “What I steer by” in 09 · Without a Map?". Read off the call and the
 * declaration — the act that links, the relation's own words — never off
 * what the maker said, which is for "Why?". Here, beside the tray that
 * alone draws it, so a page carries none of it before the inbox opens.
 */

/**
 * WHY, IN WORDS ALONE: the maker's reason, without how sure it was or which
 * model — what a suggestion's "Why?" says. A basis written before 0.1.66
 * said the model and its probability first ("Jev: 0.95 that the chapter of
 * … is … (both name the lease)"); its reason is what was in the brackets.
 */
export function whyWords(lineage: Pick<Lineage, "basis">): string {
  const basis = lineage.basis.trim();
  const old = /^[^:]{1,40}: (?:\d(?:\.\d+)?|none|no)\b/i.test(basis);
  const reason = old ? (/\(([^()]+)\)\s*$/.exec(basis)?.[1] ?? "") : basis;
  // A reason that is a figure ("(0.62)") is no reason a person reads.
  if (!reason || /^[\d.\s%]+$/.test(reason)) return "No reason was kept.";
  const said = reason.charAt(0).toUpperCase() + reason.slice(1);
  return /[.!?]$/.test(said) ? said : `${said}.`;
}

/** A piece of the sentence: words, or a record named in it. `quoted` when the sentence puts it in quotes. */
export type SentencePart = string | { readonly record: string; readonly label: string; readonly quoted?: boolean };

/** What a suggestion would do, in one sentence. */
export interface SuggestionSentence {
  readonly parts: readonly SentencePart[];
  /** The sentence as plain text: an accessible name, a title. */
  readonly text: string;
  /** What several alike are grouped by: the same act, said the same way. */
  readonly group: string;
  /** Several alike, said together: "3 notes to put in chapters". */
  readonly many: (count: number) => string;
  /** The record it is about, when the sentence names one: what several about it stand under. */
  readonly subject?: { readonly record: string; readonly label: string };
  /** The sentence said under that record, without it: "Put in 09 · Without a Map?", "Set aside?". */
  readonly alone: readonly SentencePart[];
}

type Reads = { readonly schema: AnySchema; readonly graph: { getNode(id: string): unknown }; allMutations(): readonly AnyMutationDefinition<AnySchema>[] };
type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

/** Where a thing is put: "in", "under", "on". A relation that starts with one is said "Put A in B?". */
const PUT = new Set(["in", "into", "on", "onto", "under", "at", "within", "inside", "near", "beside", "behind", "over", "after", "before"]);
/** What follows a verb of a relation said as a verb: "waits for", "belongs to", "depends on". */
const AFTER_VERB = new Set(["for", "to", "on", "in", "with", "by", "from", "of", "after", "before", "into", "about", "under"]);

/** A relation's verb said after "Should": "waits" → "wait", "carries" → "carry", "goes" → "go". */
const base = (verb: string): string => (/ies$/.test(verb) ? verb.replace(/ies$/, "y") : /(ch|sh|x|ss|o)es$/.test(verb) ? verb.replace(/es$/, "") : verb.replace(/s$/, ""));

const lower = (words: string): string => (/^[A-Z][a-z]/.test(words) ? words.charAt(0).toLowerCase() + words.slice(1) : words);

/**
 * The suggestion as one question, with the records it names in it. A
 * suggestion of several calls, or of an act this cannot read, is its own
 * words — the act's sentence — as it was.
 */
export function suggestionSentence(store: Reads, suggestion: Pick<Suggestion, "calls" | "intent" | "lineage">): SuggestionSentence {
  const schema = store.schema;
  const node = (id: unknown): Node | undefined => (typeof id === "string" ? (store.graph.getNode(id) as Node | undefined) : undefined);
  const record = (one: Node, quoted = false): SentencePart => ({ record: one.id, label: labelOf(schema.tryDefinition(one.kind), one), ...(quoted ? { quoted: true } : {}) });
  const said = (parts: SentencePart[], group: string, many: (count: number) => string, about?: Node, alone?: SentencePart[]): SuggestionSentence => ({
    parts,
    text: parts.map((part) => (typeof part === "string" ? part : part.quoted ? `“${part.label}”` : part.label)).join(""),
    group,
    many,
    ...(about && alone ? { subject: { record: about.id, label: labelOf(schema.tryDefinition(about.kind), about) }, alone } : { alone: parts }),
  });
  const asItWas = said([suggestion.intent], `intent:${suggestion.intent}`, (count) => `${count} suggestions`);
  if (suggestion.calls.length !== 1) return asItWas;
  const call = suggestion.calls[0]!;
  const args = call.args as Readonly<Record<string, unknown>>;
  const act = store.allMutations().find((one) => one.name === call.name);
  const subjectArg = act?.subject?.arg;
  const subject = subjectArg ? node(args[subjectArg]) : undefined;
  if (!act || !subject) return asItWas;
  const kinds = (count: number) => counted(schema, subject.kind, count);
  const group = (way: string) => `${call.name}:${way}`;
  const farOf = () => {
    const refs = nodeRefArgs(act.input).filter((ref) => ref.name !== subjectArg && args[ref.name] !== undefined);
    return refs.length === 1 ? node(args[refs[0]!.name]) : undefined;
  };

  // A merge: "Merge “Acme” into Acme Supply?"
  const into = node(args["into"]);
  if (call.name === `merge-${subject.kind}` && into) return said(["Merge ", record(subject, true), " into ", record(into), "?"], group("merge"), (count) => `${kinds(count)} to merge`, subject, ["Merge into ", record(into), "?"]);
  // Set aside: "Set “Q3 offsite” aside?"
  if (call.name === `archive-${subject.kind}`) return said(["Set ", record(subject, true), " aside?"], group("archive"), (count) => `${kinds(count)} to set aside`, subject, ["Set aside?"]);

  // A link, through the relation the act connects.
  const far = farOf();
  const relation = act.connects?.find((one) => schema.tryDefinition(subject.kind)?.edges?.[one] !== undefined);
  if (far && relation) {
    const edge = schema.tryDefinition(subject.kind)!.edges![relation]!;
    const words = fieldInPassing(schema.tryDefinition(subject.kind) as never, relation).split(" ");
    const [first, second] = words;
    const farMany = lower(pluralOf(schema, far.kind));
    // "in chapter": put it there.
    if (first && PUT.has(first)) return said(["Put ", record(subject, true), ` ${first} `, record(far), "?"], group(`put:${first}`), (count) => `${kinds(count)} to put ${first} ${farMany}`, subject, [`Put ${first} `, record(far), "?"]);
    // "waits for": a verb.
    if (first && second && AFTER_VERB.has(second) && /[^s]s$/.test(first)) {
      const verb = [base(first), ...words.slice(1)].join(" ");
      return said(["Should ", record(subject, true), ` ${verb} `, record(far), "?"], group("verb"), (count) => `${kinds(count)} to link`, subject, [`${verb.charAt(0).toUpperCase()}${verb.slice(1)} `, record(far), "?"]);
    }
    // "venue", one: "Make Harbor Hall the venue of “Dinner”?"
    const noun = words.join(" ");
    if (edge.cardinality === "one") return said(["Make ", record(far), ` the ${noun} of `, record(subject, true), "?"], group("one"), (count) => `${kinds(count)} to give ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`, subject, ["Make ", record(far), ` the ${noun}?`]);
    return said(["Add ", record(far), ` to the ${noun} of `, record(subject, true), "?"], group("many"), (count) => `${kinds(count)} to link`, subject, ["Add ", record(far), ` to the ${noun}?`]);
  }

  // A choice filled in: "Mark “Fix the roof” as Urgent?"
  const values = Object.entries(args).filter(([name, value]) => name !== subjectArg && typeof value === "string" && !node(value));
  if (suggestion.lineage?.actor === "categorize" && values.length === 1) {
    const value = humanizeValue(String(values[0]![1]));
    return said(["Mark ", record(subject, true), ` as ${value}?`], group("mark"), (count) => `${kinds(count)} to mark`, subject, [`Mark as ${value}?`]);
  }
  return asItWas;
}

/**
 * A group of suggestions: the record several are about, named once to head
 * them (each then said without it), or the words that head several alike;
 * and each of them. One alone has neither.
 */
export interface SuggestionGroup<T> {
  readonly record?: { readonly record: string; readonly label: string };
  readonly words?: string;
  readonly suggestions: readonly T[];
}

/**
 * Several suggestions about the same record together under its name
 * (Roadmap f-suggestions-grouped-by-record) — put this note in a chapter,
 * link it to another, set it aside — and of the rest, several of the same
 * act said the same way together under one line, "3 notes to put in
 * chapters": a record two or more are about wins, since its name said
 * once is what each card repeated. In the order the first of each came;
 * one alone is a group of one, with no line of its own.
 */
export function suggestionGroups<T extends Pick<Suggestion, "calls" | "intent" | "lineage">>(store: Reads, suggestions: readonly T[]): readonly SuggestionGroup<T>[] {
  const said = suggestions.map((one) => ({ one, sentence: suggestionSentence(store, one) }));
  const about = new Map<string, number>();
  for (const { sentence } of said) if (sentence.subject) about.set(sentence.subject.record, (about.get(sentence.subject.record) ?? 0) + 1);
  const groups = new Map<string, { sentence: SuggestionSentence; byRecord: boolean; suggestions: T[] }>();
  for (const { one, sentence } of said) {
    const byRecord = sentence.subject !== undefined && about.get(sentence.subject.record)! > 1;
    const key = byRecord ? `record:${sentence.subject!.record}` : one.calls.length === 1 ? sentence.group : `one:${groups.size}`;
    const was = groups.get(key);
    if (was) was.suggestions.push(one);
    else groups.set(key, { sentence, byRecord, suggestions: [one] });
  }
  return [...groups.values()].map(({ sentence, byRecord, suggestions: some }) =>
    byRecord ? { record: sentence.subject!, suggestions: some } : some.length > 1 ? { words: sentence.many(some.length), suggestions: some } : { suggestions: some },
  );
}
