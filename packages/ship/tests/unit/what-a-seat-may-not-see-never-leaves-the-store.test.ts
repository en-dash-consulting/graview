import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, isWithheld, nodeRef, type Operation, type Policy, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, LIVE_PATH, openRemote, SEAT_HEADERS, seatHeaders, type LiveServerMessage } from "../../src/index.js";

/**
 * WHAT A SEAT MAY NOT SEE NEVER LEAVES THE STORE (FR-02).
 *
 * `seenBy` kept a stranger from a storefront's customers in the browser,
 * and the served store sent the browser every one of them first: the
 * state, every poll, the export and who was here all answered with the
 * whole store, whoever asked. Each route now answers with the store as the
 * asking seat sees it, and the ops it may not see are withheld in place
 * (FR-16), so an unmodified `openRemote` still loads what it is sent.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", {
  fields: z.object({ label: z.string(), answered: z.boolean().optional() }),
  plural: "Enquiries",
  edges: { from: { to: ["shopper"], cardinality: "one", description: "who asked", inverse: "their enquiries" } },
});
const schema = createSchema([car, shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", {
  title: "Ask",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  describe: (args) => `Ask “${args.label}”`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "enquiry");
    ctx.addNode({ id, kind: "enquiry", label: args.label });
    ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
  },
});
const answer = defineMutation("answer", {
  title: "Answer the enquiry",
  subject: { kinds: ["enquiry"], arg: "id" },
  writes: ["answered"],
  input: z.object({ id: nodeRef(["enquiry"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { answered: true });
  },
});
const policy: Policy = {
  grants: [{ roles: ["shopper"], mutations: ["ask", "answer"] }, { roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["car"] },
    { roles: ["staff"], kinds: ["shopper", "enquiry"] },
    { roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true },
  ],
};
const app = defineApp({ name: "showroom", schema, mutations: [ask, answer], policy, version: 1 });
const seed = {
  nodes: [
    { id: "car:golf", kind: "car", label: "Golf" },
    { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo" },
    { id: "shopper:freya", kind: "shopper", label: "Freya Davies" },
  ],
  edges: [],
};
const bethan: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
const freya: Principal = { kind: "human", id: "shopper:freya", roles: ["shopper"] };
const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };
const as = (principal: Principal) => ({ "content-type": "application/json", ...seatHeaders(principal) });
const at = (path: string, principal: Principal, init: RequestInit = {}) => new Request(`https://store.example${path}`, { ...init, headers: as(principal) });
const SECRETS = ["shopper:freya", "Freya", "Finance", "enquiry:finance-on-the-golf"];

async function showroom() {
  const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
  handler.store.apply({ name: "ask", args: { shopperId: "shopper:freya", label: "Finance on the Golf" } }, { author: freya });
  handler.store.apply({ name: "ask", args: { shopperId: "shopper:bethan", label: "Is it still there" } }, { author: bethan });
  return handler;
}
const json = async (response: Response) => JSON.stringify(await response.json());

describe("the wire sends a seat only what it may see", () => {
  it("serves /graview/state from what the seat sees, with the log redacted rather than gapped", async () => {
    const handler = await showroom();
    const response = await handler.handle(at("/graview/state", bethan));
    const state = (await response.clone().json()) as { snapshot: { nodes: { id: string }[] }; log: Operation[] };
    expect(state.snapshot.nodes.map((node) => node.id).sort()).toEqual(["car:golf", "enquiry:is-it-still-there", "shopper:bethan"]);
    expect(state.log.map((op) => op.seq)).toEqual([0, 1]);
    expect(state.log.map(isWithheld)).toEqual([true, false]);
    const said = await json(response);
    for (const secret of SECRETS) expect(said).not.toContain(secret);
    // Staff see the whole of it.
    expect(await json(await handler.handle(at("/graview/state", staff)))).toContain("Freya Davies");
  });

  it("serves /graview/since and /graview/export from what the seat sees", async () => {
    const handler = await showroom();
    for (const path of ["/graview/since?seq=-1", "/graview/export"]) {
      const said = await json(await handler.handle(at(path, bethan)));
      for (const secret of SECRETS) expect(said, path).not.toContain(secret);
      expect(said, path).toContain("Is it still there");
    }
  });

  it("does not tell a seat who is here when it may not see them, and their ops on /here come back withheld", async () => {
    const handler = await showroom();
    const here = (principal: Principal, session: string): Presence => ({ participant: `human:${principal.id}:${session}`, hue: 1, stop: "/", at: new Date().toISOString() });
    await handler.handle(at("/graview/here", freya, { method: "POST", body: JSON.stringify({ presence: { ...here(freya, "f1"), stop: "/enquiry/enquiry:finance-on-the-golf" } }) }));
    const told = (await (await handler.handle(at("/graview/here", bethan, { method: "POST", body: JSON.stringify({ presence: here(bethan, "b1"), seq: -1 }) }))).json()) as { who: Presence[]; ops: Operation[] };
    expect(told.who).toEqual([]);
    expect(told.ops.map(isWithheld)).toEqual([true, false]);
    for (const secret of SECRETS) expect(JSON.stringify(told)).not.toContain(secret);
    const who = (await (await handler.handle(at("/graview/who", staff))).json()) as { who: Presence[] };
    expect(who.who.map((presence) => presence.participant).sort()).toEqual(["human:shopper:bethan:b1", "human:shopper:freya:f1"]);
  });

  it("refuses a write naming a record the seat may not see, with the policy's sentence", async () => {
    const handler = await showroom();
    const response = await handler.handle(
      at("/graview/ops", bethan, { method: "POST", body: JSON.stringify({ calls: [{ name: "answer", args: { id: "enquiry:finance-on-the-golf" } }] }) }),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Not permitted: “Answer the enquiry” names a record you may not see.");
    expect(handler.store.graph.getNode("enquiry:finance-on-the-golf")).not.toHaveProperty("answered");
    // Their own is theirs to answer.
    const own = await handler.handle(at("/graview/ops", bethan, { method: "POST", body: JSON.stringify({ calls: [{ name: "answer", args: { id: "enquiry:is-it-still-there" } }] }) }));
    expect(own.status).toBe(200);
  });

  it("lets an unmodified openRemote load a log with withheld ops, and take in another one on a poll", async () => {
    const handler = await showroom();
    const remote = await openRemote({
      app,
      url: "https://store.example",
      principal: bethan,
      pollMs: 0,
      fetch: ((url: string, init?: RequestInit) => handler.handle(new Request(url, { ...init, headers: { ...(init?.headers as Record<string, string>), [SEAT_HEADERS.seat]: "shopper:bethan", [SEAT_HEADERS.roles]: "shopper" } }))) as typeof fetch,
    });
    expect(remote.store.log.all().map(isWithheld)).toEqual([true, false]);
    handler.store.apply({ name: "answer", args: { id: "enquiry:finance-on-the-golf" } }, { author: staff });
    await remote.pull();
    expect(remote.store.log.all().map(isWithheld)).toEqual([true, false, true]);
    expect(remote.store.graph.getNode("shopper:freya")).toBeUndefined();
    remote.close();
  });

  it("holds on the live wire exactly as on the routes: the welcome, every push and every answer as the seat sees them, and who is here kept back (FR-05)", async () => {
    const handler = await showroom();
    const heard: LiveServerMessage[] = [];
    const connection = await handler.connect(at(LIVE_PATH, bethan), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
    if (connection instanceof Response) throw new Error(`Refused: ${connection.status}`);
    const next = async (t: LiveServerMessage["t"], from = 0) => {
      for (let tries = 0; tries < 200 && !heard.slice(from).some((message) => message.t === t); tries++) await new Promise((tick) => setTimeout(tick, 1));
      const found = heard.slice(from).find((message) => message.t === t);
      if (!found) throw new Error(`Never heard ${t}`);
      return found;
    };

    // The welcome without a seq is the state, as GET /graview/state answers it to this seat.
    connection.receive(JSON.stringify({ t: "hello" }));
    const welcome = (await next("welcome")) as Extract<LiveServerMessage, { t: "welcome" }>;
    expect(welcome.state?.log.map(isWithheld)).toEqual([true, false]);
    expect(welcome.state!.snapshot.nodes.map((node) => node.id).sort()).toEqual(["car:golf", "enquiry:is-it-still-there", "shopper:bethan"]);

    // Somebody else's change to what she may not see is pushed in its place, withheld.
    let from = heard.length;
    handler.store.apply({ name: "answer", args: { id: "enquiry:finance-on-the-golf" } }, { author: staff });
    const pushed = (await next("ops", from)) as Extract<LiveServerMessage, { t: "ops" }>;
    expect(pushed.ops.map((op) => [op.seq, isWithheld(op)])).toEqual([[2, true]]);

    // Freya, here on her enquiry, is not somebody Bethan is told about.
    await handler.handle(at("/graview/here", freya, { method: "POST", body: JSON.stringify({ presence: { participant: "human:shopper:freya:f1", hue: 1, stop: "/enquiry/enquiry:finance-on-the-golf", at: new Date().toISOString() } }) }));
    const told = heard.filter((message) => message.t === "presence") as Extract<LiveServerMessage, { t: "presence" }>[];
    expect(told.length).toBeGreaterThan(0);
    for (const message of told) expect(message.who).toEqual([]);

    // A call naming what she may not see is refused in the policy's words, and a base naming it says nothing of it.
    from = heard.length;
    connection.receive(
      JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "answer", args: { id: "enquiry:finance-on-the-golf" } }], base: [{ node: "enquiry:finance-on-the-golf", field: "answered", rev: -1 }] }),
    );
    const refused = (await next("refused", from)) as Extract<LiveServerMessage, { t: "refused" }>;
    // Forbidden, and no role named: the reason says no more than the sentence does (FR-46).
    expect(refused).toEqual({ t: "refused", cid: "c1", reason: "forbidden", sentence: "Not permitted: “Answer the enquiry” names a record you may not see." });

    // Her own act is answered with its ops.
    from = heard.length;
    connection.receive(JSON.stringify({ t: "call", cid: "c2", calls: [{ name: "answer", args: { id: "enquiry:is-it-still-there" } }] }));
    const ack = (await next("ack", from)) as Extract<LiveServerMessage, { t: "ack" }>;
    expect(ack.ops.map((op) => [op.mutation?.name, isWithheld(op)])).toEqual([["answer", false]]);

    for (const secret of SECRETS) expect(JSON.stringify(heard)).not.toContain(secret);
    connection.close();
  });
});
