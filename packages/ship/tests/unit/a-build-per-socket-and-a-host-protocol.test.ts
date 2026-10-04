import { bindSchema, createSchema, defineApp, defineNode, Store, WIRE_PROTOCOL, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, type LiveClientMessage, type LivePeer, type LiveServerMessage, type LiveSocketLike } from "../../src/index.js";

/**
 * THE BUILD IS THE SOCKET'S, AND A HOST NUMBERS ITS OWN PROTOCOL (FR-44).
 *
 * `liveProtocol({ build })` was one string for the protocol, but a host
 * like Graview Cloud learns the build per upgrade — the worker that carried
 * the socket says which shell it serves. And a host that changes its own
 * half of the wire (its routing, its auth, its shell) had no way to send
 * an old page `reload` with its unsent calls carried: `minProtocol` judges
 * ship's `WIRE_PROTOCOL`, which a host does not move. Now the build is
 * said at `open(seat, via, { build })`, or by a function of the socket;
 * and `openRemote({ hostProtocol })` says the host's own number in its
 * hello, which `liveProtocol({ minHostProtocol })` answers `reload` below.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const app = defineApp({ name: "skew", schema, mutations: [add], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });

function peerOf(state: ReturnType<ReturnType<typeof liveProtocol<typeof schema>>["open"]>) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...state, send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  return { peer, heard };
}

describe("a build per socket, and a host protocol", () => {
  it("welcomes each socket with the build it was opened under, else the protocol's word for it", async () => {
    const live = liveProtocol({ store: hostsStore(), build: (peer) => (peer.via === "mcp" ? "agent-shell" : "b-default") });
    const old = peerOf(live.open(kim, "web", { build: "b-old" }));
    const fresh = peerOf(live.open(kim, "web", { build: "b-new" }));
    const plain = peerOf(live.open(kim, "web"));
    const agent = peerOf(live.open(kim, "mcp"));
    for (const one of [old, fresh, plain, agent]) await live.receive(one.peer, JSON.stringify({ t: "hello", seq: -1 }));
    expect([old, fresh, plain, agent].map((one) => (one.heard[0] as Extract<LiveServerMessage, { t: "welcome" }>).build)).toEqual(["b-old", "b-new", "b-default", "agent-shell"]);
    // The socket's own build survives a hibernation: it is in the state the host keeps.
    expect(JSON.parse(JSON.stringify(old.peer))).toMatchObject({ hostBuild: "b-old" });
    // A route answers with the build its request says, or the protocol's.
    expect(live.since(-1, { seat: kim, via: "api", build: "b-route" }).body).toMatchObject({ build: "b-route" });
    expect(live.since(-1, { seat: kim, via: "api" }).body).toMatchObject({ build: "b-default" });
  });

  it("answers a hello below the host's protocol with reload, and welcomes one at it; WIRE_PROTOCOL stays the wire's", async () => {
    const live = liveProtocol({ store: hostsStore(), minHostProtocol: 3 });
    const below = peerOf(live.open(kim, "web"));
    const unsaid = peerOf(live.open(kim, "web"));
    const at = peerOf(live.open(kim, "web"));
    await live.receive(below.peer, JSON.stringify({ t: "hello", seq: -1, protocol: WIRE_PROTOCOL, hostProtocol: 2 }));
    await live.receive(unsaid.peer, JSON.stringify({ t: "hello", seq: -1, protocol: WIRE_PROTOCOL }));
    await live.receive(at.peer, JSON.stringify({ t: "hello", seq: -1, protocol: WIRE_PROTOCOL, hostProtocol: 3 }));
    expect(below.heard).toEqual([{ t: "reload", reason: expect.stringMatching(/Reload the page/), protocol: WIRE_PROTOCOL, hostProtocol: 3 }]);
    expect(unsaid.heard[0]).toMatchObject({ t: "reload", hostProtocol: 3 });
    expect(below.peer.cursor).toBeUndefined();
    expect(at.heard[0]).toMatchObject({ t: "welcome", protocol: WIRE_PROTOCOL });
    // Its calls are refused until it says hello on one served.
    await live.receive(below.peer, JSON.stringify({ t: "call", cid: "c", calls: [{ name: "add", args: { id: "a", label: "A" } }] }));
    expect(below.heard.at(-1)).toMatchObject({ t: "refused", reason: "invalid" });
  });

  it("says the host's protocol in openRemote's hello", async () => {
    const handler = await createStoreHandler({ app, store: hostsStore(), seatOf: () => kim });
    const fetcher = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
    const said: LiveClientMessage[] = [];
    const socket = (): LiveSocketLike => {
      const fake: LiveSocketLike & { readyState: number } = {
        readyState: 0,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send: (text) => void said.push(JSON.parse(text) as LiveClientMessage),
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
    const remote = await openRemote({ app, url: "https://store.example", principal: kim, fetch: fetcher, live: true, pollMs: 0, openTimeoutMs: 30, socket, hostProtocol: 3 });
    expect(said.find((message) => message.t === "hello")).toMatchObject({ t: "hello", protocol: WIRE_PROTOCOL, hostProtocol: 3 });
    remote.close();
    await handler.close();
  });
});
