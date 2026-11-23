import { describe, expect, it } from "vitest";
import { bindPerson, hostSeat, mergePerson, rebindPerson, unbindPerson } from "../../src/binding.js";
import { compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineNode, nodeRef, PERSON_SEAT, Store, z, type AnySchema, type GraphEdge, type Policy, type Principal } from "../../src/index.js";

/**
 * A MOVE OR A MERGE OF A PERSON CARRIES EVERY LINK MADE AS THEM (Roadmap
 * f-person-move-carries-links-past-horizon). The links an act made at the
 * person's end through `$me` go with the person even where the op that made
 * them is behind the log's horizon: the host hands the move what its
 * compaction archived, and a link found there is carried, so it is not
 * among what the move left behind. A profile's own person, under an id of
 * its own, merges into the person entered for it. Two links of one relation
 * between the same two records keep their own ids, and a link from the
 * person's record to itself moves at both ends.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }), edges: { minds: { to: ["participant"] } } } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["participant"] } } } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const giveIt = defineMutation("give-it", { title: "I'll give it", doneAsMe: true, subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: ctx.me }) } as never);
const giveTo = defineMutation("give-to", { title: "Given by", subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]), by: nodeRef(["participant"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: args.by }) } as never);
/** I mind them, and they mind me: two links of one relation between the same two records, each with an id of its own. */
const mindEachOther = defineMutation("mind-each-other", { title: "We mind each other", doneAsMe: true, subject: { kinds: ["participant"], arg: "id" }, input: z.object({ id: nodeRef(["participant"]) }), apply: (ctx: any, args: any) => { ctx.addEdge({ kind: "minds", from: ctx.me, to: args.id, id: "link-mine" }); ctx.addEdge({ kind: "minds", from: args.id, to: ctx.me, id: "link-theirs" }); } } as never);
/** I mind myself: a link from the person's record to itself. */
const mindMyself = defineMutation("mind-myself", { title: "I mind myself", doneAsMe: true, input: z.object({}), apply: (ctx: any) => ctx.addEdge({ kind: "minds", from: ctx.me, to: ctx.me }) } as never);

const policy: Policy = {
  grants: [
    { roles: ["owner"], mutations: "*" },
    { roles: ["member"], mutations: ["give-it", "mind-each-other", "mind-myself"] },
  ],
  sees: [{ roles: ["owner", "member"], kinds: ["participant", "gift"] }],
};

const host = hostSeat({ id: "host" });
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const organizer: Principal = { kind: "human", id: "acct-org", roles: ["owner"] };

const nodes = [
  { id: "participant:bud", kind: "participant", name: "Bud" },
  { id: "participant:ann", kind: "participant", name: "Ann" },
  { id: "participant:cy", kind: "participant", name: "Cy" },
  { id: "gift:kite", kind: "gift", title: "A kite" },
  { id: "gift:book", kind: "gift", title: "A book" },
];

const storeOf = (extra: readonly object[] = []) =>
  new Store<AnySchema>({ schema, mutations: [giveIt, giveTo, mindEachOther, mindMyself] as never, policy, snapshot: { nodes: [...nodes, ...extra], edges: [] } } as never);

const givers = (store: Store<AnySchema>, id: string) => store.graph.out(id, "givenBy" as never).map((one) => one.id);
const linksOf = (store: Store<AnySchema>, kind: string) =>
  (store.graph as unknown as { edgesOfKind(kind: string): readonly GraphEdge[] })
    .edgesOfKind(kind)
    .map((edge) => ({ from: edge.from, to: edge.to, ...(edge.id !== undefined ? { id: edge.id } : {}) }))
    .sort((a, b) => (`${a.from} ${a.to}` < `${b.from} ${b.to}` ? -1 : 1));
/** Everything up to now behind the log's horizon, as a host's compaction leaves it: what it returns is what the host archived. */
const compactAll = (store: Store<AnySchema>) => store.compact(store.checkpoint({ seq: store.log.length })!);
const none = { count: 0, relations: {} };

