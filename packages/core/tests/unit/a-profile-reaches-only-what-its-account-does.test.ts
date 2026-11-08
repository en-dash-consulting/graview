import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import * as coreIndex from "../../src/index.js";
import { bindSchema, createSchema, defineNode, meOf, nameOfAuthor, profileOf, profilePersonId, Store, z, type AnySchema, type Principal } from "../../src/index.js";

/**
 * WHAT A PROFILE MAY NOT DO (Roadmap f-viewer-state-and-me-framework). A
 * person made on first use is held to the grants too, a record of its
 * id must be nobody else's to make, a profile must not narrow what its
 * account may do, and a seat's profile is a host's word held to its shape.
 */
const board = JSON.parse(readFileSync(new URL("../document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
board.kinds.idea.edges.ledBy = { to: ["member"], cardinality: "one", description: "who leads it", inverse: "what they lead" };
board.acts.lead = { title: "Lead it", fromTheOtherEnd: "Lead this idea", on: "idea", effects: [{ connect: "ledBy", from: "$subject", to: "$leader" }] };
board.acts["add-member"] = { title: "Add a member", creates: "member" };
board.policy.grants.push({ roles: "*", mutations: ["lead"], ownEnd: true }, { roles: "*", mutations: ["add-member"] });
const withValidProfile = (one: Principal): Principal => (coreIndex as unknown as { withValidProfile: (seat: Principal) => Principal }).withValidProfile(one);
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
const seed = { nodes: [{ id: "p_ann", kind: "member", name: "Ann" }, { id: "p_bo", kind: "member", name: "Bo" }, { id: "idea:picnic", kind: "idea", title: "A picnic" }], edges: [] };
const storeOf = () => new Store<AnySchema>({ schema: compiled.app.schema, mutations: compiled.app.mutations as never, policy: compiled.app.policy!, snapshot: structuredClone(seed) as never });
const ann: Principal = { kind: "human", id: "p_ann", name: "Ann", roles: ["member"] };
const bo: Principal = { kind: "human", id: "p_bo", name: "Bo", roles: ["member"] };
const mia: Principal = { ...ann, profile: { id: "prf_mia", name: "Mia" } };
const person = profilePersonId("p_ann", { id: "prf_mia" });
const leaderOf = (store: Store<AnySchema>) => store.graph.out("idea:picnic", "ledBy" as never).map((one) => one.id);

describe("an own-end grant and a profile's first act", () => {
  it("does not let a profile's first act take a link from somebody else", () => {
    const store = storeOf();
    store.apply({ name: "lead", args: { id: "idea:picnic", leader: "p_bo" } }, { author: bo });
    expect(() => store.apply({ name: "lead", args: { id: "idea:picnic", leader: person } }, { author: mia })).toThrow(/own end/);
    expect(leaderOf(store)).toEqual(["p_bo"]);
    expect(store.graph.has(person)).toBe(false);
  });

  it("is refused the same before its person exists as after", () => {
    const store = storeOf();
    store.apply({ name: "lead", args: { id: "idea:picnic", leader: "p_bo" } }, { author: bo });
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: mia });
    expect(() => store.apply({ name: "lead", args: { id: "idea:picnic", leader: person } }, { author: mia })).toThrow(/own end/);
    expect(leaderOf(store)).toEqual(["p_bo"]);
  });

  it("does not narrow what its account may do on the account's own record", () => {
    const leads = { format: "graview-document", formatVersion: 1, name: "L", roles: ["m"], kinds: { member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true } }, edges: { leads: { to: ["idea"], description: "leads", inverse: "led by" } } }, idea: { noun: "idea", plural: "ideas", fields: { title: { type: "string", required: true } } } }, acts: { lead: { title: "Lead it", on: "idea", effects: [{ connect: "leads", from: "$leader", to: "$subject" }] } }, policy: { grants: [{ roles: ["m"], mutations: ["lead"], ownEnd: true }] } };
    const made = compileDocument(leads as never);
    if (!made.ok) throw new Error(JSON.stringify(made.findings));
    const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations as never, policy: made.app.policy!, snapshot: structuredClone(seed) as never });
    const nick: Principal = { kind: "human", id: "p_ann", roles: ["m"] };
    const call = { name: "lead", args: { id: "idea:picnic", leader: "p_ann" } };
    expect(store.permits(call, nick).ok).toBe(true);
    expect(store.permits(call, { ...nick, profile: { id: "prf_mia", name: "Mia" } }).ok).toBe(true);
    expect(store.permits({ ...call, args: { ...call.args, leader: "p_bo" } }, { ...nick, profile: { id: "prf_mia", name: "Mia" } }).ok).toBe(false);
  });
});

