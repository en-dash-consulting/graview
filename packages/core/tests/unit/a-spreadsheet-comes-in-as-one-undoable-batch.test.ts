import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { capabilities, PermissionDeniedError, Store, type AnySchema, type GraviewApp, type Policy } from "../../src/index.js";
import {
  ImportMappingError,
  importRows,
  parseCsv,
  previewImport,
  proposeMapping,
  readBoolean,
  readDateTime,
  readDay,
  readNumber,
  type ImportMapping,
} from "../../src/import/index.js";

/**
 * A SPREADSHEET COMES IN AS ONE UNDOABLE BATCH (FR-177). Nothing in core or
 * ship took rows: a sheet of vendors became an app only by a chat calling
 * act_batch fifty records at a time and retyping each. `importRows` takes
 * the rows and a mapping from columns to fields and relations, reads each
 * cell by its field's type, links a cell that names an event by its name,
 * says per row what it made or refused and why, and keeps what fits as
 * one batch an undo takes back whole.
 */
const WEDDING = {
  format: "graview-document",
  formatVersion: 1,
  name: "Wedding",
  kinds: {
    vendor: {
      fields: {
        name: { type: "string", required: true },
        category: { type: "enum", options: ["florist", "catering", "music", "photography", "venue", "rentals", "transport", "attire", "beauty", "stationery", "bakery", "planning"] },
        phone: { type: "string" },
        email: { type: "email" },
        website: { type: "url" },
        quote: { type: "number", format: "money" },
        depositPaid: { type: "boolean", label: "Deposit paid" },
        bookedOn: { type: "date" },
        rating: { type: "integer", min: 1, max: 5 },
        notes: { type: "text" },
      },
      edges: { serves: { to: ["event"], description: "the events it serves", inverse: "vendors" } },
    },
    event: { fields: { name: { type: "string", required: true } } },
  },
  acts: {
    "add-vendor": { title: "Add a vendor", creates: "vendor" },
    "add-event": { title: "Add an event", creates: "event" },
    book: { title: "Book for an event", on: "vendor", connects: "serves" },
  },
  brand: { currency: "USD" },
};

const compiled = compileDocument(WEDDING);
if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
const app = compiled.app as GraviewApp<AnySchema>;

const EVENTS = ["Smith wedding", "Smith reunion", "Garcia rehearsal dinner", "Lee anniversary party"];
const planner = { kind: "human" as const, id: "maya", name: "Maya", roles: ["planner"] };

function storeOf(options: { policy?: Policy } = {}) {
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    snapshot: { nodes: EVENTS.map((name, at) => ({ id: `event:${at}`, kind: "event", name })), edges: [] },
    ...(options.policy ? { policy: options.policy } : {}),
  });
}

const SHEET = parseCsv(readFileSync(new URL("../fixtures/import/vendors.csv", import.meta.url), "utf8"));
const MAPPING: ImportMapping = {
  "Vendor name": "name",
  Category: "category",
  Phone: "phone",
  Email: "email",
  Website: "website",
  Quote: "quote",
  "Deposit paid": "depositPaid",
  "Booked on": "bookedOn",
  Rating: "rating",
  Event: "serves",
  Notes: "notes",
};

