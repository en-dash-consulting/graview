import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, snapshotHash, Store, type Operation, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openStore, seatHeaders } from "../../src/index.js";

/**
 * TURNING A MODULE OFF OR ON IS AN OP (FR-12).
 *
 * A store's enabled set was fixed when it was built, and changing it was
 * building another store: nothing in the record said a workspace had ever
 * had its fleet turned off, or when. Now the change is an op authored
 * `system · modules` — in the log, in the history, carried to every
 * client — and since a module off is a horizon rather than a delete, the
 * records come back exactly as they were.
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
const modules = { fleet: { description: "The cars a household keeps.", kinds: ["vehicle"], mutations: ["add-vehicle"] } };
const app = defineApp({ name: "household", schema, mutations: [addVehicle], modules, version: 1 });
const seed = { nodes: [{ id: "person:ana", kind: "person", label: "Ana" }], edges: [] };
const ana: Principal = { kind: "human", id: "person:ana" };
const byModules = (ops: readonly Operation[]) => ops.filter((op) => op.author.kind === "system" && op.author.id === "modules");

describe("turning a module off and on", () => {
  it("is two ops in history, authored system · modules, and returns the data intact", () => {
    const store = new Store({ schema, mutations: [addVehicle], modules, snapshot: seed as never });
    store.apply({ name: "add-vehicle", args: { label: "Golf" } }, { author: ana });
    const before = snapshotHash(store.snapshot());

    store.setEnabledModules([]);
    expect([...store.modules.enabled]).toEqual([]);
    expect(store.seenBy(ana).graph.getNode("vehicle:golf")).toBeUndefined();
    expect(() => store.apply({ name: "add-vehicle", args: { label: "Polo" } }, { author: ana })).toThrow(/turned off/);

    store.setEnabledModules(["fleet"]);
    expect([...store.modules.enabled]).toEqual(["fleet"]);

    const toggles = byModules(store.log.all());
    expect(toggles.map((op) => op.enabledModules)).toEqual([[], ["fleet"]]);
    expect(toggles.map((op) => op.intent)).toEqual(["Turn off Vehicles", "Turn on Vehicles"]);
    expect(store.batches().map((batch) => batch.intent)).toEqual(expect.arrayContaining(["Turn off Vehicles", "Turn on Vehicles"]));
    expect(snapshotHash(store.snapshot())).toBe(before);
    expect(store.seenBy(ana).graph.getNode("vehicle:golf")?.label).toBe("Golf");
    // Saying the set it already has is no change, and no op.
    expect(store.setEnabledModules(["fleet"])).toBeUndefined();
    expect(byModules(store.log.all())).toHaveLength(2);
  });

  it("is not taken back by undo: the set changes by turning it the other way", () => {
    const store = new Store({ schema, mutations: [addVehicle], modules, snapshot: seed as never });
    const off = store.setEnabledModules([])!;
    expect(store.canUndo(off.batch).ok).toBe(false);
  });

  it("is read back from the log: a store reopened from it has the set the log last said", async () => {
    const adapter = createMemoryAdapter();
    const first = await openStore({ app, adapter, seed: seed as never });
    first.store.apply({ name: "add-vehicle", args: { label: "Golf" } }, { author: ana });
    first.store.setEnabledModules([]);
    await first.flush();
    first.close();

    const again = await openStore({ app, adapter });
    expect([...again.store.modules.enabled]).toEqual([]);
    expect(again.store.graph.getNode("vehicle:golf")?.label).toBe("Golf");
  });

  it("is recorded when the host opens the store with a different enabled set, and only then", async () => {
    const adapter = createMemoryAdapter();
    const first = await openStore({ app, adapter, seed: seed as never, enabledModules: ["fleet"] });
    expect(byModules(first.store.log.all())).toHaveLength(0);
    await first.flush();
    first.close();

    const off = await openStore({ app, adapter, enabledModules: [] });
    expect(byModules(off.store.log.all()).map((op) => op.enabledModules)).toEqual([[]]);
    await off.flush();
    off.close();

    const on = await openStore({ app, adapter, enabledModules: ["fleet"] });
    expect(byModules(on.store.log.all()).map((op) => op.enabledModules)).toEqual([[], ["fleet"]]);
    await on.flush();
    expect(byModules((await adapter.loadLog!(app.name)) as Operation[])).toHaveLength(2);
  });

  it("is said in the served state, and reaches the wire as an op", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const state = async () =>
      (await (await handler.handle(new Request("https://store.example/graview/state", { headers: seatHeaders(ana) }))).json()) as { enabledModules: string[]; log: Operation[] };
    expect((await state()).enabledModules).toEqual(["fleet"]);
    handler.store.setEnabledModules([]);
    const served = await state();
    expect(served.enabledModules).toEqual([]);
    expect(byModules(served.log).map((op) => op.intent)).toEqual(["Turn off Vehicles"]);
    await handler.close();
  });
});
