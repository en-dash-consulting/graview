import { AI_BRIDGE_PATH } from "@graview/core";
import { NO_AI, type HostAi } from "./ai.js";
import { turnThroughMessages, type MessagesStepReply } from "./turn.js";

/** What the seat says in a dev build whose server holds no key. */
const NOTHING_HERE = "I can answer about what's in this app. Open questions need AI.";

type Fetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * THE HOST'S MODEL, THROUGH THE DEV SERVER'S DOOR (`aiDevProxy` in
 * `@graview/ship/dev`), for a page that should never hold a key.
 *
 * Asks the door once whether a model is there. When it is, the answer is a
 * `HostAi` whose `complete` posts each prompt through it, and whose `turn`
 * runs the seat's tool loop in the page, posting each Messages request
 * through it (`turnThroughMessages`), so the seat reads before it
 * answers. When the door is
 * there and holds no key, the answer says only how to turn one on — which
 * can only happen on a dev server, since a build carries no door. When
 * there is no door at all (a built page, another host), it is `NO_AI`, and
 * the seat says what any product's says.
 */
export async function aiThroughDevServer(options: { readonly path?: string; readonly fetch?: Fetch } = {}): Promise<HostAi> {
  const path = options.path ?? AI_BRIDGE_PATH;
  const call = options.fetch ?? (globalThis.fetch as unknown as Fetch | undefined);
  if (!call) return NO_AI;
  let status: { configured?: unknown; name?: unknown; howTo?: unknown };
  try {
    const probe = await call(path, { method: "GET" });
    if (!probe.ok) return NO_AI;
    status = (await probe.json()) as typeof status;
  } catch {
    // A static host answers with its page, or nothing: no door here.
    return NO_AI;
  }
  if (status?.configured === true) {
    const post = async (request: unknown): Promise<{ text?: unknown; content?: unknown; stop_reason?: unknown }> => {
      const answer = await call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const body = (await answer.json().catch(() => ({}))) as { text?: unknown; content?: unknown; stop_reason?: unknown; error?: unknown };
      if (!answer.ok) throw new Error(typeof body.error === "string" ? body.error : `The model door answered ${answer.status}.`);
      return body;
    };
    return {
      name: typeof status.name === "string" ? status.name : "model",
      complete: async (prompt) => {
        const body = await post({ prompt });
        if (typeof body.text !== "string") throw new Error("The model door answered with no text.");
        return body.text;
      },
      /* The seat's turn (FR-160): the loop runs here, under the person's sight; the door makes each request with the key. */
      turn: turnThroughMessages(async (request) => {
        const body = await post(request);
        if (!Array.isArray(body.content)) throw new Error("The model door answered with no content.");
        return { content: body.content as MessagesStepReply["content"], stop_reason: typeof body.stop_reason === "string" ? body.stop_reason : null };
      }),
    };
  }
  if (status?.configured === false && typeof status.howTo === "string") return { withoutModel: `${NOTHING_HERE} ${status.howTo}` };
  return NO_AI;
}
