import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type Policy, type Presence, type Principal } from "@graview/core";
import { createStoreHandler } from "@graview/ship/runtime";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createMcpHttpHandler, type McpCall } from "../../src/index.js";

/**
 * AN AGENT THAT ONLY LOOKS IS IN THE ROOM TOO. A store handler announces an
 * agent seat when an op of its lands, so an agent acting for Ada over MCP
 * shows as "Claude, for Ada" while it changes things — and not at all
 * while it reads, which is most of what it does. The MCP handler now tells
 * its host about every tool call before it answers (`onCall`), read-only
 * included, and a store handler's `onCall` is the hook to hand it: the
 * agent is announced on its reads, under the same rules as on its writes
 * (`announceAgents`, and for whom only to a seat that may see the person).
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Tasks" });
const schema = createSchema([person, task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  description: "Mark it done.",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const policy: Policy = {
  grants: [{ roles: ["member", "staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["task"] },
    { roles: ["staff"], kinds: ["person"] },
    { roles: ["member"], kinds: ["person"], own: true },
  ],
};
const app = defineApp({ name: "room", schema, mutations: [finish], policy, version: 1 });
const snapshot = {
  nodes: [
    { id: "person:ada", kind: "person", label: "Ada" },
    { id: "person:bo", kind: "person", label: "Bo" },
    { id: "t1", kind: "task", label: "Book the hall", done: false },
  ],
  edges: [],
};
const ada: Principal = { kind: "human", id: "person:ada", name: "Ada", roles: ["member"] };
const bo: Principal = { kind: "human", id: "person:bo", name: "Bo", roles: ["member"] };
const rhian: Principal = { kind: "human", id: "staff:rhian", name: "Rhian", roles: ["staff"] };
const claude: Principal = { kind: "agent", id: "claude", name: "Claude", roles: ["member"], onBehalfOf: ada };
const SEATS: Record<string, Principal> = { ada, bo, rhian, claude };
const seatOf = (request: Request) => SEATS[request.headers.get("authorization") ?? ""] ?? bo;

const rpc = (method: string, params: Record<string, unknown> = {}, id = 1) =>
  new Request("https://room.example/mcp", {
    method: "POST",
    headers: { authorization: "claude", "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
const room = () => new Store({ schema, mutations: [finish], policy, snapshot: snapshot as never });
const agentIn = (who: readonly Presence[]) => who.find((presence) => presence.kind === "agent");

async function mounted(announceAgents?: boolean | number) {
  const handler = await createStoreHandler({ app, store: room(), seatOf, presenceTtlMs: 60_000, ...(announceAgents !== undefined ? { announceAgents } : {}) });
  const mcp = createMcpHttpHandler({ store: () => handler.store, authenticate: seatOf, name: "room", version: "0.0.0", onCall: handler.onCall });
  const who = async (seat: string) => ((await (await handler.handle(new Request("https://room.example/graview/who", { headers: { authorization: seat } }))).json()) as { who: Presence[] }).who;
  return { handler, mcp, who };
}

describe("the MCP handler tells its host about every tool call", () => {
  it("hands onCall the caller, the tool and whether it only reads — before it answers, and never for a list", async () => {
    const calls: McpCall[] = [];
    const store = room();
    const mcp = createMcpHttpHandler({
      store,
      authenticate: seatOf,
      name: "room",
      version: "0.0.0",
      onCall: (call) => {
        // Before it answers: the act has not landed yet.
        calls.push({ ...call, arguments: { ...call.arguments, doneWhenTold: store.graph.getNode("t1")?.["done"] } });
      },
    });
    await mcp(rpc("tools/list"));
    expect(calls).toEqual([]);
    const read = await mcp(rpc("tools/call", { name: "get_node", arguments: { id: "t1" } }));
    expect(read.status).toBe(200);
    await mcp(rpc("tools/call", { name: "finish", arguments: { id: "t1" } }, 2));
    expect(calls.map(({ principal, tool, readOnly, arguments: args }) => ({ principal: principal.id, tool, readOnly, args }))).toEqual([
      { principal: "claude", tool: "get_node", readOnly: true, args: { id: "t1", doneWhenTold: false } },
      { principal: "claude", tool: "finish", readOnly: false, args: { id: "t1", doneWhenTold: false } },
    ]);
    expect(calls[0]!.request).toBeInstanceOf(Request);
  });

  it("answers the call whatever the hook does: it observes, it cannot refuse", async () => {
    const mcp = createMcpHttpHandler({
      store: room(),
      authenticate: seatOf,
      name: "room",
      version: "0.0.0",
      onCall: () => {
        throw new Error("the presence service is down");
      },
    });
    const answered = (await (await mcp(rpc("tools/call", { name: "get_node", arguments: { id: "t1" } }))).json()) as { result?: { isError?: boolean } };
    expect(answered.result?.isError).toBeFalsy();
  });
});

describe("mounted on a store handler", () => {
  it("shows an agent that only read, as the agent and for whom, to each seat as it may see the person", async () => {
    const { handler, mcp, who } = await mounted();
    expect(agentIn(await who("rhian"))).toBeUndefined();
    await mcp(rpc("tools/call", { name: "get_node", arguments: { id: "t1" } }));
    expect(handler.store.log.all()).toHaveLength(0);
    expect(agentIn(await who("rhian"))).toMatchObject({ participant: "agent:claude:visit", kind: "agent", name: "Claude", onBehalfOf: "person:ada", onBehalfOfName: "Ada" });
    expect(Date.parse(agentIn(await who("rhian"))!.until!)).toBeGreaterThan(Date.now());
    // Bo may not see Ada's record: Claude is here, and for whom is not said to him.
    const bos = agentIn(await who("bo"));
    expect(bos).toMatchObject({ participant: "agent:claude:visit", kind: "agent", name: "Claude" });
    expect(JSON.stringify(bos)).not.toContain("ada");
    // An act after the read still stands over what it wrote.
    await mcp(rpc("tools/call", { name: "finish", arguments: { id: "t1" } }, 2));
    expect(agentIn(await who("rhian"))).toMatchObject({ participant: "agent:claude:visit", over: "t1" });
    await handler.close();
  });

  it("announces nobody when the host said not to, and never a person's call", async () => {
    const off = await mounted(false);
    await off.mcp(rpc("tools/call", { name: "get_node", arguments: { id: "t1" } }));
    expect(await off.who("rhian")).toEqual([]);
    await off.handler.close();

    const on = await mounted();
    on.handler.onCall({ principal: bo });
    expect(await on.who("rhian")).toEqual([]);
    await on.handler.close();
  });
});
