import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { compileDocument, computedValues, diffDocuments, documentHash, editDocument, type Finding, type GraviewDocument } from "../../src/document/index.js";
import { placesOf } from "../../src/places.js";

/**
 * FR-84: EDITS FOR ALL OF IT. A chat that builds an app from a phone
 * proposes edits; every part of the document FR-79–83 added — lenses, the
 * front page, the arrangement, computed fields, the new blocks — has an
 * edit of its own that previews (it compiles, and the diff says it in
 * words), applies, and rolls back to the very document it started from.
 * And a rename or a removal reaches every place that names the thing.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const lifelogics = read("lifelogics.gdd.json") as GraviewDocument;
const everyLens = read("every-lens.gdd.json") as GraviewDocument;
const seed = read("lifelogics.seed.json") as { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };

const TODAY = { today: () => "2026-10-05" };
/** Every finding a document compiles with, as "code at path" — errors and warnings alike. */
function findings(document: GraviewDocument): string[] {
  const compiled = compileDocument(document, TODAY);
  const all: readonly Finding[] = compiled.ok ? compiled.findings : compiled.findings;
  return all.filter((f) => f.severity !== "note").map((f) => `${f.severity} ${f.code} at ${f.path}`);
}
function edit(document: GraviewDocument, edits: unknown[]): { document: GraviewDocument; said: readonly string[] } {
  const outcome = editDocument(document, edits);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome;
}
const before = findings(lifelogics);

/** An edit, its inverse, and what the diff says: previewed, applied, and rolled back to the same hash. */
const ROUND_TRIPS: readonly { name: string; on?: GraviewDocument; edit: Record<string, unknown>; inverse: Record<string, unknown>; says: RegExp; said: RegExp }[] = [
  {
    name: "add-lens",
    edit: { op: "add-lens", title: "The parties", on: "party", options: { blocks: [{ headline: "Who is in it" }, { list: "all('party')", sort: { by: "role", direction: "choices" }, as: "row" }] } },
    inverse: { op: "remove-lens", title: "The parties" },
    said: /^A lens "The parties" is added, over parties\.$/,
    says: /A lens "The parties" is added\./,
  },
  {
    name: "remove-lens, put back where it was",
    edit: { op: "remove-lens", title: "The packages" },
    inverse: { op: "add-lens", at: 1, ...lensAsEdit(1) },
    said: /^The lens "The packages" is removed\.$/,
    says: /The lens "The packages" is removed\./,
  },
  {
    name: "add-lens replacing one, retitled",
    edit: { op: "add-lens", replace: "Open questions", ...lensAsEdit(3), title: "What we do not know" },
    inverse: { op: "add-lens", replace: "What we do not know", ...lensAsEdit(3) },
    said: /^The lens "Open questions" is now "What we do not know", over open questions\.$/,
    says: /A lens "What we do not know" is added\..*The lens "Open questions" is removed\./,
  },
  {
    name: "set-home",
    edit: { op: "set-home", blocks: [{ headline: "{count(all('offer')) | words} offers" }, { figure: "sum(all('package'), net)", as: "money", currency: "USD", label: "Every package" }, { list: "all('question')", sort: "name", limit: 3, as: "row", empty: "Nothing to ask." }] },
    inverse: { op: "set-home", blocks: (lifelogics.views as Record<string, unknown>)["home"] },
    said: /^The front page changes: a headline, a figure and a list of records\.$/,
    says: /^The front page changes\.$/,
  },
  {
    name: "set-view on the front page",
    edit: { op: "set-view", slot: "home", blocks: [{ headline: "Hello" }] },
    inverse: { op: "set-view", slot: "home", blocks: (lifelogics.views as Record<string, unknown>)["home"] },
    said: /^The front page changes: a headline\.$/,
    says: /^The front page changes\.$/,
  },
  {
    name: "set-view: a page with a headline, a list and a figure",
    edit: { op: "set-view", kind: "offer", slot: "page", blocks: [{ headline: "Who it is for" }, { list: "out('serves')", as: "row", empty: "Nobody yet." }, { figure: "net", as: "money", currency: "USD", label: "After the discount" }] },
    inverse: { op: "set-view", kind: "offer", slot: "page", blocks: null },
    said: /^An offer page gets a look of its own: a headline, a list of records and a figure\.$/,
    says: /An offer page gets a look of its own\./,
  },
  {
    name: "set-view: a blocks lens's blocks",
    edit: { op: "set-view", lens: "The offers", blocks: [{ headline: "Every offer" }, { list: "all('offer')", sort: { by: "net", direction: "desc" }, as: "row" }] },
    inverse: { op: "set-view", lens: "The offers", blocks: (lifelogics.lenses![0] as { options: { blocks: unknown[] } }).options.blocks },
    said: /^The lens "The offers" is drawn from a headline and a list of records now\.$/,
    says: /^The lens "The offers" changes\.$/,
  },
  {
    name: "arrange-pages",
    edit: { op: "arrange-pages", order: ["package", "offer"], hide: ["stakeholder", "party"], first: "The packages" },
    inverse: { op: "arrange-pages", order: ["offer", "package", "signal", "question", "party", "stakeholder"], hide: ["stakeholder"], first: null },
    said: /^Packages and offers come first, in that order, the front page leaves off people and teams and parties and the app opens on "The packages"\.$/,
    says: /The kinds are put in a new order: package, offer\..*The front page leaves off party\..*The app opens on "The packages"\./,
  },
  {
    name: "set-computed: a new one",
    edit: { op: "set-computed", kind: "package", name: "offers", expr: "count(out('includes'))", label: "Offers in it" },
    inverse: { op: "set-computed", kind: "package", name: "offers", expr: null },
    said: /^Packages work out "offers": count\(out\('includes'\)\), shown as "Offers in it"\.$/,
    says: /^Packages work out "offers"\.$/,
  },
  {
    name: "set-computed: worked out differently",
    edit: { op: "set-computed", kind: "offer", name: "total", expr: "list * units * 2" },
    inverse: { op: "set-computed", kind: "offer", name: "total", expr: "list * units" },
    said: /^How offers work out "total" changes: list \* units \* 2\.$/,
    says: /^How offers work out "total" changes\.$/,
  },
];

