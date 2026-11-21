import { describe, expect, it } from "vitest";
import { bindPerson, hostSeat, unbindPerson } from "../../src/binding.js";
import { aiContextOf } from "../../src/catalog.js";
import { bindSchema, createSchema, defineNode, nameOfAuthor, nodeRef, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";
import { namedAuthors, seatLens } from "../../src/seen.js";

/**
 * WHAT A MODEL IS TOLD OF RECENT CHANGES NAMES EACH AUTHOR AS A PERSON
 * (Roadmap f-model-context-says-authors-as-people). `aiContextOf`'s
 * `recent[].by` says an author as the seat's own log does: the person they
 * are bound to, where this seat may see that person, and "someone" for
 * anybody else — never an account.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }) } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const renameGift = defineMutation("rename-gift", {
  subject: { kinds: ["gift"], arg: "id" },
  input: z.object({ id: nodeRef(["gift"]), title: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id as string, { title: args.title });
  },
});
const policy: Policy = {
  grants: [{ roles: ["member", "guest"], mutations: ["rename-gift"] }],
  sees: [{ roles: ["member"], kinds: ["participant", "gift"] }, { roles: ["guest"], kinds: ["gift"] }],
};

const host: Principal = hostSeat({ id: "host" });
const bud: Principal = { kind: "human", id: "acct-bud", name: "acct-bud display", roles: ["member"] };
const ann: Principal = { kind: "human", id: "acct-ann", roles: ["member"] };
const cy: Principal = { kind: "human", id: "acct-cy", name: "acct-cy display", roles: ["member"] };
const gus: Principal = { kind: "human", id: "acct-gus", roles: ["guest"] };
const helper: Principal = { kind: "agent", id: "acct-agent", roles: ["member"] };

function family(): Store<AnySchema> {
  const store = new Store<AnySchema>({
    schema,
    mutations: [renameGift],
    policy,
    snapshot: {
      nodes: [
        { id: "participant:bud", kind: "participant", name: "Bud" },
        { id: "participant:ann", kind: "participant", name: "Ann" },
        { id: "gift:kite", kind: "gift", title: "A kite" },
      ],
      edges: [],
    },
  } as never);
  bindPerson(store, bud, "participant:bud", { author: host });
  bindPerson(store, ann, "participant:ann", { author: host });
  return store;
}

const recentBy = (store: Store<AnySchema>, principal: Principal) => aiContextOf(store, { on: "record", id: "gift:kite" }, { principal, recent: 20 }).recent.map((one) => one.by);

describe("who made a recent change, as a model is told it", () => {
  it("is the bound person's label, to a seat that may see that person", () => {
    const store = family();
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    for (const principal of [host, bud, ann]) expect(recentBy(store, principal)[0], principal.id).toBe("Bud");
  });

  it("is someone, to a seat that may not see the person the author is bound to", () => {
    const store = family();
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    expect(recentBy(store, gus)[0]).toBe("someone");
  });

  it("is someone for an author bound to nobody, and says no account anywhere, whoever reads", () => {
    const store = family();
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A blue kite" } }, { author: cy });
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A green kite" } }, { author: helper });
    for (const principal of [host, bud, ann, cy, gus]) {
      const by = recentBy(store, principal);
      expect(by.slice(0, 2), principal.id).toEqual(["an agent", "someone"]);
      expect(JSON.stringify(aiContextOf(store, { on: "record", id: "gift:kite" }, { principal, recent: 20 })), principal.id).not.toMatch(/acct-/);
    }
  });

  it("is what the seat's own log says of the author, where that is a person it may see", () => {
    const store = family();
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A blue kite" } }, { author: ann });
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A green kite" } }, { author: { ...helper, name: "Claude", onBehalfOf: ann } as Principal });
    // A binding ended, not taken back: what Bud did is still said as Bud.
    unbindPerson(store, bud, { author: host });
    const fromLog = (principal: Principal) => {
      const seen = store.seenBy(principal);
      const lens = seatLens(store as never, principal);
      return seen
        .batches()
        .slice(-4, -1)
        .reverse()
        .map((batch) => nameOfAuthor(namedAuthors(store as never, lens, batch.ops)[0]!.author, { graph: seen.graph as never, schema }));
    };
    for (const principal of [host, bud, ann]) {
      expect(recentBy(store, principal).slice(1, 4), principal.id).toEqual(fromLog(principal));
      expect(fromLog(principal), principal.id).toEqual(["Claude, for Ann", "Ann", "Bud"]);
    }
  });
});
