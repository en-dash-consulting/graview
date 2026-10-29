import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, scriptedNotion, type SyncReport } from "../../src/sync/index.js";

/**
 * A NOTION CONNECTION MAKES THE PROPERTIES IT NEEDS, AND ONE DATABASE HOLDS
 * SEVERAL KINDS: a mapped field the data source lacks is given a property
 * of the type it is held in on the first pass, said in the report, and
 * never made twice; a property somebody made is never renamed or deleted,
 * and one of another type is said and left; `create: false` and a
 * connection that only reads make none. Several data sources of one
 * database (`sources`) are each kept with their own kind, a page written
 * to the source its kind is, and a relation between two of them is an
 * edge, its property made to link the other source. The checker refuses a
 * source of an unknown kind, two sources for one kind, and a property
 * mapped to a field the kind lacks. All against the scripted Notion.
 */

const SECRET = "secret_scriptedNotionIntegrationSecret0001";

const document = (connections: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Garden",
  kinds: {
    task: {
      fields: {
        name: { type: "string", required: true },
        stage: { type: "enum", options: ["to-do", "in-progress", "done"] },
        due: { type: "date" },
        finished: { type: "boolean" },
        estimate: { type: "number" },
      },
      edges: { bed: { to: ["bed"], cardinality: "one" } },
    },
    bed: { fields: { name: { type: "string", required: true }, notes: { type: "text" } } },
  },
  acts: { "add-task": { creates: "task" }, "add-bed": { creates: "bed" } },
  connections,
});

const tasksOnly = (extra: Record<string, unknown> = {}) => ({ system: "notion", database: "0".repeat(31) + "1", kind: "task", properties: { name: "Name", stage: "Status", due: "Due", finished: "Done", estimate: "Estimate" }, direction: "both", ...extra });
const both = (extra: Record<string, unknown> = {}) => ({
  system: "notion",
  database: "0".repeat(31) + "1",
  direction: "both",
  sources: [
    { source: "Tasks", kind: "task", properties: { name: "Name", stage: "Status", bed: "Bed" } },
    { source: "Beds", kind: "bed", properties: { name: "Name", notes: "Notes" } },
  ],
  ...extra,
});

const codes = (raw: unknown) =>
  compileDocument(raw)
    .findings.filter((finding) => finding.severity === "error")
    .map((finding) => `${finding.code} ${finding.path}`);

function opened(declared: Record<string, unknown>, shape: (stub: ReturnType<typeof scriptedNotion>) => string) {
  const compiled = compileDocument(document({ garden: declared }));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const stub = scriptedNotion({ secret: SECRET });
  const db = shape(stub);
  const said: string[] = [];
  const { engine } = connection({ name: "garden", declaration: app.connections!["garden"]!, app, store, databaseId: db, token: () => SECRET, fetch: stub.fetch, say: (line) => said.push(line) });
  const kindOf = (kind: string) => store.graph.allNodes().filter((node) => node.kind === kind) as unknown as Record<string, unknown>[];
  const as = { author: { kind: "human" as const, id: "nick" }, intent: "by hand" };
  const changed = () => stub.requests.filter((request) => request.method === "PATCH" && request.path.startsWith("/data_sources/"));
  return { app, store, stub, db, engine, said, kindOf, as, changed };
}

