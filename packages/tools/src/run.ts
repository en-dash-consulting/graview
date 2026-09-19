import { isCurrent, labelOf, type AnySchema, type Principal, type Store, type Violation } from "@graview/core";
import type { ToolCall } from "./agent/tools.js";
import { applyPlan, planFrom, type AppliedPlan, type Plan, type PlanOptions, type PlannedCall } from "./plan.js";
import type { Answer, Decide, Decided } from "./providers/jev.js";
import { jevCostUsd } from "./providers/jev.js";
import type { ChatReply } from "./conversation.js";
import {
  nodeState,
  pairQuestion,
  questionsForInvariant,
  questionsForKind,
  questionsForMutation,
  scoreToValue,
  type DerivedQuestion,
  type OfferedQuestion,
  type Question,
} from "./questions.js";

/**
 * A RUN IS A SEQUENCE OF TYPED ASKS OVER THE GRAPH, DECLARED NOT SCRIPTED.
 *
 * This is the thing a context graph buys that a chat box cannot. A run is
 * steps: select nodes by a rule, ask each the questions the declaration
 * already types, turn the answers into calls, land them as one batch,
 * re-evaluate. Fan-out is the ordinary case — output is unmetered, so
 * "fill every unset field of every zone" is one step and not a loop
 * somebody writes — and because every step's output is typed, a step can
 * be judged before the next one runs.
 *
 * A run READS before it runs: how many nodes, how many questions, roughly
 * what it will cost — and refuses to begin one its budget cannot afford,
 * because a fan-out over four hundred questions is a fraction of a cent
 * and a run that does not stop is not.
 *
 * A run holds the Decide it started with for its whole length. Switching
 * the rung underneath it does not move it: a run half done on one rung
 * does not silently finish on another.
 */

export type RunStep =
  | {
      /** Fill the typed fields of every node of this kind. */
      readonly fill: string;
      /** Only these fields; every typed one otherwise. */
      readonly fields?: readonly string[];
      /** Which nodes. Every current one otherwise. */
      readonly where?: (node: { readonly id: string; readonly kind: string } & Record<string, unknown>) => boolean;
      /** Ask about fields already set, too. Unset ones only otherwise. */
      readonly including?: "unset" | "all";
    }
  | {
      /** Ask the remaining arguments of this act, once per node of `over` as its subject. */
      readonly ask: string;
      readonly over: string;
      readonly where?: (node: { readonly id: string; readonly kind: string } & Record<string, unknown>) => boolean;
      /** Arguments already settled for a node; the rest are asked. */
      readonly given?: (node: { readonly id: string; readonly kind: string } & Record<string, unknown>) => Readonly<Record<string, unknown>>;
    }
  | {
      /** For every current violation of this rule, choose a repair from the closed set it names. */
      readonly judge: string;
    }
  | {
      /** Ask, for every (subject, other) pair, whether this joining act holds — a matrix. */
      readonly pair: string;
      readonly over: string;
      readonly against: string;
      readonly where?: (a: { readonly id: string } & Record<string, unknown>, b: { readonly id: string } & Record<string, unknown>) => boolean;
      /** The truth above which the pair is a call. 0.5 otherwise. */
      readonly threshold?: number;
    };

export interface RunDeclaration {
  readonly name: string;
  readonly steps: readonly RunStep[];
  /** What this run may spend. A run over budget does not begin. */
  readonly budget?: { readonly questions?: number; readonly usd?: number };
}

/** One answer, where it came from, and the call it became (if any). */
export interface Answered {
  readonly step: number;
  readonly nodeId?: string;
  readonly question: DerivedQuestion;
  readonly answer: Answer;
  /** 0–1: how sure. A truth's is its distance from even. */
  readonly confidence: number;
  readonly call?: PlannedCall;
  /** Set when the answer was offered to a person rather than planned. */
  readonly offered?: OfferedQuestion;
}

