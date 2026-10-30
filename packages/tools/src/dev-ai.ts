import { AI_BRIDGE_PATH, DECISION_BRIDGE_PATH, type AiBridgeAsk } from "@graview/core";
import { toldOver, type ToldStore } from "@graview/core/told";
import { NO_AI, type HostAi } from "./ai.js";
import { completionDecide } from "./decide.js";
import { JEV_INPUT_USD_PER_MILLION, JEV_MODEL, jevDecide } from "./providers/jev.js";
import type { FastProvider } from "./ai.js";
import { turnThroughMessages, type MessagesStepReply } from "./turn.js";

/** What the seat says in a dev build whose server holds no key. */
const NOTHING_HERE = "I can answer about what's in this app. Open questions need AI.";

type Fetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * THE HOST'S MODEL, THROUGH THE DEV SERVER'S DOOR (`aiDevProxy` in
 * `@graview/ship/dev`), for a page that should never hold a key.
 *
 * Asks the door once whether a model is there. When it is, the answer is a
 * `HostAi` whose `complete` posts each request through it (its words, framing and pictures; its signal gives up on the post), and whose `turn`
 * runs the seat's tool loop in the page, posting each Messages request
 * through it (`turnThroughMessages`), so the seat reads before it
 * answers. When the door is
 * there and holds no key, the answer says only how to turn one on — which
 * can only happen on a dev server, since a build carries no door. When
 * there is no door at all (a built page, another host), it is `NO_AI`, and
 * the seat says what any product's says.
 */
export async function aiThroughDevServer(options: { readonly path?: string; readonly decidePath?: string; readonly toldPath?: string; readonly fetch?: Fetch } = {}): Promise<HostAi> {
  const [ai, jev, told] = await Promise.all([throughTheModelDoor(options), jevThroughTheDecisionDoor(options), toldThroughTheDevServer(options)]);
  const lent = jev ? { ...ai, fast: jev } : ai;
  return told && !lent.off ? { ...lent, told } : lent;
}

/** Where the dev server keeps what people tell Graview (`devTold`, `@graview/ship/dev`): `/__graview/told`. */
export const DEV_TOLD_DOOR = "/__graview/told";

/*
 * WHAT PEOPLE TELL GRAVIEW, KEPT BY THE DEV SERVER (Roadmap f-menu-learns):
 * where it answers `/__graview/told`, the page keeps its tellings there —
 * the answer card's ratings, the menu's suggestions, the Studio's list.
 */
async function toldThroughTheDevServer(options: { readonly toldPath?: string; readonly fetch?: Fetch }): Promise<ToldStore | undefined> {
  const path = options.toldPath ?? DEV_TOLD_DOOR;
  const call = options.fetch ?? (globalThis.fetch as unknown as Fetch | undefined);
  if (!call) return undefined;
  try {
    const probe = await call(path, { method: "GET" });
    if (!probe.ok) return undefined;
    const body = (await probe.json()) as { tellings?: unknown };
    if (!Array.isArray(body?.tellings)) return undefined;
  } catch {
    return undefined;
  }
  return toldOver("", { path, ...(options.fetch ? { fetch: options.fetch as unknown as typeof fetch } : {}) });
}

/*
 * JEV IN THE FAST SLOT IN DEVELOPMENT (Roadmap f-menu-type-anything): where
 * the dev server holds a TypeSafe key (`decisionBridge`, TYPESAFE_API_KEY or
 * JEV_API_KEY), the page's Fast slot is Jev itself, its typed questions
 * posted through that door with the key on the server's side — in place of
 * the small model the model door lends when no key for Jev is set.
 */
async function jevThroughTheDecisionDoor(options: { readonly decidePath?: string; readonly fetch?: Fetch }): Promise<FastProvider | undefined> {
  const path = options.decidePath ?? DECISION_BRIDGE_PATH;
  const call = options.fetch ?? (globalThis.fetch as unknown as Fetch | undefined);
  if (!call) return undefined;
  try {
    const probe = await call(path, { method: "GET" });
    if (!probe.ok) return undefined;
    const status = (await probe.json()) as { available?: unknown };
    if (status?.available !== true) return undefined;
  } catch {
    return undefined;
  }
  return { model: JEV_MODEL, decide: jevDecide({ baseUrl: path, ...(options.fetch ? { fetch: options.fetch as never } : {}) }), price: { inputPerMillion: JEV_INPUT_USD_PER_MILLION } };
}

