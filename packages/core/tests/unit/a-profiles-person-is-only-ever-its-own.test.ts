import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineNode, meOf, nodeRef, profileOf, profilePersonId, Store, withValidProfile, z, type AnySchema, type Principal } from "../../src/index.js";

/**
 * A PROFILE'S PERSON, AGAINST CODE AND RESTORES, AND WHAT IS NOT TAKEN AWAY
 * (Roadmap f-viewer-state-and-me-framework): a code act cannot make a record
 * under a person's id; a wrong-kind record there is not the person; what a
 * seat did it may still undo; and `permits` answers what `apply` would.
 */
const mia: Principal = { kind: "human", id: "user:nick", name: "Nick", profile: { id: "prf_mia", name: "Mia" } };
const person = profilePersonId("user:nick", { id: "prf_mia" });

function coded(fields: Record<string, z.ZodType> = { name: z.string() }) {
  const explorer = defineNode("explorer", { people: true, fields: z.object(fields) } as never);
  const rock = defineNode("rock", { fields: z.object({ title: z.string() }), edges: { foundBy: { to: ["explorer"] } } } as never);
  const schema = createSchema([explorer, rock]);
  const { defineMutation } = bindSchema(schema);
  const never = defineMutation("add-own-id", { title: "Add", creates: ["rock"], input: z.object({ key: z.string() }), apply: (ctx: any, args: any) => ctx.addNode({ id: args.key, kind: "rock", title: "x" } as never) } as never);
  const composed = defineMutation("add-composed", { title: "Add", creates: ["rock"], input: z.object({ key: z.string() }), apply: (ctx: any, args: any) => ctx.addNode({ id: `user:${args.key}`, kind: "rock", title: "x" } as never) } as never);
  const emitted = defineMutation("add-emitted", { title: "Add", creates: ["rock"], input: z.object({ key: z.string() }), apply: (ctx: any, args: any) => ctx.emit({ op: "add-node", node: { id: args.key, kind: "rock", title: "x" } } as never) } as never);
  const find = defineMutation("find", { title: "Found it", input: z.object({ id: nodeRef(["rock"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ from: args.id, to: ctx.me!, kind: "foundBy" } as never) } as never);
  const store = new Store({ schema, mutations: [never, composed, emitted, find] as never, snapshot: { nodes: [{ id: "rock:q", kind: "rock", title: "q" }], edges: [] } as never });
  return store as unknown as Store<AnySchema>;
}

const rocks = (extra: { fields?: Record<string, unknown>; acts?: Record<string, unknown>; nodes?: unknown[] } = {}) => {
  const doc = {
    format: "graview-document",
    formatVersion: 1,
    name: "Rocks",
    roles: ["family"],
    kinds: {
      explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true }, ...extra.fields } },
      rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true }, signed: { type: "string" } }, edges: { foundBy: { to: ["explorer"], description: "who", inverse: "what" } } },
    },
    acts: { "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] }, sign: { title: "Sign", on: "rock", effects: [{ set: { signed: "$me" } }] }, ...extra.acts },
    policy: { grants: [{ roles: ["family"], mutations: "*" }] },
  };
  const made = compileDocument(doc as never);
  if (!made.ok) throw new Error(JSON.stringify(made.findings.filter((one) => one.severity === "error")));
  return { made, store: new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations as never, policy: made.app.policy!, snapshot: { nodes: extra.nodes ?? [{ id: "user:nick", kind: "explorer", name: "Nick" }, { id: "rock:q", kind: "rock", title: "Quartz" }], edges: [] } as never }) };
};
const family = (seat: Principal): Principal => ({ ...seat, roles: ["family"] });

describe("a code act", () => {
  it("cannot make a record under a profile's person's id, by addNode, composed or emitted", () => {
    const store = coded();
    for (const [name, key] of [["add-own-id", person], ["add-composed", "nick~prf_mia"], ["add-emitted", person]] as const) {
      expect(() => store.apply({ name, args: { key } })).toThrow(/cannot hold a ~/);
      expect(store.graph.has(person)).toBe(false);
    }
    store.apply({ name: "find", args: { id: "rock:q" } }, { author: mia });
    expect(store.graph.getNode(person)).toMatchObject({ kind: "explorer", name: "Mia" });
  });
});