export interface StepOutcome {
  readonly step: number;
  readonly what: string;
  /** The nodes visited, in order. */
  readonly nodes: readonly string[];
  readonly asked: number;
  readonly answered: readonly Answered[];
  readonly proposals: readonly PlannedCall[];
  /** What was not sure enough to propose: questions for a person, at their nodes. */
  readonly questions: readonly OfferedQuestion[];
  /** The step's calls, ordered and judged — what a person reviews. */
  readonly plan: Plan;
  /** Set when the step landed (each-step mode): what it made, under which batch. */
  readonly applied?: Pick<AppliedPlan<AnySchema>, "batch" | "applied" | "made" | "stoppedAt">;
}

export interface RunReading {
  readonly name: string;
  readonly steps: readonly { readonly step: number; readonly what: string; readonly nodes: number; readonly questions: number; readonly calls: number }[];
  readonly questions: number;
  readonly calls: number;
  /** A rough figure: the JSON that would be sent, at four characters a token. */
  readonly approxInputTokens: number;
  readonly approxUsd: number;
  /** Why the run would not begin, if it would not. */
  readonly refused?: string;
}

export interface RunOptions<S extends AnySchema> extends PlanOptions<S> {
  readonly decide: Decide;
  /** Who the run writes as. `agent:<run name>:run-<time>` otherwise. */
  readonly author?: Principal;
  /**
   * "review": every step's calls are planned and returned, nothing is
   * applied — a person reviews the plan and lands it as one batch.
   * "each-step": each step lands under the run's one batch before the next
   * step is asked, so a later step sees an earlier one's answers. Both are
   * one batch and one undo.
   */
  readonly land?: "review" | "each-step";
  /** Judge a step's typed outcome before the next runs. A string stops the run and is the reason. */
  readonly judge?: (outcome: StepOutcome) => true | string;
  /** The seat's own announcement path: every visit to a node is a read here. */
  readonly onCall?: (call: ToolCall) => void;
  readonly batch?: string;
  readonly today?: string;
  /** Below this confidence an answer is offered rather than planned. 0.5 otherwise. */
  readonly floor?: number;
  /** Two options this close in probability are a split — a question, not an answer. 0.15 otherwise. */
  readonly splitWithin?: number;
}

export interface RunResult<S extends AnySchema> {
  readonly name: string;
  readonly author: Principal;
  readonly batch: string;
  readonly reading: RunReading;
  readonly steps: readonly StepOutcome[];
  /** Every step's calls as one plan, for review — or what was applied. */
  readonly plan: Plan;
  /** Every question offered to a person, across the steps. */
  readonly questions: readonly OfferedQuestion[];
  readonly applied?: AppliedPlan<S>;
  readonly usage: { readonly questions: number; readonly calls: number; readonly inputTokens: number; readonly usd: number };
  /** Why the run stopped early, if it did. */
  readonly stopped?: { readonly at: number; readonly why: string };
  readonly refused?: string;
}

type AnyNode = { readonly id: string; readonly kind: string } & Record<string, unknown>;

/** How sure, 0–1, to three places — a truth's is its distance from even. */
const confidenceOf = (answer: Answer): number =>
  Math.round((answer.type === "noul" ? Math.abs(answer.noul - 0.5) * 2 : answer.confidence) * 1000) / 1000;

/** The distribution, highest first, as options a person could take. */
const distributionOf = (answer: Answer): readonly { readonly value: string; readonly probability: number }[] => {
  if (answer.type === "noul") {
    return [
      { value: "yes", probability: answer.noul },
      { value: "no", probability: 1 - answer.noul },
    ].sort((a, b) => b.probability - a.probability);
  }
  return Object.entries(answer.probabilities)
    .map(([value, probability]) => ({ value, probability }))
    .sort((a, b) => b.probability - a.probability);
};

/**
 * WHY AN ANSWER IS A QUESTION. A split — the top two options within
 * `within` of each other — is a question for a person, not an answer with
 * a low number beside it; and an answer below the floor is a shrug. Either
 * is offered. Undefined means it is an answer.
 */
