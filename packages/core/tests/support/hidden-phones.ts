import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/*
 * A ROSTER WHERE PARENTS SEE NAMES BUT NOT PHONE NUMBERS (Roadmap
 * f-field-sight): a player's phone and medical note are kept from parents
 * by a sight that hides them, except on their own child, whom a second
 * sight shows whole. A coach sees everything. The world with a phone number
 * and the same world without one, for every surface a seat reads through.
 */
const player = defineNode("player", {
  fields: z.object({ name: z.string(), phone: z.string().optional(), medical: z.string().optional(), team: z.string().optional() }),
  edges: { guardian: { to: ["person"], cardinality: "many" } },
  plural: "Players",
});
const person = defineNode("person", {
  fields: z.object({ name: z.string() }),
  people: true,
  plural: "People",
});
/** A kind whose label quotes a field parents may not see: they are served it under a label that does not. */
const contact = defineNode("contact", {
  fields: z.object({ name: z.string(), phone: z.string().optional() }),
  label: (node) => (node.phone ? `${node.name} (${node.phone})` : node.name),
  plural: "Contacts",
});
export const schema = createSchema([player, person, contact]);
const { defineMutation, defineInvariant } = bindSchema(schema);

export const addPlayer = defineMutation("add-player", {
  title: "Add a player",
  creates: ["player"],
  input: z.object({ name: z.string(), phone: z.string().optional(), medical: z.string().optional() }),
  describe: (args) => `Add ${args.name}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "player"), kind: "player", name: args.name, ...(args.phone !== undefined ? { phone: args.phone } : {}), ...(args.medical !== undefined ? { medical: args.medical } : {}) });
  },
});
export const setPhone = defineMutation("set-phone", {
  title: "Set the phone number",
  subject: { kinds: ["player", "contact"], arg: "id" },
  writes: ["phone"],
  input: z.object({ id: nodeRef(["player", "contact"]), phone: z.string().optional() }),
  describe: (args, graph) => `Set ${(graph.getNode(args.id) as { name?: string } | undefined)?.name ?? args.id}'s phone`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { phone: args.phone });
  },
});
export const rename = defineMutation("rename-player", {
  title: "Rename the player",
  subject: { kinds: ["player"], arg: "id" },
  writes: ["name"],
  input: z.object({ id: nodeRef(["player"]), name: z.string() }),
  describe: (args, graph) => `Rename ${(graph.getNode(args.id) as { name?: string } | undefined)?.name ?? args.id} to ${args.name}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { name: args.name });
  },
});
/** An act whose sentence quotes the phone it reads: withheld from a seat that may not read it. */
export const call = defineMutation("call-player", {
  title: "Call the player",
  subject: { kinds: ["player"], arg: "id" },
  writes: ["team"],
  input: z.object({ id: nodeRef(["player"]) }),
  describe: (args, graph) => `Call ${String((graph.getNode(args.id) as { phone?: string } | undefined)?.phone ?? "nobody")}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { team: "called" });
  },
});
export const addContact = defineMutation("add-contact", {
  title: "Add a contact",
  creates: ["contact"],
  input: z.object({ name: z.string(), phone: z.string().optional() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "contact"), kind: "contact", name: args.name, ...(args.phone !== undefined ? { phone: args.phone } : {}) });
  },
});
export const MUTATIONS = [addPlayer, setPhone, rename, call, addContact];

/** A rule that reads the phone: over what a parent sees, it reads none. */
export const reachable = defineInvariant("a-player-can-be-reached", {
  scope: { kind: "player" },
  evaluate: ({ subject }) =>
    subject.phone === undefined
      ? [{ invariant: "a-player-can-be-reached", label: "A player can be reached", message: `${subject.name} has no phone number.`, subjectId: subject.id, nodeIds: [subject.id], repairs: [] }]
      : [],
});

export const policy: Policy = {
  roles: ["coach", "parent"],
  grants: [{ roles: "*", mutations: "*" }],
  sees: [
    { roles: ["coach"], kinds: ["player", "person", "contact"] },
    { roles: ["parent"], kinds: ["player"], hide: ["phone", "medical"] },
    { roles: ["parent"], kinds: ["player"], own: true },
    { roles: ["parent"], kinds: ["person"] },
    { roles: ["parent"], kinds: ["contact"], fields: ["name"] },
  ],
};
export const coach: Principal = { kind: "human", id: "person:cora", roles: ["coach"] };
export const parent: Principal = { kind: "human", id: "person:pat", roles: ["parent"] };

/**
 * The world, with Ann's phone number and medical note or without them —
 * set when she is added and changed after, by the coach, so the log holds
 * the value in an add, a patch, a call and a sentence. Bea is Pat's own
 * child, whom Pat sees whole.
 */
export function world(phone: string | undefined, changed?: string): Store<AnySchema> {
  const store = new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: MUTATIONS as never,
    invariants: [reachable] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "person:cora", kind: "person", name: "Cora" },
        { id: "person:pat", kind: "person", name: "Pat" },
        { id: "player:bea", kind: "player", name: "Bea", phone: "444 0303" },
        { id: "contact:doc", kind: "contact", name: "Doc", ...(phone !== undefined ? { phone: `${phone} 9` } : {}) },
      ],
      edges: [{ kind: "guardian", from: "player:bea", to: "person:pat" }],
    } as never,
  });
  const by = { author: coach };
  store.apply({ name: "add-player", args: { name: "Ann", ...(phone !== undefined ? { phone, medical: "asthma" } : {}) } }, by);
  if (changed !== undefined) store.apply({ name: "set-phone", args: { id: "player:ann", phone: changed } }, by);
  store.apply({ name: "rename-player", args: { id: "player:ann", name: "Annie" } }, by);
  store.apply({ name: "call-player", args: { id: "player:ann" } }, by);
  return store;
}
