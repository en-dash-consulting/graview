import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, Store, type Epoch, type Principal } from "../../src/index.js";

/**
 * A MODULE OFF STAYS OFF PAST A COMPACTION (FR-12, FR-23). The enabled set
 * was read only from the op that last said it, in the log's tail: once a
 * compaction archived that op, the store fell back to its starting set —
 * every module, in a store a host opened — and served every seat the kinds
 * of a module the workspace had turned off, and took its acts. Now the
 * checkpoint keeps the set that stood at its seq, and the store reads it
 * there when no op in the tail says another.
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
const seed = { nodes: [{ id: "person:ana", kind: "person", label: "Ana" }], edges: [] };
const ana: Principal = { kind: "human", id: "person:ana" };

function offThenCompacted(): Store<typeof schema> {
  const store = new Store({ schema, mutations: [addVehicle, addPerson], modules, snapshot: seed as never });
  store.apply({ name: "add-vehicle", args: { label: "Golf" } }, { author: ana });
  store.setEnabledModules([]);
  store.apply({ name: "add-person", args: { label: "Bo" } }, { author: ana });
  store.apply({ name: "add-person", args: { label: "Cy" } }, { author: ana });
  const checkpoint = store.checkpoint({ keepOps: 1, keepDays: 0 })!;
  expect(checkpoint.seq).toBeGreaterThan(1);
  store.compact(checkpoint);
  expect(store.log.all().some((op) => op.enabledModules !== undefined)).toBe(false);
  return store;
}

const refusal = (store: Store<typeof schema>): string | undefined => {
  try {
    store.apply({ name: "add-vehicle", args: { label: "Polo" } }, { author: ana });
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
};

describe("a module off stays off past a compaction", () => {
  it("keeps the module off in the live store once the op that turned it off is archived", () => {
    const store = offThenCompacted();
    expect([...store.modules.enabled]).toEqual([]);
    expect(store.seenBy(ana).graph.getNode("vehicle:golf")).toBeUndefined();
    expect(refusal(store)).toMatch(/turned off/);
  });

  it("keeps the set in the checkpoint, so a store opened on the checkpoint and its tail keeps it too", () => {
    const store = offThenCompacted();
    const checkpoint = store.log.epochs()[0]!;
    expect(checkpoint.enabledModules).toEqual([]);
    const opened = new Store({ schema, mutations: [addVehicle, addPerson], modules, log: store.log.all(), epochs: store.log.epochs() });
    expect([...opened.modules.enabled]).toEqual([]);
    expect(opened.seenBy(ana).graph.getNode("vehicle:golf")).toBeUndefined();
    expect(refusal(opened)).toMatch(/turned off/);
  });

  it("carries the set through a second compaction that archives nothing that says it", () => {
    const store = offThenCompacted();
    store.apply({ name: "add-person", args: { label: "Di" } }, { author: ana });
    store.apply({ name: "add-person", args: { label: "Ed" } }, { author: ana });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(store.log.epochs()[0]!.enabledModules).toEqual([]);
    expect([...store.modules.enabled]).toEqual([]);
  });

  it("lets an op in the tail that turns the module on again stand over the checkpoint", () => {
    const store = offThenCompacted();
    store.setEnabledModules(["fleet"]);
    expect([...store.modules.enabled]).toEqual(["fleet"]);
    expect(store.seenBy(ana).graph.getNode("vehicle:golf")?.label).toBe("Golf");
  });

  it("opens a checkpoint written before it kept the set, as the store's starting set says", () => {
    const store = offThenCompacted();
    const { enabledModules: _set, ...older } = store.log.epochs()[0]! as Epoch & { enabledModules?: unknown };
    const opened = new Store({ schema, mutations: [addVehicle, addPerson], modules, log: store.log.all(), epochs: [older] });
    expect([...opened.modules.enabled]).toEqual(["fleet"]);
    const told = new Store({ schema, mutations: [addVehicle, addPerson], modules, enabledModules: [], log: store.log.all(), epochs: [older] });
    expect([...told.modules.enabled]).toEqual([]);
  });

  it("writes no set in a checkpoint of a store whose log never said one", () => {
    const store = new Store({ schema, mutations: [addVehicle, addPerson], modules, snapshot: seed as never });
    store.apply({ name: "add-person", args: { label: "Bo" } }, { author: ana });
    store.apply({ name: "add-person", args: { label: "Cy" } }, { author: ana });
    expect(store.checkpoint({ keepOps: 1, keepDays: 0 })!.enabledModules).toBeUndefined();
  });
});
