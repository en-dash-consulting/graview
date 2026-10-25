import { isAutomated, type AnySchema, type Author, type Store, type Via } from "@graview/core";
import { declined, suggest, suggestionKey, suggestions, withdrawSuggestion } from "@graview/core/tidying";
import type { HostAi } from "../ai.js";
import { askAll, type DreamBudget, type DreamCache, type DreamUsage } from "./asking.js";
import { blocksOf } from "./blocking.js";
import { asksOf, coverOf, type Judgment } from "./judging.js";
import { JUDGES, type Candidate, type Judge, type JudgeContext } from "./judges.js";
import { routeOf, type Band, type Route, type Severity } from "./policy.js";
import { nearOf, systemOneOf, type DreamModel } from "./system-one.js";

/*
 * DREAMING: the app's own actor, run while nobody is looking — a host's
 * nightly schedule, an alarm, `graview dream`. Code finds what is worth
 * asking about, far more widely than an exact match (`./blocking.ts`); a
 * System One model, when the host lends one, JUDGES each — the same thing
 * twice? which of these does it mean? finished? which option fits? — in one
 * request per candidate (`./judging.ts`); and code says what each answer
 * is enough for, by how much the change would undo (`./policy.ts`): made,
 * where the host let the actor apply that sure a change; suggested, to
 * wait in the Suggested tray for a person; or let go. Without a model, or
 * when it fails or the run's budget runs out, the judges' own rules are
 * the floor. The declaration says where the actor may never act
 * (`tidying`), never where it may act unasked, so applying is the host's
 * word, not the app's, and off unless said.
 */

/** "Graview, tidying": the app's own actor, as a run is made by unless a host names its own. */
export const TIDYING_ACTOR: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };

export interface DreamOptions {
  /** Who runs: an author that says `automated: true`. `TIDYING_ACTOR` when unsaid; a person is refused. */
  readonly principal?: Author;
  /** The judges to run, in order. Every one (`JUDGES`) when unsaid; a model judges only these judges' families. */
  readonly judges?: readonly Judge[];
  /** The System One model that judges, when the host lends one directly. */
  readonly model?: DreamModel;
  /** The host's AI, as a seat is handed it: its Fast slot (or `decide`) judges, and its `near` ranker widens the pairs. Ignored when it says `off`. */
  readonly ai?: HostAi;
  /**
   * How sure each severity must be to be made unasked, and to be asked at
   * all (`BANDS` when unsaid). A suggestion of this actor's still waiting
   * that falls below the band it is now asked at is withdrawn
   * (`withdrawSuggestion`): it leaves the tray, and is not declined.
   */
  readonly bands?: Partial<Record<Severity, Partial<Band>>>;
  /** Requests at once. 6 when unsaid. */
  readonly concurrency?: number;
  /** What a run may spend on the model: 60 requests and 200,000 input tokens when unsaid. */
  readonly budget?: DreamBudget;
  /** Where answers are kept between runs, by what was asked; one cache per process when unsaid, none with `false`. */
  readonly cache?: DreamCache | false;
  /** How much blocking puts forward: pairs (40), records (60), far records a relation chooses among (8). */
  readonly blocking?: { readonly maxPairs?: number; readonly maxRecords?: number; readonly maxTargets?: number };
  /** The run's moment. Now when unsaid. */
  readonly now?: Date | string | number;
  /** At most this many changes suggested or applied in one run, surest first. 20 when unsaid. */
  readonly limit?: number;
  /** A record changed within this many hours is left for now. 24 when unsaid. */
  readonly quietHours?: number;
  /** A record is a candidate to set aside after this many days unchanged. 30 when unsaid. */
  readonly olderThanDays?: number;
  /**
   * THE HOST LETS THE ACTOR APPLY what it is at least this sure of (0 to 1)
   * — and only what its severity's band says may be made unasked — with its
   * lineage, where the declaration and what people said allow it; the store
   * still refuses what they do not. Unsaid, nothing is applied: everything
   * sure enough is suggested.
   */
  readonly applyAtLeast?: number;
  /** What its changes come through, as the log records it. */
  readonly via?: Via;
}

