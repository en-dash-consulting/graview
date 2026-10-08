import { DECISION_BRIDGE_PATH, retryingImport, type AnySchema } from "@graview/core";
import { graphResponder, llmResponder, type ChatReply, type Responder } from "./conversation.js";
import { completionDecide } from "./decide.js";
import type { Completion } from "./intelligence.js";
import { jevDecide, type Decide } from "./providers/jev.js";

/*
 * The ladder itself — the rungs, the config and where it is kept — is
 * `./rungs.ts`, which reaches no model: a provider that reads the reader's
 * rung does not carry the chat that answers on it (FR-57).
 */
import { RUNGS, rungHonesty, type IntelligenceConfig } from "./rungs.js";

/* The in-browser model's loader, from its CDN when first warmed, and asked for again with a URL of its own when it did not arrive (FR-139). */
const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";
const webllmChunk = retryingImport((): Promise<unknown> => import(/* @vite-ignore */ WEBLLM_URL));
export { DEFAULT_INTELLIGENCE, loadIntelligenceConfig, RUNGS, rungFor, rungHonesty, saveIntelligenceConfig } from "./rungs.js";
export type { IntelligenceConfig, IntelligenceSource } from "./rungs.js";

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

/** What the local rung is doing, for a UI that wants to say so. */
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
 * rung on — it is not a build dependency, because most installs never
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
): { complete: Completion; ready: () => boolean; warm: () => void } {
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
     * Failing here, first, is what lets the chat header say WHY the rung
     * is unavailable in this browser rather than shrugging — and the
     * graph floor answers either way.
     */
    if (!(globalThis.navigator as { gpu?: unknown } | undefined)?.gpu) {
      throw new Error("this browser has no WebGPU, which the local model needs");
    }
    const webllm = (await webllmChunk()) as {
      CreateMLCEngine(model: string, options: { initProgressCallback?: (p: { progress: number; text: string }) => void }): Promise<EngineLike>;
    };
    return webllm.CreateMLCEngine(options.model ?? WEBLLM_DEFAULT_MODEL, {
      initProgressCallback: (report) =>
        say({ state: "warming", progress: report.progress, detail: report.text }),
    });
  };

  const warm = () => {
    engine = held.engine ?? engine;
    if (engine || warming) return;
    if (held.failed !== null) {
      say({ state: "failed", detail: held.failed });
      return;
    }
    warming = true;
    say({ state: "warming" });
    void bringUp()
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

  return { complete, ready: () => (held.engine ?? engine) !== null, warm };
}

/* ------------------------------------------------------ the whole ladder */

/**
 * THE MODEL BEHIND A RUNG, when the person has chosen one.
 *
 * A conversation is not the only thing a model is good for: drawing a
 * kind's figure is one prompt and one answer, judged by the checker's own
 * function. Both reach the same configured provider through this, so there
 * is one place a key is read and one place a rung is honored — and a
 * keyless config answers `undefined` rather than a completion that throws,
 * so a caller can say what it will do INSTEAD of drawing.
 */
export function completionFor(
  config: IntelligenceConfig,
  hooks: { readonly onStatus?: (status: LocalStatus) => void } = {},
): Completion | undefined {
  if (config.source === "remote" && config.remote?.apiKey) {
    const model =
      config.remote.model ?? (config.remote.preset === "custom" ? "a model" : XAI_DEFAULT_MODEL);
    return config.remote.preset === "custom" && config.remote.baseUrl
      ? openAiCompatibleCompletion({ baseUrl: config.remote.baseUrl, apiKey: config.remote.apiKey, model })
      : xaiCompletion({ apiKey: config.remote.apiKey, ...(config.remote.model ? { model: config.remote.model } : {}) });
  }
  if (config.source === "local") {
    const local = localCompletion({
      ...(config.local?.model ? { model: config.local.model } : {}),
      ...(hooks.onStatus ? { onStatus: hooks.onStatus } : {}),
    });
    /*
     * A cold engine is warmed rather than refused: the first ask pays for
     * the bring-up, and `complete` throws while it is cold — which the
     * callers already treat as "say what happened instead", never as a
     * silent failure.
     */
    if (!local.ready()) local.warm();
    return local.complete;
  }
  return undefined;
}

/**
 * One Responder from one config. The graph is always the floor: a remote
 * failure or a cold local model answers from the graph WITH A NOTE rather
 * than failing the conversation — a chat that errors where it could have
 * answered is worse than either rung alone.
 */
