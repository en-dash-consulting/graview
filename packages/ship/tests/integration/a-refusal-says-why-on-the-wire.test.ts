import { createSchema, defineApp, defineMutation, defineNode, nodeRef, REFUSAL_REASONS, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, LIVE_PATH, openRemote, REFUSAL_REASONS as SHIPPED_REASONS, RemoteRefusedError, type LiveServerMessage, type LiveSocketLike, type RemoteRefusal, type StoreHandler } from "../../src/index.js";

/**
 * A REFUSAL SAYS WHY, ON THE WIRE (FR-46).
 *
 * `refused` carried a sentence and nothing else, from one catch, so Graview
 * Cloud's MCP surface and its toasts matched on words to tell "you may not"
 * from "it is gone". Now every refusal on the socket and every refusing
 * answer of `POST /graview/ops` carries `reason` — `forbidden`, `missing`,
 * `invalid` or `limit` — and `wouldNeed` when the policy knows who could;
 * `openRemote`'s `onRefusal` hands both to the listener.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const drop = defineMutation("drop", {
  title: "Drop it",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
const schema = createSchema([task]);
const app = defineApp({
  name: "reasons",
  schema,
  mutations: [finish, rename, drop],
  policy: {
    roles: ["keeper", "admin"],
    grants: [
      { roles: ["keeper"], mutations: ["finish"] },
      { roles: ["admin"], mutations: ["finish", "rename", "drop"] },
    ],
  },
  version: 1,
});
const keeper: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const admin: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["admin"] };
const LONG = "x".repeat(2000);

/** The host's limit: a label over a thousand characters can never land, however long the caller waits. */
const overTheCap = ({ bytes }: { bytes: number }) => (bytes > 1000 ? { refuse: "A change is at most 1000 bytes on this host." } : undefined);

async function hosted(seat: Principal) {
  const store = new Store({
    schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "t1", kind: "task", label: "Book the hall", done: false },
        { id: "t2", kind: "task", label: "Pay the deposit", done: false },
      ],
      edges: [],
    } as never,
  });
  return createStoreHandler({ app, store, seatOf: () => seat, limit: overTheCap });
}

