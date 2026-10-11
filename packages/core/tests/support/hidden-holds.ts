import { ActRefusal, bindSchema, createSchema, defineNode, nodeRef, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/*
 * A ROOM, AND A HOLD ON IT THAT A GUEST MAY NOT SEE (FR-55): acts whose
 * own logic branches on the hold, refuses in words read from it, copies a
 * count of it, or does nothing for it — the world with the hold and the
 * same world without it, for every surface a seat acts through.
 */
const room = defineNode("room", {
  fields: z.object({ name: z.string(), booked: z.boolean().optional(), note: z.string().optional() }),
  plural: "Rooms",
});
const hold = defineNode("hold", {
  fields: z.object({ name: z.string() }),
  edges: { on: { to: ["room"], cardinality: "many" } },
  plural: "Holds",
});
export const schema = createSchema([room, hold]);
const { defineMutation, defineInvariant } = bindSchema(schema);

const holdsOn = (graph: { in(id: string, kind?: string): readonly { name?: unknown }[] }, id: string) => graph.in(id, "on");

/** Branches on whether a hold exists, refuses in words read from it, and writes otherwise. */
export const book = defineMutation("book-room", {
  title: "Book the room",
  subject: { kinds: ["room"], arg: "id" },
  writes: ["booked"],
  input: z.object({ id: nodeRef(["room"]) }),
  describe: (args, graph) => `Book ${(graph.getNode(args.id) as { name?: string } | undefined)?.name ?? args.id}${holdsOn(graph as never, args.id).length > 0 ? " over a hold" : ""}`,
  apply(ctx, args) {
    const held = holdsOn(ctx.graph as never, args.id);
    if (held.length > 0) throw new ActRefusal(`${String(held[0]!.name)} holds it.`);
    ctx.patchNode(args.id, { booked: true });
  },
});
/** Refuses when nothing holds the room: the other branch. */
export const release = defineMutation("release-room", {
  title: "Release the room",
  subject: { kinds: ["room"], arg: "id" },
  writes: ["booked"],
  input: z.object({ id: nodeRef(["room"]) }),
  apply(ctx, args) {
    if (holdsOn(ctx.graph as never, args.id).length === 0) throw new ActRefusal("Nothing holds this room.");
    ctx.patchNode(args.id, { booked: false });
  },
});
/** Copies a count of what it reads into what it writes. */
export const tally = defineMutation("tally-room", {
  title: "Tally the room",
  subject: { kinds: ["room"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["room"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { note: `${holdsOn(ctx.graph as never, args.id).length} holds, ${ctx.graph.nodesOfKind("hold").length} in all` });
  },
});
/** Does nothing when a hold exists: offered or not by whether it would change anything. */
export const tidy = defineMutation("tidy-room", {
  title: "Tidy the room",
  subject: { kinds: ["room"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["room"]) }),
  apply(ctx, args) {
    if (holdsOn(ctx.graph as never, args.id).length > 0) return;
    ctx.patchNode(args.id, { note: "tidy" });
  },
});
export const close = defineMutation("close-room", {
  title: "Close the room",
  subject: { kinds: ["room"], arg: "id" },
  input: z.object({ id: nodeRef(["room"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
export const open = defineMutation("open-room", {
  title: "Open a room",
  creates: ["room"],
  input: z.object({ name: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "room"), kind: "room", name: args.name });
  },
});
export const MUTATIONS = [book, release, tally, tidy, close, open];
/** A rule over what the guest sees: a booked room says what it is for. */
export const said = defineInvariant("a-booked-room-says-what-for", {
  scope: { kind: "room" },
  evaluate: ({ subject }) =>
    subject.booked === true && subject.note === undefined
      ? [{ invariant: "a-booked-room-says-what-for", label: "A booked room says what it is for", message: `${subject.name} is booked for nothing.`, subjectId: subject.id, nodeIds: [subject.id], repairs: [{ mutation: "tally-room", args: { id: subject.id }, label: "Tally the room" }] }]
      : [],
});

export const policy: Policy = {
  roles: ["guest", "keeper"],
  grants: [{ roles: "*", mutations: "*" }],
  sees: [
    { roles: ["guest"], kinds: ["room"] },
    { roles: ["keeper"], kinds: ["room", "hold"] },
  ],
};
export const guest: Principal = { kind: "human", id: "person:gus", roles: ["guest"] };
export const keeper: Principal = { kind: "human", id: "person:kim", roles: ["keeper"] };

/** The world, with or without the hold the guest may not see. */
export function world(held: boolean): Store<AnySchema> {
  return new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: MUTATIONS as never,
    invariants: [said] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "room:blue", kind: "room", name: "Blue" },
        ...(held ? [{ id: "hold:freya", kind: "hold", name: "Freya Davies" }] : []),
      ],
      edges: held ? [{ kind: "on", from: "hold:freya", to: "room:blue" }] : [],
    } as never,
  });
}
