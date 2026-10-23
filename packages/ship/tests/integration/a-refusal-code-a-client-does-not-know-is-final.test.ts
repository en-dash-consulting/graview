import { bindSchema, createSchema, defineApp, defineNode, nodeRef, REFUSAL_REASONS, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, LIVE_PATH, openRemote, RemoteRefusedError, type LimitAnswer, type LiveServerMessage, type LiveSocketLike, type RemoteRefusal, type StoreHandler } from "../../src/index.js";

/**
 * REFUSAL CODES ARE OPEN (1.0's foundation, docs/stability.md §3).
 *
 * The set was closed until 1.0 and then frozen for a major, so a hosted
 * service that needed to say "sign in again" or "your plan is used up"
 * had to say `forbidden` or `limit` and let a person read the sentence.
 * Now a code may be added within a major — `unauthenticated` and `quota`
 * are added here, said by a host's `limit` as `{ refuse, reason }` — and a
 * client that meets a code it does not know treats it as final: the change
 * is taken back and the refusal handed on with the code as it came, never
 * kept and sent again as `unavailable` is.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({ name: "codes", schema, mutations: [rename], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const NEWER = "a-code-from-a-newer-host";

const hosted = (limit: () => LimitAnswer | undefined) =>
  createStoreHandler({
    app,
    store: new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the hall" }], edges: [] } as never }),
    seatOf: () => kim,
    limit,
  });

/** `openRemote` over the handler, in process — every refusal's code rewritten to `recode`'s, as a newer host would say it. */
function wired(handler: StoreHandler<typeof schema>, recode?: string) {
  const fetcher = (async (url: string, init?: RequestInit) => {
    const response = await handler.handle(new Request(url, init));
    if (!recode || response.ok) return response;
    const body = (await response.json()) as Record<string, unknown>;
    return new Response(JSON.stringify(body["refused"] ? { ...body, reason: recode } : body), { status: response.status, headers: response.headers });
  }) as typeof fetch;
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
    const said = (text: string) => {
      const message = JSON.parse(text) as LiveServerMessage;
      return recode && message.t === "refused" ? JSON.stringify({ ...message, reason: recode }) : text;
    };
    void handler
      .connect(new Request(url.replace(/^ws/, "http")), { send: (text) => setTimeout(() => fake.onmessage?.({ data: said(text) }), 0) })
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

describe("a refusal code a client does not know is final", () => {
  it("adds unauthenticated and quota after the six, each meaning one thing", () => {
    expect([...REFUSAL_REASONS]).toEqual(["forbidden", "missing", "invalid", "limit", "unavailable", "refused", "unauthenticated", "quota"]);
  });

  it("a host says unauthenticated (401) and quota (403) as its own final refusals, on the socket and over HTTP", async () => {
    for (const [reason, status] of [["unauthenticated", 401], ["quota", 403], ["limit", 413]] as const) {
      const handler = await hosted(() => ({ refuse: `Refused as ${reason}.`, reason }));
      const response = await handler.handle(new Request("https://store.example/graview/ops", { method: "POST", body: JSON.stringify({ calls: [{ name: "rename", args: { id: "t1", label: "Hall" } }] }) }));
      expect([response.status, await response.json()]).toMatchObject([status, { refused: true, reason, error: `Refused as ${reason}.` }]);
      const heard: LiveServerMessage[] = [];
      const connection = await handler.connect(new Request(`https://store.example${LIVE_PATH}`), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
      if (connection instanceof Response) throw new Error("refused");
      connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
      connection.receive(JSON.stringify({ t: "call", cid: "c1", batch: "batch:kimtab:1", calls: [{ name: "rename", args: { id: "t1", label: "Hall" } }] }));
      await new Promise((tick) => setTimeout(tick, 10));
      expect(heard.find((message) => message.t === "refused")).toMatchObject({ t: "refused", cid: "c1", reason });
      expect(handler.store.log.length).toBe(0);
    }
  });

  for (const live of [true, false]) {
    it(`an unknown refusal code is treated as final by the remote: taken back, handed on as it came, not sent again (${live ? "socket" : "HTTP"})`, async () => {
      let asked = 0;
      const handler = await hosted(() => (asked++, { refuse: "Not on this plan." }));
      const remote = await openRemote({ app, url: "https://store.example", principal: kim, live, pollMs: 0, backoff: () => 5, ...wired(handler, NEWER) });
      const told: RemoteRefusal[] = [];
      remote.onRefusal((_sentence, refusal) => told.push(refusal));
      remote.store.apply({ name: "rename", args: { id: "t1", label: "Hall" } });
      await remote.settled();
      expect(told).toEqual([{ reason: NEWER, sentence: "Not on this plan." }]);
      expect(remote.pending()).toBe(0);
      expect(remote.store.graph.getNode("t1")).toMatchObject({ label: "Book the hall" });
      // Asked once: final, not held and sent again as `unavailable` would be.
      await new Promise((tick) => setTimeout(tick, 40));
      expect(asked).toBe(1);
      const sent = await remote.send([{ name: "rename", args: { id: "t1", label: "Hall" } }]).catch((error: unknown) => error);
      expect(sent).toBeInstanceOf(RemoteRefusedError);
      expect((sent as RemoteRefusedError).refusal.reason).toBe(NEWER);
      remote.close();
    });
  }
});
