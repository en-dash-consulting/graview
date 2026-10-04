import { createSchema, defineApp, defineMutation, defineNode, nodeRef, Store, type AnySchema, type Presence, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote, seatHeaders, type LiveSocketLike, type RemoteStatus, type RemoteStore, type StoreHandler } from "../../src/index.js";

/**
 * A DECLARATION SWAP CARRIES THE HOST'S WIRING.
 *
 * `onDeclaration` handed a host a fresh remote store with nothing wired:
 * every listener had to be put on it again, and by the time the host
 * subscribed to who is here, the new store had already heard the
 * welcome's presence — so the room looked empty until somebody moved. And
 * the counters started again from nothing, so a beacon read a reconnect
 * storm as a quiet page. Now `onWho` tells a late listener the list at
 * once, `who()` says it any time, and every listener a host put on the
 * first store — `onRefusal`, `onConflict`, `onStatus`, `onBuild`, `onWho`,
 * `onDeclaration` — is carried to each store that replaces it, with the
 * counters running on. A host writes its listeners once.
 */
const taskOf = (extra: Record<string, z.ZodType> = {}) =>
  defineNode("task", { fields: z.object({ label: z.string().min(1), ...extra }), plural: "Tasks", label: (node) => node.label });
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
const policy = { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" as const }] };
const versions = new Map<number, ReturnType<typeof defineApp>>([
  [1, defineApp({ name: "wired", schema: createSchema([taskOf()]), mutations: [renameOf()], policy, version: 1 })],
  [2, defineApp({ name: "wired", schema: createSchema([taskOf({ note: z.string().optional() })]), mutations: [renameOf()], policy, version: 2 })],
  [3, defineApp({ name: "wired", schema: createSchema([taskOf({ note: z.string().optional(), due: z.string().optional() })]), mutations: [renameOf()], policy, version: 3 })],
]);
const appAt = (version: number) => versions.get(version)! as never as ReturnType<typeof defineApp>;
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall" }], edges: [] };
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: ["keeper"] };
const ana: Principal = { kind: "human", id: "ana", name: "Ana", roles: ["keeper"] };