export function configuredResponder<S extends AnySchema>(
  config: IntelligenceConfig,
  hooks: {
    readonly onStatus?: (status: LocalStatus) => void;
    /**
     * The rung below every model, when a surface has one of its own. The
     * studio's floor answers about the DECLARATION — what kinds there are,
     * what an act writes — which the ordinary graph responder cannot know
     * to say; passing it here means the studio climbs the same ladder
     * rather than growing a second one beside it.
     */
    readonly floor?: Responder<S>;
    /**
     * WHAT THE SETTING IS NOW, asked after the answer lands. A person who
     * switches rungs while a turn is in flight gets the answer the old
     * rung was making — and is told so, in the answer, rather than
     * watching a turn quietly finish on a rung they left.
     */
    readonly current?: () => IntelligenceConfig;
  } = {},
): Responder<S> {
  const floor = hooks.floor ?? graphResponder<S>();
  const built = config.source;
  const switched = (reply: ChatReply): ChatReply => {
    const now = hooks.current?.();
    if (!now || now.source === built) return reply;
    return note(reply, `(answered on the ${RUNGS[built].label} rung — you switched to ${RUNGS[now.source].label} meanwhile.)`);
  };
  const honest = (responder: Responder<S>): Responder<S> => async (store, text, context) =>
    switched(await responder(store, text, context));

  /*
   * GROUNDED FACTS OUTRANK ANY MODEL. Whatever rung is chosen, a question
   * the graph can answer from its own structure — a standing, a named
   * thing, a who or a when — is answered by the graph: a small local model
   * asked "who can play left back" will fluently invent a goalkeeper, and
   * no rung is allowed to replace a fact with a guess about the same fact.
   *
   * A READING OF A CHANGE IS NOT A FACT, and treating it as one was the
   * ladder shutting the model out of the only thing it is better at.
   * Speaking a change loosely — "add details to Meal, the name of the food
   * and the number of people it can feed" — is two fields in one sentence,
   * and a pattern-matcher can only ever see one of them. So the floor's
   * reading goes UP to the model as a starting point: keep it, correct it,
   * or split it. What the model may not do is come back with less: an
   * answer with no proposals never replaces a reading that had them.
   */
  const groundedFirst =
    (modeled: Responder<S>, name: string): Responder<S> =>
    async (store, text, context) => {
      const known = await floor(store, text, context);
      if (known.grounded) return note(known, "(from the graph)");
      try {
        const answered = await modeled(store, text, {
          ...context,
          ...(known.proposals.length > 0 ? { reading: known.proposals } : {}),
        });
        if (answered.proposals.length === 0 && known.proposals.length > 0) {
          return note(known, "(from the graph)");
        }
        return answered;
      } catch (error) {
        return note(
          known,
          `(${name} did not answer — ${error instanceof Error ? error.message : String(error)}. The graph answered instead.)`,
        );
      }
    };

  if (config.source === "remote" && config.remote?.apiKey) {
    const model =
      config.remote.model ?? (config.remote.preset === "custom" ? "a model" : XAI_DEFAULT_MODEL);
    const complete = completionFor(config);
    if (complete) return honest(groundedFirst(llmResponder<S>({ complete }), model));
  }

  /*
   * THE RUNG THAT SAYS WHAT IT CANNOT DO. A decision provider has no prose,
   * so the conversation is the graph's — and the seat SAYS so, in the
   * answer itself, so every surface the seat speaks from carries the
   * sentence unchanged: the chat panel now, a figure's bubble later. The
   * same honesty the seat shows when it is refused an act.
   */
  if (config.source === "decision") {
    const why = rungHonesty(config, "prose")!;
    return honest(async (store, text, context) => note(await floor(store, text, context), why));
  }

  if (config.source === "local") {
    const local = localCompletion({
      ...(config.local?.model ? { model: config.local.model } : {}),
      ...(hooks.onStatus ? { onStatus: hooks.onStatus } : {}),
    });
    const modeled = groundedFirst(llmResponder<S>({ complete: local.complete }), "the local model");
    return honest(async (store, text, context) => {
      if (!local.ready()) {
        local.warm();
        const answered = await floor(store, text, context);
        return answered.grounded
          ? note(answered, "(from the graph)")
          : note(answered, "(the local model is warming — the graph answered meanwhile)");
      }
      return modeled(store, text, context);
    });
  }

  return honest(floor);
}

/**
 * THE DECISION BEHIND A RUNG, for a surface that asks for one — a field
 * that wants filling, a matrix that wants judging. On the decision rung
 * it is the provider exactly, by the person's key or through the dev
 * server's door; on a model rung it is the model with the parse-and-refuse
 * layer behind it; on the graph rung it is nothing here, because the
 * graph decides by its own rules and needs the store to do it
 * (`graphDecide`). A surface holding `undefined` falls down to that.
 */
export function decideFor(
  config: IntelligenceConfig,
  hooks: { readonly onStatus?: (status: LocalStatus) => void } = {},
): Decide | undefined {
  if (config.source === "decision") {
    const decision = config.decision ?? {};
    return decision.apiKey
      ? jevDecide({ apiKey: decision.apiKey, ...(decision.model ? { model: decision.model } : {}) })
      : jevDecide({ baseUrl: decision.bridge ?? DECISION_BRIDGE_PATH, ...(decision.model ? { model: decision.model } : {}) });
  }
  const complete = completionFor(config, hooks);
  return complete ? completionDecide(complete) : undefined;
}

function note(reply: ChatReply, added: string): ChatReply {
  return { ...reply, say: `${reply.say} ${added}` };
}

/** A word for the header: where answers are coming from right now. */
export function describeIntelligence(config: IntelligenceConfig): string {
  if (config.source === "remote" && config.remote?.apiKey) {
    return config.remote.preset === "custom"
      ? (config.remote.model ?? "custom model")
      : (config.remote.model ?? XAI_DEFAULT_MODEL);
  }
  if (config.source === "local") return "on-device";
  if (config.source === "decision") return `${config.decision?.model ?? "jev"} — decides; the graph talks`;
  return "graph-native";
}
