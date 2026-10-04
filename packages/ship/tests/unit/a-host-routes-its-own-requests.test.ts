import { createSchema, defineApp, defineMutation, defineNode, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, type LimitAnswer } from "../../src/runtime.js";

/**
 * A HOST THAT ROUTES ITS OWN REQUESTS ANSWERS `POST /graview/ops` AS SHIP DOES.
 *
 * What the route does — a batch sent again answered once, a stale write a
 * conflict, the host's limit, a refusal's reason, the ops as the seat may
 * see them — lived only inside `createStoreHandler`, so a host that keeps
 * its own routing (Graview Cloud's worker) lost idempotency and conflicts
 * the moment it routed a request itself. `liveProtocol(...).post(body,
 * asked)` is that route as a function, and the handler's route is it: one
 * implementation, so the two answer every body the same.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const secret = defineNode("secret", { fields: z.object({ label: z.string().min(1) }) });
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
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
const hide = defineMutation("hide", {
  title: "Hide something",
  creates: ["secret"],
  input: z.object({ id: z.string() }),
  describe: () => "Hide something",
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "secret", label: "Hidden" });
  },
});
const schema = createSchema([task, secret]);
const policy = {
  grants: [{ roles: ["keeper"], mutations: ["add", "rename", "hide"] }],
  sees: [{ roles: ["keeper"], kinds: ["task"] }],
};
const app = defineApp({ name: "routes", schema, mutations: [add, rename, hide], policy, version: 3 });
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const viewer: Principal = { kind: "human", id: "vi", name: "Vi", roles: [] };

const aStore = () =>
  new Store({ schema, mutations: app.mutations ?? [], policy, snapshot: { nodes: [{ id: "t0", kind: "task", label: "Book the hall" }], edges: [] } as never, ids: (() => { let n = 0; return () => `op${++n}`; })(), now: () => "2026-10-03T00:00:00.000Z" });

/** Bodies in an order that meets every answer the route has. */
const SCRIPT: { seat: Principal; body: string; limit?: LimitAnswer }[] = [
  { seat: kim, body: JSON.stringify({ calls: [{ name: "add", args: { id: "t1", label: "One" } }], batch: "batch:kimtab:1" }) },
  { seat: kim, body: JSON.stringify({ calls: [{ name: "add", args: { id: "t1", label: "One" } }], batch: "batch:kimtab:1" }), limit: { retryAfter: 900 } },
  { seat: kim, body: JSON.stringify({ calls: [{ name: "add", args: { id: "t2", label: "Two" } }], batch: "batch:kimtab:2" }), limit: { retryAfter: 900, sentence: "Busy now." } },
  { seat: kim, body: JSON.stringify({ calls: [{ name: "add", args: { id: "t2", label: "Two" } }], batch: "batch:kimtab:2" }), limit: { refuse: "Too big." } },
  { seat: kim, body: JSON.stringify({ calls: [{ name: "add", args: { id: "t2", label: "Two" } }], batch: "batch:kimtab:2" }), limit: { unavailable: "Read-only for now." } },
  { seat: kim, body: JSON.stringify({ calls: [{ name: "rename", args: { id: "t0", label: "Book the church" } }], batch: "batch:kimtab:3", base: [{ node: "t0", field: "label", rev: -1 }] }) },
  { seat: kim, body: JSON.stringify({ calls: [{ name: "rename", args: { id: "t0", label: "Book the barn" } }], batch: "batch:kimtab:4", base: [{ node: "t0", field: "label", rev: -1 }] }) },
  { seat: viewer, body: JSON.stringify({ calls: [{ name: "add", args: { id: "t9", label: "Nope" } }], batch: "batch:vitab:1" }) },
  { seat: viewer, body: JSON.stringify({ calls: [{ name: "add", args: { id: "t9", label: "Nope" } }], batch: "batch:kimtab:1" }) },
  { seat: kim, body: JSON.stringify({ calls: [{ name: "hide", args: { id: "s1" } }], batch: "batch:kimtab:5" }) },
  { seat: kim, body: JSON.stringify({ undo: ["batch:kimtab:1"], batch: "undo:kimtab:6" }) },
  { seat: kim, body: "{ not json" },
];

