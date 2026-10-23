import { isAutomated, labelOf, type AnySchema, type Author, type Store, type Via } from "@graview/core";
import { declined, suggest, suggestionKey, suggestions } from "@graview/core/tidying";
import type { Decide } from "../providers/jev.js";
import type { Question } from "../questions.js";
import { JUDGES, type Candidate, type Judge, type JudgeContext } from "./judges.js";

/*
 * DREAMING: the app's own actor, run while nobody is looking — a host's
 * nightly schedule, an alarm, `graview dream`. The judges find what it
 * would change; a model, when the host lends one, may raise or lower how
 * sure each is; then each is SUGGESTED (`suggest`), to wait in the
 * Suggested tray for a person, unless the host said the actor may apply
 * what it is very sure of. The declaration says where the actor may never
 * act (`tidying`), never where it may act unasked, so applying is the
 * host's word, not the app's, and off unless said.
 */

/** "Graview, tidying": the app's own actor, as a run is made by unless a host names its own. */
export const TIDYING_ACTOR: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };

/** A model that may raise or lower a candidate's confidence: the Fast slot's shape (`FastProvider`) — its name, and typed questions in. */
export interface DreamModel {
  readonly model: string;
  readonly decide: Decide;
}

export interface DreamOptions {
  /** Who runs: an author that says `automated: true`. `TIDYING_ACTOR` when unsaid; a person is refused. */
  readonly principal?: Author;
  /** The judges to run, in order. Every one (`JUDGES`) when unsaid. */
  readonly judges?: readonly Judge[];
  /** Asked once per run, all candidates at once; its answer is averaged with the judge's. Without one, the judges' own confidence stands. */
  readonly model?: DreamModel;
  /** The run's moment. Now when unsaid. */
  readonly now?: Date | string | number;
  /** At most this many changes suggested or applied in one run, surest first. 20 when unsaid. */
  readonly limit?: number;
  /** A record changed within this many hours is left for now. 24 when unsaid. */
  readonly quietHours?: number;
  /** A finished record is a candidate to set aside after this many days. 30 when unsaid. */
  readonly olderThanDays?: number;
  /**
   * THE HOST LETS THE ACTOR APPLY what it is at least this sure of (0 to 1),
   * with its lineage, where the declaration and what people said allow it;
   * the store still refuses what they do not. Unsaid, nothing is applied:
   * everything is suggested.
   */
  readonly applyAtLeast?: number;
  /** What its changes come through, as the log records it. */
  readonly via?: Via;
}

/** What became of one candidate. */
export interface DreamOutcome {
  readonly judge: string;
  /** suggested: waits for a person; applied: made, with lineage; waiting: already suggested; declined: a person said no before; refused: the store said no, in `error`. */
  readonly outcome: "suggested" | "applied" | "waiting" | "declined" | "refused";
  readonly calls: Candidate["calls"];
  readonly basis: string;
  readonly confidence: number;
  readonly about: readonly string[];
  /** The op that holds a suggestion, or the batch that applied a change. */
  readonly id?: string;
  readonly error?: string;
}

/** What a run did, by judge, and in a sentence. */
export interface DreamReport {
  /**
   * The run, by its moment. HOOK(run id): the suggestion shape does not yet
   * carry a run, so this is not on the ops; when it does, `suggest` is
   * handed it here.
   */
  readonly run: string;
  readonly outcomes: readonly DreamOutcome[];
  readonly byJudge: Readonly<Record<string, { readonly suggested: number; readonly applied: number; readonly skipped: number }>>;
  /** The model asked, and whether it answered. */
  readonly model?: { readonly name: string; readonly answered: boolean; readonly error?: string };
  /** Why nothing was applied, when nothing could be. */
  readonly applying: string;
  /** "Suggested 3 changes and applied 1." */
  readonly said: string;
}

/** When each record was last changed, from the log. */
export function touchedIn(store: Pick<Store<AnySchema>, "log">): Map<string, number> {
  const touched = new Map<string, number>();
  for (const op of store.log.all()) {
    const at = Date.parse(op.at);
    if (Number.isNaN(at)) continue;
    for (const id of op.writes) touched.set(id, Math.max(at, touched.get(id) ?? 0));
  }
  return touched;
}

const plural = (count: number, one: string) => `${count === 1 ? "one" : count} ${one}${count === 1 ? "" : "s"}`;

/** What every candidate of a run would be asked of a model: one yes-or-no each, over the records it names. */
function questionsFor(store: Store<AnySchema>, candidates: readonly Candidate[]): { readonly state: unknown; readonly questions: Record<string, Question> } {
  const name = (id: string) => {
    const node = store.graph.getNode(id) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
    return node ? { id, kind: node.kind, label: labelOf(store.schema.tryDefinition(node.kind), node) } : { id };
  };
  const questions: Record<string, Question> = {};
  candidates.forEach((candidate, at) => {
    questions[`c${at}`] = {
      type: "noul",
      instructions: `Should the app make this change on its own judgment? ${candidate.calls.map((call) => `${call.name} ${JSON.stringify(call.args)}`).join("; ")}. Based on: ${candidate.basis}.`,
      criteria: { true: "the records plainly call for it", false: "it would be wrong, or a person would want to decide" },
    };
  });
  return { state: { candidates: candidates.map((candidate, at) => ({ key: `c${at}`, basis: candidate.basis, records: candidate.about.map(name) })) }, questions };
}

