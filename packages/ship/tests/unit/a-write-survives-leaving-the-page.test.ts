import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createBrowserAdapter, openStore, type StorageLike } from "../../src/browser.js";
import { fakeIndexedDB, type FakeIndexedDB } from "./fake-indexed-db.js";

/**
 * A WRITE SURVIVES LEAVING THE PAGE. The browser adapter keeps a store in
 * IndexedDB, whose write commits a transaction after `store.apply`
 * returns: a person who changed something and navigated at once, and the
 * journeys harness that arranged a plot and went to the next page, opened
 * a store without the change. Every op is written to a small journal in
 * localStorage before `apply` returns, and the next open puts back what
 * IndexedDB never committed, each op once.
 */

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
  fields: z.object({ label: z.string(), beds: z.number().int().min(1) }),
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
const plant = defineMutation("plant", {
  title: "Plant",
  description: "Add a plot.",
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "plot", label: args.label, beds: 1 });
  },
});
const app = defineApp({ name: "garden", schema, mutations: [rename, plant], invariants: [], version: 1 });
const seed = { nodes: [{ id: "p1", kind: "plot", label: "One", beds: 2 }], edges: [] };
const labelOf = (opened: { store: { graph: { getNode(id: string): unknown } } }, id: string) =>
  (opened.store.graph.getNode(id) as { label: string } | undefined)?.label;
const JOURNAL = "graview:garden:journal";

/**
 * The page goes: what its browser had committed at this moment is all the
 * next page finds. Transactions still on their way commit to the old
 * page's copies, which nobody reads again.
 */
function leave(idb: FakeIndexedDB, storage: ReturnType<typeof localStorageOf>) {
  const nextIdb = fakeIndexedDB();
  for (const [name, store] of idb.stores) nextIdb.stores.set(name, new Map(store));
  const nextStorage = localStorageOf();
  for (const [key, value] of storage.map) nextStorage.map.set(key, value);
  return { indexedDB: nextIdb, storage: nextStorage };
}

const until = async (condition: () => boolean) => {
  for (let i = 0; i < 500 && !condition(); i++) await new Promise((resolve) => setTimeout(resolve, 0));
  expect(condition()).toBe(true);
};

