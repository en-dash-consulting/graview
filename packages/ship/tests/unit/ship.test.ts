import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bindSchema,
  checkApp,
  createSchema,
  defineApp,
  defineNode,
  Store,
} from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assertBundle,
  createFileAdapter,
  exportBundle,
  health,
  migrateSnapshot,
  openStore,
} from "../../src/index.js";

/**
 * The self-hoster's whole story, rehearsed: one declaration plus one
 * adapter is a deployment; a schema change ships with a migration whose run
 * is ordinary logged operations; everything leaves in one bundle.
 */

const plotV2 = defineNode("plot", {
  fields: z.object({ label: z.string(), beds: z.number().int().min(1) }),
  plural: "Plots",
});
const schema = createSchema([plotV2]);
const bound = bindSchema(schema);
const addPlot = bound.defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add ground.",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1), beds: z.number().int().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "p"), kind: "plot", label: args.label, beds: args.beds } as never);
  },
});

/** Version 1 stored plots with a `size` word; version 2 counts beds. */
const app = defineApp({
  name: "garden",
  schema,
  mutations: [addPlot],
  invariants: [],
  version: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      title: "size words become bed counts",
      apply: (snapshot) =>
        snapshot.nodes
          .filter((node) => node.kind === "plot")
          .map((node) => ({
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
  const dir = mkdtempSync(join(tmpdir(), "graview-ship-"));
  scratches.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of scratches.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("the migration chain", () => {
  it("is checked before it is needed", () => {
    const holed = defineApp({ ...app, migrations: [], version: 3 });
    const codes = checkApp(holed).findings.map((f) => f.code);
    expect(codes.filter((code) => code === "migration-gap")).toHaveLength(2);
  });

  it("carries a stored graph forward as logged, invertible operations", () => {
    const stored = {
      nodes: [{ id: "p1", kind: "plot", label: "One", size: "large" }],
      edges: [],
    };
    const run = migrateSnapshot(app, stored, 1, { now: () => "2026-09-01T00:00:00Z" });
    expect(run.version).toBe(2);
    expect(run.snapshot.nodes[0]).toEqual({ id: "p1", kind: "plot", label: "One", beds: 6 });
    expect(run.ops).toHaveLength(1);
    const op = run.ops[0]!;
    expect(op.author).toEqual({ kind: "system", id: "ship:migration" });
    expect(op.intent).toContain("size words become bed counts");
    // The inverse is real: applying it says `size` again.
    expect(op.inverse[0]).toMatchObject({ op: "patch-node", after: { size: "large" } });
  });
});

describe("one declaration plus one adapter is a deployment", () => {
  it("opens fresh, persists every diff, and reopens with the data intact", async () => {
    const root = scratch();
    const adapter = createFileAdapter(root);

    const first = await openStore({ app, adapter });
    first.store.apply({ name: "add-plot", args: { label: "One", beds: 3 } });
    first.close();

    const second = await openStore({ app, adapter });
    expect(second.store.graph.nodesOfKind("plot")).toHaveLength(1);
    expect(second.migrated).toHaveLength(0);
    // The persisted log holds the attributed history across sessions.
    const log = await adapter.loadLog!("garden");
    expect(log).toHaveLength(1);
    expect(log[0]?.mutation?.name).toBe("add-plot");
    second.close();
  });

  it("migrates an old store on open, and records the run in the log", async () => {
    const root = scratch();
    const adapter = createFileAdapter(root);
    // A version-1 deployment, written by hand the way an old one would be.
    await adapter.save("garden", {
      nodes: [{ id: "p1", kind: "plot", label: "One", size: "small" }] as never,
      edges: [],
    });
    adapter.saveMeta("garden", { version: 1 });

    const opened = await openStore({ app, adapter });
    expect(opened.migrated).toHaveLength(1);
    expect((opened.store.graph.getNode("p1") as { beds?: number })?.beds).toBe(2);
    expect(adapter.loadMeta("garden")).toEqual({ version: 2 });
    const log = await adapter.loadLog!("garden");
    expect(log[0]?.author.kind).toBe("system");
    opened.close();

    // Idempotent: reopening migrates nothing further.
    const again = await openStore({ app, adapter });
    expect(again.migrated).toHaveLength(0);
    again.close();
  });
});

describe("everything leaves in one bundle", () => {
  it("round-trips graph, history and version", async () => {
    const root = scratch();
    const opened = await openStore({ app, adapter: createFileAdapter(root) });
    opened.store.apply({ name: "add-plot", args: { label: "One", beds: 3 } });
    const bundle = exportBundle(app, opened.store, { now: () => "2026-09-01T00:00:00Z" });
    opened.close();

    expect(bundle.version).toBe(2);
    expect(() => assertBundle(app, bundle)).not.toThrow();
    const reimported = new Store({
      schema,
      mutations: [addPlot],
      invariants: [],
      snapshot: bundle.snapshot as never,
    });
    expect(reimported.graph.nodesOfKind("plot")).toHaveLength(1);
  });

  it("refuses someone else's bundle, plainly", async () => {
    const opened = await openStore({ app, adapter: createFileAdapter(scratch()) });
    const bundle = exportBundle(app, opened.store);
    opened.close();
    const other = defineApp({ ...app, name: "orchard" });
    expect(() => assertBundle(other, bundle)).toThrow(/for "garden"/);
  });
});

describe("health is coherence, not liveness", () => {
  it("reports sizes, standing, and dangling edges", async () => {
    const opened = await openStore({ app, adapter: createFileAdapter(scratch()) });
    opened.store.apply({ name: "add-plot", args: { label: "One", beds: 3 } });
    const report = health(opened.store, { now: () => "2026-09-01T00:00:00Z" });
    expect(report).toEqual({
      ok: true,
      nodes: 1,
      edges: 0,
      violations: 0,
      danglingEdges: [],
      at: "2026-09-01T00:00:00Z",
    });
    opened.close();
  });
});
