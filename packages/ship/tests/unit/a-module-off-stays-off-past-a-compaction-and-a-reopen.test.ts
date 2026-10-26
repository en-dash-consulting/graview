import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { openStore } from "../../src/index.js";

/**
 * A MODULE OFF STAYS OFF PAST A COMPACTION AND A REOPEN (FR-12, FR-23). A
 * served store has no starting set of its own (`openStore` records the
 * host's as an op), so once a compaction archived the op that turned a
 * module off, the live store and every reopen without the host's word
 * turned it back on. The checkpoint now keeps the set, and both keep it.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const vehicle = defineNode("vehicle", { fields: z.object({ label: z.string() }), plural: "Vehicles" });
const schema = createSchema([person, vehicle]);
const { defineMutation } = bindSchema(schema);
const addVehicle = defineMutation("add-vehicle", {
  title: "Add a vehicle",
  creates: ["vehicle"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "vehicle"), kind: "vehicle", label: args.label });
  },
});
const addPerson = defineMutation("add-person", {
  title: "Add a person",
  creates: ["person"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "person"), kind: "person", label: args.label });
  },
});
const modules = { fleet: { kinds: ["vehicle"], mutations: ["add-vehicle"] } };
const app = defineApp({ name: "household", schema, mutations: [addVehicle, addPerson], modules, version: 1 });
const seed = { nodes: [{ id: "person:ana", kind: "person", label: "Ana" }], edges: [] };
const ana: Principal = { kind: "human", id: "person:ana" };

describe("a module off stays off past a compaction and a reopen", () => {
  it("keeps it off live, on a reopen without the host's word, and on one with it", async () => {
    const adapter = createMemoryAdapter();
    const first = await openStore({ app, adapter, seed: seed as never });
    first.store.apply({ name: "add-vehicle", args: { label: "Golf" } }, { author: ana });
    await first.flush();
    first.close();

    const off = await openStore({ app, adapter, enabledModules: [] });
    for (const label of ["Bo", "Cy", "Di"]) off.store.apply({ name: "add-person", args: { label } }, { author: ana });
    await off.flush();
    const compaction = await off.compact({ keepOps: 1, keepDays: 0 });
    expect(compaction.archived).toBeGreaterThan(0);
    expect(off.store.log.all().some((op) => op.enabledModules !== undefined)).toBe(false);
    expect([...off.store.modules.enabled]).toEqual([]);
    expect(off.store.seenBy(ana).graph.getNode("vehicle:golf")).toBeUndefined();
    expect(() => off.store.apply({ name: "add-vehicle", args: { label: "Polo" } }, { author: ana })).toThrow(/turned off/);
    await off.flush();
    off.close();

    const reopened = await openStore({ app, adapter });
    expect([...reopened.store.modules.enabled]).toEqual([]);
    expect(reopened.store.seenBy(ana).graph.getNode("vehicle:golf")).toBeUndefined();
    reopened.close();

    const told = await openStore({ app, adapter, enabledModules: [] });
    expect([...told.store.modules.enabled]).toEqual([]);
    expect(told.store.log.all().some((op) => op.enabledModules !== undefined)).toBe(false);
    told.close();

    const on = await openStore({ app, adapter, enabledModules: ["fleet"] });
    expect([...on.store.modules.enabled]).toEqual(["fleet"]);
    expect(on.store.seenBy(ana).graph.getNode("vehicle:golf")?.label).toBe("Golf");
    on.close();
  });
});
