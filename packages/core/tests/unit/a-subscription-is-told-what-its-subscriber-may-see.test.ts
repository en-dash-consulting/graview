import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { bindSchema, createSchema, defineNode, memorySubscriptions, nodeRef, Store, subscriberOf, type Operation, type Policy, type Principal } from "../../src/index.js";
import {
  matchSubscriptions,
  subscriptionProblem,
  subscriptionWords,
  watchSubscriptions,
  type Subscription,
  type SubscriptionMatch,
  type SubscriptionWhen,
} from "../../src/subscriptions.js";

/**
 * NOTIFY ME WHEN X HAPPENS (Roadmap f-notify-subscriptions). A person
 * subscribes once; every committed batch is judged as they may see it, and
 * a match is told once, with what changed. A change somebody else made is
 * news; one they made is not, unless they asked for their own too; and a
 * change to a record they cannot see is never told them at all.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean(), amount: z.number().optional(), secret: z.string().optional() }),
  plural: "Tasks",
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string(), secret: z.string().optional() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false, ...(args.secret ? { secret: args.secret } : {}) });
  },
});
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  describe: (args, graph) => `Mark “${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}” done`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const price = defineMutation("price", {
  title: "Price it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["amount"],
  input: z.object({ id: nodeRef(["task"]), amount: z.number() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { amount: args.amount });
  },
});
const keep = defineMutation("keep-secret", {
  title: "Keep a secret",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["secret"],
  input: z.object({ id: nodeRef(["task"]), secret: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { secret: args.secret });
  },
});
const policy: Policy = {
  grants: [{ roles: "*", mutations: "*" }],
  // A guest sees only the tasks they made; staff see every task, but not its secret.
  sees: [
    { roles: ["staff"], kinds: ["task"], hide: ["secret"] },
    { roles: ["guest"], kinds: ["task"], own: true },
    { roles: ["owner"], kinds: ["task"] },
  ],
};
const ana: Principal = { kind: "human", id: "ana", name: "Ana", roles: ["staff"] };
const ben: Principal = { kind: "human", id: "ben", name: "Ben", roles: ["staff"] };
const olga: Principal = { kind: "human", id: "olga", name: "Olga", roles: ["owner"] };
const gus: Principal = { kind: "human", id: "gus", name: "Gus", roles: ["guest"] };

function app() {
  const store = new Store({
    schema,
    mutations: [add, finish, price, keep],
    policy,
    snapshot: { nodes: [{ id: "task:milk", kind: "task", label: "Buy milk", done: false }] as never, edges: [] },
  });
  return store;
}

const sub = (who: Principal, when: SubscriptionWhen, more: Partial<Subscription> = {}): Subscription => ({ id: `sub-${JSON.stringify(when)}`, who, app: "chores", when, at: "2026-10-16T00:00:00.000Z", ...more });

/** The ops one apply landed, as a store's listener hears them. */
function landed(store: Store<typeof schema>, run: () => void): Operation[] {
  const heard: Operation[] = [];
  const off = store.subscribe((_diff, ops) => heard.push(...ops));
  run();
  off();
  return heard;
}

