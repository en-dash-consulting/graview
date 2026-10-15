import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, fieldWords, Store, z } from "../../src/index.js";

/**
 * A RECORD'S NAME IS CALLED ITS NAME (W-184). A kind's `label` field is what
 * every card, row and heading says it is called, and a form already asked
 * for it as "Name"; the log of a shelf renamed in place read "Change
 * Woodworking: label → “Woodshop”", the key, in the one line that says
 * what happened. The watch could not tell: "label" is a word.
 */
const shelf = defineNode("category", { fields: z.object({ label: z.string().min(1), about: z.string().optional() }), plural: "Categories" });
const schema = createSchema([shelf]);
const { defineMutation } = bindSchema(schema);
const open = defineMutation("add-category", {
  creates: ["category"],
  input: z.object({ label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "category"), kind: "category", label: args.label }),
});

describe("a kind's label field", () => {
  it("is said as its name wherever a field is said", () => {
    expect(fieldWords(shelf, "label")).toBe("Name");
  });

  it("is said as its name in the log of its derived edit", () => {
    const store = new Store({ schema, mutations: [open] });
    store.apply({ name: "add-category", args: { label: "Woodworking" } });
    const id = store.graph.nodesOfKind("category")[0]!.id;
    store.apply({ name: "edit-category", args: { id, label: "Woodshop" } });
    expect(store.log.all().at(-1)?.intent).toBe("Changed the name of Woodworking to “Woodshop”");
  });
});
