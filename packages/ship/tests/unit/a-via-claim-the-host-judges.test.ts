import { createSchema, defineApp, defineMutation, defineNode, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, type LiveClientMessage, type LivePeer, type LiveServerMessage, type LiveSocketLike } from "../../src/index.js";

/**
 * WHAT A CHANGE CAME THROUGH: THE CLIENT MAY CLAIM IT, THE HOST JUDGES (FR-52).
 *
 * A guest view applies through the page's store with `via: "view:<name>"`,
 * so the log can say a change came through somebody else's view. But
 * `openRemote` dropped the via a call was applied with, and the live
 * protocol read only the socket's own: every change through a view was
 * recorded as `web`. A client's word is still never enough on its own — a
 * browser could otherwise record its edit as Claude's — so `openRemote`
 * now sends the via it was given as a claim, and `liveProtocol({ viaOf })`
 * lets the host judge it: the claim is ignored unless the host says so.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const schema = createSchema([task]);
const app = defineApp({ name: "views", schema, mutations: [add], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });

const call = (cid: string, n: number, via?: string) => JSON.stringify({ t: "call", cid, batch: `batch:kimtab:${n}`, ...(via ? { via } : {}), calls: [{ name: "add", args: { id: `t${n}`, label: `T${n}` } }] });

async function opened(live: ReturnType<typeof liveProtocol<typeof schema>>) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(kim, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
  return peer;
}

describe("a via claim the host judges", () => {
  it("ignores a client's via unless the host judges it: FR-52 stands by default", async () => {
    const store = hostsStore();
    const live = liveProtocol({ store });
    const peer = await opened(live);
    await live.receive(peer, call("c1", 1, "mcp:Claude"));
    await live.post(JSON.stringify({ batch: "batch:kimtab:2", via: "mcp:Claude", calls: [{ name: "add", args: { id: "t2", label: "T2" } }] }), { seat: kim, via: "api" });
    expect(store.log.all().map((op) => op.via)).toEqual(["web", "api"]);
  });

  it("records a claim the host's viaOf accepts — a view — and its own word for one it does not", async () => {
    const store = hostsStore();
    const seen: [string, string | undefined][] = [];
    const live = liveProtocol({
      store,
      viaOf: (peer, claimed) => {
        seen.push([peer.via, claimed]);
        return claimed?.startsWith("view:") ? claimed : peer.via;
      },
    });
    const peer = await opened(live);
    await live.receive(peer, call("c1", 1, "view:board"));
    await live.receive(peer, call("c2", 2, "mcp:Claude"));
    await live.receive(peer, call("c3", 3));
    await live.post(JSON.stringify({ batch: "batch:kimtab:4", via: "view:board", calls: [{ name: "add", args: { id: "t4", label: "T4" } }] }), { seat: kim, via: "api" });
    expect(store.log.all().map((op) => op.via)).toEqual(["view:board", "web", "web", "view:board"]);
    expect(seen).toEqual([
      ["web", "view:board"],
      ["web", "mcp:Claude"],
      ["web", undefined],
      ["api", "view:board"],
    ]);
  });

  it("sends the via a call was applied with, as a claim, down the socket and over HTTP", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => kim });
    const posted: unknown[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") posted.push(JSON.parse(String(init.body)));
      return handler.handle(new Request(url, init));
    }) as typeof fetch;
    const polling = await openRemote({ app, url: "https://store.example", principal: kim, fetch: fetcher, pollMs: 0 });
    polling.store.apply({ name: "add", args: { id: "p1", label: "P1" } }, { via: "view:board" });
    polling.store.undo(polling.store.log.all().at(-1)!.batch, { via: "view:board" });
    await polling.settled();
    expect(posted).toMatchObject([{ via: "view:board" }, { via: "view:board", undo: [expect.any(String)] }]);
    polling.close();

    const said: LiveClientMessage[] = [];
    const socket = (): LiveSocketLike => {
      const fake: LiveSocketLike & { readyState: number } = {
        readyState: 0,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send: (text) => {
          const message = JSON.parse(text) as LiveClientMessage;
          said.push(message);
          if (message.t === "hello") setTimeout(() => fake.onmessage?.({ data: JSON.stringify({ t: "welcome", protocol: 1, version: 1, seq: -1, ops: [] }) }), 0);
        },
        close() {
          fake.readyState = 3;
        },
      };
      setTimeout(() => {
        fake.readyState = 1;
        fake.onopen?.({});
      }, 0);
      return fake;
    };
    const live = await openRemote({ app, url: "https://store.example", principal: kim, fetch: fetcher, live: true, pollMs: 0, socket });
    live.store.apply({ name: "add", args: { id: "s1", label: "S1" } }, { via: "view:board" });
    expect(said.find((message) => message.t === "call")).toMatchObject({ t: "call", via: "view:board" });
    live.close();
    await handler.close();
  });
});