describe("a Notion connection makes the properties it needs", () => {
  it("makes each mapped property the data source lacks, of the type its field is held in, and says so in the report", async () => {
    const { stub, db, engine } = opened(tasksOnly(), (stub) => stub.database({ title: "Tasks", properties: { Name: "title" } }));
    const report = await engine.run();
    expect(report.said).toContainEqual("Made 4 properties in Notion: Status, Due, Done and Estimate");
    expect(stub.properties(db)).toEqual({ Name: "title", Status: "select", Due: "date", Done: "checkbox", Estimate: "number" });
    // A choice's options are made as people read them.
    const made = stub.requests.find((request) => request.method === "PATCH" && request.path.startsWith("/data_sources/"))!;
    expect((made.body!["properties"] as Record<string, unknown>)["Status"]).toEqual({ select: { options: [{ name: "To do" }, { name: "In progress" }, { name: "Done" }] } });
  });

  it("keeps what it made in step at once, both ways, and makes nothing on the next pass", async () => {
    const { stub, db, engine, store, as, kindOf, changed } = opened(tasksOnly(), (stub) => stub.database({ title: "Tasks", properties: { Name: "title" } }));
    store.apply({ name: "add-task", args: { id: "task:weed", name: "Weed", stage: "in-progress", due: "2026-11-02", finished: false, estimate: 2 } }, as);
    await engine.run();
    const [page] = stub.pages(db);
    expect(page).toBeDefined();
    stub.edit(String(page!["id"]), { Status: "Done" });
    const second: SyncReport = await engine.run();
    expect(second.said).toBeUndefined();
    expect(changed()).toHaveLength(1);
    expect(kindOf("task")[0]).toMatchObject({ name: "Weed", stage: "done", due: "2026-11-02", estimate: 2 });
  });

  it("never renames or deletes a property somebody made, and says one of another type rather than changing it", async () => {
    const { stub, db, engine } = opened(tasksOnly(), (stub) => stub.database({ title: "Tasks", properties: { Name: "title", Estimate: "rich_text", "Their own": "rich_text" } }));
    const report = await engine.run();
    expect(stub.properties(db)).toMatchObject({ Estimate: "rich_text", "Their own": "rich_text" });
    expect(report.said).toContainEqual("Made 3 properties in Notion: Status, Due and Done");
    expect(report.said).toContainEqual(expect.stringMatching(/^Estimate: the property Estimate is a rich_text property, and a number field cannot hold it, so it is left out$/));
  });

  it("makes none with create: false, nor for a connection that only reads", async () => {
    for (const extra of [{ create: false }, { direction: "read" }]) {
      const { stub, db, engine, changed, said } = opened(tasksOnly(extra), (stub) => stub.database({ title: "Tasks", properties: { Name: "title" } }));
      await engine.run();
      expect(changed()).toEqual([]);
      expect(stub.properties(db)).toEqual({ Name: "title" });
      expect(said).toContainEqual(expect.stringMatching(/no property in the database for Status, Due, Done, Estimate/));
    }
  });

  it("names a property it made by the field, as people read it, when the properties are matched by name", async () => {
    const { stub, db, engine } = opened(tasksOnly({ properties: undefined }), (stub) => stub.database({ title: "Tasks", properties: { Name: "title", Finished: "checkbox" } }));
    const report = await engine.run();
    expect(report.said).toContainEqual("Made 3 properties in Notion: Stage, Due and Estimate");
    expect(stub.properties(db)).toEqual({ Name: "title", Finished: "checkbox", Stage: "select", Due: "date", Estimate: "number" });
  });
});

describe("one database holds several kinds", () => {
  const twoSources = (stub: ReturnType<typeof scriptedNotion>) => {
    const db = stub.database({ title: "Tasks", properties: { Name: "title" } });
    stub.source(db, { title: "Beds", properties: { Name: "title", Notes: "rich_text" } });
    return db;
  };

  it("keeps each data source with its own kind, and makes the relation between them as a relation property to the other source", async () => {
    const { stub, db, engine, kindOf, store } = opened(both(), twoSources);
    const [tasks, beds] = stub.sources(db);
    const north = stub.add(beds!, { Name: "North bed", Notes: "Sunny" });
    const report = await engine.run();
    expect(report.said).toContainEqual("Made 2 properties in Notion for task: Status and Bed");
    expect(stub.properties(tasks!)).toEqual({ Name: "title", Status: "select", Bed: "relation" });
    // A page of the tasks' source linking the bed lands as a task linked to it.
    stub.add(tasks!, { Name: "Mulch", Status: "To do", Bed: [String(north["id"])] });
    await engine.run();
    expect(kindOf("bed").map((node) => node["name"])).toEqual(["North bed"]);
    const mulch = kindOf("task").find((node) => node["name"] === "Mulch")!;
    expect(store.graph.out(String(mulch["id"]), "bed").map((node) => node["id"])).toEqual([kindOf("bed")[0]!["id"]]);
  });

  it("writes a record made here to the data source its kind is kept in", async () => {
    const { stub, db, engine, store, as } = opened(both(), twoSources);
    const [tasks, beds] = stub.sources(db);
    store.apply({ name: "add-bed", args: { id: "bed:south", name: "South bed", notes: "Shade" } }, as);
    store.apply({ name: "add-task", args: { id: "task:water", name: "Water" } }, as);
    const report = await engine.run();
    expect([...report.pushed].sort()).toEqual(["bed:south", "task:water"]);
    expect(stub.pages(beds!).map((page) => (page["properties"] as Record<string, { title: { plain_text: string }[] }>)["Name"]!.title[0]!.plain_text)).toEqual(["South bed"]);
    expect(stub.pages(tasks!).map((page) => (page["properties"] as Record<string, { title: { plain_text: string }[] }>)["Name"]!.title[0]!.plain_text)).toEqual(["Water"]);
    // The next pass is quiet: nothing sent, nothing taken.
    const next = await engine.run();
    expect([next.pushed, next.applied, next.refused]).toEqual([[], [], []]);
  });
});

