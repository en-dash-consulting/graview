import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, nodeRef, Store, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, openRemote, seatHeaders, type LivePeer, type LiveServerMessage, type LiveSocketLike, type RemoteStore, type StoreHandler, type StoredMeta } from "../../src/index.js";

/**
 * THE DECLARATION CHANGED UNDER OPEN TABS (FR-43).
 *
 * A structural change — a field added from a chat, from the studio, from
 * graview.cloud — used to reach an open tab only when somebody reloaded it,
 * and whatever that tab had on its way was lost with the page. Now the host
 * tells the handler (`declarationChanged`), every socket is told
 * `{ t: "declaration", version }`, and `openRemote` hands each tab a new
 * remote store on the server's migrated state, its own changes still on the
 * way offered again under the new declaration, or refused in words.
 */

const taskV1 = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean(), note: z.string().optional() }), plural: "Tasks", label: (node) => node.label });
const taskV2 = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean(), note: z.string().optional(), priority: z.number().int() }),
  plural: "Tasks",
  label: (node) => node.label,
});
const renameOf = () =>
  defineMutation("rename", {
    title: "Rename",
    subject: { kinds: ["task"], arg: "id" },
    writes: ["label"],
    input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
    describe: (args) => `Rename to “${args.label}”`,
    apply(ctx, args) {
      ctx.patchNode(args.id, { label: args.label });
    },
  });