export function offerOf(answer: Answer, options: { readonly floor?: number; readonly splitWithin?: number } = {}): "split" | "unsure" | undefined {
  const floor = options.floor ?? 0.5;
  const within = options.splitWithin ?? 0.15;
  const [first, second] = distributionOf(answer);
  if (first && second && first.probability - second.probability <= within) return "split";
  if (confidenceOf(answer) < floor) return "unsure";
  return undefined;
}

/** The answer as the value the argument wants. */
export function valueOf(question: DerivedQuestion, answer: Answer): unknown {
  switch (answer.type) {
    case "choice":
      return answer.choice;
    case "noul":
      return answer.noul >= 0.5;
    case "score":
      return scoreToValue({ min: question.scale?.min ?? 0 }, answer.score);
    default:
      return undefined;
  }
}

function currentOfKind<S extends AnySchema>(store: Store<S>, kind: string, today?: string): AnyNode[] {
  const definition = store.schema.tryDefinition(kind);
  return (store.graph.nodesOfKind(kind as never) as unknown as AnyNode[]).filter((node) =>
    isCurrent(definition, node, today),
  );
}

/**
 * THE QUESTIONS A STEP ASKS, per node, without asking them — so a run can
 * be read before it is run and refused before it costs anything.
 */
function questionsOfStep<S extends AnySchema>(
  store: Store<S>,
  step: RunStep,
  today?: string,
): { readonly what: string; readonly visits: readonly { readonly nodeId?: string; readonly state: unknown; readonly questions: readonly DerivedQuestion[]; readonly violation?: Violation }[] } {
  if ("fill" in step) {
    const nodes = currentOfKind(store, step.fill, today).filter((node) => step.where?.(node) ?? true);
    const all = questionsForKind(store, step.fill).filter((q) => q.about === "field" && q.writes !== undefined);
    const visits = nodes.map((node) => ({
      nodeId: node.id,
      state: nodeState(store, node.id),
      questions: all.filter((q) => {
        if (q.about !== "field") return false;
        if (step.fields && !step.fields.includes(q.field)) return false;
        if ((step.including ?? "unset") === "unset") {
          const held = node[q.field];
          return held === undefined || held === null || held === "";
        }
        return true;
      }),
    }));
    return { what: `fill ${step.fields ? step.fields.join(", ") : "every typed field"} of every ${step.fill}`, visits: visits.filter((v) => v.questions.length > 0) };
  }
  if ("ask" in step) {
    const mutation = store.mutation(step.ask);
    const subjectArg = mutation.subject?.arg;
    const nodes = currentOfKind(store, step.over, today).filter((node) => step.where?.(node) ?? true);
    const visits = nodes.map((node) => {
      const given = { ...(subjectArg ? { [subjectArg]: node.id } : {}), ...(step.given?.(node) ?? {}) };
      return { nodeId: node.id, state: nodeState(store, node.id), questions: questionsForMutation(store, step.ask, given) };
    });
    return { what: `ask "${mutation.title ?? step.ask}" of every ${step.over}`, visits: visits.filter((v) => v.questions.length > 0) };
  }
  if ("judge" in step) {
    const violations = store.violations().filter((v) => v.invariant === step.judge);
    const visits = violations.map((violation) => ({
      ...(violation.subjectId ? { nodeId: violation.subjectId } : {}),
      state: {
        ...(violation.subjectId ? nodeState(store, violation.subjectId) : {}),
        broken: violation.message,
        implicated: violation.nodeIds.map((id) => {
          const node = store.graph.getNode(id);
          return node ? labelOf(store.schema.tryDefinition(node.kind as string), node as never) : id;
        }),
      },
      questions: questionsForInvariant(store, step.judge, violation).filter((q) => q.about === "repair"),
      violation,
    }));
    return { what: `judge every violation of "${step.judge}"`, visits: visits.filter((v) => v.questions.length > 0) };
  }
  const subjects = currentOfKind(store, step.over, today);
  const others = currentOfKind(store, step.against, today);
  const visits: { nodeId: string; state: unknown; questions: DerivedQuestion[] }[] = [];
  for (const a of subjects) {
    const questions: DerivedQuestion[] = [];
    for (const b of others) {
      if (step.where && !step.where(a, b)) continue;
      const question = pairQuestion(store, step.pair, a.id, b.id);
      if (question) questions.push(question);
    }
    if (questions.length > 0) {
      const state = { ...nodeState(store, a.id), against: others.map((b) => ({ id: b.id, ...nodeState(store, b.id) })) };
      visits.push({ nodeId: a.id, state, questions });
    }
  }
  return { what: `ask "${store.mutation(step.pair).title ?? step.pair}" of every ${step.over} against every ${step.against}`, visits };
}

