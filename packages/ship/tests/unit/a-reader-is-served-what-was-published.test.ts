import { bindSchema, createSchema, defineApp, defineNode, PUBLISH, Store, type Operation, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cursorAt, liveProtocol, type LivePeer, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A READER IS SERVED WHAT WAS PUBLISHED (Roadmap f-publishing-lifecycle),
 * on the wire as in the store: a reader's socket, `/graview/state` and
 * `/graview/since` stop at the publish; at the next publish the reader's
 * socket is sent the ops between the two; a publish taken back sends it
 * the whole state again, never ops it should not hold; and a socket that
 * resumes behind the compaction horizon is sent the whole state rather
 * than the ops after the horizon as though those before had been sent.
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
const app = defineApp({
  name: "published",
  schema,
  mutations: [add],
  policy: { roles: ["editor", "visitor"], grants: [{ roles: ["editor"], mutations: "*" }, { roles: ["visitor"], mutations: ["add"] }] },
  publishing: { mode: "on-publish", working: ["editor"] },
  version: 1,
});
const eve: Principal = { kind: "human", id: "eve", name: "Eve", roles: ["editor"] };
const reader: Principal = { kind: "human", id: "form:1", name: "A visitor", roles: ["visitor"] };

const hostsStore = (publishes = true) =>
  new Store({ schema, mutations: app.mutations ?? [], policy: app.policy!, ...(publishes ? { publishing: app.publishing! } : {}), snapshot: { nodes: [{ id: "t0", kind: "task", label: "Seeded" }], edges: [] } as never });

function peerOf(live: ReturnType<typeof liveProtocol<typeof schema>>, seat: Principal) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  return { peer, heard };
}
const call = (cid: string, name: string, args: Record<string, unknown>) => JSON.stringify({ t: "call", cid, calls: [{ name, args }] });
const added = (heard: readonly LiveServerMessage[]) => heard.flatMap((message) => (message.t === "ops" ? message.ops : [])).flatMap((op: Operation) => op.primitives.flatMap((one) => (one.op === "add-node" ? [one.node.id] : [])));

/** A store, its protocol, and every landed op published to every socket, as a host does. */
function hosted(store = hostsStore()) {
  const live = liveProtocol({ store, version: 1 });
  const peers: LivePeer[] = [];
  const open = async (seat: Principal, seq = -1) => {
    const one = peerOf(live, seat);
    peers.push(one.peer);
    await live.receive(one.peer, JSON.stringify({ t: "hello", seq }), [], peers);
    return one;
  };
  const act = async (by: { peer: LivePeer }, cid: string, name: string, args: Record<string, unknown> = {}) => {
    const before = store.log.length;
    await live.receive(by.peer, call(cid, name, args), [], peers);
    live.publish(store.log.opsFrom(before), peers);
  };
  return { store, live, open, act };
}