const annotate = defineMutation("annotate", {
  title: "Note",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["task"]), note: z.string() }),
  describe: (args) => `Note “${args.note}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { note: args.note });
  },
});
const policy = { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" as const, describe: "The keeper keeps everything." }] };
const v1 = defineApp({ name: "declared", schema: createSchema([taskV1]), mutations: [renameOf(), annotate], policy, version: 1 });
/** Version 2 adds a field, and no longer has a way to note a task. */
const v2 = defineApp({
  name: "declared",
  schema: createSchema([taskV2]),
  mutations: [renameOf()],
  policy,
  version: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      title: "every task gets a priority",
      apply: (snapshot) => snapshot.nodes.map((node) => ({ op: "patch-node" as const, id: node.id, before: { priority: undefined }, after: { priority: 0 } })),
    },
  ],
});
const seed = {
  nodes: [
    { id: "t1", kind: "task", label: "Book the hall", done: false },
    { id: "t2", kind: "task", label: "Pay the deposit", done: false },
  ],
  edges: [],
};
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: ["keeper"] };
const ana: Principal = { kind: "human", id: "ana", name: "Ana", roles: ["keeper"] };

const until = async (holds: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

/**
 * A tab's sockets onto a handler, whose traffic the test can hold: calls
 * going up, and acks coming down. Every message the tab is told is kept.
 */
function tabOn(handler: StoreHandler<AnySchema>, principal: Principal) {
  const tab = { holdUp: false, dropAcks: false, held: [] as string[], heard: [] as LiveServerMessage[], hellos: [] as Record<string, unknown>[] };
  const socket = (url: string): LiveSocketLike => {
    let deliver: (text: string) => void = () => {};
    const fake = {
      readyState: 0,
      onopen: null as null | ((event: unknown) => void),
      onmessage: null as null | ((event: { data: unknown }) => void),
      onclose: null as null | ((event: { code: number; reason: string }) => void),
      onerror: null as null | ((event: unknown) => void),
      send(text: string) {
        const message = JSON.parse(text) as { t: string };
        if (message.t === "hello") tab.hellos.push(message);
        if (tab.holdUp && message.t === "call") tab.held.push(text);
        else deliver(text);
      },
      close() {
        fake.readyState = 3;
        closeServer();
      },
    };
    let closeServer: () => void = () => {};
    void handler
      .connect(new Request(url.replace(/^ws/, "http"), { headers: seatHeaders(principal) }), {
        send: (text) =>
          setTimeout(() => {
            if (fake.readyState !== 1) return;
            const message = JSON.parse(text) as LiveServerMessage;
            if (tab.dropAcks && message.t === "ack") return;
            tab.heard.push(message);
            fake.onmessage?.({ data: text });
          }, 0),
        close: () => fake.close(),
      })
      .then((connection) => {
        if (connection instanceof Response) throw new Error("refused");
        deliver = (text) => connection.receive(text);
        closeServer = () => connection.close();
        fake.readyState = 1;
        fake.onopen?.({});
      });
    return fake;
  };
  const fetch = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof globalThis.fetch;
  return { tab, socket, fetch };
}

describe("the declaration changes under open tabs", () => {
  it("hands two open tabs a store on the new declaration, their pending calls offered again or refused in words, without a reload", async () => {
    // An adapter that keeps the version it stored at, as the file, browser and Durable Object ones do.
    const metas = new Map<string, StoredMeta>();
    const adapter = { ...createMemoryAdapter(), name: "memory", loadMeta: (scope: string) => metas.get(scope) ?? null, saveMeta: (scope: string, meta: StoredMeta) => void metas.set(scope, meta) };
    const handler = await createStoreHandler({ app: v1, adapter, seed: seed as never, trustSeatHeaders: true });
    const reloads: string[] = [];
    const openTab = async (principal: Principal) => {
      const { tab, socket, fetch } = tabOn(handler as never, principal);
      const remote = await openRemote({
        app: v1,
        url: "http://store.example",
        principal,
        live: true,
        pollMs: 0,
        socket,
        fetch,
        resolveApp: (version) => (version === 2 ? v2 : v1),
        reloadPage: () => reloads.push(principal.id!),
      });
      const next: { remote?: RemoteStore<AnySchema>; version?: number } = {};
      const refusals: string[] = [];
      remote.onDeclaration((store, version) => {
        next.remote = store;
        next.version = version;
        store.onRefusal((sentence) => refusals.push(sentence));
      });
      return { remote, tab, next, refusals };
    };
    const one = await openTab(sam);
    const two = await openTab(ana);
    one.remote.presence.here({ participant: "human:sam:tab", hue: 10, stop: "/tasks", at: new Date().toISOString() });
    expect(one.remote.version).toBe(1);
    // The welcome says which declaration it serves.
    expect(one.tab.heard.find((message) => message.t === "welcome")).toMatchObject({ version: 1 });

    // Sam's rename is sent and lands, but its answer never reaches him before the change: it must not be made twice.
    one.tab.dropAcks = true;
    one.remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    await until(() => handler.store.log.length === 1);
    // Ana's two changes never leave her tab before the change.
    two.tab.holdUp = true;
    two.remote.store.apply({ name: "rename", args: { id: "t2", label: "Pay it today" } });
    two.remote.store.apply({ name: "annotate", args: { id: "t1", note: "Ask about chairs" } });
    expect((two.remote.store.graph.getNode("t2") as { label: string }).label).toBe("Pay it today");

    // The host adds a field. Every socket is told.
    one.tab.dropAcks = false;
    two.tab.holdUp = false;
    two.tab.held.length = 0;
    await handler.declarationChanged({ app: v2 });
    expect(handler.store.graph.getNode("t1")).toMatchObject({ priority: 0 });
    await until(() => !!one.next.remote && !!two.next.remote);
    expect(one.tab.heard.some((message) => message.t === "declaration" && message.version === 2)).toBe(true);
    expect(two.tab.heard.some((message) => message.t === "declaration" && message.version === 2)).toBe(true);
    await Promise.all([one.next.remote!.settled(), two.next.remote!.settled()]);

    for (const tab of [one, two]) {
      const next = tab.next.remote!;
      expect(tab.next.version).toBe(2);
      expect(next.version).toBe(2);
      // A store on the new declaration: the field is there, and the schema knows it.
      expect(next.store.graph.getNode("t1")).toMatchObject({ priority: 0 });
      expect(next.store.schema).toBe(v2.schema);
      // The old store is retired, not the page.
      expect(next.store).not.toBe(tab.remote.store);
    }
    expect(reloads).toEqual([]);

    // Ana's rename was offered again under version 2, and landed once.
    expect(handler.store.graph.getNode("t2")).toMatchObject({ label: "Pay it today", priority: 0 });
    expect(two.next.remote!.store.graph.getNode("t2")).toMatchObject({ label: "Pay it today" });
    // Her note no longer fits — version 2 has no way to note a task — and she is told so in words.
    expect(two.refusals).toHaveLength(1);
    expect(two.refusals[0]).toMatch(/changed while/);
    expect(two.refusals[0]).toMatch(/annotate/);
    expect(handler.store.graph.getNode("t1")).not.toHaveProperty("note");
    // Sam's had already landed: it is not made a second time.
    expect(handler.store.log.all().filter((op) => op.intent === "Rename to “Book the big hall”")).toHaveLength(1);
    expect(one.refusals).toEqual([]);
    // Both tabs agree with the server, op for op.
    const ids = (store: { log: { all(): readonly { id: string }[] } }) => store.log.all().map((op) => op.id);
    expect(ids(one.next.remote!.store)).toEqual(ids(handler.store));
    expect(ids(two.next.remote!.store)).toEqual(ids(handler.store));

    // And the new stores are live: a change on one reaches the other.
    one.next.remote!.store.apply({ name: "rename", args: { id: "t1", label: "Book the church hall" } });
    await until(() => (two.next.remote!.store.graph.getNode("t1") as { label: string }).label === "Book the church hall");
    // Where Sam stands came across with him; letting the old store go does not say he left.
    const who = async () => ((await (await handler.handle(new Request("http://store.example/graview/who", { headers: seatHeaders(ana) }))).json()) as { who: { participant: string }[] }).who.map((presence) => presence.participant);
    one.remote.close();
    two.remote.close();
    await new Promise((tick) => setTimeout(tick, 10));
    expect(await who()).toContain("human:sam:tab");
    one.next.remote!.close();
    two.next.remote!.close();
    await handler.close();
  });

  it("tells two polling tabs on their next answer, and hands each a store on the new declaration with its pending calls offered again, without a reload", async () => {
    const metas = new Map<string, StoredMeta>();
    const adapter = { ...createMemoryAdapter(), name: "memory", loadMeta: (scope: string) => metas.get(scope) ?? null, saveMeta: (scope: string, meta: StoredMeta) => void metas.set(scope, meta) };
    const handler = await createStoreHandler({ app: v1, adapter, seed: seed as never, trustSeatHeaders: true, build: "b2" });
    const reloads: string[] = [];
    /**
     * A polling tab whose posts the test can hold: before they reach the
     * server (`before`), or after the server answered, on the way back (`after`).
     */
    const openTab = async (principal: Principal) => {
      const hold = { mode: "none" as "none" | "before" | "after", held: [] as (() => void)[] };
      const fetch = (async (url: string, init?: RequestInit) => {
        const posting = url.endsWith("/graview/ops");
        if (posting && hold.mode === "before") await new Promise<void>((go) => hold.held.push(go));
        const response = await handler.handle(new Request(url, init));
        if (posting && hold.mode === "after") await new Promise<void>((go) => hold.held.push(go));
        return response;
      }) as typeof globalThis.fetch;
      const remote = await openRemote({
        app: v1,
        url: "http://store.example",
        principal,
        pollMs: 0,
        fetch,
        resolveApp: (version) => (version === 2 ? v2 : v1),
        reloadPage: () => reloads.push(principal.id!),
      });
      const next: { remote?: RemoteStore<AnySchema>; version?: number } = {};
      const refusals: string[] = [];
      remote.onDeclaration((store, version) => {
        next.remote = store;
        next.version = version;
        store.onRefusal((sentence) => refusals.push(sentence));
      });
      return { remote, hold, next, refusals };
    };
    const one = await openTab(sam);
    const two = await openTab(ana);
    expect(one.remote.transport()).toBe("poll");

    // Sam's rename reaches the server and lands; its answer is still on the way back when the change comes.
    one.hold.mode = "after";
    one.remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    await until(() => handler.store.log.length === 1);
    // Ana's two changes have not reached the server.
    two.hold.mode = "before";
    two.remote.store.apply({ name: "rename", args: { id: "t2", label: "Pay it today" } });
    two.remote.store.apply({ name: "annotate", args: { id: "t1", note: "Ask about chairs" } });
    await until(() => two.hold.held.length === 2);

    await handler.declarationChanged({ app: v2 });
    // The next answer each tab reads says the declaration moved.
    one.hold.mode = "none";
    two.hold.mode = "none";
    await one.remote.pull();
    await two.remote.pull();
    await until(() => !!one.next.remote && !!two.next.remote);
    // What was held goes now, from stores already let go: answered, never made twice, never said refused.
    for (const go of [...one.hold.held.splice(0), ...two.hold.held.splice(0)]) go();
    await Promise.all([one.next.remote!.settled(), two.next.remote!.settled(), one.remote.settled(), two.remote.settled()]);
    await Promise.all([one.next.remote!.pull(), two.next.remote!.pull()]);

    for (const tab of [one, two]) {
      expect(tab.next.version).toBe(2);
      expect(tab.next.remote!.version).toBe(2);
      expect(tab.next.remote!.store.schema).toBe(v2.schema);
      expect(tab.next.remote!.store.graph.getNode("t1")).toMatchObject({ priority: 0 });
    }
    expect(reloads).toEqual([]);
    expect(handler.store.log.all().filter((op) => op.intent === "Rename to “Book the big hall”")).toHaveLength(1);
    expect(handler.store.log.all().filter((op) => op.intent === "Rename to “Pay it today”")).toHaveLength(1);
    expect(handler.store.graph.getNode("t2")).toMatchObject({ label: "Pay it today", priority: 0 });
    expect(handler.store.graph.getNode("t1")).not.toHaveProperty("note");
    expect(two.refusals).toHaveLength(1);
    expect(two.refusals[0]).toMatch(/annotate/);
    expect(one.refusals).toEqual([]);
    const ids = (store: { log: { all(): readonly { id: string }[] } }) => store.log.all().map((op) => op.id);
    expect(ids(one.next.remote!.store)).toEqual(ids(handler.store));
    expect(ids(two.next.remote!.store)).toEqual(ids(handler.store));
    // A poll's answer says the build too: a tab on another one is told once.
    const said = (await (await handler.handle(new Request("http://store.example/graview/since?seq=-1", { headers: seatHeaders(sam) }))).json()) as { version: number; build: string };
    expect(said).toMatchObject({ version: 2, build: "b2" });
    for (const remote of [one.next.remote!, two.next.remote!, one.remote, two.remote]) remote.close();
    await handler.close();
  });

  it("swaps the declaration over a store the host holds, and asks for the new store", async () => {
    const store = new Store({ schema: v1.schema, mutations: v1.mutations ?? [], policy: v1.policy!, snapshot: seed as never });
    const handler = await createStoreHandler({ app: v1, store, seatOf: () => sam });
    await expect(handler.declarationChanged({ app: v2 } as never)).rejects.toThrow(/store/);
    const next = new Store({ schema: v2.schema, mutations: v2.mutations ?? [], policy: v2.policy!, snapshot: { nodes: seed.nodes.map((node) => ({ ...node, priority: 0 })), edges: [] } as never });
    await handler.declarationChanged({ app: v2, store: next, migrated: ["every task gets a priority"] });
    expect(handler.store).toBe(next);
    const state = (await (await handler.handle(new Request("https://store.example/graview/state"))).json()) as { version: number; migrated: string[] };
    expect(state).toMatchObject({ version: 2, migrated: ["every task gets a priority"] });
    await handler.close();
  });

  it("tells a sleeping host's sockets through the protocol, and forgets their cursors so they say hello again", async () => {
    const store = new Store({ schema: v1.schema, mutations: v1.mutations ?? [], policy: v1.policy!, snapshot: seed as never });
    const heard: LiveServerMessage[] = [];
    const peer: LivePeer = { seat: sam, via: "web", send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await liveProtocol({ store, version: 1 }).receive(peer, JSON.stringify({ t: "hello" }));
    expect(heard[0]).toMatchObject({ t: "welcome", version: 1 });
    const next = liveProtocol({ store, version: 2 });
    next.declared([peer]);
    expect(heard.at(-1)).toEqual({ t: "declaration", version: 2 });
    expect(peer.cursor).toBeUndefined();
    // A call before the new hello is not served under a declaration the client does not have.
    await next.receive(peer, JSON.stringify({ t: "call", cid: "c1", calls: [{ name: "rename", args: { id: "t1", label: "x" } }] }));
    expect(heard.at(-1)).toMatchObject({ t: "refused", cid: "c1" });
    expect(store.log.length).toBe(0);
  });
});
