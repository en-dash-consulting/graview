import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, Store } from "../../src/index.js";

/**
 * A CHANGE CHANGES ONLY WHAT IT NAMES. The derived edit asked for each field
 * as `optional()` over the field's own schema, and under zod 4 a field with
 * a `default()` fills that default when the edit leaves it out: renaming a
 * person set their role back to "member". Found while building FR-28.
 */
const person = defineNode("person", {
  fields: z.object({ label: z.string().min(1), role: z.enum(["member", "admin"]).default("member"), joined: z.string().default("2026-01-01") }),
  plural: "People",
});
const schema = createSchema([person]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-person", {
  title: "Add a person",
  creates: ["person"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: "p1", kind: "person", label: args.label, role: "admin", joined: "2025-06-01" } as never);
  },
});

describe("an edit leaves what it was not given", () => {
  it("renaming a person keeps their role and the day they joined", () => {
    const store = new Store({ schema, mutations: [add] });
    store.apply({ name: "add-person", args: { label: "Kai" } });
    store.apply({ name: "edit-person", args: { id: "p1", label: "Kai Ito" } });
    expect(store.graph.getNode("p1")).toMatchObject({ label: "Kai Ito", role: "admin", joined: "2025-06-01" });
  });
});
