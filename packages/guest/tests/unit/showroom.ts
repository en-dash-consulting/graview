import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type Policy, type Principal } from "@graview/core";
import type { HostMessage } from "../../src/protocol.js";

/**
 * A showroom with sights: anyone sees the cars, staff see everybody, a
 * shopper sees themselves and what is theirs. Freya's enquiry is the thing a
 * guest view drawn for Bethan must never be handed.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const shopper = defineNode("shopper", { fields: z.object({ label: z.string(), email: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", {
  fields: z.object({ label: z.string() }),
  plural: "Enquiries",
  edges: {
    from: { to: ["shopper"], cardinality: "one", description: "who asked", inverse: "their enquiries" },
    about: { to: ["car"], description: "the car", inverse: "the enquiries about it" },
  },
});
export const schema = createSchema([car, shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
export const ask = defineMutation("ask", {
  title: "Ask",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  describe: (args) => `Ask “${args.label}”`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "enquiry");
    ctx.addNode({ id, kind: "enquiry", label: args.label });
    ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
  },
});
export const retire = defineMutation("retire-car", {
  title: "Retire a car",
  subject: { kinds: ["car"], arg: "carId" },
  input: z.object({ carId: nodeRef(["car"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.carId);
  },
});
const policy: Policy = {
  grants: [{ roles: ["shopper"], mutations: ["ask"], self: true }, { roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["car"] },
    { roles: ["staff"], kinds: ["shopper", "enquiry"] },
    { roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true },
  ],
};
export const showroom = () =>
  new Store({
    schema,
    mutations: [ask, retire],
    policy,
    snapshot: {
      nodes: [
        { id: "car:golf", kind: "car", label: "Golf" },
        { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo", email: "bethan@mail.example" },
        { id: "shopper:freya", kind: "shopper", label: "Freya Davies", email: "freya@mail.example" },
        { id: "enquiry:1", kind: "enquiry", label: "Finance on the Golf" },
      ] as never,
      edges: [
        { kind: "from", from: "enquiry:1", to: "shopper:freya" },
        { kind: "about", from: "enquiry:1", to: "car:golf" },
      ],
    },
  });
/** Bethan, carrying a session token the host holds for her: a guest must never be handed it. */
export const bethan = { kind: "human", id: "shopper:bethan", roles: ["shopper"], token: "sk-session-7f3a" } as Principal;
export const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };

/** Every record id, label and email a shopper other than Bethan owns: none may reach her guest. */
export const UNSEEN = ["shopper:freya", "Freya Davies", "freya@mail.example", "enquiry:1", "Finance on the Golf"];

/** Collects what the host sends, as the guest would receive it (structured-cloned). */
export function inbox() {
  const said: HostMessage[] = [];
  return { said, send: (message: HostMessage) => said.push(structuredClone(message)) };
}

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
