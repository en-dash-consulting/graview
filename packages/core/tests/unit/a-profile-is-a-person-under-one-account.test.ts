import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, meOf, nameOfAuthor, nodeRef, permits, profilePersonId, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";
import { compileDocument } from "../../src/check.js";
import { ticksOf } from "../../src/history.js";

/**
 * ONE ACCOUNT, SEVERAL PEOPLE AT ONE SCREEN (Roadmap
 * f-viewer-state-and-me-framework). A seat may carry a profile: `$me` is then
 * that profile's person, made on first use and linked to the account by its
 * id; what the seat may do stays the account's; history says who at the
 * screen. Without one, nothing changes.
 */
const board = {
  format: "graview-document",
  formatVersion: 1,
  name: "Rocks",
  roles: ["family", "guest"],
  kinds: {
    explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
    rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who found it", inverse: "what they found" } } },
  },
  acts: {
    "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] },
    "rename-explorer": { title: "Rename me", on: "explorer", writes: ["name"] },
  },
  policy: {
    grants: [
      { roles: ["family"], mutations: ["find-rock"] },
      { roles: ["family"], mutations: ["rename-explorer"], self: true },
    ],
  },
};

function storeOf() {
  const compiled = compileDocument(board as never, { today: () => "2026-11-06" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const { app } = compiled;
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations as never,
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "user:nick", kind: "explorer", name: "Nick" },
        { id: "user:ann", kind: "explorer", name: "Ann" },
        { id: "rock:quartz", kind: "rock", title: "Quartz" },
        { id: "rock:opal", kind: "rock", title: "Opal" },
      ],
      edges: [],
    } as never,
  });
  return store;
}

const nick: Principal = { kind: "human", id: "user:nick", name: "Nick", roles: ["family"] };
const mia: Principal = { ...nick, profile: { id: "prf_mia", name: "Mia" } };
const leo: Principal = { ...nick, profile: { id: "prf_leo", name: "Leo" } };
const person = profilePersonId("user:nick", { id: "prf_mia" });
const peopleOf = (store: Store<AnySchema>, rock: string) => store.graph.out(rock, "foundBy" as never).map((one) => one.id);
const madeOf = (store: Store<AnySchema>, id: string) => store.log.all().filter((op) => op.primitives.some((one) => one.op === "add-node" && one.node.id === id));

