import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/document/describe-place.js";
import { checkApp } from "../../src/cli/check.js";
import { describeApp } from "../../src/cli/describe.js";
import { declaredLenses, placesOf, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { columnMoves, statusColumns } from "../../src/describe.js";

/**
 * A STATUS BOARD (FR-97): a shipped `columns` lens.
 *
 *   lenses: [{ name: "columns", title: "The board", bindings: { task: { column: "status" } } }]
 *
 * Columns in the field's declared order, each record drawn by its card, and
 * a move to another column offered only where an act the seat may run sets
 * that field — run as the seat, through the store, so it is in the log and
 * can be undone. Here: what core decides, which the picture, `describePlace`
 * and `graview describe` all read.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as GraviewDocument;
const tasks = read("tasks.gdd.json");

function compiled(doc: unknown = tasks): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-06" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}

const OWNER: Principal = { kind: "human", id: "p1", roles: ["owner"] };
const VIEWER: Principal = { kind: "human", id: "p2", roles: ["viewer"] };
const SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
    { id: "t3", kind: "task", label: "Order the chairs", status: "todo" },
    { id: "t4", kind: "task", label: "Send the invitations", status: "done" },
    { id: "p1", kind: "person", label: "Ada" },
    { id: "p2", kind: "person", label: "Grace" },
  ],
  edges: [
    { id: "e1", kind: "assigned-to", from: "t1", to: "p2" },
    { id: "e2", kind: "assigned-to", from: "t2", to: "p2" },
  ],
};
const storeOf = (app: GraviewApp<AnySchema>) => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: SEED as never });

describe("a document declaring a columns lens on a status field", () => {
  it("draws it as a place over the kind, with its bindings as the factory's options", () => {
    const app = compiled();
    const { drawn, undrawn } = declaredLenses(app);
    expect(undrawn).toEqual([]);
    expect(drawn.map((lens) => [lens.lens, lens.title, lens.kinds, lens.options["bindings"]])).toEqual([["columns", "The board", ["task"], { task: { column: "status" } }]]);
    expect(placesOf(app).find((place) => place.lens === "columns")).toMatchObject({ slug: "the-board", address: "/places/the-board", stop: "#view=the-board", first: true });
    expect(checkApp(app).findings.filter((f) => f.code.startsWith("lens-"))).toEqual([]);
    expect(describeApp(app)).toContain('"The board" (the columns over tasks');
    expect(describeApp(app)).toContain('"The board" moves a task to another column by "Set the status", for a seat its policy lets run it; any other seat is offered no move.');
  });

  it("takes its columns in the field's declared order, said as the declaration says the values", () => {
    expect(statusColumns(compiled().schema, "task", "status")).toEqual([
      { value: "todo", label: "Todo" },
      { value: "doing", label: "Doing" },
      { value: "done", label: "Done" },
    ]);
  });

  it("puts a column for records with no value last, only when the field may be left empty", () => {
    const optional = structuredClone(tasks) as GraviewDocument & { kinds: Record<string, { fields: Record<string, Record<string, unknown>> }> };
    optional.kinds["task"]!.fields["status"] = { type: "enum", options: ["todo", "doing", "done"] };
    expect(statusColumns(compiled(optional).schema, "task", "status").map((column) => column.value)).toEqual(["todo", "doing", "done", null]);
    expect(statusColumns(compiled(optional).schema, "task", "status").at(-1)?.label).toBe("No status");
  });

  it("does not draw on a field that is not a choice, and says so at the binding's path", () => {
    const result = compileDocument({ ...tasks, lenses: [{ name: "columns", title: "The board", bindings: { task: { column: "label" } } }] }, { today: () => "2026-10-06" });
    expect(result.findings.filter((f) => f.code.endsWith("lens-cannot-draw")).map((f) => [f.path, f.severity])).toEqual([["lenses.0.bindings.task.column", "warning"]]);
  });
});

describe("a move between columns is an act the seat may run", () => {
  it("is offered by the act that writes the field and takes its value, to every other column", () => {
    const app = compiled();
    const store = storeOf(app);
    const moves = columnMoves(store, OWNER, store.graph.getNode("t1") as never, "status");
    expect(moves.map((move) => [move.to, move.call])).toEqual([
      ["doing", { name: "set-status", args: { id: "t1", status: "doing" } }],
      ["done", { name: "set-status", args: { id: "t1", status: "done" } }],
    ]);
    expect(moves[0]?.title).toBe("Set the status");
  });

  it("is offered to nobody whose policy does not let them run that act", () => {
    const store = storeOf(compiled());
    expect(columnMoves(store, VIEWER, store.graph.getNode("t1") as never, "status")).toEqual([]);
  });

  it("is not offered by an act that writes the field but cannot be told the value", () => {
    const finishing = structuredClone(tasks) as GraviewDocument & { acts: Record<string, unknown> };
    delete finishing.acts["set-status"];
    finishing.acts["finish"] = { title: "Finish", on: "task", sets: { status: "done" } };
    const store = storeOf(compiled(finishing));
    expect(columnMoves(store, OWNER, store.graph.getNode("t1") as never, "status")).toEqual([]);
  });

  it("falls back to the kind's derived edit when no declared act writes the field", () => {
    const hall = compiled(read("every-lens.gdd.json"));
    const store = new Store<AnySchema>({ schema: hall.schema, mutations: hall.mutations ?? [], ...(hall.policy ? { policy: hall.policy } : {}), snapshot: { nodes: [{ id: "s1", kind: "shift", label: "Door", day: "mon" }], edges: [] } as never });
    const keeper = columnMoves(store, { kind: "human", id: "m1", roles: ["keeper"] }, store.graph.getNode("s1") as never, "day");
    expect(keeper.map((move) => move.to)).toEqual(["tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(keeper[0]?.call.name).toBe("edit-shift");
    expect(columnMoves(store, { kind: "human", id: "v1", roles: ["volunteer"] }, store.graph.getNode("s1") as never, "day")).toEqual([]);
  });

  it("runs as the seat, is in the log with its author, and one undo puts the card back", () => {
    const store = storeOf(compiled());
    const [move] = columnMoves(store, OWNER, store.graph.getNode("t1") as never, "status");
    const result = store.apply(move!.call, { author: OWNER });
    expect(store.graph.getNode("t1")?.["status"]).toBe("doing");
    const op = store.log.all().find((one) => one.batch === result.batch);
    expect(op?.author).toMatchObject({ id: "p1" });
    store.undo(result.batch, { author: OWNER });
    expect(store.graph.getNode("t1")?.["status"]).toBe("todo");
  });
});

describe("describePlace says a board as its columns", () => {
  it("in order, each a heading with its count and its records by their cards", () => {
    const app = compiled();
    const said = describePlace(storeOf(app), OWNER, "the-board", { app, width: 1440 });
    if (!said.ok) throw new Error(said.error);
    expect(said.description.drawnBy).toBe("lens:columns");
    const list = said.description.parts.find((part) => part.t === "list");
    expect(list && list.t === "list" ? list.groups.map((group) => [group.heading, group.items.map((item) => item.id)]) : []).toEqual([
      ["Todo (2)", ["t1", "t3"]],
      ["Doing (1)", ["t2"]],
      ["Done (1)", ["t4"]],
    ]);
    expect(said.description.text).toContain("Todo (2):\n  - Write the brief");
  });

  it("with the seat's sight applied to the cards and the counts", () => {
    const app = compiled();
    const said = describePlace(storeOf(app), VIEWER, "the-board", { app, width: 390 });
    if (!said.ok) throw new Error(said.error);
    const list = said.description.parts.find((part) => part.t === "list");
    expect(list && list.t === "list" ? list.groups.map((group) => [group.heading, group.items.map((item) => item.id)]) : []).toEqual([
      ["Todo (1)", ["t1"]],
      ["Doing (1)", ["t2"]],
      ["Done (0)", []],
    ]);
  });
});

describe("a board in the edit ops", () => {
  it("is added with add-lens, its bindings held: a kind, and a field of it that is a choice", () => {
    const { lenses: _none, pages: _first, ...bare } = tasks as GraviewDocument & { lenses?: unknown; pages?: unknown };
    const added = editDocument(bare as GraviewDocument, [{ op: "add-lens", lens: "columns", title: "Where things stand", bindings: { task: { column: "status" } } }]);
    expect(added.ok).toBe(true);
    if (added.ok) expect(declaredLenses(compiled(added.document)).drawn.map((lens) => lens.title)).toEqual(["Where things stand"]);
    for (const [bindings, path] of [
      [undefined, "edits.0.bindings"],
      [{ chore: { column: "status" } }, "edits.0.bindings.chore"],
      [{ task: {} }, "edits.0.bindings.task.column"],
      [{ task: { column: "stage" } }, "edits.0.bindings.task.column"],
      [{ task: { column: "label" } }, "edits.0.bindings.task.column"],
    ] as const) {
      const outcome = editDocument(bare as GraviewDocument, [{ op: "add-lens", lens: "columns", title: "Where things stand", ...(bindings ? { bindings } : {}) }]);
      expect(outcome.ok, JSON.stringify(bindings)).toBe(false);
      if (!outcome.ok) expect(outcome.findings.map((f) => f.path)).toEqual([path]);
    }
  });

  it("refuses the removal of its column field, naming the lens", () => {
    const outcome = editDocument(tasks, [{ op: "remove-field", kind: "task", field: "status" }]);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.findings.map((f) => f.message).join(" ")).toContain('the lens "The board" (lenses.0) draws by its column');
  });

  it("follows a rename of its field and its kind, and goes with its kind", () => {
    const renamed = editDocument(tasks, [
      { op: "rename-field", kind: "task", field: "status", to: "stage" },
      { op: "rename-kind", kind: "task", to: "chore" },
    ]);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.document.lenses?.[0]?.["bindings"]).toEqual({ chore: { column: "stage" } });
    expect(declaredLenses(compiled(renamed.document)).drawn.map((lens) => lens.kinds)).toEqual([["chore"]]);
    const removed = editDocument(tasks, [{ op: "remove-kind", kind: "task" }]);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.document.lenses).toBeUndefined();
  });
});
