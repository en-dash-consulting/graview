import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type AnySchema, type Principal } from "../../src/index.js";

/**
 * A PROFILE MUST NEVER CHANGE WHAT THE ACCOUNT MAY DO (Roadmap
 * f-viewer-state-and-me-framework). With no kind that is the people there is
 * no person to be, so `ctx.me` is the account's. An account whose own id reads
 * as a person's is told so in words. And a `~` is refused to every seat but the
 * host's own, whose sync may hold a remote's id.
 */
const nick: Principal = { kind: "human", id: "user:nick", name: "Nick" };
const mia: Principal = { ...nick, profile: { id: "prf_mia", name: "Mia" } };

function coded(people: boolean) {
  const explorer = defineNode("explorer", { ...(people ? { people: true } : {}), fields: z.object({ name: z.string() }) } as never);
  const rock = defineNode("rock", { fields: z.object({ title: z.string(), owner: z.string().optional() }), edges: { foundBy: { to: ["explorer"] } } } as never);
  const schema = createSchema([explorer, rock]);
  const { defineMutation } = bindSchema(schema);
  const claim = defineMutation("claim", { title: "Claim", input: z.object({ id: nodeRef(["rock"]) }), apply: (ctx: any, args: any) => ctx.patchNode(args.id, { owner: ctx.me }) } as never);
  const find = defineMutation("find", { title: "Found it", input: z.object({ id: nodeRef(["rock"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ from: args.id, to: ctx.me, kind: "foundBy" }) } as never);
  const add = defineMutation("add", { title: "Add", input: z.object({ key: z.string() }), creates: ["rock"], apply: (ctx: any, args: any) => ctx.addNode({ id: args.key, kind: "rock", title: "x" }) } as never);
  const emit = defineMutation("emit", { title: "Add", input: z.object({ key: z.string() }), creates: ["rock"], apply: (ctx: any, args: any) => ctx.emit({ op: "add-node", node: { id: args.key, kind: "rock", title: "x" } }) } as never);
  return new Store({ schema, mutations: [claim, find, add, emit] as never, snapshot: { nodes: [{ id: "rock:q", kind: "rock", title: "q" }, { id: "user:nick", kind: "explorer", name: "Nick" }], edges: [] } as never }) as unknown as Store<AnySchema>;
}
const ownerOf = (store: Store<AnySchema>) => (store.graph.getNode("rock:q") as unknown as { owner?: string }).owner;

describe("an app with no people kind", () => {
  it("applies a code act that reads ctx.me for a profile as for its account, and writes the account's id", () => {
    const account = coded(false);
    account.apply({ name: "claim", args: { id: "rock:q" } }, { author: nick });
    const profile = coded(false);
    expect(profile.permittedMutations(mia).map((one) => one.name)).toContain("claim");
    profile.apply({ name: "claim", args: { id: "rock:q" } }, { author: mia });
    expect(ownerOf(account)).toBe("user:nick");
    expect(ownerOf(profile)).toBe("user:nick");
  });

  it("still says who at the screen on the op, and makes no record", () => {
    const store = coded(false);
    store.apply({ name: "claim", args: { id: "rock:q" } }, { author: mia });
    expect(store.log.all()).toHaveLength(1);
    expect(store.log.all()[0]!.author.profile).toEqual(mia.profile);
  });

  it("names an account whose id holds a ~ by that id, as it always did", () => {
    const store = coded(false);
    store.apply({ name: "claim", args: { id: "rock:q" } }, { author: { kind: "human", id: "user:a~b" } });
    expect(ownerOf(store)).toBe("user:a~b");
  });
});

describe("an account whose own id holds a ~, where a kind is the people", () => {
  it("is refused a code act that reads ctx.me in a sentence, never a missing node", () => {
    const store = coded(true);
    expect(() => store.apply({ name: "find", args: { id: "rock:q" } }, { author: { kind: "human", id: "user:a~b" } })).toThrow(/"Found it" is done as you, and you have no record here/);
  });

  it("changes nothing for a seat with no profile that simply has no record, or no id", () => {
    const store = coded(true);
    expect(() => store.apply({ name: "find", args: { id: "rock:q" } }, { author: { kind: "human", id: "user:ghost" } })).not.toThrow(/no record here/);
    expect(() => coded(true).apply({ name: "find", args: { id: "rock:q" } }, { author: { kind: "human" } })).not.toThrow(/no record here/);
  });
});

describe("a ~ in an id", () => {
  const doc = { format: "graview-document", formatVersion: 1, name: "R", roles: ["m"], kinds: { rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } } } }, acts: { "add-rock": { title: "Add", creates: "rock" } }, policy: { grants: [{ roles: ["m"], mutations: "*" }] } };
  const compiled = compileDocument(doc as never);
  if (!compiled.ok) throw new Error("the document compiles");
  const store = () => new Store<AnySchema>({ schema: compiled.app.schema, mutations: compiled.app.mutations as never, policy: compiled.app.policy!, snapshot: { nodes: [], edges: [] } as never });
  const call = { name: "add-rock", args: { title: "From Notion", id: "rock:ext~42" } };

  it("is the host's own to ask for: a system author's act applies, as its primitives would", () => {
    const one = store();
    one.apply(call, { author: { kind: "system", id: "sync:notion" } });
    expect(one.graph.has("rock:ext~42")).toBe(true);
    const code = coded(true);
    code.apply({ name: "add", args: { key: "rock:ext~1" } }, { author: { kind: "system", id: "sync:notion" } });
    code.apply({ name: "emit", args: { key: "rock:ext~2" } }, { author: { kind: "system", id: "sync:notion" } });
    expect([code.graph.has("rock:ext~1"), code.graph.has("rock:ext~2")]).toEqual([true, true]);
  });

  it("is refused to every seat, a person, an agent and an agent acting for a system's name alike", () => {
    for (const author of [{ kind: "human", id: "h", roles: ["m"] }, { kind: "agent", id: "claude", roles: ["m"] }, { kind: "agent", id: "system", roles: ["m"] }, { kind: "system", id: "x", roles: ["m"], onBehalfOf: { kind: "human", id: "h", roles: ["m"] } }] as Principal[]) {
      expect(() => store().apply(call, { author })).toThrow(/cannot hold a ~/);
    }
  });
});
