import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, deriveEditMutations, deriveRemoveMutations, nounOf, Store, bindSchema } from "../../src/index.js";

/**
 * WHAT ONE OF THEM IS CALLED.
 *
 * A dealership's people are its staff: the kind is `staff` and its plural is
 * "Staff", and one of them is a staff member. Every sentence about one was
 * the id spoken — "Change the staff", "Remove the staff", "a staff called
 * …" — because the id was the only singular a declaration could give.
 */
const staff = defineNode("staff", {
  fields: z.object({ label: z.string(), position: z.enum(["sales", "service"]) }),
  plural: "Staff",
  noun: "staff member",
});
const workOrder = defineNode("work-order", { fields: z.object({ label: z.string() }), plural: "Work orders" });
const schema = createSchema([staff, workOrder]);
const { defineMutation } = bindSchema(schema);
const hire = defineMutation("hire", {
  title: "Hire somebody",
  creates: ["staff"],
  input: z.object({ label: z.string(), position: z.enum(["sales", "service"]) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "staff"), kind: "staff", label: args.label, position: args.position }),
});

describe("a kind's noun", () => {
  it("is the declared one, else the id spoken", () => {
    expect(nounOf(schema.tryDefinition("staff"), "staff")).toBe("staff member");
    expect(nounOf(schema.tryDefinition("work-order"), "work-order")).toBe("work order");
  });

  it("names the derived edit and remove, never the id", () => {
    const store = new Store({ schema, mutations: [hire], invariants: [] });
    const titles = [...deriveEditMutations(schema, [hire]), ...deriveRemoveMutations(schema, [hire])]
      .filter((act) => act.subject?.kinds.includes("staff"))
      .map((act) => act.title);
    expect(titles).toContain("Remove the staff member");
    expect(store.allMutations().map((act) => act.title)).not.toContain("Remove the staff");
  });
});
