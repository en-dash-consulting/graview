import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, snapshotHash } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createBrowserAdapter, createFileAdapter, openStore } from "../../src/index.js";

/**
 * FR-27. Ship records an epoch whenever the graph it opens on did not come
 * from the log: a new scope's seed, and the graph a migration run leaves.
 * A store whose log spans two declaration versions then verifies by folding
 * from the last epoch, and undo across the migration is refused with a
 * sentence naming it.
 */
const plotV1 = defineNode("plot", { fields: z.object({ label: z.string(), size: z.enum(["small", "large"]) }), plural: "Plots" });
const plotV2 = defineNode("plot", { fields: z.object({ label: z.string(), beds: z.number().int().min(1) }), plural: "Plots" });

const v1Schema = createSchema([plotV1]);
const addV1 = bindSchema(v1Schema).defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add ground.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1), size: z.enum(["small", "large"]) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "p"), kind: "plot", label: args.label, size: args.size } as never);
  },
});
const v1 = defineApp({ name: "garden", schema: v1Schema, mutations: [addV1], invariants: [] });

const v2Schema = createSchema([plotV2]);
const bound = bindSchema(v2Schema);
const addV2 = bound.defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add ground.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1), beds: z.number().int().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "p"), kind: "plot", label: args.label, beds: args.beds } as never);
  },
});
const rename = bound.defineMutation("rename-plot", {
  title: "Rename the plot",
  description: "Call it something else.",
  subject: { kinds: ["plot"], arg: "id" },
  input: z.object({ id: nodeRef(["plot"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const CHANGE = "size words become bed counts";
const v2 = defineApp({
  name: "garden",
  schema: v2Schema,
  mutations: [addV2, rename],
  invariants: [],
  version: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      title: CHANGE,
      apply: (snapshot) =>
        snapshot.nodes.map((node) => ({
          op: "patch-node" as const,
          id: node.id,
          before: { size: node["size"], beds: undefined },
          after: { size: undefined, beds: node["size"] === "large" ? 6 : 2 },
        })),
    },
  ],
});

const scratches: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "graview-epochs-"));
  scratches.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of scratches.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A version-1 deployment with history, then reopened under version 2. */
async function spanningTwoVersions(adapter: ReturnType<typeof createFileAdapter>) {
  const old = await openStore({ app: v1, adapter });
  const planted = old.store.apply({ name: "add-plot", args: { label: "Back bed", size: "large" } });
  old.store.apply({ name: "add-plot", args: { label: "Front bed", size: "small" } });
  await old.flush();
  old.close();
  const opened = await openStore({ app: v2, adapter });
  return { opened, planted };
}

describe("a store whose log spans two declaration versions", () => {
  it("records an epoch when the migration runs, naming the change", async () => {
    const adapter = createFileAdapter(scratch());
    const { opened } = await spanningTwoVersions(adapter);
    expect(opened.epoch).toMatchObject({ seq: 3, version: 2 });
    expect(opened.epoch?.change).toContain(CHANGE);
    expect(snapshotHash(opened.epoch!.base)).toBe(snapshotHash(opened.store.snapshot()));
    const kept = await adapter.loadEpochs!("garden");
    expect(kept.map((epoch) => epoch.version)).toEqual([1, 2]);
    opened.close();
  });

  it("verifies by folding from the last epoch", async () => {
    const adapter = createFileAdapter(scratch());
    const { opened } = await spanningTwoVersions(adapter);
    const back = opened.store.graph.allNodes().find((node) => node.label === "Back bed")!;
    opened.store.apply({ name: "rename-plot", args: { id: back.id, label: "Far bed" } });
    expect(opened.store.verify().ok).toBe(true);
    await opened.flush();
    opened.close();

    const again = await openStore({ app: v2, adapter, verify: true });
    expect(again.verified).toEqual({ ok: true, hash: snapshotHash(again.store.snapshot()) });
    expect(again.rebuilt).toBeUndefined();
    expect(again.epoch).toBeUndefined();
    again.close();
  });

  it("refuses undo across the epoch boundary with a sentence naming the change", async () => {
    const adapter = createFileAdapter(scratch());
    const { opened, planted } = await spanningTwoVersions(adapter);
    const check = opened.store.canUndo(planted.batch);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message).toContain(`migration 1→2: ${CHANGE}`);
    expect(() => opened.store.undo(planted.batch)).toThrow(CHANGE);
    opened.close();
  });
});

describe("the epochs a store begins with", () => {
  it("starts a new scope's first epoch at its seed, so a seeded store verifies", async () => {
    const adapter = createMemoryAdapter();
    const seed = { nodes: [{ id: "back", kind: "plot", label: "Back bed", beds: 6 }], edges: [] };
    const first = await openStore({ app: v2, adapter, seed: seed as never });
    expect(first.epoch).toMatchObject({ seq: 0, version: 2, base: seed });
    first.store.apply({ name: "rename-plot", args: { id: "back", label: "Far bed" } });
    await first.flush();
    first.close();

    const again = await openStore({ app: v2, adapter, verify: true });
    expect(again.verified?.ok).toBe(true);
    expect(again.store.graph.getNode("back")?.label).toBe("Far bed");
    again.close();
  });

  it("does not keep them in the browser adapter: a page has no room for a second copy of the graph", async () => {
    const entries = new Map<string, string>();
    const storage = { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => void entries.set(k, v), removeItem: (k: string) => void entries.delete(k) };
    const adapter = createBrowserAdapter({ storage });
    const opened = await openStore({ app: v2, adapter });
    // The epoch is the store's own, in memory; nothing is written for it.
    expect(opened.epoch).toBeDefined();
    opened.close();
    expect([...entries.keys()].some((key) => key.endsWith(":epochs"))).toBe(false);
    expect(adapter.loadEpochs).toBeUndefined();
  });

  it("has a store from before epochs adopt what it holds, from empty when its whole log folds to it", async () => {
    const adapter = createFileAdapter(scratch());
    const first = await openStore({ app: v2, adapter });
    first.store.apply({ name: "add-plot", args: { label: "Back bed", beds: 6 } });
    await first.flush();
    first.close();
    // Written by a framework that kept no epochs.
    rmSync(join(adapter.root, "garden", "epochs.json"));

    const again = await openStore({ app: v2, adapter, verify: true });
    expect(again.epoch).toMatchObject({ seq: 0, base: { nodes: [], edges: [] } });
    expect(again.verified?.ok).toBe(true);
    again.close();
  });
});