describe("a profile's person's id", () => {
  // An id that says its kind, as `add-member` asks: the account's own id does, and so does its profile's person.
  const nick: Principal = { kind: "human", id: "member:nick", name: "Nick", roles: ["member"], profile: { id: "prf_mia", name: "Mia" } };
  const his = profilePersonId("member:nick", { id: "prf_mia" });

  it("is nobody's to ask for by id", () => {
    const store = storeOf();
    expect(() => store.apply({ name: "add-member", args: { name: "Evil", id: his } }, { author: bo })).toThrow(/cannot hold a ~/);
    expect(store.graph.has(his)).toBe(false);
  });

  it("is nobody's to take by a client's hint, which is minted past, and $me lands on the profile's own", () => {
    const store = storeOf();
    store.apply({ name: "add-member", args: { name: "Evil" }, mintedHint: his } as never, { author: bo });
    expect(store.graph.has(his)).toBe(false);
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: nick });
    expect(store.graph.getNode(his)).toMatchObject({ name: "Mia" });
  });

  it("is never an account's whose own id holds a ~: that seat has no $me and owns nothing by id", () => {
    const squatter: Principal = { kind: "human", id: person, roles: ["member"] };
    expect(meOf(squatter)).toBeUndefined();
    expect(profileOf({ ...squatter, profile: { id: "prf_x", name: "X" } })).toBeUndefined();
    const store = storeOf();
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: mia });
    expect(() => store.apply({ name: "take-back", args: { id: "idea:picnic", to: person } } as never, { author: squatter })).toThrow();
    expect(store.graph.out("idea:picnic", "votedBy" as never).map((one) => one.id)).toEqual([person]);
  });
});

describe("a people kind a profile cannot have a record of", () => {
  const needs = (field: Record<string, unknown>) => ({ format: "graview-document", formatVersion: 1, name: "S", roles: ["m"], kinds: { member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true }, age: field } }, idea: { noun: "idea", plural: "ideas", fields: { title: { type: "string", required: true } }, edges: { votedBy: { to: ["member"], description: "voted", inverse: "voted for" } } } }, acts: { "vote-for": { title: "Vote for it", on: "idea", effects: [{ connect: "votedBy", from: "$subject", to: "$me" }] } }, policy: { grants: [{ roles: ["m"], mutations: "*" }] } });
  const compile = (doc: unknown) => compileDocument(doc as never);

  it("is said by the checker where $me is used", () => {
    expect(compile(needs({ type: "number", required: true })).findings.filter((one) => one.code === "people-unmakeable")).toMatchObject([{ severity: "warning", path: "acts.vote-for" }]);
    expect(compile(needs({ type: "number" })).findings.filter((one) => one.code === "people-unmakeable")).toEqual([]);
    expect(compile(needs({ type: "number", required: true, default: 7 })).findings.filter((one) => one.code === "people-unmakeable")).toEqual([]);
  });

  it("does not offer a profile an act it would then refuse, and says why where one is asked", () => {
    const made = compile(needs({ type: "number", required: true }));
    if (!made.ok) throw new Error(JSON.stringify(made.findings));
    const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations as never, policy: made.app.policy!, snapshot: { nodes: [{ id: "p_ann", kind: "member", name: "Ann", age: 40 }, { id: "idea:picnic", kind: "idea", title: "A picnic" }], edges: [] } as never });
    const seat: Principal = { kind: "human", id: "p_ann", roles: ["m"], profile: { id: "prf_mia", name: "Mia" } };
    const names = (one: Principal) => store.permittedMutations(one).map((mutation) => mutation.name);
    expect(names(seat)).not.toContain("vote-for");
    expect(names({ kind: "human", id: "p_ann", roles: ["m"] })).toContain("vote-for");
    const call = { name: "vote-for", args: { id: "idea:picnic" } };
    expect(store.permits(call, seat)).toMatchObject({ ok: false, refusal: { message: expect.stringMatching(/you have no record here/) } });
    expect(() => store.apply(call, { author: seat })).toThrow(/you have no record here/);
    expect(store.log.all()).toHaveLength(0);
  });
});

