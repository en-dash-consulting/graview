import { createSchema, defineApp, defineNode, durationField, isPlacePoint, phoneField, placeField, placeGeoField } from "@graview/core";
import { typedFieldOf } from "@graview/core/words";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio, declarationToGraph, FIELD_TYPES, zodFor } from "../../src/index.js";

/*
 * THE STUDIO KEEPS A PHONE, A PLACE AND A DURATION. Its field types are the
 * document's, so it offers all three; a type it had no case for was declared
 * and written back as a plain string, and the field then drew as words — no
 * tel: link, no map, minutes said as a bare number.
 */
const rehearsal = defineNode("rehearsal", {
  fields: z.object({ label: z.string(), contact: phoneField().optional(), venue: placeField().optional(), length: durationField() }),
  label: (node) => node.label,
});
const app = defineApp({ name: "Rehearsals", schema: createSchema([rehearsal]) });
const shapeOf = (declared: typeof app) => (declared.schema.definition("rehearsal").fields as unknown as { shape: Record<string, unknown> }).shape;

describe("the studio's phone, place and duration", () => {
  it("are offered, and read from a declaration as what they are", () => {
    for (const type of ["phone", "place", "duration"]) expect(FIELD_TYPES).toContain(type);
    const fields = declarationToGraph(app).nodes.filter((node) => node.kind === "field");
    expect(fields.find((node) => node.id === "field:rehearsal.contact")).toMatchObject({ type: "phone", required: false });
    expect(fields.find((node) => node.id === "field:rehearsal.venue")).toMatchObject({ type: "place", required: false });
    expect(fields.find((node) => node.id === "field:rehearsal.length")).toMatchObject({ type: "duration", required: true });
  });

  it("are declared with the framework's own fields, which validate as theirs do", () => {
    expect(typedFieldOf(zodFor("phone", true))).toBe("phone");
    expect(zodFor("phone", true).safeParse("call me").success).toBe(false);
    expect(typedFieldOf(zodFor("place", false))).toBe("place");
    expect(typedFieldOf(zodFor("duration", true))).toBe("duration");
    expect(zodFor("duration", true).safeParse(1.5).success).toBe(false);
  });

  it("are written back as phoneField(), placeField() and durationField(), imported, and declared as them again", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-field", args: { kind: "declared:rehearsal", label: "mobile", type: "phone", required: false } } as never);
    studio.store.apply({ name: "add-field", args: { kind: "declared:rehearsal", label: "hall", type: "place", required: false } } as never);
    studio.store.apply({ name: "add-field", args: { kind: "declared:rehearsal", label: "warmup", type: "duration", required: false } } as never);
    const files = studio.files({ schemaVar: "schema" }) as readonly { path: string; contents: string }[];
    const schemaTs = files.find((file) => file.path.endsWith("schema.ts"))!.contents;
    for (const line of ["contact: phoneField().optional(),", "venue: placeField().optional(),", "length: durationField(),", "mobile: phoneField().optional(),", "hall: placeField().optional(),", "warmup: durationField().optional(),"]) expect(schemaTs).toContain(line);
    expect(schemaTs).toMatch(/^import \{ [^}]*durationField, [^}]*phoneField, placeField, [^}]*\} from "@graview\/core";/m);
    const shape = shapeOf(studio.declaration() as typeof app);
    expect([shape["mobile"], shape["hall"], shape["warmup"], shape["contact"], shape["length"]].map(typedFieldOf)).toEqual(["phone", "place", "duration", "phone", "duration"]);
  });

  it("keep a place's point beside it (`<place>Geo`) through the studio and back, never as a field of its own", () => {
    const pointed = defineApp({ name: "Rehearsals", schema: createSchema([defineNode("rehearsal", { fields: z.object({ label: z.string(), venue: placeField().optional(), venueGeo: placeGeoField() }), label: (node) => node.label })]) });
    expect(declarationToGraph(pointed).nodes.some((node) => node.id === "field:rehearsal.venueGeo")).toBe(false);
    const studio = createStudio(pointed);
    studio.store.apply({ name: "add-field", args: { kind: "declared:rehearsal", label: "hall", type: "place", required: false } } as never);
    const schemaTs = (studio.files({ schemaVar: "schema" }) as readonly { path: string; contents: string }[]).find((file) => file.path.endsWith("schema.ts"))!.contents;
    for (const line of ["venueGeo: placeGeoField(),", "hallGeo: placeGeoField(),"]) expect(schemaTs).toContain(line);
    expect(schemaTs).toMatch(/^import \{ [^}]*placeGeoField, [^}]*\} from "@graview\/core";/m);
    const shape = shapeOf(studio.declaration() as typeof app);
    expect(isPlacePoint(shape, "venueGeo") && isPlacePoint(shape, "hallGeo")).toBe(true);
    expect(shape["hallGeo"]).toBeDefined();
  });
});
