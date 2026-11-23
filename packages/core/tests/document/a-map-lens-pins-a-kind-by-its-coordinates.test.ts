import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import "../../src/field-sight.js";
import { compileDocument } from "../../src/check.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { z } from "zod";
import { geoOf } from "../../src/describe.js";
import { createSchema, declaredLenses, defineNode, placeField, placeGeoField, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { describePlace } from "../../src/document/describe-place.js";
import { toJsonSchema } from "../../src/json-schema.js";
import { askedFormFields } from "../../src/forms.js";

/**
 * A MAP LENS PINS A KIND BY ITS COORDINATES (Graview HQ feature:f-map-lens).
 * An app had nineteen field trips with a place field and could only list
 * them. A map is now one of the shipped lenses: bound to a place field,
 * whose point the host keeps beside it (`whereGeo: { lat, lng }`), or to a
 * latitude and a longitude; `graview check` and `add-lens` refuse one over a
 * kind with no coordinates, in the words the other lens refusals use; and
 * the point is kept on the record, served only to who may see the place.
 */
const trips = JSON.parse(readFileSync(new URL("./fixtures/field-trips.gdd.json", import.meta.url), "utf8")) as GraviewDocument & { lenses: Record<string, unknown>[] };
const seed = JSON.parse(readFileSync(new URL("./fixtures/field-trips.seed.json", import.meta.url), "utf8")) as { nodes: Record<string, unknown>[]; edges: [] };
const { lenses: _lenses, ...bare } = trips;

const compiled = (document: GraviewDocument) => {
  const result = compileDocument(document, { today: () => "2026-10-01" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  return result;
};

describe("a declared map", () => {
  it("draws over a place field, and over a latitude and a longitude, each pinned by what its bindings name", () => {
    const { app } = compiled(trips);
    expect(declaredLenses(app).drawn.map((one) => [one.lens, one.as, one.options["bindings"]])).toEqual([
      ["map", "where-we-go", { trip: { place: "where" } }],
      ["map", "coach-stops", { stop: { lat: "latitude", lng: "longitude" } }],
    ]);
  });

  it("pins by the kind's place field when its bindings name nothing, and never guesses at numbers", () => {
    const document = {
      ...bare,
      lenses: [
        { name: "map", title: "Trips", bindings: { trip: {} } },
        { name: "map", title: "Stops", bindings: { stop: {} } },
      ],
    } as unknown as GraviewDocument;
    const result = compiled(document);
    expect(declaredLenses(result.app).drawn.map((one) => one.options["bindings"])).toEqual([{ trip: { place: "where" } }]);
    expect(result.findings.find((one) => one.code.endsWith("lens-no-coordinates"))).toMatchObject({ path: "lenses.1.bindings.stop" });
  });
});

describe("graview check, of a map over a kind with no coordinates", () => {
  it("says it cannot draw, at the kind's binding, in the code add-lens refuses it under", () => {
    const result = compiled({ ...bare, lenses: [{ name: "map", title: "Who leads", bindings: { teacher: {} } }] } as unknown as GraviewDocument);
    const finding = result.findings.find((one) => one.code.endsWith("lens-no-coordinates"));
    expect(finding).toMatchObject({ path: "lenses.0.bindings.teacher" });
    expect(finding?.message).toContain('"Who leads" cannot draw: teacher has no coordinates');
    expect(finding?.fix).toContain('"type": "place"');
    expect(finding?.fix).toContain('"lat": "<a number field>", "lng": "<a number field>"');
    expect(declaredLenses(result.app).drawn).toEqual([]);
    expect(declaredLenses(result.app).undrawn[0]).toMatchObject({ title: "Who leads", why: expect.stringContaining("nothing to pin teacher by") });
  });

  it("says a latitude that is not a number cannot pin anything", () => {
    const result = compiled({ ...bare, lenses: [{ name: "map", title: "Trips", bindings: { trip: { lat: "name", lng: "name" } } }] } as unknown as GraviewDocument);
    expect(result.findings.find((one) => one.code.endsWith("lens-cannot-draw"))).toMatchObject({ path: "lenses.0.bindings.trip.lat" });
  });
});

describe("add-lens with a map", () => {
  it("refuses one over a kind with no coordinates, naming the place field a host finds a point for", () => {
    const refused = editDocument(bare as GraviewDocument, [{ op: "add-lens", title: "Who leads", lens: "map", bindings: { teacher: {} } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings).toHaveLength(1);
    expect(refused.findings[0]).toMatchObject({ severity: "error", code: "lens-no-coordinates", path: "edits.0.bindings.teacher" });
    expect(refused.findings[0]!.message).toContain("a map here would not draw: teacher has no coordinates");
  });

  it("refuses one bound to a place that is not a place field", () => {
    const refused = editDocument(bare as GraviewDocument, [{ op: "add-lens", title: "Trips", lens: "map", bindings: { trip: { place: "name" } } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings[0]).toMatchObject({ code: "lens-cannot-draw", path: "edits.0.bindings.trip.place" });
  });

  it("accepts one over a place field, and it draws as a place", () => {
    const added = editDocument(bare as GraviewDocument, [{ op: "add-lens", title: "Where we go", lens: "map", bindings: { trip: { place: "where" } } }]);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(declaredLenses(compiled(added.document).app).drawn.map((one) => [one.lens, one.as])).toEqual([["map", "where-we-go"]]);
  });
});

const opened = (document: GraviewDocument) => {
  const app = compiled(document).app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: seed as never });
};

describe("a place's point, kept beside it", () => {
  it("is kept on the record as the host wrote it, and read back as a point", () => {
    const store = opened(trips);
    expect(geoOf(store.graph.getNode("trip-museum"), "where")).toEqual({ lat: 51.4967, lng: -0.1764 });
    expect(geoOf(store.graph.getNode("trip-farm"), "where")).toBeUndefined();
  });

  it("is written by the host through the kind's own edit, and asked for by no form", () => {
    const store = opened(trips);
    const edit = store.mutation("edit-trip");
    expect(askedFormFields(store.schema, edit).map((field) => field.name)).not.toContain("whereGeo");
    store.apply({ name: "edit-trip", args: { id: "trip-farm", whereGeo: { lat: 51.4905, lng: -0.0119 } } });
    expect(geoOf(store.graph.getNode("trip-farm"), "where")).toEqual({ lat: 51.4905, lng: -0.0119 });
    expect(() => store.apply({ name: "edit-trip", args: { id: "trip-farm", whereGeo: { lat: 151, lng: 0 } } })).toThrow();
  });

  it("is a field of the kind that holds a point in range and nothing else", () => {
    const shape = compiled(trips).app.schema.tryDefinition("trip")!.fields.shape as Record<string, { "~standard": { validate(value: unknown): { issues?: unknown } } }>;
    const holds = (value: unknown) => shape["whereGeo"]!["~standard"].validate(value).issues === undefined;
    expect(holds({ lat: 51.5, lng: -0.12 })).toBe(true);
    expect(holds(undefined)).toBe(true);
    expect(holds(null)).toBe(true);
    expect(holds({ lat: 151.5, lng: -0.12 })).toBe(false);
    expect(holds({ lat: 51.5 })).toBe(false);
    expect(holds({ lat: 51.5, lng: -0.12, zoom: 3 })).toBe(false);
  });

  it("is said to a tool's caller as a point", () => {
    const json = toJsonSchema(compiled(trips).app.schema.tryDefinition("trip")!.fields) as { properties: Record<string, Record<string, unknown>> };
    expect(json.properties["whereGeo"]).toMatchObject({ type: "object", required: ["lat", "lng"], properties: { lat: { minimum: -90, maximum: 90 } } });
  });

  it("is served only to who may see the place", () => {
    const sighted = {
      ...trips,
      roles: ["teacher", "parent"],
      policy: {
        grants: [{ roles: "*", mutations: "*" }],
        sees: [
          { roles: ["teacher"], kinds: ["trip", "stop", "teacher"] },
          { roles: ["parent"], kinds: ["trip"], hide: ["where"] },
          { roles: ["guest"], kinds: ["trip"], fields: ["name", "where"] },
        ],
      },
    } as unknown as GraviewDocument;
    const store = opened({ ...sighted, roles: ["teacher", "parent", "guest"] } as GraviewDocument);
    const seat = (role: string): Principal => ({ kind: "human", id: `u:${role}`, roles: [role] });
    expect(store.seenBy(seat("teacher")).graph.getNode("trip-museum")).toMatchObject({ whereGeo: { lat: 51.4967, lng: -0.1764 } });
    expect(store.seenBy(seat("parent")).graph.getNode("trip-museum")).not.toHaveProperty("whereGeo");
    expect(store.seenBy(seat("parent")).graph.getNode("trip-museum")).not.toHaveProperty("where");
    // A sight that lists the place lists its point with it.
    expect(store.seenBy(seat("guest")).graph.getNode("trip-museum")).toMatchObject({ where: "Natural History Museum, London", whereGeo: { lat: 51.4967, lng: -0.1764 } });
  });

  it("is hidden by a sight that hides the place in a declaration written in code too, and listed by one that lists it", () => {
    const trip = defineNode("trip", { fields: z.object({ name: z.string(), where: placeField().optional(), whereGeo: placeGeoField() }) });
    const schema = createSchema([trip]);
    const store = new Store({
      schema,
      mutations: [],
      policy: {
        roles: ["teacher", "parent", "guest"],
        grants: [],
        sees: [
          { roles: ["teacher"], kinds: ["trip"] },
          { roles: ["parent"], kinds: ["trip"], hide: ["where"] },
          { roles: ["guest"], kinds: ["trip"], fields: ["name", "where"] },
        ],
      } as never,
      snapshot: { nodes: [{ id: "trip-kew", kind: "trip", name: "Kew Gardens", where: "Kew Gardens", whereGeo: { lat: 51.4787, lng: -0.2956 } }] as never, edges: [] },
    });
    const seat = (role: string): Principal => ({ kind: "human", id: `u:${role}`, roles: [role] });
    expect(store.seenBy(seat("teacher")).graph.getNode("trip-kew")).toMatchObject({ whereGeo: { lat: 51.4787, lng: -0.2956 } });
    expect(store.seenBy(seat("parent")).graph.getNode("trip-kew")).not.toHaveProperty("whereGeo");
    expect(store.seenBy(seat("guest")).graph.getNode("trip-kew")).toMatchObject({ whereGeo: { lat: 51.4787, lng: -0.2956 } });
  });

  it("is what a map's place says to an agent: the trips it pins, and how many have no place yet", () => {
    const store = opened(trips);
    const said = JSON.stringify(describePlace(store, { kind: "human", id: "u:t", roles: [] }, "/places/where-we-go", { app: compiled(trips).app as never }));
    expect(said).toContain("A map of 5 trips; 2 trips have no place yet.");
    expect(said).toContain("Kew Gardens");
    expect(said).not.toContain("Summer outing");
  });

  it("cannot share its name with a field of the kind", () => {
    const clash = compileDocument({ ...bare, kinds: { ...bare.kinds, trip: { ...bare.kinds["trip"]!, fields: { ...bare.kinds["trip"]!.fields, whereGeo: { type: "string" } } } } } as unknown as GraviewDocument);
    expect(clash.ok).toBe(false);
    expect(clash.findings.find((one) => one.code.endsWith("geo-clash"))).toMatchObject({ path: "kinds.trip.fields.where" });
  });
});