describe("a person who was removed", () => {
  const removable = () => {
    const doc = JSON.parse(JSON.stringify(board));
    doc.policy.grants.push({ roles: "*", mutations: ["remove-member"] });
    const made = compileDocument(doc);
    if (!made.ok) throw new Error(JSON.stringify(made.findings));
    return new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations as never, policy: made.app.policy!, snapshot: structuredClone(seed) as never });
  };
  it("stays removed: $me refuses in a sentence, is not offered, and no record comes back", () => {
    const store = removable();
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: mia });
    store.apply({ name: "remove-member", args: { id: person } }, { author: { kind: "system" } });
    expect(store.graph.has(person)).toBe(false);
    const ops = store.log.length;
    expect(store.permittedMutations(mia).map((one) => one.name)).not.toContain("vote-for");
    expect(() => store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: mia })).toThrow(/you have no record here/);
    expect(store.graph.has(person)).toBe(false);
    expect(store.log.length).toBe(ops);
  });
});

describe("a first act that does nothing", () => {
  it("leaves nothing: no person, no batch with nothing to take back", () => {
    const explorer = defineNode("explorer", { people: true, fields: z.object({ name: z.string() }) } as never);
    const schema = createSchema([explorer]);
    const nothing = bindSchema(schema).defineMutation("nothing", { title: "Nothing", input: z.object({}), apply() {} } as never);
    const store = new Store({ schema, mutations: [nothing] as never, snapshot: { nodes: [], edges: [] } as never });
    const result = store.apply({ name: "nothing", args: {} }, { author: mia });
    expect(result.ops).toEqual([]);
    expect(store.log.all()).toEqual([]);
    expect(store.batches()).toEqual([]);
    expect(store.graph.has(person)).toBe(false);
  });
});

describe("a seat's profile is held to its shape", () => {
  const where = () => ({ graph: storeOf().graph as never, schema: storeOf().schema });
  it("is no profile with no name, an empty one or a bad id", () => {
    for (const profile of [{ id: "prf_x" }, { id: "prf_x", name: "" }, { id: "prf_x", name: "   " }, { id: "a~b", name: "X" }, { id: "../x", name: "X" }]) {
      const seat = { ...ann, profile } as Principal;
      expect(profileOf(seat)).toBeUndefined();
      expect(meOf(seat)).toBe("p_ann");
      expect(withValidProfile(seat).profile).toBeUndefined();
      expect(nameOfAuthor(seat, where())).toBe("Ann");
    }
  });

  it("is kept on the op without what a host hung on it, and its name at 200 in the author, the intent and the person", () => {
    const store = storeOf();
    const long: Principal = { ...ann, profile: { id: "prf_long", name: "M".repeat(500), extra: "x" } as never };
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: long });
    const [made, act] = store.log.all();
    expect(act!.author.profile).toEqual({ id: "prf_long", name: "M".repeat(200) });
    expect(made!.author.profile!.name).toHaveLength(200);
    expect(made!.intent).toBe(`${"M".repeat(200)} joins`);
    expect((store.graph.getNode(profilePersonId("p_ann", { id: "prf_long" })) as unknown as { name: string }).name).toHaveLength(200);
    expect(nameOfAuthor(long, where())).toBe(`${"M".repeat(200)} (Ann)`);
  });

  it("drops one that is no profile from the op's author, and an agent's own", () => {
    const store = storeOf();
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: { ...ann, profile: { id: "bad~id", name: "X" } } });
    expect(store.log.all().at(-1)!.author.profile).toBeUndefined();
    expect(withValidProfile({ kind: "agent", id: "claude", profile: { id: "prf_x", name: "X" } }).profile).toBeUndefined();
    expect(withValidProfile({ kind: "agent", id: "claude", onBehalfOf: { ...ann, profile: { id: "prf_x", name: " " } } }).onBehalfOf?.profile).toBeUndefined();
    expect(withValidProfile(ann)).toBe(ann);
  });
});
