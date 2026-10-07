import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bindSchema,
  createSchema,
  defineApp,
  defineInvariant,
  defineNode,
  FORMATS,
  FRAMEWORK_VERSION,
  NewerFormatError,
  RuleBudgetError,
  Store,
} from "@graview/core";
import { checkApp } from "@graview/core/check";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  applyToSnapshot,
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

  /*
   * AND IT IS STILL REAL AFTER IT HAS BEEN WRITTEN DOWN.
   *
   * "Remove this key" was said by carrying the key with the value
   * `undefined`, which JSON drops — so every persisted patch that cleared a
   * field came back with an empty half and its inverse silently did nothing.
   * A migration that added a field could be "undone" after a reload and
   * leave the field exactly where it was.
   */
  it("keeps its inverse through JSON, which cannot carry undefined", () => {
    const stored = {
      nodes: [{ id: "p1", kind: "plot", label: "One", size: "large" }],
      edges: [],
    };
    const op = migrateSnapshot(app, stored, 1, { now: () => "2026-09-01T00:00:00Z" }).ops[0]!;
    const written = JSON.parse(JSON.stringify(op)) as typeof op;

    // The instruction survives as a value rather than as an absence.
    expect(Object.keys((written.primitives[0] as { after: object }).after).sort()).toEqual(
      ["beds", "size"],
    );
    expect(Object.keys((written.inverse[0] as { after: object }).after).sort()).toEqual(
      ["beds", "size"],
    );

    // And applying the re-read inverse actually puts `size` back and takes
    // `beds` away again.
    const forward = applyToSnapshot(stored, written.primitives);
    expect(forward.nodes[0]).toEqual({ id: "p1", kind: "plot", label: "One", beds: 6 });
    const back = applyToSnapshot(forward, written.inverse);
    expect(back.nodes[0]).toEqual({ id: "p1", kind: "plot", label: "One", size: "large" });
  });
});

describe("one declaration plus one adapter is a deployment", () => {
  it("opens fresh, persists every diff, and reopens with the data intact", async () => {
    const root = scratch();
    const adapter = createFileAdapter(root);

    const first = await openStore({ app, adapter });
    first.store.apply({ name: "add-plot", args: { label: "One", beds: 3 } });
    // Writes are serialized and async: the handoff is flush, then close.
    await first.flush();
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
    expect(adapter.loadMeta("garden")).toMatchObject({ version: 2 });
    const log = await adapter.loadLog!("garden");
    expect(log[0]?.author.kind).toBe("system");
    opened.close();

    // Idempotent: reopening migrates nothing further.
    const again = await openStore({ app, adapter });
    expect(again.migrated).toHaveLength(0);
    again.close();
  });
});

describe("the log outranks the meta", () => {
  it("does not re-migrate migrated data when the version stamp lags", async () => {
    const root = scratch();
    const adapter = createFileAdapter(root);
    await adapter.save("garden", {
      nodes: [{ id: "p1", kind: "plot", label: "One", size: "small" }] as never,
      edges: [],
    });
    adapter.saveMeta("garden", { version: 1 });
    const first = await openStore({ app, adapter });
    await first.flush();
    first.close();

    // The crash window: migrated snapshot on disk, but the stamp reverts.
    adapter.saveMeta("garden", { version: 1 });
    const again = await openStore({ app, adapter });
    expect(again.migrated).toHaveLength(0);
    expect((again.store.graph.getNode("p1") as { beds?: number })?.beds).toBe(2);
    again.close();
  });
});

