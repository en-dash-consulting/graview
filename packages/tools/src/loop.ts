import { labelOf, type AnySchema, type Principal, type Store, type Violation } from "@graview/core";
import type { ToolCall } from "./agent/tools.js";
import type { ChatReply } from "./conversation.js";
import { applyPlan, planFrom, type PlanOptions, type PlannedCall } from "./plan.js";
import { jevCostUsd, type Answer, type Decide } from "./providers/jev.js";
import { questionsForInvariant, type DerivedQuestion, type OfferedQuestion } from "./questions.js";
import { offerOf } from "./run.js";

/**
 * A LOOP: ACT, RE-JUDGE, ACT AGAIN, AND KNOW WHEN TO STOP.
 *
 * `store.violations()` already says what is wrong and every rule names its
 * repairs. A loop takes one violation, asks which repair to take — a
 * Choice over a CLOSED set, so an invented repair is impossible — applies
 * it as the declared act, re-judges, and goes again. Every turn is
 * attributed to the loop's own seat and lands under one batch, so a loop
 * that went wrong comes back out through the same control as anything
 * else: one undo.
 *
 * It stops for a reason it can SAY. Nothing left; not sure enough of the
 * repair; a state it has been in before (the loop is going in a circle);
 * the budget spent; the provider failed; the policy refused. The sentence
 * is part of the result and of the seat's reply, and it is announced on
 * the same path a tool call is, so the rail carries it too.
 */

export interface LoopDeclaration {
  readonly name: string;
  /** Which rules to keep; every rule otherwise. */
  readonly rules?: readonly string[];
  /** What this loop may spend. Twenty turns unless said otherwise. */
  readonly budget?: { readonly turns?: number; readonly questions?: number; readonly usd?: number };
}

export type StopWhy = "nothing-left" | "unsure" | "seen-before" | "budget" | "failed" | "refused" | "no-repair";

export interface Stopped {
  readonly why: StopWhy;
  /** The sentence the seat says. */
  readonly said: string;
  /** For `unsure`: the question the loop hands to a person, at its node. */
  readonly question?: OfferedQuestion;
}

export interface LoopTurn {
  readonly turn: number;
  readonly violation: Violation;
  /** The repair question asked, when there was more than one repair to choose from. */
  readonly asked?: DerivedQuestion;
  readonly answer?: Answer;
  readonly confidence: number;
  readonly call: PlannedCall;
  /** Violations before and after this turn — what the turn did to the standing. */
  readonly before: number;
  readonly after: number;
}