/** What a run would do, counted, before it does any of it. */
export function readRun<S extends AnySchema>(store: Store<S>, run: RunDeclaration, options: { readonly today?: string } = {}): RunReading {
  const steps = run.steps.map((step, index) => {
    const { what, visits } = questionsOfStep(store, step, options.today);
    const questions = visits.reduce((sum, visit) => sum + visit.questions.length, 0);
    const chars = visits.reduce(
      (sum, visit) => sum + JSON.stringify({ state: visit.state, questions: Object.fromEntries(visit.questions.map((q) => [q.id, q.question])) }).length,
      0,
    );
    return { step: index, what, nodes: visits.length, questions, calls: visits.length, chars };
  });
  const questions = steps.reduce((sum, step) => sum + step.questions, 0);
  const calls = steps.reduce((sum, step) => sum + step.calls, 0);
  const approxInputTokens = Math.ceil(steps.reduce((sum, step) => sum + step.chars, 0) / 4);
  const approxUsd = jevCostUsd(approxInputTokens);
  let refused: string | undefined;
  if (run.budget?.questions !== undefined && questions > run.budget.questions) {
    refused = `This run would ask ${questions} questions and its budget is ${run.budget.questions}. It did not begin.`;
  } else if (run.budget?.usd !== undefined && approxUsd > run.budget.usd) {
    refused = `This run would cost about $${approxUsd.toFixed(4)} and its budget is $${run.budget.usd}. It did not begin.`;
  }
  return {
    name: run.name,
    steps: steps.map(({ chars: _chars, ...step }) => step),
    questions,
    calls,
    approxInputTokens,
    approxUsd,
    ...(refused ? { refused } : {}),
  };
}

/** A run's reading, in words a person can weigh before pressing. */
export function describeRun(reading: RunReading): string {
  const lines = [
    `${reading.name}: ${reading.questions} questions over ${reading.calls} calls, about $${reading.approxUsd.toFixed(4)}.`,
    ...reading.steps.map((step) => `${step.step + 1}. ${step.what} — ${step.nodes} node${step.nodes === 1 ? "" : "s"}, ${step.questions} question${step.questions === 1 ? "" : "s"}.`),
  ];
  if (reading.refused) lines.push(`REFUSED: ${reading.refused}`);
  return lines.join("\n");
}

