import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { arrangeable } from "../../src/arrange.js";
import { shownList } from "../../src/shown.js";
import { listCsvRows } from "../../src/csv.js";
import { readableFields } from "../../src/words.js";
import { blockContextFor, resolveBlocks, withComputed } from "../../src/blocks.js";
import { labelOf, Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { editDocument, evaluateExpr, parseExpr, type GraviewDocument } from "../../src/document/index.js";
import { createSchema, defineNode, z } from "../../src/index.js";

/**
 * A COMPUTED VALUE IS SAID AS ITS FORMAT, ROUNDED, AND KEPT OFF THE PAGE
 * WHERE IT IS ONLY A HELPER (Roadmap f-computed-format, FR-217). A season's
 * `pct = wins / (wins + losses + ties)` read "0.8235294117647058" under
 * Details: `set-format` refused a computed ("season has no field pct"), the
 * rule language had no `round()`, and a share worked out only to rank
 * seasons could not be kept off the record's page while a list sorted by it.
 */
const league: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "League",
  brand: { currency: "USD", locale: "en-US" },
  kinds: {
    season: {
      noun: "season",
      plural: "seasons",
      label: "{year}",
      fields: {
        year: { type: "string", required: true },
        wins: { type: "integer" },
        losses: { type: "integer" },
        ties: { type: "integer" },
        payroll: { type: "number" },
      },
      computed: {
        pct: "wins / (wins + losses + ties)",
        rank: "round(wins / (wins + losses + ties), 3)",
        perWin: "payroll / wins",
      },
    },
  },
  acts: { "add-season": { title: "Add a season", creates: "season" } },
  policy: { grants: [{ roles: "*", mutations: "*" }] },
} as unknown as GraviewDocument;

const seasons = [
  { id: "season:1972", kind: "season", year: "1972", wins: 14, losses: 0, ties: 0, payroll: 7_000_000 },
  { id: "season:1975", kind: "season", year: "1975", wins: 12, losses: 2, ties: 0, payroll: 9_000_000 },
  { id: "season:1979", kind: "season", year: "1979", wins: 14, losses: 2, ties: 1, payroll: 11_000_000 },
];

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc);
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((f) => f.severity === "error")));
  return result.app as GraviewApp<AnySchema>;
}

function edited(edits: readonly object[]): GraviewDocument {
  const result = editDocument(league, edits as never);
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  return result.document as GraviewDocument;
}

function opened(doc: unknown) {
  const app = compiled(doc);
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: seasons as never, edges: [] } });
  return { app, store };
}

/** What a record's page says of a season, by field. */
function page(store: Store<AnySchema>, id: string): Record<string, string> {
  const node = store.graph.getNode(id)!;
  const definition = store.schema.tryDefinition("season");
  return Object.fromEntries(readableFields(withComputed(store.schema, store.graph as never, node as never) as never, definition).map((field) => [field.key, field.value]));
}

describe("set-format on a computed field", () => {
  it("says a computed share as a percent, and money as money, on the record's page", () => {
    const doc = edited([
      { op: "set-format", kind: "season", field: "pct", format: "percent" },
      { op: "set-format", kind: "season", field: "perWin", format: "money" },
    ]);
    expect(doc.kinds["season"]!.computed!["pct"]).toEqual({ expr: "wins / (wins + losses + ties)", format: "percent" });
    const { store } = opened(doc);
    const said = page(store, "season:1979");
    expect(said["pct"]).toBe("82%");
    expect(said["perWin"]).toBe("$785,714.29");
  });

  it("says what it did, and refuses Markdown, which a worked-out number cannot be", () => {
    const result = editDocument(league, [{ op: "set-format", kind: "season", field: "pct", format: "percent" }] as never);
    expect(result.ok && result.said).toEqual(["season's pct is worked out as before and said as a percent, kept as a fraction — 0.15 reads 15%."]);
    const refused = editDocument(league, [{ op: "set-format", kind: "season", field: "pct", format: "markdown" }] as never);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.findings[0]!.message).toMatch(/cannot be Markdown/);
  });

  it("goes back to a plain number with null, kept short as the bare expression", () => {
    const doc = editDocument(edited([{ op: "set-format", kind: "season", field: "pct", format: "percent" }]), [{ op: "set-format", kind: "season", field: "pct", format: null }] as never);
    expect(doc.ok && doc.document.kinds["season"]!.computed!["pct"]).toBe("wins / (wins + losses + ties)");
  });

  it("is said as its format in a list's CSV and in a view spec's field block", () => {
    const { store } = opened(edited([{ op: "set-format", kind: "season", field: "pct", format: "percent" }]));
    const rows = listCsvRows({ schema: store.schema, graph: store.graph as never, kind: "season", grouped: false, groups: [{ nodes: store.graph.nodesOfKind("season" as never) as never }], words: { labelOf, readableFields, withComputed } });
    const column = rows[0]!.indexOf("Pct");
    expect(rows.slice(1).map((row) => row[column])).toEqual(["100%", "86%", "82%"]);
    const node = store.graph.getNode("season:1979")!;
    const [block] = resolveBlocks([{ t: "field", field: "pct" }] as never, blockContextFor(store, null, node));
    expect((block as { text: string }).text).toBe("82%");
  });

  it("is said as its format when a declaration in code says it", () => {
    const schema = createSchema([defineNode("season", { fields: z.object({ wins: z.number(), games: z.number() }), computed: { pct: { expr: "wins / games", format: "percent" }, kept: { expr: "wins", hidden: true } } })] as never);
    const said = readableFields({ id: "s", kind: "season", wins: 3, games: 4, pct: 0.75, kept: 3 }, schema.tryDefinition("season"));
    expect(said.map((field) => [field.key, field.value])).toEqual([["wins", "3"], ["games", "4"], ["pct", "75%"]]);
  });
});