describe("$me on a seat that carries a profile", () => {
  it("resolves to the profile's person, made once on first use and linked to the account by its id", () => {
    const store = storeOf();
    expect(store.graph.has(person)).toBe(false);
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    expect(peopleOf(store, "rock:quartz")).toEqual([person]);
    expect(store.graph.getNode(person)).toMatchObject({ kind: "explorer", name: "Mia" });
    expect(person.startsWith("user:nick")).toBe(true);
    store.apply({ name: "find-rock", args: { id: "rock:opal" } }, { author: mia });
    expect(peopleOf(store, "rock:opal")).toEqual([person]);
    expect(madeOf(store, person)).toHaveLength(1);
  });

  it("gives two profiles on one account two people", () => {
    const store = storeOf();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: leo });
    expect(peopleOf(store, "rock:quartz")).toEqual(expect.arrayContaining([person, profilePersonId("user:nick", { id: "prf_leo" })]));
  });

  it("makes no person for a gesture that is refused", () => {
    const store = storeOf();
    const guest: Principal = { kind: "human", id: "user:gil", roles: ["guest"], profile: { id: "prf_mia", name: "Mia" } };
    expect(() => store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: guest })).toThrow();
    expect(store.graph.has(profilePersonId("user:gil", { id: "prf_mia" }))).toBe(false);
    expect(store.log.all()).toHaveLength(0);
  });

  it("keeps the person when the gesture that made it is undone, and uses it again unmade", () => {
    const store = storeOf();
    const first = store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    expect(store.canUndo(first.batch).ok).toBe(true);
    store.undo(first.batch, { author: mia });
    expect(peopleOf(store, "rock:quartz")).toEqual([]);
    expect(store.graph.has(person)).toBe(true);
    expect(store.batches().find((batch) => batch.id === first.batch)?.undone).toBe(true);
    expect(store.canUndo(first.batch).ok).toBe(false);
    store.apply({ name: "find-rock", args: { id: "rock:opal" } }, { author: mia });
    expect(peopleOf(store, "rock:opal")).toEqual([person]);
    expect(madeOf(store, person)).toHaveLength(1);
  });

  it("says the gesture as the act's own, its person made in passing", () => {
    const store = storeOf();
    const made = store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    expect(made.intent).toBe("I found it: Quartz");
    const batch = store.batches().find((one) => one.id === made.batch)!;
    expect(batch.intent).toBe(made.intent);
    expect(batch.author).toEqual(mia);
    expect(batch.ops[0]!.intent).toBe("Mia joins");
  });

  it("does not reach a member's record or another account's profile, whatever a profile's id says", () => {
    const store = storeOf();
    expect(meOf({ ...nick, profile: { id: "user:ann", name: "Ann" } })).toBe("user:nick");
    const ann: Principal = { kind: "human", id: "user:ann", roles: ["family"], profile: { id: "prf_mia", name: "Mia" } };
    expect(meOf(ann)).not.toBe(meOf(mia));
    // A `~` is not a profile's: account "a" and profile "b~c" would be account "a~b" and profile "c".
    expect(meOf({ kind: "human", id: "a", profile: { id: "b~c", name: "x" } })).toBe("a");
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: { ...nick, profile: { id: "user:ann", name: "Ann" } } });
    expect(peopleOf(store, "rock:quartz")).toEqual(["user:nick"]);
  });

  it("is the person an agent acts for, its own profile counting for nothing", () => {
    expect(meOf({ kind: "agent", id: "claude", onBehalfOf: mia })).toBe(person);
    expect(meOf({ kind: "agent", id: "claude", profile: { id: "prf_x", name: "X" } })).toBe("claude");
  });

  it("is no profile on a visitor or a shared seat", () => {
    expect(meOf({ kind: "visitor", id: "form:1", profile: { id: "prf_x", name: "X" } })).toBe("form:1");
    const shared: Principal = { kind: "human", id: "anon", shared: true, profile: { id: "prf_x", name: "X" } };
    expect(meOf(shared)).toBe("anon");
  });
});

describe("what a seat may do with a profile", () => {
  const policy: Policy = {
    roles: ["family", "guest"],
    grants: [
      { roles: ["family"], mutations: ["find-rock"] },
      { roles: ["family"], mutations: ["rename-explorer"], self: true },
    ],
  };
  it("is the account's: a role's grant holds and a role it lacks stays lacked", () => {
    expect(permits(policy, mia, "find-rock").ok).toBe(true);
    expect(permits(policy, { ...mia, roles: ["guest"] }, "find-rock").ok).toBe(false);
    expect(permits(policy, { ...mia, profile: { id: "prf_admin", name: "Admin" } }, "rename-rock").ok).toBe(false);
  });

  it("holds a `self` grant on the account's record as it did, and never on another's", () => {
    expect(permits(policy, mia, "rename-explorer", undefined, undefined, "user:nick").ok).toBe(true);
    expect(permits(policy, mia, "rename-explorer", undefined, undefined, person).ok).toBe(true);
    expect(permits(policy, mia, "rename-explorer", undefined, undefined, "user:ann").ok).toBe(false);
    expect(permits(policy, mia, "rename-explorer", undefined, undefined, profilePersonId("user:ann", { id: "prf_mia" })).ok).toBe(false);
  });

  it("offers the same acts with a profile as without one", () => {
    const store = storeOf();
    const names = (seat: Principal) =>
      store
        .permittedMutations(seat)
        .map((one) => one.name)
        .sort();
    expect(names(mia)).toEqual(names(nick));
  });

  it("refuses another account's undo of an act done as a profile's own, as it refuses one done as the person", () => {
    const store = storeOf();
    const ann: Principal = { kind: "human", id: "user:ann", roles: ["family"] };
    const done = store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    expect(() => store.undo(done.batch, { author: ann })).toThrow(/somebody else/);
  });
});

