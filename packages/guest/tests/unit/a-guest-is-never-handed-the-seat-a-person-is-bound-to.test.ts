import { createSchema, defineNode, Store, z, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { plainNode } from "../../src/host/session.js";

/**
 * A GUEST IS NEVER HANDED THE SEAT A PERSON IS BOUND TO (Roadmap
 * f-invite-binds-existing-person): it is an account's id, the host's alone,
 * so a record a view or a frame is handed carries none, even where the host
 * hands it the record as the store holds it.
 */
describe("a guest's records", () => {
  it("carry no seat a person is bound to", () => {
    const person = defineNode("person", { people: true, fields: z.object({ name: z.string() }) } as never);
    const store = new Store<AnySchema>({ schema: createSchema([person]), snapshot: { nodes: [{ id: "person:bud", kind: "person", name: "Bud", $seat: "acct-bud" }], edges: [] } } as never);
    const handed = plainNode(store, store.graph.getNode("person:bud"));
    expect(handed).toMatchObject({ id: "person:bud", name: "Bud" });
    expect(JSON.stringify(handed)).not.toContain("acct-bud");
    expect(handed).not.toHaveProperty("$seat");
  });
});
