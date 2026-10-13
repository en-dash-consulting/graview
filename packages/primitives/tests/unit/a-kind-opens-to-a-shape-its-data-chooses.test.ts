import { createSchema, defineNode, Graph, Store, type Violation } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { gauntletSchema } from "../../../../apps/gauntlet/src/domain/schema.js";
import seed from "../../../../apps/gauntlet/src/data/seed.json";
import { createSeedbedStore } from "../../../../apps/seedbed/src/domain/app.js";
import { createTodoStore } from "../../../../apps/todo/src/domain/app.js";
import { changedSince, dateFacts, dateFilter, kindShape, mainDate, problemsByRule, shapeRecipe, tableColumns, cellOf, tableOrder, BOARD_AT_MOST } from "../../src/kind-shape.js";

/*
 * A KIND OPENS TO A SHAPE ITS DATA CHOOSES.
 *
 * A district with no picture of its own opened to six chips and "+30 more"
 * in a box in an empty field, whatever it held. What it opens to now is
 * read from the kind's declaration and its records: a board by its main
 * choice, a calendar where today's month has something on its main date,
 * and a table of the facts that say something otherwise.
 */

type Rec = { id: string; kind: string } & Record<string, unknown>;
const gauntlet = Graph.from(gauntletSchema, seed as never);
const ofKind = (kind: string) => (seed.nodes as unknown as Rec[]).filter((node) => node.kind === kind);

const task = defineNode("task", {
  fields: z.object({ label: z.string(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), done: z.boolean() }),
  plural: "Tasks",
});
const meeting = defineNode("meeting", { fields: z.object({ label: z.string(), on: z.string() }), plural: "Meetings" });

describe("the shape", () => {
  it("is a board by the kind's main choice: seedbed's plantings by their status", () => {
    const store = createSeedbedStore();
    const plantings = [{ id: "p1", kind: "planting", label: "Beans", status: "growing" }];
    expect(kindShape(store.schema, "planting", plantings, "2026-10-13")).toEqual({ shape: "board", field: "status" });
    expect(shapeRecipe("planting", { shape: "board", field: "status" })).toEqual({ lens: "columns", kind: "planting", column: "status" });
    // With nothing in it there is nothing to stand in columns: the empty table says so and offers the first.
    expect(kindShape(store.schema, "planting", [], "2026-10-13")).toEqual({ shape: "table" });
  });

  it("is a table, not a board, past the most a board's columns can hold", () => {
    const many = Array.from({ length: BOARD_AT_MOST + 1 }, (_, at) => ({ id: `t${at}`, kind: "talk", title: `Talk ${at}`, status: "submitted" }));
    expect(kindShape(gauntletSchema, "talk", many, "2026-09-28").shape).toBe("table");
  });

  it("is a table for a kind with neither: the gauntlet's rooms", () => {
    expect(kindShape(gauntletSchema, "room", ofKind("room"), "2026-09-28")).toEqual({ shape: "table" });
  });

  it("is a calendar on the main date when today's month has something on it — a week when it all falls in this one", () => {
    // The 2026 edition's sessions fall on Sep 28–30: in that week, a week; asked in October, nothing this month.
    expect(kindShape(gauntletSchema, "session", ofKind("session"), "2026-09-28")).toMatchObject({ shape: "calendar", start: "day", range: "week" });
    expect(kindShape(gauntletSchema, "session", ofKind("session"), "2026-10-13")).toEqual({ shape: "table" });
    expect(kindShape(gauntletSchema, "session", ofKind("session"), "2026-09-10")).toMatchObject({ shape: "calendar", range: "month" });
  });

  it("is a calendar of a kind whose few-day records span today's month, though none of them starts in it", () => {
    const schema = createSeedbedStore().schema;
    const short = [
      { id: "r1", kind: "rotation", label: "Brassicas", family: "brassicas", from: "2026-09-29", to: "2026-10-02" },
      { id: "r2", kind: "rotation", label: "Roots", family: "roots", from: "2027-03-01", to: "2027-03-05" },
    ];
    expect(kindShape(schema, "rotation", short, "2026-10-13")).toEqual({ shape: "calendar", start: "from", end: "to", range: "month" });
    expect(kindShape(schema, "rotation", short, "2026-12-13")).toEqual({ shape: "table" });
  });

  it("is a table, not a calendar, of records that each last a season: seedbed's rotations, March to October", () => {
    const schema = createSeedbedStore().schema;
    const seasons = [
      { id: "r1", kind: "rotation", label: "Brassicas", family: "brassicas", from: "2026-03-01", to: "2026-10-31" },
      { id: "r2", kind: "rotation", label: "Roots", family: "roots", from: "2027-03-01", to: "2027-10-31" },
    ];
    expect(kindShape(schema, "rotation", seasons, "2026-10-13")).toEqual({ shape: "table" });
  });

  it("opens a table in the order of its main date, a due date soonest first and any other latest first", () => {
    expect(tableOrder(gauntletSchema, "session")).toEqual({ by: "day", direction: "desc" });
    expect(tableOrder(gauntletSchema, "room")).toBeUndefined();
  });

  it("keeps a table as a list of every record, in the order and grouping it was arranged in", () => {
    expect(shapeRecipe("room", { shape: "table" }, { sort: { by: "seats", direction: "desc" }, group: { by: "building" } })).toEqual({ lens: "blocks", kind: "room", as: "row", group: "building", sort: { by: "seats", direction: "desc" } });
  });
});

