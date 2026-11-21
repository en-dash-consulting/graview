import { describe, expect, it } from "vitest";
import { bindPerson, hostSeat, mergePerson, mayBind } from "../../src/binding.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { untouched } from "../../src/graph/touched.js";
import { ActRefusal, bindSchema, createSchema, defineApp, defineNode, BIND_OWN_RECORD, nameOfAuthor, nodeRef, PermissionDeniedError, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * THE HOST MERGES A MEMBER'S OWN RECORD INTO THE PERSON ENTERED FOR THEM
 * (Roadmap f-merge-own-record-into-person). Bud opened the app before the
 * organizer linked him to the Bud she had entered, so he has a record of
 * his own, `acct-bud`, and binding his account is refused: it has its own
 * record. The host merges the two: his account is the entered Bud from now
 * on, what he did as his own record is said as that Bud, his own record's
 * links move to it and his own record is set aside — one change, which
 * undo takes back whole.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string(), age: z.number().optional() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["participant"] } } } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const giveIt = defineMutation("give-it", { title: "I'll give it", doneAsMe: true, subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: ctx.me }) } as never);

const policy: Policy = {
  grants: [
    { roles: ["owner"], mutations: "*" },
    { roles: ["member"], mutations: ["give-it"] },
  ],
  sees: [{ roles: ["owner", "member"], kinds: ["participant", "gift"] }],
};

const host = hostSeat({ id: "host" });
const organizer: Principal = { kind: "human", id: "acct-org", roles: ["owner"] };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const ann: Principal = { kind: "human", id: "acct-ann", roles: ["member"] };

/** Bud entered by the organizer, and Bud's own record from his first open, with a gift he gave as it and one the organizer linked to it. */
function joinedTwice(): { readonly store: Store<AnySchema>; readonly gave: string } {
  const store = new Store<AnySchema>({
    schema,
    mutations: [giveIt] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "participant:bud", kind: "participant", name: "Bud", age: 12 },
        { id: "participant:ann", kind: "participant", name: "Ann" },
        { id: "acct-bud", kind: "participant", name: "bud@example.com" },
        { id: "gift:kite", kind: "gift", title: "A kite" },
        { id: "gift:book", kind: "gift", title: "A book" },
        { id: "gift:ball", kind: "gift", title: "A ball" },
      ],
      edges: [{ kind: "givenBy", from: "gift:book", to: "acct-bud" }],
    },
  } as never);
  const gave = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
  return { store, gave: gave.ops[0]!.id };
}

const saidAs = (store: Store<AnySchema>, reader: Principal, id: string) => {
  const view = store.seenBy(reader);
  const op = view.log.all().find((one) => one.id === id)!;
  return { id: op.author.id, name: nameOfAuthor(op.author, { graph: view.graph as never, schema: store.schema }) };
};

const edgesOf = (store: Store<AnySchema>) => store.graph.allEdges({ archived: "all" }).map((edge) => `${edge.kind} ${edge.from} ${edge.to}`).sort();
const givers = (store: Store<AnySchema>, id: string) => store.graph.out(id, "givenBy" as never).map((one) => one.id);

describe("binding an account with its own record", () => {
  it("is refused with a sentence that names the merge", () => {
    const { store } = joinedTwice();
    expect(() => bindPerson(store, bud, "participant:bud", { author: host })).toThrow(/merge it into Bud instead/);
  });
});

describe("the host merges a member's own record into the person entered for them", () => {
  it("binds the seat to the record named, and says every act done as the own record as it", () => {
    const { store, gave } = joinedTwice();
    expect(saidAs(store, organizer, gave)).toMatchObject({ id: "acct-bud" });
    mergePerson(store, bud, "participant:bud", { author: host });
    expect(store.personOf(bud)).toBe("participant:bud");
    expect(saidAs(store, organizer, gave)).toEqual({ id: "participant:bud", name: "Bud" });
    store.apply({ name: "give-it", args: { id: "gift:ball" } }, { author: bud });
    expect(givers(store, "gift:ball")).toEqual(["participant:bud"]);
  });

  it("moves the own record's links to the record named", () => {
    const { store } = joinedTwice();
    mergePerson(store, bud, "participant:bud", { author: host });
    expect(givers(store, "gift:kite")).toEqual(["participant:bud"]);
    expect(givers(store, "gift:book")).toEqual(["participant:bud"]);
  });

  it("sets the own record aside rather than leaving a second person", () => {
    const { store } = joinedTwice();
    mergePerson(store, bud, "participant:bud", { author: host });
    expect(store.graph.getNode("acct-bud")).toMatchObject({ $archived: true });
    expect(store.graph.nodesOfKind("participant" as never).map((one: { id: string }) => one.id).sort()).toEqual(["participant:ann", "participant:bud"]);
  });

  it("is one change, which undo takes back whole: the own record, its links, who did what and the binding", () => {
    const { store, gave } = joinedTwice();
    // The undo stamps what it put back with its own touch; every other field is as it was.
    const before = { nodes: store.graph.allNodes({ archived: "all" }).map(untouched), edges: edgesOf(store) };
    const merged = mergePerson(store, bud, "participant:bud", { author: host });
    expect(merged.ops).toHaveLength(1);
    expect(merged.ops[0]).toMatchObject({ mutation: { name: BIND_OWN_RECORD }, author: { kind: "system", id: "host" } });
    expect(store.mayUndo(merged.batch, host)).toEqual({ ok: true });
    store.undo(merged.batch, { author: host });
    expect(store.personOf(bud)).toBe("acct-bud");
    expect(store.graph.getNode("acct-bud")).not.toHaveProperty("$archived");
    expect(store.graph.getNode("participant:bud")).not.toHaveProperty("$seat");
    expect({ nodes: store.graph.allNodes({ archived: "all" }).map(untouched), edges: edgesOf(store) }).toEqual(before);
    expect(saidAs(store, organizer, gave)).toMatchObject({ id: "acct-bud" });
    expect(mayBind(store, "participant:bud")).toEqual({ ok: true });
  });

  it("is not taken back once the person has acted as the record they were merged into", () => {
    const { store } = joinedTwice();
    const merged = mergePerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:ball" } }, { author: bud });
    // He gave the ball as Bud after the merge: taking the merge back would hand that to his own record.
    const may = store.mayUndo(merged.batch, host);
    expect(may.ok).toBe(false);
    expect(JSON.stringify(may)).toMatch(/Bud has acted here: undoing the merge would hand what they did to someone else/);
  });
});

