import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkApp, createSchema, defineApp, defineNode, z } from "@graview/core";
import { compileDocument, toDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";

/**
 * FR-03: a card, a row and a page declared as data, and `graview check`
 * holding every name and tone in them to the declaration.
 */
const category = defineNode("category", { fields: z.object({ name: z.string() }), plural: "Categories" });
const vendor = defineNode("vendor", {
  fields: z.object({ name: z.string(), status: z.enum(["researching", "booked"]), quote: z.number().optional(), site: z.url().optional() }),
  edges: { fills: { to: ["category"], cardinality: "one" } },
  plural: "Vendors",
});
const schema = createSchema([category, vendor]);
const app = (viewSpecs: unknown) => defineApp({ name: "Vendors", schema, mutations: [], viewSpecs: viewSpecs as never });
const codes = (viewSpecs: unknown) => checkApp(app(viewSpecs)).findings.filter((f) => f.where.startsWith("viewSpecs")).map((f) => `${f.code} ${f.where}`);

describe("views as data, checked", () => {
  it("passes a card that names only what the kind declares", () => {
    expect(
      codes({
        vendor: {
          card: [{ title: "{name}" }, { badge: "{status}", tone: { expr: "if(status == 'booked', 'good', 'neutral')" } }, { field: "quote", as: "money" }, { text: "{fills.name}" }, { field: "site" }],
          row: [{ title: "{name}" }, { badge: "{status}", tone: "accent" }],
          page: [{ when: "quote > 1000", show: [{ text: "A big one", tone: "warn" }] }],
        },
      }),
    ).toEqual([]);
  });

  it("refuses a spec naming a field the kind lacks", () => {
    expect(codes({ vendor: { card: [{ field: "price" }] } })).toEqual(["view-field viewSpecs.vendor.card.0.field"]);
    expect(codes({ vendor: { card: [{ text: "{price|money}" }] } })).toEqual(["view-name viewSpecs.vendor.card.0.text"]);
    expect(codes({ vendor: { card: [{ when: "rating > 3", show: [{ title: "{name}" }] }] } })).toEqual(["view-name viewSpecs.vendor.card.0.when"]);
  });

  it("refuses a tone outside the kit", () => {
    const result = checkApp(app({ vendor: { card: [{ badge: "{status}", tone: "green" }] } }));
    const tone = result.findings.find((f) => f.code === "view-tone");
    expect(tone?.severity).toBe("error");
    expect(tone?.where).toBe("viewSpecs.vendor.card.0.tone");
    expect(tone?.fix).toMatch(/good, warn, bad, neutral, accent/);
    expect(result.ok).toBe(false);
  });

  it("refuses a kind the app does not declare, a slot that is not a place, and a figure the kind has not got", () => {
    expect(codes({ supplier: { card: [{ title: "{name}" }] } })).toEqual(["view-kind viewSpecs.supplier"]);
    expect(codes({ vendor: { tile: [{ title: "{name}" }] } })).toEqual(["view-slot viewSpecs.vendor.tile"]);
    expect(codes({ vendor: { card: [{ figure: true }] } })).toEqual(["view-figure viewSpecs.vendor.card.0.figure"]);
  });

  it("refuses a block that is not in the vocabulary, so nothing a spec says can be markup or code", () => {
    expect(codes({ vendor: { card: [{ html: "<script>alert(1)</script>" }] } })).toEqual(["view-block viewSpecs.vendor.card.0"]);
    expect(codes({ vendor: { card: [{ text: "{name}", style: "color: red" }] } })).toEqual(["unknown-key viewSpecs.vendor.card.0.style"]);
  });

  it("is the document's views, compiled and written back", () => {
    const vendors = JSON.parse(readFileSync(resolve(import.meta.dirname, "../document/fixtures/vendors.gdd.json"), "utf8"));
    const views = { vendor: { card: [{ title: "{name}" }, { badge: "{status}", tone: "good" }] } };
    const compiled = compileDocument({ ...vendors, views });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.app.viewSpecs).toEqual(views);
    expect(checkApp(compiled.app).findings.filter((f) => f.where.startsWith("viewSpecs"))).toEqual([]);
    const written = toDocument(defineApp({ name: "Vendors", schema, viewSpecs: views }));
    expect(written.document.views).toEqual(views);
  });
});