describe("a host that routes its own requests", () => {
  it("answers POST /graview/ops through liveProtocol(...).post with the route's semantics", async () => {
    let now: LimitAnswer | undefined;
    const store = aStore();
    const live = liveProtocol({ store, version: 3, build: "b7", limit: () => now });
    const answers = [];
    for (const step of SCRIPT) {
      now = step.limit;
      answers.push(await live.post(step.body, { seat: step.seat, via: "api" }));
    }
    const [first, again, busy, capped, unavailable, mine, stale, forbidden, stolen, hidden, undone, garbled] = answers;
    expect(first).toMatchObject({ status: 200, body: { batch: "batch:kimtab:1", version: 3, build: "b7" } });
    expect(first!.landed).toHaveLength(1);
    // Sent again, answered with what it made, and the limit is not asked.
    expect(again).toMatchObject({ status: 200, body: first!.body });
    expect(again!.landed).toBeUndefined();
    expect(busy).toMatchObject({ status: 429, body: { error: "Busy now.", busy: true, retryAfter: 900 }, headers: { "retry-after": "1" } });
    expect(capped).toMatchObject({ status: 413, body: { refused: true, reason: "limit", error: "Too big." } });
    expect(unavailable).toMatchObject({ status: 503, body: { refused: true, reason: "unavailable" } });
    expect(mine!.status).toBe(200);
    expect(stale).toMatchObject({ status: 409, body: { refused: true, conflict: true, conflicts: [{ node: "t0", field: "label", theirs: "Book the church", yours: "Book the barn", by: "Kim" }] } });
    expect(forbidden).toMatchObject({ status: 409, body: { refused: true, reason: "forbidden" } });
    expect(stolen).toMatchObject({ status: 409, body: { refused: true, reason: "invalid" } });
    // An act that makes what its own seat may not see: the op goes back withheld.
    expect(hidden!.status).toBe(200);
    expect(JSON.stringify(hidden!.body)).not.toContain("s1");
    expect(undone).toMatchObject({ status: 200, body: { batch: "undo:kimtab:6" } });
    expect(garbled).toMatchObject({ status: 400, body: { reason: "invalid" } });
    expect(store.graph.getNode("t1")).toBeUndefined();
    expect(store.graph.getNode("t2")).toBeUndefined();
  });

  it("is the handler's route: every body is answered the same, status, body and headers", async () => {
    let now: LimitAnswer | undefined;
    const store = aStore();
    const live = liveProtocol({ store, version: 3, build: "b7", limit: () => now });
    const handler = await createStoreHandler({ app, store: aStore(), seatOf: (request) => (request.headers.get("x-who") === "vi" ? viewer : kim), build: "b7", limit: () => now });
    for (const step of SCRIPT) {
      now = step.limit;
      const own = await live.post(step.body, { seat: step.seat, via: "api" });
      const routed = await handler.handle(new Request("https://store.example/graview/ops", { method: "POST", headers: { "x-who": step.seat.id! }, body: step.body }));
      expect({ status: routed.status, body: await routed.json(), retryAfter: routed.headers.get("retry-after") ?? undefined }).toEqual({
        status: own.status,
        body: own.body,
        retryAfter: own.headers["retry-after"],
      });
    }
    // And the reads: the state and the ops since, as the seat sees them.
    const state = await handler.handle(new Request("https://store.example/graview/state", { headers: { "x-who": "kim" } }));
    expect(await state.json()).toEqual(live.state({ seat: kim, via: "api" }).body);
    const since = await handler.handle(new Request("https://store.example/graview/since?seq=1", { headers: { "x-who": "kim" } }));
    expect(await since.json()).toEqual(live.since(1, { seat: kim, via: "api" }).body);
    await handler.close();
  });
});
