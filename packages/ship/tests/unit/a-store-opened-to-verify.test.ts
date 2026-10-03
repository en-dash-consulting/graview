import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createSchema, defineApp, defineNode, snapshotHash } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createFileAdapter, openStore } from "../../src/index.js";

/**
 * FR-20. A deployment opened with `verify: true` proves its stored graph
 * against its log, and when they disagree it rebuilds the graph from the
 * log, saves it, and says what it did.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const schema = createSchema([plot]);
const { defineMutation } = bindSchema(schema);
const addPlot = defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add ground.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "p"), kind: "plot", label: args.label } as never);
  },
});
const app = defineApp({ name: "garden", schema, mutations: [addPlot], invariants: [] });

const scratches: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "graview-verify-"));
  scratches.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of scratches.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function planted(adapter: ReturnType<typeof createFileAdapter>) {
  const first = await openStore({ app, adapter });
  first.store.apply({ name: "add-plot", args: { label: "One" } });
  first.store.apply({ name: "add-plot", args: { label: "Two" } });
  await first.flush();
  first.close();
  return first.store.snapshot();
}

describe("openStore({ verify: true })", () => {
  it("opens an agreeing store as it was, and says it verified", async () => {
    const adapter = createFileAdapter(scratch());
    const graph = await planted(adapter);
    const opened = await openStore({ app, adapter, verify: true });
    expect(opened.verified).toEqual({ ok: true, hash: snapshotHash(graph) });
    expect(opened.rebuilt).toBeUndefined();
    opened.close();
  });

  it("rebuilds a disagreeing snapshot from the log, saves it, and says so", async () => {
    const adapter = createFileAdapter(scratch());
    const graph = await planted(adapter);
    // The snapshot drifts: a plot vanishes from it without an op saying so.
    const drifted = { nodes: graph.nodes.slice(0, 1), edges: [] };
    await adapter.save("garden", drifted as never);

    const opened = await openStore({ app, adapter, verify: true });
    expect(opened.verified?.ok).toBe(false);
    expect(opened.rebuilt).toMatchObject({ from: snapshotHash(drifted), to: snapshotHash(graph) });
    expect(opened.rebuilt?.divergedAfter).toBe((await adapter.loadLog!("garden"))[1]!.id);
    expect(snapshotHash(opened.store.snapshot())).toBe(snapshotHash(graph));
    // Saved: the next open, verifying or not, finds the rebuilt graph.
    expect(snapshotHash((await adapter.load("garden"))!)).toBe(snapshotHash(graph));
    opened.close();
  });

  it("does not verify unless asked", async () => {
    const adapter = createFileAdapter(scratch());
    const graph = await planted(adapter);
    await adapter.save("garden", { nodes: graph.nodes.slice(0, 1), edges: [] } as never);
    const opened = await openStore({ app, adapter });
    expect(opened.verified).toBeUndefined();
    expect(opened.store.snapshot().nodes).toHaveLength(1);
    opened.close();
  });
});
