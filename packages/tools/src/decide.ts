import type { AnySchema, Store } from "@graview/core";
import type { Completion } from "./intelligence.js";
import { firstJsonObject } from "./intelligence.js";
import type { Answer, Decide, Decided } from "./providers/jev.js";
import type { Question } from "./questions.js";

/**
 * THE OTHER TWO WAYS A DECISION IS ANSWERED.
 *
 * A decision provider answers a typed question exactly. The two rungs
 * either side of it can answer the same question, worse: the graph by its
 * own rules — a rule's truth is whatever the store's judgement says, a
 * repair is one the violation named — and a model with the whole
 * parse-and-refuse layer behind it, which is what a decision provider
 * makes unnecessary and what this file has to carry so the LLM rung can
 * serve the capability at all. Both answer in the SAME shape, so a surface
 * asking for a decision cannot tell which rung answered except by the
 * confidence, which is the point.
 */

/** An answer the graph could not give is left out and named here. */
export interface PartlyDecided extends Decided {
  readonly unanswered: readonly string[];
}

/**
 * The graph decides what its own rules already decided. A question keyed
 * `rule:<name>[:<subject>]` is answered from `store.violations()` — a
 * probability of exactly 1 or 0, because the store does not guess — and a
 * `repair:` question is answered with the first option, which is the
 * violation's first ready repair. Everything else is unanswered: the graph
 * has no opinion about which surface a lawn is.
 */
export function graphDecide<S extends AnySchema>(store: Store<S>): (state: unknown, questions: Readonly<Record<string, Question>>) => Promise<PartlyDecided> {
  return async (_state, questions) => {
    const violations = store.violations();
    const answers: Record<string, Answer> = {};
    const unanswered: string[] = [];
    for (const [key, question] of Object.entries(questions)) {
      const rule = /^rule:([^:]+)(?::(.+))?$/.exec(key);
      if (rule && question.type === "noul") {
        const [, name, subject] = rule;
        const broken = violations.some((v) => v.invariant === name && (subject === undefined || v.subjectId === subject));
        answers[key] = { type: "noul", noul: broken ? 0 : 1 };
        continue;
      }
      const repair = /^repair:/.exec(key);
      if (repair && question.type === "choice") {
        const first = Object.keys(question.criteria)[0];
        if (first) {
          const probabilities: Record<string, number> = {};
          for (const option of Object.keys(question.criteria)) probabilities[option] = option === first ? 1 : 0;
          answers[key] = { type: "choice", choice: first, confidence: 1, probabilities };
          continue;
        }
      }
      unanswered.push(key);
    }
    return { answers, unanswered, usage: { inputTokens: 0, outputTokens: 0 } };
  };
}

/**
 * A model as a decision provider: the parse-and-refuse layer, in full.
 *
 * The questions go up as they are; the model is asked for a JSON object
 * of answers under the same keys. What comes back is held to the
 * question: a Choice must name an option that was offered, a truth must
 * be a probability, a Score must be a level that exists. Anything else is
 * a refusal for that key — never a guess — and the model's confidence is
 * what it says it is, which a reader should trust rather less than a
 * decision provider's.
 */
export function completionDecide(complete: Completion): Decide {
  return async (state, questions) => {
    const asked = Object.keys(questions);
    if (asked.length === 0) return { answers: {}, usage: { inputTokens: 0, outputTokens: 0 } };
    const prompt = [
      "You are answering typed questions about a state. Answer ONLY a JSON object keyed by question id.",
      "For a \"choice\" question answer {\"choice\": <one of the criteria keys>, \"confidence\": 0..1}.",
      "For a \"noul\" question answer {\"noul\": <probability 0..1 that the answer is yes>}.",
      "For a \"score\" question answer {\"level\": <index into criteria, 0-based>, \"confidence\": 0..1}.",
      `State:\n${JSON.stringify(state)}`,
      `Questions:\n${JSON.stringify(questions)}`,
    ].join("\n\n");
    const text = await complete(prompt);
    const read = firstJsonObject(text);
    if (!read || typeof read !== "object" || Array.isArray(read)) {
      throw new Error("The model answered in a shape that is not a map of answers.");
    }
    const given = read as Record<string, Record<string, unknown> | undefined>;
    const answers: Record<string, Answer> = {};
    const refused: string[] = [];
    for (const key of asked) {
      const question = questions[key]!;
      const said = given[key];
      const clamp = (n: unknown, fallback: number) => (typeof n === "number" && n >= 0 && n <= 1 ? n : fallback);
      if (!said || typeof said !== "object") {
        refused.push(key);
        continue;
      }
      if (question.type === "choice") {
        const options = Object.keys(question.criteria);
        const choice = typeof said["choice"] === "string" ? said["choice"] : undefined;
        if (!choice || !options.includes(choice)) {
          refused.push(key);
          continue;
        }
        const confidence = clamp(said["confidence"], 0.5);
        const probabilities: Record<string, number> = {};
        const rest = options.length > 1 ? (1 - confidence) / (options.length - 1) : 0;
        for (const option of options) probabilities[option] = option === choice ? confidence : rest;
        answers[key] = { type: "choice", choice, confidence, probabilities };
      } else if (question.type === "noul") {
        const noul = said["noul"];
        if (typeof noul !== "number" || noul < 0 || noul > 1) {
          refused.push(key);
          continue;
        }
        answers[key] = { type: "noul", noul };
      } else {
        const level = said["level"];
        if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level >= question.criteria.length) {
          refused.push(key);
          continue;
        }
        const confidence = clamp(said["confidence"], 0.5);
        const probabilities: Record<string, number> = {};
        const legend: Record<string, string> = {};
        const rest = question.criteria.length > 1 ? (1 - confidence) / (question.criteria.length - 1) : 0;
        question.criteria.forEach((description, at) => {
          probabilities[String(at)] = at === level ? confidence : rest;
          legend[String(at)] = description;
        });
        const score = Object.entries(probabilities).reduce((sum, [at, p]) => sum + Number(at) * p, 0);
        answers[key] = { type: "score", score, confidence, probabilities, legend };
      }
    }
    if (refused.length > 0) {
      throw new Error(`The model did not answer ${refused.map((key) => `"${key}"`).join(", ")} in the shape asked, so nothing was taken for them.`);
    }
    return { answers, usage: { inputTokens: 0, outputTokens: 0 } };
  };
}
