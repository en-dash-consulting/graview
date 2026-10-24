import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, markdownField, memorySubscriptions, nodeRef, PUBLISH, Store, TYPE_TEXT, type Operation, type Principal, type Publishing } from "../../src/index.js";
import "../../src/publishing.js";
import "../../src/typing.js";
import { holdTypingRuns, matchSubscriptions, watchSubscriptions, type Subscription, type SubscriptionMatch, type SubscriptionWhen } from "../../src/subscriptions.js";

/**
 * A READER IS TOLD WHEN IT IS PUBLISHED (FR-206). In an app that publishes
 * on publish, a reader — a seat of no working role — is served the app as
 * it stood at the last publish, and a notification may tell it no more than
 * that: a change a collaborator makes is held from the reader until it is
 * published, and told then, as the published app says it. A collaborator is
 * told at once, as before; a run of typing is held for a reader the same way.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean(), notes: markdownField().optional() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false } as never);
  },
});
const rename = defineMutation("rename-task", {
  title: "Rename the task",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});

const eve: Principal = { kind: "human", id: "eve", name: "Eve", roles: ["editor"] };
const wes: Principal = { kind: "human", id: "wes", name: "Wes", roles: ["editor"] };
const rae: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
const publishing: Publishing = { mode: "on-publish", working: ["editor"] };

function app() {
  return new Store({
    schema,
    mutations: [add, rename, finish],
    policy: { grants: [{ roles: ["editor"], mutations: "*" }] },
    publishing,
    snapshot: { nodes: [{ id: "task:milk", kind: "task", label: "Buy milk", done: false, notes: "Two quarts" }], edges: [] } as never,
  });
}

const sub = (who: Principal, when: SubscriptionWhen): Subscription => ({ id: `${who.id}-${JSON.stringify(when)}`, who, app: "chores", when, at: "2026-10-24T00:00:00.000Z" });

/** The ops one apply landed, as a store's listener hears them. */
function landed(store: Store<typeof schema>, run: () => void): Operation[] {
  const heard: Operation[] = [];
  const off = store.subscribe((_diff, ops) => heard.push(...ops));
  run();
  off();
  return heard;
}
const publish = (store: Store<typeof schema>) => landed(store, () => store.apply({ name: PUBLISH, args: {} } as never, { author: eve }));

describe("a reader of an app that publishes", () => {
  afterEach(() => vi.useRealTimers());

  it("is told nothing of a change until it is published, and of it then", () => {
    const store = app();
    const subscriptions = [sub(rae, { on: "changed", record: "task:milk" }), sub(wes, { on: "changed", record: "task:milk" })];
    const patched = landed(store, () => store.apply({ name: "rename-task", args: { id: "task:milk", label: "Buy oat milk" } }, { author: eve }));
    // The collaborator hears at once; the reader hears nothing of a record it is still served as it was.
    expect(matchSubscriptions(store, patched, subscriptions).map((match) => match.subscription.who.id)).toEqual(["wes"]);
    const told = matchSubscriptions(store, publish(store), subscriptions);
    expect(told.map((match) => match.subscription.who.id)).toEqual(["rae"]);
    expect(told[0]!.said).toBe(`Eve: ${patched[0]!.intent}`);
    expect(told[0]!.records).toEqual([{ id: "task:milk", kind: "task", label: "Buy oat milk", change: "changed", fields: [{ field: "label", words: "Name", before: "Buy milk", after: "Buy oat milk" }] }]);
    // Published once is told once: a publish of nothing new tells nobody anything.
    expect(matchSubscriptions(store, publish(store), subscriptions)).toEqual([]);
  });

  it("is told each batch a publish brings, in order, each by who made it", () => {
    const store = app();
    const subscriptions = [sub(rae, { on: "created", kind: "task" })];
    const made = landed(store, () => store.apply({ name: "add-task", args: { label: "Call the plumber" } }, { author: eve }));
    landed(store, () => store.apply({ name: "add-task", args: { label: "Walk the dog" } }, { author: wes }));
    expect(matchSubscriptions(store, made, subscriptions)).toEqual([]);
    const told = matchSubscriptions(store, publish(store), subscriptions);
    expect(told.map((match) => [match.byName, match.records.map((record) => record.label)])).toEqual([
      ["Eve", ["Call the plumber"]],
      ["Wes", ["Walk the dog"]],
    ]);
  });

  it("is told nothing of a change taken back before it was published", () => {
    const store = app();
    const subscriptions = [sub(rae, { on: "changed", record: "task:milk" })];
    const renamed = store.apply({ name: "rename-task", args: { id: "task:milk", label: "Buy oat milk" } }, { author: eve });
    store.undo(renamed.batch, { author: eve });
    expect(matchSubscriptions(store, publish(store), subscriptions)).toEqual([]);
  });

  it("is told a condition reached as the published app says it", () => {
    const store = app();
    const subscriptions = [sub(rae, { on: "reaches", kind: "task", condition: "done == true" })];
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "finish", args: { id: "task:milk" } }, { author: eve })), subscriptions)).toEqual([]);
    expect(matchSubscriptions(store, publish(store), subscriptions).map((match) => match.records.map((record) => record.label))).toEqual([["Buy milk"]]);
  });

  it("hears a run of typing once it is published, held and told as one", () => {
    vi.useFakeTimers();
    const store = app();
    const told: SubscriptionMatch[] = [];
    const held = holdTypingRuns((match) => void told.push(match), { quietMs: 1000 });
    const subscriptions = [sub(rae, { on: "changed", record: "task:milk" })];
    const type = (at: number, insert: string) =>
      landed(store, () => store.apply({ name: TYPE_TEXT, args: { node: "task:milk", field: "notes", at, remove: 0, insert } }, { author: eve }));
    for (const match of matchSubscriptions(store, type(10, ", oat"), subscriptions)) held.tell(match);
    for (const match of matchSubscriptions(store, type(15, " please"), subscriptions)) held.tell(match);
    vi.advanceTimersByTime(5000);
    expect(told).toEqual([]);
    for (const match of matchSubscriptions(store, publish(store), subscriptions)) held.tell(match);
    vi.advanceTimersByTime(1000);
    expect(told.map((match) => match.said)).toEqual(["Eve wrote in Buy milk's notes (+12)"]);
    expect(told[0]!.batches).toHaveLength(2);
  });

  it("is told through watchSubscriptions at the publish, not at the edit", () => {
    const store = app();
    const told: SubscriptionMatch[] = [];
    const stop = watchSubscriptions(store, { subscriptions: memorySubscriptions([sub(rae, { on: "changed", kind: "task" })]), onSubscriptionMatch: (match) => void told.push(match), typingQuietMs: 0 });
    store.apply({ name: "rename-task", args: { id: "task:milk", label: "Buy oat milk" } }, { author: eve });
    expect(told).toEqual([]);
    store.apply({ name: PUBLISH, args: {} } as never, { author: eve });
    expect(told.map((match) => match.records[0]!.label)).toEqual(["Buy oat milk"]);
    stop();
  });
});