/** The calls one visit's answers become. */
function callsFrom<S extends AnySchema>(
  store: Store<S>,
  step: RunStep,
  visit: { readonly nodeId?: string; readonly questions: readonly DerivedQuestion[]; readonly violation?: Violation },
  answers: Readonly<Record<string, Answer>>,
  index: number,
  sureness: { readonly floor?: number; readonly splitWithin?: number } = {},
): Answered[] {
  const out: Answered[] = [];
  const nodeLabel = (id: string | undefined): string | undefined => {
    const node = id ? store.graph.getNode(id) : undefined;
    return node ? labelOf(store.schema.tryDefinition(node.kind as string), node as never) : undefined;
  };
  /*
   * AN ANSWER OR A QUESTION. A call is made only from an answer that IS
   * one; a split or a shrug becomes an offered question at the node, each
   * option carrying the call it would be — so the person's press lands
   * through the same path the run's own confident calls do.
   */
  const one = (
    question: DerivedQuestion,
    answer: Answer,
    call?: PlannedCall,
    withValue?: (value: string) => PlannedCall | undefined,
  ): Answered => {
    const confidence = confidenceOf(answer);
    const because = offerOf(answer, sureness);
    const base = {
      step: index,
      ...(visit.nodeId ? { nodeId: visit.nodeId } : {}),
      question,
      answer,
      confidence,
    };
    if (!because || !withValue) return { ...base, ...(call ? { call: { ...call, confidence } } : {}) };
    const label = nodeLabel(visit.nodeId);
    const offered: OfferedQuestion = {
      id: question.id,
      ...(visit.nodeId ? { nodeId: visit.nodeId } : {}),
      ...(label ? { nodeLabel: label } : {}),
      asks: question.question.instructions,
      because,
      confidence,
      options: distributionOf(answer).map((option) => {
        const would = withValue(option.value);
        return { ...option, ...(would ? { call: { ...would, confidence: option.probability } } : {}) };
      }),
    };
    return { ...base, offered };
  };
  if ("fill" in step) {
    for (const question of visit.questions) {
      const answer = answers[question.id];
      if (!answer || question.about !== "field" || !question.writes || !visit.nodeId) continue;
      const value = valueOf(question, answer);
      const writes = question.writes;
      const nodeId = visit.nodeId;
      const called = (held: unknown): PlannedCall => ({
        mutation: writes.mutation,
        args: { [writes.subjectArg]: nodeId, [writes.arg]: held },
        why: `${question.field} of ${nodeLabel(nodeId) ?? nodeId}: ${String(held)}`,
      });
      out.push(
        one(question, answer, called(value), (option) =>
          answer.type === "noul"
            ? called(option === "yes")
            : answer.type === "score"
              ? called(scoreToValue({ min: question.scale?.min ?? 0 }, Number(option)))
              : called(option),
        ),
      );
    }
    return out;
  }
  if ("ask" in step) {
    const mutation = store.mutation(step.ask);
    const subjectArg = mutation.subject?.arg;
    const node = visit.nodeId ? store.graph.getNode(visit.nodeId) : undefined;
    const args: Record<string, unknown> = {
      ...(subjectArg && visit.nodeId ? { [subjectArg]: visit.nodeId } : {}),
      ...(node ? (step.given?.(node as AnyNode) ?? {}) : {}),
    };
    let least = 1;
    const parts: string[] = [];
    let complete = true;
    for (const question of visit.questions) {
      const answer = answers[question.id];
      if (!answer || question.about !== "argument") {
        complete = false;
        continue;
      }
      args[question.arg] = valueOf(question, answer);
      least = Math.min(least, confidenceOf(answer));
      parts.push(`${question.arg}: ${String(args[question.arg])}`);
    }
    const call: PlannedCall | undefined = complete
      ? { mutation: step.ask, args, why: `${mutation.title ?? step.ask} — ${parts.join(", ")}`, confidence: least }
      : undefined;
    /*
     * One call carries every argument, so ONE unsure argument makes the
     * whole call a question: the options are that argument's, each with
     * the rest of the call as decided.
     */
    for (const question of visit.questions) {
      const answer = answers[question.id];
      if (!answer || question.about !== "argument") continue;
      out.push(
        one(question, answer, call, (option) =>
          call
            ? {
                ...call,
                args: {
                  ...call.args,
                  [question.arg]:
                    answer.type === "noul"
                      ? option === "yes"
                      : answer.type === "score"
                        ? scoreToValue({ min: question.scale?.min ?? 0 }, Number(option))
                        : option,
                },
              }
            : undefined,
        ),
      );
    }
    return out;
  }
  if ("judge" in step) {
    for (const question of visit.questions) {
      const answer = answers[question.id];
      if (!answer || question.about !== "repair" || answer.type !== "choice") continue;
      const chosen = question.options[answer.choice];
      if (!chosen) continue;
      const called = (key: string): PlannedCall | undefined => {
        const option = question.options[key];
        if (!option) return undefined;
        return {
          mutation: option.mutation,
          args: { ...option.args },
          why: `${visit.violation?.message ?? question.invariant}: ${question.question.type === "choice" ? (question.question.criteria[key] ?? key) : key}`,
        };
      };
      out.push(one(question, answer, called(answer.choice), called));
    }
    return out;
  }
  const threshold = step.threshold ?? 0.5;
  const mutation = store.mutation(step.pair);
  const subjectArg = mutation.subject?.arg;
  for (const question of visit.questions) {
    const answer = answers[question.id];
    if (!answer || answer.type !== "noul" || question.about !== "argument" || !subjectArg) continue;
    const otherId = question.id.split(":")[3];
    const holds = answer.noul >= threshold;
    const yes: PlannedCall | undefined = otherId
      ? {
          mutation: step.pair,
          args: { [subjectArg]: visit.nodeId, [question.arg]: otherId },
          why: `${question.question.instructions.split("?")[0]} — yes`,
        }
      : undefined;
    out.push(one(question, answer, holds ? yes : undefined, (option) => (option === "yes" ? yes : undefined)));
  }
  return out;
}

