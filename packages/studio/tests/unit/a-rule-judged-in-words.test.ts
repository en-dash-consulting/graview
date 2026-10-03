import { createSchema, defineApp, defineMutation, defineNode, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";
import { DECLARED_KIND } from "../../src/meta.js";

/**
 * FR-07. A rule the studio declares used to judge nothing — "the checkout
 * gives it a judgement" — so an agent in the studio could name a rule and
 * never make it hold. Its judgement is now a field in the rule language: the
 * studio's declaration judges it after apply, and the files it writes carry
 * the same words.
 */
const vendor = defineNode("vendor", {
  fields: z.object({ label: z.string().min(1), status: z.enum(["researching", "booked"]), quote: z.number().optional() }),
  plural: "vendors",
});
const schema = createSchema([vendor]);
const add = defineMutation("add-vendor", {
  title: "Add a vendor",
  creates: ["vendor"],
  input: z.object({ label: z.string().min(1), status: z.enum(["researching", "booked"]) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "v"), kind: "vendor", label: args.label, status: args.status });
  },
});
const app = defineApp({ name: "Vendors", schema, mutations: [add], invariants: [] });

describe("a rule judged in words", () => {
  it("is added in the studio, applies, and judges the very next change", () => {
    const studio = createStudio(app);
    studio.store.apply({
      name: "add-rule",
      args: { kind: DECLARED_KIND + "vendor", label: "Booked needs a quote", description: "A booked vendor has said what it costs.", require: "quote != null", when: "status == 'booked'", says: "{label} is booked but has no quote" },
    });
    const applied = studio.apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
    const store = new Store({ schema: applied.app.schema, mutations: applied.app.mutations ?? [], invariants: applied.app.invariants ?? [] });
    store.apply({ name: "add-vendor", args: { label: "Bloom & Co", status: "researching" } });
    expect(store.violations()).toEqual([]);
    store.apply({ name: "add-vendor", args: { label: "Petal", status: "booked" } });
    const [broken] = store.violations();
    expect(broken?.invariant).toBe("booked-needs-a-quote");
    expect(broken?.status).toBe("violated");
    expect(broken?.message).toBe("Petal is booked but has no quote");
  });

  it("is written into the checkout as the same words, not a stub", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-rule", args: { kind: DECLARED_KIND + "vendor", label: "Booked needs a quote", description: "A booked vendor has said what it costs.", require: "quote != null" } });
    const invariants = studio.files().find((file) => file.path.endsWith("invariants.ts"))!;
    expect(invariants.contents).toContain(`import { expressionRule } from "@graview/core/document";`);
    expect(invariants.contents).toContain(`expressionRule("booked-needs-a-quote", {`);
    expect(invariants.contents).toContain(`require: "quote != null",`);
    expect(invariants.kept).toEqual([]);
  });

  it("comes back into the studio from a declaration that judged it in words", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-rule", args: { kind: DECLARED_KIND + "vendor", label: "Booked needs a quote", description: "A booked vendor has said what it costs.", require: "quote != null" } });
    const applied = studio.apply();
    if (!applied.ok) throw new Error("did not apply");
    const again = createStudio(applied.app as never);
    const rule = again.store.graph.nodesOfKind("rule")[0] as { require?: string } | undefined;
    expect(rule?.require).toBe("quote != null");
  });
});
