import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "../../src/index.js";

/**
 * A REFUSAL IN WORDS. Every act a salesperson may not take is struck
 * through with the policy's sentence, on both faces — and it read "Not
 * permitted: close-deal on a deal — sales-manager can.": the act by its
 * name and the role by its id, beside a button that says "Close the deal".
 */
const deal = defineNode("deal", { fields: z.object({ label: z.string(), stage: z.enum(["open", "closed"]) }), plural: "Deals" });
const schema = createSchema([deal]);
const { defineMutation } = bindSchema(schema);
const close = defineMutation("close-deal", {
  title: "Close the deal",
  subject: { kinds: ["deal"], arg: "id" },
  writes: ["stage"],
  input: z.object({ id: nodeRef(["deal"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.id, { stage: "closed" }),
});

describe("the policy's refusal", () => {
  it("names the act by its title and the role in words", () => {
    const store = new Store({
      schema,
      mutations: [close],
      policy: { roles: ["sales-manager", "salesperson"], grants: [{ roles: ["sales-manager"], mutations: ["close-deal"] }] },
      snapshot: { nodes: [{ id: "d1", kind: "deal", label: "Chloé · Highlander", stage: "open" }] as never, edges: [] },
    });
    const verdict = store.permits({ name: "close-deal", args: { id: "d1" } }, { kind: "human", id: "priya", roles: ["salesperson"] });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal.message).toBe("Not permitted: “Close the deal” on a deal — a sales manager can.");
    // What the interface reads for its data stays the ids.
    expect(verdict.refusal.wouldNeed).toEqual(["sales-manager"]);
  });
});