describe("a write the page left before IndexedDB committed", () => {
  it("is journaled in localStorage before apply returns, and the next open has it, attributed and undoable", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf();
    const first = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    await first.flush();
    const done = first.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } }, { author: { kind: "human", id: "nick" } });
    expect(JSON.parse(storage.map.get(JOURNAL)!)).toHaveLength(1);

    const next = leave(idb, storage);
    expect(next.indexedDB.stores.get("entries")?.get("graview:garden:snapshot")).toContain("One");
    const failures: unknown[] = [];
    const again = await openStore({ app, adapter: createBrowserAdapter(next), seed, onPersistError: (e) => failures.push(e) });
    expect(labelOf(again, "p1")).toBe("Uno");
    expect(again.store.batches()).toHaveLength(1);
    expect(again.store.batches()[0]?.author).toEqual({ kind: "human", id: "nick" });
    expect(again.store.canUndo(done.batch).ok).toBe(true);
    await again.flush();
    // Put back in IndexedDB, and let go of in localStorage once it is.
    expect(next.indexedDB.stores.get("entries")?.get("graview:garden:snapshot")).toContain("Uno");
    expect(next.storage.map.has(JOURNAL)).toBe(false);
    expect(failures).toEqual([]);

    // And what comes next follows it in the log, in order.
    again.store.apply({ name: "rename", args: { id: "p1", label: "Eins" } });
    await again.flush();
    again.close();
    const log = await createBrowserAdapter(next).loadLog!("garden");
    expect(log.map((op) => op.seq)).toEqual([0, 1]);
  });

  it("is kept for a scope whose first snapshot never landed: folded onto the seed", async () => {
    const idb = fakeIndexedDB();
    // IndexedDB refuses this page's every write (reported), and the journal still keeps the op.
    idb.quota = 10;
    const storage = localStorageOf();
    const failures: unknown[] = [];
    const first = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed, onPersistError: (e) => failures.push(e) });
    first.store.apply({ name: "plant", args: { id: "p2", label: "Two" } });
    await first.flush();
    expect(failures.length).toBeGreaterThan(0);
    const next = leave(idb, storage);
    expect(next.indexedDB.stores.get("entries")?.get("graview:garden:snapshot")).toBeUndefined();

    const again = await openStore({ app, adapter: createBrowserAdapter(next), seed });
    expect(labelOf(again, "p1")).toBe("One");
    expect(labelOf(again, "p2")).toBe("Two");
    expect(again.store.batches()).toHaveLength(1);
    again.close();
  });

  it("is folded once when the log committed it and the snapshot did not", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf();
    const first = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    await first.flush();
    first.store.apply({ name: "plant", args: { id: "p2", label: "Two" } });
    // The page goes between the log's transaction and the snapshot's.
    await until(() => idb.stores.get("entries")?.has("graview:garden:log:0") === true);
    const next = leave(idb, storage);
    expect(next.indexedDB.stores.get("entries")?.get("graview:garden:snapshot")).not.toContain("Two");

    const failures: unknown[] = [];
    const again = await openStore({ app, adapter: createBrowserAdapter(next), seed, onPersistError: (e) => failures.push(e) });
    expect(labelOf(again, "p2")).toBe("Two");
    expect(again.store.batches()).toHaveLength(1);
    expect(again.store.log.all()).toHaveLength(1);
    again.close();
    expect(failures).toEqual([]);
  });

  it("is not applied twice when IndexedDB already has it and the journal was not yet let go of", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf();
    const first = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    first.store.apply({ name: "plant", args: { id: "p2", label: "Two" } });
    const journaled = storage.map.get(JOURNAL)!;
    await first.flush();
    first.close();
    expect(storage.map.has(JOURNAL)).toBe(false);
    // The page went after IndexedDB committed and before the journal was let go of.
    storage.map.set(JOURNAL, journaled);

    const failures: unknown[] = [];
    const again = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed, onPersistError: (e) => failures.push(e) });
    expect(again.store.graph.nodesOfKind("plot")).toHaveLength(2);
    expect(again.store.log.all()).toHaveLength(1);
    again.store.apply({ name: "rename", args: { id: "p2", label: "Zwei" } });
    await again.flush();
    again.close();
    expect(failures).toEqual([]);
    expect(storage.map.has(JOURNAL)).toBe(false);
    const log = await createBrowserAdapter({ indexedDB: idb, storage }).loadLog!("garden");
    expect(log.map((op) => op.seq)).toEqual([0, 1]);
  });

  it("is reported when localStorage refuses even the journal, and IndexedDB still keeps it", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf(20);
    const failures: unknown[] = [];
    const opened = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed, onPersistError: (e) => failures.push(e) });
    opened.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    expect(failures).toHaveLength(1);
    expect((failures[0] as Error).name).toBe("QuotaExceededError");
    await opened.flush();
    opened.close();
    const again = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    expect(labelOf(again, "p1")).toBe("Uno");
    again.close();
  });

  it("is cleared by starting fresh, so a fresh start does not put it back", async () => {
    const idb = fakeIndexedDB();
    const storage = localStorageOf();
    const first = await openStore({ app, adapter: createBrowserAdapter({ indexedDB: idb, storage }), seed });
    first.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    const next = leave(idb, storage);
    const fresh = await openStore({ app, adapter: createBrowserAdapter(next), seed, fresh: true });
    expect(labelOf(fresh, "p1")).toBe("One");
    await fresh.flush();
    fresh.close();
    expect(next.storage.map.has(JOURNAL)).toBe(false);
    const again = await openStore({ app, adapter: createBrowserAdapter(next), seed });
    expect(labelOf(again, "p1")).toBe("One");
    again.close();
  });
});
