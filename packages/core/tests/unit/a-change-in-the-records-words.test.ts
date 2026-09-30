import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, Store, z } from "../../src/index.js";

/**
 * A CHANGE IS LOGGED IN THE RECORD'S WORDS. The derived edit's history read
 * "Change 2026 Tesla Model Y Performance: price → 49900" beside a card
 * that says "Price $49,900": the declaration's labels and formats are the
 * words a person reads everywhere else.
 */
const car = defineNode("car", {
  fields: z.object({ label: z.string(), price: z.number(), condition: z.enum(["new", "cpo"]), vin: z.string() }),
  plural: "Cars",
  display: {
    labels: { vin: "VIN" },
    format: { price: (value) => `$${Number(value).toLocaleString("en-US")}`, condition: (value) => (value === "cpo" ? "Certified pre-owned" : "New") },
  },
});
const schema = createSchema([car]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-car", {
  title: "Add a car",
  creates: ["car"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: "c1", kind: "car", label: args.label, price: 1, condition: "new", vin: "X" }),
});

describe("the derived edit's history", () => {
  it("says each change with the field's label and format", () => {
    const store = new Store({ schema, mutations: [add] });
    store.apply({ name: "add-car", args: { label: "Model Y" } });
    store.apply({ name: "edit-car", args: { id: "c1", price: 49900, condition: "cpo", vin: "8C9D" } });
    const intent = store.log.all().at(-1)!.intent;
    expect(intent).toContain("price → $49,900");
    expect(intent).toContain("condition → Certified pre-owned");
    expect(intent).toContain('VIN → "8C9D"');
  });
});
