import type { SearchRanker } from "@graview/core";
import type { AiPrice, HostAi } from "../ai.js";
import type { Answer, Decide } from "../providers/jev.js";

/*
 * THE ONE DOOR THE DREAM ASKS A MODEL THROUGH. A System One model (Jev, or
 * another of its shape) takes one state and a map of typed questions —
 * Choice, Noul, Score — and answers each with its probabilities. Every
 * other file of the dream reads answers through what is here, so when the
 * decision types move to a module of their own, the import above is the
 * one line that changes.
 */

/** A typed answer: a Choice, a Noul or a Score, with its probabilities. */
export type SystemOneAnswer = Answer;
/** One state and a map of typed questions in; typed answers and the call's usage out. */
export type SystemOneDecide = Decide;

/** The model a dream asks: its name, as lineage says it, its decide, and its price when the host knows it. */
export interface DreamModel {
  /** "jev-latest": what the lineage and the report name. */
  readonly model: string;
  readonly decide: SystemOneDecide;
  readonly price?: AiPrice;
}

/**
 * The model a dream asks, from what the host lent: `model` when given, else
 * the host's Fast slot, else its `decide` under its name. Nothing when the
 * host said AI is off or lent no System One model: the dream then stands on
 * its judges alone.
 */
export function systemOneOf(model: DreamModel | undefined, ai: HostAi | undefined): DreamModel | undefined {
  if (model) return model;
  if (!ai || ai.off === true) return undefined;
  if (ai.fast) return { model: ai.fast.model, decide: ai.fast.decide, ...(ai.fast.price ? { price: ai.fast.price } : {}) };
  if (ai.decide) return { model: ai.name ?? "model", decide: ai.decide };
  return undefined;
}

/** The host's ranker for near records, when it lent one and AI is on. */
export const nearOf = (ai: HostAi | undefined): SearchRanker | undefined => (ai && ai.off !== true ? ai.near : undefined);

/** The model as a basis names it: "Jev" for any Jev, else its own name. */
export const modelWord = (model: string): string => (/^jev\b/i.test(model) ? "Jev" : model);

const round = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;

/** How sure a Noul is that its statement holds: its probability. */
export function noulOf(answer: SystemOneAnswer | undefined): number | undefined {
  return answer?.type === "noul" && Number.isFinite(answer.noul) ? round(answer.noul) : undefined;
}

/**
 * A Score as 0 to 1: its expected level over the levels it was asked on,
 * "the same thing" at the top. From its probabilities when it sent them,
 * else from the score itself.
 */
export function scoreOf(answer: SystemOneAnswer | undefined, levels: number): number | undefined {
  if (answer?.type !== "score" || levels < 2) return undefined;
  const entries = Object.entries(answer.probabilities ?? {}).map(([level, p]) => [Number(level), p] as const).filter(([level, p]) => Number.isInteger(level) && Number.isFinite(p));
  const total = entries.reduce((sum, [, p]) => sum + p, 0);
  const expected = total > 0 ? entries.reduce((sum, [level, p]) => sum + level * p, 0) / total : answer.score;
  return Number.isFinite(expected) ? round(expected / (levels - 1)) : undefined;
}

/** A Choice: what was chosen, how sure (its probability), and its margin over the next. */
export function choiceOf(answer: SystemOneAnswer | undefined): { readonly choice: string; readonly confidence: number; readonly margin: number } | undefined {
  if (answer?.type !== "choice") return undefined;
  const probabilities = answer.probabilities ?? {};
  const top = probabilities[answer.choice] ?? answer.confidence ?? 0;
  const others = Object.entries(probabilities).filter(([option, p]) => option !== answer.choice && Number.isFinite(p)).map(([, p]) => p);
  return { choice: answer.choice, confidence: round(top), margin: round(top - Math.max(0, ...others)) };
}
