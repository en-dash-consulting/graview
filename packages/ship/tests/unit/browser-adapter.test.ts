import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  freshHref,
  openStore,
  type StorageLike,
} from "../../src/browser.js";

/**
 * The sample apps remember, and the framework owns how: the browser
 * adapter stores the same three things the file adapter writes and slots
 * into the same lifecycle. Rehearsed here against a Map dressed as
 * localStorage, so the round trip is checked without a browser.
 */

function memoryStorage(): StorageLike & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const plot = defineNode("plot", {
  fields: z.object({ label: z.string(), beds: z.number().int().min(1) }),
  plural: "Plots",
});
const schema = createSchema([plot]);
const { defineMutation } = bindSchema(schema);
const addPlot = defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add ground.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1), beds: z.number().int().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "p"), kind: "plot", label: args.label, beds: args.beds } as never);
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["plot"], arg: "id" },
  input: z.object({ id: nodeRef(["plot"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({ name: "garden", schema, mutations: [addPlot, rename], invariants: [], version: 1 });
const seed = { nodes: [{ id: "p1", kind: "plot", label: "One", beds: 2 }], edges: [] };

describe("the browser adapter", () => {
  it("stores what the file adapter stores, under keys a person can find", async () => {
    const storage = memoryStorage();
    const adapter = createBrowserAdapter({ storage, prefix: "test" });
    const opened = await openStore({ app, adapter, seed });
    opened.store.apply({ name: "rename", args: { id: "p1", label: "Uno" } });
    await opened.flush();
    opened.close();

    expect([...storage.map.keys()].sort()).toEqual([
      "test:garden:log",
      "test:garden:meta",
      "test:garden:snapshot",
    ]);
    expect(adapter.loadMeta("garden")).toMatchObject({ version: 1 });
    expect(await adapter.loadLog!("garden")).toHaveLength(1);
  });

  it("an edit survives a reopen, still attributed and still undoable", async () => {
    const storage = memoryStorage();
    const adapter = createBrowserAdapter({ storage });

    const first = await openStore({ app, adapter, seed });
    const done = first.store.apply(
      { name: "rename", args: { id: "p1", label: "Uno" } },
      { author: { kind: "human", id: "nick" } },
    );
    await first.flush();
    first.close();

    const second = await openStore({ app, adapter, seed });
    expect((second.store.graph.getNode("p1") as { label: string }).label).toBe("Uno");
    // The history came back with the graph: who did it, and the way to take it back.
    const batches = second.store.batches();
    expect(batches).toHaveLength(1);
    expect(batches[0]?.author).toEqual({ kind: "human", id: "nick" });
    expect(second.store.canUndo(done.batch).ok).toBe(true);
    second.store.undo(done.batch);
    expect((second.store.graph.getNode("p1") as { label: string }).label).toBe("One");
    await second.flush();
    second.close();

    // And the undo itself persisted, as an ordinary op with a distinct id.
    const log = await adapter.loadLog!("garden");
    expect(log).toHaveLength(2);
    expect(new Set(log.map((op) => op.id)).size).toBe(2);
    expect(log[1]?.undoes).toBe(log[0]?.id);
  });

  it("gives each session ids that cannot collide with an earlier one's", async () => {
    const adapter = createBrowserAdapter({ storage: memoryStorage() });
    for (let session = 0; session < 3; session++) {
      const opened = await openStore({ app, adapter, seed });
      opened.store.apply({ name: "add-plot", args: { label: `Plot ${session}`, beds: 1 } });
      await opened.flush();
      opened.close();
    }
    const log = await adapter.loadLog!("garden");
    expect(log).toHaveLength(3);
    expect(new Set(log.map((op) => op.id)).size).toBe(3);
    expect(log.map((op) => op.seq)).toEqual([0, 1, 2]);
  });

  it("the seed is the first load, not every load", async () => {
    const adapter = createBrowserAdapter({ storage: memoryStorage() });
    const first = await openStore({ app, adapter, seed });
    first.store.apply({ name: "add-plot", args: { label: "Two", beds: 1 } });
    await first.flush();
    first.close();
    // A different seed on the second open changes nothing: what is stored wins.
    const second = await openStore({ app, adapter, seed: { nodes: [], edges: [] } });
    expect(second.store.graph.nodesOfKind("plot")).toHaveLength(2);
    second.close();
  });

  it("fresh discards everything and starts from the seed again", async () => {
    const storage = memoryStorage();
    const adapter = createBrowserAdapter({ storage });
    const first = await openStore({ app, adapter, seed });
    first.store.apply({ name: "add-plot", args: { label: "Two", beds: 1 } });
    await first.flush();
    first.close();

    const again = await openStore({ app, adapter, seed, fresh: true });
    expect(again.store.graph.nodesOfKind("plot")).toHaveLength(1);
    expect(again.store.batches()).toHaveLength(0);
    again.close();
  });

  it("migrates a stored graph on open, like the file adapter does", async () => {
    const adapter = createBrowserAdapter({ storage: memoryStorage() });
    const v2 = defineApp({
      ...app,
      version: 2,
      migrations: [
        {
          from: 1,
          to: 2,
          title: "beds double",
          apply: (snapshot) =>
            snapshot.nodes.map((node) => ({
              op: "patch-node" as const,
              id: node.id,
              before: { beds: node["beds"] },
              after: { beds: (node["beds"] as number) * 2 },
            })),
        },
      ],
    });
    const first = await openStore({ app, adapter, seed });
    await first.flush();
    first.close();

    const upgraded = await openStore({ app: v2, adapter, seed });
    expect(upgraded.migrated).toHaveLength(1);
    expect((upgraded.store.graph.getNode("p1") as { beds: number }).beds).toBe(4);
    expect(adapter.loadMeta("garden")).toMatchObject({ version: 2 });
    // The run is in the persisted log AND in the reopened store's history.
    expect(upgraded.store.batches()[0]?.author).toEqual({ kind: "system", id: "ship:migration" });
    upgraded.close();
  });

  it("reports a write that fails rather than swallowing it", async () => {
    const storage = memoryStorage();
    const adapter = createBrowserAdapter({ storage });
    const failures: unknown[] = [];
    const opened = await openStore({ app, adapter, seed, onPersistError: (e) => failures.push(e) });
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    opened.store.apply({ name: "add-plot", args: { label: "Two", beds: 1 } });
    await opened.flush();
    expect(failures).toHaveLength(1);
    opened.close();
  });

  it("refuses to run without any storage, plainly", () => {
    const had = (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { localStorage?: unknown }).localStorage;
    try {
      expect(() => createBrowserAdapter()).toThrow(/no localStorage/);
    } finally {
      if (had !== undefined) (globalThis as { localStorage?: unknown }).localStorage = had;
    }
  });
});

describe("when a load starts fresh", () => {
  it("is asked for by ?fresh=1, and a person's browser otherwise remembers", () => {
    expect(browserStartsFresh({ search: "?fresh=1" }, { webdriver: false })).toBe(true);
    expect(browserStartsFresh({ search: "?today=2026-09-01" }, { webdriver: false })).toBe(false);
    expect(browserStartsFresh({ search: "" }, {})).toBe(false);
  });

  it("is the default for a driven browser, unless it asks to remember", () => {
    expect(browserStartsFresh({ search: "" }, { webdriver: true })).toBe(true);
    expect(browserStartsFresh({ search: "?remember=1" }, { webdriver: true })).toBe(false);
    // Fresh outranks remember: the control that says "start fresh" must win.
    expect(browserStartsFresh({ search: "?remember=1&fresh=1" }, { webdriver: true })).toBe(true);
  });

  it("drops the fresh flag from the address once honoured, keeping the rest", () => {
    const replaced: string[] = [];
    forgetFreshParam({
      location: { href: "http://x/?today=2026-09-01&fresh=1#focus=t1" },
      history: { replaceState: (_d, _u, url) => void replaced.push(url) },
    });
    expect(replaced).toEqual(["http://x/?today=2026-09-01#focus=t1"]);
    forgetFreshParam({
      location: { href: "http://x/?today=2026-09-01" },
      history: { replaceState: (_d, _u, url) => void replaced.push(url) },
    });
    expect(replaced).toHaveLength(1);
  });

  it("names the address a start-fresh control goes to", () => {
    expect(freshHref({ href: "http://x/?today=2026-09-01#focus=t1" })).toBe(
      "http://x/?today=2026-09-01&fresh=1#focus=t1",
    );
  });
});
