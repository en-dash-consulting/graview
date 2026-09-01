import type { AnySchema } from "@graview/core";
import { graphResponder, llmResponder, type ChatReply, type Responder } from "./conversation.js";
import type { Completion } from "./intelligence.js";

/**
 * THE INTELLIGENCE LADDER, as configuration a person can climb.
 *
 * Three rungs: the graph answers for itself (keyless, always there); a
 * model runs in the person's own browser (free after the download, and
 * nothing leaves the machine); a frontier model answers over the network
 * with the person's own key. All three are the same Responder contract, so
 * choosing a rung is choosing a config value — and whatever answers, its
 * proposals still travel the one validated path.
 *
 * The config is plain serialisable data in the BROWSER's storage, because
 * an API key belongs to the person at the keyboard: it must never sit in a
 * repo, a bundle, or a declaration that ships.
 */

export interface IntelligenceConfig {
  readonly source: "graph" | "local" | "remote";
  readonly local?: {
    /** A WebLLM model id. The default is small enough to be honest about. */
    readonly model?: string;
  };
  readonly remote?: {
    readonly preset?: "xai" | "custom";
    /** For `custom`: any OpenAI-compatible /chat/completions endpoint. */
    readonly baseUrl?: string;
    readonly apiKey: string;
    readonly model?: string;
  };
}

export const DEFAULT_INTELLIGENCE: IntelligenceConfig = { source: "graph" };

const STORED = "graview:intelligence";

/** The saved rung, or the keyless default — never a throw. */
export function loadIntelligenceConfig(): IntelligenceConfig {
  try {
    const raw = globalThis.localStorage?.getItem(STORED);
    if (!raw) return DEFAULT_INTELLIGENCE;
    const parsed = JSON.parse(raw) as IntelligenceConfig;
    if (parsed.source === "graph" || parsed.source === "local" || parsed.source === "remote") {
      return parsed;
    }
    return DEFAULT_INTELLIGENCE;
  } catch {
    return DEFAULT_INTELLIGENCE;
  }
}

export function saveIntelligenceConfig(config: IntelligenceConfig): void {
  try {
    globalThis.localStorage?.setItem(STORED, JSON.stringify(config));
  } catch {
    // A rung that cannot be remembered still applies for this visit.
  }
}

/* ------------------------------------------------------------- adapters */

const XAI_BASE = "https://api.x.ai/v1";
const XAI_DEFAULT_MODEL = "grok-4-fast";

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
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
  const call = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
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
export function localCompletion(
  options: {
    readonly model?: string;
    readonly onStatus?: (status: LocalStatus) => void;
    /** Injectable for tests: replaces the whole engine bring-up. */
    readonly load?: () => Promise<EngineLike>;
  } = {},
): { complete: Completion; ready: () => boolean; warm: () => void } {
  let engine: EngineLike | null = null;
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

    const url = "https://esm.run/@mlc-ai/web-llm";
    const webllm = (await import(/* @vite-ignore */ url)) as {
      CreateMLCEngine(model: string, options: { initProgressCallback?: (p: { progress: number; text: string }) => void }): Promise<EngineLike>;
    };
    return webllm.CreateMLCEngine(options.model ?? WEBLLM_DEFAULT_MODEL, {
      initProgressCallback: (report) =>
        say({ state: "warming", progress: report.progress, detail: report.text }),
    });
  };

  const warm = () => {
    if (engine || warming) return;
    warming = true;
    say({ state: "warming" });
    void bringUp()
      .then((ready) => {
        engine = ready;
        say({ state: "ready" });
      })
      .catch((error) => {
        say({ state: "failed", detail: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => {
        warming = false;
      });
  };

  const complete: Completion = async (prompt) => {
    if (!engine) throw new Error("The local model is not warm yet");
    const answer = await engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
    });
    const content = answer.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("The local model answered with no content");
    return content;
  };

  return { complete, ready: () => engine !== null, warm };
}

/* ------------------------------------------------------ the whole ladder */

/**
 * One Responder from one config. The graph is always the floor: a remote
 * failure or a cold local model answers from the graph WITH A NOTE rather
 * than failing the conversation — a chat that errors where it could have
 * answered is worse than either rung alone.
 */
export function configuredResponder<S extends AnySchema>(
  config: IntelligenceConfig,
  hooks: { readonly onStatus?: (status: LocalStatus) => void } = {},
): Responder<S> {
  const floor = graphResponder<S>();

  if (config.source === "remote" && config.remote?.apiKey) {
    const model =
      config.remote.model ?? (config.remote.preset === "custom" ? "a model" : XAI_DEFAULT_MODEL);
    const complete =
      config.remote.preset === "custom" && config.remote.baseUrl
        ? openAiCompatibleCompletion({
            baseUrl: config.remote.baseUrl,
            apiKey: config.remote.apiKey,
            model,
          })
        : xaiCompletion({ apiKey: config.remote.apiKey, ...(config.remote.model ? { model: config.remote.model } : {}) });
    const modelled = llmResponder<S>({ complete });
    return async (store, text, context) => {
      try {
        return await modelled(store, text, context);
      } catch (error) {
        const answered = await floor(store, text, context);
        return note(
          answered,
          `(${model} did not answer — ${error instanceof Error ? error.message : String(error)}. The graph answered instead.)`,
        );
      }
    };
  }

  if (config.source === "local") {
    const local = localCompletion({
      ...(config.local?.model ? { model: config.local.model } : {}),
      ...(hooks.onStatus ? { onStatus: hooks.onStatus } : {}),
    });
    const modelled = llmResponder<S>({ complete: local.complete });
    return async (store, text, context) => {
      if (!local.ready()) {
        local.warm();
        const answered = await floor(store, text, context);
        return note(answered, "(the local model is warming — the graph answered meanwhile)");
      }
      try {
        return await modelled(store, text, context);
      } catch (error) {
        const answered = await floor(store, text, context);
        return note(
          answered,
          `(the local model failed — ${error instanceof Error ? error.message : String(error)}. The graph answered instead.)`,
        );
      }
    };
  }

  return floor;
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
  return "graph-native";
}
