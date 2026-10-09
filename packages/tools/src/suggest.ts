import { counted, labelOf, nounOf, withArticle, type AnySchema, type Store, type Violation } from "@graview/core";
import type { Affordance } from "./types.js";

/**
 * WHAT THE SEAT OFFERS BEFORE ANYBODY ASKS — a few things, in the reader's
 * words, built from the graph.
 *
 * The seat opened on every act the selected record had: nine buttons, nine
 * stars, a filter field and "Show 1 more", in the mutations' own words. A
 * person reading it learned what the declaration could do, not what was
 * worth doing here. Opened with nothing asked, it says one plain line
 * about where the reader is, offers at most three questions the graph can
 * answer about it, and at most three acts — the repairs a broken rule names
 * for this very thing, and the ones the reader pinned. Everything else is
 * one question, the context menu, or Pages' "What can be done" away.
 *
 * Pure: the store it is handed is already the one the reader may see
 * (`store.seenBy(principal)`), so nothing here names what they may not.
 */

/** At most this many of each: suggestions, and acts offered unprompted. */
export const SEAT_OFFERS = 3;

/** What the seat is about: a record, a kind, a place, or the whole thing. */
export interface SeatSubject {
  /** A node id, `kind:<kind>`, `aggregate:<kind>`, or null for the whole thing. */
  readonly id: string | null;
  /** How the subject is said: a record's name, a place's title, a kind's plural. */
  readonly name: string;
}

export interface SuggestInput<S extends AnySchema> {
  readonly store: Pick<Store<S>, "schema" | "graph">;
  readonly subject: SeatSubject;
  /** The rules broken right now, as the reader may see them. */
  readonly violations: readonly Violation[];
  /** The place the reader is looking at, when the picture is one. */
  readonly place?: { readonly title: string; readonly kind?: string } | null;
}

/**
 * Why a suggestion is offered. B1's are answered by the graph's own
 * responder; "go", "due" and "draw" are the ones the seat will offer once
 * it can take the reader somewhere and draw a view (see the seat-guide
 * epic), each added here behind what the seat can do.
 */
export type SuggestionWhy = "problem" | "about" | "here" | "go" | "due" | "draw";

export interface Suggestion {
  /** What pressing it asks, in the reader's words. */
  readonly ask: string;
  readonly why: SuggestionWhy;
}

/** The record the subject names, when it names one. */
function recordOf<S extends AnySchema>(store: SuggestInput<S>["store"], subject: SeatSubject) {
  return subject.id ? store.graph.getNode(subject.id) : undefined;
}

/** The kind a card id names — `kind:task`, `aggregate:task`. */
function kindOfCard(id: string | null): string | undefined {
  if (!id) return undefined;
  const match = /^(?:kind|aggregate):([^:]+)$/.exec(id);
  return match?.[1];
}

/** The rule broken on this very record, if one is. */
function problemOn(violations: readonly Violation[], id: string | null): Violation | undefined {
  if (!id) return undefined;
  return violations.find((violation) => violation.nodeIds.includes(id) || violation.subjectId === id);
}

const sentenceOf = (text: string): string => {
  const said = text.trim();
  if (!said) return said;
  const first = said.charAt(0).toUpperCase() + said.slice(1);
  return /[.!?…]$/.test(first) ? first : `${first}.`;
};

/**
 * ONE PLAIN LINE ABOUT WHERE THE READER IS: the problem on what they are
 * looking at first, else what it is — a record and its kind, a place and
 * how much is on it, or the whole thing by its largest kinds.
 */
