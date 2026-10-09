import { AI_BRIDGE_PATH } from "@graview/core";
import { NO_AI, type HostAi } from "./ai.js";

/** What the seat says in a dev build whose server holds no key. */
const NOTHING_HERE = "I can answer about what's in this app. Open questions need AI.";

type Fetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * THE HOST'S MODEL, THROUGH THE DEV SERVER'S DOOR (`aiDevProxy` in
 * `@graview/ship/dev`), for a page that should never hold a key.
 *
 * Asks the door once whether a model is there. When it is, the answer is a
 * `HostAi` whose `complete` posts each prompt through it. When the door is
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
    return {
      name: typeof status.name === "string" ? status.name : "model",
      complete: async (prompt) => {
        const answer = await call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) });
        const body = (await answer.json().catch(() => ({}))) as { text?: unknown; error?: unknown };
        if (!answer.ok || typeof body.text !== "string") throw new Error(typeof body.error === "string" ? body.error : `The model door answered ${answer.status}.`);
        return body.text;
      },
    };
  }
  if (status?.configured === false && typeof status.howTo === "string") return { withoutModel: `${NOTHING_HERE} ${status.howTo}` };
  return NO_AI;
}
