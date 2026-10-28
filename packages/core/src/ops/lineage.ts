import { GraphError } from "../graph/graph.js";

/**
 * WHAT A CHANGE WAS BASED ON, AND HOW SURE ITS MAKER WAS (FR-172).
 *
 * An author says who moved; it is the same for every change a seat makes,
 * so it cannot say why THIS one was made. A background actor that links
 * and prunes on its own ("Graview, tidying") owes the reader a reason per
 * change — "both name the Harbor Street lease" — and a measure of how far
 * to trust it. Lineage is that, kept on the op beside its author: in the
 * log, on the wire, on the history line and the record's page.
 *
 * `confidence` is 0 to 1; one below 1 makes what the op links PROVISIONAL
 * until a person touches it (`linkProvenance`). Absent, the maker did not
 * say, and nothing is drawn quieter for it. `model` names what judged it,
 * when a model did. The framework records, draws and explains; it never
 * decides what to link.
 *
 * A key this build does not know is a later build's, and is kept as it was
 * said (`lineageOf`), so what a newer client says reaches every reader
 * through an older store. It folds nothing.
 *
 * What draws a link or a history line reads `provenance.ts`; only the check
 * every change is held to lives here, so a page carries the rest when it
 * draws.
 */
export interface Lineage {
  readonly basis: string;
  readonly confidence?: number;
  readonly model?: string;
  /**
   * THE SUGGESTION THIS CHANGE ACCEPTED: the id of the op that proposed it
   * (`acceptSuggestion`, `@graview/core/tidying`), so the log says which suggestion became
   * which change and the suggestion is no longer waiting.
   */
  readonly suggestion?: string;
  /**
   * THE AI INTERACTION THIS CHANGE CAME FROM (`ai:<interaction>`): the id of
   * the entry Activity draws (`AiInteraction`, `@graview/core/catalog`), so
   * a change a person accepted from the inline AI is read back to the ask,
   * the offer and the model that made it, and taken back from that entry.
   */
  readonly interaction?: string;
  /**
   * WHICH AUTOMATED ACTOR, OR WHICH OF ITS JUDGES, MADE THE CALL: "links by
   * shared address", "duplicates". The author says who moved — "Graview,
   * tidying" for everything the app's own actor does — and this says which
   * of its judgments this one was, so a reader can weigh one judge apart
   * from the others. 1–120 characters.
   */
  readonly actor?: string;
  /**
   * THE RUN IT WAS MADE IN: one id for everything an actor applied and
   * suggested in one pass (a night's tidying), so the pass reads, and is
   * weighed, as one unit. 1–120 characters.
   */
  readonly run?: string;
  /**
   * THE RECORDS THE BASIS RESTS ON, by id: the email, the invoice, the two
   * records that share an address. At most 50, each 1–120 characters. An id
   * here is one the op names, so a seat that may not see one of them is
   * served the op withheld, as for any id an op names.
   */
  readonly evidence?: readonly string[];
  /**
   * THE FIELDS THE BASIS READ, as `<id>#<field>`: "Both have the code
   * 7731" read each record's code. A basis is words, and words carry what
   * they quote, so a seat whose sight keeps one of these fields is served
   * the op withheld, as for an act's sentence that read one (`described`).
   * At most 200, each 3–240 characters.
   */
  readonly read?: readonly string[];
  /**
   * WHO VOTED FOR THE SUGGESTION THIS CHANGE MADE (Roadmap
   * f-suggestion-votes): the ids of the people whose standing votes were
   * for it when the app's own actor made it at the declaration's
   * `autoAcceptAt`. At most 200, each 1–120 characters. A person's id may
   * be a record's, which the op then names as it names any id.
   */
  readonly voters?: readonly string[];
}

/** The longest basis an op keeps: a reason, not a transcript. */
export const LINEAGE_BASIS_LIMIT = 500;
/** The longest model name an op keeps; and the longest actor, run, suggestion, interaction or evidence id. */
export const LINEAGE_MODEL_LIMIT = 120;
/** The most records a lineage names as its evidence. */
export const LINEAGE_EVIDENCE_LIMIT = 50;
/** The most fields a lineage says its basis read. */
export const LINEAGE_READ_LIMIT = 200;
/** The most people a lineage names as having voted for the suggestion it made. */
export const LINEAGE_VOTERS_LIMIT = 200;
/** The longest a whole lineage is, written out as JSON: what bounds the keys a later build adds. */
export const LINEAGE_LIMIT = 4000;

/** The keys that name something in 1–120 characters. */
const NAMES = ["model", "suggestion", "interaction", "actor", "run"];

/** A string of 1–120 characters. */
const isName = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= LINEAGE_MODEL_LIMIT;

/** A field a basis read: `<id>#<field>`, 3–240 characters. */
const isFieldRead = (value: unknown): value is string => typeof value === "string" && value.length <= 240 && value.lastIndexOf("#") > 0 && value.lastIndexOf("#") < value.length - 1;

/** A value as JSON keeps it — a copy, so nothing the caller holds changes the op — or undefined when JSON keeps nothing of it. */
const asJson = (value: unknown): unknown => {
  const text = JSON.stringify(value);
  return text === undefined ? undefined : JSON.parse(text);
};

/**
 * A lineage as an op keeps it — the basis and model trimmed, a key this
 * build does not know kept as JSON keeps it (a later build's) — or a
 * GraphError: a basis of 1–500 characters, a confidence from 0 to 1, a
 * model, suggestion, interaction, actor and run of 1–120 characters,
 * evidence of at most 50 such ids, the fields its basis read as at most
 * 200 `<id>#<field>`, voters of at most 200 such ids, no key that would reach a prototype, and
 * the whole at most 4000 characters written out. Asked before anything is
 * kept; nothing said is no lineage.
 */
export function lineageOf(value: unknown): Lineage | undefined {
  if (value === undefined) return undefined;
  const given = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const basis = typeof given["basis"] === "string" ? given["basis"].trim() : "";
  const kept: Record<string, unknown> = { basis };
  let fits = basis !== "" && basis.length <= LINEAGE_BASIS_LIMIT;
  for (const key of Object.keys(given)) {
    let said = given[key];
    // One said as undefined was not said.
    if (key === "basis" || said === undefined) continue;
    if (key === "model" && typeof said === "string") said = said.trim();
    if (key === "confidence") fits &&= typeof said === "number" && said >= 0 && said <= 1;
    else if (NAMES.includes(key)) fits &&= isName(said);
    else if (key === "evidence") fits &&= Array.isArray(said) && said.length <= LINEAGE_EVIDENCE_LIMIT && said.every(isName);
    else if (key === "read") fits &&= Array.isArray(said) && said.length <= LINEAGE_READ_LIMIT && said.every(isFieldRead);
    else if (key === "voters") fits &&= Array.isArray(said) && said.length <= LINEAGE_VOTERS_LIMIT && said.every(isName);
    else fits &&= key !== "__proto__" && key !== "constructor" && key !== "prototype" && (said = asJson(said)) !== undefined;
    if (fits) kept[key] = said;
  }
  if (!fits) throw new GraphError("A lineage is { basis: 1 to 500 characters, confidence?: 0 to 1, model?, suggestion?, interaction?, actor?, run?: 1 to 120 characters, evidence?: up to 50 ids, read?: up to 200 <id>#<field>, voters?: up to 200 ids }");
  if (JSON.stringify(kept).length > LINEAGE_LIMIT) throw new GraphError(`A lineage is at most ${LINEAGE_LIMIT} characters written out.`);
  return kept as unknown as Lineage;
}