/** A lens of the fixture, as add-lens takes it. */
function lensAsEdit(index: number): Record<string, unknown> {
  const { name, ...rest } = lifelogics.lenses![index] as Record<string, unknown>;
  return { lens: name, ...rest };
}

describe("FR-84: every new edit previews, applies and rolls back", () => {
  for (const trip of ROUND_TRIPS) {
    it(`${trip.name}: says what it did, compiles with no new finding, and its inverse is the document it started from`, async () => {
      const start = trip.on ?? lifelogics;
      const applied = edit(start, [trip.edit]);
      expect(applied.said.join(" ")).toMatch(trip.said);
      expect(diffDocuments(start, applied.document).sentences.join(" ")).toMatch(trip.says);
      expect(findings(applied.document)).toEqual(before);
      const rolled = edit(applied.document, [trip.inverse]);
      expect(await documentHash(rolled.document)).toBe(await documentHash(start));
      expect(diffDocuments(start, rolled.document).unchanged).toBe(true);
    });
  }

  it("set-computed removing one takes what reads it, and says so", () => {
    const { document, said } = edit(lifelogics, [{ op: "set-computed", kind: "package", name: "list", expr: null }]);
    // package's net is worked out from its list; its glance said net; its row and page showed net.
    expect(said.join(" ")).toBe(`Packages no longer work out "list"; package's net, part of the front page, part of the package card, part of the package row and part of the package page go with it.`);
    expect(document.kinds["package"]!.computed).toBeUndefined();
    expect(document.kinds["package"]!.glance).toEqual(["standing"]);
    expect(findings(document)).toEqual(before);
  });

  it("refuses blocks that cannot be drawn, at the block's own path, before anything is previewed", () => {
    const outcome = editDocument(lifelogics, [{ op: "set-home", blocks: [{ headline: "Fine" }, { list: "all('offer')", group: "mode", sort: { by: "nonesuch", direction: "choices" } }] }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map((f) => f.path)).toEqual(["edits.0.blocks.1.sort.by"]);
  });

  it("refuses a lens title that is already a place, and a lens no framework draws", () => {
    for (const bad of [
      { op: "add-lens", title: "The offers", on: "offer", options: { blocks: [{ headline: "Again" }] } },
      { op: "add-lens", title: "Somewhere", lens: "carousel", on: "offer" },
      { op: "arrange-pages", first: "Nowhere" },
      { op: "set-computed", kind: "offer", name: "name", expr: "1" },
      { op: "set-computed", kind: "offer", name: "loop", expr: "loop + 1" },
    ]) {
      const outcome = editDocument(lifelogics, [bad]);
      expect(outcome.ok, JSON.stringify(bad)).toBe(false);
      if (!outcome.ok) for (const f of outcome.findings) expect(f.message.length).toBeGreaterThan(15);
    }
  });
});

/** The seed in the renamed words: offers are items, and an item's list is its price. */
function renamedSeed() {
  return {
    nodes: seed.nodes.map((node) => {
      if (node["kind"] !== "offer") return node;
      const { list, ...rest } = node;
      return { ...rest, kind: "item", price: list };
    }),
    edges: seed.edges,
  };
}

describe("FR-84: a rename reaches every place that names it", () => {
  const renamed = edit(lifelogics, [
    { op: "rename-field", kind: "offer", field: "list", to: "price" },
    { op: "rename-kind", kind: "offer", to: "item" },
  ]).document;

  it("rewrites computed expressions through the parser: the item's own, and a per-member read from a package, and not the package's own list", () => {
    expect(renamed.kinds["item"]!.computed).toMatchObject({ total: { expr: "price * units" }, netEach: { expr: "price * (100 - either(first(all('party') where role == 'client').discount, 0)) / 100" } });
    expect(renamed.kinds["package"]!.computed).toMatchObject({
      list: { expr: "sum(out('includes'), price * units)" },
      // The package's own computed list, which this rename does not touch.
      net: { expr: "list * (100 - either(first(all('party') where role == 'client').discount, 0)) / 100" },
    });
  });

  it("rewrites the front page, every lens and every view — formatters and their quoted words kept as written", () => {
    const home = JSON.stringify((renamed.views as Record<string, unknown>)["home"]);
    expect(home).not.toMatch(/all\('offer'\)/);
    expect(home).toContain(`{count(all('item') where stage == 'start') | plural: 'front'}`);
    expect(home).toContain(`"list":"all('item')"`);
    expect(renamed.lenses!.map((lens) => lens["on"])).toEqual(["item", "package", "signal", "question"]);
    expect(JSON.stringify(renamed.lenses![0])).toContain("all('item') where stage == 'start') | words}");
    const card = JSON.stringify((renamed.views as Record<string, { card?: unknown }>)["item"]!.card);
    expect(card).toContain("{price | money} at list");
    expect(renamed.pages).toEqual({ order: ["item", "package", "signal", "question", "party", "stakeholder"], hide: ["stakeholder"] });
    expect(renamed.policy!.sees!.map((sight) => sight.kinds)).toEqual([["party", "stakeholder", "signal", "item", "package", "question"], ["stakeholder", "signal", "package", "question"], ["item"]]);
    expect(renamed.acts!["add-item"]!.writes).toContain("price");
  });

  it("still compiles, with no new finding", () => {
    expect(findings(renamed)).toEqual(before.map((f) => f.replace(/\boffer\b/g, "item")));
  });

  it("is the same places, and every record works out the same values", () => {
    const a = compileDocument(lifelogics, TODAY);
    const b = compileDocument(renamed, TODAY);
    if (!a.ok || !b.ok) throw new Error("does not compile");
    // The same places at the same addresses; only the scene's stop names the kind by its new name.
    expect(placesOf(b.app).map(({ kind, stop, ...place }) => ({ ...place, kind: kind === "item" ? "offer" : kind, stop: stop.replace(":item", ":offer") }))).toEqual(placesOf(a.app));
    const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
    const storeA = new Store<AnySchema>({ schema: a.app.schema as AnySchema, mutations: a.app.mutations ?? [], policy: a.app.policy!, snapshot: seed as never }).seenBy(owner);
    const storeB = new Store<AnySchema>({ schema: b.app.schema as AnySchema, mutations: b.app.mutations ?? [], policy: b.app.policy!, snapshot: renamedSeed() as never }).seenBy(owner);
    for (const node of storeA.graph.allNodes()) {
      const other = storeB.graph.getNode(node.id)!;
      expect(computedValues(storeB.schema, storeB.graph as never, other as never).values, node.id).toEqual(computedValues(storeA.schema, storeA.graph as never, node as never).values);
    }
  });

  it("a field rename the front page groups by follows into the group, the sort and every expression", () => {
    const { document } = edit(lifelogics, [{ op: "rename-field", kind: "offer", field: "stage", to: "phase" }]);
    const home = (document.views as Record<string, Record<string, unknown>[]>)["home"]!;
    expect(home[1]!["headline"]).toBe("A small start, on {count(all('offer') where phase == 'start') | words} {count(all('offer') where phase == 'start') | plural: 'front'}.");
    expect(home[7]!["group"]).toEqual({ by: "phase", headings: { start: "The way in", later: "For afterwards" } });
    expect(findings(document)).toEqual(before);
  });

  it("a retitled lens that the app opens on keeps it opening there", () => {
    const opening = edit(lifelogics, [{ op: "arrange-pages", first: "The packages" }]).document;
    const { document, said } = edit(opening, [{ op: "add-lens", replace: "The packages", ...lensAsEdit(1), title: "The sets" }]);
    expect(document.pages!.first).toBe("The sets");
    expect(said.join(" ")).toMatch(/the app still opens on it/);
    expect(findings(document)).toEqual(before);
  });
});

describe("FR-84: a removal rewrites what names the thing away, or is refused naming each reference", () => {
  it("removing a field a list groups by keeps the list and drops the grouping; text that said it goes", () => {
    const { document, said } = edit(lifelogics, [{ op: "remove-field", kind: "offer", field: "stage" }]);
    const home = (document.views as Record<string, Record<string, unknown>[]>)["home"]!;
    const offers = home.find((block) => block["list"] === "all('offer')")!;
    expect(offers["group"]).toBeUndefined();
    expect(home.some((block) => JSON.stringify(block).includes("stage"))).toBe(false);
    expect((document.lenses![0]!["options"] as { blocks: Record<string, unknown>[] }).blocks.map((block) => Object.keys(block)[0])).toEqual(["list"]);
    expect(said.join(" ")).toMatch(/part of the front page/);
    expect(findings(document)).toEqual(before);
  });

  it("removing a relation takes the computed fields that walk it, and what reads them, in turn", () => {
    const { document, said } = edit(lifelogics, [{ op: "remove-relation", kind: "package", relation: "includes" }]);
    expect(document.kinds["package"]!.computed).toBeUndefined();
    expect(said.join(" ")).toMatch(/package's list, package's net/);
    expect(findings(document)).toEqual(before);
  });

  it("removing a kind takes the lens that stands on it, the blocks that sweep it, and its place in the arrangement", () => {
    const { document } = edit(lifelogics, [{ op: "remove-kind", kind: "package" }]);
    expect(document.lenses!.map((lens) => lens["title"])).toEqual(["The offers", "What we heard", "Open questions"]);
    expect(JSON.stringify(document.views)).not.toMatch(/'package'/);
    expect(document.pages!.order).not.toContain("package");
    // Fewer findings — package's own are gone with it — and none new.
    expect(findings(document).filter((f) => !before.includes(f))).toEqual([]);
  });

  it("removing a kind the app opens on, through its lens, opens the app at its home", () => {
    const { document, said } = edit(everyLens, [{ op: "remove-kind", kind: "seat" }]);
    expect(document.lenses!.map((lens) => lens["title"])).not.toContain("The floor");
    expect(document.pages!.first).toBeUndefined();
    expect(said.join(" ")).toMatch(/the lens "The floor" \(the app opens at its home again\)/);
    expect(compileDocument(document).ok).toBe(true);
  });

  it("refuses to remove a field or a relation a lens draws by, naming each lens and role", () => {
    const field = editDocument(everyLens, [{ op: "remove-field", kind: "shift", field: "from" }]);
    expect(field.ok).toBe(false);
    if (!field.ok) expect(field.findings.map((f) => f.message)).toEqual([`the lens "The week" (lenses.0) draws by its start, which is shift's from, and cannot draw without it`]);
    const relation = editDocument(everyLens, [{ op: "remove-relation", kind: "shift", relation: "covered-by" }]);
    expect(relation.ok).toBe(false);
    if (!relation.ok) expect(relation.findings.map((f) => f.message)).toEqual([`the lens "Who covers what" (lenses.2) draws by its link, which is the "covered-by" relation, and cannot draw without it`]);
    // Once the lens is gone, the field goes too.
    expect(editDocument(everyLens, [{ op: "remove-lens", title: "The week" }, { op: "remove-field", kind: "shift", field: "from" }]).ok).toBe(true);
  });

  it("renaming through a lens's bindings: a field a board reads, and a kind it stands on", () => {
    const { document } = edit(everyLens, [
      { op: "rename-field", kind: "seat", field: "x", to: "across" },
      { op: "rename-kind", kind: "seat", to: "chair" },
      { op: "rename-relation", kind: "shift", relation: "covered-by", to: "coveredBy" },
    ]);
    expect(document.lenses![3]!["bindings"]).toEqual({ slots: { kind: "chair" }, x: { field: "across", on: "slots" }, y: { field: "y", on: "slots" }, fill: { edge: "taken-by" } });
    expect(document.lenses![2]!["bindings"]).toMatchObject({ link: { edge: "coveredBy" } });
    expect(document.pages!.order).toEqual(["volunteer", "chair", "shift"]);
    expect(compileDocument(document).ok).toBe(true);
  });
});

describe("FR-84: every removal from the FR-79–83 fixtures compiles, or is refused in words", () => {
  for (const [name, document] of [["lifelogics", lifelogics], ["every-lens", everyLens], ["proposal", read("proposal.gdd.json") as GraviewDocument]] as const) {
    it(name, () => {
      const baseline = findings(document).filter((f) => f.startsWith("error"));
      const broken: string[] = [];
      for (const [kind, spec] of Object.entries(document.kinds)) {
        const removals = [{ op: "remove-kind", kind }, ...Object.keys(spec.fields).map((field) => ({ op: "remove-field", kind, field })), ...Object.keys(spec.edges ?? {}).map((relation) => ({ op: "remove-relation", kind, relation })), ...Object.keys(spec.computed ?? {}).map((computed) => ({ op: "set-computed", kind, name: computed, expr: null }))];
        for (const removal of removals) {
          const outcome = editDocument(document, [removal]);
          if (!outcome.ok) {
            for (const f of outcome.findings) expect(f.message.length).toBeGreaterThan(10);
            continue;
          }
          const errors = findings(outcome.document).filter((f) => f.startsWith("error") && !baseline.includes(f));
          if (errors.length > 0) broken.push(`${JSON.stringify(removal)}: ${errors.join("; ")}`);
        }
      }
      expect(broken).toEqual([]);
    });
  }
});