export function whereLine<S extends AnySchema>({ store, subject, violations, place }: SuggestInput<S>): string {
  const record = recordOf(store, subject);
  const problem = problemOn(violations, record?.id ?? null);
  if (problem) return sentenceOf(problem.message);
  if (record) {
    const kind = record.kind as string;
    return `${labelOf(store.schema.tryDefinition(kind), record)}, ${withArticle(nounOf(store.schema.tryDefinition(kind), kind))}.`;
  }
  const kind = place?.kind ?? kindOfCard(subject.id);
  if (kind) {
    const count = store.graph.nodesOfKind(kind as never).length;
    const title = place?.title ?? subject.name;
    const plural = store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;
    const said = counted(store.schema, kind, count);
    return title.toLowerCase() === plural.toLowerCase() ? `${count === 1 ? "There is" : "There are"} ${said} here.` : `${title}: ${said}.`;
  }
  const kinds = (store.schema.kinds as readonly string[])
    .map((one) => ({ kind: one, count: store.graph.nodesOfKind(one as never).length }))
    .filter((one) => one.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  if (kinds.length === 0) return "Nothing here yet.";
  const said = kinds.map((one) => counted(store.schema, one.kind, one.count));
  return `Everything: ${said.length === 1 ? said[0] : `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`}.`;
}

/**
 * AT MOST THREE THINGS TO ASK, each one the graph can answer about where
 * the reader is: what is wrong with it (only when something is), what it
 * is (a record), or what is here (a place). None when none applies — the
 * line stands alone.
 */
export function suggestionsFor<S extends AnySchema>(input: SuggestInput<S>): readonly Suggestion[] {
  const { store, subject, violations } = input;
  const record = recordOf(store, subject);
  const out: Suggestion[] = [];
  if (record && problemOn(violations, record.id)) out.push({ ask: `What's wrong with ${subject.name}?`, why: "problem" });
  else if (violations.length > 0) out.push({ ask: "What needs attention?", why: "problem" });
  if (record) out.push({ ask: `Tell me about ${subject.name}`, why: "about" });
  else out.push({ ask: "What is here?", why: "here" });
  return out.slice(0, SEAT_OFFERS);
}

export interface OfferedAct {
  readonly affordance: Affordance;
  /** The act in the declaration's words, said about the subject. */
  readonly label: string;
}

/**
 * THE ACTS OFFERED UNPROMPTED: the repairs a broken rule names for this
 * thing, then the ones the reader pinned — at most three, never one that
 * cannot be taken back first. Everything else is asked for.
 */
export function offeredActs<S extends AnySchema>(
  affordances: readonly Affordance[],
  { store, subject }: { readonly store: Pick<Store<S>, "schema" | "graph" | "allMutations">; readonly subject: SeatSubject },
): readonly OfferedAct[] {
  const about = (affordance: Affordance) => subject.id !== null && (affordance.nodeIds.includes(subject.id) || Object.values(affordance.args).includes(subject.id));
  const repairs = affordances.filter((affordance) => affordance.provider === "invariant" && about(affordance));
  const pinned = affordances.filter((affordance) => affordance.pinned === "user" && !repairs.includes(affordance));
  const chosen = [...repairs, ...pinned].sort((a, b) => Number(a.destructive ?? false) - Number(b.destructive ?? false));
  return chosen.slice(0, SEAT_OFFERS).map((affordance) => ({ affordance, label: sayAct(affordance, { store, subject }) }));
}

/** A label that is a mutation's name rather than words: `move-to-list`, `moveToList`. */
const machineWord = (label: string): boolean => /^[a-z0-9]+(?:[-_][a-z0-9]+)+$|^[a-z]+[A-Z][A-Za-z0-9]*$/.test(label);

/**
 * AN ACT, SAID ABOUT THE THING IT IS OFFERED ON. The act's own sentence
 * where it has one and nothing is left to ask ("Finish “Pay the deposit”");
 * else its title with "it" named ("Give Pay the deposit a new date"); never
 * the mutation's name — a title nobody wrote is spoken, and `graview
 * check` says so (`act-without-title`).
 */
export function sayAct<S extends AnySchema>(
  affordance: Affordance,
  { store, subject }: { readonly store: Pick<Store<S>, "graph" | "allMutations">; readonly subject: SeatSubject },
): string {
  let label = affordance.label;
  const named = machineWord(label) || label === affordance.mutation;
  if (named) {
    const spoken = label.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
    label = spoken.charAt(0).toUpperCase() + spoken.slice(1);
  }
  const record = subject.id ? store.graph.getNode(subject.id) : undefined;
  const onSubject = record !== undefined && affordance.nodeIds.length <= 1 && (affordance.nodeIds[0] ?? record.id) === record.id;
  if (onSubject && /\bit\b/.test(label)) return label.replace(/\bit\b/, subject.name);
  /* A title with no "it" to name, or no title at all: the act's own sentence, where nothing is left to ask. */
  const mutation = store.allMutations().find((one) => one.name === affordance.mutation);
  if (affordance.open.length === 0 && mutation?.describe && (named || onSubject)) {
    try {
      const said = mutation.describe(affordance.args as never, store.graph as never);
      if (said.trim()) return said.trim();
    } catch {
      // A sentence that cannot be said for these arguments: the title.
    }
  }
  return label;
}
