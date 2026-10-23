import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, FieldRevisions, Store, type AnySchema, type Principal } from "@graview/core";
import { pastOf } from "@graview/core/past";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveProtocol, openStore } from "../../src/index.js";

/**
 * A WRITE IS ALWAYS JUDGED AT THE HEAD (Roadmap f-1-0-publishing-hooks).
 * A seat may be served behind the store's head — a reader served what was
 * published — and still write. Its stale-write check reads the head's
 * revisions: a field it read that nobody wrote since is not stale merely
 * because the seat's view stops early, and one somebody wrote after the
 * seat's view ends is a conflict that says the head's value.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const rename = defineMutation("rename", {
  title: "Rename a task",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Call it “${args.label}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const schema = createSchema([task]);
const policy = { grants: [{ roles: ["keeper"], mutations: ["rename"] }], sees: [{ roles: ["keeper"], kinds: ["task"] }] };
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: ["keeper"] };

/** Two tasks; Sam renames the first, then — after Kim's view ends — the second. */
function twoRenames() {
  const store = new Store({
    schema,
    mutations: [rename],
    policy,
    snapshot: { nodes: [{ id: "t0", kind: "task", label: "Hall" }, { id: "t1", kind: "task", label: "Flowers" }], edges: [] } as never,
    now: () => "2026-10-22T00:00:00.000Z",
  });
  store.apply({ name: "rename", args: { id: "t0", label: "Book the hall" } }, { author: sam });
  store.apply({ name: "rename", args: { id: "t1", label: "Order the flowers" } }, { author: sam });
  // Kim is served through seq 1: Sam's first rename is in it, the second is not.
  const served = pastOf(store, 1).seenBy(kim);
  return { store, served, revisions: FieldRevisions.of(served.log.all()) };
}

const post = (store: Store<AnySchema>, id: string, label: string, rev: number, batch: string) =>
  liveProtocol({ store }).post(JSON.stringify({ calls: [{ name: "rename", args: { id, label } }], batch, base: [{ node: id, field: "label", rev }] }), { seat: kim, via: "web" });

describe("a write from a seat served behind the head", () => {
  it("is served behind the head: its view ends before the store's last op", () => {
    const { store, served } = twoRenames();
    expect(served.servedSeq).toBe(1);
    expect(store.servedSeq).toBe(2);
    expect(served.graph.getNode("t1")).toMatchObject({ label: "Flowers" });
  });

  it("is not stale for a field nobody wrote after the revision the seat read", async () => {
    const { store, revisions } = twoRenames();
    const answer = await post(store, "t0", "Book the barn", revisions.of("t0", "label"), "batch:kimtab:1");
    expect(answer.status).toBe(200);
    expect(store.graph.getNode("t0")).toMatchObject({ label: "Book the barn" });
  });

  it("is a conflict, saying the head's value, for a field written after the seat's view ends", async () => {
    const { store, revisions } = twoRenames();
    const answer = await post(store, "t1", "Order the tulips", revisions.of("t1", "label"), "batch:kimtab:2");
    expect(answer).toMatchObject({ status: 409, body: { conflict: true, conflicts: [{ node: "t1", field: "label", theirs: "Order the flowers", yours: "Order the tulips", by: "Sam", rev: 1, saw: -1 }] } });
    expect(store.graph.getNode("t1")).toMatchObject({ label: "Order the flowers" });
  });
});

describe("ship's compaction keeps a pinned seq", () => {
  it("stops the horizon at the pin a host passes, so the reader's past folds after the compaction", async () => {
    const app = defineApp({ name: "pins", schema, mutations: [rename] });
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: { nodes: [{ id: "t0", kind: "task", label: "Hall" }], edges: [] } as never });
    for (let n = 0; n < 8; n++) opened.store.apply({ name: "rename", args: { id: "t0", label: `Hall ${n}` } });
    await opened.flush();
    const compaction = await opened.compact({ seq: 7, pins: [3] });
    expect(compaction.horizon).toBe(3);
    expect(pastOf(opened.store, 3).graph.getNode("t0")).toMatchObject({ label: "Hall 2" });
    opened.close();
  });
});
