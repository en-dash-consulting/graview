/**
 * `@graview/core/compose` — ONE COHERENT LOOK, DERIVED FROM THE DECLARATION
 * (Roadmap f-design-composer).
 *
 * An app looked generic until somebody told a model, several times over, to
 * make it usable, intuitive and beautiful; and the advice a host answered
 * with was a table from a field's type to a lens, which only ever added. The
 * framework already draws a good default from the declaration — a home that
 * opens on the app's jobs, a card from a glance, the gallery of its places —
 * so what is left to propose is small, and is one proposal:
 *
 *   - `inferJobs(document | app)`: what the app's people most likely come to
 *     do, read off its kinds (a status that ends and a date it is due by; a
 *     flow's opening value; a relation many records lack), at most three,
 *     conservative, never drawn until a person declares them;
 *   - `composeDesign(document)`: those jobs where the app says none, the
 *     critic's own edits (`designFindings`: removals and hides first, a
 *     glance for the kind people see most where it lacks one, the home
 *     given what it needs to read first), and an accent where the brand has
 *     none — nothing the derived defaults already draw well. Applied with
 *     `editDocument`, the document compiles and the critic has no warning
 *     left to say.
 *
 * Off every page: a host proposes it (Graview Cloud's create and improve
 * tools), a person accepts it, and only then is it the declaration.
 */
import type { GraviewApp } from "./app.js";
import { designFindings } from "./document/design-findings.js";
import { editDocument, type DocumentEdit } from "./document/edit.js";
import { givesRelationAct } from "./document/relation-acts.js";
import type { GraviewDocument, KindSpec } from "./document/schema.js";
import { NAME } from "./document/schema.js";
import { toDocument } from "./document/to-document.js";
import { jobFindings, jobWorldOfDocument } from "./job-findings.js";
import type { JobDeclaration } from "./job-shape.js";
import { relationActName } from "./mutations/derived-names.js";
import { humanizeField } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import { accentProblem } from "./theme/accent.js";

export type { DocumentEdit } from "./document/edit.js";

/** The records an inference may count — a snapshot's or a seed's nodes and edges. Without them, nothing is inferred from data. */
export interface ComposeRecords {
  readonly nodes: readonly { readonly id: string; readonly kind: string }[];
  readonly edges: readonly { readonly kind: string; readonly from: string; readonly to: string }[];
}

export interface ComposeOptions {
  /** The app's records, so a relation many of them lack can be a job ("Which features have no area?"). */
  readonly records?: ComposeRecords;
}

/** The most jobs an inference proposes: a guess past three is no longer about what matters most. */
export const MOST_INFERRED_JOBS = 3;

/** A design proposed whole: the edits, in `propose_change`'s words, and why, a sentence each. */
export interface DesignProposal {
  readonly edits: readonly DocumentEdit[];
  readonly said: readonly string[];
}

/*
 * VALUES THAT END A RECORD'S WAY. Done-like ones are what people work
 * toward (and say: "not yet booked"); the ones that end it otherwise are
 * left out of a job's records but never named as its goal.
 */
const DONE = new Set(["done", "complete", "completed", "closed", "shipped", "booked", "paid", "finished", "resolved", "published", "delivered", "approved", "merged", "released", "signed", "won", "returned", "fixed", "filed"]);
const ENDED = new Set(["canceled", "cancelled", "declined", "rejected", "withdrawn", "abandoned", "lost", "dropped", "archived", "wontfix", "won't do", "duplicate"]);
/** A flow's opening values, as a question says them: "Which requests are still open?" */
const OPENING: Readonly<Record<string, string>> = { new: "new", open: "open", pending: "pending", submitted: "submitted", requested: "requested", proposed: "proposed", draft: "in draft", unread: "unread", waiting: "waiting", inbox: "in the inbox", todo: "to do", "to do": "to do", triage: "in triage", received: "received", unassigned: "unassigned" };
/** A date a record is due by — not the day it was written or happened. */
const DUE = /due|deadline|until|needed|needby|target|expires|^ends?(on|at)?$|^by$/i;