describe("a record of another kind at a person's id, from a restore or a host's primitives", () => {
  it("is not read as the person: $me refuses in a sentence, and is not offered", () => {
    const { store } = rocks();
    store.applyPrimitives([{ op: "add-node", node: { id: person, kind: "rock", title: "squatted" } as never }], { author: { kind: "system", id: "sync" } });
    const seat = family(mia);
    expect(store.permittedMutations(seat).map((one) => one.name)).not.toContain("find-rock");
    expect(store.permits({ name: "find-rock", args: { id: "rock:q" } }, seat)).toMatchObject({ ok: false, refusal: { message: expect.stringMatching(/you have no record here/) } });
    expect(() => store.apply({ name: "find-rock", args: { id: "rock:q" } }, { author: seat })).toThrow(/you have no record here/);
  });
});

describe("what a seat did, it may still undo", () => {
  it("is so for a profile undoing its account's act where a profile can have no record", () => {
    const { store } = rocks({ fields: { age: { type: "number", required: true } }, nodes: [{ id: "user:nick", kind: "explorer", name: "Nick", age: 40 }, { id: "rock:q", kind: "rock", title: "Quartz" }] });
    const done = store.apply({ name: "find-rock", args: { id: "rock:q" } }, { author: family({ ...mia, profile: undefined } as never) });
    store.undo(done.batch, { author: family(mia) });
    expect(store.graph.out("rock:q", "foundBy" as never)).toEqual([]);
  });

  it("is so for a profile undoing its own act after its person was removed", () => {
    const { store } = rocks();
    const done = store.apply({ name: "sign", args: { id: "rock:q" } }, { author: family(mia) });
    store.applyPrimitives([{ op: "remove-node", node: store.graph.getNode(person) as never }], { author: { kind: "system", id: "people" } });
    expect(store.mayUndo(done.batch, family(mia))).toEqual({ ok: true });
    store.undo(done.batch, { author: family(mia) });
    expect((store.graph.getNode("rock:q") as unknown as { signed?: string }).signed).toBeUndefined();
  });
});

describe("a code act that reads ctx.me where a profile can have no record", () => {
  it("is refused in a sentence, never as a missing node; and declaring doneAsMe leaves it unoffered", () => {
    const store = coded({ name: z.string(), age: z.number() });
    expect(() => store.apply({ name: "find", args: { id: "rock:q" } }, { author: mia })).toThrow(/"Found it" is done as you, and you have no record here/);
    expect(store.log.all()).toEqual([]);
    const definition = store.allMutations().find((one) => one.name === "find") as unknown as { doneAsMe?: true };
    definition.doneAsMe = true;
    expect(store.permittedMutations(mia).map((one) => one.name)).not.toContain("find");
  });

  it("is left alone for a seat with no profile", () => {
    const store = coded({ name: z.string(), age: z.number() });
    expect(() => store.apply({ name: "find", args: { id: "rock:q" } }, { author: { kind: "human", id: "user:nick" } })).not.toThrow(/no record here/);
  });
});

describe("people-unmakeable", () => {
  it("does not warn where the kind's only required word is long text, which holds the name", () => {
    const doc = (fields: Record<string, unknown>) => ({ format: "graview-document", formatVersion: 1, name: "T", roles: ["m"], kinds: { member: { noun: "member", plural: "members", people: true, fields }, idea: { noun: "idea", plural: "ideas", fields: { title: { type: "string", required: true } }, edges: { votedBy: { to: ["member"], description: "v", inverse: "w" } } } }, acts: { vote: { title: "Vote", on: "idea", effects: [{ connect: "votedBy", from: "$subject", to: "$me" }] } }, policy: { grants: [{ roles: ["m"], mutations: "*" }] } });
    const said = (fields: Record<string, unknown>) => compileDocument(doc(fields) as never).findings.filter((one) => one.code === "people-unmakeable");
    expect(said({ bio: { type: "text", required: true } })).toEqual([]);
    expect(said({ name: { type: "string", required: true }, bio: { type: "text", required: true } })).toHaveLength(1);
  });
});

