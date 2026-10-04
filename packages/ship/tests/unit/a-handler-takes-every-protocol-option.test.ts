import { bindSchema, createSchema, defineApp, defineNode, Store, WIRE_PROTOCOL, type Operation, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, type HeldStoreHandlerOptions, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A HOST GETS EVERY PROTOCOL OPTION THROUGH THE HANDLER.
 *
 * `liveProtocol` takes a via claim's judge, a seat key's resolver, a
 * refusal's wording, the key withheld batches are minted under, a build
 * per socket and the lowest host protocol; `createStoreHandler` (and so
 * `serveStore`) passed none of them on, so a host that wanted one had to
 * give up the handler. Each is now an option of the handler too — named
 * apart where the handler already has a name for something else: its
 * `viaOf` and `seatOf` read a request, so the protocol's are
 * `viaClaimed` and `seatOfKey`.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }) });
const secret = defineNode("secret", { fields: z.object({ label: z.string() }) });
const schema = createSchema([task, secret]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const hide = defineMutation("hide", {
  title: "Hide",
  creates: ["secret"],
  input: z.object({ id: z.string() }),
  describe: () => "Hide",
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "secret", label: "S" });
  },
});
const policy: Policy = { grants: [{ roles: ["keeper", "viewer"], mutations: "*" }], sees: [{ roles: ["keeper"], kinds: ["task", "secret"] }, { roles: ["viewer"], kinds: ["task"] }] };
const app = defineApp({ name: "options", schema, mutations: [add, hide], policy, version: 1 });
const ada: Principal = { kind: "human", id: "ada", roles: ["viewer"] };
const bo: Principal = { kind: "human", id: "bo", roles: ["keeper"] };
const seats = new Map([
  ["ada", ada],
  ["bo", bo],
]);
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], policy, snapshot: { nodes: [], edges: [] } as never });
const tick = () => new Promise((done) => setTimeout(done, 5));

async function handlerWith(options: Partial<HeldStoreHandlerOptions<typeof schema>>) {
  return createStoreHandler({ app, store: hostsStore(), seatOf: (request) => seats.get(request.headers.get("x-who") ?? "")!, ...options });
}
async function socket(handler: Awaited<ReturnType<typeof handlerWith>>, who: string, hello: Record<string, unknown> = {}) {
  const heard: LiveServerMessage[] = [];
  const connection = await handler.connect(new Request("https://store.example/graview/live", { headers: { "x-who": who } }), { send: (text) => void heard.push(JSON.parse(text) as LiveServerMessage) });
  if (connection instanceof Response) throw new Error("refused");
  connection.receive(JSON.stringify({ t: "hello", seq: -1, ...hello }));
  await tick();
  return { heard, send: async (message: unknown) => (connection.receive(JSON.stringify(message)), tick()) };
}

describe("a handler takes every protocol option", () => {
  it("viaClaimed: judges a client's via claim", async () => {
    const handler = await handlerWith({ viaClaimed: (_peer, claimed) => (claimed?.startsWith("view:") ? claimed : undefined) });
    const a = await socket(handler, "bo");
    await a.send({ t: "call", cid: "c", batch: "batch:botab:1", via: "view:board", calls: [{ name: "add", args: { id: "t1", label: "T" } }] });
    expect(handler.store.log.all().map((op) => op.via)).toEqual(["view:board"]);
    await handler.close();
  });

  it("seatKey and seatOfKey: a socket keeps a key, resolved on every message", async () => {
    const resolved: string[] = [];
    const handler = await handlerWith({ seatKey: (seat) => `user:${seat.id}`, seatOfKey: (key) => (resolved.push(key), seats.get(key.slice(5))) });
    const state = await handler.seatFor(new Request("https://store.example/graview/live", { headers: { "x-who": "bo" } }));
    expect(state).toMatchObject({ seat: "user:bo" });
    const a = await socket(handler, "bo");
    await a.send({ t: "call", cid: "c", batch: "batch:botab:1", calls: [{ name: "add", args: { id: "t1", label: "T" } }] });
    expect(a.heard.at(-1)).toMatchObject({ t: "ack" });
    expect(handler.store.log.all()[0]!.author).toMatchObject({ id: "bo" });
    expect(resolved).toContain("user:bo");
    await handler.close();
  });

  it("refusal: words a refusal, on the socket and over HTTP", async () => {
    const handler = await handlerWith({ refusal: () => ({ reason: "invalid", sentence: "Not in this room." }) });
    const response = await handler.handle(new Request("https://store.example/graview/ops", { method: "POST", headers: { "x-who": "bo" }, body: JSON.stringify({ calls: [{ name: "dance", args: {} }] }) }));
    expect(await response.json()).toMatchObject({ error: "Not in this room." });
    const a = await socket(handler, "bo");
    await a.send({ t: "call", cid: "c", calls: [{ name: "dance", args: {} }] });
    expect(a.heard.at(-1)).toMatchObject({ t: "refused", sentence: "Not in this room." });
    await handler.close();
  });

  it("withheldKey: two handlers under one key serve one opaque batch", async () => {
    const batches: string[] = [];
    for (let at = 0; at < 2; at++) {
      const handler = await handlerWith({ withheldKey: "the host's secret" });
      await handler.handle(new Request("https://store.example/graview/ops", { method: "POST", headers: { "x-who": "bo" }, body: JSON.stringify({ batch: "batch:botab:1", calls: [{ name: "hide", args: { id: "s1" } }] }) }));
      const since = (await (await handler.handle(new Request("https://store.example/graview/since?seq=-1", { headers: { "x-who": "ada" } }))).json()) as { ops: Operation[] };
      batches.push(since.ops[0]!.batch);
      await handler.close();
    }
    expect(batches[0]).toMatch(/^withheld:/);
    expect(batches[1]).toBe(batches[0]);
  });

  it("build as a function: per socket in the welcome, and on a route", async () => {
    const handler = await handlerWith({ build: (peer) => `shell-${peer.seat.id}` });
    const a = await socket(handler, "bo");
    expect(a.heard[0]).toMatchObject({ t: "welcome", build: "shell-bo" });
    const since = await handler.handle(new Request("https://store.example/graview/since?seq=-1", { headers: { "x-who": "ada" } }));
    expect(await since.json()).toMatchObject({ build: "shell-ada" });
    await handler.close();
  });

  it("minHostProtocol: a hello below it is sent reload", async () => {
    const handler = await handlerWith({ minHostProtocol: 2 });
    const old = await socket(handler, "bo", { hostProtocol: 1 });
    expect(old.heard[0]).toMatchObject({ t: "reload", protocol: WIRE_PROTOCOL, hostProtocol: 2 });
    const current = await socket(handler, "bo", { hostProtocol: 2 });
    expect(current.heard[0]).toMatchObject({ t: "welcome" });
    await handler.close();
  });
});
