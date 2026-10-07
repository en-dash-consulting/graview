import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDocument } from "../../src/check.js";
import { createSchema, defineMutation, defineNode, InvalidArguments, mutationToolSchema, nodeRef, refusalOf, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * FR-121. EVERY ACT REFUSES AN ARGUMENT IT DOES NOT TAKE.
 *
 * Since FR-110 a derived `edit-<kind>` refused an argument it did not take,
 * naming the ones it did; every other act parsed it away and ran as if it
 * had never been given — `set-quote { id, quote, colour }` set the quote and
 * said nothing of the colour, so Graview Cloud kept a stray-argument check
 * of its own in front of every call. A document's act and a TypeScript
 * mutation are strict too, without a product changing its code: an unknown
 * argument is `InvalidArguments` naming what the act takes. `id` stays
 * allowed on an act that creates — the id of the record it makes.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const vendors = read("vendors.gdd.json");

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-07" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const refused = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a refusal");
};
function vendorStore() {
  const app = compiled(vendors);
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [] });
  store.apply({ name: "add-vendor", args: { id: "vendor-bloom", name: "Bloom & Co" } });
  return { app, store };
}

describe("a document's act", () => {
  it("refuses set-quote { id, quote, colour } as invalid, naming colour and what it takes, and changes nothing", () => {
    const { store } = vendorStore();
    const error = refused(() => store.apply({ name: "set-quote", args: { id: "vendor-bloom", quote: 2400, colour: "red" } }));
    expect(error).toBeInstanceOf(InvalidArguments);
    expect(refusalOf(error).reason).toBe("invalid");
    expect(refusalOf(error).sentence).toContain('does not take "colour"; it takes "id", "quote"');
    expect(store.graph.getNode("vendor-bloom")).not.toHaveProperty("quote");
  });

  it("still takes id on an act that creates: the id of the record it makes", () => {
    const { store } = vendorStore();
    store.apply({ name: "add-category", args: { id: "category-florist", name: "Florist" } });
    expect(store.graph.getNode("category-florist")).toMatchObject({ kind: "category", name: "Florist" });
    const error = refused(() => store.apply({ name: "add-category", args: { name: "Venue", colour: "red" } }));
    expect(refusalOf(error).sentence).toMatch(/does not take "colour"; it takes .*"id"/);
  });

  it("refuses a stray in a batch's later call, and nothing in the batch lands", () => {
    const { store } = vendorStore();
    const before = store.log.length;
    refused(() =>
      store.applyAll([
        { name: "set-quote", args: { id: "vendor-bloom", quote: 2400 } },
        { name: "book", args: { id: "vendor-bloom", when: "June" } },
      ]),
    );
    expect(store.log.length).toBe(before);
    expect(store.graph.getNode("vendor-bloom")).not.toHaveProperty("quote");
  });

  it("refuses a stray in a preview as the apply would", () => {
    const { store } = vendorStore();
    expect(refusalOf(refused(() => store.preview({ name: "book", args: { id: "vendor-bloom", when: "June" } }))).reason).toBe("invalid");
  });

  it("says so in its tool: additionalProperties is false", () => {
    const { app } = vendorStore();
    for (const name of ["set-quote", "book", "add-vendor", "add-to-category"]) {
      expect(mutationToolSchema(app.mutations!.find((m) => m.name === name)!).inputSchema, name).toMatchObject({ additionalProperties: false });
    }
  });
});

describe("a TypeScript mutation, whose product writes z.object as it always has", () => {
  const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }) });
  const finish = defineMutation("finish", {
    title: "Finish",
    subject: { kinds: ["task"], arg: "taskId" },
    writes: ["done"],
    input: z.object({ taskId: nodeRef(["task"]), note: z.string().optional() }),
    apply(ctx, args) {
      ctx.patchNode(args.taskId, { done: true });
    },
  });
  const addTask = defineMutation("add-task", {
    title: "Add a task",
    creates: ["task"],
    input: z.object({ label: z.string() }),
    apply(ctx, args) {
      ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false });
    },
  });
  /** An author who said the input keeps what it is not told about: theirs to say. */
  const tag = defineMutation("tag", {
    title: "Tag",
    subject: { kinds: ["task"], arg: "taskId" },
    input: z.looseObject({ taskId: nodeRef(["task"]) }),
    apply() {},
  });
  const store = () =>
    new Store({
      schema: createSchema([task]),
      mutations: [finish, addTask, tag],
      snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }], edges: [] } as never,
    });

  it("refuses an argument it does not take, naming the ones it does", () => {
    const error = refused(() => store().apply({ name: "finish", args: { taskId: "t1", colour: "red" } }));
    expect(error).toBeInstanceOf(InvalidArguments);
    expect(refusalOf(error)).toMatchObject({ reason: "invalid" });
    expect((error as Error).message).toContain('does not take "colour"; it takes "taskId", "note"');
  });

  it("refuses id on an act that does not create and does not take one", () => {
    expect((refused(() => store().apply({ name: "finish", args: { taskId: "t1", id: "t1" } })) as Error).message).toContain('does not take "id"');
  });

  it("takes id on an act that creates, and names it among what it takes", () => {
    const one = store();
    one.apply({ name: "add-task", args: { id: "task-hall", label: "Hall" } });
    expect(one.graph.getNode("task-hall")).toMatchObject({ label: "Hall" });
    expect((refused(() => one.apply({ name: "add-task", args: { label: "Deposit", due: "June" } })) as Error).message).toContain('does not take "due"; it takes "label", "id"');
  });

  it("takes an argument given as undefined as no argument at all", () => {
    const one = store();
    one.apply({ name: "finish", args: { taskId: "t1", colour: undefined } });
    expect(one.graph.getNode("t1")).toMatchObject({ done: true });
  });

  it("leaves an input its author made loose as loose, in the apply and in its tool", () => {
    store().apply({ name: "tag", args: { taskId: "t1", colour: "red" } });
    expect(mutationToolSchema(tag).inputSchema).not.toHaveProperty("additionalProperties", false);
  });

  it("says so in its tool: additionalProperties is false", () => {
    expect(mutationToolSchema(finish).inputSchema).toMatchObject({ additionalProperties: false });
    expect(mutationToolSchema(addTask).inputSchema).toMatchObject({ additionalProperties: false, properties: { id: { type: "string" } } });
  });
});
