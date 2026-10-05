import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beginning, Graph, hueFor, sceneDistricts, Store, type GraviewApp } from "@graview/core";
import { compileDocumentWithoutCheck, sceneThumbnail, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { EMPTY_VIEW, kindCardId, layout } from "../../src/index.js";

/*
 * FR-74. A thumbnail drawn without a browser is the Scene's own city: the
 * districts the layout places from altitude — the same plots, walked in the
 * same order — in the hue the Scene's ground paints them. Asked here, of the
 * layout function the Scene runs, with the order computed the way the
 * Scene's root computes it (`scene-root.tsx`: `beginning` over the store's
 * own acts).
 */
const fixture = (name: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures", name), "utf8")) as GraviewDocument;
const templates = resolve(import.meta.dirname, "../../../studio/tests/fixtures/templates");
const template = (name: string) => {
  const raw = JSON.parse(readFileSync(resolve(templates, name), "utf8")) as { document?: GraviewDocument } & GraviewDocument;
  return raw.document ?? raw;
};

function compiled(document: GraviewDocument): GraviewApp {
  const result = compileDocumentWithoutCheck(document);
  if (!result.ok) throw new Error(result.findings.map((f) => f.message).join("; "));
  return result.app;
}

/** The order the Scene walks the map in, computed as its root computes it. */
function sceneOrder(app: GraviewApp): string[] {
  const store = new Store({ schema: app.schema, mutations: [...(app.mutations ?? [])] });
  return beginning({ name: "scene", schema: store.schema, mutations: store.allMutations().filter((mutation) => !mutation.derived) }).order.map((entry) => entry.kind);
}

/** A graph with `counts` of each kind, so the layout's districts have populations. */
function populated(app: GraviewApp, counts: Record<string, number>): Graph<never> {
  const nodes = Object.entries(counts).flatMap(([kind, n]) => Array.from({ length: n }, (_, i) => ({ id: `${kind}-${i}`, kind, label: `${kind} ${i}` })));
  return Graph.from(app.schema as never, { nodes: nodes as never, edges: [] }) as never;
}

const cases: [string, GraviewDocument, Record<string, number>][] = [
  ["the wedding vendors", fixture("vendors.gdd.json"), { vendor: 5, category: 2 }],
  ["household chores", template("household-chores.gdd.json"), {}],
  ["a renovation", template("renovation.gdd.json"), {}],
  ["a job search", template("job-search.gdd.json"), {}],
];

describe("a thumbnail is the Scene's city", () => {
  for (const [name, document, someCounts] of cases) {
    it(`puts every district of ${name} on the plot the layout gives it, in the Scene's order`, () => {
      const app = compiled(document);
      const kinds = app.schema.kinds as readonly string[];
      const counts = Object.keys(someCounts).length > 0 ? someCounts : Object.fromEntries(kinds.map((kind, i) => [kind, [3, 0, 7, 1][i % 4]!]));
      const placed = layout(populated(app, counts), app.schema as never, { ...EMPTY_VIEW, overview: true }, { width: 1280, height: 800, cityOrder: sceneOrder(app) });
      const districts = sceneDistricts(app, { counts });
      expect(districts.map((d) => d.kind)).toEqual(sceneOrder(app));
      for (const district of districts) {
        const card = placed.nodes.find((node) => node.id === kindCardId(district.kind));
        expect(card?.plot, district.kind).toEqual(district.plot);
      }
      // And the picture draws them in that order, each in the hue the Scene's ground paints it.
      const svg = sceneThumbnail(app, { counts });
      expect([...svg.matchAll(/data-kind="([^"]+)"/g)].map((m) => m[1])).toEqual(districts.map((d) => d.kind));
      for (const district of districts) expect(district.hue).toBe(Math.round(hueFor(district.kind, app.brand?.accents)));
    });
  }

  it("follows a brand's declared accents for a kind's hue, as the Scene's plots do", () => {
    const app = compiled(fixture("vendors.gdd.json"));
    const branded: GraviewApp = { ...app, brand: { name: "Vendors", schemes: app.brand?.schemes ?? ({} as never), accents: { vendor: 30 } } };
    const hues = Object.fromEntries(sceneDistricts(branded).map((d) => [d.kind, d.hue]));
    expect(hues["vendor"]).toBe(30);
    expect(hues["category"]).toBe(Math.round(hueFor("category")));
  });
});
