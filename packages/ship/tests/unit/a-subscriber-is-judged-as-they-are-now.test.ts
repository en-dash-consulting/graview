import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, type Principal, type SubscriptionMatch } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { serveStore, type ServedStore } from "../../src/index.js";

/**
 * A SUBSCRIBER IS JUDGED AS THEY ARE NOW (Roadmap f-notify-subscriptions).
 * A subscription keeps the person who asked for it as they were then,
 * roles and all. Ana subscribed to the notes while she was staff; the host
 * then made her a guest, and her own reads stopped showing the notes — but
 * a change to one was still judged with her old roles, and the door code
 * handed to the host's hook, which turns it into an email. A host that
 * says who a subscriber is now (`subscriberNow`) has every commit judged
 * as that person is now, and nobody told who no longer resolves; a host
 * that cannot say is judged with the person as they subscribed.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Tasks" });
const note = defineNode("note", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Notes" });
const schema = createSchema([task, note]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task", "note"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task", "note"]) }),
  describe: (args, graph) => `Mark “${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}” done`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const app = defineApp({
  name: "chores",
  schema,
  mutations: [finish],
  policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: "*", kinds: ["task"] }, { roles: ["staff"], kinds: ["note"] }] },
  version: 1,
});
const seed = {
  nodes: [
    { id: "task:milk", kind: "task", label: "Buy milk", done: false },
    { id: "note:door", kind: "note", label: "The door code 4711", done: false },
  ],
  edges: [],
};

let served: ServedStore<typeof schema> | undefined;
afterEach(async () => {
  await served?.close();
  served = undefined;
});

/** The host's directory: who each person is now, by the key their request carries. */
function directory() {
  const people = new Map<string, Principal>([
    ["ana", { kind: "human", id: "ana", name: "Ana", roles: ["staff"] }],
    ["ben", { kind: "human", id: "ben", name: "Ben", roles: ["staff"] }],
  ]);
  const seatOf = (request: Request): Principal => people.get(request.headers.get("x-key") ?? "") ?? { kind: "human", id: "nobody", roles: [] };
  return { people, seatOf };
}
const call = (key: string, path: string, body: unknown) => fetch(`${served!.url}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-key": key }, body: JSON.stringify(body) });
const settle = () => new Promise((done) => setTimeout(done, 20));

async function demoted(subscriberNow?: (who: Principal) => Principal | undefined | Promise<Principal | undefined>) {
  const { people, seatOf } = directory();
  const told: SubscriptionMatch[] = [];
  served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf, onSubscriptionMatch: (match) => void told.push(match), typingQuietMs: 0, ...(subscriberNow ? { subscriberNow: (who: Principal) => subscriberNow(who) } : {}) });
  expect((await call("ana", "/graview/subscriptions", { add: { when: { on: "changed", kind: "note" } } })).status).toBe(201);
  people.set("ana", { kind: "human", id: "ana", name: "Ana", roles: ["guest"] });
  const state = await (await fetch(`${served.url}/graview/state`, { headers: { "x-key": "ana" } })).text();
  expect(state).not.toContain("4711");
  return { people, told };
}

describe("a subscriber the host demoted after they subscribed", () => {
  it("is not told of a change to a record they may no longer see, where the host says who they are now", async () => {
    let people: Map<string, Principal> | undefined;
    const now = await demoted((who) => people?.get(who.id!));
    people = now.people;
    expect((await call("ben", "/graview/ops", { calls: [{ name: "finish", args: { id: "note:door" } }] })).status).toBe(200);
    await settle();
    expect(JSON.stringify(now.told)).not.toContain("4711");
    expect(now.told).toEqual([]);
  });

  it("is told, as they are now, of a change to a record they still see", async () => {
    const { people, seatOf } = directory();
    const told: SubscriptionMatch[] = [];
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf, onSubscriptionMatch: (match) => void told.push(match), subscriberNow: async (who) => people.get(who.id!) });
    expect((await call("ana", "/graview/subscriptions", { add: { when: { on: "changed", kind: "task" } } })).status).toBe(201);
    people.set("ana", { kind: "human", id: "ana", name: "Ana", roles: ["guest"] });
    expect((await call("ben", "/graview/ops", { calls: [{ name: "finish", args: { id: "task:milk" } }] })).status).toBe(200);
    await settle();
    expect(told.map((match) => [match.subscription.who.roles, match.records.map((record) => record.id)])).toEqual([[["guest"], ["task:milk"]]]);
  });

  it("is told nothing once the host no longer knows them", async () => {
    const { told } = await demoted((who) => (who.id === "ana" ? undefined : who));
    expect((await call("ben", "/graview/ops", { calls: [{ name: "finish", args: { id: "note:door" } }] })).status).toBe(200);
    await settle();
    expect(told).toEqual([]);
  });
});