/**
 * Runs the run. Every visit to a node is announced through `onCall` as a
 * read of that node — the same shape a seat's tool calls take, so the
 * Activity rail marks where the run is without a second reporting path.
 */
export async function runFrom<S extends AnySchema>(
  store: Store<S>,
  run: RunDeclaration,
  options: RunOptions<S>,
): Promise<RunResult<S>> {
  const author: Principal = options.author ?? { kind: "agent", id: run.name, session: `run-${Date.now().toString(36)}` };
  const batch = options.batch ?? `run:${run.name}:${Date.now().toString(36)}`;
  const land = options.land ?? "review";
  const reading = readRun(store, run, options.today !== undefined ? { today: options.today } : {});
  const usage = { questions: 0, calls: 0, inputTokens: 0, usd: 0 };
  const planOptions: PlanOptions<S> = { ...(options.app ? { app: options.app } : {}), principal: options.principal ?? author };
  const empty = planFrom(store, [], planOptions);
  if (reading.refused) {
    return { name: run.name, author, batch, reading, steps: [], plan: empty, questions: [], usage, refused: reading.refused };
  }
  /* The Decide the run started with. A rung switched underneath does not move it. */
  const decide = options.decide;
  const steps: StepOutcome[] = [];
  const everything: PlannedCall[] = [];
  let stopped: { at: number; why: string } | undefined;
  let applied: AppliedPlan<S> | undefined;

  for (let index = 0; index < run.steps.length; index++) {
    const step = run.steps[index]!;
    /* Re-read on the live graph: an earlier step may have changed what is unset. */
    const { what, visits } = questionsOfStep(store, step, options.today);
    const answered: Answered[] = [];
    const nodes: string[] = [];
    let asked = 0;
    for (const visit of visits) {
      const at = new Date().toISOString();
      const node = visit.nodeId ? store.graph.getNode(visit.nodeId) : undefined;
      const announced = {
        name: "decide",
        args: { step: index, what, ...(node ? { kind: node.kind, node: visit.nodeId } : {}) },
        mutating: false,
        at,
      };
      options.onCall?.({ ...announced, phase: "running" });
      const questions: Record<string, Question> = {};
      for (const q of visit.questions) questions[q.id] = q.question;
      let decided: Decided;
      try {
        decided = await decide(visit.state, questions);
      } catch (error) {
        const why = error instanceof Error ? error.message : String(error);
        options.onCall?.({ ...announced, phase: "failed", error: why });
        stopped = { at: index, why };
        break;
      }
      asked += visit.questions.length;
      usage.questions += visit.questions.length;
      usage.calls += 1;
      usage.inputTokens += decided.usage.inputTokens;
      if (visit.nodeId) nodes.push(visit.nodeId);
      options.onCall?.({ ...announced, phase: "ok", ...(visit.nodeId ? { reads: [visit.nodeId] } : {}) });
      answered.push(
        ...callsFrom(store, step, visit, decided.answers, index, {
          ...(options.floor !== undefined ? { floor: options.floor } : {}),
          ...(options.splitWithin !== undefined ? { splitWithin: options.splitWithin } : {}),
        }),
      );
    }
    if (stopped) break;
    /*
     * A call with any offered argument is a question, not a proposal: the
     * whole call waits on the person's press.
     */
    const asked_of_person = new Set(answered.filter((a) => a.offered).map((a) => a.call).filter(Boolean));
    const proposals = [...new Set(answered.map((a) => a.call).filter((call): call is PlannedCall => call !== undefined && !asked_of_person.has(call)))];
    const questions = answered.map((a) => a.offered).filter((q): q is OfferedQuestion => q !== undefined);
    const plan = planFrom(store, proposals, planOptions);
    let landed: AppliedPlan<S> | undefined;
    if (land === "each-step" && plan.ready.length > 0) {
      landed = applyPlan(store, plan, { author, batch, keepWhatRan: true });
      applied = landed;
    }
    const outcome: StepOutcome = {
      step: index,
      what,
      nodes,
      asked,
      answered,
      proposals,
      questions,
      plan,
      ...(landed
        ? { applied: { batch: landed.batch, applied: landed.applied, made: landed.made, ...(landed.stoppedAt ? { stoppedAt: landed.stoppedAt } : {}) } }
        : {}),
    };
    steps.push(outcome);
    everything.push(...proposals);
    const verdict = options.judge?.(outcome) ?? true;
    if (verdict !== true) {
      stopped = { at: index, why: verdict };
      break;
    }
  }
  usage.usd = jevCostUsd(usage.inputTokens);
  const plan = land === "each-step" ? planFrom(store, [], planOptions) : planFrom(store, everything, planOptions);
  return {
    name: run.name,
    author,
    batch,
    reading,
    steps,
    plan,
    questions: steps.flatMap((step) => step.questions),
    ...(applied ? { applied } : {}),
    usage,
    ...(stopped ? { stopped } : {}),
  };
}