describe("permits and apply", () => {
  const board = JSON.parse(readFileSync(new URL("../document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
  board.kinds.idea.edges.ledBy = { to: ["member"], cardinality: "one", description: "who leads it", inverse: "what they lead" };
  board.acts.lead = { title: "Lead it", fromTheOtherEnd: "Lead this idea", on: "idea", effects: [{ connect: "ledBy", from: "$subject", to: "$leader" }] };
  board.policy.grants.push({ roles: "*", mutations: ["lead"], ownEnd: true });
  const compiled = compileDocument(board);
  if (!compiled.ok) throw new Error("the board compiles");
  const fresh = () => new Store<AnySchema>({ schema: compiled.app.schema, mutations: compiled.app.mutations as never, policy: compiled.app.policy!, snapshot: { nodes: [{ id: "p_ann", kind: "member", name: "Ann" }, { id: "p_bo", kind: "member", name: "Bo" }, { id: "idea:picnic", kind: "idea", title: "A picnic" }], edges: [] } as never });
  const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };
  const seat: Principal = { ...ann, profile: { id: "prf_mia", name: "Mia" } };
  const own = profilePersonId("p_ann", { id: "prf_mia" });

  it("agree before the person exists: refused where the link is somebody's, as apply refuses", () => {
    const store = fresh();
    store.apply({ name: "lead", args: { id: "idea:picnic", leader: "p_bo" } }, { author: { kind: "human", id: "p_bo", roles: ["member"] } });
    const call = { name: "lead", args: { id: "idea:picnic", leader: own } };
    expect(store.permits(call, seat).ok).toBe(false);
    expect(() => store.apply(call, { author: seat })).toThrow(/own end/);
  });

  it("agree before the person exists: permitted where the link is free, as apply lands, and asking changes nothing", () => {
    const store = fresh();
    const call = { name: "lead", args: { id: "idea:picnic", leader: own } };
    const ops = store.log.length;
    expect(store.permits(call, seat).ok).toBe(true);
    expect(store.log.length).toBe(ops);
    expect(store.graph.has(own)).toBe(false);
    store.apply(call, { author: seat });
    expect(store.graph.out("idea:picnic", "ledBy" as never).map((one) => one.id)).toEqual([own]);
  });
});

describe("a profile on a host's own change", () => {
  it("is held to its shape on the op, as on an act", () => {
    const { store } = rocks();
    store.applyPrimitives([{ op: "patch-node", id: "rock:q", before: { title: "Quartz" }, after: { title: "Q" } } as never], { author: { kind: "human", id: "user:nick", profile: { id: "../bad", name: "x".repeat(5000) } } });
    expect(store.log.all().at(-1)!.author.profile).toBeUndefined();
    store.applyPrimitives([{ op: "patch-node", id: "rock:q", before: { title: "Q" }, after: { title: "R" } } as never], { author: { kind: "human", id: "user:nick", profile: { id: "prf_ok", name: "y".repeat(5000) } } });
    expect(store.log.all().at(-1)!.author.profile).toEqual({ id: "prf_ok", name: "y".repeat(200) });
  });
});

describe("a profile's name", () => {
  it("with no visible character in it is no name", () => {
    for (const name of ["​", " ​‍ ", "﻿", " ", "\u0007"]) {
      const seat = { ...mia, profile: { id: "prf_z", name } };
      expect(profileOf(seat)).toBeUndefined();
      expect(meOf(seat)).toBe("user:nick");
      expect(withValidProfile(seat).profile).toBeUndefined();
    }
    expect(profileOf({ ...mia, profile: { id: "prf_z", name: "M​ia" } })?.name).toBe("M​ia");
  });
});
