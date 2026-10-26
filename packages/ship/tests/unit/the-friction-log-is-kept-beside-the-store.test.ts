import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, recordFriction, type Principal } from "@graview/core";
import { frictionEvent, type FrictionEvent } from "@graview/core/friction";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { browserFriction, FRICTION_PATH, fileFriction, openRemote, remoteFriction, SEAT_HEADERS, seatHeaders, serveStore, type ServedStore } from "../../src/index.js";

/*
 * THE FRICTION LOG, KEPT BESIDE THE STORE (Roadmap f-friction-log): a door
 * on the server a page posts what somebody could not do to — its author
 * the session's, as an act's is, never the body's — capped in size and
 * rate; read back as the asker's own events and the counts across people;
 * kept in a file of its own by `graview serve`, in a browser's storage by a
 * page that holds its own store; and never a visitor's.
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
const app = defineApp({ name: "friction", schema, mutations: [finish], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: ["finish"] }] }, version: 1 });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }], edges: [] };

const ada: Principal = { kind: "human", id: "ada", roles: ["keeper"] };
const bo: Principal = { kind: "human", id: "bo", roles: ["keeper"] };
const cy: Principal = { kind: "human", id: "cy", roles: ["keeper"] };
const guest: Principal = { kind: "visitor", id: "visitor:rsvp:1" };

let served: ServedStore<typeof schema> | undefined;
afterEach(async () => {
  await served?.close();
  served = undefined;
});

const post = (url: string, seat: Principal, body: unknown) =>
  fetch(`${url}${FRICTION_PATH}`, { method: "POST", headers: { "content-type": "application/json", ...seatHeaders(seat) }, body: typeof body === "string" ? body : JSON.stringify(body) });
const read = async (url: string, seat: Principal) => (await (await fetch(`${url}${FRICTION_PATH}`, { headers: seatHeaders(seat) })).json()) as { mine: FrictionEvent[]; counts: { people: number; searches: { words: string; people: number }[] } };

describe("the friction log on the server", () => {
  it("takes the author from the session as an act's is, never from the body", async () => {
    const kept: FrictionEvent[] = [];
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true, friction: { add: (event) => void kept.push(event), list: () => kept } });
    const answer = await post(served.url, ada, { event: { type: "search-miss", words: "invoice", by: { kind: "human", id: "bo" } } });
    expect(answer.status).toBe(201);
    expect(kept.map((event) => event.by)).toEqual([{ kind: "human", id: "ada" }]);
  });

  it("a person reads only their own events and the counts", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    await post(served.url, ada, { event: { type: "search-miss", words: "invoice" } });
    await post(served.url, bo, { event: { type: "search-miss", words: "Invoice" } });
    await post(served.url, cy, { event: { type: "search-miss", words: "invoice" } });
    await post(served.url, bo, { event: { type: "search-miss", words: "bo's own private words" } });
    const asAda = await read(served.url, ada);
    expect(asAda.mine.map((event) => event.type === "search-miss" && event.words)).toEqual(["invoice"]);
    // The counts are of everybody but the asker: Bo and Cy.
    expect(asAda.counts.people).toBe(2);
    expect(asAda.counts.searches).toEqual([{ words: "invoice", people: 2, times: 2 }]);
    expect(JSON.stringify(asAda)).not.toContain("private");
    expect(JSON.stringify(asAda.counts)).not.toContain("bo");
  });

  it("never confirms one other person's words to an asker who posts them as a guess", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    await post(served.url, bo, { event: { type: "unanswered", question: "Who approved the merger codename zebra?" } });
    await post(served.url, ada, { event: { type: "search-miss", words: "giraffe zebra" } });
    await post(served.url, ada, { event: { type: "unanswered", question: "who approved the merger codename zebra" } });
    const asAda = (await read(served.url, ada)) as unknown as { counts: { words: unknown[]; questions: unknown[] } };
    expect(asAda.counts.words).toEqual([]);
    expect(asAda.counts.questions).toEqual([]);
    expect(JSON.stringify(asAda.counts)).not.toContain("zebra");
  });

  it("a visitor's search is never recorded, and a visitor reads nothing of it", async () => {
    const kept: FrictionEvent[] = [];
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true, friction: { add: (event) => void kept.push(event), list: () => kept } });
    const answer = await post(served.url, guest, { event: { type: "search-miss", words: "parking" } });
    expect(answer.status).toBe(202);
    expect(kept).toEqual([]);
    expect((await fetch(`${served.url}${FRICTION_PATH}`, { headers: seatHeaders(guest) })).status).toBe(403);
    // And the client never sends one: a visitor's remote attaches no door.
    const remote = await openRemote({ app, url: served.url, principal: guest, pollMs: 0 });
    recordFriction(remote.store, { type: "search-miss", words: "parking" }, guest);
    await new Promise((done) => setTimeout(done, 50));
    expect(kept).toEqual([]);
    remote.close();
  });

  it("caps what one post may carry and how fast one person may post", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true, frictionPerMinute: 3 });
    expect((await post(served.url, ada, JSON.stringify({ event: { type: "search-miss", words: "x".repeat(10_000) } }))).status).toBe(413);
    expect((await post(served.url, ada, { event: { type: "clicked", selector: "#buy" } })).status).toBe(400);
    for (let at = 0; at < 3; at++) expect((await post(served.url, ada, { event: { type: "search-miss", words: `w${at}` } })).status).toBe(201);
    const busy = await post(served.url, ada, { event: { type: "search-miss", words: "w4" } });
    expect(busy.status).toBe(429);
    expect(busy.headers.get("retry-after")).not.toBeNull();
    // Somebody else is not held to Ada's rate.
    expect((await post(served.url, bo, { event: { type: "search-miss", words: "w5" } })).status).toBe(201);
  });

  it("keeps nothing where the host turned it off, and says so", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true, friction: false });
    expect((await post(served.url, ada, { event: { type: "search-miss", words: "invoice" } })).status).toBe(410);
    expect((await fetch(`${served.url}${FRICTION_PATH}`, { headers: seatHeaders(ada) })).status).toBe(410);
  });

  it("records an act the server refused where the client learns of it, as the person who pressed it", async () => {
    const kept: FrictionEvent[] = [];
    // The server knows Ada with no roles; her page believes she keeps the app, so the press is shown and then refused.
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf: (request) => ({ kind: "human", id: request.headers.get(SEAT_HEADERS.seat) ?? undefined }) as Principal, friction: { add: (event) => void kept.push(event), list: () => kept } });
    const remote = await openRemote({ app, url: served.url, principal: ada, pollMs: 0 });
    const refused: string[] = [];
    remote.onRefusal((sentence) => refused.push(sentence));
    remote.store.apply({ name: "finish", args: { id: "t1" } }, { author: ada });
    await remote.settled();
    await new Promise((done) => setTimeout(done, 50));
    expect(refused).toHaveLength(1);
    expect(kept).toMatchObject([{ type: "refused", act: "finish", code: "forbidden", kind: "task", by: { kind: "human", id: "ada" } }]);
    remote.close();
  });

  it("lets a host turn recording off on the client: a remote opened with friction: false sends nothing", async () => {
    const kept: FrictionEvent[] = [];
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true, friction: { add: (event) => void kept.push(event), list: () => kept } });
    const remote = await openRemote({ app, url: served.url, principal: ada, pollMs: 0, friction: false });
    recordFriction(remote.store, { type: "search-miss", words: "invoice" }, ada);
    await new Promise((done) => setTimeout(done, 50));
    expect(kept).toEqual([]);
    remote.close();
  });

  it("reads back through its client: a person's own and the counts", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const door = remoteFriction({ url: served.url, headers: seatHeaders(ada) });
    door.sink({ type: "unanswered", question: "who is free friday?" }, ada);
    await door.idle();
    const { mine } = await door.read();
    expect(mine).toMatchObject([{ type: "unanswered", question: "who is free friday?" }]);
  });
});

describe("the friction log kept where the store is", () => {
  it("in a file of its own beside the store, the old let go", () => {
    const dir = mkdtempSync(join(tmpdir(), "graview-friction-"));
    const path = join(dir, "friction", "friction.json");
    const kept = fileFriction(path, { retentionDays: 30 });
    const old = frictionEvent({ type: "search-miss", words: "old" }, ada, { at: new Date(Date.now() - 40 * 86_400_000).toISOString() })!;
    kept.add(old);
    kept.add(frictionEvent({ type: "search-miss", words: "new" }, ada)!);
    expect(existsSync(path)).toBe(true);
    expect(kept.list().map((event) => event.type === "search-miss" && event.words)).toEqual(["new"]);
    // Another process reading the same file reads the same.
    expect(fileFriction(path).list()).toHaveLength(1);
    expect(readFileSync(path, "utf8")).not.toContain("old");
    // Never a visitor's.
    kept.add({ ...frictionEvent({ type: "search-miss", words: "parking" }, ada)!, by: guest });
    expect(kept.list()).toHaveLength(1);
  });

  it("in a browser's storage for a page that holds its own store", () => {
    const held = new Map<string, string>();
    const storage = { getItem: (key: string) => held.get(key) ?? null, setItem: (key: string, value: string) => void held.set(key, value), removeItem: (key: string) => void held.delete(key) };
    const kept = browserFriction(storage, { key: "graview:friction:todo" });
    kept.add(frictionEvent({ type: "search-miss", words: "invoice" }, ada)!);
    expect(browserFriction(storage, { key: "graview:friction:todo" }).list()).toHaveLength(1);
    expect([...held.keys()]).toEqual(["graview:friction:todo"]);
  });
});
