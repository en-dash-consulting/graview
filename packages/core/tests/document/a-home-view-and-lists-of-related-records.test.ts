import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkApp } from "../../src/cli/check.js";
import { describeApp } from "../../src/cli/describe.js";
import { createSchema, declaredLenses, defineApp, defineNode, placesOf, z, type GraviewApp } from "../../src/index.js";
import { compileDocument, toDocument, validateViewSpecs, type Finding } from "../../src/document/index.js";

/**
 * FR-81 and FR-82, as data: a home view from the closed block set —
 * `headline`, `figure` and `list` — and a list of related records in a
 * card, a row or a page. LifeLogics draws its front page and four lenses
 * in code; `fixtures/lifelogics.gdd.json` draws them from blocks, and this
 * holds the document's vocabulary to what each block may say.
 */
const lifelogics = JSON.parse(readFileSync(new URL("./fixtures/lifelogics.gdd.json", import.meta.url), "utf8"));

function compile(doc: unknown) {
  return compileDocument(doc, { today: () => "2026-10-05" });
}
function compiled(doc: unknown = lifelogics): GraviewApp {
  const result = compile(doc);
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"), null, 2)}`);
  return result.app;
}
const errors = (doc: unknown): Finding[] => compile(doc).findings.filter((f) => f.severity === "error");
const withViews = (views: Record<string, unknown>) => ({ ...lifelogics, views: { ...lifelogics.views, ...views } });
const withHome = (home: unknown[]) => withViews({ home });

describe("the LifeLogics front page and its four lenses, as data", () => {
  it("compiles clean, with the home view on the app and every lens a place", () => {
    const app = compiled();
    expect(app.home?.length).toBeGreaterThan(3);
    const titles = declaredLenses(app).drawn.map((lens) => [lens.lens, lens.title, lens.kinds]);
    expect(titles).toEqual([
      ["blocks", "The offers", ["offer"]],
      ["blocks", "The packages", ["package"]],
      ["blocks", "What we heard", ["signal"]],
      ["blocks", "Open questions", ["question"]],
    ]);
    expect(placesOf(app).filter((place) => place.lens === "blocks").map((place) => place.address)).toEqual([
      "/places/the-offers",
      "/places/the-packages",
      "/places/what-we-heard",
      "/places/open-questions",
    ]);
  });

  it("checks without a finding about its views, lenses or arrangement", () => {
    const result = checkApp(compiled());
    expect(result.findings.filter((f) => f.severity !== "note" && /^(view|lens|pages|home|list)/.test(f.code))).toEqual([]);
  });

  it("describes its home as data", () => {
    expect(describeApp(compiled())).toContain("Its home is drawn from 10 blocks");
  });

  it("goes back to a document with its home intact", () => {
    const { document } = toDocument(compiled());
    expect((document.views as Record<string, unknown>)["home"]).toEqual(lifelogics.views.home);
  });
});

describe("FR-81: a home view from the closed block set", () => {
  it("accepts a headline, a figure with a formatter and a list with sort, limit, group, empty and as", () => {
    expect(
      errors(
        withHome([
          { headline: "{count(all('offer')) | words} offers" },
          { figure: "sum(all('offer'), net)", as: "money", currency: "EUR", label: "In all" },
          { figure: "count(all('signal'))", as: "number" },
          { figure: "0.3", as: "percent" },
          { list: "all('offer')", sort: { by: "net", direction: "desc" }, limit: 3, as: "row" },
          { list: "all('package')", sort: { by: "standing", direction: "choices" }, as: "card" },
          { list: "all('signal')", group: "type", empty: "Nothing heard yet." },
        ]),
      ),
    ).toEqual([]);
  });

  it("says, at its path, what the home cannot name: there is no one record it is about", () => {
    const found = errors(withHome([{ headline: "{name}" }]));
    expect(found.map((f) => [f.code, f.path])).toEqual([["view-name", "views.home.0.headline"]]);
    expect(found[0]!.message).toMatch(/about no one record/);
  });

  it("refuses a figure formatter, a currency, a sort, a group and a limit it does not know, each at its path", () => {
    const found = errors(
      withHome([
        { figure: "count(all('offer'))", as: "dollars" },
        { figure: "count(all('offer'))", as: "money", currency: "dollars" },
        { list: "all('offer')", sort: { by: "net", direction: "up" } },
        { list: "all('offer')", sort: { by: "net", direction: "choices" } },
        { list: "all('offer')", group: "name" },
        { list: "all('offer')", group: "colour" },
        { list: "all('offer')", limit: 0 },
        { list: "all('offer')", as: "tile" },
        { list: "all('offer')", sort: "colour" },
      ]),
    );
    expect(found.map((f) => [f.code, f.path])).toEqual([
      ["view-format", "views.home.0.as"],
      ["view-currency", "views.home.1.currency"],
      ["list-sort", "views.home.2.sort.direction"],
      ["list-sort", "views.home.3.sort.by"],
      ["list-group", "views.home.4.group"],
      ["list-group", "views.home.5.group"],
      ["list-limit", "views.home.6.limit"],
      ["list-as", "views.home.7.as"],
      ["view-name", "views.home.8.sort"],
    ]);
  });

  it("keeps a figure: true as the kind's picture, as before", () => {
    expect(errors(withViews({ offer: { card: [{ title: "{name}" }, { figure: true }] } })).map((f) => f.code)).toEqual(["view-figure"]);
  });

  it("still reads views.home as a kind's views when a kind is called home", () => {
    const doc = {
      format: "graview-document",
      formatVersion: 1,
      name: "Houses",
      kinds: { home: { fields: { name: { type: "string", required: true } } } },
      views: { home: { card: [{ title: "{name}" }] } },
    };
    const app = compiled(doc);
    expect(app.home).toBeUndefined();
    expect(app.viewSpecs?.["home"]?.card).toEqual([{ title: "{name}" }]);
  });

  it("is held to the same words in a TypeScript declaration", () => {
    const offer = defineNode("offer", { fields: z.object({ name: z.string(), stage: z.enum(["start", "later"]) }) });
    const schema = createSchema([offer]);
    const app = defineApp({ name: "Offers", schema, home: [{ headline: "{count(all('offer'))} offers" }, { list: "all('offer')", group: "stage" }, { headline: "{name}" }] });
    expect(validateViewSpecs(schema, undefined, { home: app.home }).map((f) => [f.code, f.path])).toEqual([["view-name", "home.2.headline"]]);
    expect(checkApp(app).findings.filter((f) => f.code === "view-name").map((f) => f.where)).toEqual(["home.2.headline"]);
  });
});

