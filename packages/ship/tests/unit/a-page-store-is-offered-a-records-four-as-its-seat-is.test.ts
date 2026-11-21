import { createSchema, defineApp, defineNode, offersTouches, Store, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote } from "../../src/index.js";

/**
 * A PAGE'S STORE IS OFFERED A RECORD'S FOUR AS ITS SEAT IS (Graview HQ
 * feature:f-record-last-touched): a store a page opens over what its seat is
 * served acts as that seat and is never read as the host's own, so a seat
 * told none of the four is offered none of them, though nothing it was
 * served yet says so; it answers as its server says, never by the policy
 * the page holds.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), note: z.string().optional() }) });
const schema = createSchema([task]);
const policy: Policy = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["task"] }, { roles: ["guest"], kinds: ["task"], hide: ["note"] }] } as never;
const app = defineApp({ name: "four", schema, mutations: [], policy, version: 1 });
const ann: Principal = { kind: "human", id: "ann", roles: ["member"] };
const gus: Principal = { kind: "human", id: "gus", roles: ["guest"] };

async function pageOf(seat: Principal, page: typeof app = app) {
  // Seeded, and nothing in its log yet: no op it serves says it stamps nothing.
  const store = new Store({ schema, policy, snapshot: { nodes: [{ id: "task:a", kind: "task", label: "A", note: "kept" }], edges: [] } as never });
  const handler = await createStoreHandler({ app, store, seatOf: () => seat });
  const fetcher = (async (url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
  return openRemote({ app: page, url: "https://store.example", principal: seat, fetch: fetcher, pollMs: 0 });
}

describe("a page's store", () => {
  it("over a seeded host with nothing in its log offers the four to a seat told them, and none to one told none", async () => {
    const told = await pageOf(ann);
    const untold = await pageOf(gus);
    expect(offersTouches(told.store as never)).toBe(true);
    expect(offersTouches(untold.store as never)).toBe(false);
    told.close();
    untold.close();
  });

  it("answers as its server says of its seat, never by the policy the page holds", async () => {
    // The page's own copy of the app keeps nothing from anyone; the server's keeps a field from a guest.
    const open = defineApp({ name: "four", schema, mutations: [], version: 1 });
    const untold = await pageOf(gus, open as never);
    expect(offersTouches(untold.store as never)).toBe(false);
    untold.close();
  });
});
