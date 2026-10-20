import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BROWSER_DATABASE, createBrowserAdapter, openStore, type StorageLike } from "../../src/browser.js";
import { fakeIndexedDB } from "./fake-indexed-db.js";

/**
 * A STORE TOO LARGE FOR LOCALSTORAGE IS KEPT, IN INDEXEDDB. WebKit keeps
 * 5 MB of localStorage an origin and counts each character twice, so the
 * gauntlet's 2.8 MB seed did not fit: the store opened, said the write
 * had failed, and kept nothing. The browser adapter keeps a store in
 * IndexedDB, carries forward a store localStorage already holds without
 * losing it, and is localStorage as before only where IndexedDB will not
 * open or will not take it.
 */

/** localStorage as WebKit keeps it: `quota` characters, each counted twice. */
function localStorageOf(quota = Number.POSITIVE_INFINITY): StorageLike & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  const used = () => [...map].reduce((sum, [key, value]) => sum + 2 * (key.length + value.length), 0);
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      const before = map.get(key);
      map.set(key, value);
      if (used() > quota) {
        if (before === undefined) map.delete(key);
        else map.set(key, before);
        throw Object.assign(new Error("The quota has been exceeded."), { name: "QuotaExceededError" });
      }
    },
    removeItem: (key) => void map.delete(key),
  };
}

