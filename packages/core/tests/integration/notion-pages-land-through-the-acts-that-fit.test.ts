import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, scriptedNotion } from "../../src/sync/index.js";

/**
 * WHAT A NOTION PAGE LANDS THROUGH, from an app that declared more than the
 * connection needed (North Pole): a page made in Notion becomes a record
 * through an act that makes one from the page's fields alone — not the
 * first act that creates the kind, which may log a check on a reindeer — and
 * the checker says when there is none; a change in Notion to a field
 * another act writes lands through the derived edit, which keeps every
 * field a connection maps; and a page that cannot become a record is said
 * once and left until it changes in Notion.
 */

const SECRET = "secret_scriptedNotionIntegrationSecret0001";
const DATABASE = "0".repeat(31) + "1";

const northPole = (acts: Record<string, unknown>, connections: Record<string, unknown>, kinds: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "North Pole",
  kinds: {
    reindeer: { fields: { name: { type: "string", required: true } } },
    "health-check": {
      fields: {
        name: { type: "string", required: true },
        checkedOn: { type: "date", required: true },
        weight: { type: "number" },
      },
    },
    toy: {
      fields: {
        name: { type: "string", required: true },
        status: { type: "enum", options: ["Not Started", "In Progress", "Complete"], required: true },
        completed: { type: "integer", min: 0 },
      },
    },
    ...kinds,
  },
  acts: { "add-reindeer": { creates: "reindeer" }, ...acts },
  connections,
});

const checksConnection = (properties: Record<string, string> = { name: "Name", checkedOn: "Checked On", weight: "Weight" }) => ({ checks: { system: "notion", database: DATABASE, kind: "health-check", properties, direction: "both" } });
const toysConnection = { toys: { system: "notion", database: DATABASE, kind: "toy", properties: { name: "Name", status: "Status", completed: "Completed" }, direction: "both" } };
const LOG_A_CHECK = { on: "reindeer", creates: "health-check", effects: [{ connect: "checked", from: "$new", to: "$subject" }] };
const CHECKED = { "health-check": { fields: { name: { type: "string", required: true }, checkedOn: { type: "date", required: true }, weight: { type: "number" } }, edges: { checked: { to: ["reindeer"], cardinality: "one" } } } };

const findings = (raw: unknown, severity = "error") =>
  compileDocument(raw)
    .findings.filter((finding) => finding.severity === severity)
    .map((finding) => ({ code: finding.code, path: finding.path, message: finding.message, fix: finding.fix, ...(finding.details ? { details: finding.details } : {}) }));

function opened(raw: unknown, name: string, properties: Record<string, string>) {
  const compiled = compileDocument(raw);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const stub = scriptedNotion({ secret: SECRET });
  const db = stub.database({ title: name, properties, options: { Status: ["Not Started", "In Progress", "Complete"] } });
  const said: string[] = [];
  const open = (state?: ReturnType<typeof connection>["engine"]["snapshot"]) =>
    connection({ name, declaration: app.connections![name]!, app, store, databaseId: db, token: () => SECRET, fetch: stub.fetch, ...(state ? { state } : {}), say: (line) => said.push(line) }).engine;
  const nodes = (kind: string) => store.graph.allNodes().filter((node) => node.kind === kind) as unknown as Record<string, unknown>[];
  return { app, store, stub, db, said, engine: open(), open, nodes };
}

