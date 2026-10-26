import { afterEach, describe, expect, it, vi } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, notion, scriptedNotion, type ScriptedNotion } from "../../src/sync/index.js";

/**
 * A NOTION DATABASE DECLARED AS A CONNECTION (`connections.<name>` with
 * `system: "notion"`): judged by the checker, and run against a scripted
 * Notion — each property type, both ways, every page of a query, our own
 * write not echoed, a conflict held, a page archived on either side,
 * Notion's rate limit waited out, a secret it refuses and a database not
 * shared said as sentences, and a full read that loses and duplicates
 * nothing. `scripts/verify-notion.mjs` runs the same against a real
 * workspace.
 */

const SECRET = "secret_scriptedNotionIntegrationSecret0001";

const tasks = (connections: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Tasks",
  kinds: {
    task: {
      fields: {
        name: { type: "string", required: true },
        notes: { type: "text" },
        estimate: { type: "number" },
        stage: { type: "enum", options: ["to-do", "in-progress", "done"] },
        tags: { type: "list", of: "string" },
        due: { type: "date" },
        at: { type: "datetime" },
        finished: { type: "boolean" },
        link: { type: "url" },
        email: { type: "email" },
        phone: { type: "phone" },
        owner: { type: "string" },
      },
    },
  },
  acts: { "add-task": { creates: "task" } },
  connections,
  ...more,
});

const PROPERTIES = { name: "Name", notes: "Notes", estimate: "Estimate", stage: "Stage", tags: "Tags", due: "Due", at: "At", finished: "Done", link: "Link", email: "Email", phone: "Phone", owner: "Owner" };

const database = (extra: Record<string, unknown> = {}) => ({
  system: "notion",
  database: { env: "TASKS_DATABASE" },
  kind: "task",
  properties: PROPERTIES,
  direction: "both",
  ...extra,
});

const codes = (raw: unknown, severity = "error") => {
  const compiled = compileDocument(raw);
  return compiled.findings.filter((finding) => finding.severity === severity).map((finding) => `${finding.code} ${finding.path}`);
};

