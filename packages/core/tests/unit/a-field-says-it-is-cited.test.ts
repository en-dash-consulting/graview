import { createSchema, defineNode, markCites, citesOf, citedFieldsOf, Store, z, type AnySchema, type GraviewApp } from "@graview/core";
import { checkApp, compileDocument, uncitedValues } from "@graview/core/check";
import { toDocument } from "@graview/core/document";
import { uncitedIn } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { templateFindings } from "../../src/document/instantiate-template.js";

/*
 * A FIELD SAYS IT IS CITED (Roadmap f-field-cites-marker). A field's
 * declaration names the field or the relation of its kind that holds where
 * its value came from (`cites: "source"`), and from that the checker and
 * the app's own actor say which records hold a value there with nothing
 * cited. A `cites` naming nothing the kind declares is refused.
 */
const cities = {
  format: "graview-document",
  formatVersion: 1,
  name: "Cities",
  kinds: {
    city: {
      fields: {
        name: { type: "string", required: true },
        population: { type: "integer", cites: "source" },
        source: { type: "url" },
        founded: { type: "string", cites: "references" },
      },
      edges: { references: { to: ["reference"] } },
    },
    reference: { fields: { name: { type: "string", required: true } } },
  },
  acts: { "add-city": { title: "Add a city", creates: "city" } },
};

const compiled = compileDocument(cities, { today: () => "2026-11-16" });
if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings)}`);
const app = compiled.app as GraviewApp<AnySchema>;

const seed = {
  nodes: [
    { id: "lagos", kind: "city", name: "Lagos", population: 15_000_000, founded: "15th century" },
    { id: "accra", kind: "city", name: "Accra", population: 2_500_000, source: "https://example.org/accra", founded: "1600s" },
    { id: "abuja", kind: "city", name: "Abuja" },
    { id: "r1", kind: "reference", name: "A history of Accra" },
  ],
  edges: [{ id: "e1", kind: "references", from: "accra", to: "r1" }],
};

describe("a cited field, declared", () => {
  it("says what cites it, from a document and from a defineNode marked in code", () => {
    expect(citesOf(app.schema, "city", "population")).toBe("source");
    expect(citedFieldsOf(app.schema, "city")).toEqual({ population: "source", founded: "references" });
    expect(citesOf(app.schema, "city", "name")).toBeUndefined();
    const claim = defineNode("claim", { fields: z.object({ label: z.string(), figure: markCites(z.number().optional(), "source"), source: z.string().optional() }), label: (node) => node.label });
    expect(citesOf(createSchema([claim]), "claim", "figure")).toBe("source");
  });

  it("is written back into the document it came from", () => {
    expect(toDocument(app).document.kinds["city"]?.fields["population"]).toMatchObject({ type: "integer", cites: "source" });
  });

  it("is refused where it names no field or relation of its kind, or itself", () => {
    const wrong = compileDocument({ ...cities, kinds: { ...cities.kinds, city: { ...cities.kinds.city, fields: { ...cities.kinds.city.fields, population: { type: "integer", cites: "census" }, source: { type: "url", cites: "source" } } } } });
    expect(wrong.ok).toBe(false);
    const said = wrong.findings.filter((f) => f.code === "check:field-cites");
    expect(said.map((f) => f.severity)).toEqual(["error", "error"]);
    expect(said.map((f) => f.message).join(" ")).toContain('cited by "census", which is no field or relation of city');
    expect(said.map((f) => f.message).join(" ")).toContain("cited by itself");
    expect(compiled.findings.some((f) => f.code === "check:field-cites")).toBe(false);
  });

  it("is refused by the checker of an app declared in code", () => {
    const claim = defineNode("claim", { fields: z.object({ label: z.string(), figure: markCites(z.number().optional(), "sauce") }), label: (node) => node.label });
    const found = checkApp({ name: "Claims", schema: createSchema([claim]) } as never).findings.filter((f) => f.code === "field-cites");
    expect(found).toEqual([expect.objectContaining({ severity: "error", where: 'defineNode("claim").fields.figure' })]);
  });
});

describe("a record holding a cited value with nothing cited", () => {
  it("is said by the app's own actor of what it keeps, by field and by relation, and an empty value is no claim", () => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: seed as never });
    const uncited = uncitedIn(store);
    expect(uncited.map(({ record, field, cites, relation }) => ({ record, field, cites, relation }))).toEqual([
      { record: "lagos", field: "population", cites: "source", relation: false },
      { record: "lagos", field: "founded", cites: "references", relation: true },
    ]);
    expect(uncited[0]!.words).toBe("Lagos's population cites no source");
  });

  it("is a warning the checker says of a seed and of a template's examples", () => {
    expect(uncitedValues(app.schema, seed.nodes as never, (id, relation) => seed.edges.filter((edge) => edge.from === id && edge.kind === relation).length).map((one) => one.record)).toEqual(["lagos", "lagos"]);
    const template = {
      format: "graview-template",
      formatVersion: 1,
      id: "cities",
      version: 1,
      title: "Cities",
      pitch: "Cities and where their figures came from.",
      useCases: [],
      document: cities,
      seed: { nodes: seed.nodes, edges: seed.edges.map(({ kind, from, to }) => ({ kind, from, to })) },
      questions: [],
      setup: [],
      readme: "Cities.",
      screenshots: [],
      author: { workspace: "w", name: "A" },
      remixedFrom: null,
      license: "MIT",
    };
    const found = templateFindings(template).filter((f) => f.code === "field-uncited");
    expect(found.map((f) => [f.severity, f.path])).toEqual([
      ["warning", "seed.nodes.0.population"],
      ["warning", "seed.nodes.0.founded"],
    ]);
    expect(found[0]!.message).toContain("Lagos's population cites no source");
  });
});