describe("a page made in Notion becomes a record through an act that fits it", () => {
  it("passes over a creating act that takes a subject, for one that makes the record from the page's fields alone", async () => {
    const raw = northPole({ "log-health-check": LOG_A_CHECK, "record-health-check": { creates: "health-check" } }, checksConnection(), CHECKED);
    expect(findings(raw)).toEqual([]);
    const { stub, db, engine, nodes, store } = opened(raw, "checks", { Name: "title", "Checked On": "date", Weight: "number" });
    stub.add(db, { Name: "Comet, weekly", "Checked On": "2026-12-01", Weight: 320 });
    const report = await engine.run();
    expect(report.refused).toEqual([]);
    expect(nodes("health-check")).toEqual([expect.objectContaining({ name: "Comet, weekly", checkedOn: "2026-12-01", weight: 320 })]);
    expect(store.log.all().at(-1)).toMatchObject({ author: { kind: "system", id: "notion" }, mutation: { name: "record-health-check" } });
  });

  it("prefers add-<kind> over another act that fits", async () => {
    const raw = northPole({ "record-health-check": { creates: "health-check" }, "add-health-check": { creates: "health-check" } }, checksConnection());
    const { stub, db, engine, store } = opened(raw, "checks", { Name: "title", "Checked On": "date", Weight: "number" });
    stub.add(db, { Name: "Dasher", "Checked On": "2026-12-02" });
    await engine.run();
    expect(store.log.all().at(-1)).toMatchObject({ mutation: { name: "add-health-check" } });
  });

  it("is refused by graview check when every act that makes the kind takes a subject, or asks for what the connection does not map", () => {
    const raw = northPole({ "log-health-check": LOG_A_CHECK }, checksConnection(), CHECKED);
    // Said to the person in plain words (FR-229); the framework's sentence is its details.
    expect(findings(raw)).toEqual([
      expect.objectContaining({
        code: "connection-creates",
        path: "connections.checks.kind",
        message: "A health check is only ever made on a reindeer (log-health-check), and a Notion page is made on nothing.",
        fix: "Add an act that makes a health check on its own, or sync to a kind made for pages.",
        details: expect.stringMatching(/^a page made in the database becomes a health check through an act that makes one from the page's fields alone, and log-health-check acts on a reindeer — declare an act with "creates": "health-check" and no "on"/),
      }),
    ]);
    // A required field the connection leaves out is one no page could fill.
    const unmapped = northPole({ "add-health-check": { creates: "health-check" } }, checksConnection({ name: "Name", weight: "Weight" }));
    expect(findings(unmapped)).toEqual([expect.objectContaining({ code: "connection-creates", message: "Health checks need a Checked on, and Notion pages don't have one.", details: expect.stringMatching(/add-health-check asks for checkedOn, which the connection does not map/) })]);
  });
});

describe("a change in Notion to a field another act writes", () => {
  const toyActs = {
    "add-toy": { creates: "toy" },
    "set-toy-status": { on: "toy", writes: ["status"] },
    "add-made": { on: "toy", args: { made: { type: "integer", required: true, min: 1 } }, sets: { completed: { expr: "either(completed, 0) + made" } } },
  };

  it("is no finding, and lands through the derived edit, which keeps every field the connection maps", async () => {
    const raw = northPole(toyActs, toysConnection);
    expect(findings(raw)).toEqual([]);
    const { stub, db, engine, nodes, store } = opened(raw, "toys", { Name: "title", Status: "status", Completed: "number" });
    stub.add(db, { Name: "Rocking horse", Status: "Not Started", Completed: 0 });
    await engine.run();
    const [page] = stub.pages(db);
    stub.tick(60_000);
    stub.edit(String(page!["id"]), { Status: "In Progress", Completed: 12 });
    const report = await engine.run();
    expect(report.refused).toEqual([]);
    expect(nodes("toy")).toEqual([expect.objectContaining({ name: "Rocking horse", status: "In Progress", completed: 12 })]);
    expect(store.log.all().at(-1)).toMatchObject({ author: { kind: "system", id: "notion" }, mutation: { name: "edit-toy" } });
    // The named steps are still there, and still the only ones a kind without a connection is given.
    expect(store.mutation("edit-toy").writes).toEqual(expect.arrayContaining(["name", "status", "completed"]));
    const alone = compileDocument(northPole(toyActs, {}));
    if (!alone.ok) throw new Error("compiles");
    const kept = new Store<AnySchema>({ schema: alone.app.schema as AnySchema, mutations: alone.app.mutations ?? [] });
    expect(kept.mutation("edit-toy").writes).toEqual(["name"]);
  });

  it("is still refused by graview check when the app's own edit-<kind> leaves a mapped field out", () => {
    const raw = northPole({ ...toyActs, "edit-toy": { on: "toy", writes: ["name"] } }, toysConnection);
    expect(findings(raw)).toEqual([expect.objectContaining({ code: "connection-edit", path: "connections.toys.properties", message: expect.stringMatching(/edit-toy, which does not write status, completed/) })]);
  });
});

describe("a page that cannot become a record", () => {
  it("is said once, kept as skipped, not tried again until it changes in Notion, and arrives once it is filled", async () => {
    const raw = northPole({ "add-health-check": { creates: "health-check" } }, checksConnection());
    const { stub, db, engine, open, nodes } = opened(raw, "checks", { Name: "title", "Checked On": "date", Weight: "number" });
    const blank = stub.add(db, {});
    const first = await engine.run();
    expect(first.refused).toEqual([expect.objectContaining({ resource: "pages", id: String(blank["id"]) })]);
    expect(engine.snapshot.skipped).toEqual({ [`pages:${String(blank["id"])}`]: expect.any(String) });
    const again = await engine.run();
    expect(again.refused).toEqual([]);
    // A whole read, from what the engine kept, does not say it again either.
    const { cursor: _cursor, ...kept } = engine.snapshot;
    const later = open(kept);
    expect((await later.run()).refused).toEqual([]);
    expect(nodes("health-check")).toEqual([]);

    stub.tick(60_000);
    stub.edit(String(blank["id"]), { Name: "Vixen", "Checked On": "2026-12-03" });
    const filled = await later.run();
    expect(filled.refused).toEqual([]);
    expect(nodes("health-check")).toEqual([expect.objectContaining({ name: "Vixen", checkedOn: "2026-12-03" })]);
    expect(later.snapshot.skipped).toBeUndefined();
  });
});