export interface LoopOptions<S extends AnySchema> extends PlanOptions<S> {
  readonly decide: Decide;
  readonly author?: Principal;
  readonly onCall?: (call: ToolCall) => void;
  readonly batch?: string;
  /** Below this confidence the loop stops and asks. 0.5 otherwise. */
  readonly floor?: number;
  readonly splitWithin?: number;
  /** For rules whose evaluation wants a context. */
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface LoopResult {
  readonly name: string;
  readonly author: Principal;
  readonly batch: string;
  readonly turns: readonly LoopTurn[];
  readonly stopped: Stopped;
  readonly usage: { readonly questions: number; readonly calls: number; readonly inputTokens: number; readonly usd: number };
  /** Violations still standing when it stopped. */
  readonly remaining: number;
}

/** The graph as a string that is the same for the same graph. */
function stateKey<S extends AnySchema>(store: Store<S>): string {
  const snapshot = store.graph.snapshot();
  const nodes = [...snapshot.nodes].map((node) => JSON.stringify(node, Object.keys(node).sort())).sort();
  const edges = [...snapshot.edges].map((edge) => JSON.stringify(edge, Object.keys(edge).sort())).sort();
  return `${nodes.join("\n")}\n--\n${edges.join("\n")}`;
}

export async function runLoop<S extends AnySchema>(store: Store<S>, loop: LoopDeclaration, options: LoopOptions<S>): Promise<LoopResult> {
  const author: Principal = options.author ?? { kind: "agent", id: loop.name, session: `loop-${Date.now().toString(36)}` };
  const batch = options.batch ?? `loop:${loop.name}:${Date.now().toString(36)}`;
  const maxTurns = loop.budget?.turns ?? 20;
  const usage = { questions: 0, calls: 0, inputTokens: 0, usd: 0 };
  const turns: LoopTurn[] = [];
  const seen = new Set<string>([stateKey(store)]);
  const planOptions: PlanOptions<S> = { ...(options.app ? { app: options.app } : {}), principal: options.principal ?? author };
  const name = (violation: Violation): string => {
    const id = violation.subjectId ?? violation.nodeIds[0];
    const node = id ? store.graph.getNode(id) : undefined;
    return node ? labelOf(store.schema.tryDefinition(node.kind as string), node) : (id ?? violation.invariant);
  };
  const standing = () => store.violations(options.context).filter((v) => !loop.rules || loop.rules.includes(v.invariant));

  const finish = (stopped: Stopped): LoopResult => {
    usage.usd = jevCostUsd(usage.inputTokens);
    /* The stop is said on the seat's own path too, so the rail carries the sentence. */
    options.onCall?.({ name: "stop", args: { why: stopped.why, said: stopped.said }, mutating: false, phase: "ok", at: new Date().toISOString() });
    return { name: loop.name, author, batch, turns, stopped, usage, remaining: standing().length };
  };
  const done = (count: number) => `${turns.length} repair${turns.length === 1 ? "" : "s"} made${count > 0 ? `, ${count} still standing` : ""}.`;

  for (let turn = 0; ; turn++) {
    const violations = standing();
    if (violations.length === 0) {
      return finish({ why: "nothing-left", said: turns.length === 0 ? "Nothing is wrong, so there was nothing to repair." : `Nothing left to repair: ${done(0)}` });
    }
    if (turn >= maxTurns) {
      return finish({ why: "budget", said: `Stopped at the budget of ${maxTurns} turn${maxTurns === 1 ? "" : "s"}: ${done(violations.length)}` });
    }
    if (loop.budget?.questions !== undefined && usage.questions >= loop.budget.questions) {
      return finish({ why: "budget", said: `Stopped at the budget of ${loop.budget.questions} question${loop.budget.questions === 1 ? "" : "s"}: ${done(violations.length)}` });
    }
    if (loop.budget?.usd !== undefined && jevCostUsd(usage.inputTokens) >= loop.budget.usd) {
      return finish({ why: "budget", said: `Stopped at the budget of $${loop.budget.usd}: ${done(violations.length)}` });
    }

    /*
     * THE FIRST VIOLATION WITH A REPAIR IT CAN TAKE. A repair still missing
     * an argument is not one the loop can choose — there is nothing typed to
     * choose with — so a violation whose every repair is like that is left
     * standing, and said so if nothing else can be done.
     */
    const workable = violations
      .map((violation) => ({ violation, ready: violation.repairs.filter((repair) => !repair.missing?.length) }))
      .find((candidate) => candidate.ready.length > 0);
    if (!workable) {
      return finish({
        why: "no-repair",
        said: `${violations.length} thing${violations.length === 1 ? " is" : "s are"} still wrong and none of them names a repair I could take without being told more: ${done(violations.length)}`,
      });
    }
    const { violation, ready } = workable;
    const nodeIds = violation.subjectId ? [violation.subjectId] : violation.nodeIds;
    const at = new Date().toISOString();
    const announced = {
      name: "repair",
      args: { turn, rule: violation.invariant, ...(nodeIds[0] ? { node: nodeIds[0] } : {}), about: name(violation) },
      mutating: false,
      at,
    };
    options.onCall?.({ ...announced, phase: "running" });

    const [, repairQuestion] = questionsForInvariant(store, violation.invariant, violation);
    let call: PlannedCall;
    let asked: DerivedQuestion | undefined;
    let answer: Answer | undefined;
    let confidence = 1;
    if (repairQuestion && repairQuestion.about === "repair") {
      let decided;
      try {
        decided = await options.decide(
          { broken: violation.message, about: name(violation), implicated: violation.nodeIds },
          { [repairQuestion.id]: repairQuestion.question },
        );
      } catch (error) {
        const why = error instanceof Error ? error.message : String(error);
        options.onCall?.({ ...announced, phase: "failed", error: why });
        return finish({ why: "failed", said: `Stopped because the decision provider failed: ${why} ${done(violations.length)}` });
      }
      usage.questions += 1;
      usage.calls += 1;
      usage.inputTokens += decided.usage.inputTokens;
      answer = decided.answers[repairQuestion.id];
      asked = repairQuestion;
      if (!answer || answer.type !== "choice" || !repairQuestion.options[answer.choice]) {
        options.onCall?.({ ...announced, phase: "failed", error: "no usable answer" });
        return finish({ why: "failed", said: `Stopped because the answer about ${name(violation)} was not one of the repairs offered. ${done(violations.length)}` });
      }
      confidence = Math.round(answer.confidence * 1000) / 1000;
      const because = offerOf(answer, {
        ...(options.floor !== undefined ? { floor: options.floor } : {}),
        ...(options.splitWithin !== undefined ? { splitWithin: options.splitWithin } : {}),
      });
      if (because) {
        options.onCall?.({ ...announced, phase: "ok", reads: nodeIds });
        const question: OfferedQuestion = {
          id: repairQuestion.id,
          ...(nodeIds[0] ? { nodeId: nodeIds[0] } : {}),
          nodeLabel: name(violation),
          asks: repairQuestion.question.instructions,
          because,
          confidence,
          options: Object.entries(answer.probabilities)
            .map(([value, probability]) => {
              const option = repairQuestion.options[value];
              return {
                value,
                probability,
                ...(option ? { call: { mutation: option.mutation, args: { ...option.args }, why: repairQuestion.question.type === "choice" ? (repairQuestion.question.criteria[value] ?? value) : value } } : {}),
              };
            })
            .sort((a, b) => b.probability - a.probability),
        };
        return finish({
          why: "unsure",
          said: `Stopped at ${name(violation)}: ${because === "split" ? "it could be more than one repair" : `I am only ${Math.round(confidence * 100)}% sure which repair`}, so I am asking rather than acting. ${done(violations.length)}`,
          question,
        });
      }
      const chosen = repairQuestion.options[answer.choice]!;
      call = {
        mutation: chosen.mutation,
        args: { ...chosen.args },
        why: `${violation.message} → ${repairQuestion.question.type === "choice" ? (repairQuestion.question.criteria[answer.choice] ?? answer.choice) : answer.choice}`,
        confidence,
      };
    } else {
      /* One ready repair: the rule has already answered, and nothing is asked. */
      const only = ready[0]!;
      call = { mutation: only.mutation, args: { ...(only.args ?? {}) }, why: `${violation.message} → ${only.label}`, confidence: 1 };
    }

    const before = violations.length;
    const plan = planFrom(store, [call], planOptions);
    if (plan.refused.length > 0) {
      options.onCall?.({ ...announced, phase: "failed", error: plan.refused[0]!.refusal!.message });
      return finish({ why: "refused", said: `Stopped at ${name(violation)}: ${plan.refused[0]!.refusal!.message} ${done(before)}` });
    }
    const landed = applyPlan(store, plan, { author, batch, keepWhatRan: true });
    if (landed.stoppedAt) {
      options.onCall?.({ ...announced, phase: "failed", error: landed.stoppedAt.why });
      return finish({ why: "refused", said: `Stopped at ${name(violation)}: ${landed.stoppedAt.why} ${done(before)}` });
    }
    options.onCall?.({ ...announced, phase: "ok", reads: nodeIds });
    const after = standing().length;
    turns.push({ turn, violation, ...(asked ? { asked } : {}), ...(answer ? { answer } : {}), confidence, call, before, after });

    const key = stateKey(store);
    if (seen.has(key)) {
      return finish({
        why: "seen-before",
        said: `Stopped at ${name(violation)}: this repair put the graph back into a state it has already been in, so going on would go in a circle. ${done(after)}`,
      });
    }
    seen.add(key);
  }
}

/** A loop, spoken by the seat: the stop sentence, and the question if it stopped to ask. */
export function replyFromLoop(result: LoopResult): ChatReply {
  return {
    say: result.stopped.said,
    proposals: [],
    ...(result.stopped.question ? { questions: [result.stopped.question] } : {}),
  };
}