/** What became of one judgment. */
export interface DreamOutcome {
  readonly judge: string;
  /**
   * suggested: waits for a person; applied: made, with lineage; dropped: not
   * sure enough to ask, or the model chose none; waiting: already
   * suggested; declined: a person said no before; withdrawn: a suggestion
   * of this actor's that waited, taken back because it is below the band
   * it is now asked at (`id`, the suggestion); refused: the store said no,
   * in `error`.
   */
  readonly outcome: "suggested" | "applied" | "dropped" | "waiting" | "declined" | "withdrawn" | "refused";
  readonly calls: Candidate["calls"];
  readonly basis: string;
  readonly confidence: number;
  readonly about: readonly string[];
  /** The model that judged it; absent when the judges' own rules did. */
  readonly model?: string;
  /** The op that holds a suggestion, or the batch that applied a change. */
  readonly id?: string;
  readonly error?: string;
}

/** What a run did, by judge, and in a sentence. */
export interface DreamReport {
  /**
   * The run, by its moment: on every change and suggestion it made, as
   * `lineage.run`, so Activity reads a night's work as one.
   */
  readonly run: string;
  readonly outcomes: readonly DreamOutcome[];
  readonly byJudge: Readonly<Record<string, { readonly suggested: number; readonly applied: number; readonly skipped: number }>>;
  /**
   * The model asked: how many requests it was put, how many it answered,
   * and its failure when it failed — what it did not answer was judged by
   * the judges' own rules.
   */
  readonly model?: { readonly name: string; readonly answered: boolean; readonly asks: number; readonly judged: number; readonly error?: string };
  /** What asking the model spent. */
  readonly usage?: DreamUsage;
  /** Said when the run's budget stopped the asking. */
  readonly budget?: string;
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

type Weighed = Candidate & { readonly severity: Severity; readonly model?: string; readonly split?: boolean; readonly none?: boolean };

/**
 * RUN THE APP'S OWN ACTOR ONCE. Blocking and a model, when lent, judge
 * the store as the actor sees it; the judges' rules judge what the model
 * did not; each judgment is routed by its confidence and severity, surest
 * first up to `limit`. A change a person declined is never asked again;
 * one already waiting is not asked twice; whatever the store refuses is
 * reported, not thrown. Call it on the store that keeps the log — a
 * server's, for a hosted app.
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

  // The model judges what blocking puts forward; what it answered is covered.
  const judged: Judgment[] = [];
  const covered = new Set<string>();
  const model = systemOneOf(options.model, options.ai);
  let modelSaid: DreamReport["model"];
  let usage: DreamUsage | undefined;
  let budget: string | undefined;
  if (model) {
    const blocks = await blocksOf(context, { families: new Set(judges.map((judge) => judge.name)), ...(nearOf(options.ai) ? { near: nearOf(options.ai)! } : {}), ...(options.blocking ?? {}) });
    const asks = asksOf(context.store, blocks);
    const asked = await askAll(model, asks, {
      ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
      ...(options.budget ? { budget: options.budget } : {}),
      ...(options.cache !== undefined ? { cache: options.cache } : {}),
    });
    let answered = 0;
    asks.forEach((ask, at) => {
      const answers = asked.answers[at];
      if (!answers) return;
      answered++;
      for (const cover of ask.covers) covered.add(cover);
      judged.push(...ask.read(answers, model.model));
    });
    modelSaid = { name: model.model, answered: answered > 0, asks: asks.length, judged: answered, ...(asked.error !== undefined ? { error: asked.error } : {}) };
    usage = asked.usage;
    if (asked.stopped) {
      const left = asks.length - answered;
      budget = `Stopped at the run's ${asked.stopped === "requests" ? "request" : "token"} budget after ${plural(asked.usage.requests, "request")}; ${plural(left, "candidate")} ${left === 1 ? "was" : "were"} left to the judges' own rules.`;
    }
  }

  // The judges' own rules, for whatever the model did not judge: the floor.
  const floor: Weighed[] = judges.flatMap((judge) => judge.judge(context).map((candidate) => ({ ...candidate, severity: judge.severity ?? "archive" }))).filter((candidate) => !covered.has(coverOf(candidate)));

  const outcomes: DreamOutcome[] = [];
  const said = (candidate: Weighed, outcome: DreamOutcome["outcome"], more: Partial<DreamOutcome> = {}) =>
    outcomes.push({ judge: candidate.judge, outcome, calls: candidate.calls, basis: candidate.basis, confidence: candidate.confidence, about: candidate.about, ...(candidate.model ? { model: candidate.model } : {}), ...more });

  /*
   * WHAT IT NO LONGER STANDS BY (Roadmap f-withdraw-own-suggestions): a
   * suggestion of this actor's still waiting, made when it was asked at a
   * lower bar, that is below the band it is asked at now — a host raised
   * merges to 0.8, and merges at 0.56 stayed in the tray. Withdrawn, so it
   * leaves the tray; not declined, so nobody is recorded as having said no.
   */
  const severities = new Map([...JUDGES, ...judges].map((judge) => [judge.name, judge.severity ?? "archive"] as const));
  for (const one of suggestions(whole)) {
    const judge = one.lineage?.actor;
    const confidence = one.lineage?.confidence;
    const severity = judge !== undefined ? severities.get(judge) : undefined;
    if (one.author.kind !== principal.kind || one.author.id !== principal.id || severity === undefined || typeof confidence !== "number") continue;
    if (routeOf(confidence, severity, options.bands) !== "drop") continue;
    const candidate: Weighed = { judge: judge!, calls: one.calls, basis: one.lineage?.basis ?? "", confidence, about: one.about, severity, ...(one.lineage?.model ? { model: one.lineage.model } : {}) };
    try {
      withdrawSuggestion(whole, one.id, { author: principal, ...(options.via ? { via: options.via } : {}) });
      said(candidate, "withdrawn", { id: one.id });
    } catch (error) {
      said(candidate, "refused", { id: one.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const waiting = new Set(suggestions(whole).map((one) => suggestionKey(one.calls)));
  const fresh: { readonly candidate: Weighed; readonly route: Route; readonly at: number }[] = [];
  const seen = new Set<string>();
  for (const candidate of [...judged, ...floor] as Weighed[]) {
    if (candidate.none || candidate.calls.length === 0) {
      said(candidate, "dropped");
      continue;
    }
    const key = suggestionKey(candidate.calls);
    if (seen.has(key)) continue;
    seen.add(key);
    if (declined(whole, candidate.calls)) said(candidate, "declined");
    else if (waiting.has(key)) said(candidate, "waiting");
    else {
      const route = routeOf(candidate.confidence, candidate.severity, options.bands, candidate.split === true);
      if (route === "drop") said(candidate, "dropped");
      else fresh.push({ candidate, route, at: fresh.length });
    }
  }

  const limit = options.limit ?? 20;
  const ranked = [...fresh].sort((a, b) => b.candidate.confidence - a.candidate.confidence || a.at - b.at).slice(0, limit);
  // A record merged away in this run is not merged, or merged into, again.
  const mergedAway = new Set<string>();
  const run = new Date(now).toISOString();
  for (const { candidate, route } of ranked) {
    const merge = candidate.judge === "duplicates" ? (candidate.calls[0]?.args as { id?: string; into?: string } | undefined) : undefined;
    if (merge && (mergedAway.has(String(merge.id)) || mergedAway.has(String(merge.into)))) {
      said(candidate, "dropped", { error: "One of the two was already proposed to merge into another in this run." });
      continue;
    }
    const lineage = { basis: candidate.basis, confidence: candidate.confidence, run, actor: candidate.judge, ...(candidate.model ? { model: candidate.model } : {}) };
    try {
      if (route === "act" && options.applyAtLeast !== undefined && candidate.confidence >= options.applyAtLeast) {
        const result = whole.applyAll(candidate.calls, { author: principal, lineage, ...(options.via ? { via: options.via } : {}) });
        said(candidate, "applied", { id: result.batch });
      } else {
        const op = suggest(whole, candidate.calls, { author: principal, lineage, ...(options.via ? { via: options.via } : {}) });
        if (op) said(candidate, "suggested", { id: op.id });
      }
      if (merge) mergedAway.add(String(merge.id));
    } catch (error) {
      said(candidate, "refused", { error: error instanceof Error ? error.message : String(error) });
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
  const withdrawn = outcomes.filter((one) => one.outcome === "withdrawn").length;
  return {
    run,
    outcomes,
    byJudge,
    ...(modelSaid ? { model: modelSaid } : {}),
    ...(usage ? { usage } : {}),
    ...(budget ? { budget } : {}),
    applying:
      options.applyAtLeast === undefined
        ? "Nothing was applied: the host did not let the actor apply on its own (applyAtLeast), so every change sure enough to ask about was suggested."
        : `Changes at least ${options.applyAtLeast} sure, and sure enough for how much they would undo, were applied where the app and its people allow it.`,
    said:
      suggested + applied + withdrawn === 0
        ? "Nothing to tidy."
        : [suggested > 0 ? `Suggested ${plural(suggested, "change")}` : "", applied > 0 ? `applied ${plural(applied, "change")}` : "", withdrawn > 0 ? `withdrew ${plural(withdrawn, "suggestion")} now below the bar` : ""]
            .filter(Boolean)
            .join(" and ")
            .replace(/^[aw]/, (first) => first.toUpperCase()) + ".",
  };
}
