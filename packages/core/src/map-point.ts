import { geoKey, validGeo, type Geo } from "./geo.js";

/*
 * A RECORD'S POINT, AS A MAP READS IT (Graview HQ feature:f-map-lens). Apart
 * from `./geo.ts`, whose keys and checks a page builds every app with: only
 * what draws or says a map reads these.
 */

/** A record's point for one place field, where the host kept one; undefined otherwise. */
export const geoOf = (node: unknown, field: string): Geo | undefined => {
  const value = (node as Record<string, unknown> | null | undefined)?.[geoKey(field)];
  return validGeo(value) ? value : undefined;
};

/** A record's point by what a map pins its kind by: the point kept beside its place, or its latitude and longitude in range. */
export function mapPointOf(node: unknown, coordinates: { readonly place: string } | { readonly lat: string; readonly lng: string } | undefined): Geo | undefined {
  if (!coordinates) return undefined;
  if ("place" in coordinates) return geoOf(node, coordinates.place);
  const point = { lat: (node as Record<string, unknown> | null | undefined)?.[coordinates.lat], lng: (node as Record<string, unknown> | null | undefined)?.[coordinates.lng] };
  return validGeo(point) ? point : undefined;
}
