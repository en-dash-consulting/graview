import { bindSchema, createSchema, defineNode, nodeRef, PROPOSE_CHANGES, Store, z, type AnySchema, type Policy, type Principal } from "@graview/core";
import { bindPerson } from "@graview/core/binding";
import { makerOf } from "@graview/core/history";
import { acceptSuggestion, isProposal, suggest, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { presenceFrom, visitorPresence, whoFor } from "../../src/runtime.js";

/**
 * A PROFILE BOUND TO A PERSON, AND A PERSON NOBODY ELSE MAY SEE. Bud uses
 * his family's account as his own profile, and that profile is bound to the
 * participant entered for him. To Ann, his figure, the agent acting for him,
 * the change he proposes and his vote never say the family's account; to a
 * member who may not see him, his acts are somebody's and never their own;
 * and once his record is removed and the log compacted, his acts still never
 * say his account.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }) } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const addGift = defineMutation("add-gift", { title: "Add a gift", creates: ["gift"], input: z.object({ title: z.string() }), apply: (ctx: any, args: any) => ctx.addNode({ id: ctx.freshId(args.title, "gift"), kind: "gift", title: args.title }) } as never);
const rename = defineMutation("rename-gift", { title: "Rename", subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]), title: z.string() }), apply: (ctx: any, args: any) => ctx.patchNode(args.id, { title: args.title }) } as never);

const host: Principal = { kind: "system", id: "host" };
const bud: Principal = { kind: "human", id: "acct-bud", name: "budster", roles: ["member"] };
const budAtHome: Principal = { kind: "human", id: "acct-family", name: "The Smiths", roles: ["member"], profile: { id: "prf_bud", name: "Buddy" } };
const ann: Principal = { kind: "human", id: "acct-ann", name: "Ann", roles: ["member"] };
const blind: Principal = { kind: "human", id: "acct-cy", roles: ["blind"] };
const keeper: Principal = { kind: "human", id: "acct-kay", name: "Kay", roles: ["keeper"] };
const policy: Policy = {
  roles: ["member", "keeper", "blind"],
  grants: [{ roles: ["member", "blind"], mutations: ["add-gift"], propose: ["rename-gift"] }, { roles: ["keeper"], mutations: "*" }],
  sees: [{ roles: ["member", "keeper"], kinds: ["participant", "gift"] }, { roles: ["blind"], kinds: ["gift"] }],
};
const make = (extra: object = {}) =>
  new Store<AnySchema>({ schema, mutations: [addGift, rename] as never, policy, ...extra, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "gift:kite", kind: "gift", title: "Kite" }], edges: [] } } as never);
const says = (value: unknown, text: string) => JSON.stringify(value ?? null).includes(text);

describe("a bound profile, to another member", () => {
  it("is never the family's account in who is here, nor in for whom an agent acts", () => {
    const store = make();
    bindPerson(store, budAtHome, "participant:bud", { author: host });
    const told = whoFor(store, ann, [presenceFrom({ participant: "x", stop: "" } as never, budAtHome), visitorPresence({ kind: "agent", id: "helper", onBehalfOf: budAtHome } as never)]);
    expect(says(told, "acct-family")).toBe(false);
  });

  it("is never the family's account in who proposed a change or who voted it in", () => {
    const store = make({ tidying: { autoAcceptAt: 1 } });
    bindPerson(store, budAtHome, "participant:bud", { author: host });
    store.applyAll([{ name: PROPOSE_CHANGES, args: { calls: [{ name: "rename-gift", args: { id: "gift:kite", title: "Big" } }] } }], { author: budAtHome });
    const op = suggest(store, [{ name: "rename-gift", args: { id: "gift:kite", title: "Red" } }], { author: { kind: "system", id: "tidying", automated: true } as never, lineage: { basis: "Tidier" } })!;
    acceptSuggestion(store, op.id, { author: budAtHome });
    const log = store.seenBy(ann).log.all();
    expect(says(log, "acct-family")).toBe(false);
    expect(says(log, "The Smiths")).toBe(false);
  });
});

describe("another profile of an account bound to a person", () => {
  it("is never that account, nor its session, to another member", () => {
    const store = make();
    bindPerson(store, bud, "participant:bud", { author: host });
    const kid = { ...bud, session: "tab-7", profile: { id: "prf_kid", name: "Kid" } } as Principal;
    store.apply({ name: "add-gift", args: { title: "Top" } }, { author: kid });
    const served = store.seenBy(ann).log.all().slice(-1);
    expect(says(served, "acct-bud")).toBe(false);
    expect(says(served, "tab-7")).toBe(false);
  });
});

describe("another profile of an account bound to a person, to itself", () => {
  it("reads its own changes as its own", () => {
    const store = make();
    bindPerson(store, bud, "participant:bud", { author: host });
    const kid = { ...bud, profile: { id: "prf_kid", name: "Kid" } } as Principal;
    store.apply({ name: "add-gift", args: { title: "Top" } }, { author: kid });
    const own = store.seenBy(kid).log.all().at(-1)!;
    expect(makerOf(own.author, kid)).toBe("you");
  });
});

describe("who proposed a change and who voted for it", () => {
  it("is what the store says, whatever a change's own lineage claims", () => {
    const store = make();
    bindPerson(store, bud, "participant:bud", { author: host });
    for (const guess of ["acct-bud", "acct-nobody"]) {
      store.apply({ name: "add-gift", args: { title: guess } }, { author: ann, lineage: { basis: "x", proposedBy: guess, voters: [guess] } });
      const mine = store.seenBy(ann).log.all().at(-1)!;
      expect(mine.lineage).toEqual({ basis: "x" });
    }
  });

  it("is what the store says on an undo too, whatever its lineage claims", () => {
    const store = make();
    bindPerson(store, bud, "participant:bud", { author: host });
    const done = store.apply({ name: "add-gift", args: { title: "Hoop" } }, { author: ann });
    store.undo(done.batch, { author: ann, lineage: { basis: "x", proposedBy: "acct-bud", voters: ["acct-bud"] } });
    expect(store.log.all().at(-1)!.lineage).toEqual({ basis: "x" });
    expect(store.seenBy(ann).log.all().at(-1)!.lineage).toEqual({ basis: "x" });
  });

  it("names the record in the proposal's own words though the proposal is behind a horizon", () => {
    const store = make();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.applyAll([{ name: PROPOSE_CHANGES, args: { calls: [{ name: "rename-gift", args: { id: "gift:kite", title: "Big" } }] } }], { author: bud });
    const accepted = acceptSuggestion(store, suggestions(store, keeper)[0]!.id, { author: keeper }).ops.at(-1)!.id;
    store.compact(store.checkpoint({ seq: store.log.length - 1 })!);
    const served = store.seenBy(ann).log.all().find((one) => one.id === accepted)!;
    expect(served.lineage).toMatchObject({ basis: "Proposed by Bud", proposedBy: "participant:bud" });
    expect(says(served, "budster")).toBe(false);
  });
});

describe("a proposal by a bound person", () => {
  it("stays a proposal, by their record, to a member who sees them, and by somebody to one who may not", () => {
    for (const who of [bud, budAtHome]) {
      const store = make();
      bindPerson(store, who, "participant:bud", { author: host });
      store.applyAll([{ name: PROPOSE_CHANGES, args: { calls: [{ name: "rename-gift", args: { id: "gift:kite", title: "Big" } }] } }], { author: who });
      const toAnn = suggestions(store, ann);
      expect(toAnn).toHaveLength(1);
      expect(isProposal(toAnn[0]!)).toBe(true);
      expect(toAnn[0]!.lineage?.proposedBy).toBe("participant:bud");
      const toBlind = suggestions(store, blind);
      expect(toBlind).toHaveLength(1);
      expect(isProposal(toBlind[0]!)).toBe(true);
      expect(says(toBlind, "participant:bud")).toBe(false);
    }
  });

  it("is kept in the log as the proposer's own, whoever accepts it", () => {
    for (const who of [bud, budAtHome]) {
      const store = make();
      bindPerson(store, who, "participant:bud", { author: host });
      store.applyAll([{ name: PROPOSE_CHANGES, args: { calls: [{ name: "rename-gift", args: { id: "gift:kite", title: "Big" } }] } }], { author: who });
      acceptSuggestion(store, suggestions(store, keeper)[0]!.id, { author: keeper });
      const accepted = store.log.all().at(-1)!;
      expect(accepted.lineage?.proposedBy).toBe(who.id);
      expect(says(store.seenBy(ann).log.all(), who.id!)).toBe(false);
      expect(store.seenBy(ann).log.all().at(-1)!.lineage?.proposedBy).toBe("participant:bud");
    }
  });
});

describe("a bound person, to a member who may not see them", () => {
  it("is somebody, and never the member themselves", () => {
    const store = make();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "add-gift", args: { title: "Ball" } }, { author: bud });
    const op = store.seenBy(blind).log.all().at(-1)!;
    expect(makerOf(op.author, blind)).not.toBe("you");
    expect(says(op, "acct-bud")).toBe(false);
    expect(says(op, "budster")).toBe(false);
  });
});

describe("a bound person whose record is removed", () => {
  it("is never said as the account again, past a compaction", () => {
    const store = make();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "add-gift", args: { title: "Ball" } }, { author: bud });
    store.apply({ name: "remove-participant", args: { id: "participant:bud" } }, { author: keeper });
    store.apply({ name: "add-gift", args: { title: "Top" } }, { author: bud });
    const last = store.log.all().at(-1)!.id;
    expect(store.seenBy(ann).log.all().find((one) => one.id === last)!.author.id).not.toBe("acct-bud");
    store.compact(store.checkpoint({ seq: store.log.length - 1 })!);
    expect(store.seenBy(ann).log.all().find((one) => one.id === last)!.author.id).not.toBe("acct-bud");
    expect(says(store.seenBy(ann).log.all(), "acct-bud")).toBe(false);
  });
});
