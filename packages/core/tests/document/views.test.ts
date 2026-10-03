import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument, diffDocuments, readDocument, type GraviewDocument } from "../../src/document/index.js";

const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"));
const withViews = (views: unknown) => ({ ...vendors, views });
const findingsOf = (views: unknown) => readDocument(withViews(views)).findings.filter((f) => f.severity === "error");
const at = (views: unknown) => findingsOf(views).map((f) => `${f.code} @ ${f.path}`);

const CARD = [
  { title: "{name}" },
  { badge: "{status}", tone: { expr: "if(status == 'booked', 'good', 'neutral')" } },
  { field: "quote", as: "money" },
  { field: "due", as: "relative" },
];

describe("view specs are checked into findings with JSON paths", () => {
  it("accepts the documented example, and every block shape", () => {
    expect(at({ vendor: { card: CARD } })).toEqual([]);
    expect(
      at({
        vendor: {
          row: [{ text: "{name} for {fills.name}", tone: "accent" }, { badge: "{status}", tone: "warn" }],
          page: [
            { title: "{name}" },
            { group: [{ field: "quote", label: "Quoted" }, { divider: true }], direction: "row" },
            { when: "status == 'booked'", show: [{ text: "Booked — {due|relative}", tone: "good" }] },
            { progress: { value: "quote", max: "fills.budget" }, label: "Of the budget" },
          ],
        },
      }),
    ).toEqual([]);
    const c = compileDocument(withViews({ vendor: { card: CARD } }), { today: () => "2026-10-02", skipFrameworkCheck: true });
    expect(c.ok).toBe(true);
  });

  it("names a view for a kind the document does not declare, and an unknown slot", () => {
    expect(at({ supplier: { card: CARD } })).toEqual(["view-kind @ views.supplier"]);
    expect(at({ vendor: { tile: CARD } })).toEqual(["unknown-key @ views.vendor"]);
  });

  it("refuses unknown blocks and unknown keys on a block", () => {
    expect(at({ vendor: { card: [{ heading: "{name}" }] } })).toEqual(["view-block @ views.vendor.card.0"]);
    expect(at({ vendor: { card: [{ title: "{name}", style: "color: red" }] } })).toEqual(["unknown-key @ views.vendor.card.0.style"]);
    expect(at({ vendor: { card: [{ title: "{name}", badge: "{status}" }] } })).toEqual(["view-block @ views.vendor.card.0"]);
    expect(at({ vendor: { card: ["{name}"] } })).toEqual(["view-block @ views.vendor.card.0"]);
    expect(at({ vendor: { card: [{ divider: "yes" }] } })).toEqual(["view-block @ views.vendor.card.0.divider"]);
  });

  it("refuses fields the kind does not have, in a field block and in templates and expressions", () => {
    expect(at({ vendor: { card: [{ field: "price" }] } })).toEqual(["view-field @ views.vendor.card.0.field"]);
    expect(at({ vendor: { card: [{ title: "{nmae}" }] } })).toEqual(["view-name @ views.vendor.card.0.title"]);
    expect(at({ vendor: { card: [{ when: "price > 3", show: [{ divider: true }] }] } })).toEqual(["view-name @ views.vendor.card.0.when"]);
    const relation = findingsOf({ vendor: { card: [{ field: "fills" }] } })[0]!;
    expect(relation.fix).toMatch(/fills\.name/);
  });

  it("refuses bad expressions and templates, saying where", () => {
    expect(at({ vendor: { card: [{ when: "status ==", show: [] }] } })).toEqual(["expression @ views.vendor.card.0.when"]);
    expect(at({ vendor: { card: [{ text: "{status|shout}" }] } })).toEqual(["template @ views.vendor.card.0.text"]);
    expect(at({ vendor: { card: [{ progress: { value: "quote +", max: "10" } }] } })).toEqual(["expression @ views.vendor.card.0.progress.value"]);
    expect(at({ vendor: { card: [{ progress: { value: "quote" } }] } })).toEqual(["view-progress @ views.vendor.card.0.progress"]);
    expect(at({ vendor: { card: [{ badge: "{status}", tone: { expr: "launch(status)" } }] } })).toEqual(["unknown-function @ views.vendor.card.0.tone.expr"]);
    expect(at({ vendor: { card: [{ when: "status == 'booked'" }] } })).toEqual(["view-when @ views.vendor.card.0"]);
  });

  it("holds tones, formats and directions to their sets", () => {
    const tone = findingsOf({ vendor: { card: [{ badge: "{status}", tone: "green" }] } });
    expect(tone.map((f) => `${f.code} @ ${f.path}`)).toEqual(["view-tone @ views.vendor.card.0.tone"]);
    expect(tone[0]!.fix).toMatch(/good, warn, bad, neutral, accent/);
    expect(at({ vendor: { card: [{ badge: "{status}", tone: { css: "red" } }] } })).toEqual(["view-tone @ views.vendor.card.0.tone"]);
    expect(at({ vendor: { card: [{ field: "quote", as: "euros" }] } })).toEqual(["view-format @ views.vendor.card.0.as"]);
    expect(at({ vendor: { card: [{ group: [], direction: "diagonal" }] } })).toEqual(["view-direction @ views.vendor.card.0.direction"]);
  });

  it("refuses a figure on a kind without one", () => {
    expect(at({ vendor: { card: [{ figure: true }] } })).toEqual(["view-figure @ views.vendor.card.0.figure"]);
  });

  it("holds nesting to four deep and a view to forty blocks", () => {
    const nest = (depth: number): unknown => (depth === 0 ? { divider: true } : { group: [nest(depth - 1)] });
    expect(at({ vendor: { card: [nest(3)] } })).toEqual([]);
    expect(at({ vendor: { card: [nest(4)] } })).toEqual(["view-depth @ views.vendor.card.0.group.0.group.0.group.0.group"]);
    expect(at({ vendor: { card: Array.from({ length: 40 }, () => ({ divider: true })) } })).toEqual([]);
    expect(at({ vendor: { card: Array.from({ length: 41 }, () => ({ divider: true })) } })).toEqual(["view-size @ views.vendor.card"]);
    expect(at({ vendor: { card: Array.from({ length: 20 }, () => ({ group: [{ divider: true }] })) } })).toEqual([]);
    expect(at({ vendor: { card: Array.from({ length: 21 }, () => ({ group: [{ divider: true }] })) } })).toEqual(["view-size @ views.vendor.card"]);
  });

  it("refuses a document whose views do not check, when compiled", () => {
    const c = compileDocument(withViews({ vendor: { card: [{ badge: "{status}", tone: "green" }] } }), { skipFrameworkCheck: true });
    expect(c.ok).toBe(false);
  });
});

describe("a change to a view is said in words", () => {
  const before = readDocument(vendors).document as GraviewDocument;
  const card = readDocument(withViews({ vendor: { card: CARD } })).document as GraviewDocument;
  const changed = readDocument(withViews({ vendor: { card: CARD.slice(0, 2) } })).document as GraviewDocument;

  it("names the kind and the slot", () => {
    expect(diffDocuments(before, card).sentences).toEqual(["A vendor card gets a look of its own."]);
    expect(diffDocuments(card, changed).sentences).toEqual(["How a vendor card looks changes."]);
    expect(diffDocuments(card, before).sentences).toEqual(["A vendor card goes back to Graview's own look."]);
    expect(diffDocuments(card, card).unchanged).toBe(true);
    expect(diffDocuments(card, changed).breaking).toBe(false);
  });
});