const plot = defineNode("plot", {
  fields: z.object({ label: z.string(), beds: z.number().int().min(1), notes: z.string().optional() }),
  plural: "Plots",
});
const schema = createSchema([plot]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["plot"], arg: "id" },
  input: z.object({ id: nodeRef(["plot"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({ name: "garden", schema, mutations: [rename], invariants: [], version: 1 });
const seed = { nodes: [{ id: "p1", kind: "plot", label: "One", beds: 2 }], edges: [] };
/** Over WebKit's 5 MB once each character counts twice: 2,000 plots of 1,400 characters' notes. */
const large = {
  nodes: Array.from({ length: 2000 }, (_, i) => ({ id: `p${i + 1}`, kind: "plot", label: `Plot ${i + 1}`, beds: 2, notes: "x".repeat(1400) })),
  edges: [],
};
const WEBKIT = 5 * 1024 * 1024;
const labelOf = (opened: { store: { graph: { getNode(id: string): unknown } } }, id: string) => (opened.store.graph.getNode(id) as { label: string }).label;
const entriesOf = (idb: ReturnType<typeof fakeIndexedDB>) => idb.stores.get("entries") ?? new Map<string, string>();

describe("the browser adapter, in IndexedDB", () => {
  it("keeps a store in IndexedDB by default, under the keys localStorage used, and leaves localStorage alone", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf();
    const adapter = createBrowserAdapter({ indexedDB: idb, storage });
    const opened = await openStore({ app, adapter, seed });
    opened.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    await opened.flush();
    opened.close();

    expect(await adapter.keptIn()).toBe("indexedDB");
    expect(BROWSER_DATABASE).toBe("graview");
    expect([...entriesOf(idb).keys()].sort()).toEqual(["graview:garden:log", "graview:garden:log:0", "graview:garden:meta", "graview:garden:snapshot"]);
    expect(storage.map.size).toBe(0);
    expect(await adapter.loadMeta("garden")).toMatchObject({ version: 1 });
  });

  it("does not open the database until the store is first read", async () => {
    const idb = fakeIndexedDB();
    const adapter = createBrowserAdapter({ indexedDB: idb, storage: localStorageOf() });
    expect(idb.opens).toBe(0);
    await adapter.load("garden");
    await adapter.loadLog!("garden");
    expect(idb.opens).toBe(1);
  });

  it("keeps a store too large for WebKit's localStorage, and reopens it with the edit, attributed and undoable", async () => {
    // Without IndexedDB it does not fit: the open reports the failed write and nothing is kept.
    const failures: unknown[] = [];
    const cramped = await openStore({ app, adapter: createBrowserAdapter({ storage: localStorageOf(WEBKIT) }), seed: large, onPersistError: (e) => failures.push(e) });
    cramped.close();
    expect(failures).toHaveLength(1);

    const idb = fakeIndexedDB();
    const storage = localStorageOf(WEBKIT);
    const adapter = createBrowserAdapter({ indexedDB: idb, storage });
    const kept: unknown[] = [];
    const first = await openStore({ app, adapter, seed: large, onPersistError: (e) => kept.push(e) });
    const done = first.store.apply({ name: "rename", args: { id: "p2000", label: "The last plot, renamed" } }, { author: { kind: "human", id: "nick" } });
    await first.flush();
    first.close();
    expect(kept).toEqual([]);

    const again = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    expect(again.store.graph.nodesOfKind("plot")).toHaveLength(2000);
    expect(labelOf(again, "p2000")).toBe("The last plot, renamed");
    expect(again.store.batches()[0]?.author).toEqual({ kind: "human", id: "nick" });
    expect(again.store.canUndo(done.batch).ok).toBe(true);
    again.close();
  });

  it("carries a store localStorage holds forward, losing nothing, and only then removes it from localStorage", async () => {
    const storage = localStorageOf();
    // Kept the way a page kept it before IndexedDB: localStorage alone.
    const before = await openStore({ app, adapter: createBrowserAdapter({ storage }), seed });
    const done = before.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } }, { author: { kind: "human", id: "nick" } });
    await before.flush();
    before.close();
    expect([...storage.map.keys()].sort()).toEqual(["graview:garden:log", "graview:garden:meta", "graview:garden:snapshot"]);

    const idb = fakeIndexedDB();
    const adapter = createBrowserAdapter({ indexedDB: idb, storage });
    const after = await openStore({ app, adapter, seed: { nodes: [], edges: [] } });
    expect(labelOf(after, "p1")).toBe("Uno");
    expect(after.store.batches()).toHaveLength(1);
    expect(after.store.batches()[0]?.author).toEqual({ kind: "human", id: "nick" });
    expect(after.store.canUndo(done.batch).ok).toBe(true);
    expect(await adapter.loadMeta("garden")).toMatchObject({ version: 1 });
    expect(await adapter.keptIn()).toBe("indexedDB");
    // In IndexedDB now, and gone from localStorage.
    expect(entriesOf(idb).get("graview:garden:snapshot")).toContain("Uno");
    expect(storage.map.size).toBe(0);

    // And what comes next is appended after it, in order.
    after.store.undo(done.batch);
    await after.flush();
    after.close();
    const log = await createBrowserAdapter({ indexedDB: idb, storage }).loadLog!("garden");
    expect(log.map((op) => op.seq)).toEqual([0, 1]);
    expect(log[1]?.undoes).toBe(log[0]?.id);
  });

  it("leaves a store in localStorage, whole, when IndexedDB will not take it, and goes on keeping it there", async () => {
    const storage = localStorageOf();
    const before = await openStore({ app, adapter: createBrowserAdapter({ storage }), seed });
    before.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    await before.flush();
    before.close();

    const idb = fakeIndexedDB();
    idb.quota = 10;
    const adapter = createBrowserAdapter({ indexedDB: idb, storage });
    const failures: unknown[] = [];
    const after = await openStore({ app, adapter, seed, onPersistError: (e) => failures.push(e) });
    expect(labelOf(after, "p1")).toBe("Uno");
    expect(await adapter.keptIn()).toBe("localStorage");
    expect(entriesOf(idb).size).toBe(0);
    after.store.apply({ name: "rename", args: { id: "p1", label: "Eins" } });
    await after.flush();
    after.close();
    expect(failures).toEqual([]);
    expect(storage.map.get("graview:garden:snapshot")).toContain("Eins");
    expect(JSON.parse(storage.map.get("graview:garden:log")!)).toHaveLength(2);
  });

  it("leaves localStorage's store untouched when IndexedDB already holds the scope: the one with the history stands", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf();
    const kept = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    kept.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    await kept.flush();
    kept.close();
    // A build from before IndexedDB, opened since: it found localStorage empty and began again from its seed.
    const older = await openStore({ app, adapter: createBrowserAdapter({ storage }), seed });
    older.close();
    const planted = storage.map.get("graview:garden:snapshot");
    expect(planted).toContain("One");

    const again = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    expect(labelOf(again, "p1")).toBe("Uno");
    expect(again.store.batches()).toHaveLength(1);
    again.close();
    expect(storage.map.get("graview:garden:snapshot")).toBe(planted);
  });

  it("is localStorage, as before, where IndexedDB will not open", async () => {
    const idb = fakeIndexedDB();
    idb.refuseOpen = true;
    const storage = localStorageOf();
    const adapter = createBrowserAdapter({ indexedDB: idb, storage });
    const opened = await openStore({ app, adapter, seed });
    opened.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    await opened.flush();
    opened.close();
    expect(await adapter.keptIn()).toBe("localStorage");
    expect(storage.map.get("graview:garden:snapshot")).toContain("Uno");
  });

  it("appends a piece per write, and puts a long log back together without losing an op or its order", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf();
    const opened = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    for (let i = 0; i < 40; i++) {
      opened.store.apply({ name: "rename", args: { id: "p1", label: `Name ${i}` } });
      await opened.flush();
    }
    opened.close();
    expect(entriesOf(idb).get("graview:garden:log")).toBe("40");

    const adapter = createBrowserAdapter({ indexedDB: idb, storage });
    const log = await adapter.loadLog!("garden");
    expect(log.map((op) => op.seq)).toEqual(Array.from({ length: 40 }, (_, i) => i));
    // Read once, it is one piece again.
    expect(entriesOf(idb).get("graview:garden:log")).toBe("1");
    expect([...entriesOf(idb).keys()].filter((key) => key.startsWith("graview:garden:log:"))).toEqual(["graview:garden:log:0"]);
    const reopened = await openStore({ app, adapter, seed });
    expect(labelOf(reopened, "p1")).toBe("Name 39");
    expect(reopened.store.batches()).toHaveLength(40);
    reopened.close();
  });

  it("lands a meta a page did not wait for before the open that reads it", async () => {
    const idb = fakeIndexedDB();
    const adapter = createBrowserAdapter({ indexedDB: idb, storage: localStorageOf() });
    const v2 = defineApp({
      ...app,
      version: 2,
      migrations: [{ from: 1, to: 2, title: "beds double", apply: (snapshot) => snapshot.nodes.map((node) => ({ op: "patch-node" as const, id: node.id, before: { beds: node["beds"] }, after: { beds: (node["beds"] as number) * 2 } })) }],
    });
    // A deployment that stood at version 1, put there the way rota's `?stored=1` puts it.
    void adapter.delete("garden");
    void adapter.save("garden", seed as never);
    void adapter.saveMeta("garden", { version: 1 });
    const opened = await openStore({ app: v2, adapter });
    expect(opened.migrated).toHaveLength(1);
    expect((opened.store.graph.getNode("p1") as { beds: number }).beds).toBe(4);
    opened.close();
  });

  it("starts fresh from the seed, with nothing left in either storage to carry in", async () => {
    const storage = localStorageOf();
    const old = await openStore({ app, adapter: createBrowserAdapter({ storage }), seed });
    old.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    await old.flush();
    old.close();

    const idb = fakeIndexedDB();
    const fresh = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed, fresh: true });
    expect(labelOf(fresh, "p1")).toBe("One");
    expect(fresh.store.batches()).toHaveLength(0);
    fresh.close();
    expect(storage.map.size).toBe(0);
    const again = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    expect(labelOf(again, "p1")).toBe("One");
    again.close();
  });

  it("keeps two prefixes on one origin apart in the one database", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf();
    const one = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage, prefix: "one" }), seed });
    one.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    await one.flush();
    one.close();
    const two = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage, prefix: "two" }), seed });
    expect(labelOf(two, "p1")).toBe("One");
    two.close();
  });
});