describe("a move carries the links made as the person before the log's horizon", () => {
  /** Bud bound to Ann, a kite he gave as himself, a book the organizer said Ann gives; then all of it compacted. */
  const compacted = () => {
    const store = storeOf();
    bindPerson(store, bud, "participant:ann", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    store.apply({ name: "give-to", args: { id: "gift:book", by: "participant:ann" } }, { author: organizer });
    const archived = compactAll(store);
    expect(store.log.all()).toHaveLength(0);
    return { store, archived };
  };

  it("carries a link whose making op the host archived, and leaves none of them behind", () => {
    const { store, archived } = compacted();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host, archived });
    expect(givers(store, "gift:kite")).toEqual(["participant:bud"]);
    expect(givers(store, "gift:book")).toEqual(["participant:ann"]);
    expect(moved.leftBehind).toEqual(none);
  });

  it("takes the archived ops alone as well as the archive whole", () => {
    const { store, archived } = compacted();
    rebindPerson(store, bud, "participant:bud", { author: host, archived: archived.ops });
    expect(givers(store, "gift:kite")).toEqual(["participant:bud"]);
  });

  it("is one change, which undo takes back whole", () => {
    const { store, archived } = compacted();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host, archived });
    store.undo(moved.batch, { author: host });
    expect(givers(store, "gift:kite")).toEqual(["participant:ann"]);
    expect(store.personOf(bud)).toBe("participant:ann");
  });

  it("without the archive, carries none of them and says both were left behind", () => {
    const { store } = compacted();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(givers(store, "gift:kite")).toEqual(["participant:ann"]);
    expect(moved.leftBehind).toMatchObject({ count: 2, relations: { givenBy: 2 } });
  });

  it("carries a link of the person's own record through a merge behind the horizon, and on when they move", () => {
    const store = storeOf([{ id: "acct-bud", kind: "participant", name: "bud" }]);
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    expect(givers(store, "gift:kite")).toEqual(["acct-bud"]);
    const first = compactAll(store);
    expect(mergePerson(store, bud, "participant:ann", { author: host, archived: first }).leftBehind).toEqual(none);
    expect(givers(store, "gift:kite")).toEqual(["participant:ann"]);
    const second = compactAll(store);
    const moved = rebindPerson(store, bud, "participant:bud", { author: host, archived: [...first.ops, ...second.ops] });
    expect(givers(store, "gift:kite")).toEqual(["participant:bud"]);
    expect(moved.leftBehind).toEqual(none);
  });
});

