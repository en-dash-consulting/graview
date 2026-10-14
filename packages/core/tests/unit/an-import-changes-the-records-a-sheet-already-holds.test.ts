import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp, type Policy } from "../../src/index.js";
import { ImportMappingError, importRows, previewImport, proposeMapping, type ImportMapping } from "../../src/import/index.js";

/*
 * AN IMPORT CHANGES THE RECORDS A SHEET ALREADY HOLDS (FR-177). Importing
 * the vendors sheet a second time — corrected, a quote raised, an email
 * fixed — made every vendor twice, numbered `-2`. With `match`, a row finds
 * the record it already is, by its name or by one column against one
 * field, among the live records the importer sees, and changes only the
 * fields the row has through the kind's edit act, so the policy answers as
 * a press on "Change" would; it links what it names that the record lacks,
 * says per row "would make", "would change (Quote: 1000 → 1200)" or "would
 * leave as is", and the whole of it is still one batch and one undo.
 */
const WEDDING = {
  format: "graview-document",
  formatVersion: 1,
  name: "Wedding",
  kinds: {
    vendor: {
      fields: {
        name: { type: "string", required: true },
        email: { type: "email" },
        quote: { type: "number" },
        rating: { type: "integer", min: 1, max: 5 },
      },
      edges: { serves: { to: ["event"], description: "the events it serves", inverse: "vendors" } },
    },
    event: { fields: { name: { type: "string", required: true } } },
  },
  acts: {
    "add-vendor": { title: "Add a vendor", creates: "vendor" },
    "add-event": { title: "Add an event", creates: "event" },
    book: { title: "Book for an event", on: "vendor", connects: "serves" },
    rate: { title: "Rate", on: "vendor", writes: ["rating"] },
  },
};
const compiled = compileDocument(WEDDING);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const maya = { kind: "human" as const, id: "maya", name: "Maya", roles: ["planner"] };

function storeOf(policy?: Policy) {
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    ...(policy ? { policy } : {}),
    snapshot: {
      nodes: [
        { id: "vendor:bloom", kind: "vendor", name: "Bloom & Co", email: "hello@bloom.example", quote: 1000, rating: 4 },
        { id: "vendor:petal", kind: "vendor", name: "Petal Press", quote: 300 },
        { id: "vendor:twin-1", kind: "vendor", name: "Twin Bakery" },
        { id: "vendor:twin-2", kind: "vendor", name: "Twin Bakery" },
        { id: "vendor:old", kind: "vendor", name: "Old Florist", $archived: true },
        { id: "event:smith", kind: "event", name: "Smith wedding" },
        { id: "event:garcia", kind: "event", name: "Garcia dinner" },
      ] as never,
      edges: [{ kind: "serves", from: "vendor:petal", to: "event:smith" }],
    },
  });
}
const MAPPING: ImportMapping = { Name: "name", Email: "email", Quote: "quote", Rating: "rating", Event: "serves" };
const sheet = (...rows: (string | number)[][]) => [["Name", "Email", "Quote", "Rating", "Event"], ...rows];
const vendors = (store: Store<AnySchema>) => store.graph.nodesOfKind("vendor" as never, { archived: "all" }).length;

