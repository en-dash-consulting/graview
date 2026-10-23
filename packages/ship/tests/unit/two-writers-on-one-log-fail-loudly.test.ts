import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, LogHeadMovedError, nodeRef, type PersistenceAdapter } from "@graview/core";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createBrowserAdapter, type StorageLike } from "../../src/browser.js";
import { createFileAdapter, openStore } from "../../src/index.js";
import { fakeIndexedDB } from "./fake-indexed-db.js";

/**
 * ONE WRITER, ENFORCED (1.0's foundation, docs/stability.md §2).
 *
 * Two stores opened on one scope — two processes on a file, two tabs on a
 * page's storage — each numbered its ops from the head it opened at, and
 * both appended: the log held two op 1s, and the next open refused the
 * whole store. Now every append names the head it expects, an adapter that
 * finds its log moved throws `LogHeadMovedError` and appends nothing, and
 * the store that lost reports it rather than interleave two histories.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
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
const seed = { nodes: [{ id: "p1", kind: "plot", label: "One" }], edges: [] };

function storageOf(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
}

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
const fileRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "graview-one-writer-"));
  roots.push(root);
  return root;
};

/** Two writers on one scope: the same adapter, or two adapters over the same place, as two tabs or two processes are. */
const pairs: [string, () => [PersistenceAdapter<string>, PersistenceAdapter<string>]][] = [
  ["memory", () => {
    const one = createMemoryAdapter();
    return [one, one];
  }],
  ["file", () => {
    const root = fileRoot();
    return [createFileAdapter(root), createFileAdapter(root)];
  }],
  ["browser, in localStorage", () => {
    const storage = storageOf();
    return [createBrowserAdapter({ storage }), createBrowserAdapter({ storage })];
  }],
  ["browser, in IndexedDB", () => {
    const idb = fakeIndexedDB();
    return [createBrowserAdapter({ indexedDB: idb, storage: storageOf() }), createBrowserAdapter({ indexedDB: idb, storage: storageOf() })];
  }],
];

describe("two writers on one log fail loudly", () => {
  for (const [name, make] of pairs) {
    it(`two writers appending at the same head — the second fails, and the log holds the first's (${name})`, async () => {
      const [first, second] = make();
      const ana = await openStore({ app, adapter: first, seed });
      const failures: unknown[] = [];
      const bo = await openStore({ app, adapter: second, seed, onPersistError: (error) => failures.push(error) });

      ana.store.apply({ name: "rename", args: { id: "p1", label: "Ana's" } });
      await ana.flush();
      bo.store.apply({ name: "rename", args: { id: "p1", label: "Bo's" } });
      await bo.flush();

      expect(failures).toHaveLength(1);
      expect(failures[0]).toBeInstanceOf(LogHeadMovedError);
      expect(failures[0]).toMatchObject({ scope: "garden", expected: 0, found: 1 });
      const log = await first.loadLog!("garden");
      expect(log.map((op) => [op.seq, op.intent])).toEqual([[0, ana.store.log.all()[0]!.intent]]);
      // The snapshot is the first writer's: the second's write stopped at the refusal.
      expect((await first.load("garden"))?.nodes[0]).toMatchObject({ label: "Ana's" });
      ana.close();
      bo.close();

      // Opened again, the store is whole and goes on from the first writer's op.
      const again = await openStore({ app, adapter: first, seed, onPersistError: () => {} });
      expect(again.store.log.length).toBe(1);
      expect((again.store.graph.getNode("p1") as { label: string }).label).toBe("Ana's");
      again.close();
    });
  }
});