describe("a spreadsheet comes in", () => {
  it("is read from a CSV a sheet saved: quotes, CRLF, and the blank row kept so every row keeps its number", () => {
    expect(SHEET.length).toBe(58);
    expect(SHEET[1]![0]).toBe("Bloom & Co");
    expect(SHEET[1]![10]).toBe("Prefers email, not calls");
    expect(SHEET[56]!.every((cell) => cell === "")).toBe(true);
  });

  it("is offered a mapping from its header row: fields by their words, the event column as the relation to an event", () => {
    const proposed = proposeMapping(app, "vendor", SHEET[0]!);
    expect(proposed.mapping).toEqual({
      "Vendor name": { field: "name" },
      Category: { field: "category" },
      Phone: { field: "phone" },
      Email: { field: "email" },
      Website: { field: "website" },
      Quote: { field: "quote" },
      "Deposit paid": { field: "depositPaid" },
      "Booked on": { field: "bookedOn" },
      Rating: { field: "rating" },
      Event: { relation: "serves" },
      Notes: { field: "notes" },
    });
    expect(proposed.unmatched).toEqual([]);
    expect(proposed.missing).toEqual([]);
    expect(proposed.columns.find((column) => column.column === "Event")!.said).toBe("the relation “the events it serves”");
  });

  it("says what is missing when no column fills a required field, and what nothing answers to", () => {
    const proposed = proposeMapping(app.schema, "vendor", ["Company", "Phone #", "Fax", "Events"]);
    expect(proposed.missing).toEqual(["Name"]);
    expect(proposed.unmatched).toEqual(["Company", "Fax"]);
    expect(proposed.mapping).toEqual({ "Phone #": { field: "phone" }, Events: { relation: "serves" } });
  });

  it("is previewed row by row — made, linked, refused and why — and the preview keeps nothing", () => {
    const store = storeOf();
    const before = store.log.length;
    const preview = previewImport(store, "vendor", SHEET, MAPPING, { by: planner });
    expect(preview.kept).toBe(false);
    expect(store.log.length).toBe(before);
    expect(store.graph.nodesOfKind("vendor")).toHaveLength(0);
    expect(preview.made).toBe(52);
    expect(preview.refused).toBe(4);
    expect(preview.sentence).toBe(`56 rows: 52 vendors would be made, with ${preview.linked} links; 4 rows would be refused.`);

    const row = (n: number) => preview.rows.find((one) => one.row === n)!;
    expect(row(2).sentence).toBe("Row 2 would make Bloom & Co, linked to Smith wedding.");
    expect(row(4).sentence).toBe("Row 4 would make The Rolling Bakery, linked to Smith wedding and Garcia rehearsal dinner.");
    expect(row(54).sentence).toBe("Row 54 would be refused: “Juggling” under Category is none of its 12 choices.");
    expect(row(55).refused).toEqual(["it has no Name, which every vendor needs"]);
    expect(row(56).refused).toEqual([
      "“about a thousand” under Quote is not a number",
      "“soon” under Booked on is not a date",
      expect.stringMatching(/^“9” under Rating does not fit: /),
      "no event is called “Johnson gala” under Event",
    ]);
    expect(row(58).refused).toEqual([
      "“maybe” under Deposit paid is not a yes or a no",
      "“Feb 30, 2026” under Booked on is not a date",
      "“Smith” under Event could be Smith reunion or Smith wedding",
    ]);
    // The blank row is passed over, and keeps its number to itself.
    expect(preview.rows.some((one) => one.row === 57)).toBe(false);
  });

  it("reads each cell by its field's type: money, a date three ways, a choice in any case, a yes, an address", () => {
    const preview = previewImport(storeOf(), "vendor", SHEET, MAPPING, { by: planner });
    const fields = (n: number) => preview.rows.find((one) => one.row === n)!.fields!;
    expect(fields(2)).toMatchObject({ name: "Bloom & Co", category: "florist", quote: 28297, depositPaid: true, bookedOn: "2026-01-01", rating: 1, website: "https://bloomandco.example.com" });
    expect(fields(3)).toMatchObject({ category: "catering", quote: 8500.5, depositPaid: false, bookedOn: "2026-02-08" });
    expect(fields(4)).toMatchObject({ category: "music", depositPaid: true, bookedOn: "2026-03-15" });
    expect(fields(5)).not.toHaveProperty("depositPaid");
    expect(fields(7)).toMatchObject({ depositPaid: true });
  });

  it("lands as one batch, attributed to the importer, via import — and one undo takes it all back", () => {
    const store = storeOf();
    const result = importRows(store, "vendor", SHEET, MAPPING, { by: planner });
    expect(result.kept).toBe(true);
    expect(result.sentence).toBe(`56 rows: 52 vendors made, with ${result.linked} links; 4 rows were refused.`);
    expect(store.graph.nodesOfKind("vendor")).toHaveLength(52);
    expect(new Set(result.ops!.map((op) => op.batch))).toEqual(new Set([result.batch]));
    expect(result.ops!.every((op) => op.author.id === "maya" && op.via === "import")).toBe(true);
    expect(result.ops![0]!.intent).toBe("Add a vendor: Bloom & Co");
    expect(result.ops![0]!.batchIntent).toBe("Import 52 vendors");
    const rolling = result.rows.find((row) => row.row === 4)!;
    expect(store.graph.out(rolling.id!, "serves").map((event) => event.name).sort()).toEqual(["Garcia rehearsal dinner", "Smith wedding"]);

    expect(store.canUndo(result.batch!).ok).toBe(true);
    store.undo(result.batch!);
    expect(store.graph.nodesOfKind("vendor")).toHaveLength(0);
    expect(store.graph.edgesOfKind("serves")).toHaveLength(0);
  });

  it("names a second record of the same name apart, as an act would", () => {
    const store = storeOf();
    importRows(store, "vendor", [["Vendor name"], ["Bloom & Co"]], { "Vendor name": "name" }, { by: planner });
    const again = importRows(store, "vendor", [["Vendor name"], ["Bloom & Co"]], { "Vendor name": "name" }, { by: planner });
    expect(again.rows[0]!.id).toBe("vendor:bloom-co-2");
  });

  it("takes records keyed by header too, with numbers, yeses and dates as a spreadsheet library hands them", () => {
    const store = storeOf();
    const result = importRows(
      store,
      "vendor",
      [{ Name: "Sweet Tooth Cakes", Quote: 1200, Paid: true, Booked: new Date(Date.UTC(2026, 8, 10)), Events: "Lee anniversary" }],
      { Name: "name", Quote: "quote", Paid: "depositPaid", Booked: "bookedOn", Events: "serves" },
      { by: planner },
    );
    expect(result.rows[0]!.sentence).toBe("Row 2 made Sweet Tooth Cakes, linked to Lee anniversary party.");
    expect(store.graph.getNode(result.rows[0]!.id!)).toMatchObject({ quote: 1200, depositPaid: true, bookedOn: "2026-09-10" });
  });

  it("is refused, row by row and in the policy's words, to an importer the policy does not let add a vendor", () => {
    const policy: Policy = { grants: [{ roles: ["planner"], mutations: "*" }] };
    const store = storeOf({ policy });
    const guest = { kind: "human" as const, id: "sam", roles: ["guest"] };
    const result = importRows(store, "vendor", SHEET, MAPPING, { by: guest });
    expect(result.kept).toBe(false);
    expect(result.made).toBe(0);
    expect(result.refused).toBe(56);
    expect(result.rows[0]!.sentence).toBe("Row 2 was refused: Not permitted: “Add a vendor” — a planner can.");
    expect(store.graph.nodesOfKind("vendor")).toHaveLength(0);
    // The planner may: the same sheet lands.
    expect(importRows(store, "vendor", SHEET, MAPPING, { by: planner }).made).toBe(52);
  });

  it("holds an agent to what it was declared able to do", () => {
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: (app.mutations ?? []) as never,
      snapshot: { nodes: [], edges: [] },
      intelligence: [{ name: "helper", may: ["add-event"] }] as never,
    });
    const result = importRows(store, "vendor", [["Vendor name"], ["Bloom & Co"]], { "Vendor name": "name" }, { by: { kind: "agent", id: "helper" } });
    expect(result.kept).toBe(false);
    expect(result.rows[0]!.refused[0]).toMatch(/helper may not/);
  });

  it("links only what the importer may see: an event kept from them is one no row can name", () => {
    const policy: Policy = {
      grants: [{ roles: ["planner", "helper"], mutations: "*" }],
      sees: [
        { roles: ["planner", "helper"], kinds: ["vendor"] },
        { roles: ["planner"], kinds: ["event"] },
      ],
    };
    const store = storeOf({ policy });
    const helper = { kind: "human" as const, id: "jo", roles: ["helper"] };
    const result = importRows(store, "vendor", [["Vendor name", "Event"], ["Bloom & Co", "Smith wedding"]], { "Vendor name": "name", Event: "serves" }, { by: helper });
    expect(result.rows[0]!.refused).toEqual(["no event is called “Smith wedding” under Event"]);
  });

  it("asks the host's admit with the import as planned, and keeps nothing it refuses", () => {
    const store = storeOf();
    let asked: number | undefined;
    expect(() =>
      importRows(store, "vendor", SHEET, MAPPING, {
        by: planner,
        admit: (planned) => {
          asked = planned.added.nodes;
          throw new PermissionDeniedError({ mutation: "import", message: "This workspace holds 40 records at most.", wouldNeed: [] });
        },
      }),
    ).toThrow(/40 records/);
    expect(asked).toBe(52);
    expect(store.graph.nodesOfKind("vendor")).toHaveLength(0);
  });

  it("refuses a mapping that names what the kind has not got, before any row is read", () => {
    expect(() => importRows(storeOf(), "vendor", SHEET, { "Vendor name": { field: "title" } }, { by: planner })).toThrow(ImportMappingError);
    expect(() => importRows(storeOf(), "vendor", SHEET, { Budget: "quote" }, { by: planner })).toThrow("No column is called Budget.");
  });

  it("is a seam a host can detect", () => {
    expect(capabilities().shipped).toContain("FR-177");
  });
});