describe("a subscription", () => {
  it("to an act running is told once per batch, with the act, who ran it and what it changed", () => {
    const store = app();
    const ops = landed(store, () => store.apply({ name: "finish", args: { id: "task:milk" } }, { author: ben }));
    const matches = matchSubscriptions(store, ops, [sub(ana, { on: "act", act: "finish" }), sub(ana, { on: "act", act: "price" })]);
    expect(matches).toHaveLength(1);
    const [match] = matches as [SubscriptionMatch];
    expect(match.acts).toEqual(["finish"]);
    expect(match.byName).toBe("Ben");
    expect(match.said).toBe("Ben: Mark “Buy milk” done");
    expect(match.records).toEqual([{ id: "task:milk", kind: "task", label: "Buy milk", change: "changed", fields: [{ field: "done", words: "Done", before: false, after: true }] }]);
  });

  it("to an act on one record is told only when the act ran on that record", () => {
    const store = app();
    const other = store.apply({ name: "add-task", args: { label: "Walk the dog" } }, { author: ana }).diff.addedNodes[0]!.id;
    const on = sub(ana, { on: "act", act: "finish", record: "task:milk" });
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "finish", args: { id: other } }, { author: ben })), [on])).toEqual([]);
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "finish", args: { id: "task:milk" } }, { author: ben })), [on])).toHaveLength(1);
  });

  it("to a kind's records being added is told of the new record", () => {
    const store = app();
    const ops = landed(store, () => store.apply({ name: "add-task", args: { label: "Call the plumber" } }, { author: ben }));
    const [match] = matchSubscriptions(store, ops, [sub(ana, { on: "created", kind: "task" })]);
    expect(match?.records.map((record) => [record.label, record.change])).toEqual([["Call the plumber", "created"]]);
  });

  it("to a kind, or one record, changing is told of the change, and not of another record's", () => {
    const store = app();
    const other = store.apply({ name: "add-task", args: { label: "Walk the dog" } }, { author: ana }).diff.addedNodes[0]!.id;
    const ops = landed(store, () => store.apply({ name: "price", args: { id: other, amount: 12 } }, { author: ben }));
    expect(matchSubscriptions(store, ops, [sub(ana, { on: "changed", kind: "task" })])).toHaveLength(1);
    expect(matchSubscriptions(store, ops, [sub(ana, { on: "changed", record: "task:milk" })])).toEqual([]);
    expect(matchSubscriptions(store, ops, [sub(ana, { on: "changed", record: other })])[0]?.records[0]?.fields).toEqual([{ field: "amount", words: "Amount", after: 12 }]);
  });

  it("to a field reaching a value is told on the batch that made the condition true, and not again while it stays true", () => {
    const store = app();
    const reaches = sub(ana, { on: "reaches", kind: "task", condition: "amount > 100" });
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "price", args: { id: "task:milk", amount: 40 } }, { author: ben })), [reaches])).toEqual([]);
    const crossed = matchSubscriptions(store, landed(store, () => store.apply({ name: "price", args: { id: "task:milk", amount: 140 } }, { author: ben })), [reaches]);
    expect(crossed.map((match) => match.records[0]?.label)).toEqual(["Buy milk"]);
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "price", args: { id: "task:milk", amount: 150 } }, { author: ben })), [reaches])).toEqual([]);
    // A condition written in the app's own rule language reads a record's fields by name.
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "finish", args: { id: "task:milk" } }, { author: ben })), [sub(ana, { on: "reaches", kind: "task", condition: "done == true" })])).toHaveLength(1);
  });

  it("is not told of a change its subscriber made, unless they asked for their own too", () => {
    const store = app();
    const ops = landed(store, () => store.apply({ name: "finish", args: { id: "task:milk" } }, { author: ana }));
    expect(matchSubscriptions(store, ops, [sub(ana, { on: "changed", kind: "task" })])).toEqual([]);
    expect(matchSubscriptions(store, ops, [sub(ana, { on: "changed", kind: "task" }, { alsoMine: true })])).toHaveLength(1);
    // An agent acting for the subscriber is the subscriber.
    const agent: Principal = { kind: "agent", id: "claude", onBehalfOf: ana };
    const theirs = landed(store, () => store.apply({ name: "price", args: { id: "task:milk", amount: 3 } }, { author: agent }));
    expect(matchSubscriptions(store, theirs, [sub(ana, { on: "changed", kind: "task" })])).toEqual([]);
  });

  it("is never told of a change to a record its subscriber cannot see", () => {
    const store = app();
    // Gus is a guest: he sees only the tasks he made, and Buy milk is not one.
    const watching = [sub(gus, { on: "changed", kind: "task" }), sub(gus, { on: "act" }), sub(gus, { on: "created", kind: "task" }), sub(gus, { on: "reaches", kind: "task", condition: "done == true" })];
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "finish", args: { id: "task:milk" } }, { author: ben })), watching)).toEqual([]);
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "add-task", args: { label: "Staff only" } }, { author: ben })), watching)).toEqual([]);
    // Staff do see it, from the same batch.
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "price", args: { id: "task:milk", amount: 9 } }, { author: ben })), [sub(ana, { on: "changed", kind: "task" })])).toHaveLength(1);
  });

  it("neither says nor reads a field its subscriber's sight keeps from them", () => {
    const store = app();
    const ops = landed(store, () => store.apply({ name: "add-task", args: { label: "Pay the rent", secret: "the code is 1234" } }, { author: olga }));
    const [match] = matchSubscriptions(store, ops, [sub(ana, { on: "created", kind: "task" })]);
    expect(JSON.stringify(match)).not.toContain("1234");
    const id = match!.records[0]!.id;
    // A condition on a hidden field never holds for them.
    const reads = sub(ana, { on: "reaches", kind: "task", condition: "secret == 'open'" });
    expect(matchSubscriptions(store, landed(store, () => store.apply({ name: "keep-secret", args: { id, secret: "open" } }, { author: olga })), [reads])).toEqual([]);
  });

  it("names the subscriber's person, never the agent that made it", () => {
    expect(subscriberOf({ kind: "agent", id: "claude", session: "s", onBehalfOf: ana })).toEqual({ kind: "human", id: "ana", name: "Ana", roles: ["staff"] });
  });

  it("says what is wrong with a subscription that could never be told anything, and says a good one in words", () => {
    const store = app();
    expect(subscriptionProblem(store, { on: "created", kind: "chore" })).toMatch(/no kind "chore"/);
    expect(subscriptionProblem(store, { on: "act", act: "fly" })).toMatch(/no act "fly"/);
    expect(subscriptionProblem(store, { on: "reaches", kind: "task", condition: "done ==" })).toMatch(/does not read/);
    expect(subscriptionProblem(store, { on: "changed", record: "task:milk" })).toBeUndefined();
    expect(subscriptionWords(store, { when: { on: "changed", record: "task:milk" } })).toBe("When someone else changes “Buy milk”");
    expect(subscriptionWords(store, { when: { on: "created", kind: "task" } })).toBe("When someone else adds a task");
    expect(subscriptionWords(store, { when: { on: "act", act: "finish" }, alsoMine: true })).toBe("When anyone runs “Mark it done”");
  });

  it("is watched on a store: a commit by someone else calls the host's hook once, with what changed", async () => {
    const store = app();
    const subscriptions = memorySubscriptions();
    await subscriptions.add({ who: ana, app: "chores", when: { on: "changed", record: "task:milk" } });
    const told: SubscriptionMatch[] = [];
    const stop = watchSubscriptions(store, { subscriptions, onSubscriptionMatch: (match) => void told.push(match), app: "chores" });
    store.apply({ name: "finish", args: { id: "task:milk" } }, { author: ben });
    store.apply({ name: "price", args: { id: "task:milk", amount: 2 } }, { author: ana });
    stop();
    store.apply({ name: "price", args: { id: "task:milk", amount: 5 } }, { author: ben });
    expect(told.map((match) => match.intent)).toEqual(["Mark “Buy milk” done"]);
  });
});

describe("a subscriber whose roles changed since they subscribed", () => {
  it("is judged as the host says they are now, and told nothing once it no longer knows them", () => {
    const store = app();
    const added = store.apply({ name: "add-task", args: { label: "Gus's own" } }, { author: gus }).diff.addedNodes[0]!.id;
    const owned = sub(olga, { on: "changed", kind: "task" }, { alsoMine: true });
    const ops = landed(store, () => store.apply({ name: "keep-secret", args: { id: added, secret: "under the mat" } }, { author: olga }));
    // As she subscribed, an owner, Olga sees the secret; made a guest since, she sees none of Gus's tasks.
    expect(JSON.stringify(matchSubscriptions(store, ops, [owned]))).toContain("under the mat");
    expect(matchSubscriptions(store, ops, [owned], { subscriber: (who) => ({ ...who, roles: ["guest"] }) })).toEqual([]);
    expect(matchSubscriptions(store, ops, [owned], { subscriber: () => undefined })).toEqual([]);
    expect(matchSubscriptions(store, ops, [owned], { subscriber: (who) => who })).toHaveLength(1);
  });
});
