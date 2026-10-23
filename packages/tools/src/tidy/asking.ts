import { QUESTION_SET, type Ask } from "./judging.js";
import type { DreamModel, SystemOneAnswer } from "./system-one.js";

/*
 * ASKING, WITHIN WHAT THE HOST WILL PAY FOR. A few requests at once (six,
 * as a System One service's rate allows), never more than the run's
 * request and token budgets, and each answer kept by a hash of what was
 * asked — the questions' version, the model, the state and the questions —
 * so a pair nothing changed in is not asked again the next night. A
 * failure stops the asking; what was not asked falls to the judges' own
 * rules, which is the floor.
 */

/** Answers as a request returned them, by question. */
export type DreamAnswers = Readonly<Record<string, SystemOneAnswer>>;

/** Where answers are kept between runs: the host's (a table, a file, a key-value store), or in memory. */
export interface DreamCache {
  get(key: string): DreamAnswers | undefined | Promise<DreamAnswers | undefined>;
  set(key: string, answers: DreamAnswers): void | Promise<void>;
}

/** Answers kept in this process, the oldest let go past `limit` (2000 when unsaid). */
export function memoryDreamCache(limit = 2000): DreamCache {
  const kept = new Map<string, DreamAnswers>();
  return {
    get: (key) => kept.get(key),
    set(key, answers) {
      kept.delete(key);
      kept.set(key, answers);
      while (kept.size > limit) kept.delete(kept.keys().next().value!);
    },
  };
}

/** The cache a run uses when the host gives none: one per process, so a server's nightly run remembers the last. */
export const PROCESS_CACHE: DreamCache = memoryDreamCache();

/** What a run may spend: requests and input tokens. */
export interface DreamBudget {
  /** At most this many requests a run. 60 when unsaid. */
  readonly requests?: number;
  /** At most this many input tokens a run. 200,000 when unsaid. */
  readonly inputTokens?: number;
}

/** What the asking spent and how it ended. */
export interface DreamUsage {
  /** Requests sent. */
  readonly requests: number;
  /** Requests answered from the cache instead. */
  readonly cached: number;
  /** Questions asked over all requests, the cached ones included. */
  readonly questions: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Dollars, when the host gave the model's price. */
  readonly costUsd?: number;
}

export interface Asked {
  /** Each request's answers, by its place in the asks; undefined where it was not asked. */
  readonly answers: readonly (DreamAnswers | undefined)[];
  readonly usage: DreamUsage;
  /** The budget it stopped at, when it did. */
  readonly stopped?: "requests" | "tokens";
  /** The model's failure, when it failed. */
  readonly error?: string;
}

/** SHA-256 of the text, in hex, where the platform has it; a 64-bit FNV-1a where it does not. */
async function hashOf(text: string): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> } } }).crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0xcbf29ce484222325n;
  for (const char of new TextEncoder().encode(text)) hash = ((hash ^ BigInt(char)) * 0x100000001b3n) & 0xffffffffffffffffn;
  return hash.toString(16);
}

/** The key an ask's answers are kept by: the questions' version, the model, the state and the questions. */
export const cacheKeyOf = (model: string, ask: Pick<Ask, "state" | "questions">): Promise<string> => hashOf(JSON.stringify([QUESTION_SET, model, ask.state, ask.questions]));

/** Ask each, a few at a time, within the budget, from the cache where it can. */
export async function askAll(model: DreamModel, asks: readonly Ask[], options: { readonly concurrency?: number; readonly budget?: DreamBudget; readonly cache?: DreamCache | false } = {}): Promise<Asked> {
  const cache = options.cache === false ? undefined : (options.cache ?? PROCESS_CACHE);
  const maxRequests = options.budget?.requests ?? 60;
  const maxTokens = options.budget?.inputTokens ?? 200_000;
  const answers: (DreamAnswers | undefined)[] = asks.map(() => undefined);
  const usage = { requests: 0, cached: 0, questions: 0, inputTokens: 0, outputTokens: 0 };
  let stopped: Asked["stopped"];
  let error: string | undefined;
  let next = 0;
  const worker = async () => {
    while (next < asks.length && error === undefined) {
      const at = next++;
      const ask = asks[at]!;
      const key = cache ? await cacheKeyOf(model.model, ask) : undefined;
      const kept = key ? await cache!.get(key) : undefined;
      if (kept && Object.keys(ask.questions).every((question) => question in kept)) {
        answers[at] = kept;
        usage.cached++;
        usage.questions += Object.keys(ask.questions).length;
        continue;
      }
      // A request is counted before it is sent, so six at once never pass the budget together.
      const estimate = Math.ceil(JSON.stringify({ model: model.model, state: ask.state, questions: ask.questions }).length / 4);
      if (usage.requests >= maxRequests) {
        stopped ??= "requests";
        continue;
      }
      if (usage.inputTokens + estimate > maxTokens) {
        stopped ??= "tokens";
        continue;
      }
      usage.requests++;
      usage.inputTokens += estimate;
      try {
        const decided = await model.decide(ask.state, ask.questions);
        // The provider's own count, where it gave one, replaces the estimate.
        if (decided.usage.inputTokens > 0) usage.inputTokens += decided.usage.inputTokens - estimate;
        usage.outputTokens += decided.usage.outputTokens;
        usage.questions += Object.keys(ask.questions).length;
        answers[at] = decided.answers;
        if (key) await cache!.set(key, decided.answers);
      } catch (failure) {
        error ??= failure instanceof Error ? failure.message : String(failure);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 6, asks.length)) }, worker));
  const price = model.price;
  const costUsd = price ? (usage.inputTokens / 1_000_000) * (price.inputPerMillion ?? 0) + (usage.outputTokens / 1_000_000) * (price.outputPerMillion ?? 0) : undefined;
  return { answers, usage: { ...usage, ...(costUsd !== undefined ? { costUsd } : {}) }, ...(stopped ? { stopped } : {}), ...(error !== undefined ? { error } : {}) };
}