describe("a profile's own person merges into the person entered for it", () => {
  const board = {
    format: "graview-document",
    formatVersion: 1,
    name: "Rocks",
    roles: ["family", "keeper"],
    kinds: {
      explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
      rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who found it", inverse: "what they found" } } },
    },
    acts: { "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] }, "remove-explorer": { title: "Remove", on: "explorer", removes: true } },
    policy: { grants: [{ roles: ["family"], mutations: ["find-rock"] }, { roles: ["keeper"], mutations: ["remove-explorer"] }], sees: [{ roles: ["family", "keeper"], kinds: ["rock", "explorer"] }] },
  };
  const rocks = () => {
    const compiled = compileDocument(board as never, { today: () => "2026-11-22" });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    return new Store<AnySchema>({
      schema: compiled.app.schema,
      mutations: compiled.app.mutations as never,
      ...(compiled.app.policy ? { policy: compiled.app.policy } : {}),
      snapshot: {
        nodes: [
          { id: "explorer:mia", kind: "explorer", name: "Mia" },
          { id: "explorer:other", kind: "explorer", name: "Other" },
          { id: "explorer:x", kind: "explorer", name: "X" },
          { id: "rock:quartz", kind: "rock", title: "Quartz" },
          { id: "rock:opal", kind: "rock", title: "Opal" },
        ],
        edges: [],
      },
    } as never);
  };
  const mia: Principal = { kind: "human", id: "acct-house", name: "Household", roles: ["family"], profile: { id: "prf_mia", name: "Mia" } };
  const foundBy = (store: Store<AnySchema>, rock: string) => store.graph.out(rock, "foundBy" as never).map((one) => one.id);

  it("moves the seat, what it did and its links to the person, and sets its own aside", () => {
    const store = rocks();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    const own = store.personOf(mia)!;
    expect(own).not.toBe("explorer:mia");
    expect(store.graph.has("acct-house~prf_mia")).toBe(false);
    const merged = mergePerson(store, mia, "explorer:mia", { author: host });
    expect(merged.leftBehind).toEqual(none);
    expect(store.personOf(mia)).toBe("explorer:mia");
    expect(store.graph.getNode("explorer:mia")).toMatchObject({ [PERSON_SEAT]: "acct-house~prf_mia" });
    expect(foundBy(store, "rock:quartz")).toEqual(["explorer:mia"]);
    expect(store.graph.getNode(own)).toMatchObject({ $archived: true });
    store.apply({ name: "find-rock", args: { id: "rock:opal" } }, { author: mia });
    expect(foundBy(store, "rock:opal")).toEqual(["explorer:mia"]);
  });

  it("is taken back whole, until the person has acted as the record merged into", () => {
    const store = rocks();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    const own = store.personOf(mia)!;
    const merged = mergePerson(store, mia, "explorer:mia", { author: host });
    store.undo(merged.batch, { author: host });
    expect(store.personOf(mia)).toBe(own);
    expect(foundBy(store, "rock:quartz")).toEqual([own]);
    expect(store.graph.getNode("explorer:mia")?.[PERSON_SEAT as never]).toBeUndefined();
    const again = mergePerson(store, mia, "explorer:mia", { author: host });
    store.apply({ name: "find-rock", args: { id: "rock:opal" } }, { author: mia });
    expect(store.mayUndo(again.batch, host)).toMatchObject({ ok: false, refusal: { message: /Mia has acted here/ } });
  });

  it("is refused for a profile that is nobody yet", () => {
    const store = rocks();
    expect(() => mergePerson(store, mia, "explorer:mia", { author: host })).toThrow(/no record of its own/);
  });

  /** Two more people entered beside Mia. */
  const roomy = rocks;
  const refusesToMergeTheEnteredPerson = (store: Store<AnySchema>) => {
    expect(() => mergePerson(store, mia, "explorer:other", { author: host })).toThrow(/no record of its own/);
    expect(store.graph.getNode("explorer:mia")).not.toMatchObject({ $archived: true });
  };

  it("never merges a person entered for the profile and bound to it", () => {
    const store = roomy();
    bindPerson(store, mia, "explorer:mia", { author: host });
    refusesToMergeTheEnteredPerson(store);
  });

  it("never merges one a move taken back put the profile on again", () => {
    const store = roomy();
    bindPerson(store, mia, "explorer:mia", { author: host });
    const moved = rebindPerson(store, mia, "explorer:x", { author: host });
    store.undo(moved.batch, { author: host });
    expect(store.personOf(mia)).toBe("explorer:mia");
    refusesToMergeTheEnteredPerson(store);
  });

  it("never merges one an ending taken back bound the profile to again", () => {
    const store = roomy();
    bindPerson(store, mia, "explorer:mia", { author: host });
    const ended = unbindPerson(store, mia, { author: host });
    store.undo(ended.batch, { author: host });
    expect(store.personOf(mia)).toBe("explorer:mia");
    refusesToMergeTheEnteredPerson(store);
  });

  it("never merges again the person a merge bound the profile to", () => {
    const store = roomy();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    mergePerson(store, mia, "explorer:mia", { author: host });
    refusesToMergeTheEnteredPerson(store);
  });

  it("never merges an entered person bound behind the horizon, with the archive or without it", () => {
    const store = roomy();
    bindPerson(store, mia, "explorer:mia", { author: host });
    const archived = compactAll(store);
    refusesToMergeTheEnteredPerson(store);
    expect(() => mergePerson(store, mia, "explorer:other", { author: host, archived })).toThrow(/no record of its own/);
  });

  it("never merges an entered person put back by undoing their removal", () => {
    const store = roomy();
    const keeper: Principal = { kind: "human", id: "acct-keeper", roles: ["keeper"] };
    bindPerson(store, mia, "explorer:mia", { author: host });
    const removed = store.apply({ name: "remove-explorer", args: { id: "explorer:mia" } }, { author: keeper });
    store.undo(removed.batch, { author: keeper });
    expect(store.personOf(mia)).toBe("explorer:mia");
    refusesToMergeTheEnteredPerson(store);
  });

  it("merges the profile's own person put back by undoing its removal", () => {
    const store = roomy();
    const keeper: Principal = { kind: "human", id: "acct-keeper", roles: ["keeper"] };
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    const own = store.personOf(mia)!;
    const removed = store.apply({ name: "remove-explorer", args: { id: own } }, { author: keeper });
    store.undo(removed.batch, { author: keeper });
    expect(store.personOf(mia)).toBe(own);
    mergePerson(store, mia, "explorer:mia", { author: host });
    expect(store.personOf(mia)).toBe("explorer:mia");
  });

  it("merges the profile's own person after it was moved away and back", () => {
    const store = roomy();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    const own = store.personOf(mia)!;
    rebindPerson(store, mia, "explorer:x", { author: host });
    rebindPerson(store, mia, own, { author: host });
    mergePerson(store, mia, "explorer:mia", { author: host });
    expect(store.personOf(mia)).toBe("explorer:mia");
    expect(store.graph.getNode(own)).toMatchObject({ $archived: true });
  });

  it("merges the profile's own person made behind the horizon, found in the archive the host hands", () => {
    const store = rocks();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    const archived = compactAll(store);
    expect(() => mergePerson(store, mia, "explorer:mia", { author: host })).toThrow(/no record of its own/);
    expect(mergePerson(store, mia, "explorer:mia", { author: host, archived }).leftBehind).toEqual(none);
    expect(foundBy(store, "rock:quartz")).toEqual(["explorer:mia"]);
  });
});

describe("the links a move carries keep what they are", () => {
  it("keeps the ids of two links of one relation between the same two records, each at its own end", () => {
    const store = storeOf();
    bindPerson(store, bud, "participant:ann", { author: host });
    store.apply({ name: "mind-each-other", args: { id: "participant:cy" } }, { author: bud });
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(linksOf(store, "minds")).toEqual([
      { from: "participant:bud", to: "participant:cy", id: "link-mine" },
      { from: "participant:cy", to: "participant:bud", id: "link-theirs" },
    ]);
  });

  it("keeps those ids when the move is taken back and when it follows them on to the next record", () => {
    const store = storeOf([{ id: "participant:dee", kind: "participant", name: "Dee" }]);
    bindPerson(store, bud, "participant:ann", { author: host });
    store.apply({ name: "mind-each-other", args: { id: "participant:cy" } }, { author: bud });
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    store.undo(moved.batch, { author: host });
    expect(linksOf(store, "minds")).toEqual([
      { from: "participant:ann", to: "participant:cy", id: "link-mine" },
      { from: "participant:cy", to: "participant:ann", id: "link-theirs" },
    ]);
    rebindPerson(store, bud, "participant:bud", { author: host });
    rebindPerson(store, bud, "participant:dee", { author: host });
    expect(linksOf(store, "minds")).toEqual([
      { from: "participant:cy", to: "participant:dee", id: "link-theirs" },
      { from: "participant:dee", to: "participant:cy", id: "link-mine" },
    ]);
  });

  it("moves a link from the person's record to itself at both ends, and on through the next move", () => {
    const store = storeOf([{ id: "participant:dee", kind: "participant", name: "Dee" }]);
    bindPerson(store, bud, "participant:ann", { author: host });
    store.apply({ name: "mind-myself", args: {} }, { author: bud });
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(linksOf(store, "minds")).toEqual([{ from: "participant:bud", to: "participant:bud" }]);
    expect(moved.leftBehind).toEqual(none);
    rebindPerson(store, bud, "participant:dee", { author: host });
    expect(linksOf(store, "minds")).toEqual([{ from: "participant:dee", to: "participant:dee" }]);
  });

  it("moves the own record's link to itself at both ends in a merge", () => {
    const store = storeOf([{ id: "acct-bud", kind: "participant", name: "bud" }]);
    store.apply({ name: "mind-myself", args: {} }, { author: bud });
    expect(linksOf(store, "minds")).toEqual([{ from: "acct-bud", to: "acct-bud" }]);
    mergePerson(store, bud, "participant:ann", { author: host });
    expect(linksOf(store, "minds")).toEqual([{ from: "participant:ann", to: "participant:ann" }]);
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(linksOf(store, "minds")).toEqual([{ from: "participant:bud", to: "participant:bud" }]);
  });
});