const until = async (holds: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

/** A socket on the handler, in process: every message it hears kept. */
async function socketOn(handler: StoreHandler<typeof schema>) {
  const heard: LiveServerMessage[] = [];
  const connection = await handler.connect(new Request(`https://store.example${LIVE_PATH}`), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
  if (connection instanceof Response) throw new Error(`refused: ${connection.status}`);
  const say = (message: unknown) => connection.receive(typeof message === "string" ? message : JSON.stringify(message));
  return { heard, say };
}

/** `openRemote` over the handler, in process: its fetch is the handler's, and its socket the handler's `connect`. */
function wired(handler: StoreHandler<typeof schema>) {
  const fetcher = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
  const socket = (url: string): LiveSocketLike => {
    let deliver: (text: string) => void = () => {};
    const fake: LiveSocketLike & { readyState: number } = {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: (text) => deliver(text),
      close() {
        fake.readyState = 3;
      },
    };
    void handler
      .connect(new Request(url.replace(/^ws/, "http")), { send: (text) => setTimeout(() => fake.onmessage?.({ data: text }), 0) })
      .then((connection) => {
        if (connection instanceof Response) throw new Error("refused");
        deliver = (text) => connection.receive(text);
        fake.readyState = 1;
        fake.onopen?.({});
      });
    return fake;
  };
  return { fetch: fetcher, socket };
}

const refusalsOn = async (heard: LiveServerMessage[], cid: string) => {
  await until(() => heard.some((message) => "cid" in message && message.cid === cid));
  return heard.find((message) => "cid" in message && message.cid === cid) as Extract<LiveServerMessage, { t: "refused" }>;
};

describe("a refusal says why on the wire", () => {
  it("ships the same closed set core reads errors into", () => {
    expect(SHIPPED_REASONS).toBe(REFUSAL_REASONS);
  });

  it("forbidden, on the socket: the policy refused the seat, and wouldNeed names who could", async () => {
    const { heard, say } = await socketOn(await hosted(keeper));
    say({ t: "hello", seq: -1 });
    say({ t: "call", cid: "c1", calls: [{ name: "rename", args: { id: "t1", label: "Hall" } }] });
    expect(await refusalsOn(heard, "c1")).toMatchObject({ t: "refused", reason: "forbidden", wouldNeed: ["admin"] });
  });

  it("missing, on the socket: the call names a record that is not there", async () => {
    const { heard, say } = await socketOn(await hosted(keeper));
    say({ t: "hello", seq: -1 });
    say({ t: "call", cid: "c1", calls: [{ name: "finish", args: { id: "gone" } }] });
    const refused = await refusalsOn(heard, "c1");
    expect(refused).toMatchObject({ t: "refused", reason: "missing" });
    expect(refused).not.toHaveProperty("wouldNeed");
  });

  it("invalid, on the socket: arguments the act does not take, and a call before hello", async () => {
    const { heard, say } = await socketOn(await hosted(admin));
    say({ t: "call", cid: "early", calls: [{ name: "finish", args: { id: "t1" } }] });
    expect(await refusalsOn(heard, "early")).toMatchObject({ t: "refused", reason: "invalid" });
    say({ t: "hello", seq: -1 });
    say({ t: "call", cid: "c1", calls: [{ name: "rename", args: { id: "t1", label: 4 } }] });
    expect(await refusalsOn(heard, "c1")).toMatchObject({ t: "refused", reason: "invalid" });
  });

  it("limit, on the socket: the host's hard cap, which no wait would get past", async () => {
    const { heard, say } = await socketOn(await hosted(admin));
    say({ t: "hello", seq: -1 });
    say({ t: "call", cid: "c1", calls: [{ name: "rename", args: { id: "t1", label: LONG } }] });
    expect(await refusalsOn(heard, "c1")).toMatchObject({ t: "refused", reason: "limit", sentence: "A change is at most 1000 bytes on this host." });
  });

  it("says each reason on POST /graview/ops too, with the status it always had", async () => {
    const post = async (seat: Principal, calls: unknown) => {
      const response = await (await hosted(seat)).handle(new Request("https://store.example/graview/ops", { method: "POST", body: JSON.stringify({ calls }) }));
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    };
    expect(await post(keeper, [{ name: "rename", args: { id: "t1", label: "Hall" } }])).toMatchObject({ status: 409, body: { refused: true, reason: "forbidden", wouldNeed: ["admin"] } });
    expect(await post(keeper, [{ name: "finish", args: { id: "gone" } }])).toMatchObject({ status: 409, body: { refused: true, reason: "missing" } });
    expect(await post(admin, [{ name: "rename", args: { id: "t1", label: 4 } }])).toMatchObject({ status: 409, body: { refused: true, reason: "invalid" } });
    expect(await post(admin, [{ name: "rename", args: { id: "t1", label: LONG } }])).toMatchObject({ status: 413, body: { refused: true, reason: "limit" } });
  });

  it("says a reason on the routes' other refusing answers", async () => {
    const handler = await hosted(keeper);
    const nowhere = await handler.handle(new Request("https://store.example/graview/nowhere"));
    expect([nowhere.status, ((await nowhere.json()) as { reason?: string }).reason]).toEqual([404, "missing"]);
    const here = await handler.handle(new Request("https://store.example/graview/here", { method: "POST", body: "{}" }));
    expect([here.status, ((await here.json()) as { reason?: string }).reason]).toEqual([400, "invalid"]);
    const nobody = await createStoreHandler({ app, store: handler.store });
    const untold = await nobody.handle(new Request("https://store.example/graview/state"));
    expect([untold.status, ((await untold.json()) as { reason?: string }).reason]).toEqual([401, "forbidden"]);
  });

  for (const live of [true, false]) {
    it(`hands openRemote's onRefusal the reason and wouldNeed (${live ? "socket" : "HTTP"})`, async () => {
      // The browser believes it is an admin; the host says it is a keeper. Only the server refuses.
      const handler = await hosted(keeper);
      const remote = await openRemote({ app, url: "https://store.example", principal: admin, live, pollMs: 0, ...wired(handler) });
      expect(remote.transport()).toBe(live ? "socket" : "poll");
      const told: { sentence: string; refusal: RemoteRefusal }[] = [];
      remote.onRefusal((sentence, refusal) => told.push({ sentence, refusal }));
      remote.store.apply({ name: "rename", args: { id: "t1", label: "Hall" } });
      await remote.settled();
      // Gone on the server before the call reaches it, still here in the browser.
      remote.store.apply({ name: "finish", args: { id: "t2" } });
      handler.store.apply({ name: "drop", args: { id: "t2" } }, { author: admin });
      await remote.settled();
      expect(told.map(({ refusal }) => refusal.reason)).toEqual(["forbidden", "missing"]);
      expect(told[0]!.refusal.wouldNeed).toEqual(["admin"]);
      expect(told[0]!.sentence).toBe(told[0]!.refusal.sentence);
      for (const { refusal } of told) expect(REFUSAL_REASONS).toContain(refusal.reason);
      // Taken back: the rename is not shown.
      expect(remote.store.graph.getNode("t1")).toMatchObject({ label: "Book the hall" });
      // A call sent without being shown first throws the same refusal, for a program to branch on.
      const sent = await remote.send([{ name: "rename", args: { id: "t1", label: "Hall" } }]).catch((error: unknown) => error);
      expect(sent).toBeInstanceOf(RemoteRefusedError);
      expect((sent as RemoteRefusedError).refusal).toMatchObject({ reason: "forbidden", wouldNeed: ["admin"] });
      remote.close();
    });
  }
});
