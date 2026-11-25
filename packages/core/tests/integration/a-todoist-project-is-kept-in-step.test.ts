import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { documentJsonSchema } from "../../src/cli/document-schema.js";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { keptInStepWith } from "../../src/document/kept-in-step-with.js";
import { connection, readRepeat, sayRepeat, scriptedTodoist, sharedLinks, todoist, type ScriptedTodoist, type SyncState } from "../../src/sync/index.js";

/**
 * A TODOIST PROJECT DECLARED AS A CONNECTION (`connections.<name>` with
 * `system: "todoist"`): judged by the checker, and run against a scripted
 * Todoist — every part of a task, both ways, by sync token. A task
 * completed there sets a field and removes nothing; our own write is not
 * echoed, a conflict is held, the rate limit is waited out, and a repeat
 * that cannot be said is held unsent. `scripts/verify-todoist.mjs` runs the
 * same against a real account.
 */

const TOKEN = "0123456789abcdef0123456789abcdef01234567";

const FIELDS = { content: "name", description: "notes", due: "due", deadline: "deadline", priority: "priority", labels: "labels", section: "section", assignee: "assignee", parent: "parent", completed: "done" };

const project = (extra: Record<string, unknown> = {}) => ({ system: "todoist", project: { env: "HOME_PROJECT" }, kind: "task", fields: FIELDS, direction: "both", sendExisting: true, ...extra });

const doc = (connections: Record<string, unknown>, fields: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Home",
  brand: { timeZone: "America/New_York" },
  kinds: {
    task: {
      fields: {
        name: { type: "string", required: true },
        notes: { type: "text" },
        due: { type: "datetime" },
        deadline: { type: "date" },
        priority: { type: "integer" },
        labels: { type: "list", of: "string" },
        section: { type: "string" },
        assignee: { type: "string" },
        done: { type: "boolean" },
        ...fields,
      },
      edges: { parent: { to: ["task"], cardinality: "one" } },
    },
  },
  acts: { "add-task": { creates: "task" } },
  connections,
});

const codes = (raw: unknown, severity = "error") =>
  compileDocument(raw)
    .findings.filter((finding) => finding.severity === severity)
    .map((finding) => `${finding.code} ${finding.path}`);