describe("round() in the rule language", () => {
  const run = (text: string) => evaluateExpr(parseExpr(text), { graph: undefined as never, subject: null, kinds: new Map() });

  it("rounds to a number of places, half away from zero, and to a whole number without one", () => {
    expect(run("round(14 / 17, 3)")).toBe(0.824);
    expect(run("round(2.5)")).toBe(3);
    expect(run("round(0 - 2.5)")).toBe(-3);
    expect(run("round(1.005, 2)")).toBe(1.01);
    expect(run("round(0 - 0.0001, 2)")).toBe(0);
  });

  it("leaves nothing as nothing, and says what it cannot round", () => {
    expect(run("round(null, 2)")).toBe(null);
    expect(() => run("round('a')")).toThrow(/round\(…\) needs a number/);
    expect(() => run("round(1.5, 0.5)")).toThrow(/whole number of places/);
  });

  it("is a function the checker knows, and a season's page reads the rounded share", () => {
    const result = compileDocument(league);
    expect(result.findings.filter((f) => f.code === "unknown-function")).toEqual([]);
    const { store } = opened(league);
    expect(page(store, "season:1979")["rank"]).toBe("0.824");
  });
});

describe("a hidden computed field", () => {
  const doc = () => edited([{ op: "set-computed", kind: "season", name: "rank", hidden: true }]);

  it("is kept off the record's page and its CSV", () => {
    const { store } = opened(doc());
    expect(Object.keys(page(store, "season:1979"))).not.toContain("rank");
    const rows = listCsvRows({ schema: store.schema, graph: store.graph as never, kind: "season", grouped: false, groups: [{ nodes: store.graph.nodesOfKind("season" as never) as never }], words: { labelOf, readableFields, withComputed } });
    expect(rows[0]).not.toContain("Rank");
  });

  it("still sorts a list, and is still worked out for a view", () => {
    const { store } = opened(doc());
    const shown = shownList({
      schema: store.schema,
      graph: store.graph,
      kind: "season",
      nodes: store.graph.nodesOfKind("season" as never) as never,
      arrangement: { sort: { by: "rank", direction: "desc" } },
      offers: arrangeable(store.schema, "season"),
    });
    expect(shown.nodes.map((node) => node.id)).toEqual(["season:1972", "season:1975", "season:1979"]);
    expect(withComputed(store.schema, store.graph as never, store.graph.getNode("season:1979")! as never)["rank"]).toBe(0.824);
  });

  it("is said by set-computed, and shown again with hidden: false", () => {
    const result = editDocument(league, [{ op: "set-computed", kind: "season", name: "rank", hidden: true }] as never);
    expect(result.ok && result.said).toEqual(['Seasons\' "rank" is kept off their pages, cards and CSV, and still worked out for sorts, rules and views.']);
    expect(result.ok && result.document.kinds["season"]!.computed!["rank"]).toEqual({ expr: "round(wins / (wins + losses + ties), 3)", hidden: true });
    const shownAgain = editDocument(doc(), [{ op: "set-computed", kind: "season", name: "rank", hidden: false }] as never);
    expect(shownAgain.ok && shownAgain.document.kinds["season"]!.computed!["rank"]).toBe("round(wins / (wins + losses + ties), 3)");
  });
});
