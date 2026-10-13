import { describe, expect, it } from "vitest";
import { answerSeenBy, bindSchema, createSchema, defineNode, nodeRef, refusalOf, Store, z, type AnySchema, type MutationCall, type Policy, type Principal } from "../../src/index.js";

/**
 * THE STORE'S OWN BOOKKEEPING TELLS A SEAT NOTHING OF A HIDDEN RECORD (FR-55).
 *
 * An act runs under its caller's sight, but three of the store's own reads
 * still read the whole store, and each told a seat a record it may not see
 * was there: a create that asked for an id a hidden record held was refused
 * "already taken" where an absent one would be made; an id minted from a
 * label stepped past a hidden one (`room:green-2`); and an act setting a
 * single-source link took a hidden record's link to the same record, so
 * its op named that record and was served withheld. Each claim compares a
 * world with the hidden record and the same world without it, and finds
 * nothing the seat is told that differs.
 */
const room = defineNode("room", { fields: z.object({ name: z.string() }), plural: "Rooms" });
const desk = defineNode("desk", { fields: z.object({ name: z.string() }), plural: "Desks" });
const person = defineNode("person", {
  fields: z.object({ name: z.string() }),
  edges: { sits: { to: ["desk"], cardinality: "one" } },
  plural: "People",
});
const schema = createSchema([room, desk, person]);
const { defineMutation } = bindSchema(schema);

const openRoom = defineMutation("open-room", {
  title: "Open a room",
  creates: ["room"],
  input: z.object({ name: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "room"), kind: "room", name: args.name });
  },
});
const addDesk = defineMutation("add-desk", {
  title: "Add a desk",
  creates: ["desk"],
  input: z.object({ name: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "desk"), kind: "desk", name: args.name });
  },
});
/** One person sits at a desk: whoever sat there before is moved off it. */
const sitAt = defineMutation("sit-at", {
  title: "Sit at the desk",
  subject: { kinds: ["desk"], arg: "id" },
  input: z.object({ id: nodeRef(["desk"]) }),
  apply(ctx, args) {
    ctx.setSingleSource("sits", args.id, ctx.me!);
  },
});

const policy: Policy = {
  roles: ["guest", "keeper"],
  grants: [{ roles: "*", mutations: "*" }],
  sees: [
    { roles: ["guest"], kinds: ["desk"] },
    { roles: ["guest"], kinds: ["room", "person"], own: true },
    { roles: ["keeper"], kinds: ["room", "desk", "person"] },
  ],
};
const guest: Principal = { kind: "human", id: "person:gus", roles: ["guest"] };
const keeper: Principal = { kind: "human", id: "person:kim", roles: ["keeper"] };

/** The world, with or without a room and a person the guest may not see — the person at the desk the guest wants. */
function world(hidden: boolean): Store<AnySchema> {
  return new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: [openRoom, addDesk, sitAt] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "person:gus", kind: "person", name: "Gus" },
        { id: "desk:window", kind: "desk", name: "Window" },
        ...(hidden
          ? [
              { id: "room:green", kind: "room", name: "Green" },
              { id: "person:freya", kind: "person", name: "Freya Davies" },
            ]
          : []),
      ],
      edges: hidden ? [{ kind: "sits", from: "person:freya", to: "desk:window" }] : [],
    } as never,
  });
}

/** An id minted with a suffix no guess collides with, said alike. */
const MINTED = /-[a-z0-9]{6}\b/g;

/** Everything a seat is told of one call: its answer as served, or its refusal, then what it is served after — minted ids and clocks said alike. */
function told(store: Store<AnySchema>, call: MutationCall, author: Principal): string {
  let answer: unknown;
  try {
    answer = answerSeenBy(store, author, store.apply(call, { author }));
  } catch (error) {
    answer = { refused: refusalOf(error) };
  }
  const seen = store.seenBy(author);
  const after = { snapshot: seen.snapshot(), log: seen.log.all(), problems: seen.violations() };
  return JSON.stringify({ answer, after })
    .replace(/(batch|op):[a-z0-9:]+/g, "$1:minted")
    .replace(/"at":"[^"]*"/g, '"at":"now"')
    .replace(MINTED, "-minted");
}

