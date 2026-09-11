import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances, defaultProviders } from "../../src/index.js";

/**
 * AN ACT WITH NOTHING LEFT TO ASK MUST HAVE SOMETHING LEFT TO DO.
 *
 * "Close it" stayed on the strip of something already closed. One press, no
 * question, nothing changed — and the activity rail gained a second line
 * saying "Close First thing", with an undo beside it that undid nothing. The
 * same shape reached the op log from anywhere: an agent calling the act
 * twice, a page's form, a self-referential edge whose act guards itself with
 * a silent `return`.
 *
 * Two halves of one rule, and both are needed. The interface does not offer
 * an act that would change nothing; the store does not record one if it is
 * called anyway.
 */
const item = defineNode("item", {
  description: "A thing.",
  fields: z.object({ label: z.string(), status: z.enum(["open", "closed"]) }),
  plural: "Items",
  label: (node) => node.label,
  edges: { "depends-on": { to: ["item"], description: "what comes first", inverse: "what waits" } },
});
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);

const add = defineMutation("add-item", {
  title: "Add an item",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label, status: "open" });
  },
});
const close = defineMutation("close-item", {
  title: "Close it",
  subject: { kinds: ["item"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["item"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "closed" });
  },
});
const link = defineMutation("link-item", {
  title: "Depends on",
  subject: { kinds: ["item"], arg: "id" },
  connects: ["depends-on"],
  input: z.object({ id: nodeRef(["item"]), dependsOn: nodeRef(["item"]) }),
  apply(ctx, args) {
    // The guard every scaffolded app carries.
    if (args.id === args.dependsOn) return;
    ctx.addEdge({ kind: "depends-on", from: args.id, to: args.dependsOn });
  },
});

const stocked = () => {
  const store = new Store({ schema, mutations: [add, close, link], invariants: [] });
  store.apply({ name: "add-item", args: { label: "First thing" } });
  return store;
};
const offers = (store: Store<typeof schema>, id: string) =>
  deriveAffordances(store, [id], { providers: defaultProviders() }).affordances.map((a) => a.label);

describe("the interface does not offer an act with nothing left to do", () => {
  it("offers Close it on something open and withholds it once it is closed", () => {
    const store = stocked();
    const id = store.graph.allNodes()[0]!.id;
    expect(offers(store, id)).toContain("Close it");
    store.apply({ name: "close-item", args: { id } });
    expect(offers(store, id)).not.toContain("Close it");
  });

  it("keeps offering it to a selection where one of them is still open", () => {
    const store = stocked();
    store.apply({ name: "add-item", args: { label: "Second thing" } });
    const [first, second] = store.graph.allNodes().map((node) => node.id) as [string, string];
    store.apply({ name: "close-item", args: { id: first } });
    const both = deriveAffordances(store, [first, second], { providers: defaultProviders() });
    expect(both.affordances.map((a) => a.mutation)).toContain("close-item");
  });

  it("still offers an act that is holding a question, whatever it would do", () => {
    const store = stocked();
    const id = store.graph.allNodes()[0]!.id;
    store.apply({ name: "close-item", args: { id } });
    // The derived edit has an optional field to ask for; it is not decided
    // yet, so it is not something with nothing left to do.
    expect(offers(store, id).join(" ")).toContain("Change the item");
  });
});

describe("the store does not record an act that did nothing", () => {
  it("writes no op when the act is called on something already in that state", () => {
    const store = stocked();
    const id = store.graph.allNodes()[0]!.id;
    store.apply({ name: "close-item", args: { id } });
    const before = store.log.all().length;
    const result = store.apply({ name: "close-item", args: { id } });
    expect(result.ops).toEqual([]);
    expect(store.log.all().length).toBe(before);
  });

  it("writes no op when the act's own guard decided against it", () => {
    const store = stocked();
    const id = store.graph.allNodes()[0]!.id;
    const before = store.log.all().length;
    store.apply({ name: "link-item", args: { id, dependsOn: id } });
    expect(store.log.all().length).toBe(before);
    expect(store.log.all().map((op) => op.intent)).not.toContain(
      "First thing depends on First thing",
    );
  });

  it("still records the act that did happen in a batch beside one that did not", () => {
    const store = stocked();
    store.apply({ name: "add-item", args: { label: "Second thing" } });
    const [first, second] = store.graph.allNodes().map((node) => node.id) as [string, string];
    store.apply({ name: "close-item", args: { id: first } });
    const result = store.applyAll([
      { name: "close-item", args: { id: first } },
      { name: "close-item", args: { id: second } },
    ]);
    expect(result.ops.length).toBe(1);
    expect(store.graph.getNode(second)?.["status"]).toBe("closed");
  });

  it("wouldChange answers the same question without applying anything", () => {
    const store = stocked();
    const id = store.graph.allNodes()[0]!.id;
    expect(store.wouldChange({ name: "close-item", args: { id } })).toBe(true);
    store.apply({ name: "close-item", args: { id } });
    expect(store.wouldChange({ name: "close-item", args: { id } })).toBe(false);
    expect(store.wouldChange({ name: "link-item", args: { id, dependsOn: id } })).toBe(false);
    // Unchanged by the asking.
    expect(store.log.all().length).toBe(2);
  });
});
