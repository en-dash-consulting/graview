import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, VOTE_SUGGESTION, type Author, type Principal } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler } from "../../src/runtime.js";

/**
 * A STRANGER'S VOTE OVER THE WIRE IS REFUSED UNLESS THE HOST KEEPS IT
 * ADVISORY (Roadmap f-votes-shared-seat). On 0.1.62 a host serving every
 * signed-out visitor as one `anonymous` seat took a stranger's
 * `POST /graview/ops` as that seat's one vote, which the next stranger
 * flipped. The store refuses it, so the wire does: a seat the host's
 * `seatOf` marks `shared` is told "Sign in to vote on this suggestion".
 * With `votes: { advisory: "visitors" }` and a `visitorKey` per visitor,
 * each stranger's vote is kept as their own, apart from the people's.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const app = defineApp({ name: "votes", schema, mutations: [finish], policy: { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }], edges: [] };
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const anonymous: Principal = { kind: "human", id: "anonymous", roles: ["reader"], shared: true };
const post = (suggestion: string, cookie?: string) =>
  new Request("https://store.example/graview/ops", { method: "POST", ...(cookie ? { headers: { cookie } } : {}), body: JSON.stringify({ calls: [{ name: VOTE_SUGGESTION, args: { suggestion, vote: "for" } }] }) });
const seatOf = (request: Request): Principal => {
  const key = request.headers.get("cookie");
  return key ? { ...anonymous, visitorKey: key } : anonymous;
};

describe("a vote from the host's shared signed-out seat, over the wire", () => {
  it("is refused in words, and nothing is kept", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf });
    const op = suggest(handler.store, [{ name: "finish", args: { id: "t1" } }], { author: actor, lineage: { basis: "It was booked by phone", confidence: 0.5 } })!;
    const response = await handler.handle(post(op.id, "visitor-a"));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(await response.json())).toContain("Sign in to vote on this suggestion.");
    expect(handler.store.log.all().some((one) => one.vote !== undefined)).toBe(false);
    await handler.close();
  });

  it("is kept as each visitor's own advisory vote where the host says so", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf, votes: { advisory: "visitors" } });
    const op = suggest(handler.store, [{ name: "finish", args: { id: "t1" } }], { author: actor, lineage: { basis: "It was booked by phone", confidence: 0.5 } })!;
    // A shared seat naming no visitor still is not anybody.
    expect((await handler.handle(post(op.id))).status).toBeGreaterThanOrEqual(400);
    expect((await handler.handle(post(op.id, "visitor-a"))).status).toBe(200);
    expect((await handler.handle(post(op.id, "visitor-b"))).status).toBe(200);
    const tally = suggestions(handler.store, { ...anonymous, visitorKey: "visitor-c" })[0]!.tally;
    expect(tally).toEqual({ for: 0, against: 0, advisory: { for: 2, against: 0 } });
    await handler.close();
  });
});
