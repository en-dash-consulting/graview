/*
 * A RULE, SAID AS ITS SHAPE.
 *
 * A rule written in the rule language has a structure a person can read —
 * "margin ≥ target margin, when price > 0" — and that structure says more,
 * and says it more plainly, than a title an author wrote around it ("A
 * scenario keeps the target margin"). The line is worked out where the rule
 * is judged (`@graview/core/document`, beside the evaluator); what lives
 * here is only its shape and how it is joined into words, so a page that
 * draws a rule carries no parser and no evaluator to do it.
 *
 * Every symbol is one a person knows from arithmetic — ≥ ≤ < > = ≠, ∈ for
 * "is one of", — for nothing — and each carries the words a screen reader
 * says instead: "margin at least target margin".
 */

/** What a part of a rule's line is, for how it is drawn: a name quiet, a value plain, a symbol set apart. */
export type RulePartAs = "name" | "op" | "value" | "word" | "open" | "close";

export interface RulePart {
  readonly text: string;
  readonly as: RulePartAs;
  /** What it says aloud, where that is not the text: "at least" for ≥, "empty" for —. */
  readonly said?: string;
  /** Whether a space comes before it, as the words are spaced: none after "(", before ")", ",", ":" or "'s". */
  readonly space?: boolean;
}

/**
 * A rule's line: the kind it judges, what must hold and which records it
 * judges. On a violation, `record` names the record it found broken and the
 * parts carry that record's values, the comparison turned the way it
 * actually stands: "margin 9% < target margin 14%".
 */
export interface RuleLine {
  /** The kind it judges; absent for a rule over the whole graph. */
  readonly kind?: string;
  /** What must hold — or, on a violation, what was found instead. */
  readonly parts: readonly RulePart[];
  /** Only the records for which this holds are judged. Absent on a violation: the record was one of them. */
  readonly when?: readonly RulePart[];
  /** The record found broken, by its label. */
  readonly record?: string;
  /** The shape in words, without the record: "margin ≥ target margin, when price > $0". */
  readonly text: string;
  /** The same, said: "margin at least target margin, when price more than $0". */
  readonly said: string;
}

/**
 * Each part with whether a space comes before it — none after an opening
 * bracket, before a closing one, a comma, a colon or a possessive — so a
 * page drawing the parts one by one spaces them as the words are spaced.
 */
export function ruleSpacing(parts: readonly RulePart[]): readonly { readonly part: RulePart; readonly space: boolean }[] {
  const out: { part: RulePart; space: boolean }[] = [];
  let glue = true;
  for (const part of parts) {
    if (part.text.length === 0) continue;
    const tight = part.as === "close" || part.text === "," || part.text === ":" || part.text.startsWith("'") || glue;
    out.push({ part, space: !tight });
    glue = part.as === "open";
  }
  return out;
}

function joined(parts: readonly RulePart[], spoken: boolean): string {
  return ruleSpacing(parts)
    .map(({ part, space }) => `${space ? " " : ""}${spoken ? (part.said ?? part.text) : part.text}`)
    .join("");
}

/** The parts as a person reads them: "margin ≥ target margin". */
export function ruleText(parts: readonly RulePart[]): string {
  return joined(parts, false);
}

/** The parts as a screen reader says them: "margin at least target margin". */
export function ruleSpoken(parts: readonly RulePart[]): string {
  return joined(parts, true);
}

/**
 * The whole line in words: the record and what was found, or what must
 * hold and when. `spoken` says the symbols in words.
 */
export function ruleLineWords(line: RuleLine, spoken = false): string {
  const held = spoken ? line.said : line.text;
  return line.record !== undefined ? `${line.record} — ${held}` : held;
}

/** A line made whole: each part spaced as the words are, and the shape in words and said. */
export function finishedLine(line: Omit<RuleLine, "text" | "said">): RuleLine {
  const spaced = (parts: readonly RulePart[]) => ruleSpacing(parts).map(({ part, space }) => ({ ...part, space }));
  const parts = spaced(line.parts);
  const when = line.when && line.when.length > 0 ? spaced(line.when) : undefined;
  const say = (spoken: boolean) => `${joined(parts, spoken)}${when ? `, when ${joined(when, spoken)}` : ""}`;
  return { ...line, parts, ...(when ? { when } : {}), text: say(false), said: say(true) };
}

/**
 * WHAT A PROBLEM SAYS, in one line: the rule's shape with the record's own
 * values where the rule has one, else the sentence the rule wrote.
 */
export function problemWords(violation: { readonly message: string; readonly line?: RuleLine }, spoken = false): string {
  return violation.line ? ruleLineWords(violation.line, spoken) : violation.message;
}