describe("a reader's socket in an app that publishes", () => {
  it("is not sent an edit until it is published, and then is sent the ops between", async () => {
    const { open, act } = hosted();
    const editor = await open(eve);
    const visitor = await open(reader);
    await act(editor, "e1", "add", { id: "draft", label: "Draft" });
    expect(added(visitor.heard)).toEqual([]);
    expect(added(editor.heard)).toEqual([]); // its own come in the ack
    await act(editor, "e2", PUBLISH);
    expect(added(visitor.heard)).toEqual(["draft"]);
    const last = visitor.heard.at(-1) as Extract<LiveServerMessage, { t: "ops" }>;
    expect(last.ops.at(-1)).toMatchObject({ publishedThrough: 2 });
  });

  it("is sent the whole state again when the publish is taken back, and never the ops past it", async () => {
    const { store, open, act, live } = hosted();
    const editor = await open(eve);
    const visitor = await open(reader);
    await act(editor, "e1", "add", { id: "draft", label: "Draft" });
    await act(editor, "e2", PUBLISH);
    const published = store.log.all().at(-1)!.batch;
    const before = visitor.heard.length;
    await live.receive(editor.peer, JSON.stringify({ t: "undo", cid: "e3", batches: [published] }));
    live.publish(store.log.opsFrom(store.log.length - 1), [visitor.peer, editor.peer]);
    const reset = visitor.heard.slice(before).find((message) => message.t === "welcome") as Extract<LiveServerMessage, { t: "welcome" }> | undefined;
    expect(reset?.state?.snapshot.nodes.map((node) => node.id)).toEqual(["t0"]);
    expect(reset).toMatchObject({ seq: cursorAt(-1), servedThrough: cursorAt(-1), ops: [] });
  });

  it("lands a visitor's call on the head, acks it, and sends nobody else's unpublished ops with the ack", async () => {
    const { store, open, act } = hosted();
    const editor = await open(eve);
    const visitor = await open(reader);
    await act(editor, "e1", "add", { id: "draft", label: "Draft" });
    await act(visitor, "v1", "add", { id: "answer", label: "An answer" });
    expect(store.graph.getNode("answer")).toBeDefined();
    expect(visitor.heard.find((message) => message.t === "ack")).toMatchObject({ cid: "v1" });
    expect(added(visitor.heard)).toEqual([]);
    expect(JSON.stringify(visitor.heard)).not.toContain("draft");
  });

  it("is served through the publish on /graview/state and /graview/since, and says so", async () => {
    const { live, open, act } = hosted();
    const editor = await open(eve);
    await act(editor, "e1", "add", { id: "one", label: "One" });
    await act(editor, "e2", PUBLISH);
    await act(editor, "e3", "add", { id: "two", label: "Two" });
    const state = live.state({ seat: reader, via: "web" }).body as { snapshot: { nodes: { id: string }[] }; log: Operation[]; servedThrough: string };
    expect(state.snapshot.nodes.map((node) => node.id).sort()).toEqual(["one", "t0"]);
    expect(state.log).toHaveLength(2);
    expect(state.servedThrough).toBe(cursorAt(1));
    expect(live.since(-1, { seat: reader, via: "web" }).body).toMatchObject({ ops: [{ seq: 0 }, { seq: 1 }], servedThrough: cursorAt(1) });
    expect((live.since(-1, { seat: eve, via: "web" }).body as { ops: Operation[] }).ops).toHaveLength(3);
  });

  it("previews nothing for a live app: no servedThrough on the wire", async () => {
    const { live } = hosted(hostsStore(false));
    expect(live.state({ seat: reader, via: "web" }).body).not.toHaveProperty("servedThrough");
  });
});

describe("a socket that resumes behind the compaction horizon", () => {
  async function compacted() {
    const store = hostsStore(false);
    for (let n = 0; n < 8; n++) store.apply({ name: "add", args: { id: `t${n + 1}`, label: `T${n + 1}` } }, { author: eve });
    store.compact(store.checkpoint({ seq: 6 })!);
    return { store, live: liveProtocol({ store, version: 1 }) };
  }

  it("is sent the whole state, not the ops after the horizon as though those before had come", async () => {
    const { store, live } = await compacted();
    const { peer, heard } = peerOf(live, eve);
    await live.receive(peer, JSON.stringify({ t: "hello", seq: 2 }));
    const welcome = heard[0] as Extract<LiveServerMessage, { t: "welcome" }>;
    expect(welcome.ops).toEqual([]);
    expect(welcome.state?.horizon).toBe(6);
    expect(welcome.seq).toBe(cursorAt(store.log.length - 1));
  });

  it("is told to take the state on /graview/since, with the ops after the horizon for a client that predates being told", async () => {
    const { live } = await compacted();
    expect(live.since(2, { seat: eve, via: "web" }).body).toMatchObject({ reset: true, horizon: 6, ops: [{ seq: 6 }, { seq: 7 }] });
    expect(live.since(6, { seat: eve, via: "web" }).body).not.toHaveProperty("reset");
  });
});
