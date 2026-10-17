import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, type Principal, type SubscriptionMatch } from "@graview/core";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { fileSubscriptions, remoteSubscriptions, SEAT_HEADERS, serveStore, type ServedStore } from "../../src/index.js";

/**
 * NOTIFY ME, SERVED (Roadmap f-notify-subscriptions). A served app judges
 * every commit against the subscriptions it keeps and hands each match to
 * its host's hook, once per batch, as the subscriber may see it — a change
 * by somebody else to a record they can see, and never one to a record
 * they cannot. A seat keeps and reads its own at `/graview/subscriptions`.
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
  // Everybody sees the tasks; only staff see the notes.
  policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: "*", kinds: ["task"] }, { roles: ["staff"], kinds: ["note"] }] },
  version: 1,
});
const seed = {
  nodes: [
    { id: "task:milk", kind: "task", label: "Buy milk", done: false },
    { id: "note:door", kind: "note", label: "The door code", done: false },
  ],
  edges: [],
};
const ana: Principal = { kind: "human", id: "ana", name: "Ana", roles: ["guest"] };
const ben: Principal = { kind: "human", id: "ben", name: "Ben", roles: ["staff"] };
const as = (seat: Principal) => ({ "content-type": "application/json", [SEAT_HEADERS.seat]: seat.id!, [SEAT_HEADERS.roles]: (seat.roles ?? []).join(","), [SEAT_HEADERS.name]: seat.name! });

let served: ServedStore<typeof schema> | undefined;
let dir: string | undefined;
afterEach(async () => {
  await served?.close();
  served = undefined;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const post = (seat: Principal, calls: unknown[]) => fetch(`${served!.url}/graview/ops`, { method: "POST", headers: as(seat), body: JSON.stringify({ calls }) });

describe("a served app's subscriptions", () => {
  it("call the host's hook once for a matching change by someone else, and never for a record the subscriber cannot see", async () => {
    const told: SubscriptionMatch[] = [];
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true, onSubscriptionMatch: (match) => void told.push(match) });
    const mine = remoteSubscriptions({ url: served.url, principal: ana });
    const kept = await mine.add({ who: ana, app: "chores", when: { on: "act", act: "finish" } });
    expect(kept.who.id).toBe("ana");

    expect((await post(ben, [{ name: "finish", args: { id: "note:door" } }])).status).toBe(200);
    expect((await post(ben, [{ name: "finish", args: { id: "task:milk" } }])).status).toBe(200);
    await new Promise((settle) => setTimeout(settle, 20));
    expect(told.map((match) => [match.subscription.id, match.said, match.records.map((record) => record.id)])).toEqual([[kept.id, "Ben: Mark “Buy milk” done", ["task:milk"]]]);
  });

  it("keeps each seat's own: listed, refused when it could never be told anything, and taken away only by its person", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const anas = remoteSubscriptions({ url: served.url, principal: ana });
    const bens = remoteSubscriptions({ url: served.url, principal: ben });
    const kept = await anas.add({ who: ana, app: "chores", when: { on: "changed", record: "task:milk" } });
    expect((await anas.list()).map((one) => one.id)).toEqual([kept.id]);
    expect(await bens.list()).toEqual([]);
    // A record Ana cannot see is not one she can be told about — and the answer is the same as for one that is not there.
    await expect(anas.add({ who: ana, app: "chores", when: { on: "changed", record: "note:door" } })).rejects.toThrow(/No record "note:door"/);
    await expect(anas.add({ who: ana, app: "chores", when: { on: "created", kind: "chore" } })).rejects.toThrow(/no kind "chore"/);
    expect(await bens.remove(kept.id)).toBe(false);
    expect(await anas.remove(kept.id)).toBe(true);
    expect(await anas.list()).toEqual([]);
    // A seat the store knows by no id has nobody to tell.
    const nobody = await fetch(`${served.url}/graview/subscriptions`, { method: "POST", headers: { "content-type": "application/json", [SEAT_HEADERS.roles]: "guest" }, body: JSON.stringify({ add: { when: { on: "created", kind: "task" } } }) });
    expect(nobody.status).toBe(403);
  });

  it("are kept in a file beside the store, which another process on the same store reads", async () => {
    dir = mkdtempSync(join(tmpdir(), "graview-subscriptions-"));
    const path = join(dir, "chores", "subscriptions.json");
    const one = fileSubscriptions(path);
    const kept = await one.add({ who: ana, app: "chores", when: { on: "created", kind: "task" } });
    expect(JSON.parse(readFileSync(path, "utf8")).subscriptions[0].id).toBe(kept.id);
    // A second reader of the same file — `graview serve` beside `graview mcp`.
    const other = fileSubscriptions(path);
    expect((await other.list("ana")).map((sub) => sub.id)).toEqual([kept.id]);
    expect(await other.remove(kept.id)).toBe(true);
    expect(await one.list()).toEqual([]);
  });
});