describe("graview check judges a declared Notion database", () => {
  it("passes a database whose properties are mapped, and one whose properties are matched by name", () => {
    expect(codes(tasks({ team: database() }))).toEqual([]);
    expect(codes(tasks({ team: database({ properties: undefined }) }))).toEqual([]);
    expect(codes(tasks({ team: database({ database: "1f2e3d4c5b6a79881f2e3d4c5b6a7988" }) }))).toEqual([]);
    expect(codes(tasks({ team: database({ database: "1f2e3d4c-5b6a-7988-1f2e-3d4c5b6a7988" }) }))).toEqual([]);
  });

  it("refuses a secret written into the declaration, and never says it", () => {
    const secret = "secret_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
    const compiled = compileDocument(tasks({ team: database({ description: `use ${secret}` }) }));
    expect(compiled.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} ${finding.path}`)).toEqual(["connection-secret connections.team.description"]);
    expect(JSON.stringify(compiled.findings)).not.toContain(secret);
    expect(codes(tasks({ team: database({ database: "ntn_1234567890abcdefghijABCDEFGHIJ" }) }))).toEqual(["connection-secret connections.team.database"]);
    expect(codes(tasks({ team: database({ token: "x" }) }))).toEqual(["unknown-key connections.team"]);
  });

  it("says each wrong shape at its place", () => {
    expect(codes(tasks({ team: database({ database: "https://www.notion.so/workspace/Tasks" }) }))).toEqual(["shape connections.team.database"]);
    expect(codes(tasks({ team: database({ system: "airtable" }) }))).toEqual(["shape connections.team.system"]);
    expect(codes(tasks({ team: database({ properties: { owner: { name: "Related", type: "relation" } } }) }))).toEqual(["shape connections.team.properties.owner"]);
  });

  it("says a field the kind lacks, a property held twice, and a field that cannot hold the property's type", () => {
    expect(codes(tasks({ team: database({ properties: { title: "Name" } }) }))).toEqual(["connection-field connections.team.properties.title"]);
    expect(codes(tasks({ team: database({ properties: { name: "Name", notes: "Name" } }) }))).toEqual(["connection-field connections.team.properties.notes"]);
    expect(codes(tasks({ team: database({ properties: { name: "Name", estimate: { name: "Estimate", type: "rich_text" } } }) }))).toEqual(["connection-field-type connections.team.properties.estimate"]);
    expect(codes(tasks({ team: database({ properties: { name: "Name", finished: { name: "Done", type: "checkbox" }, due: { name: "Due", type: "date" }, stage: { name: "Stage", type: "status" } } }) }))).toEqual([]);
    expect(codes(tasks({ team: database({ properties: {} }) }))).toEqual(["connection-properties connections.team.properties"]);
  });

  it("warns that a people property is only read, and says the acts a page lands through", () => {
    expect(codes(tasks({ team: database({ properties: { name: "Name", owner: { name: "Owner", type: "people" } } }) }), "warning")).toContain("connection-read-only connections.team.properties.owner");
    const raw = tasks({ team: database() });
    delete (raw.acts as Record<string, unknown>)["add-task"];
    expect(codes(raw)).toContain("connection-creates connections.team.kind");
  });
});

/* ------------------------------------------------------------ the runs */

const DATABASE_PROPERTIES = {
  Name: "title",
  Notes: "rich_text",
  Estimate: "number",
  Stage: "status",
  Tags: "multi_select",
  Due: "date",
  At: "date",
  Done: "checkbox",
  Link: "url",
  Email: "email",
  Phone: "phone_number",
  Owner: "people",
  Related: "relation",
  Total: "formula",
};

function opened(declared: Record<string, unknown> = database(), options: { stub?: ScriptedNotion; more?: Record<string, unknown> } = {}) {
  const compiled = compileDocument(tasks({ team: declared }, options.more));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const stub = options.stub ?? scriptedNotion({ secret: SECRET });
  const db = stub.database({ title: "Tasks", properties: DATABASE_PROPERTIES, options: { Stage: ["To do", "In progress", "Done"], Tags: ["home"] } });
  const said: string[] = [];
  let token = SECRET;
  const made = connection({ name: "team", declaration: app.connections!["team"]!, app, store, databaseId: db, token: () => token, secretName: "NOTION_TOKEN", fetch: stub.fetch, say: (line) => said.push(line) });
  const nodes = () => store.graph.allNodes().filter((node) => node.kind === "task") as unknown as Record<string, unknown>[];
  const node = (id: string) => store.graph.getNode(id) as unknown as Record<string, unknown>;
  const as = (who: string) => ({ author: { kind: "human" as const, id: who }, intent: "by hand" });
  const plainOf = (page: Record<string, unknown>, name: string) => {
    const property = (page["properties"] as Record<string, Record<string, unknown>>)[name]!;
    return property[String(property["type"])];
  };
  return { app, store, stub, db, said, engine: made.engine, nodes, node, as, plainOf, setToken: (next: string) => (token = next) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("a Notion database, both ways", () => {
  it("takes a page with every property type into a record, credited to Notion", async () => {
    const { stub, db, engine, nodes, store, said } = opened();
    stub.add(db, {
      Name: "Paint the fence",
      Notes: "Two coats",
      Estimate: 3.5,
      Stage: "In progress",
      Tags: ["home", "garden"],
      Due: "2026-11-02",
      At: "2026-11-02T10:00:00.000+02:00",
      Done: true,
      Link: "https://example.com/fence",
      Email: "pat@example.com",
      Phone: "+1 555 0100",
      Owner: ["Pat Doe", "Sam Roe"],
    });
    const report = await engine.run();
    expect([report.offline, report.refused]).toEqual([false, []]);
    const [task] = nodes();
    expect(task).toMatchObject({
      name: "Paint the fence",
      notes: "Two coats",
      estimate: 3.5,
      stage: "in-progress",
      tags: ["home", "garden"],
      due: "2026-11-02",
      at: "2026-11-02T08:00:00Z",
      finished: true,
      link: "https://example.com/fence",
      email: "pat@example.com",
      phone: "+1 555 0100",
      owner: "Pat Doe, Sam Roe",
    });
    expect(store.log.all().at(-1)!.author).toEqual({ kind: "system", id: "notion" });
    // A relation and a formula are left alone, and said so once.
    expect(said.filter((line) => line.startsWith("left alone in Notion"))).toEqual([expect.stringMatching(/Related \(relation: .*one database.*\), Total \(formula/)]);
    await engine.run();
    expect(said.filter((line) => line.startsWith("left alone in Notion"))).toHaveLength(1);
  });

  it("makes a page for a record made here, sets the properties of one edited here, and writes each type as Notion takes it", async () => {
    const { stub, db, engine, store, as, plainOf } = opened();
    store.apply({ name: "add-task", args: { id: "task:fence", name: "Fence", stage: "to-do", tags: ["home"], due: "2026-11-03", at: "2026-11-03T09:30:00Z", finished: false, estimate: 2 } }, as("nick"));
    const sent = await engine.run();
    expect(sent.pushed).toEqual(["task:fence"]);
    const [page] = stub.pages(db);
    expect(plainOf(page!, "Name")).toEqual([expect.objectContaining({ plain_text: "Fence" })]);
    // The enum's option is written as the status Notion has: "to-do" is "To do".
    expect(plainOf(page!, "Stage")).toMatchObject({ name: "To do" });
    expect(plainOf(page!, "Tags")).toEqual([expect.objectContaining({ name: "home" })]);
    expect(plainOf(page!, "Due")).toMatchObject({ start: "2026-11-03" });
    expect(plainOf(page!, "At")).toMatchObject({ start: "2026-11-03T09:30:00Z" });
    expect(plainOf(page!, "Estimate")).toBe(2);

    store.apply({ name: "edit-task", args: { id: "task:fence", stage: "done", finished: true, link: "https://example.com", owner: "Somebody" } }, as("nick"));
    const edited = await engine.run();
    expect(edited.pushed).toEqual(["task:fence"]);
    const after = stub.page(String(page!["id"]))!;
    expect(plainOf(after, "Stage")).toMatchObject({ name: "Done" });
    expect(plainOf(after, "Done")).toBe(true);
    expect(plainOf(after, "Link")).toBe("https://example.com");
    // People are read from Notion and never written.
    expect(plainOf(after, "Owner")).toEqual([]);
    const update = stub.requests.filter((request) => request.method === "PATCH").at(-1)!;
    expect(Object.keys((update.body!["properties"] as object) ?? {})).not.toContain("Owner");
  });

  it("does not take its own write back as news, and takes somebody's edit in the same minute", async () => {
    const { stub, db, engine, store, as, node } = opened();
    store.apply({ name: "add-task", args: { id: "task:fence", name: "Fence" } }, as("nick"));
    await engine.run();
    const echo = await engine.run();
    expect(echo.echoes).toEqual(["task:fence"]);
    expect(echo.applied).toEqual([]);
    expect(store.log.all().filter((op) => op.author.id === "notion")).toEqual([]);

    // Notion keeps last_edited_time to the minute: an edit in the same one is still a change.
    const [page] = stub.pages(db);
    stub.edit(String(page!["id"]), { Name: "Fence, twice" });
    const news = await engine.run();
    expect(news.applied).toEqual(["task:fence"]);
    expect(node("task:fence")["name"]).toBe("Fence, twice");
  });

  it("holds a field both sides changed, and sends and takes neither", async () => {
    const { stub, db, engine, store, as, node, plainOf } = opened();
    store.apply({ name: "add-task", args: { id: "task:fence", name: "Fence" } }, as("nick"));
    await engine.run();
    const [page] = stub.pages(db);
    stub.tick(60_000);
    stub.edit(String(page!["id"]), { Name: "Fence (theirs)" });
    store.apply({ name: "edit-task", args: { id: "task:fence", name: "Fence (ours)" } }, as("nick"));
    const report = await engine.run();
    expect(report.conflicts).toEqual([expect.objectContaining({ localId: "task:fence", field: "name", ours: "Fence (ours)", theirs: "Fence (theirs)", base: "Fence" })]);
    expect(node("task:fence")["name"]).toBe("Fence (ours)");
    expect(plainOf(stub.page(String(page!["id"]))!, "Name")).toEqual([expect.objectContaining({ plain_text: "Fence (theirs)" })]);
  });

  it("archives the page of a record removed here, and removes the record of a page archived there", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-25T10:00:00Z"));
    const { stub, db, engine, store, as, nodes } = opened();
    stub.add(db, { Name: "Theirs" });
    store.apply({ name: "add-task", args: { id: "task:mine", name: "Mine" } }, as("nick"));
    await engine.run();
    expect(stub.pages(db)).toHaveLength(2);

    store.apply({ name: "remove-task", args: { id: "task:mine" } }, as("nick"));
    const removed = await engine.run();
    expect(removed.pushed).toEqual(["task:mine"]);
    expect(stub.pages(db).map((page) => page["archived"])).toEqual([false]);
    expect(stub.pages(db, true)).toHaveLength(2);

    // Archived in Notion: a query no longer lists it, so the next whole read finds it gone.
    stub.archive(String(stub.pages(db)[0]!["id"]));
    const soon = await engine.run();
    expect(soon.gone).toEqual([]);
    vi.setSystemTime(new Date("2026-10-25T10:11:00Z"));
    const swept = await engine.run();
    expect(swept.gone).toHaveLength(1);
    expect(nodes()).toEqual([]);
  });

  it("follows every page of a query, and asks only for what was edited since", async () => {
    const { stub, db, engine, nodes } = opened();
    for (let n = 1; n <= 205; n++) stub.add(db, { Name: `Task ${n}` });
    await engine.run();
    expect(nodes()).toHaveLength(205);
    const queries = stub.requests.filter((request) => request.path.endsWith("/query"));
    expect(queries.map((request) => request.body!["start_cursor"])).toEqual([undefined, "100", "200"]);

    stub.tick(5 * 60_000);
    stub.add(db, { Name: "Task 206" });
    await engine.run();
    const last = stub.requests.filter((request) => request.path.endsWith("/query")).at(-1)!;
    expect(last.body!["filter"]).toEqual({ timestamp: "last_edited_time", last_edited_time: { on_or_after: "2026-10-25T10:00:00.000Z" } });
    expect(nodes()).toHaveLength(206);
  });

  it("reads the whole database again without a cursor and loses and duplicates nothing", async () => {
    const { stub, db, engine, store, as, nodes, app, said } = opened();
    stub.add(db, { Name: "Theirs" });
    store.apply({ name: "add-task", args: { id: "task:mine", name: "Mine" } }, as("nick"));
    await engine.run();
    const { cursor: _cursor, ...state } = engine.snapshot;
    // The same store, a new engine from what was kept, its cursor gone.
    const again = connection({ name: "team", declaration: app.connections!["team"]!, app, store, databaseId: db, token: () => SECRET, fetch: stub.fetch, state, say: (line) => said.push(line) });
    const report = await again.engine.run();
    expect([report.applied, report.pushed, report.gone, report.conflicts]).toEqual([[], [], [], []]);
    expect(nodes().map((node) => node["name"]).sort()).toEqual(["Mine", "Theirs"]);
    expect(stub.pages(db)).toHaveLength(2);
  });

  it("writes long words in Notion's 2000-character pieces and reads them back whole", async () => {
    const { stub, db, engine, store, as, node, plainOf } = opened();
    const notes = `${"a".repeat(1999)}😀${"b".repeat(2500)}`;
    store.apply({ name: "add-task", args: { id: "task:long", name: "Long", notes } }, as("nick"));
    const sent = await engine.run();
    expect(sent.refused).toEqual([]);
    const pieces = plainOf(stub.pages(db)[0]!, "Notes") as { plain_text: string }[];
    expect(pieces.map((piece) => piece.plain_text.length)).toEqual([1999, 2000, 502]);
    const echo = await engine.run();
    expect(echo.applied).toEqual([]);
    expect(node("task:long")["notes"]).toBe(notes);
  });
});

describe("what Notion refuses, said", () => {
  it("says a secret Notion refuses by the name it is kept under, never its value", async () => {
    const { engine, setToken } = opened();
    setToken("secret_NotTheOneNotionTakes000000000000");
    const report = await engine.run();
    expect(report.offline).toBe(true);
    expect(report.problem).toMatch(/Notion refused NOTION_TOKEN \(HTTP 401\)/);
    expect(report.problem).not.toContain("secret_");
  });

  it("says a database the integration cannot see as one to share with it", async () => {
    const { engine, stub, db } = opened();
    stub.share(db, false);
    const report = await engine.run();
    expect(report.offline).toBe(true);
    expect(report.problem).toMatch(/share the database with the integration/);
  });

  it("waits out Notion's rate limit as Retry-After says, and gives up past its bound", async () => {
    const stub = scriptedNotion({ secret: SECRET });
    const db = stub.database({ properties: { Name: "title" } });
    stub.add(db, { Name: "One" });
    const waits: number[] = [];
    const remote = notion({ databaseId: db, token: () => SECRET, fetch: stub.fetch, sleep: async (ms) => void waits.push(ms) });
    stub.limit(2, 3);
    const pulled = await remote.pull(undefined);
    expect(waits).toEqual([3000, 3000]);
    expect(pulled.changes).toHaveLength(1);

    stub.limit(100, 30);
    await expect(remote.pull(undefined)).rejects.toThrow(/still limiting the rate after 60 s/);
  });

  it("keeps the secret out of the log, the snapshot and the sync state", async () => {
    const { stub, db, engine, store, as } = opened();
    stub.add(db, { Name: "Theirs" });
    store.apply({ name: "add-task", args: { id: "task:mine", name: "Mine" } }, as("nick"));
    await engine.run();
    const kept = JSON.stringify([store.log.all(), store.graph.allNodes(), engine.snapshot]);
    expect(kept).not.toContain(SECRET);
  });
});

describe("properties matched by name", () => {
  it("keeps each field in step with the property of its name, the name field with the title, and says the fields it found none for", async () => {
    const { stub, db, engine, nodes, said } = opened(database({ properties: undefined }));
    stub.add(db, { Name: "Inferred", Estimate: 1, Done: true, Tags: ["home"] });
    await engine.run();
    expect(nodes()[0]).toMatchObject({ name: "Inferred", estimate: 1, tags: ["home"] });
    expect(nodes()[0]!["finished"]).toBeUndefined();
    // "finished" has no property of its name ("Done" is), and is said once.
    expect(said).toContainEqual(expect.stringMatching(/no property in the database for .*finished/));
  });
});

describe("read only", () => {
  it("takes the database's pages and refuses an act here that would change one, saying where to change it", async () => {
    const { stub, db, engine, nodes, store, as } = opened(database({ direction: "read" }));
    stub.add(db, { Name: "Board" });
    await engine.run();
    const [board] = nodes();
    expect(() => store.apply({ name: "edit-task", args: { id: board!["id"], name: "Bored" } }, as("nick"))).toThrow(/comes from a Notion database this app only reads/);
  });
});