/** The host's model through the dev server's model door, and its small quick model as the Fast slot's stand-in. */
async function throughTheModelDoor(options: { readonly path?: string; readonly fetch?: Fetch }): Promise<HostAi> {
  const path = options.path ?? AI_BRIDGE_PATH;
  const call = options.fetch ?? (globalThis.fetch as unknown as Fetch | undefined);
  if (!call) return NO_AI;
  let status: { configured?: unknown; name?: unknown; howTo?: unknown; fast?: unknown; turns?: unknown };
  try {
    const probe = await call(path, { method: "GET" });
    if (!probe.ok) return NO_AI;
    status = (await probe.json()) as typeof status;
  } catch {
    // A static host answers with its page, or nothing: no door here.
    return NO_AI;
  }
  if (status?.configured === true) {
    const post = async (request: unknown, signal?: AbortSignal): Promise<{ text?: unknown; content?: unknown; stop_reason?: unknown; usage?: unknown }> => {
      const answer = await call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), ...(signal ? { signal } : {}) });
      const body = (await answer.json().catch(() => ({}))) as { text?: unknown; content?: unknown; stop_reason?: unknown; usage?: unknown; error?: unknown };
      if (!answer.ok) throw new Error(typeof body.error === "string" ? body.error : `The model door answered ${answer.status}.`);
      return body;
    };
    /*
     * A FAST SLOT IN DEVELOPMENT (Roadmap f-menu-type-anything): where the
     * door names a small quick model, the page's Fast slot asks it each
     * typed question through the same door (`tier: "fast"`), answered as a
     * decision provider would (`completionDecide`) — a stand-in for Jev, in
     * a dev server only, since a build has no door.
     */
    const fastModel = typeof status.fast === "string" && status.fast.length > 0 ? status.fast : undefined;
    return {
      name: typeof status.name === "string" ? status.name : "model",
      ...(fastModel
        ? {
            /* The light model: the same quick one, writing the few words a plan over the graph could not decide. */
            light: {
              model: fastModel,
              think: async ({ system, prompt }) => {
                const body = await post({ prompt, ...(system ? { system } : {}), tier: "fast" } satisfies AiBridgeAsk);
                if (typeof body.text !== "string") throw new Error("The model door answered with no text.");
                const usage = body.usage as { inputTokens?: unknown; outputTokens?: unknown } | undefined;
                return { text: body.text, ...(typeof usage?.inputTokens === "number" && typeof usage.outputTokens === "number" ? { usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } } : {}) };
              },
            },
            fast: {
              model: fastModel,
              decide: completionDecide(async ({ prompt }) => {
                const body = await post({ prompt, tier: "fast" } satisfies AiBridgeAsk);
                if (typeof body.text !== "string") throw new Error("The model door answered with no text.");
                const usage = body.usage as { inputTokens?: unknown; outputTokens?: unknown } | undefined;
                return { text: body.text, ...(typeof usage?.inputTokens === "number" && typeof usage.outputTokens === "number" ? { usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } } : {}) };
              }),
            },
          }
        : {}),
      complete: async ({ prompt, system, images, signal }) => {
        const asked: AiBridgeAsk = { prompt, ...(system ? { system } : {}), ...(images?.length ? { images } : {}) };
        const body = await post(asked, signal);
        if (typeof body.text !== "string") throw new Error("The model door answered with no text.");
        const usage = body.usage as { inputTokens?: unknown; outputTokens?: unknown } | undefined;
        return { text: body.text, ...(typeof usage?.inputTokens === "number" && typeof usage.outputTokens === "number" ? { usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } } : {}) };
      },
      /* The seat's turn (FR-160): the loop runs here, under the person's sight; the door makes each request with the key — where its provider takes a turn's tools (Anthropic), else the seat answers from `complete`. */
      ...(status.turns === false
        ? {}
        : {
            turn: turnThroughMessages(async (request) => {
              const body = await post(request);
              if (!Array.isArray(body.content)) throw new Error("The model door answered with no content.");
              return { content: body.content as MessagesStepReply["content"], stop_reason: typeof body.stop_reason === "string" ? body.stop_reason : null };
            }),
          }),
    };
  }
  if (status?.configured === false && typeof status.howTo === "string") return { withoutModel: `${NOTHING_HERE} ${status.howTo}` };
  return NO_AI;
}