describe("FR-82: a view can list related records", () => {
  it("accepts a walk as a list's source in a card, a row and a page", () => {
    expect(
      errors(
        withViews({
          package: { card: [{ list: "out('includes')", as: "row" }], row: [{ list: "out('includes')" }], page: [{ list: "out('includes')", sort: { by: "net", direction: "desc" } }] },
          signal: { row: [{ list: "in('answers')", as: "row" }] },
        }),
      ),
    ).toEqual([]);
  });

  it("holds a walked list's sort and group to the kind it reaches", () => {
    const found = errors(withViews({ package: { page: [{ list: "out('includes')", group: "standing" }] } }));
    expect(found.map((f) => [f.code, f.path])).toEqual([["list-group", "views.package.page.0.group"]]);
    expect(found[0]!.message).toMatch(/offer/);
  });

  it("refuses a walk along a relation no kind declares", () => {
    expect(errors(withViews({ package: { page: [{ list: "out('contains')" }] } })).map((f) => f.code)).toEqual(["view-edge"]);
  });
});

describe("a blocks lens is a place drawn from blocks", () => {
  it("does not draw without a kind to stand on, or without blocks, and says why", () => {
    const doc = {
      ...lifelogics,
      lenses: [
        { name: "blocks", title: "Nowhere", options: { blocks: [{ text: "hi" }] } },
        { name: "blocks", title: "Empty", on: "offer" },
      ],
    };
    const { drawn, undrawn, findings } = declaredLenses(compiled(doc));
    expect(drawn).toEqual([]);
    expect(undrawn.map((lens) => lens.title)).toEqual(["Nowhere", "Empty"]);
    expect(findings.map((f) => f.path)).toEqual(["lenses.0.on", "lenses.1.options.blocks"]);
  });

  it("holds its blocks to the vocabulary, at their path — as warnings, since a lens called blocks compiled before it drew", () => {
    const doc = { ...lifelogics, lenses: [{ name: "blocks", title: "Bad", on: "offer", options: { blocks: [{ headline: "{name}" }, { sparkle: true }] } }] };
    expect(errors(doc)).toEqual([]);
    expect(compile(doc).findings.filter((f) => f.path.startsWith("lenses.")).map((f) => [f.code, f.path])).toEqual([
      ["view-name", "lenses.0.options.blocks.0.headline"],
      ["view-block", "lenses.0.options.blocks.1"],
    ]);
  });
});

describe("FR-83's gap: a kind's glance, label and describe may name a computed field", () => {
  it("compiles a glance and a describe that name one, and says it", () => {
    const app = compiled();
    const offer = app.schema.tryDefinition("offer") as unknown as { display: { glance: string[] }; describe: (node: unknown) => string };
    expect(offer.display.glance).toContain("netEach");
    expect(offer.describe({ id: "o", kind: "offer", summary: "Two days.", list: 12_000, units: 2 })).toBe("Two days. 24,000 at list.");
  });

  it("refuses a label that names a computed field worked out from beyond the record: a label has no graph to read", () => {
    const doc = structuredClone(lifelogics);
    doc.kinds.offer.label = "{name} · {net | money}";
    const found = errors(doc);
    expect(found.map((f) => [f.code, f.path])).toEqual([["template-field", "kinds.offer.label"]]);
    expect(found[0]!.message).toMatch(/beyond the record/);
  });

  it("refuses a glance naming neither a field nor a computed field", () => {
    const doc = structuredClone(lifelogics);
    doc.kinds.offer.glance = ["mode", "colour"];
    expect(errors(doc).map((f) => f.code)).toEqual(["glance-field"]);
  });
});
