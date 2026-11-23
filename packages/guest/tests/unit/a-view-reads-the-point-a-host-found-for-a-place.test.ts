import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import type { GraviewDocument } from "@graview/core/document";
import "@graview/core/field-sight";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * A VIEW READS THE POINT A HOST FOUND FOR A PLACE (Graview HQ
 * feature:f-map-lens). A host that geocodes keeps the point beside the
 * place's words, `whereGeo: { lat, lng }`; a worker view is handed it on
 * the record as it is handed every field, so a view of its own can place
 * a trip — and a seat whose sight hides the place is handed neither.
 */
const trips = {
  format: "graview-document",
  formatVersion: 1,
  name: "Field trips",
  kinds: {
    trip: { noun: "trip", plural: "trips", label: "{name}", fields: { name: { type: "string", required: true }, where: { type: "place" } } },
  },
  acts: { "add-trip": { title: "Plan a trip", creates: "trip" } },
  roles: ["teacher", "parent"],
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["teacher"], kinds: ["trip"] },
      { roles: ["parent"], kinds: ["trip"], hide: ["where"] },
    ],
  },
} as unknown as GraviewDocument;

const teacher: Principal = { kind: "human", id: "u:tess", roles: ["teacher"] };
const parent: Principal = { kind: "human", id: "u:pat", roles: ["parent"] };

function opened(): Store<AnySchema> {
  const compiled = compileDocument(trips);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "trip:kew", kind: "trip", name: "Kew Gardens", where: "Kew Gardens", whereGeo: { lat: 51.4787, lng: -0.2956 } },
        { id: "trip:farm", kind: "trip", name: "Mudchute Farm", where: "Mudchute Farm" },
      ] as never,
      edges: [],
    },
  });
}

const view: WorkerViewManifest = { name: "where-trips-go", attach: "trip", cardinality: "many" };

describe("a worker view over a place the host found a point for", () => {
  it("is handed the point beside the place's words, as the host kept it", () => {
    const props = workerViewProps(opened(), teacher, { manifest: view });
    expect(props.nodes!.find((one) => one.id === "trip:kew")).toMatchObject({ where: "Kew Gardens", whereGeo: { lat: 51.4787, lng: -0.2956 } });
    expect(props.nodes!.find((one) => one.id === "trip:farm")).not.toHaveProperty("whereGeo");
  });

  it("draws from it when run, and a seat kept from the place is handed no point of it", async () => {
    const source =
      "graview.onProps((p) => graview.render(graview.html`<ul>${p.nodes.map((t) => graview.html`<li>${t.name}: ${t.whereGeo ? `${t.whereGeo.lat}, ${t.whereGeo.lng}` : 'no point'}</li>`)}</ul>`));";
    const run = nodeIsolate();
    const asTeacher = await runWorkerViewHeadless({ store: opened(), principal: teacher, run, manifest: view, source });
    const asParent = await runWorkerViewHeadless({ store: opened(), principal: parent, run, manifest: view, source });
    if (!asTeacher.ok || !asParent.ok) throw new Error(JSON.stringify([asTeacher, asParent]));
    expect(asTeacher.description.text).toContain("Kew Gardens: 51.4787, -0.2956");
    expect(asTeacher.description.text).toContain("Mudchute Farm: no point");
    expect(asParent.description.text).toContain("Kew Gardens: no point");
    expect(JSON.stringify(asParent)).not.toContain("51.4787");
  });
});
