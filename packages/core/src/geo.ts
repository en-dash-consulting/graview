import * as z from "./schema/zod.js";
import { typedFieldOf } from "./schema/typed-field-of.js";

/*
 * WHERE A PLACE IS, AS THE HOST FOUND IT (Graview HQ feature:f-map-lens).
 *
 * A place field holds words — an address, a museum's name — as a person
 * typed them, and the framework never looks them up. A host that does (a
 * geocoder of its own, a picker that knows the point) keeps what it found
 * beside the words, under the field's name and `Geo`:
 *
 *   { "where": "Science Museum, London", "whereGeo": { "lat": 51.4978, "lng": -0.1745 } }
 *
 * The words stay the place: every list, label, search and view that read
 * them reads them unchanged. The point is what a map lens pins and what a
 * worker view may read (`node.whereGeo.lat`). A record whose place has no
 * point is not drawn at a guess; the map says how many it has no place for.
 *
 * A document's place field takes its `Geo` beside it with no word of its
 * own; a declaration in code says `whereGeo: placeGeoField()`. Who may see
 * the place sees its point, and no one else (`place-points.ts`).
 */

/** A point on the earth: degrees of latitude (−90 to 90) and longitude (−180 to 180). */
export interface Geo {
  readonly lat: number;
  readonly lng: number;
}

/** Where a place field's point is kept: beside it, under its name and `Geo`. */
export const geoKey = (field: string): string => `${field}Geo`;

/** The place field a point's key is kept beside: `whereGeo` → `where`. */
export const geoOfField = (key: string): string | undefined => (key.endsWith("Geo") && key.length > 3 ? key.slice(0, -3) : undefined);

/** Whether a value is a point a record may keep: a latitude and a longitude in range, and nothing else. */
export const validGeo = (value: unknown): value is Geo => {
  const point = value as Geo | null | undefined;
  return typeof point?.lat === "number" && typeof point.lng === "number" && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 && Object.keys(point).length === 2;
};

/**
 * WHETHER A FIELD OF A SHAPE IS A PLACE'S POINT: named for a place field of
 * the same shape, with `Geo`. Read by name and the place beside it, so a
 * page that never writes one carries no mark to tell it by.
 */
export const isPlacePoint = (shape: Readonly<Record<string, unknown>>, key: string): boolean => {
  const place = geoOfField(key);
  return place !== undefined && Object.hasOwn(shape, place) && typedFieldOf(shape[place]) === "place";
};

/** A place's point as a field's schema, or none (null) once the host takes it back: a latitude and a longitude in range, and nothing else. */
/** The mark a point's schema carries, for the tool-schema writer (`schema/json-schema.ts`) alone: a form and a sight know a point by its name (`isPlacePoint`). */
export const GEO_MARK = Symbol.for("@graview/core:geo");

export const geoSchema = (): z.ZodMiniType<Geo | null> => {
  const schema = z.unknown().check(z.refine((value) => value === null || validGeo(value), "a point { lat, lng }, or null"));
  (z.defOf(schema) as unknown as Record<symbol, 1>)[GEO_MARK] = 1;
  return schema as never;
};

