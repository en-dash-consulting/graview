import { bindSchema, createSchema, defineApp, defineNode, Store, type Operation, type Policy, type Principal } from "@graview/core";
import { declineSuggestion, suggest, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveProtocol, type LivePeer } from "../../src/runtime.js";

/**
 * AN UNDO SAYS WHAT IT TOOK BACK, so it is served to a seat as what it takes
 * back is served. And a suggestion is decided by who may make its change;
 * someone who may not has a vote.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), salary: z.string().optional() }) });
const secret = defineNode("secret", { fields: z.object({ label: z.string() }) });
const schema = createSchema([task, secret]);
const { defineMutation } = bindSchema(schema);
const addSecret = defineMutation("add-secret", {
  title: "Add",
  creates: ["secret"],
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "secret", label: args.label });
  },
});
const addTask = defineMutation("add-task", {
  title: "Add",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Changed the name of Layoffs to “${args.label}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id as never, { label: args.label } as never);
  },
});
const policy: Policy = {
  grants: [{ roles: ["keeper"], mutations: "*" }],
  sees: [
    { roles: ["keeper"], kinds: ["task", "secret"] },
    { roles: ["viewer"], kinds: ["task"] },
    { roles: ["reader"], kinds: ["task", "secret"] },
  ],
};
const app = defineApp({ name: "sights", schema, mutations: [addSecret, addTask, rename], policy, version: 1 });
const keeper: Principal = { kind: "human", id: "kay", name: "Kay", roles: ["keeper"] };
const viewer: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["viewer"] };
const reader: Principal = { kind: "human", id: "rex", name: "Rex", roles: ["reader"] };
const actor: Principal = { kind: "system", id: "tidying", automated: true } as Principal;
const SECRET_WORDS = "Layoffs, final";

function withSuggestion() {
  const store = new Store({ schema, mutations: app.mutations ?? [], policy, snapshot: { nodes: [], edges: [] } as never });
  store.apply({ name: "add-secret", args: { id: "s1", label: "Layoffs" } }, { author: keeper });
  store.apply({ name: "add-task", args: { id: "t1", label: "Plan" } }, { author: keeper });
  const made = suggest(store, [{ name: "rename", args: { id: "s1", label: SECRET_WORDS } }], { author: actor, lineage: { basis: "a guess at Layoffs", confidence: 0.6 } })!;
  return { store, made };
}

const said = (ops: readonly Operation[]) => JSON.stringify(ops);

describe("an undo keeps to what a seat may see", () => {
  it("serves a kept-out seat no words of a declined suggestion, in the log it reads whole", () => {
    const { store, made } = withSuggestion();
    declineSuggestion(store, made.id, { author: keeper });
    const log = store.seenBy(viewer).log.all();
    expect(said(log)).not.toContain(SECRET_WORDS);
    expect(said(log)).not.toContain("a guess at Layoffs");
    expect(log.filter((op) => op.undoes !== undefined).every((op) => op.withheld)).toBe(true);
  });

  it("serves a kept-out seat no words of a decline on the socket, as it is pushed", async () => {
    const { store, made } = withSuggestion();
    const live = liveProtocol({ store, seatOf: (key) => (key === "ada" ? viewer : keeper) });
    const texts: string[] = [];
    const peer: LivePeer = { ...live.open("ada", "web"), send: (text) => void texts.push(text) };
    await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    texts.length = 0;
    const before = store.log.all().length;
    declineSuggestion(store, made.id, { author: keeper });
    live.publish(store.log.all().slice(before), [peer]);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.join("\n")).not.toContain(SECRET_WORDS);
    expect(texts.join("\n")).not.toContain("a guess at Layoffs");
  });

  it("withholds down the chain, so an undo of that undo says nothing either", () => {
    const { store, made } = withSuggestion();
    const declined = declineSuggestion(store, made.id, { author: keeper });
    expect(declined).toBeDefined();
    const undo = store.log.all().find((op) => op.undoes === made.id)!;
    store.undo(undo.batch!, { author: keeper });
    expect(said(store.seenBy(viewer).log.all())).not.toContain(SECRET_WORDS);
  });

  it("serves no hidden field's value in a suggestion waiting, or in its decline", () => {
    const fieldPolicy: Policy = { grants: [{ roles: ["keeper"], mutations: "*" }], sees: [{ roles: ["keeper"], kinds: ["task", "secret"] }, { roles: ["viewer"], kinds: ["task"], hide: ["salary"] }] };
    const edit = defineMutation("edit-task", {
      title: "Edit",
      input: z.object({ id: z.string(), salary: z.string() }),
      describe: (args) => `Changed the salary of Plan to “${args.salary}”`,
      apply(ctx, args) {
        ctx.patchNode(args.id as never, { salary: args.salary } as never);
      },
    });
    const store = new Store({ schema, mutations: [addTask, edit], policy: fieldPolicy, snapshot: { nodes: [], edges: [] } as never });
    store.apply({ name: "add-task", args: { id: "t1", label: "Plan" } }, { author: keeper });
    const made = suggest(store, [{ name: "edit-task", args: { id: "t1", salary: "120000" } }], { author: actor, lineage: { basis: "a guess", confidence: 0.6 } })!;
    expect(said(store.seenBy(viewer).log.all())).not.toContain("120000");
    declineSuggestion(store, made.id, { author: keeper });
    expect(said(store.seenBy(viewer).log.all())).not.toContain("120000");
    expect(said(store.seenBy(keeper).log.all())).toContain("120000");
  });

  it("still tells a seat that may see the record what was declined", () => {
    const { store, made } = withSuggestion();
    declineSuggestion(store, made.id, { author: keeper });
    expect(said(store.seenBy(keeper).log.all())).toContain(SECRET_WORDS);
  });

  it("refuses a reader's undo of a suggestion they may not make, and it keeps waiting for the keeper", () => {
    const { store, made } = withSuggestion();
    expect(store.mayUndo(made.batch!, reader).ok).toBe(false);
    expect(() => store.undo(made.batch!, { author: reader })).toThrow();
    expect(suggestions(store, keeper).length).toBe(1);
  });

  it("refuses it on the socket too", async () => {
    const { store, made } = withSuggestion();
    const live = liveProtocol({ store, seatOf: () => reader });
    const texts: string[] = [];
    const peer: LivePeer = { ...live.open("rex", "web"), send: (text) => void texts.push(text) };
    await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    texts.length = 0;
    await live.receive(peer, JSON.stringify({ t: "undo", cid: "u1", batches: [made.batch] }));
    expect(texts.join("\n")).toContain("refused");
    expect(suggestions(store, keeper).length).toBe(1);
  });

  it("lets who may make the change decide, and the maker take it back", () => {
    const { store, made } = withSuggestion();
    expect(store.mayUndo(made.batch!, keeper).ok).toBe(true);
    expect(store.mayUndo(made.batch!, actor).ok).toBe(true);
  });

  it("leaves a seat that may not make the change its vote", () => {
    const { store, made } = withSuggestion();
    expect(declineSuggestion(store, made.id, { author: reader }).voted).toBe("against");
    expect(suggestions(store, keeper).length).toBe(1);
  });
});
