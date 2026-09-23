import type { Question } from "../questions.js";

/**
 * THE PROVIDER ITSELF: one call, many questions, honest about failure.
 *
 * A decision provider takes one state and a MAP of typed questions and
 * answers under the same keys — so a node's whole unset half is one
 * request, not one per field, and a fan-out over every node of a kind is
 * as many requests as there are nodes, never as many as there are fields.
 *
 * What comes back is typed by construction: a Choice is one of the names
 * we sent, a truth is a probability, a Score is a weighted position on the
 * levels we sent. There is no parse-and-refuse layer because there is
 * nothing to parse.
 *
 * Failure is told apart by whose it is. 429 and 529 are the service busy,
 * and are retried with backoff; 401 is the SEAT's problem — the key was
 * refused — and is said so; 422 is OURS — we sent a malformed question —
 * and is said so, because blaming the model for a bug in the derivation
 * would send somebody looking in the wrong place.
 *
 * The key is read from the environment and travels in one header. It is
 * never in a thrown error, never in a log line, never in the graph.
 */

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
/** Input is metered at this rate; output is not metered at all. */
export const JEV_INPUT_USD_PER_MILLION = 0.042;

export type ChoiceAnswer = {
  readonly type: "choice";
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
};
export type NoulAnswer = { readonly type: "noul"; readonly noul: number };
export type ScoreAnswer = {
  readonly type: "score";
  readonly score: number;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
  readonly legend: Readonly<Record<string, string>>;
};
export type Answer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Requests made, retries excluded. */
  readonly calls: number;
  readonly questions: number;
}

export interface Decided {
  readonly answers: Readonly<Record<string, Answer>>;
  /** This call's own usage. */
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

/** The whole provider surface: one state, a map of questions, typed answers back. */
export type Decide = (state: unknown, questions: Readonly<Record<string, Question>>) => Promise<Decided>;

/** Whose failure it was, so a surface can say so. */
export type JevFailure = "seat" | "ours" | "busy" | "network" | "shape";

export class JevError extends Error {
  readonly failure: JevFailure;
  readonly status: number | undefined;
  constructor(failure: JevFailure, message: string, status?: number) {
    super(message);
    this.name = "JevError";
    this.failure = failure;
    this.status = status;
  }
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface JevOptions {
  /**
   * The key, when the call goes straight to the provider. Absent when the
   * call goes to a bridge that holds the key itself (see `baseUrl`).
   */
  readonly apiKey?: string;
  /** Where to post. The provider itself, or a same-origin bridge. */
  readonly baseUrl?: string;
  readonly model?: string;
  /** How many times a busy answer is retried before it is given up on. */
  readonly retries?: number;
  /** Injectable: how long to wait before retry `n` (1-based), in ms. */
  readonly backoffMs?: (attempt: number) => number;
  /** Injectable for tests. */
  readonly fetch?: FetchLike;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Told after every completed request, with the running total. */
  readonly onUsage?: (usage: Usage) => void;
}

/**
 * The key, from the environment: TYPESAFE_API_KEY is the documented name;
 * JEV_API_KEY is accepted for the person who set it before reading the
 * docs. In a browser there is no environment, and this answers undefined —
 * which is what makes a bridge the right door there.
 */
export function jevKeyFromEnvironment(
  env: Readonly<Record<string, string | undefined>> | undefined = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env,
): string | undefined {
  const key = env?.["TYPESAFE_API_KEY"] || env?.["JEV_API_KEY"];
  return key && key.length > 0 ? key : undefined;
}

/** What a number of input tokens costs, in dollars. Output is free. */
export function jevCostUsd(inputTokens: number): number {
  return (inputTokens / 1_000_000) * JEV_INPUT_USD_PER_MILLION;
}

const isAnswer = (value: unknown): value is Answer => {
  if (typeof value !== "object" || value === null) return false;
  const answer = value as { type?: unknown; choice?: unknown; noul?: unknown; score?: unknown };
  switch (answer.type) {
    case "choice":
      return typeof answer.choice === "string";
    case "noul":
      return typeof answer.noul === "number";
    case "score":
      return typeof answer.score === "number";
    default:
      return false;
  }
};

/**
 * One Decide from one key (or one bridge). Retries are the service's busy
 * answers only — 429, 529 — with backoff; everything else is said once,
 * with whose failure it was, and never with the key in it.
 */
export function jevDecide(options: JevOptions = {}): Decide {
  const call = options.fetch ?? (globalThis.fetch as FetchLike);
  const url = options.baseUrl ?? JEV_ENDPOINT;
  const retries = options.retries ?? 3;
  const backoff = options.backoffMs ?? ((attempt) => 400 * 2 ** (attempt - 1));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const total = { inputTokens: 0, outputTokens: 0, calls: 0, questions: 0 };

  return async (state, questions) => {
    const asked = Object.keys(questions).length;
    if (asked === 0) return { answers: {}, usage: { inputTokens: 0, outputTokens: 0 } };
    const body = JSON.stringify({ model: options.model ?? JEV_MODEL, state, questions });
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (options.apiKey) headers["authorization"] = `Bearer ${options.apiKey}`;

    for (let attempt = 0; ; attempt++) {
      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await call(url, {
          method: "POST",
          headers,
          body,
          ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? { signal: AbortSignal.timeout(60_000) } : {}),
        });
      } catch (error) {
        throw new JevError("network", `The decision provider could not be reached: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (response.status === 429 || response.status === 529) {
        if (attempt < retries) {
          await sleep(backoff(attempt + 1));
          continue;
        }
        throw new JevError(
          "busy",
          `The decision provider is ${response.status === 429 ? "rate-limiting" : "overloaded"} and stayed so through ${retries} retries.`,
          response.status,
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new JevError("seat", "The decision provider refused the key. That is a seat problem — check TYPESAFE_API_KEY — not the model's.", response.status);
      }
      if (response.status === 422) {
        const said = (await response.text()).slice(0, 240);
        throw new JevError("ours", `The decision provider could not read a question we sent. That is our bug, not the model's: ${said}`, 422);
      }
      if (!response.ok) {
        throw new JevError("network", `The decision provider answered ${response.status}: ${(await response.text()).slice(0, 160)}`, response.status);
      }
      let parsed: { answers?: Record<string, unknown>; usage?: { input_tokens?: number; output_tokens?: number }; error?: string };
      try {
        parsed = JSON.parse(await response.text());
      } catch {
        throw new JevError("shape", "The decision provider answered in a shape that is not JSON.");
      }
      if (typeof parsed.error === "string") {
        throw new JevError("network", `The decision provider said: ${parsed.error}`, response.status);
      }
      const answers: Record<string, Answer> = {};
      for (const [key, value] of Object.entries(parsed.answers ?? {})) {
        if (!(key in questions)) continue;
        if (!isAnswer(value)) throw new JevError("shape", `The answer to "${key}" is not a typed answer.`);
        answers[key] = value;
      }
      for (const key of Object.keys(questions)) {
        if (!(key in answers)) throw new JevError("shape", `No answer came back for "${key}".`);
      }
      const usage = { inputTokens: parsed.usage?.input_tokens ?? 0, outputTokens: parsed.usage?.output_tokens ?? 0 };
      total.inputTokens += usage.inputTokens;
      total.outputTokens += usage.outputTokens;
      total.calls += 1;
      total.questions += asked;
      options.onUsage?.({ ...total });
      return { answers, usage };
    }
  };
}