describe("graview check judges a declared Todoist project", () => {
  it("passes a project, one section of it, and one label of it", () => {
    expect(codes(doc({ home: project() }))).toEqual([]);
    expect(codes(doc({ home: project({ project: "6Jf8VQXxpwv56VQ7", label: "house", fields: { content: "name" } }) }))).toEqual([]);
    expect(codes(doc({ home: project({ section: "Groceries", fields: { content: "name", completed: "done" } }) }))).toEqual([]);
  });

  it("refuses a mapping to a field that cannot hold it", () => {
    const wrong = (fields: Record<string, unknown>, kindFields: Record<string, unknown> = {}) => codes(doc({ home: project({ fields: { content: "name", completed: "done", ...fields } }) }, kindFields));
    expect(wrong({ due: "notes" })).toEqual(["connection-field-type connections.home.fields.due"]);
    expect(wrong({ deadline: "due" })).toEqual(["connection-field-type connections.home.fields.deadline"]);
    expect(wrong({ labels: "notes" })).toEqual(["connection-field-type connections.home.fields.labels"]);
    expect(wrong({ completed: "notes" })).toEqual(["connection-field-type connections.home.fields.completed"]);
    expect(wrong({ section: "priority" })).toEqual(["connection-field-type connections.home.fields.section"]);
    expect(wrong({ content: "priority" })).toContain("connection-field-type connections.home.fields.content");
    expect(wrong({ priority: "notes" })).toEqual(["connection-field-type connections.home.fields.priority"]);
    expect(wrong({ priority: "priority" }, { priority: { type: "enum", options: ["low", "high"] } })).toEqual(["connection-field-type connections.home.fields.priority"]);
    expect(wrong({ priority: "priority" }, { priority: { type: "enum", options: ["low", "medium", "high", "urgent"] } })).toEqual([]);
    expect(wrong({ description: "name" })).toEqual(["connection-field connections.home.fields.description"]);
    expect(wrong({ description: "nothing" })).toEqual(["connection-field connections.home.fields.description"]);
  });

  it("refuses a parent that is no relation of one to a kind a Todoist connection keeps, and a section kept twice over", () => {
    expect(codes(doc({ home: project({ fields: { content: "name", completed: "done", parent: "notes" } }) }))).toEqual(["connection-relation connections.home.fields.parent"]);
    const raw = doc({ home: project() });
    (raw.kinds.task.edges.parent as { cardinality: string }).cardinality = "many";
    expect(codes(raw)).toEqual(["connection-relation connections.home.fields.parent"]);
    const other = doc({ home: project() });
    (other.kinds as Record<string, unknown>)["list"] = { fields: { name: { type: "string" } } };
    other.kinds.task.edges.parent.to = ["list"];
    expect(codes(other)).toContain("connection-relation-target connections.home.fields.parent");
    expect(codes(doc({ home: project({ section: "Groceries" }) }))).toEqual(["connection-field connections.home.fields.section"]);
  });

  it("refuses a token written into the declaration, and never says it", () => {
    const compiled = compileDocument(doc({ home: project({ description: `use ${TOKEN}` }) }));
    expect(compiled.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} ${finding.path}`)).toEqual(["connection-secret connections.home.description"]);
    expect(JSON.stringify(compiled.findings)).not.toContain(TOKEN);
    expect(codes(doc({ home: project({ token: "x" }) }))).toEqual(["unknown-key connections.home"]);
  });

  it("warns when completed is not mapped, and says the shape in document.schema.json", () => {
    expect(codes(doc({ home: project({ fields: { content: "name" } }) }), "warning")).toContain("connection-completed connections.home.fields");
    const schema = JSON.stringify((documentJsonSchema("0.0.0")["properties"] as Record<string, unknown>)["connections"]);
    expect(schema).toContain('"const":"todoist"');
    for (const part of Object.keys(FIELDS)) expect(schema).toContain(`"${part}"`);
  });

  it("is said on a record's page, opened at the task it came from", () => {
    const connections = { home: project() };
    expect(keptInStepWith(connections, "task", "task:home-6X7rM8997g3RQmvh")).toEqual({ connection: "home", system: "todoist", words: "Todoist", href: "https://app.todoist.com/app/task/6X7rM8997g3RQmvh" });
    expect(keptInStepWith(connections, "task", "task:mine")).toEqual({ connection: "home", system: "todoist", words: "Todoist" });
  });
});

describe("how a Todoist repeat is said", () => {
  it("reads the forms a repeat holds, and says each back the same", () => {
    const pairs: [string, unknown][] = [
      ["every day", { every: "day" }],
      ["every 3 days", { every: "day", interval: 3 }],
      ["every week", { every: "week" }],
      ["every 2 weeks", { every: "week", interval: 2 }],
      ["every mon, wed", { every: "week", on: ["mon", "wed"] }],
      ["every month", { every: "month" }],
      ["every 2, 15", { every: "month", on: [2, 15] }],
      ["every year", { every: "year" }],
    ];
    for (const [words, repeat] of pairs) {
      expect(readRepeat(words)).toEqual(repeat);
      expect(sayRepeat(repeat)).toBe(words);
    }
    expect(readRepeat("Daily")).toEqual({ every: "day" });
    expect(readRepeat("ev weekday at 9am")).toEqual({ every: "week", on: ["mon", "tue", "wed", "thu", "fri"] });
    expect(readRepeat("every day at 12")).toEqual({ every: "day" });
    expect(readRepeat("every other week")).toEqual({ every: "week", interval: 2 });
    expect(readRepeat("every Tuesday at 18:00")).toEqual({ every: "week", on: ["tue"] });
  });

  it("reads nothing it cannot say back", () => {
    for (const words of ["every! 3 days", "every 3 hours", "every last workday", "every 3rd friday", "every day until 3 aug", "every 31", "every other fri", "every 14 jan, 14 apr", "every day for 3 weeks", "after 10 days", ""]) expect(readRepeat(words)).toBeUndefined();
    for (const repeat of [{ every: "day", until: "2026-12-01" }, { every: "week", count: 3 }, { every: "day", except: ["2026-12-01"] }, { every: "week", interval: 2, on: ["tue"] }, { every: "month", on: [31] }, { every: "month", on: [-1] }]) expect(sayRepeat(repeat)).toBeUndefined();
  });
});

/* ------------------------------------------------------------ the runs */

interface Opening {
  readonly declared?: Record<string, unknown>;
  readonly fields?: Record<string, unknown>;
  readonly stub?: ScriptedTodoist;
}

function opened({ declared = project(), fields, stub = scriptedTodoist({ token: TOKEN, timeZone: "America/New_York" }) }: Opening = {}) {
  const compiled = compileDocument(doc({ home: declared }, fields));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const home = stub.project("Home");
  const said: string[] = [];
  let token = TOKEN;
  const run = (state?: SyncState) => connection({ name: "home", declaration: app.connections!["home"]!, app, store, projectId: home, token: () => token, secretName: "TODOIST_TOKEN", fetch: stub.fetch, say: (line) => said.push(line), links: sharedLinks(), ...(state ? { state } : {}) });
  const { engine } = run();
  const nodes = () => store.graph.allNodes().filter((node) => node.kind === "task") as unknown as Record<string, unknown>[];
  const node = (id: string) => store.graph.getNode(id) as unknown as Record<string, unknown>;
  const named = (name: string) => nodes().find((one) => one["name"] === name)!;
  const act = (name: string, args: Record<string, unknown>) => store.apply({ name, args }, { author: { kind: "human", id: "nick" }, intent: "by hand" });
  return { app, store, stub, home, said, engine, run, nodes, node, named, act, setToken: (next: string) => (token = next) };
}

describe("a Todoist project, both ways", () => {
  it("takes every part of a task into a record, credited to Todoist, and its first run sends nothing", async () => {
    const { stub, home, engine, named, store } = opened();
    const groceries = stub.section(home, "Groceries");
    const pat = stub.person("Pat Doe", "pat@example.com", home);
    stub.add(stub.project("Work"), { content: "Other people's" });
    stub.add(home, { content: "Paint", description: "Two coats", due: { date: "2026-11-02T10:00:00.000000" }, deadline: { date: "2026-11-09" }, priority: 4, labels: ["house", "diy"], section_id: groceries, responsible_uid: pat });
    const report = await engine.run();
    expect([report.offline, report.refused, report.pushed, report.queued]).toEqual([false, [], [], []]);
    // A floating time is on the account's wall: 10:00 in New York is 15:00 UTC in November.
    expect(named("Paint")).toMatchObject({ notes: "Two coats", due: "2026-11-02T15:00:00Z", deadline: "2026-11-09", priority: 1, labels: ["diy", "house"], section: "Groceries", assignee: "Pat Doe", done: false });
    expect(store.graph.allNodes()).toHaveLength(1);
    expect(store.log.all().at(-1)!.author).toEqual({ kind: "system", id: "todoist" });
    expect(stub.commands).toEqual([]);
    const again = await engine.run();
    expect([again.applied, again.pushed]).toEqual([[], []]);
    expect(stub.commands).toEqual([]);
  });

  it("makes a task for a record made here, and sends only what an edit changed", async () => {
    const { stub, home, engine, act } = opened();
    stub.section(home, "Groceries");
    stub.person("Pat Doe", "pat@example.com", home);
    act("add-task", { id: "task:milk", name: "Milk", notes: "Whole", due: "2026-11-03T14:30:00Z", deadline: "2026-11-10", priority: 2, labels: ["shop"], section: "groceries", assignee: "pat@example.com", done: false });
    expect((await engine.run()).pushed).toEqual(["task:milk"]);
    const [task] = stub.tasks(home);
    expect(task).toMatchObject({ content: "Milk", description: "Whole", priority: 3, labels: ["shop"], checked: false, deadline: { date: "2026-11-10" } });
    // Floating, as Todoist makes a time unless a zone is named: 9:30 on the account's wall.
    expect((task!["due"] as Record<string, unknown>)["date"]).toBe("2026-11-03T09:30:00");
    expect(stub.sectionOf(task!)).toBe("Groceries");
    await engine.run();

    stub.commands.length = 0;
    act("edit-task", { id: "task:milk", notes: "Skim" });
    await engine.run();
    expect(stub.commands.map(({ type, args }) => ({ type, args }))).toEqual([{ type: "item_update", args: { id: task!["id"], description: "Skim" } }]);

    act("edit-task", { id: "task:milk", due: null, section: null });
    await engine.run();
    expect(stub.task(String(task!["id"]))).toMatchObject({ due: null, section_id: null });
  });

  it("does not take its own write back as news, and sends nothing twice", async () => {
    const { stub, engine, store, act, named } = opened();
    act("add-task", { id: "task:milk", name: "Milk", labels: ["b", "a"] });
    await engine.run();
    const echo = await engine.run();
    expect([echo.echoes, echo.applied, echo.pushed]).toEqual([["task:milk"], [], []]);
    expect(store.log.all().filter((op) => op.author.id === "todoist")).toEqual([]);
    stub.edit(String(stub.tasks()[0]!["id"]), { content: "Milk, twice" });
    expect((await engine.run()).applied).toEqual(["task:milk"]);
    expect(named("Milk, twice")).toBeDefined();
  });

  it("leaves another person's edit to one part alone when a different part is changed here at once", async () => {
    const { stub, engine, act, node } = opened();
    act("add-task", { id: "task:milk", name: "Milk" });
    await engine.run();
    await engine.run();
    const id = String(stub.tasks()[0]!["id"]);
    stub.onWrite(() => void stub.edit(id, { description: "Theirs" }));
    act("edit-task", { id: "task:milk", name: "Oat milk" });
    await engine.run();
    expect(stub.task(id)).toMatchObject({ content: "Oat milk", description: "Theirs" });
    await engine.run();
    expect(node("task:milk")["notes"]).toBe("Theirs");
  });

  it("holds a field both sides changed, and sends and takes neither", async () => {
    const { stub, engine, act, node } = opened();
    act("add-task", { id: "task:milk", name: "Milk" });
    await engine.run();
    const id = String(stub.tasks()[0]!["id"]);
    stub.edit(id, { content: "Theirs" });
    act("edit-task", { id: "task:milk", name: "Ours" });
    const report = await engine.run();
    expect(report.conflicts).toEqual([expect.objectContaining({ localId: "task:milk", field: "name", ours: "Ours", theirs: "Theirs", base: "Milk" })]);
    expect(node("task:milk")["name"]).toBe("Ours");
    expect(stub.task(id)!["content"]).toBe("Theirs");
    engine.resolve(report.conflicts[0]!, "ours");
    await engine.run();
    expect(stub.task(id)!["content"]).toBe("Ours");
  });
});

describe("a task completed", () => {
  it("there sets the field and removes no record, and reopened there clears it", async () => {
    const { stub, home, engine, named, nodes } = opened();
    const task = String(stub.add(home, { content: "Paint" })["id"]);
    await engine.run();
    stub.complete(task);
    const report = await engine.run();
    expect([report.gone, report.refused]).toEqual([[], []]);
    expect(named("Paint")["done"]).toBe(true);
    expect(nodes()).toHaveLength(1);
    stub.reopen(task);
    await engine.run();
    expect(named("Paint")["done"]).toBe(false);
  });

  it("is kept, and completed, by a whole read that no longer lists it", async () => {
    const { stub, home, engine, run, named, nodes } = opened();
    const task = String(stub.add(home, { content: "Paint" })["id"]);
    stub.add(home, { content: "Sweep" });
    await engine.run();
    stub.complete(task);
    const { cursor: _cursor, ...state } = engine.snapshot;
    const report = await run(state).engine.run();
    expect([report.gone, report.pushed]).toEqual([[], []]);
    expect(named("Paint")["done"]).toBe(true);
    expect(nodes()).toHaveLength(2);
  });

  it("is kept even where nothing in Todoist lists it any more, and said once", async () => {
    const { stub, home, engine, run, nodes, said } = opened();
    const task = String(stub.add(home, { content: "Paint" })["id"]);
    await engine.run();
    stub.forget(task);
    const { cursor: _cursor, ...state } = engine.snapshot;
    const report = await run(state).engine.run();
    expect(report.gone).toEqual([]);
    expect(nodes()).toHaveLength(1);
    expect(said.filter((line) => /no longer lists/.test(line))).toHaveLength(1);
  });

  it("here is completed there, and reopened there when reopened here", async () => {
    const { stub, engine, act } = opened();
    act("add-task", { id: "task:milk", name: "Milk" });
    await engine.run();
    const id = String(stub.tasks()[0]!["id"]);
    act("edit-task", { id: "task:milk", done: true });
    await engine.run();
    expect(stub.task(id)!["checked"]).toBe(true);
    expect((await engine.run()).pushed).toEqual([]);
    act("edit-task", { id: "task:milk", done: false, name: "Milk again" });
    await engine.run();
    expect(stub.task(id)).toMatchObject({ checked: false, content: "Milk again" });
  });

  it("here, of a task that repeats, moves it to its next date: the field clears and the date follows", async () => {
    const { stub, home, engine, named, act } = opened({ fields: { due: { type: "date", repeats: true } } });
    stub.add(home, { content: "Water", due: { date: "2026-11-02", string: "every mon", is_recurring: true, lang: "en" } });
    await engine.run();
    act("edit-task", { id: String(named("Water")["id"]), done: true });
    await engine.run();
    await engine.run();
    expect(named("Water")).toMatchObject({ done: false, due: "2026-11-09", dueRepeat: { every: "week", on: ["mon"] } });
    expect(stub.commands.filter((one) => one.type === "item_close")).toHaveLength(1);
    expect((await engine.run()).pushed).toEqual([]);
  });
});

describe("removed and moved", () => {
  it("deletes the task of a record removed here, and removes the record of a task deleted or moved out there", async () => {
    const { stub, home, engine, act, nodes } = opened();
    const deleted = String(stub.add(home, { content: "Deleted there" })["id"]);
    const moved = String(stub.add(home, { content: "Moved" })["id"]);
    act("add-task", { id: "task:mine", name: "Mine" });
    await engine.run();
    const mine = stub.tasks(home).find((task) => task["content"] === "Mine")!;
    act("remove-task", { id: "task:mine" });
    stub.remove(deleted);
    stub.edit(moved, { project_id: stub.project("Work") });
    const report = await engine.run();
    expect(report.gone).toHaveLength(2);
    expect(stub.task(String(mine["id"]))!["is_deleted"]).toBe(true);
    expect(nodes()).toEqual([]);
  });

  it("keeps one section or one label of a project, and a task made here stays in it", async () => {
    const inSection = opened({ declared: project({ section: "Groceries", fields: { content: "name", labels: "labels", completed: "done" } }) });
    const groceries = inSection.stub.section(inSection.home, "Groceries");
    inSection.stub.add(inSection.home, { content: "Outside" });
    inSection.stub.add(inSection.home, { content: "Milk", section_id: groceries });
    inSection.act("add-task", { id: "task:eggs", name: "Eggs" });
    await inSection.engine.run();
    expect(inSection.nodes().map((one) => one["name"]).sort()).toEqual(["Eggs", "Milk"]);
    expect(inSection.stub.tasks().find((one) => one["content"] === "Eggs")).toMatchObject({ section_id: groceries });

    const byLabel = opened({ declared: project({ label: "house", fields: { content: "name", labels: "labels", completed: "done" } }) });
    byLabel.stub.add(byLabel.home, { content: "Outside" });
    byLabel.stub.add(byLabel.home, { content: "Paint", labels: ["house", "diy"] });
    byLabel.act("add-task", { id: "task:sweep", name: "Sweep", labels: ["floor"] });
    await byLabel.engine.run();
    // The connection's own label is not the record's: it is put on every task made here.
    expect(byLabel.named("Paint")["labels"]).toEqual(["diy"]);
    const sweep = () => byLabel.stub.tasks().find((one) => one["content"] === "Sweep")!;
    expect(sweep()["labels"]).toEqual(["floor", "house"]);
    byLabel.act("edit-task", { id: "task:sweep", labels: [] });
    await byLabel.engine.run();
    expect(sweep()["labels"]).toEqual(["house"]);
    expect((await byLabel.engine.run()).gone).toEqual([]);
  });

  it("links a subtask to its parent where both are kept, both ways", async () => {
    const { stub, home, engine, named, act, store } = opened();
    const parent = String(stub.add(home, { content: "Party" })["id"]);
    stub.add(home, { content: "Cake", parent_id: parent });
    await engine.run();
    const party = String(named("Party")["id"]);
    expect(store.graph.out(String(named("Cake")["id"]), "parent").map((one) => one.id)).toEqual([party]);
    act("add-task", { id: "task:music", name: "Music" });
    await engine.run();
    act("connect-task-parent", { id: "task:music", to: party });
    await engine.run();
    const music = String(stub.tasks(home).find((one) => one["content"] === "Music")!["id"]);
    expect(stub.task(music)!["parent_id"]).toBe(parent);
    expect((await engine.run()).pushed).toEqual([]);
    act("disconnect-task-parent", { id: "task:music", to: party });
    await engine.run();
    expect(stub.task(music)!["parent_id"]).toBe(null);
  });
});

describe("a due date that repeats", () => {
  const fields = { due: { type: "datetime", repeats: true } };

  it("is a repeat where it can be said, both ways", async () => {
    const { stub, home, engine, named, act } = opened({ fields });
    stub.add(home, { content: "Practice", due: { date: "2026-11-03T18:00:00.000000", string: "every tue at 18:00", is_recurring: true, lang: "en" } });
    act("add-task", { id: "task:bins", name: "Bins", due: "2026-11-04T07:00" });
    act("edit-task", { id: "task:bins", dueRepeat: { every: "week", interval: 2 } });
    await engine.run();
    expect(named("Practice")).toMatchObject({ due: "2026-11-03T18:00", dueRepeat: { every: "week", on: ["tue"] } });
    const bins = String(stub.tasks(home).find((one) => one["content"] === "Bins")!["id"]);
    expect(stub.task(bins)!["due"]).toMatchObject({ date: "2026-11-04T07:00:00", string: "every 2 weeks at 07:00", is_recurring: true });
    expect((await engine.run()).pushed).toEqual([]);
    act("edit-task", { id: "task:bins", due: "2026-11-05T08:00" });
    await engine.run();
    expect(stub.task(bins)!["due"]).toMatchObject({ date: "2026-11-05T08:00:00", string: "every 2 weeks at 08:00", is_recurring: true });
  });

  it("that cannot be said is left as Todoist has it, and a change to it here is held unsent and said", async () => {
    const { stub, home, engine, named, act, said } = opened({ fields });
    stub.add(home, { content: "Filter", due: { date: "2026-11-03", string: "every! 3 months", is_recurring: true, lang: "en" } });
    await engine.run();
    const id = String(named("Filter")["id"]);
    expect(named("Filter")["dueRepeat"] ?? null).toBe(null);
    expect(said.filter((line) => line.includes("every! 3 months"))).toHaveLength(1);
    act("edit-task", { id, due: "2026-12-03T09:00" });
    const report = await engine.run();
    expect(report.refused).toEqual([expect.objectContaining({ localId: id, error: expect.stringMatching(/held unsent.*every! 3 months/) })]);
    expect(stub.commands).toEqual([]);
    act("edit-task", { id, due: "2026-11-03T00:00" });
    expect((await engine.run()).refused).toEqual([]);

    act("add-task", { id: "task:short", name: "Short", due: "2026-11-04T07:00" });
    act("edit-task", { id: "task:short", dueRepeat: { every: "day", until: "2026-11-30" } });
    const held = await engine.run();
    expect(held.refused).toEqual([expect.objectContaining({ localId: "task:short", error: expect.stringMatching(/held unsent/) })]);
    expect(stub.tasks(home)).toHaveLength(1);
  });

  it("is held unsent when the kind keeps no repeat, and a plain day keeps the time Todoist has", async () => {
    const { stub, home, engine, named, act } = opened({ fields: { due: { type: "date" } } });
    stub.add(home, { content: "Rent", due: { date: "2026-11-01", string: "every month", is_recurring: true, lang: "en" } });
    const call = String(stub.add(home, { content: "Call", due: { date: "2026-11-02T10:00:00.000000" } })["id"]);
    await engine.run();
    act("edit-task", { id: String(named("Rent")["id"]), due: "2026-11-05" });
    act("edit-task", { id: String(named("Call")["id"]), due: "2026-11-06" });
    const report = await engine.run();
    expect(report.refused).toEqual([expect.objectContaining({ error: expect.stringMatching(/held unsent.*every month/) })]);
    expect(stub.task(call)!["due"]).toMatchObject({ date: "2026-11-06T10:00:00" });
  });

  it("in an account of another time zone, a repeating time is not read as this app's", async () => {
    const { stub, home, engine, named } = opened({ fields, stub: scriptedTodoist({ token: TOKEN, timeZone: "Asia/Tokyo" }) });
    stub.add(home, { content: "Standup", due: { date: "2026-11-03T09:00:00.000000", string: "every tue at 9am", is_recurring: true, lang: "en" } });
    await engine.run();
    expect(named("Standup")["dueRepeat"] ?? null).toBe(null);
    expect(named("Standup")["due"]).toBe("2026-11-02T19:00");
  });
});

describe("what is never lost", () => {
  it("takes their edit of a task removed here when theirs stands, and a task that left the label and came back", async () => {
    const { stub, home, engine, named, nodes, act } = opened({ declared: project({ conflicts: "theirs", label: "house" }) });
    const task = String(stub.add(home, { content: "Paint", labels: ["house"] })["id"]);
    await engine.run();
    act("remove-task", { id: String(named("Paint")["id"]) });
    stub.edit(task, { content: "Paint twice" });
    await engine.run();
    expect(stub.task(task)!["is_deleted"]).toBe(false);
    expect(named("Paint twice")).toBeDefined();
    stub.edit(task, { labels: [] });
    await engine.run();
    expect(nodes()).toEqual([]);
    stub.edit(task, { labels: ["house"] });
    expect((await engine.run()).refused).toEqual([]);
    expect(named("Paint twice")).toBeDefined();
  });

  it("makes a task once, and moves one that repeats on once, when every answer is lost", async () => {
    const { stub, home, engine, named, nodes, act } = opened({ fields: { due: { type: "date", repeats: true } } });
    stub.add(home, { content: "Water", due: { date: "2026-11-02", string: "every mon", is_recurring: true, lang: "en" } });
    await engine.run();
    act("add-task", { id: "task:new", name: "New" });
    stub.loseAnswers(3);
    expect((await engine.run()).offline).toBe(true);
    await engine.run();
    await engine.run();
    expect(stub.tasks(home)).toHaveLength(2);
    expect(nodes()).toHaveLength(2);

    act("edit-task", { id: String(named("Water")["id"]), done: true });
    stub.loseAnswers(3);
    for (let pass = 0; pass < 3; pass += 1) await engine.run();
    const settled = await engine.run();
    expect(named("Water")).toMatchObject({ due: "2026-11-09", done: false });
    expect([settled.pushed, (await engine.run()).pushed]).toEqual([[], []]);
  }, 20_000);

  it("keeps what went when a completion after it is refused, and the completion stays owed", async () => {
    const { stub, home, engine, node, act } = opened();
    act("add-task", { id: "task:a", name: "A" });
    act("add-task", { id: "task:b", name: "B", done: true });
    stub.refuseOnce("item_close");
    const report = await engine.run();
    expect(stub.tasks(home)).toHaveLength(2);
    expect(report.refused).toEqual([expect.objectContaining({ localId: "task:b" })]);
    await engine.run();
    expect(stub.tasks(home).map((task) => task["content"])).toEqual(["A"]);
    expect(node("task:b")["done"]).toBe(true);
  });

  it("reads nothing held in conflict as empty: a due date or a place beside it is held unsent or left", async () => {
    const { stub, home, engine, named, act } = opened({ fields: { due: { type: "date", repeats: true } } });
    const task = String(stub.add(home, { content: "Water", due: { date: "2026-11-02", string: "every mon", is_recurring: true, lang: "en" } })["id"]);
    await engine.run();
    const id = String(named("Water")["id"]);
    stub.edit(task, { due: { date: "2026-11-02", string: "every 2 weeks", lang: "en" } });
    act("edit-task", { id, dueRepeat: { every: "day" }, due: "2026-11-03", name: "Water it" });
    const report = await engine.run();
    expect(report.conflicts.map((one) => one.field)).toEqual(["dueRepeat"]);
    expect(report.refused).toEqual([expect.objectContaining({ error: expect.stringMatching(/held unsent/) })]);
    expect(stub.task(task)).toMatchObject({ content: "Water it", due: { date: "2026-11-02", string: "every 2 weeks" } });
  });

  it("leaves a subtask where it is when its parent leaves the connection, and keeps its section when its parent is taken away", async () => {
    const { stub, home, engine, act, named } = opened({ declared: project({ label: "house", fields: { content: "name", labels: "labels", parent: "parent", completed: "done" } }) });
    const shed = stub.section(home, "Shed");
    const parent = String(stub.add(home, { content: "Party", labels: ["house"], section_id: shed })["id"]);
    const child = String(stub.add(home, { content: "Cake", labels: ["house"], parent_id: parent })["id"]);
    await engine.run();
    act("disconnect-task-parent", { id: String(named("Cake")["id"]), to: String(named("Party")["id"]) });
    await engine.run();
    expect(stub.task(child)).toMatchObject({ parent_id: null, section_id: shed });
    act("connect-task-parent", { id: String(named("Cake")["id"]), to: String(named("Party")["id"]) });
    await engine.run();
    stub.edit(parent, { labels: [] });
    await engine.run();
    await engine.run();
    expect(stub.task(child)!["parent_id"]).toBe(parent);
  });

  it("does not delete a task while a change under it is held", async () => {
    const { stub, home, engine, act, named } = opened();
    const parent = String(stub.add(home, { content: "Party" })["id"]);
    const child = String(stub.add(home, { content: "Cake", parent_id: parent, due: { date: "2026-11-03", string: "every! 3 days", lang: "en" } })["id"]);
    await engine.run();
    act("edit-task", { id: String(named("Cake")["id"]), due: "2026-12-03T09:00:00Z", name: "Big cake" });
    act("remove-task", { id: String(named("Party")["id"]) });
    await engine.run();
    expect(stub.task(child)).toMatchObject({ content: "Big cake", is_deleted: false });
    expect(named("Big cake")).toBeDefined();
  });

  it("sends nothing as new, and removes nothing, when the engine's state is lost or another project is declared", async () => {
    const { app, store, stub, home, engine, run, nodes, said } = opened();
    stub.add(home, { content: "Paint" });
    await engine.run();
    const report = await run().engine.run();
    expect([report.pushed, report.refused]).toEqual([[], []]);
    expect(said.filter((line) => /not linked/.test(line))).toHaveLength(1);
    expect(stub.commands).toEqual([]);
    const other = connection({ name: "home", declaration: app.connections!["home"]!, app, store, projectId: stub.project("Work"), token: () => TOKEN, fetch: stub.fetch, state: engine.snapshot });
    const moved = await other.engine.run();
    expect(moved.problem).toMatch(/kept another project/);
    expect(nodes()).toHaveLength(1);
  });

  it("goes on after a request refused whole, and after a task made unheard fails a second time", async () => {
    const { stub, home, engine, nodes, act } = opened();
    act("add-task", { id: "task:new", name: "New" });
    stub.refuseRequests(1);
    expect((await engine.run()).offline).toBe(true);
    stub.add(home, { content: "Theirs" });
    stub.loseAnswers(3);
    await engine.run();
    act("edit-task", { id: "task:new", name: "Newer" });
    stub.refuseRequests(1);
    await engine.run();
    await engine.run();
    await engine.run();
    expect(stub.tasks(home).map((task) => task["content"]).sort()).toEqual(["Newer", "Theirs"]);
    expect(nodes()).toHaveLength(2);
  }, 20_000);

  it("takes up a task made unheard however Todoist came to hold it, after a read that failed", async () => {
    const { stub, home, engine, nodes, act } = opened();
    const groceries = stub.section(home, "Groceries");
    stub.person("Pat Doe", "pat@example.com", home);
    act("add-task", { id: "task:new", name: "New ", done: true, section: "groceries", assignee: "pat@example.com", due: "2026-11-03T14:30:30Z" });
    stub.loseAnswers(3);
    await engine.run();
    stub.failReads(1);
    expect((await engine.run()).offline).toBe(true);
    for (let pass = 0; pass < 3; pass += 1) await engine.run();
    expect(nodes()).toHaveLength(1);
    expect(nodes()[0]).toMatchObject({ done: true, section: "Groceries" });
    expect(stub.tasks(home)).toEqual([]);
    expect(stub.commands.filter((one) => one.type === "item_add")).toHaveLength(1);
    expect(groceries).toBeDefined();
  }, 20_000);

  it("sends a completion whose request never arrived, though the date changed with it, and moves on once after a failed read", async () => {
    const { stub, home, engine, named, act } = opened({ fields: { due: { type: "date", repeats: true } } });
    stub.add(home, { content: "Water", due: { date: "2026-11-02", string: "every day", is_recurring: true, lang: "en" } });
    await engine.run();
    const id = String(named("Water")["id"]);
    act("edit-task", { id, due: "2026-11-05", done: true });
    stub.dropWrites("item_close", 3);
    for (let pass = 0; pass < 4; pass += 1) await engine.run();
    expect(named("Water")).toMatchObject({ due: "2026-11-06", done: false });
    act("edit-task", { id, done: true });
    stub.loseAnswers(3);
    await engine.run();
    stub.failReads(1);
    for (let pass = 0; pass < 4; pass += 1) await engine.run();
    expect(named("Water")).toMatchObject({ due: "2026-11-07", done: false });
  }, 30_000);

  it("completes again what was completed unheard and then reopened there", async () => {
    const { stub, home, engine, named, act } = opened();
    const task = String(stub.add(home, { content: "Paint" })["id"]);
    await engine.run();
    const id = String(named("Paint")["id"]);
    act("edit-task", { id, done: true });
    stub.loseAnswers(3);
    await engine.run();
    await engine.run();
    expect(named("Paint")["done"]).toBe(true);
    stub.reopen(task);
    await engine.run();
    act("edit-task", { id, done: true });
    await engine.run();
    await engine.run();
    expect(named("Paint")["done"]).toBe(true);
    expect(stub.task(task)!["checked"]).toBe(true);
  }, 20_000);

  it("sends nothing on the first run where the kind fills a field in, nor for ever where the clocks skip an hour", async () => {
    const { stub, home, engine, node, act } = opened({ fields: { notes: { type: "text", default: "None yet" }, due: { type: "datetime", repeats: true } } });
    stub.add(home, { content: "Paint" });
    expect((await engine.run()).pushed).toEqual([]);
    expect((await engine.run()).pushed).toEqual([]);
    act("add-task", { id: "task:skip", name: "Skip", due: "2027-03-14T02:30" });
    act("edit-task", { id: "task:skip", dueRepeat: { every: "day" } });
    await engine.run();
    await engine.run();
    expect((await engine.run()).pushed).toEqual([]);
    expect(node("task:skip")).toBeDefined();
  });

  it("refuses two connections that would each send the other's tasks on", () => {
    expect(codes(doc({ home: project(), work: project({ project: "Work" }) }))).toEqual(["connection-kind connections.work.kind"]);
    expect(codes(doc({ home: project({ direction: "read" }), work: project({ project: "Work", direction: "read" }) }))).toEqual([]);
  });
});

describe("a record set aside", () => {
  it("leaves its task as it is, sends nothing for it, says so once, and is the same task's again when brought back", async () => {
    const { stub, home, engine, node, run, act } = opened();
    act("add-task", { id: "task:milk", name: "Milk" });
    await engine.run();
    const id = String(stub.tasks(home)[0]!["id"]);
    act("archive-task", { id: "task:milk" });
    stub.commands.length = 0;
    const first = await engine.run();
    expect(first.said?.filter((line) => /set aside/.test(line))).toHaveLength(1);
    expect((await engine.run()).said ?? []).toEqual([]);
    expect([stub.commands, stub.task(id)!["is_deleted"]]).toEqual([[], false]);
    // What changes there is taken while it is aside, and a restart in between changes nothing.
    stub.edit(id, { description: "Whole" });
    const { engine: again } = run(engine.snapshot);
    expect((await again.run()).said ?? []).toEqual([]);
    expect(node("task:milk")["notes"]).toBe("Whole");
    expect(stub.commands).toEqual([]);
    const { engine: later } = run(again.snapshot);
    act("unarchive-task", { id: "task:milk" });
    await later.run();
    expect(stub.commands).toEqual([]);
    act("edit-task", { id: "task:milk", name: "Oat milk" });
    await later.run();
    expect(stub.task(id)!["content"]).toBe("Oat milk");
    expect(stub.tasks(home)).toHaveLength(1);
    // Only removing it deletes its task, aside or not.
    act("archive-task", { id: "task:milk" });
    await later.run();
    act("remove-task", { id: "task:milk" });
    await later.run();
    expect(stub.task(id)!["is_deleted"]).toBe(true);
  });

  it("holds what changed on both sides while it was aside", async () => {
    const { stub, home, engine, node, act } = opened();
    act("add-task", { id: "task:milk", name: "Milk" });
    await engine.run();
    const id = String(stub.tasks(home)[0]!["id"]);
    act("edit-task", { id: "task:milk", name: "Ours" });
    act("archive-task", { id: "task:milk" });
    stub.edit(id, { content: "Theirs" });
    await engine.run();
    act("unarchive-task", { id: "task:milk" });
    expect((await engine.run()).conflicts).toEqual([expect.objectContaining({ field: "name", ours: "Ours", theirs: "Theirs" })]);
    expect([node("task:milk")["name"], stub.task(id)!["content"]]).toEqual(["Ours", "Theirs"]);
  });

  it("is not deleted with a parent removed here, however far above it the parent is", async () => {
    const { stub, home, engine, run, named, act, said } = opened();
    const party = String(stub.add(home, { content: "Party" })["id"]);
    const food = String(stub.add(home, { content: "Food", parent_id: party })["id"]);
    const cake = String(stub.add(home, { content: "Cake", parent_id: food })["id"]);
    await engine.run();
    const cakes = String(named("Cake")["id"]);
    act("archive-task", { id: cakes });
    await engine.run();
    const { engine: again } = run(engine.snapshot);
    act("remove-task", { id: String(named("Food")["id"]) });
    await again.run();
    await again.run();
    expect([stub.task(food)!["is_deleted"], stub.task(cake)!["is_deleted"]]).toEqual([false, false]);
    expect(said.filter((line) => /set aside is under it/.test(line))).toHaveLength(1);
    act("unarchive-task", { id: cakes });
    for (let pass = 0; pass < 3; pass += 1) await again.run();
    expect([stub.task(food)!["is_deleted"], stub.task(cake)!["is_deleted"]]).toEqual([true, false]);
  });

  it("is not deleted with a parent removed here when it was completed, nor when the parent is the subtask's of a connection that maps none", async () => {
    const { stub, home, engine, run, named, act } = opened({ declared: project({ fields: { content: "name", completed: "done" } }) });
    const party = String(stub.add(home, { content: "Party" })["id"]);
    const cake = String(stub.add(home, { content: "Cake", parent_id: party })["id"]);
    await engine.run();
    stub.complete(cake);
    await engine.run();
    act("archive-task", { id: String(named("Cake")["id"]) });
    await engine.run();
    const { engine: again } = run(engine.snapshot);
    act("remove-task", { id: String(named("Party")["id"]) });
    await again.run();
    expect([stub.task(party)!["is_deleted"], stub.task(cake)!["is_deleted"]]).toEqual([false, false]);
    // Brought back with nothing here to move it out by: the delete waits still.
    act("unarchive-task", { id: `task:home-${cake}` });
    for (let pass = 0; pass < 2; pass += 1) await again.run();
    expect([stub.task(party)!["is_deleted"], stub.task(cake)!["is_deleted"]]).toEqual([false, false]);
  });

  it("brought back and settled, is under its parent like any other", async () => {
    const { stub, home, engine, named, act } = opened({ declared: project({ fields: { content: "name", completed: "done" } }) });
    const party = String(stub.add(home, { content: "Party" })["id"]);
    stub.add(home, { content: "Cake", parent_id: party });
    await engine.run();
    const cakes = String(named("Cake")["id"]);
    act("archive-task", { id: cakes });
    await engine.run();
    act("unarchive-task", { id: cakes });
    await engine.run();
    act("remove-task", { id: String(named("Party")["id"]) });
    await engine.run();
    expect(stub.task(party)!["is_deleted"]).toBe(true);
  });

  it("keeps a parent set aside as its subtasks' parent", async () => {
    const { stub, home, engine, named, act } = opened();
    const party = String(stub.add(home, { content: "Party" })["id"]);
    const cake = String(stub.add(home, { content: "Cake", parent_id: party })["id"]);
    await engine.run();
    act("archive-task", { id: String(named("Party")["id"]) });
    await engine.run();
    act("edit-task", { id: String(named("Cake")["id"]), name: "Big cake" });
    await engine.run();
    expect(stub.task(cake)).toMatchObject({ content: "Big cake", parent_id: party });
    expect(stub.task(party)!["is_deleted"]).toBe(false);
  });

  it("by a merge leaves both tasks, and the one that stays takes the subtasks", async () => {
    const { stub, home, engine, named, act } = opened();
    const one = String(stub.add(home, { content: "Party" })["id"]);
    const two = String(stub.add(home, { content: "Party again" })["id"]);
    const cake = String(stub.add(home, { content: "Cake", parent_id: two })["id"]);
    await engine.run();
    act("merge-task", { id: String(named("Party again")["id"]), into: String(named("Party")["id"]) });
    await engine.run();
    expect([stub.task(one)!["is_deleted"], stub.task(two)!["is_deleted"]]).toEqual([false, false]);
    expect(stub.task(cake)!["parent_id"]).toBe(one);
    expect((await engine.run()).pushed).toEqual([]);
  });
});

describe("a record set aside, and what reaches it", () => {
  /** Two connections of one project: lists by their label, and tasks by theirs, a task's parent being a list. */
  function two() {
    const raw = doc({
      lists: { system: "todoist", project: { env: "P" }, label: "list", kind: "list", fields: { content: "name", completed: "done" }, direction: "both" },
      tasks: { system: "todoist", project: { env: "P" }, label: "task", kind: "task", fields: { content: "name", completed: "done", parent: "parent" }, direction: "both" },
    });
    (raw.kinds as Record<string, unknown>)["list"] = { fields: { name: { type: "string", required: true }, done: { type: "boolean" } } };
    raw.kinds.task.edges.parent.to = ["list"];
    (raw.acts as Record<string, unknown>)["add-list"] = { creates: "list" };
    const compiled = compileDocument(raw);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const app = compiled.app as GraviewApp<AnySchema>;
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
    const stub = scriptedTodoist({ token: TOKEN });
    const home = stub.project("Home");
    const links = sharedLinks();
    const [lists, tasks] = ["lists", "tasks"].map((name) => connection({ name, declaration: app.connections![name]!, app, store, projectId: home, token: () => TOKEN, fetch: stub.fetch, links }).engine);
    const party = String(stub.add(home, { content: "Party", labels: ["list"] })["id"]);
    const cake = String(stub.add(home, { content: "Cake", labels: ["task"], parent_id: party })["id"]);
    const act = (name: string, args: Record<string, unknown>) => store.apply({ name, args }, { author: { kind: "human", id: "nick" }, intent: "by hand" });
    return { lists: lists!, tasks: tasks!, stub, party, cake, act, pass: async () => (await lists!.run(), await tasks!.run()) };
  }

  it("is not deleted with a parent another connection keeps, and a live one is moved out from under it first", async () => {
    const aside = two();
    await aside.pass();
    await aside.pass();
    aside.act("archive-task", { id: `task:tasks-${aside.cake}` });
    await aside.pass();
    aside.act("remove-list", { id: `list:lists-${aside.party}` });
    await aside.pass();
    await aside.pass();
    expect([aside.stub.task(aside.party)!["is_deleted"], aside.stub.task(aside.cake)!["is_deleted"]]).toEqual([false, false]);

    const live = two();
    await live.pass();
    await live.pass();
    live.act("remove-list", { id: `list:lists-${live.party}` });
    await live.pass();
    await live.pass();
    expect(live.stub.task(live.cake)).toMatchObject({ is_deleted: false, parent_id: null });
    expect(live.stub.task(live.party)!["is_deleted"]).toBe(true);
  });

  it("as a parent, takes a subtask moved out of it there with everything else that changed", async () => {
    const { stub, home, engine, named, store, act } = opened();
    const party = String(stub.add(home, { content: "Party" })["id"]);
    const cake = String(stub.add(home, { content: "Cake", parent_id: party })["id"]);
    await engine.run();
    const parties = String(named("Party")["id"]);
    act("archive-task", { id: parties });
    await engine.run();
    stub.edit(cake, { project_id: home, content: "Theirs" });
    expect((await engine.run()).refused).toEqual([]);
    expect(store.graph.out(String(named("Theirs")["id"]), "parent", { archived: "all" })).toEqual([]);
    expect(store.graph.getNode(parties)).toMatchObject({ $archived: true });
    expect((await engine.run()).pushed).toEqual([]);
  });

  it("is the same task's when its answer was lost, and one that repeats moves on once", async () => {
    const made = opened();
    made.act("add-task", { id: "task:m", name: "Milk" });
    made.stub.loseAnswers(3);
    await made.engine.run();
    made.act("archive-task", { id: "task:m" });
    for (let pass = 0; pass < 3; pass += 1) await made.engine.run();
    made.act("unarchive-task", { id: "task:m" });
    for (let pass = 0; pass < 2; pass += 1) await made.engine.run();
    expect([made.stub.tasks(made.home).length, made.nodes().length]).toEqual([1, 1]);

    // One that never arrived is not taken for somebody else's of the same words.
    const never = opened();
    never.act("add-task", { id: "task:m", name: "Milk" });
    never.stub.dropWrites("item_add", 3);
    await never.engine.run();
    never.act("archive-task", { id: "task:m" });
    await never.engine.run();
    never.stub.add(never.home, { content: "Milk", description: "Theirs" });
    await never.engine.run();
    expect(never.nodes().map((one) => one["notes"])).toEqual(["Theirs"]);

    const { stub, home, engine, named, act } = opened({ fields: { due: { type: "date", repeats: true } } });
    stub.add(home, { content: "Water", due: { date: "2026-11-02", string: "every day", is_recurring: true, lang: "en" } });
    await engine.run();
    const id = String(named("Water")["id"]);
    act("edit-task", { id, done: true });
    stub.loseAnswers(3);
    await engine.run();
    act("archive-task", { id });
    for (let pass = 0; pass < 2; pass += 1) await engine.run();
    act("unarchive-task", { id });
    for (let pass = 0; pass < 3; pass += 1) await engine.run();
    expect(named("Water")).toMatchObject({ due: "2026-11-03", done: false });
  }, 20_000);

  it("that leaves the connection's label is judged when brought back, and never releases what waits above it", async () => {
    const { stub, home, engine, nodes, named, act } = opened({ declared: project({ label: "house", fields: { content: "name", labels: "labels", completed: "done" } }) });
    const party = String(stub.add(home, { content: "Party", labels: ["house"] })["id"]);
    const cake = String(stub.add(home, { content: "Cake", labels: ["house"], parent_id: party })["id"]);
    await engine.run();
    const cakes = String(named("Cake")["id"]);
    act("archive-task", { id: cakes });
    await engine.run();
    act("remove-task", { id: String(named("Party")["id"]) });
    stub.edit(cake, { labels: [] });
    await engine.run();
    await engine.run();
    expect([stub.task(party)!["is_deleted"], stub.task(cake)!["is_deleted"]]).toEqual([false, false]);
    act("unarchive-task", { id: cakes });
    expect((await engine.run()).gone).toEqual([cakes]);
    expect(nodes()).toEqual([]);
    await engine.run();
    expect([stub.task(party)!["is_deleted"], stub.task(cake)!["is_deleted"]]).toEqual([false, false]);
    stub.edit(cake, { project_id: home });
    await engine.run();
    expect([stub.task(party)!["is_deleted"], stub.task(cake)!["is_deleted"]]).toEqual([true, false]);
  });

  it("is not completed with a task above it, nor reopened with one under it", async () => {
    const { stub, home, engine, named, act } = opened();
    const party = String(stub.add(home, { content: "Party" })["id"]);
    const cake = String(stub.add(home, { content: "Cake", parent_id: party })["id"]);
    await engine.run();
    const [parties, cakes] = [String(named("Party")["id"]), String(named("Cake")["id"])];
    act("archive-task", { id: cakes });
    act("edit-task", { id: parties, done: true });
    const report = await engine.run();
    expect(report.refused).toEqual([expect.objectContaining({ localId: parties, error: expect.stringMatching(/held unsent.*set aside under it/) })]);
    expect([stub.task(party)!["checked"], stub.task(cake)!["checked"]]).toEqual([false, false]);
    act("unarchive-task", { id: cakes });
    await engine.run();
    expect([stub.task(party)!["checked"], stub.task(cake)!["checked"]]).toEqual([true, true]);
    await engine.run();
    act("archive-task", { id: parties });
    act("edit-task", { id: cakes, done: false });
    expect((await engine.run()).refused).toEqual([expect.objectContaining({ localId: cakes, error: expect.stringMatching(/set aside above it/) })]);
    expect(stub.task(party)!["checked"]).toBe(true);
  });
});

describe("the first run", () => {
  const quiet = project({ sendExisting: undefined });

  it("sends nothing of what was here before it, says how many, and sends what is made or changed after", async () => {
    const { stub, home, engine, run, act } = opened({ declared: quiet });
    act("add-task", { id: "task:a", name: "A" });
    act("add-task", { id: "task:b", name: "B" });
    act("archive-task", { id: "task:b" });
    act("add-task", { id: "task:c", name: "C" });
    const first = await engine.run();
    expect([first.pushed, first.queued, stub.commands]).toEqual([[], [], []]);
    expect(first.said).toEqual([expect.stringMatching(/^3 .*here before.*sendExisting/)]);
    const { engine: again } = run(engine.snapshot);
    const second = await again.run();
    expect([second.pushed, second.said ?? []]).toEqual([[], []]);
    act("unarchive-task", { id: "task:b" });
    act("add-task", { id: "task:new", name: "New" });
    act("edit-task", { id: "task:a", name: "A changed" });
    await again.run();
    expect(stub.tasks(home).map((task) => task["content"]).sort()).toEqual(["A changed", "New"]);
    // A parent sent is no change of the child under it.
    act("connect-task-parent", { id: "task:b", to: "task:c" });
    await again.run();
    expect(stub.tasks(home).map((task) => task["content"]).sort()).toEqual(["A changed", "B", "New"]);
  });

  it("is still the first after a pass that did not reach Todoist, and after the engine's state is lost", async () => {
    const { stub, home, engine, run, act, setToken } = opened({ declared: quiet });
    act("add-task", { id: "task:a", name: "A" });
    setToken("f".repeat(40));
    expect((await engine.run()).offline).toBe(true);
    act("add-task", { id: "task:b", name: "B" });
    setToken(TOKEN);
    await engine.run();
    expect(stub.tasks(home).map((task) => task["content"])).toEqual(["B"]);
    const { engine: lost } = run();
    expect((await lost.run()).pushed).toEqual([]);
    expect(stub.tasks(home)).toHaveLength(1);
  });

  it("holds them still when more is mapped, or one is removed and put back, and holds nothing already owed", async () => {
    const { app, store, stub, home, engine, act } = opened({ declared: quiet });
    act("add-task", { id: "task:a", name: "A" });
    act("add-task", { id: "task:b", name: "B" });
    const opening = (declared: Record<string, unknown>, state: SyncState) => connection({ name: "home", declaration: { ...app.connections!["home"]!, ...declared } as never, app, store, projectId: home, token: () => TOKEN, fetch: stub.fetch, state }).engine;
    const few = opening({ fields: { content: "name", completed: "done" } }, { links: {}, outbox: [] });
    await few.run();
    const more = opening({}, few.snapshot);
    expect((await more.run()).pushed).toEqual([]);
    const removed = act("remove-task", { id: "task:a" });
    await more.run();
    store.undo(removed.batch);
    await more.run();
    expect(stub.tasks(home)).toEqual([]);

    act("remove-task", { id: "task:a" });
    act("remove-task", { id: "task:b" });
    const all = opening({ sendExisting: true }, engine.snapshot);
    await all.run();
    act("add-task", { id: "task:owed", name: "Owed" });
    stub.refuseRequests(1);
    await all.run();
    await opening({ sendExisting: undefined }, all.snapshot).run();
    expect(stub.tasks(home).map((task) => task["content"])).toEqual(["Owed"]);
  });

  it("is the first that may write: a time of only reading is not it, nor one that failed before sending them", async () => {
    const { app, store, stub, home, act } = opened({ declared: quiet });
    const opening = (declared: Record<string, unknown>, state?: SyncState) => connection({ name: "home", declaration: { ...app.connections!["home"]!, ...declared } as never, app, store, projectId: home, token: () => TOKEN, fetch: stub.fetch, ...(state ? { state } : {}) });
    act("add-task", { id: "task:a", name: "A" });
    const read = opening({ direction: "read" });
    await read.engine.run();
    read.unguard?.();
    const both = opening({}, read.engine.snapshot);
    const report = await both.engine.run();
    expect([report.pushed, report.said?.length]).toEqual([[], 1]);

    const eager = opening({ sendExisting: true });
    stub.failReads(1);
    await eager.engine.run();
    await opening({}, eager.engine.snapshot).engine.run();
    expect(stub.tasks(home)).toEqual([]);
  });

  it("sends them where the declaration says sendExisting, then or later", async () => {
    const { app, store, stub, home, engine, act } = opened({ declared: quiet });
    act("add-task", { id: "task:a", name: "A" });
    await engine.run();
    const declaration = { ...app.connections!["home"]!, sendExisting: true } as never;
    const later = connection({ name: "home", declaration, app, store, projectId: home, token: () => TOKEN, fetch: stub.fetch, state: engine.snapshot });
    await later.engine.run();
    expect(stub.tasks(home)).toHaveLength(1);
  });
});

describe("what Todoist refuses, said", () => {
  const remote = (stub: ScriptedTodoist, home: string, waits: number[] = []) => todoist({ projectId: home, refs: { content: "string" }, token: () => TOKEN, fetch: stub.fetch, sleep: async (ms) => void waits.push(ms) });

  it("waits out the rate limit as Retry-After says, and gives up past its bound", async () => {
    const stub = scriptedTodoist({ token: TOKEN });
    const home = stub.project("Home");
    stub.add(home, { content: "One" });
    const waits: number[] = [];
    const system = remote(stub, home, waits);
    stub.limit(2, 3);
    expect((await system.pull(undefined)).changes).toHaveLength(1);
    expect(waits).toEqual([3000, 3000]);
    stub.limit(100, 30);
    await expect(system.pull(undefined)).rejects.toThrow(/still limiting the rate after 60 s/);
  });

  it("sends a write again under the same command ids when its answer was lost, so a task is made once", async () => {
    const stub = scriptedTodoist({ token: TOKEN });
    const home = stub.project("Home");
    const system = remote(stub, home);
    await system.pull(undefined);
    stub.loseAnswers(1);
    const [ack] = await system.push([{ resource: "tasks", localId: "task:a", fields: { content: "Once" } }]);
    expect(ack!.error).toBeUndefined();
    expect(stub.tasks(home)).toHaveLength(1);
    expect(ack!.id).toBe(stub.tasks(home)[0]!["id"]);
  });

  it("asks only for what changed since its sync token, and batches a hundred commands to a request", async () => {
    const { stub, home, engine, act } = opened();
    for (let n = 1; n <= 150; n++) act("add-task", { id: `task:${n}`, name: `Task ${n}` });
    const report = await engine.run();
    expect(report.pushed).toHaveLength(150);
    expect(stub.tasks(home)).toHaveLength(150);
    expect(stub.requests.filter((request) => request.commands > 0).map((request) => request.commands)).toEqual([100, 50]);
    await engine.run();
    const reads = stub.requests.filter((request) => request.resources.includes("items"));
    expect(reads[0]!.token).toBe("*");
    expect(reads.at(-1)!.token).not.toBe("*");
  });

  it("refuses one write and sends the rest, and reads whole again when its sync token is refused", async () => {
    const { stub, home, engine, act, run, nodes } = opened();
    act("add-task", { id: "task:bad", name: "Bad", section: "Nowhere" });
    act("add-task", { id: "task:good", name: "Good" });
    const report = await engine.run();
    expect(report.pushed).toEqual(["task:good"]);
    expect(report.refused).toEqual([expect.objectContaining({ localId: "task:bad", error: expect.stringMatching(/no section Nowhere/) })]);
    stub.forgetTokens();
    stub.add(home, { content: "New" });
    const again = await run(engine.snapshot).engine.run();
    expect([again.offline, again.gone]).toEqual([false, []]);
    expect(nodes().map((one) => one["name"]).sort()).toEqual(["Bad", "Good", "New"]);
  });

  it("says a token it refuses by the name it is kept under, never its value, and a project it cannot see", async () => {
    const { engine, setToken } = opened();
    setToken("fedcba9876543210fedcba9876543210fedcba98");
    const report = await engine.run();
    expect(report.offline).toBe(true);
    expect(report.problem).toMatch(/Todoist refused TODOIST_TOKEN \(HTTP 401\)/);
    expect(report.problem).not.toContain("fedcba");
    const stub = scriptedTodoist({ token: TOKEN });
    await expect(remote(stub, "nope").pull(undefined)).rejects.toThrow(/no project nope/);
  });

  it("keeps the token in no document and no op, nor in what the engine keeps", async () => {
    const { stub, home, engine, store, act, app, said } = opened();
    stub.add(home, { content: "Theirs" });
    act("add-task", { id: "task:mine", name: "Mine" });
    await engine.run();
    const kept = JSON.stringify([app.connections, store.log.all(), store.graph.allNodes(), engine.snapshot, said, stub.requests]);
    expect(kept).not.toContain(TOKEN);
  });

  it("refuses an act here on a connection that only reads", async () => {
    const { stub, home, engine, named, act } = opened({ declared: project({ direction: "read" }) });
    stub.add(home, { content: "Board" });
    await engine.run();
    expect(() => act("edit-task", { id: String(named("Board")["id"]), name: "Bored" })).toThrow(/comes from a Todoist project this app only reads/);
  });
});

describe("a page that draws", () => {
  it("reaches no Todoist transport from the compile's line or the record page's", () => {
    for (const file of ["kept-in-step.ts", "kept-in-step-with.ts"]) expect(readFileSync(new URL(`../../src/document/${file}`, import.meta.url), "utf8")).not.toMatch(/sync\/todoist/);
  });
});
