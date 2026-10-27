import { request as send } from "node:http";
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { mintServeKey, seatTrust } from "../../src/cli.js";
import { openRemote, SEAT_HEADERS, SERVE_KEY, serveStore, type ServedStore } from "../../src/index.js";

/**
 * A LOOPBACK SERVE BELIEVES A SEAT ONLY WITH ITS RUN'S KEY.
 *
 * `graview serve` on 127.0.0.1 kept a page on another origin out, and a
 * name rebinding to this machine; but another account on this machine, or
 * any program that is no browser, sends no `Origin` at all, and it was
 * believed as any seat it named. Now each run mints a key, prints it in the
 * address it says, and believes a request only when it carries that key —
 * a header for a program, a query parameter on a page's WebSocket, a cookie
 * for a page opened at the printed address. Health stays open, and the key
 * is never written into anything the server answers.
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
  name: "keyed",
  schema,
  mutations: [close],
  policy: { roles: ["member"], grants: [{ roles: ["member"], mutations: ["close"], describe: "A member closes memos." }] },
  version: 1,
});
const seed = { nodes: [{ id: "m1", kind: "memo", label: "Private", done: false }], edges: [] };

let served: ServedStore<typeof schema> | undefined;
let key = "";
afterEach(async () => {
  await served?.close({ grace: 0 });
  served = undefined;
});

/** As `graview serve` serves on loopback with no flag: its own origin, and this run's key. */
async function asServeOnLoopback() {
  const trust = seatTrust("127.0.0.1", false);
  if ("refuse" in trust) throw new Error(trust.refuse);
  key = mintServeKey();
  served = await serveStore({
    app,
    adapter: createMemoryAdapter(),
    seed: seed as never,
    host: "127.0.0.1",
    port: 0,
    trustSeatHeaders: trust.trust,
    trustSystemSeat: trust.system,
    ownOrigin: trust.ownOrigin,
    ...(trust.keyed ? { key } : {}),
  });
  return served;
}

interface Answer {
  readonly status: number | string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: string;
}

const answers: Answer[] = [];

function ask(path: string, headers: Record<string, string>, body?: string, method = body === undefined ? "GET" : "POST"): Promise<Answer> {
  return new Promise((done) => {
    const asked = send({ host: "127.0.0.1", port: served!.port, path, method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers } }, (answer) => {
      let text = "";
      answer.on("data", (chunk) => (text += String(chunk)));
      answer.on("end", () => {
        const one = { status: answer.statusCode ?? 0, headers: answer.headers, body: text };
        answers.push(one);
        done(one);
      });
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
      let text = "";
      answer.on("data", (chunk) => (text += String(chunk)));
      answer.on("end", () => {
        answers.push({ status: answer.statusCode ?? 0, headers: answer.headers, body: text });
        done(answer.statusCode ?? 0);
      });
    });
    asked.on("error", () => done(0));
    asked.end();
  });
}

const own = () => ({ host: `127.0.0.1:${served!.port}` });
const member = { [SEAT_HEADERS.seat]: "u-member", [SEAT_HEADERS.roles]: "member" };
const closeIt = JSON.stringify({ calls: [{ name: "close", args: { id: "m1" } }] });
const done = () => (served!.store.graph.getNode("m1") as { done: boolean }).done;