/**
 * RUN THE APP'S OWN ACTOR ONCE. The judges read the store as the actor
 * sees it, a model (when lent) weighs in, and each candidate, surest first
 * up to `limit`, is suggested — or applied, with its lineage, where the
 * host let the actor apply what it is that sure of. A change a person
 * declined is never asked again; one already waiting is not asked twice;
 * whatever the store refuses is reported, not thrown. Call it on the store
 * that keeps the log — a server's, for a hosted app.
 */
export async function dream<S extends AnySchema>(store: Store<S>, options: DreamOptions = {}): Promise<DreamReport> {
  const whole = store as unknown as Store<AnySchema>;
  const principal = options.principal ?? TIDYING_ACTOR;
  if (!isAutomated(principal)) throw new Error("Only the app's own actor dreams: an author that says automated: true (a system or agent seat, never a person).");
  const now = options.now === undefined ? Date.now() : new Date(options.now).getTime();
  const context: JudgeContext = {
    store: whole.seenBy(principal),
    now,
    touched: touchedIn(whole),
    quietFor: (options.quietHours ?? 24) * 60 * 60 * 1000,
    olderThanDays: options.olderThanDays ?? 30,
  };
  const judges = options.judges ?? JUDGES;
  const waiting = new Set(suggestions(whole).map((one) => suggestionKey(one.calls)));
  const outcomes: DreamOutcome[] = [];
  const said = (candidate: Candidate, outcome: DreamOutcome["outcome"], more: Partial<DreamOutcome> = {}) => outcomes.push({ judge: candidate.judge, outcome, calls: candidate.calls, basis: candidate.basis, confidence: candidate.confidence, about: candidate.about, ...more });
  // What the judges found, less what was declined or already waits: asked of nobody again.
  const fresh: Candidate[] = [];
  const seen = new Set<string>();
  for (const judge of judges) {
    for (const candidate of judge.judge(context)) {
      const key = suggestionKey(candidate.calls);
      if (seen.has(key)) continue;
      seen.add(key);
      if (declined(whole, candidate.calls)) said(candidate, "declined");
      else if (waiting.has(key)) said(candidate, "waiting");
      else fresh.push(candidate);
    }
  }
  // A model, when lent, weighs every candidate in one call; without its answer the judges' own stand.
  let weighed = fresh;
  let model: DreamReport["model"];
  if (options.model && fresh.length > 0) {
    try {
      const { state, questions } = questionsFor(context.store, fresh);
      const { answers } = await options.model.decide(state, questions);
      weighed = fresh.map((candidate, at) => {
        const answer = answers[`c${at}`];
        return answer?.type === "noul" ? { ...candidate, confidence: Math.round(((candidate.confidence + answer.noul) / 2) * 100) / 100 } : candidate;
      });
      model = { name: options.model.model, answered: true };
    } catch (error) {
      model = { name: options.model.model, answered: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  const limit = options.limit ?? 20;
  const ranked = weighed.map((candidate, at) => ({ candidate, at })).sort((a, b) => b.candidate.confidence - a.candidate.confidence || a.at - b.at).slice(0, limit);
  const named = model?.answered ? { model: model.name } : {};
  for (const { candidate } of ranked) {
    const lineage = { basis: candidate.basis, confidence: candidate.confidence, ...named };
    try {
      if (options.applyAtLeast !== undefined && candidate.confidence >= options.applyAtLeast) {
        const result = whole.applyAll(candidate.calls, { author: principal, lineage, ...(options.via ? { via: options.via } : {}) });
        said(candidate, "applied", { confidence: candidate.confidence, id: result.batch });
      } else {
        const op = suggest(whole, candidate.calls, { author: principal, lineage, ...(options.via ? { via: options.via } : {}) });
        if (op) said(candidate, "suggested", { confidence: candidate.confidence, id: op.id });
      }
    } catch (error) {
      said(candidate, "refused", { confidence: candidate.confidence, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const byJudge: Record<string, { suggested: number; applied: number; skipped: number }> = {};
  for (const judge of judges) byJudge[judge.name] = { suggested: 0, applied: 0, skipped: 0 };
  for (const one of outcomes) {
    const tally = (byJudge[one.judge] ??= { suggested: 0, applied: 0, skipped: 0 });
    if (one.outcome === "suggested") tally.suggested++;
    else if (one.outcome === "applied") tally.applied++;
    else tally.skipped++;
  }
  const suggested = outcomes.filter((one) => one.outcome === "suggested").length;
  const applied = outcomes.filter((one) => one.outcome === "applied").length;
  return {
    run: new Date(now).toISOString(),
    outcomes,
    byJudge,
    ...(model ? { model } : {}),
    applying: options.applyAtLeast === undefined ? "Nothing was applied: the host did not let the actor apply on its own (applyAtLeast), so every change was suggested." : `Changes at least ${options.applyAtLeast} sure were applied where the app and its people allow it.`,
    said: suggested + applied === 0 ? "Nothing to tidy." : [suggested > 0 ? `Suggested ${plural(suggested, "change")}` : "", applied > 0 ? `applied ${plural(applied, "change")}` : ""].filter(Boolean).join(" and ").replace(/^a/, "A") + ".",
  };
}
