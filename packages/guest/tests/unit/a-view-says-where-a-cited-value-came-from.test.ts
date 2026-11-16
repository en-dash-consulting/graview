import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { citesFor } from "../../src/host/session.js";

/*
 * A VIEW SAYS WHERE A CITED VALUE CAME FROM (Roadmap f-field-cites-marker).
 * A field that declares `cites` names the field or relation holding its
 * citation. A worker view is handed what cites what (`cites`) and which of
 * its records hold a value with nothing cited (`uncited`), judged over the
 * viewer's graph, and reads them with `graview.cite(node, field)` and
 * `graview.uncited(node)`.
 */
const compiled = compileDocument(
  {
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
  },
  { today: () => "2026-11-16" },
);
if (!compiled.ok) throw new Error("the document compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const store = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    snapshot: {
      nodes: [
        { id: "lagos", kind: "city", name: "Lagos", population: 15_000_000, founded: "15th century" },
        { id: "accra", kind: "city", name: "Accra", population: 2_500_000, source: "https://example.org/accra", founded: "1600s" },
        { id: "r1", kind: "reference", name: "A history of Accra" },
      ],
      edges: [{ id: "e1", kind: "references", from: "accra", to: "r1" }],
    } as never,
  });
const reader: Principal = { kind: "human", id: "u:nick", roles: [] };
const cities: WorkerViewManifest = { name: "cities", title: "Cities", attach: "city", cardinality: "many" };

describe("a worker view's props", () => {
  it("carry what cites what and which records hold a value with nothing cited, even where the citing record is not handed", () => {
    const props = workerViewProps(store(), reader, { manifest: cities });
    expect(props.cites).toEqual({ city: { population: { by: "source", relation: false }, founded: { by: "references", relation: true } } });
    expect(props.uncited).toEqual({ lagos: ["population", "founded"] });
  });
});

describe("graview.cite and graview.uncited", () => {
  it("say a cited value's citation, and the fields a record holds uncited", async () => {
    const source = `graview.onProps((props) => graview.render(graview.html\`\${props.nodes.map((city) => {
      const cite = graview.cite(city, "population");
      return graview.html\`<p>\${city.name}: \${cite.cited ? "cited by " + cite.source : "uncited"} · \${graview.uncited(city).join(", ") || "all cited"} · \${String(graview.cite(city, "name"))}</p>\`;
    })}\`));`;
    const result = await runWorkerViewHeadless({ store: store(), principal: reader, run: nodeIsolate(), manifest: cities, source });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.text).toContain("Lagos: uncited · population, founded · undefined");
    expect(result.description.text).toContain("Accra: cited by https://example.org/accra · all cited · undefined");
  });
});

describe("what a seat is told is uncited", () => {
  it("is never a value whose citing field some sight may keep from the seat, and never counts a link to a record set aside", () => {
    const lagos = { id: "lagos", kind: "city", name: "Lagos", population: 15_000_000, founded: "15th century" };
    const keptSource = { roles: ["reader"], kinds: ["city"], hide: ["source"] };
    const out = (id: string, kind?: string) => (id === "lagos" && kind === "references" ? [] : []);
    const told = citesFor({ schema: app.schema, policy: { grants: [], sees: [keptSource] } as never, graph: { out } }, reader, [lagos]);
    expect(told.uncited).toEqual({ lagos: ["founded"] });
    // The app's own actor sees every field: the same value is uncited to it.
    expect(citesFor({ schema: app.schema, policy: { grants: [], sees: [keptSource] } as never, graph: { out } }, { kind: "system", id: "tidying" }, [lagos]).uncited).toEqual({ lagos: ["population", "founded"] });
  });

  it("counts a citation through the viewer's graph, where a record set aside is not linked", () => {
    const at = store().graph.snapshot();
    const live = new Store<AnySchema>({ schema: app.schema, snapshot: { ...at, nodes: at.nodes.map((one) => (one.id === "r1" ? { ...one, $archived: true } : one)) } as never });
    expect(workerViewProps(live, reader, { manifest: cities }).uncited).toEqual({ lagos: ["population", "founded"], accra: ["founded"] });
  });
});