describe("a cell read by its type", () => {
  it("reads a number with its currency, its unit, its thousands and its sign", () => {
    expect(readNumber("$1,200.50")).toBe(1200.5);
    expect(readNumber("USD 40")).toBe(40);
    expect(readNumber("12 kg")).toBe(12);
    expect(readNumber("(1,200)")).toBe(-1200);
    expect(readNumber("-$40")).toBe(-40);
    expect(readNumber("15%")).toBe(0.15);
    expect(readNumber("€3.5")).toBe(3.5);
    expect(readNumber("1,2,3")).toBeUndefined();
    expect(readNumber("3 - 5")).toBeUndefined();
    expect(readNumber("lots")).toBeUndefined();
  });

  it("reads a day as ISO, as the US writes it, in words, or as a sheet's serial number", () => {
    expect(readDay("2023-09-10")).toBe("2023-09-10");
    expect(readDay("9/10/2023")).toBe("2023-09-10");
    expect(readDay("9/10/2023", { dayFirst: true })).toBe("2023-10-09");
    expect(readDay("9/10/23")).toBe("2023-09-10");
    expect(readDay("Sep 10, 2023")).toBe("2023-09-10");
    expect(readDay("September 10th, 2023")).toBe("2023-09-10");
    expect(readDay("10 Sept. 2023")).toBe("2023-09-10");
    expect(readDay(45179)).toBe("2023-09-10");
    expect(readDay("2/30/2024")).toBeUndefined();
    expect(readDay("next week")).toBeUndefined();
  });

  it("reads a day and a time", () => {
    expect(readDateTime("2023-09-10 14:30")).toBe("2023-09-10T14:30");
    expect(readDateTime("9/10/2023 2:30 PM")).toBe("2023-09-10T14:30");
    expect(readDateTime("Sep 10, 2023 12am")).toBe("2023-09-10T00:00");
    expect(readDateTime("2023-09-10")).toBe("2023-09-10T00:00");
    expect(readDateTime("2023-09-10T14:30:00Z")).toBe("2023-09-10T14:30:00Z");
  });

  it("reads a yes or a no however a sheet ticks it", () => {
    for (const yes of ["yes", "Y", "TRUE", "x", "✓", "1"]) expect(readBoolean(yes)).toBe(true);
    for (const no of ["no", "False", "0", "✗"]) expect(readBoolean(no)).toBe(false);
    expect(readBoolean("maybe")).toBeUndefined();
  });
});

describe("a CSV", () => {
  it("keeps a quoted delimiter, a quoted line break and a doubled quote, and drops the byte-order mark", () => {
    expect(parseCsv('﻿name,notes\r\n"Bloom, & Co","two\nlines, ""quoted"""\r\n')).toEqual([
      ["name", "notes"],
      ["Bloom, & Co", 'two\nlines, "quoted"'],
    ]);
  });

  it("reads a paste from a sheet by its tabs, and a semicolon sheet by its semicolons", () => {
    expect(parseCsv("a\tb\n1,5\t2")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