describe("an import that matches rows to records", () => {
  it("is not what an import does unless asked: without match, a second import makes each record twice", () => {
    const store = storeOf();
    const done = importRows(store, "vendor", sheet(["Bloom & Co", "", 1200, "", ""]), MAPPING, { by: maya });
    expect(done.made).toBe(1);
    expect(done.rows[0]!.id).toBe("vendor:bloom-co");
    expect(store.graph.getNode("vendor:bloom")).toMatchObject({ quote: 1000 });
  });

  it("by name: changes what a row changes, leaves what it does not, makes what it does not find — said per row before anything is kept", () => {
    const store = storeOf();
    const rows = sheet(["Bloom & Co", "", 1200, "", ""], ["petal press", "", 300, "", "Smith wedding"], ["New Florist", "", 500, "", ""]);
    const preview = previewImport(store, "vendor", rows, MAPPING, { by: maya, match: "label" });
    expect(preview.rows.map((row) => row.sentence)).toEqual([
      "Row 2 would change Bloom & Co (Quote: 1000 → 1200).",
      "Row 3 would leave Petal Press as is.",
      "Row 4 would make New Florist.",
    ]);
    expect(preview.rows.map((row) => row.action)).toEqual(["change", "leave", "make"]);
    expect(preview.rows[0]!.changes).toEqual([{ field: "quote", from: 1000, to: 1200 }]);
    expect(preview.sentence).toBe("3 rows: 1 vendor would be made, 1 would be changed, 1 would be left as is.");
    expect(store.log.length).toBe(0);
  });

  it("keeps it as one batch, through the edit act, and one undo takes all of it back", () => {
    const store = storeOf();
    const before = vendors(store);
    const done = importRows(store, "vendor", sheet(["Bloom & Co", "", 1200, "", "Garcia dinner"], ["New Florist", "", 500, "", ""]), MAPPING, { by: maya, match: "label" });
    expect(done).toMatchObject({ kept: true, made: 1, changed: 1, unchanged: 0, linked: 1 });
    expect(done.rows[0]!.sentence).toBe("Row 2 changed Bloom & Co (Quote: 1000 → 1200), and links it to Garcia dinner.");
    expect(new Set(done.ops!.map((op) => op.batch))).toEqual(new Set([done.batch]));
    // The change is the edit act's own, said in its words; the batch says the whole import.
    const edit = done.ops!.find((op) => op.mutation?.name === "edit-vendor")!;
    expect(edit.mutation!.args).toEqual({ id: "vendor:bloom", quote: 1200 });
    expect(edit.batchIntent).toBe("Import 1 vendor and change 1");
    expect(store.graph.getNode("vendor:bloom")).toMatchObject({ quote: 1200, email: "hello@bloom.example", rating: 4 });
    expect(store.graph.out("vendor:bloom", "serves").map((node) => node.id)).toEqual(["event:garcia"]);
    expect(vendors(store)).toBe(before + 1);

    store.undo(done.batch!);
    expect(store.graph.getNode("vendor:bloom")).toMatchObject({ quote: 1000 });
    expect(store.graph.out("vendor:bloom", "serves")).toEqual([]);
    expect(vendors(store)).toBe(before);
  });

  it("by a column against a field: a record renamed in the sheet is found by its email, and its name is the change", () => {
    const store = storeOf();
    const preview = previewImport(store, "vendor", sheet(["Bloom and Company", "HELLO@bloom.example", "", "", ""]), MAPPING, { by: maya, match: { column: "Email", field: "email" } });
    expect(preview.rows[0]!.sentence).toBe("Row 2 would change Bloom & Co (Name: Bloom & Co → Bloom and Company).");
    expect(() => previewImport(store, "vendor", sheet(), MAPPING, { by: maya, match: { column: "E-mail", field: "email" } })).toThrow(ImportMappingError);
  });

  it("says, and does not guess, when two records answer, when the one that answers is archived, or a row above makes it", () => {
    const store = storeOf();
    const preview = previewImport(store, "vendor", sheet(["Twin Bakery", "", 80, "", ""], ["Old Florist", "", 90, "", ""], ["Fresh Start", "", 1, "", ""], ["Fresh Start", "", 2, "", ""]), MAPPING, { by: maya, match: "label" });
    expect(preview.rows.map((row) => row.refused.join("; "))).toEqual([
      "2 vendors answer to “Twin Bakery”, and a row changes one",
      "Old Florist is archived; bring it back first, and the row will change it",
      "",
      "a row above already makes Fresh Start",
    ]);
  });

  it("refuses a change the edit act does not make: a field an act of its own writes", () => {
    const preview = previewImport(storeOf(), "vendor", sheet(["Bloom & Co", "", "", 2, ""], ["Petal Press", "", "", "", ""]), MAPPING, { by: maya, match: "label" });
    expect(preview.rows[0]!.refused).toEqual(["Rating is not something “Change the vendor” changes, so a sheet cannot change it"]);
    // The same value it already holds is no change, and nothing to refuse.
    expect(previewImport(storeOf(), "vendor", sheet(["Bloom & Co", "", "", 4, ""]), MAPPING, { by: maya, match: "label" }).rows[0]!.action).toBe("leave");
  });

  it("asks the policy as a press would: a seat that may book but not change a vendor links one and changes none", () => {
    const policy: Policy = { grants: [{ roles: ["planner"], mutations: "*" }, { roles: ["booker"], mutations: ["book"] }] };
    const booker = { kind: "human" as const, id: "bo", name: "Bo", roles: ["booker"] };
    const preview = previewImport(storeOf(policy), "vendor", sheet(["Bloom & Co", "", 1500, "", ""], ["Bloom & Co", "", "", "", "Smith wedding"], ["Someone New", "", "", "", ""]), MAPPING, { by: booker, match: "label" });
    expect(preview.rows[0]!.action).toBe("refuse");
    expect(preview.rows[0]!.refused[0]).toMatch(/^Not permitted: “Change the vendor”/);
    expect(preview.rows[1]!.sentence).toBe("Row 3 would change Bloom & Co, linking it to Smith wedding.");
    expect(preview.rows[2]!.refused[0]).toMatch(/^Not permitted: “Add a vendor”/);
  });
});

describe("proposeMapping", () => {
  it("suggests matching by a key column where the sheet has one, else by the name, and never applies it", () => {
    const keyed = proposeMapping(app, "vendor", ["Name", "Email", "Quote"]);
    expect(keyed.match).toEqual({ column: "Email", field: "email" });
    expect(keyed.matchSaid).toBe("rows are matched to vendors by Email");
    const named = proposeMapping(app, "vendor", ["Vendor name", "Quote"]);
    expect(named.match).toBe("label");
    expect(named.matchSaid).toBe("rows are matched to vendors by their name, under Vendor name");
    expect(proposeMapping(app, "vendor", ["Quote"]).match).toBeUndefined();
  });
});
