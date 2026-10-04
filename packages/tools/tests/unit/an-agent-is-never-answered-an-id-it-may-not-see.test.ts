import { createSchema, defineNode, Store, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { leaked, storeOf, unseenIds, world } from "../../../core/tests/support/unseen-worlds.js";
import { createMcpHttpHandler } from "../../src/index.js";

/**
 * AN AGENT IS NEVER ANSWERED AN ID IT MAY NOT SEE (FR-55).
 *
 * `createMcpHttpHandler` reads through the seat view, and the seat view
 * served a hidden record's id in a seen record's field; an act's answer
 * handed back its whole diff, whatever it touched. Every tool answer, as
 * the text the agent receives, now holds no unseen record's id.
 */
const WORLDS = 1000;

function handlerOver(store: Store<AnySchema>, seat: Principal) {
  return createMcpHttpHandler({ store, name: "worlds", version: "0.0.0", authenticate: () => seat });
}

/** Every answer the handler gives these tool calls, as the text the agent is sent. */
async function answers(handler: (request: Request) => Promise<Response>, calls: readonly { name: string; arguments: Record<string, unknown> }[]): Promise<string[]> {
  const out: string[] = [];
  let id = 0;
  const rpc = async (method: string, params: unknown) => {
    const response = await handler(new Request("http://graview.test/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) }));
    out.push(await response.text());
  };
  await rpc("tools/list", {});
  for (const call of calls) await rpc("tools/call", call);
  return out;
}

/** A JSON-RPC answer with the JSON a tool result carries as text read too, so an id inside it is a string of its own. */
function opened(value: unknown): unknown {
  if (typeof value === "string" && /^\s*[[{]/.test(value)) {
    try {
      return opened(JSON.parse(value));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(opened);
  // A name resolved says back what the caller `given`, its own argument: that tells it nothing it did not send.
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).flatMap(([key, inner]) => (key === "given" ? [] : [[key, opened(inner)]])));
  return value;
}

describe("an agent is never answered an id it may not see", () => {
  it("answers get_graph and get_node on Cloud's reproduction without the hidden record's id", async () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string(), ref: z.string().optional() }) });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const store = new Store<AnySchema>({
      schema: createSchema([pub, secret]) as unknown as AnySchema,
      policy: { grants: [], sees: [{ roles: ["viewer"], kinds: ["pub"] }] },
      snapshot: { nodes: [{ id: "pub:p1", kind: "pub", title: "P", ref: "secret:s1" }, { id: "secret:s1", kind: "secret", title: "S" }], edges: [] },
    });
    const said = await answers(handlerOver(store, { kind: "agent", id: "claude", roles: ["viewer"] }), [
      { name: "get_graph", arguments: {} },
      { name: "get_node", arguments: { id: "pub:p1" } },
      { name: "search_graph", arguments: { query: "P" } },
    ]);
    expect(leaked(opened(said), ["pub:p1"])).toBe("pub:p1");
    expect(leaked(opened(said), ["secret:s1"])).toBeUndefined();
    expect(said.join("\n")).not.toContain("secret:s1");
  });

  it(`never answers an unseen id, reading or acting — ${WORLDS.toLocaleString("en")} random worlds`, async () => {
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed);
      const store = storeOf(w);
      const unseen = unseenIds(w);
      const ids = [...w.kindOf.keys()];
      const said = await answers(handlerOver(store, w.viewer), [
        { name: "get_graph", arguments: {} },
        ...ids.slice(0, 8).map((id) => ({ name: "get_node", arguments: { id } })),
        { name: "search_graph", arguments: { query: "T" } },
        { name: "get_violations", arguments: {} },
        { name: "preview_mutation", arguments: { mutation: "point", args: { id: w.pick(ids), ref: w.anyId() } } },
        { name: "point", arguments: { id: w.pick(ids), ref: w.anyId() } },
        { name: "retitle", arguments: { id: w.pick(ids), title: "Again" } },
        { name: "undo_batch", arguments: { batch: w.pick(store.log.all()).batch } },
      ]);
      for (const text of said) {
        const id = leaked(opened(text), unseen);
        expect(id, `seed ${seed}: names unseen ${id}: ${text.slice(0, 400)}`).toBeUndefined();
      }
    }
  }, 120_000);
});
