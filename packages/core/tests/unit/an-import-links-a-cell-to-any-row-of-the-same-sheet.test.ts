import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { importRows, previewImport, type ImportResult } from "../../src/import/index.js";

/**
 * AN IMPORT LINKS A CELL TO ANY ROW OF THE SAME SHEET (FR-200). Graview
 * Cloud, building AI Atlas: a link cell resolved only against records that
 * were there before the call, or a row above it, so a self-relation
 * (`model.succeeds → model`) or two rows naming each other was refused,
 * and people imported twice. Now every row of the call is made before any
 * link cell is read, and a cell names the app's records or this call's
 * rows, by label or by what the call matches by: one batch, one undo, the
 * preview what lands.
 */
const ATLAS = {
  format: "graview-document",
  formatVersion: 1,
  name: "Atlas",
  kinds: {
    model: {
      fields: { name: { type: "string", required: true }, key: { type: "string" } },
      edges: { succeeds: { to: ["model"], description: "the models it succeeds" }, rivals: { to: ["model"], description: "the models it rivals" }, "made-by": { to: ["lab"], description: "the lab that made it" } },
    },
    lab: { fields: { name: { type: "string", required: true } } },
  },
  acts: {
    "add-model": { title: "Add a model", creates: "model" },
    "add-lab": { title: "Add a lab", creates: "lab" },
    succeed: { title: "Succeed", on: "model", connects: "succeeds" },
    rival: { title: "Rival", on: "model", connects: "rivals" },
    make: { title: "Made by", on: "model", connects: "made-by" },
  },
};

const compiled = compileDocument(ATLAS);
if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
const app = compiled.app as GraviewApp<AnySchema>;
const curator = { kind: "human" as const, id: "ada", name: "Ada" };

const storeOf = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    snapshot: { nodes: [{ id: "model:gpt-2", kind: "model", name: "GPT-2" }, { id: "lab:anthropic", kind: "lab", name: "Anthropic" }], edges: [] },
  });

const MAPPING = { Name: "name", Key: "key", Succeeds: "succeeds", Rivals: "rivals", Lab: "made-by" };
const SHEET = [
  ["Name", "Key", "Succeeds", "Rivals", "Lab"],
  ["Claude 3", "c3", "Claude 2", "GPT-4", "Anthropic"],
  ["Claude 2", "c2", "Claude 1", "", "Anthropic"],
  ["Claude 1", "c1", "", "", "Anthropic"],
  ["GPT-4", "g4", "GPT-2", "Claude 3", ""],
];

/** What an outcome says it lands, either way: who, made or not, and the links. */
const landing = (result: ImportResult) => result.rows.map((row) => ({ row: row.row, action: row.action, id: row.id, links: row.links, refused: row.refused }));

const succeeds = (store: Store<AnySchema>, id: string) => store.graph.out(id, "succeeds").map((one) => one.id);

describe("an import that links a cell to any row of the same sheet", () => {
  it("lands a self-relation naming later rows in one call", () => {
    const store = storeOf();
    const result = importRows(store, "model", SHEET, MAPPING, { by: curator });
    expect(result.refused).toBe(0);
    expect(result.made).toBe(4);
    expect(succeeds(store, "model:claude-3")).toEqual(["model:claude-2"]);
    expect(succeeds(store, "model:claude-2")).toEqual(["model:claude-1"]);
    expect(succeeds(store, "model:gpt-4")).toEqual(["model:gpt-2"]);
  });

  it("lands a two-row cycle in one call", () => {
    const store = storeOf();
    importRows(store, "model", SHEET, MAPPING, { by: curator });
    expect(store.graph.out("model:claude-3", "rivals").map((one) => one.id)).toEqual(["model:gpt-4"]);
    expect(store.graph.out("model:gpt-4", "rivals").map((one) => one.id)).toEqual(["model:claude-3"]);
  });

  it("previews exactly what lands", () => {
    const preview = previewImport(storeOf(), "model", SHEET, MAPPING, { by: curator });
    const kept = importRows(storeOf(), "model", SHEET, MAPPING, { by: curator });
    expect(landing(preview)).toEqual(landing(kept));
    expect(preview.linked).toBe(kept.linked);
    expect(preview.rows[0]!.sentence).toBe("Row 2 would make Claude 3, linked to Claude 2, GPT-4 and Anthropic.");
  });

  it("is one batch, and one undo takes the rows and their links back together", () => {
    const store = storeOf();
    const result = importRows(store, "model", SHEET, MAPPING, { by: curator });
    expect(new Set(result.ops!.map((op) => op.batch))).toEqual(new Set([result.batch]));
    store.undo(result.batch!);
    expect(store.graph.nodesOfKind("model").map((one) => (one as { id: string }).id)).toEqual(["model:gpt-2"]);
    expect(store.graph.edgesOfKind("succeeds")).toHaveLength(0);
    expect(store.graph.edgesOfKind("rivals")).toHaveLength(0);
    expect(store.graph.edgesOfKind("made-by")).toHaveLength(0);
  });

  it("names a later row by what the call matches by", () => {
    const store = storeOf();
    const result = importRows(store, "model", [["Name", "Key", "Succeeds"], ["Claude 3", "c3", "c2"], ["Claude 2", "c2", ""]], { Name: "name", Key: "key", Succeeds: "succeeds" }, { by: curator, match: { column: "Key", field: "key" } });
    expect(result.refused).toBe(0);
    expect(succeeds(store, "model:claude-3")).toEqual(["model:claude-2"]);
  });

  it("refuses a link no record and no row answers to, naming the column", () => {
    const result = previewImport(storeOf(), "model", [["Name", "Succeeds"], ["Claude 3", "Claude 9"]], { Name: "name", Succeeds: "succeeds" }, { by: curator });
    expect(result.rows[0]!.refused).toEqual(["no model is called “Claude 9” under Succeeds"]);
  });

  it("refuses a row that names a later row which is itself refused, and says so", () => {
    const result = previewImport(storeOf(), "model", [["Name", "Succeeds"], ["Claude 3", "Claude 2"], ["Claude 2", "Claude 9"]], { Name: "name", Succeeds: "succeeds" }, { by: curator });
    expect(result.rows.map((row) => row.action)).toEqual(["refuse", "refuse"]);
    expect(result.rows[1]!.refused).toEqual(["no model is called “Claude 9” under Succeeds"]);
    expect(result.rows[0]!.refused).toEqual(["row 3, which Succeeds names as “Claude 2”, is refused"]);
  });

  it("says a name two rows of the sheet answer to rather than guessing", () => {
    const result = previewImport(storeOf(), "model", [["Name", "Succeeds"], ["Claude 3", "Claude 2"], ["Claude 2", ""], ["Claude 2", ""]], { Name: "name", Succeeds: "succeeds" }, { by: curator });
    expect(result.rows[0]!.refused).toEqual(["“Claude 2” under Succeeds could be any of the 2 rows of this sheet so called"]);
  });
});
