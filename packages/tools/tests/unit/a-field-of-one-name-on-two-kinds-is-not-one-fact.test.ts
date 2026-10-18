import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/index.js";

/**
 * A FIELD OF ONE NAME ON TWO KINDS IS NOT ONE FACT (the eleventh walk).
 *
 * A shelter's rule "Room in the kennel" names the kennel and the animals in
 * it, and its repair selects them all. The structure provider read the
 * three as one set agreeing on "status": two animals "in-care", one kennel
 * "open" — so it said "2 share the status in-care; "Run E05" does not",
 * the stored value raw, and offered "Align the status of "Run E05" with the
 * other 2": the kennel's edit told `status: "in-care"`, which a kennel's
 * status cannot be, refused on press. Agreement is read among records of
 * one kind, and an act offered with every argument filled is one its input
 * accepts.
 */
const animal = defineNode("animal", {
  fields: z.object({ label: z.string(), status: z.enum(["in-care", "adopted"]) }),
  display: { format: { status: (value) => (value === "in-care" ? "In our care" : "Adopted") } },
  edges: { "kept-in": { to: ["kennel"] } },
});
const kennel = defineNode("kennel", { fields: z.object({ label: z.string(), status: z.enum(["open", "closed"]) }) });
const schema = createSchema([animal, kennel]);
const { defineMutation } = bindSchema(schema);
const editKennel = defineMutation("edit-kennel", {
  title: "Change the kennel",
  subject: { kinds: ["kennel"], arg: "id" },
  input: z.object({ id: nodeRef(["kennel"]), status: z.enum(["open", "closed"]).optional() }),
  apply(ctx, args) {
    if (args.status) ctx.patchNode(args.id, { status: args.status });
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [editKennel],
    snapshot: {
      nodes: [
        { id: "run", kind: "kennel", label: "Run E05", status: "open" },
        { id: "daisy", kind: "animal", label: "Daisy", status: "in-care" },
        { id: "otis", kind: "animal", label: "Otis", status: "in-care" },
      ] as never,
      edges: [
        { kind: "kept-in", from: "daisy", to: "run" },
        { kind: "kept-in", from: "otis", to: "run" },
      ] as never,
    },
  });

describe("agreement across a selection of two kinds", () => {
  it("offers no act that sets one kind's field to another kind's value", () => {
    const { affordances } = deriveAffordances(store(), ["run", "daisy", "otis"]);
    expect(affordances.filter((affordance) => affordance.label.startsWith("Align"))).toEqual([]);
    for (const affordance of affordances) {
      if (affordance.open.length > 0 || affordance.batch) continue;
      const mutation = store().allMutations().find((one) => one.name === affordance.mutation)!;
      expect(mutation.input.safeParse(affordance.args).success, affordance.label).toBe(true);
    }
  });

  it("says no stored value of one kind as another kind's fact", () => {
    const { observations } = deriveAffordances(store(), ["run", "daisy", "otis"]);
    expect(observations.map((observation) => observation.text).join(" · ")).not.toContain("in-care");
  });
});
