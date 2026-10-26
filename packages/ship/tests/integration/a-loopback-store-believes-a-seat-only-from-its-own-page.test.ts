import { request as send } from "node:http";
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { seatTrust } from "../../src/cli.js";
import { SEAT_HEADERS, serveStore, type ServedStore } from "../../src/index.js";

/**
 * A LOOPBACK STORE BELIEVES A SEAT ONLY FROM ITS OWN PAGE (FR-06).
 *
 * `graview serve` on 127.0.0.1 believes the seat a request names in its
 * headers, because only this machine reaches it. But a page on another
 * origin in this machine's browser reaches it too, and every answer said
 * `Access-Control-Allow-Origin: *`: such a page read the whole store as
 * any seat it named, and wrote to it as the system, which passes every
 * policy and every sight. Now the loopback serve keeps to its own origin
 * and host (as `graview preview` does) and the origins `--allow-origin`
 * names, echoes only those in its CORS answer, and reads no header as the
 * system's seat unless `--trust-seat-headers` is said.
 */
const memo = defineNode("memo", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Memos", label: (node) => node.label });
const schema = createSchema([memo]);
const { defineMutation } = bindSchema(schema);
const close = defineMutation("close", {
  title: "Close it",
  description: "Closes a memo.",
  subject: { kinds: ["memo"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["memo"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const app = defineApp({
  name: "loopback",
  schema,
  mutations: [close],
  policy: { roles: ["owner", "reader"], grants: [{ roles: ["owner"], mutations: ["close"], describe: "The owner closes memos." }] },
  version: 1,
});
const seed = { nodes: [{ id: "m1", kind: "memo", label: "Private", done: false }], edges: [] };
const ALLOWED = "http://localhost:5195";

let served: ServedStore<typeof schema> | undefined;
afterEach(async () => {
  await served?.close({ grace: 0 });
  served = undefined;
});

/** As `graview serve` serves on loopback with no flag. */
async function asServeOnLoopback(trustFlag = false) {
  const trust = seatTrust("127.0.0.1", trustFlag);
  if ("refuse" in trust) throw new Error(trust.refuse);
  served = await serveStore({
    app,
    adapter: createMemoryAdapter(),
    seed: seed as never,
    host: "127.0.0.1",
    port: 0,
    trustSeatHeaders: trust.trust,
    trustSystemSeat: trust.system,
    ownOrigin: trust.ownOrigin,
    allowOrigins: [ALLOWED],
  });
  return served;
}

interface Answer {
  readonly status: number | string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: string;
}

function ask(path: string, headers: Record<string, string>, body?: string): Promise<Answer> {
  return new Promise((done) => {
    const asked = send({ host: "127.0.0.1", port: served!.port, path, method: body === undefined ? "GET" : "POST", headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers } }, (answer) => {
      let text = "";
      answer.on("data", (chunk) => (text += String(chunk)));
      answer.on("end", () => done({ status: answer.statusCode ?? 0, headers: answer.headers, body: text }));
    });
    asked.on("error", (error: NodeJS.ErrnoException) => done({ status: error.code ?? error.message, headers: {}, body: "" }));
    asked.end(body);
  });
}

/** An upgrade to the live wire: 101, or the status it was refused with. */
function upgrade(headers: Record<string, string>, query = ""): Promise<number> {
  return new Promise((done) => {
    const asked = send({
      host: "127.0.0.1",
      port: served!.port,
      path: `/graview/live${query}`,
      headers: { connection: "Upgrade", upgrade: "websocket", "sec-websocket-version": "13", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==", ...headers },
    });
    asked.on("upgrade", (_answer, socket) => {
      socket.destroy();
      done(101);
    });
    asked.on("response", (answer) => {
      answer.resume();
      done(answer.statusCode ?? 0);
    });
    asked.on("error", () => done(0));
    asked.end();
  });
}

const own = () => ({ host: `127.0.0.1:${served!.port}` });
const owner = { [SEAT_HEADERS.seat]: "u-owner", [SEAT_HEADERS.roles]: "owner" };

describe("a loopback store believes a seat only from its own page", () => {
  it("refuses a page on another origin, a cross-site fetch and a rebound host, on HTTP and on the live wire", async () => {
    await asServeOnLoopback();
    for (const foreign of [
      { ...own(), origin: "http://evil.example" },
      { ...own(), origin: "http://127.0.0.1:9999" },
      { ...own(), "sec-fetch-site": "cross-site" },
      { host: `rebound.example:${served!.port}` },
    ]) {
      expect((await ask("/graview/state", { ...foreign, ...owner })).status).toBe(403);
      expect((await ask("/graview/ops", { ...foreign, [SEAT_HEADERS.kind]: "system" }, JSON.stringify({ calls: [{ name: "close", args: { id: "m1" } }] }))).status).toBe(403);
      expect(await upgrade(foreign, `?${SEAT_HEADERS.kind}=system`)).toBe(403);
    }
    expect((served!.store.graph.getNode("m1") as { done: boolean }).done).toBe(false);
  });

  it("answers its own page, and a program on this machine, with no wildcard origin", async () => {
    await asServeOnLoopback();
    const page = await ask("/graview/state", { ...own(), origin: `http://127.0.0.1:${served!.port}`, "sec-fetch-site": "same-origin", ...owner });
    expect(page.status).toBe(200);
    expect(page.headers["access-control-allow-origin"]).toBeUndefined();
    const program = await ask("/graview/state", { ...own(), ...owner });
    expect(program.status).toBe(200);
    expect(program.headers["access-control-allow-origin"]).toBeUndefined();
    expect(await upgrade(own(), `?${SEAT_HEADERS.seat}=u-owner`)).toBe(101);
  });

  it("lets in an origin --allow-origin names, echoing it, and only it", async () => {
    await asServeOnLoopback();
    const allowed = await ask("/graview/state", { ...own(), origin: ALLOWED, "sec-fetch-site": "same-site", ...owner });
    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(String(allowed.headers["vary"])).toMatch(/Origin/);
    const preflight = await new Promise<Answer>((done) => {
      const asked = send({ host: "127.0.0.1", port: served!.port, path: "/graview/ops", method: "OPTIONS", headers: { ...own(), origin: ALLOWED, "access-control-request-method": "POST" } }, (answer) => {
        answer.resume();
        done({ status: answer.statusCode ?? 0, headers: answer.headers, body: "" });
      });
      asked.end();
    });
    expect(preflight.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(await upgrade({ ...own(), origin: ALLOWED }, `?${SEAT_HEADERS.seat}=u-owner`)).toBe(101);
    // Named, but at a host that is not this machine: a rebinding page cannot borrow the allowance.
    expect((await ask("/graview/state", { host: `rebound.example:${served!.port}`, origin: ALLOWED, ...owner })).status).toBe(403);
  });

  it("reads no header as the system's seat on loopback, and does when --trust-seat-headers is said", async () => {
    await asServeOnLoopback();
    const asSystem = await ask("/graview/ops", { ...own(), [SEAT_HEADERS.kind]: "system", [SEAT_HEADERS.seat]: "anyone" }, JSON.stringify({ calls: [{ name: "close", args: { id: "m1" } }] }));
    expect(asSystem.status).not.toBe(200);
    expect((served!.store.graph.getNode("m1") as { done: boolean }).done).toBe(false);
    await served!.close({ grace: 0 });

    await asServeOnLoopback(true);
    const trusted = await ask("/graview/ops", { ...own(), [SEAT_HEADERS.kind]: "system", [SEAT_HEADERS.seat]: "ship:host" }, JSON.stringify({ calls: [{ name: "close", args: { id: "m1" } }] }));
    expect(trusted.status).toBe(200);
    expect(served!.store.log.all().at(-1)?.author).toMatchObject({ kind: "system" });
  });

  it("says which: loopback keeps to its own origin and no system header; the flag believes every header", () => {
    expect(seatTrust("127.0.0.1", false)).toMatchObject({ trust: true, ownOrigin: true, system: false });
    expect(seatTrust("127.0.0.1", true)).toMatchObject({ trust: true, ownOrigin: false, system: true });
    expect(seatTrust("0.0.0.0", true)).toMatchObject({ trust: true, ownOrigin: false, system: true });
  });
});
