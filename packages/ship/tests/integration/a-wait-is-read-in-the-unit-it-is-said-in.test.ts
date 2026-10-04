import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, nodeRef, type Principal } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote, seatHeaders } from "../../src/index.js";

/**
 * A WAIT IS READ IN THE UNIT IT IS SAID IN (FR-45).
 *
 * A busy host answers `POST /graview/ops` with 429, a `Retry-After` header
 * — seconds, as HTTP says — and a JSON `retryAfter` that ship documents in
 * milliseconds. `openRemote` read the JSON first, so a host that put
 * seconds there too (Graview Cloud's room said `retryAfter: 2`) was asked
 * again two milliseconds later, a hundred times a second. Now the header is
 * read as HTTP says, seconds or a date; the JSON as milliseconds; and a JSON
 * wait under 50 beside a header is taken for seconds said in the wrong
 * place, and the header wins.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }), plural: "Tasks", label: (node) => node.label });
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  describe: (args) => `Rename to “${args.label}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({ name: "waited", schema: createSchema([task]), mutations: [rename], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall" }], edges: [] };
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: ["keeper"] };

afterEach(() => {
  vi.useRealTimers();
});

/** How long the client waits after one 429 that says `json` in its body and `header` as Retry-After. */
async function waitAfter(json: number | undefined, header: string | undefined): Promise<number> {
  const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
  let busy = 1;
  const posts: number[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    if (url.endsWith("/graview/ops")) {
      posts.push(Date.now());
      if (busy-- > 0) {
        return new Response(JSON.stringify({ error: "The room is busy.", busy: true, ...(json !== undefined ? { retryAfter: json } : {}) }), {
          status: 429,
          headers: { "content-type": "application/json", ...(header !== undefined ? { "retry-after": header } : {}) },
        });
      }
    }
    return handler.handle(new Request(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...seatHeaders(sam) } }));
  }) as typeof globalThis.fetch;
  const remote = await openRemote({ app, url: "http://room.example", principal: sam, pollMs: 0, fetch });
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
  for (let step = 0; step < 400 && posts.length < 2; step++) await vi.advanceTimersByTimeAsync(10);
  vi.useRealTimers();
  await remote.settled();
  expect(handler.store.graph.getNode("t1")).toMatchObject({ label: "Book the big hall" });
  remote.close();
  await handler.close();
  return posts[1]! - posts[0]!;
}

describe("a wait is read in the unit it is said in", () => {
  it("reads Retry-After as seconds, and a JSON retryAfter under 50 beside it as the same seconds said in the wrong place", async () => {
    // Graview Cloud's room: `retryAfter: 2` meaning two seconds, and the header saying so.
    const waited = await waitAfter(2, "2");
    expect(waited).toBeGreaterThanOrEqual(2000);
    expect(waited).toBeLessThan(2100);
  });

  it("reads a JSON retryAfter as milliseconds, as ship's own handler says it", async () => {
    // Ship's handler: 1500 ms in the body, rounded up to 2 s in the header. The body is the finer word.
    const waited = await waitAfter(1500, "2");
    expect(waited).toBeGreaterThanOrEqual(1500);
    expect(waited).toBeLessThan(1600);
    // A short wait: 30 in the body, rounded up to 1 in the header. Thirty milliseconds, not a second.
    const short = await waitAfter(30, "1");
    expect(short).toBeGreaterThanOrEqual(30);
    expect(short).toBeLessThan(100);
  });

  it("reads Retry-After alone as seconds, or as an HTTP date", async () => {
    expect(await waitAfter(undefined, "1")).toBeGreaterThanOrEqual(1000);
    const date = await waitAfter(undefined, new Date(Date.now() + 3000).toUTCString());
    expect(date).toBeGreaterThanOrEqual(1000);
    expect(date).toBeLessThanOrEqual(3100);
  });
});