describe("the table's columns", () => {
  it("are the kind's glance and the relations most of its records have, said in words — never an id", () => {
    const rooms = ofKind("room");
    const columns = tableColumns(gauntletSchema, "room", rooms, gauntlet as never);
    expect(columns.filter((column) => column.about === "field").map((column) => column.key)).toEqual(expect.arrayContaining(["building", "seats"]));
    expect(columns.length).toBeLessThanOrEqual(5);
    const relation = columns.find((column) => column.about === "edge");
    expect(relation?.label).toMatch(/^[A-Z]/);
    const aula = rooms.find((room) => room.id === "room:aula")!;
    for (const column of columns) {
      const cell = cellOf(gauntletSchema, aula, column, gauntlet as never);
      expect(cell.text).not.toMatch(/^[a-z]+:/);
    }
    expect(cellOf(gauntletSchema, aula, columns.find((column) => column.key === "seats")!, gauntlet as never).text).toBe("420");
  });
});

describe("what is going on", () => {
  it("counts what is overdue and what falls in the next week on a due date, not counting what is done", () => {
    const schema = createSchema([task]);
    expect(mainDate(schema, "task")).toEqual({ field: "due", due: true, done: "done" });
    const tasks = [
      { id: "a", kind: "task", label: "A", due: "2026-10-01", done: false },
      { id: "b", kind: "task", label: "B", due: "2026-10-02", done: true },
      { id: "c", kind: "task", label: "C", due: "2026-10-15", done: false },
      { id: "d", kind: "task", label: "D", done: false },
    ];
    const facts = dateFacts(schema, "task", tasks, "2026-10-13");
    expect(facts).toEqual({ field: "due", due: true, overdue: 1, soon: 1 });
    expect(dateFilter(facts!, "overdue", "2026-10-13")).toEqual([{ key: "due", value: "before:2026-10-13" }]);
    expect(dateFilter(facts!, "soon", "2026-10-13")).toEqual([
      { key: "due", value: "after:2026-10-12" },
      { key: "due", value: "before:2026-10-20" },
    ]);
  });

  it("says nothing of dates where a kind has none, or none near", () => {
    expect(dateFacts(gauntletSchema, "room", ofKind("room"), "2026-09-28")).toBeUndefined();
    expect(mainDate(createSchema([meeting]), "meeting")).toBeUndefined();
  });

  it("groups a kind's problems by the rule that found them, most first, each with the records it names", () => {
    const violation = (invariant: string, ids: string[]): Violation => ({ invariant, label: `Rule ${invariant}`, message: `${invariant} broken`, nodeIds: ids, repairs: [] });
    const groups = problemsByRule([violation("fits", ["w1", "r1"]), violation("fits", ["w2", "r2"]), violation("named", ["r3"]), violation("other", ["w9"])], new Set(["r1", "r2", "r3"]));
    expect(groups.map((group) => [group.label, group.violations.length, group.records])).toEqual([
      ["Rule fits", 2, ["r1", "r2"]],
      ["Rule named", 1, ["r3"]],
    ]);
  });

  it("counts what was added and what changed since a moment, from the log", () => {
    const store = createTodoStore();
    const since = new Date(Date.now() - 1000).toISOString();
    const kindOf = (id: string) => store.graph.getNode(id)?.kind as string | undefined;
    const before = changedSince(store.log.all(), "task", new Date(Date.now() + 60_000).toISOString(), kindOf);
    expect(before).toEqual({ added: 0, changed: 0 });
    const ops = [
      { at: "2026-10-13T10:00:00.000Z", primitives: [{ op: "add-node", node: { id: "x", kind: "task" } }] },
      { at: "2026-10-13T10:01:00.000Z", primitives: [{ op: "patch-node", id: "x" }, { op: "patch-node", id: "y" }] },
      { at: "2026-10-12T10:00:00.000Z", primitives: [{ op: "patch-node", id: "z" }] },
    ];
    const kinds: Record<string, string> = { x: "task", y: "task", z: "task" };
    expect(changedSince(ops, "task", "2026-10-13T00:00:00.000Z", (id) => kinds[id])).toEqual({ added: 1, changed: 1 });
    expect(since).toBeTruthy();
    expect(Store).toBeTruthy();
  });
});