const until = async (holds: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

/** Sockets onto the handler for one seat: calls can be held back, and the open one dropped as a network drops it. */
function aTab(handler: StoreHandler<AnySchema>, principal: Principal) {
  const tab = { holdUp: false, held: [] as (() => void)[], drop: () => {} };
  const socket = (url: string): LiveSocketLike => {
    let deliver: (text: string) => void = () => {};
    let closeServer: () => void = () => {};
    const fake = {
      readyState: 0,
      onopen: null as null | ((event: unknown) => void),
      onmessage: null as null | ((event: { data: unknown }) => void),
      onclose: null as null | ((event: { code: number; reason: string }) => void),
      onerror: null as null | ((event: unknown) => void),
      send(text: string) {
        if (tab.holdUp && text.includes('"t":"call"')) tab.held.push(() => deliver(text));
        else deliver(text);
      },
      close() {
        if (fake.readyState === 3) return;
        fake.readyState = 3;
        closeServer();
      },
    };
    tab.drop = () => {
      fake.close();
      fake.onclose?.({ code: 1006, reason: "" });
    };
    void handler
      .connect(new Request(url.replace(/^ws/, "http"), { headers: seatHeaders(principal) }), {
        send: (text) => setTimeout(() => fake.readyState === 1 && fake.onmessage?.({ data: text }), 0),
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

const opened: RemoteStore<AnySchema>[] = [];
afterEach(() => {
  for (const remote of opened.splice(0)) remote.close();
});

describe("a declaration swap carries the host's wiring", () => {
  it("onWho tells a late listener who is here at once, and who() says it", async () => {
    const handler = (await createStoreHandler({ app: appAt(1), store: new Store({ schema: appAt(1).schema, mutations: appAt(1).mutations ?? [], policy, snapshot: seed as never }), trustSeatHeaders: true })) as unknown as StoreHandler<AnySchema>;
    const samTab = aTab(handler, sam);
    const anaTab = aTab(handler, ana);
    const anaRemote = await openRemote({ app: appAt(1), url: "http://room.example", principal: ana, live: true, pollMs: 0, ...anaTab });
    opened.push(anaRemote as never);
    anaRemote.presence.here({ participant: "human:ana:tab", name: "Ana", hue: 1, stop: "/tasks", at: new Date().toISOString() });
    await new Promise((tick) => setTimeout(tick, 10));
    const samRemote = await openRemote({ app: appAt(1), url: "http://room.example", principal: sam, live: true, pollMs: 0, ...samTab });
    opened.push(samRemote as never);
    await until(() => samRemote.who().length === 1);
    // Subscribed after the welcome's presence had landed: told at once, not when somebody next moves.
    let told: readonly Presence[] | undefined;
    samRemote.presence.onWho((who) => (told = who));
    expect(told?.map((one) => one.name)).toEqual(["Ana"]);
    expect(samRemote.who().map((one) => one.name)).toEqual(["Ana"]);
    await handler.close();
  });

  it("carries every listener and the counters through two declaration swaps in a row", async () => {
    const handler = (await createStoreHandler({
      app: appAt(1),
      store: new Store({ schema: appAt(1).schema, mutations: appAt(1).mutations ?? [], policy, snapshot: seed as never }),
      trustSeatHeaders: true,
      build: "b2",
      limit: ({ calls }) => (calls.some((call) => (call.args as { label?: string }).label === "Nope") ? { refuse: "Not that one." } : undefined),
    })) as unknown as StoreHandler<AnySchema>;
    const swapTo = async (version: number) => {
      const app = appAt(version);
      await handler.declarationChanged({ app, store: new Store({ schema: app.schema, mutations: app.mutations ?? [], policy, snapshot: handler.store.snapshot() as never }) });
    };
    const samTab = aTab(handler, sam);
    const anaTab = aTab(handler, ana);
    const anaRemote = await openRemote({ app: appAt(1), url: "http://room.example", principal: ana, live: true, pollMs: 0, ...anaTab, resolveApp: appAt });
    opened.push(anaRemote as never);
    anaRemote.presence.here({ participant: "human:ana:tab", name: "Ana", hue: 1, stop: "/tasks", at: new Date().toISOString() });

    const first = await openRemote({ app: appAt(1), url: "http://room.example", principal: sam, live: true, pollMs: 0, ...samTab, build: "b1", backoff: () => 5, resolveApp: appAt });
    opened.push(first as never);
    // THE HOST'S WIRING, written once, on the first store.
    const heard = { refusals: [] as string[], conflicts: [] as string[], statuses: [] as RemoteStatus[], builds: [] as string[], who: [] as string[][], swaps: [] as [RemoteStore<AnySchema>, number][] };
    first.onRefusal((sentence) => heard.refusals.push(sentence));
    first.onConflict((conflict) => {
      heard.conflicts.push(conflict.sentence);
      conflict.keepTheirs();
    });
    first.onStatus((status) => heard.statuses.push(status));
    first.onBuild((build) => heard.builds.push(build));
    first.presence.onWho((who) => heard.who.push(who.map((one) => one.name ?? "")));
    first.onDeclaration((next, version) => heard.swaps.push([next, version]));
    let current: RemoteStore<AnySchema> = first;
    const latest = () => heard.swaps.at(-1)?.[0] ?? first;

    await until(() => heard.who.at(-1)?.join() === "Ana");
    expect(heard.builds).toEqual(["b2"]);

    // A conflict on the first store.
    const conflictOn = async (remote: RemoteStore<AnySchema>, mine: string, theirs: string) => {
      samTab.tab.holdUp = true;
      remote.store.apply({ name: "rename", args: { id: "t1", label: mine } });
      handler.store.apply({ name: "rename", args: { id: "t1", label: theirs } }, { author: ana });
      await new Promise((tick) => setTimeout(tick, 10));
      samTab.tab.holdUp = false;
      for (const release of samTab.tab.held.splice(0)) release();
      await remote.settled();
    };
    await conflictOn(first, "Book the big hall", "Book the church hall");
    expect(heard.conflicts).toHaveLength(1);
    expect(first.counters().conflicts).toBe(1);

    // Two declaration swaps in a row.
    for (const version of [2, 3]) {
      heard.who.length = 0;
      await swapTo(version);
      await until(() => heard.swaps.length === version - 1 && latest().version === version);
      current = latest();
      opened.push(current);
      // The room as the new store heard it in its welcome, on the listener the host put on the first store.
      await until(() => heard.who.at(-1)?.join() === "Ana");
      expect(current.who().map((one) => one.name)).toEqual(["Ana"]);
    }
    expect(heard.swaps.map(([, version]) => version)).toEqual([2, 3]);
    // Each swap told once: carried, not added again.
    expect(new Set(heard.swaps.map(([next]) => next)).size).toBe(2);
    // The build was noticed once, on the first store, and is not noticed again on each one after it.
    expect(heard.builds).toEqual(["b2"]);

    // A refusal and a conflict on the third store reach the listeners put on the first.
    current.store.apply({ name: "rename", args: { id: "t1", label: "Nope" } });
    await current.settled();
    expect(heard.refusals).toEqual(["Not that one."]);
    await conflictOn(current, "Book the small hall", "Book the town hall");
    expect(heard.conflicts).toHaveLength(2);

    // The status, as the third store's socket drops and comes back.
    heard.statuses.length = 0;
    samTab.tab.drop();
    await until(() => heard.statuses.join() === "offline,online");

    // The counters ran on from the first store: both conflicts, and the reconnect.
    expect(current.counters()).toMatchObject({ conflicts: 2, reconnects: 1 });
    await handler.close();
  });
});