describe("the store's own bookkeeping tells a seat nothing of a record it may not see", () => {
  it("mints the same id from a label whether or not a record the seat may not see holds it: the seat's own", () => {
    const call: MutationCall = { name: "open-room", args: { name: "Green" } };
    expect(told(world(true), call, guest)).toBe(told(world(false), call, guest));
    expect(world(true).apply(call, { author: guest }).writes).toEqual(["room:green.person-gus"]);
    // It steps past its own, which it sees; two in one gesture are two ids.
    expect(world(true).applyAll([call, call], { author: guest }).writes).toEqual(["room:green.person-gus", "room:green.person-gus-2"]);
  });

  it("mints one no guess collides with where even the seat's own would land on a hidden record, and for a seat that is nobody", () => {
    const store = world(true);
    store.apply({ name: "open-room", args: { name: "Green", id: "room:green.person-gus" } }, { author: keeper });
    expect(store.apply({ name: "open-room", args: { name: "Green" } }, { author: guest }).writes[0]).toMatch(/^room:green\.person-gus-[a-z0-9]{6}$/);
    const nobody: Principal = { kind: "human", roles: ["guest"] };
    expect(world(true).apply({ name: "open-room", args: { name: "Green" } }, { author: nobody }).writes[0]).toMatch(/^room:green-[a-z0-9]{6}$/);
  });

  it("still steps past what the seat sees, in a kind it sees every record of", () => {
    const store = world(true);
    expect(store.apply({ name: "add-desk", args: { name: "Window" } }, { author: guest }).writes).toEqual(["desk:window-2"]);
    expect(store.apply({ name: "add-desk", args: { name: "Door" } }, { author: guest }).writes).toEqual(["desk:door"]);
  });

  it("refuses a seat that may not see everything the id it asks for alike, whether a record it may not see holds it or nothing does", () => {
    for (const id of ["room:green", "room:free"]) {
      const call: MutationCall = { name: "open-room", args: { name: "Green", id } };
      expect(told(world(true), call, guest), id).toBe(told(world(false), call, guest));
      expect(JSON.parse(told(world(true), call, guest)).answer.refused, id).toMatchObject({ reason: "invalid" });
    }
  });

  it("lets a seat that sees everything ask for its id, and says when one is taken", () => {
    const store = world(true);
    expect(store.apply({ name: "open-room", args: { name: "Blue", id: "room:blue" } }, { author: keeper }).writes).toEqual(["room:blue"]);
    expect(() => store.apply({ name: "open-room", args: { name: "Green", id: "room:green" } }, { author: keeper })).toThrow(/already taken/);
    // The keeper's minted ids are what they always were.
    expect(store.apply({ name: "open-room", args: { name: "Green" } }, { author: keeper }).writes).toEqual(["room:green-2"]);
  });

  it("serves a seat the act that sets a single-source link whole, with what it may see, whether it took a hidden record's link or none", () => {
    const call: MutationCall = { name: "sit-at", args: { id: "desk:window" } };
    expect(told(world(true), call, guest)).toBe(told(world(false), call, guest));
    const store = world(true);
    store.apply(call, { author: guest });
    // The whole store moved Freya off the desk; the seat is served its own act, and nothing of her.
    expect(store.graph.allEdges()).toEqual([{ kind: "sits", from: "person:gus", to: "desk:window" }]);
    const served = store.seenBy(guest).log.all();
    expect(served.map((op) => op.withheld ?? false)).toEqual([false]);
    expect(JSON.stringify(served)).not.toContain("freya");
  });

  it("lets the seat undo it, and the undo puts back the link it may not see", () => {
    const store = world(true);
    const done = store.apply({ name: "sit-at", args: { id: "desk:window" } }, { author: guest });
    expect(store.seenBy(guest).canUndo(done.batch)).toMatchObject({ ok: true });
    store.undo(done.batch, { author: guest });
    expect(store.graph.allEdges()).toEqual([{ kind: "sits", from: "person:freya", to: "desk:window" }]);
  });
});