/**
 * A RUN, SPOKEN BY THE SEAT. What it asked, what it proposes, what it is
 * asking the person — as one ChatReply, so the outcome travels the seat's
 * own surfaces: the thread, the rail, a figure's bubble. The confident
 * calls are proposals; the split or unsure ones are questions standing at
 * their nodes; a refusal or a stop is said, not logged.
 */
export function replyFromRun<S extends AnySchema>(result: RunResult<S>): ChatReply {
  if (result.refused) return { say: result.refused, proposals: [] };
  const proposals = result.plan.ready.map((entry) => entry.call);
  const questions = result.questions;
  const parts = [
    `Asked ${result.usage.questions} question${result.usage.questions === 1 ? "" : "s"} over ${result.steps.length} step${result.steps.length === 1 ? "" : "s"}.`,
    proposals.length > 0 ? `${proposals.length} change${proposals.length === 1 ? "" : "s"} proposed.` : "Nothing to change.",
    questions.length > 0 ? `${questions.length} question${questions.length === 1 ? "" : "s"} for you.` : "",
    result.stopped ? `Stopped at step ${result.stopped.at + 1}: ${result.stopped.why}` : "",
  ].filter(Boolean);
  return { say: parts.join(" "), proposals, ...(questions.length > 0 ? { questions } : {}) };
}

/** Lands a reviewed run as one batch, attributed to the run's own seat. One undo. */
export function landRun<S extends AnySchema>(store: Store<S>, result: RunResult<S>, plan: Plan = result.plan): AppliedPlan<S> {
  return applyPlan(store, plan, { author: result.author, batch: result.batch });
}
