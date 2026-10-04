import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, LIVE_PATH, openRemote, SEAT_HEADERS, type LiveServerMessage } from "../../src/runtime.js";

/**
 * THE CHANNEL IS THE HOST'S WORD (FR-52).
 *
 * Every op records what it came through — `web`, `api`, `mcp:Claude` — and
 * the audit and the "via Claude" line read it. The live wire and the HTTP
 * route took it from the client's own message, so a browser could record
 * its edit as made by Claude over MCP. The channel is now said by the host
 * (`viaOf`), or by a seat header the host trusts, and a client's `via` is
 * ignored wherever it is sent.
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
const app = defineApp({ name: "channel", schema, mutations: [finish], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }], edges: [] };
const person: Principal = { kind: "human", id: "u1", roles: ["keeper"] };
const at = (path: string, init: RequestInit = {}) => new Request(`https://store.example${path}`, init);

async function socket(handler: Awaited<ReturnType<typeof createStoreHandler<typeof schema>>>, request = at(LIVE_PATH)) {
  const heard: LiveServerMessage[] = [];
  const connection = await handler.connect(request, { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
  if (connection instanceof Response) throw new Error(`refused: ${connection.status}`);
  const answered = async (cid: string) => {
    for (let tries = 0; !heard.some((message) => "cid" in message && message.cid === cid); tries++) {
      if (tries > 200) throw new Error(`No answer to ${cid}.`);
      await new Promise((tick) => setTimeout(tick, 1));
    }
    return heard.find((message) => "cid" in message && message.cid === cid)!;
  };
  return { connection, heard, answered };
}

describe("the channel an op came through is the host's word", () => {
  it("lands a socket call claiming via mcp:x from a web seat with the host's via, and an undo likewise", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf: () => person, viaOf: () => "web" });
    const { connection, answered } = await socket(handler);
    connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
    connection.receive(JSON.stringify({ t: "call", cid: "c1", via: "mcp:x", calls: [{ name: "finish", args: { id: "t1" } }] }));
    const ack = (await answered("c1")) as Extract<LiveServerMessage, { t: "ack" }>;
    expect(ack.t).toBe("ack");
    expect(handler.store.log.all().at(-1)!.via).toBe("web");
    connection.receive(JSON.stringify({ t: "undo", cid: "u1", via: "mcp:x", batches: [ack.batch] }));
    expect((await answered("u1")).t).toBe("ack");
    expect(handler.store.log.all().at(-1)!.via).toBe("web");
    expect(handler.store.log.all().map((op) => op.via)).not.toContain("mcp:x");
    await handler.close();
  });

  it("says web on a socket and api on HTTP when the host names no channel, whatever the client claims", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf: () => person });
    const { connection, answered } = await socket(handler);
    connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
    connection.receive(JSON.stringify({ t: "call", cid: "c1", via: "mcp:x", calls: [{ name: "finish", args: { id: "t1" } }] }));
    await answered("c1");
    expect(handler.store.log.all().at(-1)!.via).toBe("web");

    const posted = await handler.handle(at("/graview/ops", { method: "POST", body: JSON.stringify({ undo: [handler.store.log.all().at(-1)!.batch], via: "mcp:x" }) }));
    expect(posted.status).toBe(200);
    expect(handler.store.log.all().at(-1)!.via).toBe("api");
    await handler.close();
  });

  it("hands the host's viaOf the request and the seat, on the HTTP route and the socket alike", async () => {
    const asked: [string, string | undefined][] = [];
    const handler = await createStoreHandler({
      app,
      adapter: createMemoryAdapter(),
      seed: seed as never,
      seatOf: () => person,
      viaOf: (request, seat) => {
        asked.push([new URL(request.url).pathname, seat.id]);
        return request.headers.get("authorization") === "Bearer agent-token" ? "mcp:Claude" : "web";
      },
    });
    const posted = await handler.handle(
      at("/graview/ops", { method: "POST", headers: { authorization: "Bearer agent-token" }, body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }], via: "web" }) }),
    );
    expect(posted.status).toBe(200);
    expect(handler.store.log.all().at(-1)!.via).toBe("mcp:Claude");
    await socket(handler);
    expect(asked).toEqual([
      ["/graview/ops", "u1"],
      [LIVE_PATH, "u1"],
    ]);
    await handler.close();
  });

  it("believes the via header only where it believes the seat headers, and openRemote says its channel there", async () => {
    const trusted = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const remote = await openRemote({
      app,
      url: "https://store.example",
      principal: { kind: "agent", id: "claude", roles: ["keeper"] },
      via: "mcp:Claude",
      pollMs: 0,
      fetch: ((url: string, init?: RequestInit) => trusted.handle(new Request(url, init))) as typeof fetch,
    });
    remote.store.apply({ name: "finish", args: { id: "t1" } });
    await remote.settled();
    expect(trusted.store.log.all().at(-1)!.via).toBe("mcp:Claude");
    remote.close();
    await trusted.close();

    const untrusted = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf: () => person });
    const posted = await untrusted.handle(at("/graview/ops", { method: "POST", headers: { [SEAT_HEADERS.via]: "mcp:x" }, body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }) }));
    expect(posted.status).toBe(200);
    expect(untrusted.store.log.all().at(-1)!.via).toBe("api");
    await untrusted.close();
  });
});