const said = (value: string) => value.trim().toLowerCase();
const kebab = (words: string) =>
  words
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const quote = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
/** A kind's words as the rest of the framework says them (`pluralOf`, `nounOf`): its own, else its name humanized. */
const nounOf = (document: GraviewDocument, kind: string) => document.kinds[kind]?.noun?.toLowerCase() ?? humanizeField(kind).toLowerCase();
const pluralOf = (document: GraviewDocument, kind: string) => document.kinds[kind]?.plural?.toLowerCase() ?? `${nounOf(document, kind)}s`;
const listed = (words: readonly string[], join = "or") => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} ${join} ${words[words.length - 1]}`);

type Acts = NonNullable<GraviewDocument["acts"]>;
const actsOn = (document: GraviewDocument, kind: string): [string, Acts[string]][] => Object.entries(document.acts ?? {}).filter(([, act]) => [act.on ?? []].flat().includes(kind));

/** A choice field that ends: some values a record is done at, some it is still on the way. */
function endingChoice(spec: KindSpec): { field: string; options: readonly string[]; done: readonly string[]; ended: readonly string[] } | undefined {
  // A choice that takes several (FR-233) is no status: a record is not in two stages at once.
  const choices = Object.entries(spec.fields).filter(([, field]) => field.type === "enum" && !field.multiple && Array.isArray(field.options) && field.options.length >= 2);
  // A field called a status, stage or state first; then any choice whose values end.
  const ranked = [...choices].sort(([a], [b]) => Number(/status|stage|state|phase/i.test(b)) - Number(/status|stage|state|phase/i.test(a)));
  for (const [field, choice] of ranked) {
    const options = choice.options!;
    const done = options.filter((value) => DONE.has(said(value)));
    const ended = options.filter((value) => ENDED.has(said(value)));
    if (done.length > 0 && done.length + ended.length < options.length) return { field, options, done, ended };
  }
  return undefined;
}

/** The act people take next to bring a record to one of these values: one that sets the field to it. */
function actSetting(document: GraviewDocument, kind: string, field: string, values: readonly string[]): string | undefined {
  return actsOn(document, kind).find(([, act]) => typeof act.sets?.[field] === "string" && values.includes(act.sets[field] as string))?.[0];
}

type Candidate = JobDeclaration & { readonly rank: number };

/** "Which vendors are due within a week and not yet booked?" — a choice that ends and the date a record is due by. */
function dueSoon(document: GraviewDocument, kind: string, spec: KindSpec): Candidate | undefined {
  const choice = endingChoice(spec);
  const due = Object.entries(spec.fields).find(([name, field]) => (field.type === "date" || field.type === "datetime") && DUE.test(name));
  if (!choice || !due) return undefined;
  const [date, field] = due;
  const ends = [...choice.done, ...choice.ended];
  const open = ends.length === 1 ? `${choice.field} != ${quote(ends[0]!)}` : `not (${choice.field} in [${ends.map(quote).join(", ")}])`;
  const day = field.type === "datetime" ? `date(${date})` : date;
  const act = actSetting(document, kind, choice.field, choice.done);
  return {
    rank: 0,
    name: `${kebab(kind)}-due-soon`,
    ask: `Which ${pluralOf(document, kind)} are due within a week and not yet ${listed(choice.done.map(said))}?`,
    kind,
    where: `${open} and days(today(), ${day}) <= 7`,
    sort: date,
    ...(act ? { act } : {}),
  };
}

/** "Which features have no area?" — a relation of one that many of the records lack. */
function lacking(document: GraviewDocument, kind: string, spec: KindSpec, records: ComposeRecords | undefined): Candidate | undefined {
  if (!records) return undefined;
  const ids = records.nodes.filter((node) => node.kind === kind).map((node) => node.id);
  if (ids.length < 4) return undefined;
  for (const [edge, relation] of Object.entries(spec.edges ?? {})) {
    if (relation.cardinality !== "one" || !Array.isArray(relation.to) || relation.to.length !== 1 || !document.kinds[relation.to[0]!]) continue;
    const linked = new Set(records.edges.filter((one) => one.kind === edge).map((one) => one.from));
    const without = ids.filter((id) => !linked.has(id)).length;
    // Many: a quarter of them or more, and at least three — a hole in the data, not one record waiting.
    if (without < 3 || without / ids.length < 0.25) continue;
    const declared = actsOn(document, kind).find(([, act]) => act.connects === edge)?.[0];
    const derived = relationActName("connect", kind, edge);
    const act = declared ?? (givesRelationAct(derived, document.kinds) ? derived : undefined);
    return {
      rank: 1,
      name: `${kebab(kind)}-without-${kebab(edge)}`,
      ask: `Which ${pluralOf(document, kind)} have no ${nounOf(document, relation.to[0]!)}?`,
      kind,
      where: `count(out(${quote(edge)})) == 0`,
      ...(act ? { act } : {}),
    };
  }
  return undefined;
}

/** "Which requests are still open?" — a flow whose first value is one a record waits at. */
function stillOpening(document: GraviewDocument, kind: string, spec: KindSpec): Candidate | undefined {
  const choice = endingChoice(spec);
  if (!choice || !/status|stage|state|phase/i.test(choice.field)) return undefined;
  const first = choice.options[0]!;
  const words = OPENING[said(first)];
  if (!words || choice.done.includes(first)) return undefined;
  const acts = actsOn(document, kind);
  // The act that moves a record on from it: allowed only there, else one that sets the field to another value.
  const act =
    acts.find(([, act]) => typeof act.allowedWhen === "string" && act.allowedWhen.includes(quote(first)) && act.sets?.[choice.field] !== undefined)?.[0] ??
    acts.find(([, act]) => typeof act.sets?.[choice.field] === "string" && act.sets[choice.field] !== first && !choice.ended.includes(act.sets[choice.field] as string))?.[0];
  const date = Object.entries(spec.fields).find(([, field]) => field.type === "date")?.[0];
  return {
    rank: 2,
    name: `${kebab(kind)}-still-${kebab(first)}`,
    ask: `Which ${pluralOf(document, kind)} are still ${words}?`,
    kind,
    where: `${choice.field} == ${quote(first)}`,
    ...(date ? { sort: date } : {}),
    ...(act ? { act } : {}),
  };
}

const isDocument = (source: GraviewDocument | GraviewApp<AnySchema>): source is GraviewDocument => (source as GraviewDocument).format === "graview-document";

/**
 * WHAT AN APP'S PEOPLE MOST LIKELY COME TO DO, read off its declaration (and
 * its records, where given): at most three jobs, one per kind, each one the
 * checker accepts. Conservative — a kind says a job only where its fields
 * leave no doubt:
 *
 *   - a choice that ends (done, booked, shipped…) and a date it is due by:
 *     "Which vendors are due within a week and not yet booked?";
 *   - a relation of one that a quarter or more of its records lack (with
 *     `records`): "Which features have no area?";
 *   - a status whose first value is one a record waits at (new, open,
 *     pending, draft…): "Which requests are still open?".
 *
 * Each names the act that answers it where the app has one. A proposal for a
 * person to accept (`add-job`): never drawn until it is declared.
 */
export function inferJobs(source: GraviewDocument | GraviewApp<AnySchema>, options: ComposeOptions = {}): JobDeclaration[] {
  const document = isDocument(source) ? source : toDocument(source).document;
  const world = jobWorldOfDocument(document);
  const candidates: Candidate[] = [];
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const found = dueSoon(document, kind, spec) ?? lacking(document, kind, spec, options.records) ?? stillOpening(document, kind, spec);
    if (!found || !NAME.test(found.name)) continue;
    // Only what the checker would accept: a where that reads, a sort it sorts by, an act on the kind.
    if (jobFindings({ jobs: [found] }, world).length > 0) continue;
    candidates.push(found);
  }
  return candidates
    .map((candidate, at) => ({ candidate, at }))
    .sort((a, b) => a.candidate.rank - b.candidate.rank || a.at - b.at)
    .slice(0, MOST_INFERRED_JOBS)
    .sort((a, b) => a.at - b.at)
    .map(({ candidate: { rank: _rank, ...job } }) => job);
}

/*
 * THE PALETTE AN APP WITH NO ACCENT IS GIVEN ONE FROM: eight hues, each one
 * that reads as a link on Graview's light and dark grounds (`accentProblem`),
 * picked by a stable hash of the app's name so the same app always gets the
 * same one and two apps side by side most likely differ.
 */
export const ACCENT_PALETTE = ["#0f6e5c", "#1d5fbf", "#8a3ffc", "#b5487a", "#2f7d32", "#5b6b12", "#0b6e8a", "#6d4bb3"] as const;

/** The palette's color for a name: the same name, the same color. */
export function accentFor(name: string): string {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length]!;
}

/** The most rounds the critic is asked again: each fixes what it said, and a fix can uncover one more. */
const MOST_ROUNDS = 40;

/**
 * ONE COHERENT DESIGN FOR A DOCUMENT, PROPOSED WHOLE: `{ edits, said }`. A
 * TypeScript app is read as the document it would be (`toDocument`), and
 * its brand, a whole palette, counts as a color of its own; its edits say
 * what to change in its code.
 *
 *   1. jobs (`add-job`), inferred by `inferJobs`, where the document says
 *      none — the derived home opens on them; a declared home is given a
 *      list answering each (the critic's `design-job-unanswered` edit);
 *   2. the critic's own edits (`designFindings`), asked again after each
 *      until it has no warning left: places that repeat removed, more than
 *      a person scans kept off the bar, the home given one thing to read
 *      first, cards that say only their name derived again, ids taken out,
 *      a glance for the kind people see most where it lacks a card;
 *   3. an accent (`set-brand`) only where the brand has none, from
 *      `ACCENT_PALETTE` by the app's name.
 *
 * Nothing the derived defaults already draw well. Every edit is one
 * `editDocument` accepts in turn, so applying `edits` gives a document that
 * compiles, on which `designFindings` warns of nothing. `said` gives the
 * reason for each, in a sentence a person reads before accepting.
 */
export function composeDesign(source: GraviewDocument | GraviewApp<AnySchema>, options: ComposeOptions = {}): DesignProposal {
  // A TypeScript app is read as the document it would be; its brand is a whole palette a document cannot carry, so it has a color of its own.
  const colored = isDocument(source) ? (source.brand as { readonly accent?: unknown } | undefined)?.accent !== undefined : source.brand !== undefined;
  let doc = isDocument(source) ? source : toDocument(source).document;
  const edits: DocumentEdit[] = [];
  const reasons: string[] = [];
  const applied = new Set<string>();
  const attempt = (edit: DocumentEdit): boolean => {
    const key = JSON.stringify(edit);
    if (applied.has(key) || edits.length >= 50) return false;
    applied.add(key);
    const outcome = editDocument(doc, [edit]);
    if (!outcome.ok) return false;
    doc = outcome.document;
    edits.push(edit);
    return true;
  };

  const declared = Array.isArray(doc.purpose?.jobs) ? doc.purpose.jobs : [];
  if (declared.length === 0) {
    for (const job of inferJobs(doc, options)) {
      const title = job.act ? doc.acts?.[job.act]?.title : undefined;
      if (attempt({ op: "add-job", job: job as unknown as Record<string, unknown> }))
        reasons.push(`Nothing says what this app's people come to do, so its home said only what it holds: "${job.ask}" is a job it can answer from its ${pluralOf(doc, job.kind)}${title ? `, with "${title}" offered on each` : job.act ? ", with the act that answers it offered on each" : ""}.`);
    }
  }

  for (let round = 0; round < MOST_ROUNDS; round += 1) {
    // One finding at a time, asked again after it: two edits worked out against the same home would undo each other.
    const next = designFindings(doc).find((finding) => finding.severity === "warning" && (finding.edits ?? []).some((edit) => !applied.has(JSON.stringify(edit))));
    if (!next) break;
    const took = (next.edits ?? []).map((edit) => attempt(edit as DocumentEdit)).some(Boolean);
    if (took) reasons.push(next.fix ? `${next.message} So: ${next.fix}.` : next.message);
  }

  if (!colored) {
    const accent = accentFor(doc.name);
    if (!accentProblem(accent) && attempt({ op: "set-brand", accent })) reasons.push(`The app has no color of its own, so it takes ${accent}, chosen from Graview's palette by its name ("${doc.name}"); set-brand says another.`);
  }

  return { edits, said: reasons };
}
