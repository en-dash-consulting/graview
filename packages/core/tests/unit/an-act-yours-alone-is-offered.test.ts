import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Policy, type Principal } from "../../src/index.js";

/**
 * AN ACT YOU MAY RUN ONLY ON YOURSELF IS STILL YOURS TO RUN. The offer is
 * asked with no subject, and a `self` grant is only satisfied by a subject
 * that is the principal — so a shopper granted "ask, on yours" was offered
 * nothing, and a guest frame showed no act for its own visitor. The offer
 * reads the principal as the subject; the store still refuses a call on
 * somebody else.
 */
const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", { fields: z.object({ label: z.string() }), plural: "Enquiries" });
const schema = createSchema([shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", {
  title: "Ask",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "enquiry"), kind: "enquiry", label: args.label });
  },
});
const policy: Policy = { grants: [{ roles: ["shopper"], mutations: ["ask"], self: true }] };
const make = () =>
  new Store({
    schema,
    mutations: [ask],
    policy,
    snapshot: {
      nodes: [
        { id: "shopper:bethan", kind: "shopper", label: "Bethan" },
        { id: "shopper:freya", kind: "shopper", label: "Freya" },
      ] as never,
      edges: [],
    },
  });
const bethan: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };

describe("an act granted only on yourself", () => {
  it("is offered to the principal it is granted to", () => {
    expect(make().permittedMutations(bethan).map((mutation) => mutation.name)).toContain("ask");
  });

  it("is offered to an agent acting for that principal", () => {
    const agent: Principal = { kind: "agent", id: "agent:helper", onBehalfOf: bethan };
    expect(make().permittedMutations(agent).map((mutation) => mutation.name)).toContain("ask");
  });

  it("is not offered to a principal with no id", () => {
    expect(make().permittedMutations({ kind: "human", roles: ["shopper"] }).map((mutation) => mutation.name)).not.toContain("ask");
  });

  it("is still refused on somebody else", () => {
    const store = make();
    expect(() => store.apply({ name: "ask", args: { shopperId: "shopper:freya", label: "Hello" } }, { author: bethan })).toThrow();
    expect(() => store.apply({ name: "ask", args: { shopperId: "shopper:bethan", label: "Hello" } }, { author: bethan })).not.toThrow();
  });
});