describe("a sight through the people, with a profile", () => {
  const compiledWith = (sees: unknown) => {
    const compiled = compileDocument({ ...board, policy: { ...board.policy, sees } } as never, { today: () => "2026-11-06" });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    return new Store<AnySchema>({
      schema: compiled.app.schema,
      mutations: compiled.app.mutations as never,
      policy: compiled.app.policy!,
      snapshot: { nodes: [{ id: "user:nick", kind: "explorer", name: "Nick" }, { id: "rock:quartz", kind: "rock", title: "Quartz" }, { id: "rock:opal", kind: "rock", title: "Opal" }, { id: person, kind: "explorer", name: "Mia" }], edges: [{ kind: "foundBy", from: "rock:quartz", to: person }, { kind: "foundBy", from: "rock:opal", to: "user:nick" }] } as never,
    });
  };
  const sees = [{ roles: ["family"], kinds: ["rock"], via: "foundBy" }, { roles: ["family"], kinds: ["explorer"] }];

  it("shows what is linked to the profile's person and still what is linked to the account's", () => {
    const seen = compiledWith(sees).seenBy(mia).graph;
    expect(seen.has("rock:quartz")).toBe(true);
    expect(seen.has("rock:opal")).toBe(true);
  });

  it("serves each profile its own view of one store, never the other's from a cache", () => {
    const store = compiledWith(sees);
    expect(store.seenBy(mia).graph.has("rock:quartz")).toBe(true);
    expect(store.seenBy(leo).graph.has("rock:quartz")).toBe(false);
    expect(store.seenBy(nick).graph.has("rock:quartz")).toBe(false);
  });
});

describe("who history says did it", () => {
  it("says Mia (Nick), and just the account without a profile", () => {
    const store = storeOf();
    const where = { graph: store.graph as never, schema: store.schema };
    expect(nameOfAuthor(mia, where)).toBe("Mia (Nick)");
    expect(nameOfAuthor(nick, where)).toBe("Nick");
    expect(nameOfAuthor({ kind: "human", id: "user:nameless", profile: { id: "prf_mia", name: "Mia" } }, where)).toBe("Mia");
  });

  it("keeps the profile on the op, and tells another profile on the account it was not them", () => {
    const store = storeOf();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    const op = store.log.all().at(-1)!;
    expect(op.author.profile).toEqual({ id: "prf_mia", name: "Mia" });
    expect(ticksOf(store, { me: mia }).at(-1)?.maker).toBe("you");
    expect(ticksOf(store, { me: leo }).at(-1)?.maker).toBe("person");
    expect(ticksOf(store, { me: nick }).at(-1)?.maker).toBe("person");
  });
});

describe("a seat without a profile", () => {
  it("is exactly what it was: $me the account, no record made, the op's author unchanged", () => {
    const store = storeOf();
    const before = store.snapshot().nodes.length;
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: nick });
    expect(meOf(nick)).toBe("user:nick");
    expect(peopleOf(store, "rock:quartz")).toEqual(["user:nick"]);
    expect(store.snapshot().nodes).toHaveLength(before);
    expect(store.log.all()).toHaveLength(1);
    expect(store.log.all()[0]!.author).toEqual(nick);
  });

  it("with no people kind declared, a profile makes no record at all", () => {
    const task = defineNode("task", { fields: z.object({ title: z.string() }), label: (node) => node.title });
    const schema = createSchema([task]);
    const add = bindSchema(schema).defineMutation("touch", {
      title: "Touch",
      input: z.object({ id: nodeRef(["task"]) }),
      apply(ctx, args) {
        ctx.patchNode(args.id, { title: "seen" } as never);
      },
    });
    const store = new Store({ schema, mutations: [add] as never, snapshot: { nodes: [{ id: "t", kind: "task", title: "x" }], edges: [] } as never });
    store.apply({ name: "touch", args: { id: "t" } }, { author: mia });
    expect(store.snapshot().nodes).toHaveLength(1);
    expect(store.log.all()).toHaveLength(1);
  });
});