describe("a loopback serve believes a seat only with its run's key", () => {
  it("refuses a program with no Origin and no key that claims a member's seat", async () => {
    await asServeOnLoopback();
    const read = await ask("/graview/state", { ...own(), ...member });
    expect(read.status).toBe(401);
    expect(JSON.parse(read.body)).toMatchObject({ reason: "forbidden", error: expect.stringMatching(/printed/) });
    expect((await ask("/graview/ops", { ...own(), ...member }, closeIt)).status).toBe(401);
    // A wrong key is no key.
    expect((await ask("/graview/ops", { ...own(), ...member, [SEAT_HEADERS.seat]: "u-member", [SERVE_KEY.header]: `${key}x` }, closeIt)).status).toBe(401);
    expect(done()).toBe(false);
  });

  it("believes the same program once it carries the key, in the header or the query", async () => {
    await asServeOnLoopback();
    expect((await ask("/graview/state", { ...own(), ...member, [SERVE_KEY.header]: key })).status).toBe(200);
    expect((await ask(`/graview/state?${SERVE_KEY.param}=${encodeURIComponent(key)}`, { ...own(), ...member })).status).toBe(200);
    expect((await ask("/graview/ops", { ...own(), ...member, [SERVE_KEY.header]: key }, closeIt)).status).toBe(200);
    expect(done()).toBe(true);
    expect(served!.store.log.all().at(-1)?.author).toMatchObject({ id: "u-member" });
  });

  it("refuses an address no URL parses without falling over", async () => {
    await asServeOnLoopback();
    expect((await ask("//[", { ...own(), ...member })).status).toBe(401);
    expect((await ask("/graview/health", own())).status).toBe(200);
  });

  it("keeps health open to anybody", async () => {
    await asServeOnLoopback();
    const health = await ask("/graview/health", own());
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body)).toMatchObject({ ok: true });
  });

  it("trades the printed address for a cookie only its own pages send, and believes the cookie", async () => {
    await asServeOnLoopback();
    const traded = await ask(`/?${SERVE_KEY.param}=${encodeURIComponent(key)}&today=2026-09-14`, own());
    expect(traded.status).toBe(303);
    expect(traded.headers.location).toBe("/?today=2026-09-14");
    const cookie = String(traded.headers["set-cookie"]);
    expect(cookie).toMatch(new RegExp(`^${SERVE_KEY.cookie}=`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const held = cookie.split(";")[0]!;
    expect((await ask("/graview/state", { ...own(), ...member, cookie: held })).status).toBe(200);
    // A wrong key is sent on without a cookie.
    const wrong = await ask(`/?${SERVE_KEY.param}=nope`, own());
    expect(wrong.status).toBe(303);
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });

  it("holds the live wire to the same rule", async () => {
    await asServeOnLoopback();
    expect(await upgrade(own(), `?${SEAT_HEADERS.seat}=u-member&${SEAT_HEADERS.roles}=member`)).toBe(401);
    expect(await upgrade(own(), `?${SEAT_HEADERS.seat}=u-member&${SERVE_KEY.param}=${encodeURIComponent(key)}`)).toBe(101);
    expect(await upgrade({ ...own(), [SERVE_KEY.header]: key, ...member })).toBe(101);
    const traded = await ask(`/?${SERVE_KEY.param}=${encodeURIComponent(key)}`, own());
    expect(await upgrade({ ...own(), cookie: String(traded.headers["set-cookie"]).split(";")[0]! }, `?${SEAT_HEADERS.seat}=u-member`)).toBe(101);
  });

  it("opens a remote store from the printed address, live, and acts as its seat", async () => {
    await asServeOnLoopback();
    const remote = await openRemote({ app, url: `${served!.url}/?${SERVE_KEY.param}=${encodeURIComponent(key)}`, principal: { kind: "human", id: "u-member", roles: ["member"] }, live: true, pollMs: 0 });
    try {
      // The socket was believed: a change made by somebody else is pushed down it (the client never polls).
      expect((await ask("/graview/ops", { ...own(), [SEAT_HEADERS.seat]: "u-other", [SEAT_HEADERS.roles]: "member", [SERVE_KEY.header]: key }, closeIt)).status).toBe(200);
      await expect.poll(() => (remote.store.graph.getNode("m1") as { done: boolean } | undefined)?.done, { timeout: 5000 }).toBe(true);
      expect(remote.store.graph.getNode("m1")).toBeDefined();
    } finally {
      remote.close();
    }
  });

  it("writes the key into no answer it serves", async () => {
    answers.length = 0;
    await asServeOnLoopback();
    await ask("/graview/health", own());
    await ask("/graview/state", { ...own(), ...member });
    await ask("/graview/state", { ...own(), ...member, [SERVE_KEY.header]: key });
    await ask(`/graview/since?seq=-1&${SERVE_KEY.param}=${encodeURIComponent(key)}`, { ...own(), ...member });
    await ask("/graview/ops", { ...own(), ...member, [SERVE_KEY.header]: key }, closeIt);
    await ask("/graview/ops", { ...own(), origin: `http://127.0.0.1:${served!.port}` }, undefined, "OPTIONS");
    await ask(`/?${SERVE_KEY.param}=${encodeURIComponent(key)}`, own());
    await ask("/nowhere", { ...own(), [SERVE_KEY.header]: key });
    await upgrade(own(), `?${SEAT_HEADERS.seat}=u-member`);
    expect(answers.length).toBeGreaterThanOrEqual(9);
    for (const answer of answers) {
      expect(answer.body).not.toContain(key);
      expect(JSON.stringify(answer.headers)).not.toContain(key);
    }
  });

  it("says which: loopback asks for a key, and --trust-seat-headers leaves it to the network in front", () => {
    expect(seatTrust("127.0.0.1", false)).toMatchObject({ keyed: true });
    expect(seatTrust("127.0.0.1", true)).toMatchObject({ keyed: false });
    const one = mintServeKey();
    expect(one).toMatch(/^[\w-]{43}$/);
    expect(mintServeKey()).not.toBe(one);
  });
});
