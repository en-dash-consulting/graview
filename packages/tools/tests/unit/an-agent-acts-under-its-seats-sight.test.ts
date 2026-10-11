import type { AnySchema, Principal, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { guest, keeper, world } from "../../../core/tests/support/hidden-holds.js";
import { createMcpHttpHandler, createToolRuntime } from "../../src/index.js";

/**
 * AN AGENT ACTS UNDER ITS SEAT'S SIGHT (FR-55).
 *
 * An agent's tools run the store's acts as its seat, and an act's own body
 * read the whole store: a booking refused for a hold the seat could not
 * see, and went through where there was none, so the agent was told a
 * hidden hold was there. Every tool an agent acts through — the act's own
 * tool, its preview, the affordances it is offered, and the same over MCP —
 * now answers the same in a world with the hold as in one without it.
 */
const ROOM = "room:blue";
const CALLS = [
  ["get_affordances", { selection: [ROOM] }],
  ["preview_mutation", { mutation: "book-room", args: { id: ROOM } }],
  ["preview_mutation", { mutation: "tally-room", args: { id: ROOM } }],
  ["book-room", { id: ROOM }],
  ["release-room", { id: ROOM }],
  ["tally-room", { id: ROOM }],
  ["tidy-room", { id: ROOM }],
] as const;

/** Minted ids, clocks and timings said alike: what is left is what the agent is told. */
const alike = (text: string) =>
  text
    .replace(/(batch|op):[a-z0-9:]+/g, "$1:minted")
    .replace(/"at":"[^"]*"/g, '"at":"now"')
    .replace(/\\"at\\":\\"[^"\\]*\\"/g, '\\"at\\":\\"now\\"')
    .replace(/(\\?)"ms\1":\s*[\d.]+/g, '$1"ms$1":0');

async function toldThroughTools(store: Store<AnySchema>, seat: Principal): Promise<string[]> {
  const tools = createToolRuntime(store, { author: seat });
  const out: string[] = [];
  for (const [name, args] of CALLS) out.push(alike(JSON.stringify(await tools.call(name, args as never))));
  return out;
}

async function toldOverMcp(store: Store<AnySchema>, seat: Principal): Promise<string[]> {
  const handler = createMcpHttpHandler({ store, name: "holds", version: "0.0.0", authenticate: () => seat });
  const out: string[] = [];
  let id = 0;
  for (const [name, args] of CALLS) {
    const response = await handler(new Request("http://graview.test/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }) }));
    out.push(alike(await response.text()));
  }
  return out;
}

describe("an agent acts under its seat's sight", () => {
  it("is told the same by every tool, acting and asking, whether a hold it may not see exists", async () => {
    const held = await toldThroughTools(world(true), guest);
    const none = await toldThroughTools(world(false), guest);
    for (const [at, [name]] of CALLS.entries()) expect(held[at], name).toBe(none[at]);
    expect(held.join("\n")).not.toContain("Freya");
  });

  it("is told the same over MCP", async () => {
    const held = await toldOverMcp(world(true), guest);
    const none = await toldOverMcp(world(false), guest);
    for (const [at, [name]] of CALLS.entries()) expect(held[at], name).toBe(none[at]);
    expect(held.join("\n")).not.toContain("Freya");
  });

  it("still refuses a seat that sees the hold, in the act's own words", async () => {
    const result = await createToolRuntime(world(true), { author: keeper }).call("book-room", { id: ROOM });
    expect(result).toMatchObject({ ok: false, reason: "refused" });
    expect(JSON.stringify(result)).toContain("Freya Davies holds it.");
  });
});
