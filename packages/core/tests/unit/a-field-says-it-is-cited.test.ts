import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSchema, defineNode, markCites, citedFieldsOf, Store, z, type AnySchema, type GraviewApp } from "@graview/core";
import { checkApp, citesOf, compileDocument, uncitedValues } from "@graview/core/check";
import { editDocument, toDocument } from "@graview/core/document";
import { uncitedIn } from "@graview/core/tidying";
import { afterAll, describe, expect, it, vi } from "vitest";
import { main } from "../../src/cli/index.js";
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
    const said = wrong.findings.filter((f) => f.code === "field-cites");
    expect(said.map((f) => f.severity)).toEqual(["error", "error"]);
    expect(said.map((f) => f.path)).toEqual(["kinds.city.fields.population.cites", "kinds.city.fields.source.cites"]);
    expect(said.map((f) => f.message).join(" ")).toContain('cited by "census", which is no field or relation of city');
    expect(said.map((f) => f.message).join(" ")).toContain("cited by itself");
    expect(compiled.findings.some((f) => f.code.endsWith("field-cites"))).toBe(false);
  });

  it("is refused by the checker of an app declared in code", () => {
    const claim = defineNode("claim", { fields: z.object({ label: z.string(), figure: markCites(z.number().optional(), "sauce") }), label: (node) => node.label });
    const found = checkApp({ name: "Claims", schema: createSchema([claim]) } as never).findings.filter((f) => f.code === "field-cites");
    expect(found).toEqual([expect.objectContaining({ severity: "error", where: 'defineNode("claim").fields.figure' })]);
  });
});

describe("a cited field, edited", () => {
  const doc = compiled.document;
  const fieldsOf = (outcome: ReturnType<typeof editDocument>) => {
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    return outcome.document.kinds["city"]!.fields as Record<string, { cites?: string }>;
  };

  it("follows its citing field and relation when they are renamed", () => {
    const renamed = editDocument(doc, [{ op: "rename-field", kind: "city", field: "source", to: "census" }, { op: "rename-relation", kind: "city", relation: "references", to: "sources" }]);
    expect(fieldsOf(renamed)["population"]?.cites).toBe("census");
    expect(fieldsOf(renamed)["founded"]?.cites).toBe("sources");
    expect(renamed.ok && renamed.said.join(" ")).toContain("city's population citation");
    expect(renamed.ok && compileDocument(renamed.document).ok).toBe(true);
  });

  it("says nothing of what cites it once its citing field or relation is removed, and says so", () => {
    const removed = editDocument(doc, [{ op: "remove-field", kind: "city", field: "source" }, { op: "remove-relation", kind: "city", relation: "references" }]);
    expect(fieldsOf(removed)["population"]?.cites).toBeUndefined();
    expect(fieldsOf(removed)["founded"]?.cites).toBeUndefined();
    expect(removed.ok && removed.said.join(" ")).toContain("city's population citation goes with it");
    expect(removed.ok && compileDocument(removed.document).ok).toBe(true);
  });

  it("is set and unset by set-cites, which refuses a name the kind does not have", () => {
    expect(fieldsOf(editDocument(doc, [{ op: "set-cites", kind: "city", field: "name", cites: "source" }]))["name"]?.cites).toBe("source");
    expect(fieldsOf(editDocument(doc, [{ op: "set-cites", kind: "city", field: "population", cites: null }]))["population"]?.cites).toBeUndefined();
    expect(editDocument(doc, [{ op: "set-cites", kind: "city", field: "population", cites: "census" }]).ok).toBe(false);
    expect(editDocument(doc, [{ op: "set-cites", kind: "city", field: "population", cites: "population" }]).ok).toBe(false);
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

describe("graview check --seed", () => {
  const run = async (args: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (out.push(String(chunk)), true));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => (err.push(String(chunk)), true));
    try {
      return { code: await main(args), out: out.join(""), err: err.join("") };
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  };
  const scratch = mkdtempSync(join(tmpdir(), "graview-check-seed-"));
  const document = join(scratch, "cities.json");
  writeFileSync(document, JSON.stringify(cities));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it("warns of each record holding a cited value with nothing cited, counting no record set aside and no link to one", async () => {
    const seedFile = join(scratch, "seed.json");
    writeFileSync(
      seedFile,
      JSON.stringify({
        nodes: [...seed.nodes, { id: "r2", kind: "reference", name: "A lost book", $archived: true }, { id: "old", kind: "city", name: "Old town", population: 10, $archived: true }],
        edges: [...seed.edges, { id: "e2", kind: "references", from: "lagos", to: "r2" }],
      }),
    );
    const said = await run(["check", document, "--seed", seedFile, "--json"]);
    expect(said.code).toBe(0);
    const findings = (JSON.parse(said.out) as { findings: { code: string; path: string }[] }).findings.filter((f) => f.code === "field-uncited");
    expect(findings.map((f) => f.path)).toEqual([`${seedFile}: nodes.0.population`, `${seedFile}: nodes.0.founded`]);
  });

  it("says a seed it cannot read, and a --seed naming nothing, in words rather than throwing", async () => {
    const missing = await run(["check", document, "--seed", join(scratch, "nowhere.json")]);
    expect(missing.code).toBe(2);
    expect(missing.err).toContain("could not be read: there is no such file");
    const bare = await run(["check", document, "--seed"]);
    expect(bare.code).toBe(2);
    expect(bare.err).toContain("--seed names a snapshot file to read");
  });
});

describe("uncited(…) in the rule language", () => {
  it("says of a record whether a cited value says nowhere where it came from, of one field or of any", () => {
    const ruled = compileDocument({
      ...cities,
      rules: {
        sourced: { title: "Every figure has a source", over: "city", require: "!uncited()", says: "{name} says nowhere where a figure came from" },
        counted: { title: "Every population has a source", over: "city", require: "!uncited('population')", says: "{name}'s population has no source" },
      },
    });
    if (!ruled.ok) throw new Error(JSON.stringify(ruled.findings));
    const store = new Store<AnySchema>({ schema: ruled.app.schema, mutations: (ruled.app.mutations ?? []) as never, invariants: (ruled.app.invariants ?? []) as never, snapshot: { ...seed, nodes: [...seed.nodes, { id: "kano", kind: "city", name: "Kano", source: "https://example.org/kano", founded: "999" }] } as never });
    const broken = store.violations().map((one) => `${one.invariant}:${one.subjectId}`).sort();
    expect(broken).toEqual(["counted:lagos", "sourced:kano", "sourced:lagos"]);
  });
});
