import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, nodeRef } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { openRemote, SEAT_HEADERS, serveStore, WIRE, type ServedStore } from "../../src/index.js";

/**
 * The hosted-store contract: what a host in front of `serveStore` must
 * keep answering for the framework's own clients to work unchanged, pinned
 * as a constant a README repeats and this test walks. And the seam a host's
 * own auth goes through — headers the framework carries and never reads.
 */

const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const finish = defineMutation("finish", {
  title: "Finish it",
  description: "Marks a task done.",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const schema = createSchema([task]);
const app = defineApp({
  name: "wired",
  schema,
  mutations: [finish],
  policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: ["finish"], describe: "The keeper finishes things." }] },
  version: 1,
});
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }], edges: [] };

let served: ServedStore<typeof schema> | undefined;
afterEach(async () => {
  await served?.close();
  served = undefined;
});

describe("the wire", () => {
  it("names every route the server answers, and each one answers", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    expect(WIRE.map((route) => route.path)).toEqual([
      "/graview/state",
      "/graview/ops",
      "/graview/since",
      "/graview/health",
      "/graview/export",
      "/graview/here",
      "/graview/who",
      "/graview/leave",
    ]);
    for (const route of WIRE) {
      const response = await fetch(`${served.url}${route.path}${route.path.endsWith("since") ? "?seq=-1" : ""}`, {
        method: route.method,
        headers: { "content-type": "application/json", [SEAT_HEADERS.seat]: "u1", [SEAT_HEADERS.roles]: "keeper" },
        ...(route.method === "POST"
          ? { body: JSON.stringify(route.path.endsWith("here") ? { presence: { participant: "human:u1:s", stop: "/" } } : {}) }
          : {}),
      });
      expect(response.status, `${route.method} ${route.path} — ${route.says}`).not.toBe(404);
    }
    // Something off the wire is a 404, so a host cannot mistake a typo for a route.
    expect((await fetch(`${served.url}/graview/nothing`)).status).toBe(404);
  });

  it("lets a host's own headers ride every request, and allows them across origins", async () => {
    const seen: string[] = [];
    served = await serveStore({
      app,
      adapter: createMemoryAdapter(),
      seed: seed as never,
      // A host's `seatOf`: the framework carries a bearer token; the host says who it is.
      seatOf: (request) => {
        seen.push(String(request.headers["authorization"] ?? ""));
        return request.headers["authorization"] === "Bearer keeper-key" ? { kind: "human", id: "k", roles: ["keeper"] } : { kind: "human" };
      },
    });
    // The browser's own store still judges locally as the keeper; the SERVER learns who from the token alone.
    const remote = await openRemote({
      app,
      url: served.url,
      headers: { authorization: "Bearer keeper-key" },
      principal: { kind: "human", id: "k", roles: ["keeper"] },
      pollMs: 0,
    });
    remote.store.apply({ name: "finish", args: { id: "t1" } });
    await remote.settled();
    expect(seen).toContain("Bearer keeper-key");
    expect((served.store.graph.getNode("t1") as { done: boolean }).done).toBe(true);
    remote.close();

    const preflight = await fetch(`${served.url}/graview/ops`, { method: "OPTIONS" });
    expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("settles: a host waits for the server's verdict, and a refusal is heard before it exits", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    const nobody = await openRemote({ app, url: served.url, pollMs: 0, principal: { kind: "human", id: "n" } });
    const refusals: string[] = [];
    nobody.onRefusal((reason) => refusals.push(reason));
    // The local store applies the optimism, the server refuses, and settled() outlasts the take-back.
    expect(() => nobody.store.apply({ name: "finish", args: { id: "t1" } })).toThrow(/Not permitted/);
    await nobody.settled();
    nobody.close();

    const keeper = await openRemote({ app, url: served.url, pollMs: 0, principal: { kind: "human", id: "k", roles: ["keeper"] } });
    keeper.onRefusal((reason) => refusals.push(reason));
    keeper.store.apply({ name: "finish", args: { id: "t1" } });
    await keeper.settled();
    expect(refusals).toEqual([]);
    expect(served.store.log.all().at(-1)?.author).toMatchObject({ id: "k" });
    keeper.close();
  });
});
