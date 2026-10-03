import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, isWithheld, nodeRef, type Operation, type Principal } from "@graview/core";
import { createStoreHandler, LIVE_PATH, openRemote, seatHeaders, type LiveServerMessage } from "@graview/ship";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/**
 * A MODULE OFF IS OFF ON EVERY ROUTE AND TOOL (FR-12).
 *
 * `enabledModules` was a store option nobody passed: not `openStore`, not
 * `serveStore`, not `openRemote`. A host binding a workspace's modules to
 * what it pays for had nowhere to say so, and a served store sent every
 * record of a module the workspace did not have. The host now says which
 * modules are on where it opens or serves the store; the store refuses the
 * module's acts and the wire keeps its kinds the way a sight keeps a
 * record — gone from the graph, its ops withheld in place.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const vehicle = defineNode("vehicle", { fields: z.object({ label: z.string() }), plural: "Vehicles" });
const schema = createSchema([person, vehicle]);
const { defineMutation } = bindSchema(schema);
const addVehicle = defineMutation("add-vehicle", {
  title: "Add a vehicle",
  creates: ["vehicle"],
  input: z.object({ label: z.string() }),
  describe: (args) => `Add the vehicle “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "vehicle"), kind: "vehicle", label: args.label });
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["person", "vehicle"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["person", "vehicle"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({
  name: "household",
  schema,
  mutations: [addVehicle, rename],
  modules: { fleet: { description: "The cars a household keeps.", kinds: ["vehicle"], mutations: ["add-vehicle"] } },
  version: 1,
});
const seed = { nodes: [{ id: "person:ana", kind: "person", label: "Ana" }], edges: [] };
const ana: Principal = { kind: "human", id: "person:ana" };
const at = (path: string, init: RequestInit = {}) => new Request(`https://store.example${path}`, { ...init, headers: { "content-type": "application/json", ...seatHeaders(ana) } });
const post = (calls: unknown) => at("/graview/ops", { method: "POST", body: JSON.stringify({ calls }) });

/** A household that kept a car, then served with the fleet off. */
async function withoutTheFleet() {
  const adapter = createMemoryAdapter();
  const before = await createStoreHandler({ app, adapter, seed: seed as never, trustSeatHeaders: true });
  before.store.apply({ name: "add-vehicle", args: { label: "Golf" } }, { author: ana });
  await before.close();
  return createStoreHandler({ app, adapter, seed: seed as never, trustSeatHeaders: true, enabledModules: [] });
}

describe("a served store with a module off", () => {
  it("refuses the module's acts, and any act that names one of its records, on POST /graview/ops", async () => {
    const handler = await withoutTheFleet();
    const added = await handler.handle(post([{ name: "add-vehicle", args: { label: "Polo" } }]));
    expect(added.status).toBe(409);
    expect(((await added.json()) as { error: string }).error).toMatch(/turned off/);
    const renamed = await handler.handle(post([{ name: "rename", args: { id: "vehicle:golf", label: "Our Golf" } }]));
    expect(renamed.status).toBe(409);
    expect(handler.store.graph.getNode("vehicle:golf")?.label).toBe("Golf");
    // What the module does not own still runs.
    expect((await handler.handle(post([{ name: "rename", args: { id: "person:ana", label: "Ana Lima" } }]))).status).toBe(200);
  });

  it("hides its kinds from /graview/state, /graview/since and /graview/export, and says which modules are on", async () => {
    const handler = await withoutTheFleet();
    const state = (await (await handler.handle(at("/graview/state"))).json()) as { snapshot: { nodes: { kind: string }[] }; log: Operation[]; enabledModules: string[] };
    expect(state.enabledModules).toEqual([]);
    expect(state.snapshot.nodes.map((node) => node.kind)).toEqual(["person"]);
    expect(JSON.stringify(state)).not.toContain("Golf");
    // The car's op stands in its place, withheld; the module turning off is in the log as it is.
    expect(state.log.map(isWithheld)).toEqual([true, false]);
    const since = (await (await handler.handle(at("/graview/since?seq=-1"))).json()) as { ops: Operation[] };
    expect(JSON.stringify(since)).not.toContain("Golf");
    expect(since.ops).toHaveLength(2);
    expect(JSON.stringify(await (await handler.handle(at("/graview/export"))).json())).not.toContain("Golf");
    // Kept, not deleted: the store itself still holds the car.
    expect(handler.store.graph.getNode("vehicle:golf")?.label).toBe("Golf");
  });

  it("hides its kinds from the live wire's welcome", async () => {
    const handler = await withoutTheFleet();
    const said: LiveServerMessage[] = [];
    const connection = await handler.connect(at(LIVE_PATH), { send: (text) => said.push(JSON.parse(text) as LiveServerMessage) });
    if (connection instanceof Response) throw new Error("the socket was refused");
    connection.receive(JSON.stringify({ t: "hello" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const welcome = said.find((message) => message.t === "welcome") as Extract<LiveServerMessage, { t: "welcome" }>;
    expect(welcome.state?.enabledModules).toEqual([]);
    expect(JSON.stringify(welcome)).not.toContain("Golf");
    connection.close();
  });

  it("hides its acts and its kinds from every tool, on the served store and through openRemote", async () => {
    const handler = await withoutTheFleet();
    const remote = await openRemote({ app, url: "https://store.example", principal: ana, fetch: ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch });
    expect([...remote.store.modules.enabled]).toEqual([]);
    for (const store of [handler.store, remote.store]) {
      const runtime = createToolRuntime(store, { author: ana });
      const names = runtime.definitions.map((tool) => tool.name);
      expect(names.some((name) => name.includes("vehicle"))).toBe(false);
      const graph = await runtime.call("get_graph", {});
      expect(JSON.stringify(graph)).not.toContain("Golf");
      const found = await runtime.call("search_graph", { query: "Golf" });
      expect(JSON.stringify(found)).not.toContain("vehicle:golf");
      expect((await runtime.call("get_node", { id: "vehicle:golf" })).ok).toBe(false);
    }
    // A stateless host lists the same surface from the served state's own word.
    const { definitions } = toolDefinitions(app, ana, { enabledModules: [...remote.store.modules.enabled] });
    expect(definitions.some((tool) => tool.name.includes("vehicle"))).toBe(false);
    remote.close();
  });
});
