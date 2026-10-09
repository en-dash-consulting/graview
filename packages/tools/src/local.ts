import { DECISION_BRIDGE_PATH, type AnySchema, type IntelligenceProviderDeclaration } from "@graview/core";
import { aiVia, NO_AI_SAID, type HostAi } from "./ai.js";
import { graphResponder, llmResponder, type ChatReply, type Responder } from "./conversation.js";
import { completionDecide } from "./decide.js";
import type { Completion } from "./intelligence.js";
import { jevDecide, type Decide } from "./providers/jev.js";

/*
 * What the host gave a seat (`HostAi`) is `./ai.ts`, which reaches no
 * model: a provider that holds it does not carry the chat that answers
 * with it (FR-57). This file is the models themselves, and the one
 * responder that puts the graph in front of them.
 */

/* ------------------------------------------------------------- adapters */

const XAI_BASE = "https://api.x.ai/v1";
const XAI_DEFAULT_MODEL = "grok-4-fast";

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

/**
 * Any OpenAI-compatible /chat/completions endpoint as one Completion.
 * The call goes STRAIGHT from the browser to the provider — the key is
 * sent nowhere else, and there is no relay to trust.
 */
export function openAiCompatibleCompletion(options: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  /** Injectable for tests. */
  readonly fetch?: FetchLike;
}): Completion {
  const call = options.fetch ?? (globalThis.fetch as FetchLike);
  return async (prompt) => {
    const response = await call(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: [{ role: "user", content: prompt }],
      }),
      // A hung provider must not hang the conversation: the floor answers.
      ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? { signal: AbortSignal.timeout(45_000) }
        : {}),
    });
    if (!response.ok) {
      throw new Error(`${options.model} answered ${response.status}: ${(await response.text()).slice(0, 160)}`);
    }
    const parsed = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error(`${options.model} answered with no content`);
    return content;
  };
}

