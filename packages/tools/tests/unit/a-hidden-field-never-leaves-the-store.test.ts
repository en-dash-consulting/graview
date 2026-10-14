import { createMemoryAdapter, defineApp, type Principal } from "@graview/core";
import { createStoreHandler, LIVE_PATH, openRemote, seatHeaders, type LiveServerMessage } from "@graview/ship";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";
import { coach, MUTATIONS, parent, policy, schema } from "../../../core/tests/support/hidden-phones.js";

/**
 * A FIELD A SEAT MAY NOT SEE NEVER LEAVES THE STORE FOR THAT SEAT (Roadmap
 * f-field-sight), on the routes, the live socket, a page `openRemote`
 * opened and an agent's tools — and nothing a parent is sent differs
 * between a player with a phone number and one without.
 */
const app = defineApp({ name: "roster", schema, mutations: MUTATIONS, policy, version: 1 });
const seed = {
  nodes: [
    { id: "person:cora", kind: "person", name: "Cora" },
    { id: "person:pat", kind: "person", name: "Pat" },
    { id: "player:bea", kind: "player", name: "Bea", phone: "444 0303" },
  ],
  edges: [{ kind: "guardian", from: "player:bea", to: "person:pat" }],
};
const NUMBERS = /0101|0202|asthma/;
const at = (seat: Principal, path: string, init: RequestInit = {}) => new Request(`https://store.example${path}`, { ...init, headers: { "content-type": "application/json", ...seatHeaders(seat) } });

/** A served roster where the coach added Ann, with a phone number or without, and called her. */
async function served(phone: string | undefined) {
  const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
  handler.store.apply({ name: "add-player", args: { name: "Ann", ...(phone ? { phone, medical: "asthma" } : {}) } }, { author: coach });
  handler.store.apply({ name: "call-player", args: { id: "player:ann" } }, { author: coach });
  return handler;
}

/** What a seat is sent, its clocks, batches and minted ids said alike. */
const alike = (value: unknown) => JSON.stringify(value).replace(/"(at|exportedAt)":"[^"]*"/g, '"$1":"now"').replace(/(batch|op|withheld):[a-z0-9:]+/g, "$1:minted").replace(/"(lastSeq|seq|version)":\d+/g, '"$1":0');

describe("a field a seat may not see, on the wire", () => {
  it("is in nothing the routes send a parent, and they send the same with a phone number as without", async () => {
    const sent = async (phone: string | undefined) => {
      const handler = await served(phone);
      const bodies = [];
      for (const path of ["/graview/state", "/graview/since?seq=-1", "/graview/export"]) bodies.push(await (await handler.handle(at(parent, path))).json());
      return bodies;
    };
    const withPhone = await sent("555 0101");
    expect(JSON.stringify(withPhone)).not.toMatch(NUMBERS);
    expect(alike(withPhone)).toBe(alike(await sent(undefined)));
    // The coach is sent it.
    expect(JSON.stringify(await (await (await served("555 0101")).handle(at(coach, "/graview/state"))).json())).toContain("555 0101");
  });

  it("is not in the live socket's welcome", async () => {
    const handler = await served("555 0101");
    const said: LiveServerMessage[] = [];
    const connection = await handler.connect(at(parent, LIVE_PATH), { send: (text) => said.push(JSON.parse(text) as LiveServerMessage) });
    if (connection instanceof Response) throw new Error("the socket was refused");
    connection.receive(JSON.stringify({ t: "hello" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(said.some((message) => message.t === "welcome")).toBe(true);
    expect(JSON.stringify(said)).not.toMatch(NUMBERS);
    connection.close();
  });

  it("is refused when the parent writes it, the same whatever the record held", async () => {
    const write = async (phone: string | undefined) => {
      const handler = await served(phone);
      const answer = await handler.handle(at(parent, "/graview/ops", { method: "POST", body: JSON.stringify({ calls: [{ name: "set-phone", args: { id: "player:ann", phone: "555 0101" } }] }) }));
      return { status: answer.status, body: alike(await answer.json()) };
    };
    const refused = await write("555 0101");
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.body).toContain('does not take \\"phone\\"');
    expect(refused).toEqual(await write(undefined));
  });

  it("is in no tool's answer, on the served store and through openRemote", async () => {
    const handler = await served("555 0101");
    const remote = await openRemote({ app, url: "https://store.example", principal: parent, fetch: ((url: string, init?: RequestInit) => handler.handle(new Request(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...seatHeaders(parent) } }))) as typeof fetch });
    expect(remote.store.graph.getNode("player:ann")).toMatchObject({ name: "Ann" });
    expect(JSON.stringify(remote.store.snapshot())).not.toMatch(NUMBERS);
    for (const store of [handler.store, remote.store]) {
      const runtime = createToolRuntime(store, { author: parent });
      const answers = [await runtime.call("get_node", { id: "player:ann" }), await runtime.call("search_graph", { query: "555" }), await runtime.call("get_graph", {})];
      expect(JSON.stringify(answers)).not.toMatch(NUMBERS);
      expect(JSON.stringify(answers[0])).toContain("Ann");
    }
    remote.close();
  });
});
