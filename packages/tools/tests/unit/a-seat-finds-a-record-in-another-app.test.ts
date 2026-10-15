import { createSchema, defineNode, linkedRecordField, Store, type AnySchema } from "@graview/core";
import { linkedRecordsOver } from "@graview/core/linked";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/**
 * FR-171. THE AGENT'S SURFACE NAMES A RELATION TO ANOTHER APP AND HOW TO LINK
 * ONE. An app whose scenarios link houses in `@nick/house` lists
 * `find_linked`: it finds the houses this seat may link, each with the value
 * the scenario's edit takes, and reads the house a scenario links — as the
 * seat, so a seat that may not open the house app is told it is denied and
 * nothing of it. An app that links no other app does not list the tool.
 */
const house = defineNode("house", { fields: z.object({ street: z.string(), listPrice: z.number().optional() }), label: (node: { street: string }) => node.street });
const houses = new Store<AnySchema>({
  schema: createSchema([house]) as AnySchema,
  snapshot: { nodes: [{ id: "h1", kind: "house", street: "12 Elm Street", listPrice: 450_000 }, { id: "h2", kind: "house", street: "4 Oak Lane", listPrice: 320_000 }], edges: [] } as never,
});
const scenario = defineNode("scenario", { fields: z.object({ name: z.string(), forHouse: linkedRecordField("@nick/house/house").optional() }) });
const scenarios = () =>
  new Store<AnySchema>({ schema: createSchema([scenario]) as AnySchema, snapshot: { nodes: [{ id: "s1", kind: "scenario", name: "Buy it outright", forHouse: "house:h1" }], edges: [] } as never });
const host = linkedRecordsOver({ "@nick/house": { store: houses, name: "House", opens: (viewer) => viewer.id !== "agent:stranger" } });

describe("an agent's seat and a relation to another app", () => {
  it("lists find_linked only for an app that links another, and says how to link one in the edit's schema", () => {
    const listed = toolDefinitions({ schema: createSchema([scenario]) as AnySchema }).definitions;
    expect(listed.map((tool) => tool.name)).toContain("find_linked");
    expect(toolDefinitions({ schema: createSchema([house]) as AnySchema }).definitions.map((tool) => tool.name)).not.toContain("find_linked");
    const edit = listed.find((tool) => tool.name === "edit-scenario")!;
    const forHouse = (edit.inputSchema as { properties: Record<string, { description?: string; "x-graview-linked"?: unknown }> }).properties["forHouse"]!;
    expect(forHouse["x-graview-linked"]).toEqual({ address: "@nick/house", kinds: ["house"], cardinality: "one" });
    expect(forHouse.description).toContain('as "house:<id>" — an id found there with find_linked');
  });

  it("finds the records it may link, each with the value its edit takes, and links one", async () => {
    const store = scenarios();
    const seat = createToolRuntime(store, { author: { kind: "agent", id: "agent:helper" }, linked: host });
    const found = await seat.call("find_linked", { relation: "forHouse", query: "oak" });
    expect(found).toMatchObject({ ok: true, data: { app: "@nick/house", records: [{ value: "house:h2", label: "4 Oak Lane" }] } });
    const linked = await seat.call("edit-scenario", { id: "s1", forHouse: "house:h2" });
    expect(linked.ok).toBe(true);
    expect(store.graph.getNode("s1")).toMatchObject({ forHouse: "house:h2" });
  });

  it("reads what a record links, as the seat — and a seat that may not open the app is told denied, and nothing of it", async () => {
    const helper = createToolRuntime(scenarios(), { author: { kind: "agent", id: "agent:helper" }, linked: host });
    expect(await helper.call("find_linked", { relation: "scenario.forHouse", of: "s1" })).toMatchObject({ ok: true, data: { records: [{ value: "house:h1", label: "12 Elm Street", fields: { listPrice: 450_000 } }] } });
    const stranger = createToolRuntime(scenarios(), { author: { kind: "agent", id: "agent:stranger" }, linked: host });
    const read = await stranger.call("find_linked", { relation: "forHouse", of: "s1" });
    expect(read).toMatchObject({ ok: true, data: { records: [{ denied: true, said: "linked record (no access)" }] } });
    expect(JSON.stringify(read)).not.toContain("Elm");
    expect(await stranger.call("find_linked", { relation: "forHouse", query: "" })).toMatchObject({ ok: true, data: { denied: true } });
    expect(await createToolRuntime(scenarios(), {}).call("find_linked", { relation: "forHouse" })).toMatchObject({ ok: false, error: expect.stringContaining("its host reads no other app's records") });
  });
});