/** xAI's Grok, as a preset of the same shape. */
export function xaiCompletion(options: {
  readonly apiKey: string;
  readonly model?: string;
  readonly fetch?: FetchLike;
}): Completion {
  return openAiCompatibleCompletion({
    baseUrl: XAI_BASE,
    apiKey: options.apiKey,
    model: options.model ?? XAI_DEFAULT_MODEL,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

/* ---------------------------------------------------------- local model */

/** What the model in the reader's browser is doing, for a surface that wants to say so. */
export interface LocalStatus {
  readonly state: "cold" | "warming" | "ready" | "failed";
  /** 0–1 while warming, when the engine reports progress. */
  readonly progress?: number;
  readonly detail?: string;
}

interface EngineLike {
  chat: {
    completions: {
      create(options: {
        messages: { role: string; content: string }[];
      }): Promise<{ choices?: { message?: { content?: string } }[] }>;
    };
  };
}

const WEBLLM_DEFAULT_MODEL = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

/**
 * A model in the browser, warmed lazily and NEVER on the critical path.
 *
 * The weights are on the order of a couple of gigabytes, fetched once and
 * cached by the browser; until they are warm the chat answers from the
 * graph. WebLLM arrives by dynamic import at the moment someone turns the
 * model on — it is not a build dependency, because most installs never
 * will. Chrome's built-in Prompt API is used first where it exists: no
 * download at all.
 */
/*
 * ONE ENGINE PER MODEL, module-wide. Rebuilding the responder (a settings
 * save, a re-render) must not drop a two-gigabyte engine and warm a new
 * one — and a bring-up that failed stays failed rather than re-downloading
 * on every turn; a page reload is the retry.
 */
const ENGINES = new Map<string, { engine: EngineLike | null; failed: string | null }>();

export function localCompletion(
  options: {
    readonly model?: string;
    readonly onStatus?: (status: LocalStatus) => void;
    /** Injectable for tests: replaces the whole engine bring-up. */
    readonly load?: () => Promise<EngineLike>;
  } = {},
): {
  complete: Completion;
  ready: () => boolean;
  /** Starts the bring-up, once; settles when it has (or at once, when there is nothing to do). */
  warm: () => Promise<void>;
  /** Why the bring-up failed in this browser, or `null`. A reload is the retry. */
  failed: () => string | null;
} {
  const cacheKey = options.load ? null : (options.model ?? WEBLLM_DEFAULT_MODEL);
  const held = cacheKey
    ? (ENGINES.get(cacheKey) ?? ENGINES.set(cacheKey, { engine: null, failed: null }).get(cacheKey)!)
    : { engine: null as EngineLike | null, failed: null as string | null };
  let engine: EngineLike | null = held.engine;
  let warming = false;
  const say = (status: LocalStatus) => options.onStatus?.(status);

  const bringUp = async (): Promise<EngineLike> => {
    if (options.load) return options.load();

    // Chrome's built-in model first: zero download, no WebGPU contention.
    const prompt = (globalThis as { LanguageModel?: { create(): Promise<{ prompt(t: string): Promise<string> }> } })
      .LanguageModel;
    if (prompt) {
      const session = await prompt.create();
      return {
        chat: {
          completions: {
            create: async ({ messages }) => ({
              choices: [
                { message: { content: await session.prompt(messages[messages.length - 1]?.content ?? "") } },
              ],
            }),
          },
        },
      };
    }

    /*
     * CAPABILITY GATING, STATED. WebLLM needs WebGPU; without it the
     * engine would download megabytes of loader only to fail obscurely.
     * Failing here, first, is what lets the seat say AI didn't answer
     * rather than hanging — and the graph answers either way.
     */
    if (!(globalThis.navigator as { gpu?: unknown } | undefined)?.gpu) {
      throw new Error("this browser has no WebGPU, which the local model needs");
    }
    const url = "https://esm.run/@mlc-ai/web-llm";
    const webllm = (await import(/* @vite-ignore */ url)) as {
      CreateMLCEngine(model: string, options: { initProgressCallback?: (p: { progress: number; text: string }) => void }): Promise<EngineLike>;
    };
    return webllm.CreateMLCEngine(options.model ?? WEBLLM_DEFAULT_MODEL, {
      initProgressCallback: (report) =>
        say({ state: "warming", progress: report.progress, detail: report.text }),
    });
  };

  let bringing: Promise<void> = Promise.resolve();
  const warm = (): Promise<void> => {
    engine = held.engine ?? engine;
    if (engine) return Promise.resolve();
    if (warming) return bringing;
    if (held.failed !== null) {
      say({ state: "failed", detail: held.failed });
      return Promise.resolve();
    }
    warming = true;
    say({ state: "warming" });
    bringing = bringUp()
      .then((ready) => {
        engine = ready;
        held.engine = ready;
        say({ state: "ready" });
      })
      .catch((error) => {
        held.failed = error instanceof Error ? error.message : String(error);
        say({ state: "failed", detail: held.failed });
      })
      .finally(() => {
        warming = false;
      });
    return bringing;
  };

  const complete: Completion = async (prompt) => {
    engine = held.engine ?? engine;
    if (!engine) throw new Error("The local model is not warm yet");
    const answer = await engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
    });
    const content = answer.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("The local model answered with no content");
    return content;
  };

  return { complete, ready: () => (held.engine ?? engine) !== null, warm, failed: () => held.failed };
}

/* ------------------------------------------------- the host's AI, used */

/**
 * THE MODEL THE HOST GAVE, as one completion — or `undefined`, so a caller
 * can say what it will do INSTEAD (draw from a template, answer from the
 * graph). The host's `complete` first; a model in the reader's browser
 * only when the host turned `onDevice` on, warmed on first use and
 * throwing while cold, which callers already treat as "say what happened".
 */
export function completionFor(ai: HostAi, hooks: { readonly onStatus?: (status: LocalStatus) => void } = {}): Completion | undefined {
  return talkingModel(ai, hooks)?.complete;
}

interface TalkingModel {
  readonly complete: Completion;
  ready(): boolean;
  warm(): Promise<void>;
  failed(): string | null;
}

function talkingModel(ai: HostAi, hooks: { readonly onStatus?: (status: LocalStatus) => void }): TalkingModel | undefined {
  if (ai.complete) return { complete: ai.complete, ready: () => true, warm: () => Promise.resolve(), failed: () => null };
  if (!ai.onDevice) return undefined;
  const model = typeof ai.onDevice === "object" ? ai.onDevice.model : undefined;
  const local = localCompletion({ ...(model ? { model } : {}), ...(hooks.onStatus ? { onStatus: hooks.onStatus } : {}) });
  return {
    complete: async (prompt) => {
      if (!local.ready()) void local.warm();
      return local.complete(prompt);
    },
    ready: local.ready,
    warm: local.warm,
    failed: local.failed,
  };
}

/**
 * THE SEAT'S ONE RESPONDER: the graph first, the host's model after it.
 *
 * GROUNDED FACTS OUTRANK ANY MODEL. A question the graph can answer from
 * its own structure — a standing, a named thing, a who or a when — is
 * answered by the graph: a small model asked "who can play left back"
 * will fluently invent a goalkeeper, and nothing is allowed to replace a
 * fact with a guess about the same fact.
 *
 * A READING OF A CHANGE IS NOT A FACT. Speaking a change loosely — "add
 * details to Meal, the name of the food and the number of people it can
 * feed" — is two fields in one sentence, and a pattern-matcher can only
 * ever see one. So the graph's reading goes up to the model as a starting
 * point: keep it, correct it, or split it. What the model may not do is
 * come back with less: an answer with no proposals never replaces a
 * reading that had them.
 *
 * HONEST, QUIETLY. An answer a model gave carries `via` (the op log's
 * channel for whatever it proposes, and the seat's cue for one small
 * "Answered with AI"); an answer the graph gave carries nothing. With no
 * model, a question the graph could not read says so in one plain
 * sentence, and a model that fails leaves the graph's answer with one
 * quiet line — never a rung, a provider or a key.
 */
export function seatResponder<S extends AnySchema>(
  ai: HostAi,
  hooks: {
    readonly onStatus?: (status: LocalStatus) => void;
    /**
     * What answers before any model, when a surface has one of its own.
     * The studio's answers about the DECLARATION — what kinds there are,
     * what an act writes — which the graph's own responder cannot know to
     * say; passing it here keeps one way of putting a model behind it.
     */
    readonly floor?: Responder<S>;
  } = {},
): Responder<S> {
  const floor = hooks.floor ?? graphResponder<S>();
  const talking = talkingModel(ai, hooks);
  if (!talking) {
    return async (store, text, context) => {
      const known = await floor(store, text, context);
      // Said alone: the graph's description of its own shape was not what was asked.
      return known.unsure ? { ...known, say: NO_AI_SAID } : known;
    };
  }
  const modeled = llmResponder<S>({ complete: talking.complete });
  const via = aiVia(ai);
  return async (store, text, context) => {
    const known = await floor(store, text, context);
    if (known.grounded) return known;
    if (!talking.ready()) {
      /* A browser that cannot run it says so at once (no WebGPU fails in a moment); one that can is warming. */
      await Promise.race([talking.warm(), new Promise((settled) => setTimeout(settled, 100))]);
      if (talking.failed() !== null) return note(known, "(AI isn't available in this browser, so this is from the app alone.)");
      if (!talking.ready()) return note(known, "(AI is still getting ready on this device, so this is from the app alone.)");
    }
    try {
      const answered = await modeled(store, text, {
        ...context,
        ...(known.proposals.length > 0 ? { reading: known.proposals } : {}),
      });
      if (answered.proposals.length === 0 && known.proposals.length > 0) return known;
      return { ...answered, via };
    } catch {
      return note(known, "(AI didn't answer just now, so this is from the app alone.)");
    }
  };
}

/**
 * THE DECISION A SURFACE ASKS FOR — a field that wants filling, a matrix
 * that wants judging. The host's decision provider exactly; else one the
 * app's declaration names (`kind: "decision"`), reached through the dev
 * server's door, which holds the key so a browser never does; else the
 * host's model behind the parse-and-refuse layer; else `undefined`, and
 * the graph decides by its own rules (`graphDecide`).
 */
export function decideFor(
  ai: HostAi,
  options: {
    /** The app's declared providers (`store.intelligence`). */
    readonly intelligence?: readonly IntelligenceProviderDeclaration[];
    readonly onStatus?: (status: LocalStatus) => void;
  } = {},
): Decide | undefined {
  if (ai.decide) return ai.decide;
  const declared = options.intelligence?.find((provider) => provider.kind === "decision");
  if (declared) return jevDecide({ baseUrl: declared.bridge ?? DECISION_BRIDGE_PATH });
  const complete = completionFor(ai, options.onStatus ? { onStatus: options.onStatus } : {});
  return complete ? completionDecide(complete) : undefined;
}

function note(reply: ChatReply, added: string): ChatReply {
  return { ...reply, say: `${reply.say} ${added}` };
}