describe("everything leaves in one bundle", () => {
  it("round-trips graph, history and version", async () => {
    const root = scratch();
    const opened = await openStore({ app, adapter: createFileAdapter(root) });
    opened.store.apply({ name: "add-plot", args: { label: "One", beds: 3 } });
    await opened.flush();
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
      couldNotJudge: 0,
      overBudget: 0,
      danglingEdges: [],
      findings: 0,
      at: "2026-09-01T00:00:00Z",
    });
    opened.close();
  });

  // FR-29: a rule that could not answer is counted by its status, not found by its words.
  it("counts the rules that could not judge and the rules over budget apart", async () => {
    const unjudged = defineInvariant<typeof schema, "plot">("reads-a-missing-field", {
      scope: { kind: "plot" },
      evaluate: () => {
        throw new TypeError("no such field");
      },
    });
    const greedy = defineInvariant<typeof schema>("reads-everything", {
      scope: "graph",
      evaluate: () => {
        throw new RuleBudgetError("this rule looks at too much of the graph");
      },
    });
    const opened = await openStore({ app: defineApp({ ...app, invariants: [unjudged, greedy] }), adapter: createFileAdapter(scratch()) });
    opened.store.apply({ name: "add-plot", args: { label: "One", beds: 3 } });
    const report = health(opened.store);
    expect(report.violations).toBe(2);
    expect(report.couldNotJudge).toBe(1);
    expect(report.overBudget).toBe(1);
    // FR-21: and each is a stored-data finding, counted with the rest.
    expect(report.findings).toBe(2);
    opened.close();
  });
});

// FR-28: a store opens over records an older declaration wrote, says what they are, and still checks what is written next.
describe("a store holds records that no longer fit", () => {
  it("opens over a stored graph whose records no longer fit, reports them, refuses a write that does not fit, and writes nothing back", async () => {
    const root = scratch();
    (await openStore({ app, adapter: createFileAdapter(root) })).close();
    const misfits = {
      nodes: [
        { id: "p1", kind: "plot", label: "North", beds: 0 },
        { id: "p2", kind: "plot", label: "South", beds: 2, size: "large" },
      ],
      edges: [],
    };
    await createFileAdapter(root).save("garden", misfits as never);

    const opened = await openStore({ app, adapter: createFileAdapter(root) });
    expect(opened.store.findings().map((f) => `${f.code} ${f.id} ${f.detail}`)).toEqual(["node-shape p1 beds"]);
    expect(health(opened.store).findings).toBe(1);
    expect(opened.store.snapshot()).toEqual(misfits);
    expect(await createFileAdapter(root).load("garden")).toEqual(misfits);
    expect(() =>
      opened.store.applyPrimitives([{ op: "patch-node", id: "p2", before: { beds: 2 }, after: { beds: 0 } }]),
    ).toThrow();
    opened.close();
  });
});

// FR-31: what a version writes says what wrote it, and the version before it says "newer format" rather than folding it.
describe("stored formats carry their version", () => {
  it("a store records the framework and the formats that wrote it", async () => {
    const root = scratch();
    const adapter = createFileAdapter(root);
    const opened = await openStore({ app, adapter });
    opened.store.apply({ name: "add-plot", args: { label: "One", beds: 3 } });
    await opened.flush();
    opened.close();
    expect(adapter.loadMeta("garden")).toEqual({ version: 2, framework: FRAMEWORK_VERSION, formats: { ...FORMATS } });
  });

  it("a snapshot written in a newer format is reported, not folded", async () => {
    const root = scratch();
    const adapter = createFileAdapter(root);
    const opened = await openStore({ app, adapter });
    opened.store.apply({ name: "add-plot", args: { label: "One", beds: 3 } });
    await opened.flush();
    opened.close();
    // What the next version would have written.
    adapter.saveMeta("garden", { version: 2, framework: "9.0.0", formats: { snapshot: FORMATS.snapshot + 1, op: FORMATS.op } });
    await expect(openStore({ app, adapter })).rejects.toThrow(NewerFormatError);
    await expect(openStore({ app, adapter })).rejects.toThrow(/newer format.*written by @graview 9\.0\.0.*Refold it from the log/);
  });

  it("a bundle carries its stamp, and one in a newer format is refused on import", async () => {
    const opened = await openStore({ app, adapter: createFileAdapter(scratch()) });
    const bundle = exportBundle(app, opened.store);
    expect(bundle.framework).toBe(FRAMEWORK_VERSION);
    expect(bundle.formats).toEqual({ ...FORMATS });
    expect(() => assertBundle(app, bundle)).not.toThrow();
    expect(() => assertBundle(app, { ...bundle, formats: { ...FORMATS, op: FORMATS.op + 1 } })).toThrow(NewerFormatError);
    opened.close();
  });
});