describe("with several sources, every sentence names its kind (request:notion-said-names-its-source)", () => {
  const declared = both({
    create: false,
    sources: [
      { source: "Tasks", kind: "task", properties: { name: "Name", stage: "Status", estimate: "Estimate" } },
      { source: "Beds", kind: "bed", properties: { name: "Name", notes: "Notes" } },
    ],
  });
  const shaped = (stub: ReturnType<typeof scriptedNotion>) => {
    const db = stub.database({ title: "Tasks", properties: { Name: "title", Status: "select", Estimate: "rich_text", Total: "formula" } });
    stub.source(db, { title: "Beds", properties: { Name: "title", Total: "formula" } });
    return db;
  };

  it("says what it left alone and left out with the kind it is of, and the same note for two sources once each", async () => {
    const { engine } = opened(declared, shaped);
    const report = await engine.run();
    const said = report.said ?? [];
    expect(said).toContainEqual("task's Estimate: the property Estimate is a rich_text property, and a number field cannot hold it, so it is left out");
    expect(said).toContainEqual("no property in the data source for bed for Notes, so it is not kept in step");
    expect(said.filter((line) => line.startsWith("left alone in Notion"))).toEqual([expect.stringMatching(/^left alone in Notion for task: Total \(formula/), expect.stringMatching(/^left alone in Notion for bed: Total \(formula/)]);
    expect(said.every((line) => / for (task|bed)\b|^(task|bed)'s /.test(line))).toBe(true);
  });

  it("hands each sentence back with its kind beside the words, in the order said has them", async () => {
    const { engine } = opened(declared, shaped);
    const report = await engine.run();
    expect(report.saidBy?.map((one) => one.sentence)).toEqual(report.said);
    expect(report.saidBy?.map((one) => `${one.kind}: ${one.sentence.slice(0, 12)}`)).toEqual(report.said!.map((line) => `${/\bbed\b/.test(line) ? "bed" : "task"}: ${line.slice(0, 12)}`));
    // Nothing new said, nothing handed back.
    const next = await engine.run();
    expect([next.said, next.saidBy]).toEqual([undefined, undefined]);
  });

  it("keeps a connection of one source's sentences as they were, each with its kind", async () => {
    const { engine } = opened(tasksOnly(), (stub) => stub.database({ title: "Tasks", properties: { Name: "title", Estimate: "rich_text" } }));
    const report = await engine.run();
    expect(report.said).toContainEqual("Estimate: the property Estimate is a rich_text property, and a number field cannot hold it, so it is left out");
    expect(report.saidBy).toContainEqual({ kind: "task", sentence: "Estimate: the property Estimate is a rich_text property, and a number field cannot hold it, so it is left out" });
  });
});

describe("graview check judges a connection's sources", () => {
  it("passes a connection of several sources", () => {
    expect(codes(document({ garden: both() }))).toEqual([]);
  });

  it("refuses a source of an unknown kind, two sources for one kind, and a property mapped to a field the kind lacks", () => {
    const sources = (list: unknown[]) => document({ garden: { ...both(), sources: list } });
    expect(codes(sources([{ source: "Tasks", kind: "chore" }]))).toEqual(["connection-kind connections.garden.sources.0.kind"]);
    expect(codes(sources([{ source: "Tasks", kind: "task" }, { source: "More tasks", kind: "task" }]))).toEqual(["connection-sources connections.garden.sources.1.kind"]);
    expect(codes(sources([{ source: "Tasks", kind: "task", properties: { name: "Name", shade: "Shade" } }]))).toEqual(["connection-field connections.garden.sources.0.properties.shade"]);
    expect(codes(sources([{ source: "Tasks", kind: "task" }, { source: "tasks", kind: "bed" }]))).toEqual(["connection-sources connections.garden.sources.1.source"]);
  });

  it("refuses a connection that names both its sources and a kind of its own, or neither", () => {
    expect(codes(document({ garden: both({ kind: "task" }) }))).toEqual(["connection-sources connections.garden.kind"]);
    expect(codes(document({ garden: { system: "notion", database: "0".repeat(32), direction: "both" } }))).toEqual(["connection-kind connections.garden.kind"]);
  });
});