describe("what a merge refuses, in words", () => {
  it("an account with no record of its own", () => {
    const { store } = joinedTwice();
    expect(() => mergePerson(store, ann, "participant:ann", { author: host })).toThrow(/has no record of its own here/);
  });

  it("a record that is somebody else's", () => {
    const { store } = joinedTwice();
    bindPerson(store, ann, "participant:ann", { author: host });
    expect(() => mergePerson(store, bud, "participant:ann", { author: host })).toThrow(/Ann is already someone else's record here/);
  });

  it("a record that is not of the people, or the own record itself", () => {
    const { store } = joinedTwice();
    expect(() => mergePerson(store, bud, "gift:kite", { author: host })).toThrow(ActRefusal);
    expect(() => mergePerson(store, bud, "acct-bud", { author: host })).toThrow(ActRefusal);
    expect(store.personOf(bud)).toBe("acct-bud");
  });

  it("an account already bound to a record", () => {
    const { store } = joinedTwice();
    mergePerson(store, bud, "participant:bud", { author: host });
    expect(() => mergePerson(store, bud, "participant:ann", { author: host })).toThrow(/already Bud here/);
  });
});

describe("merging is the host's own seat alone", () => {
  const call = { name: BIND_OWN_RECORD, args: { seat: "acct-bud", record: "participant:bud" } };
  const refusedTo: readonly [string, Principal][] = [
    ["the owner, whom a grant gives every act", organizer],
    ["the person merged", bud],
    ["an agent", { kind: "agent", id: "agent:helper" }],
    ["the app's own actor", { kind: "system", id: "app:tidy", automated: true } as Principal],
    ["a workflow", { kind: "system", id: "workflow:weekly" }],
    ["another system seat", { kind: "system", id: "host" }],
  ];
  for (const [who, principal] of refusedTo) {
    it(`refuses ${who}`, () => {
      const { store } = joinedTwice();
      expect(store.permits(call, principal).ok).toBe(false);
      expect(() => mergePerson(store, bud, "participant:bud", { author: principal })).toThrow(PermissionDeniedError);
      expect(store.personOf(bud)).toBe("acct-bud");
    });
  }

  it("is permitted to the host and offered by no list of acts", () => {
    const { store } = joinedTwice();
    expect(store.permits(call, host).ok).toBe(true);
    expect(store.allMutations().map((one) => one.name)).not.toContain(BIND_OWN_RECORD);
  });
});

describe("graview check knows the act", () => {
  it("refuses a grant of it, and an act of the app's own under its name", () => {
    const granted = checkApp(defineApp({ name: "binding", schema, mutations: [giveIt] as never, policy: { ...policy, grants: [...policy.grants, { roles: ["member"], mutations: [BIND_OWN_RECORD] }] } }) as never).findings;
    expect(granted.filter((one) => one.code === "grant-gives-binding")).toHaveLength(1);
    expect(granted.map((one) => one.code)).not.toContain("grant-unknown-mutation");
    const own = { name: BIND_OWN_RECORD, title: "Merge", input: z.object({}), apply: () => undefined };
    const taken = checkApp(defineApp({ name: "binding", schema, mutations: [own] as never }) as never).findings;
    expect(taken.filter((one) => one.code === "binding-act-taken" && one.severity === "error")).toHaveLength(1);
  });

  it("refuses it in a document, compiled and as an edit adds it", () => {
    const doc = {
      format: "graview-document",
      formatVersion: 1,
      name: "Binding",
      kinds: { member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true } } } },
      roles: ["owner", "editor"],
      policy: { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["editor"], mutations: [BIND_OWN_RECORD] }] },
    };
    expect(compileDocument(doc as never).findings.map((one) => one.code)).toContain("grant-gives-binding");
    const plain = { ...doc, policy: { grants: [{ roles: ["owner"], mutations: "*" }] } };
    const edited = editDocument(plain as never, [{ op: "add-grant", roles: ["editor"], mutations: [BIND_OWN_RECORD] }] as never);
    expect(edited.ok).toBe(false);
  });
});
