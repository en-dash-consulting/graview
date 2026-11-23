import * as z from "zod";


/*
 * WHERE A PLACE IS, in the classic zod a product writes its kinds in: the
 * field beside the place, named for it with `Geo`, optional (the host may
 * not have found it), and written by the host rather than typed:
 *
 *   fields: z.object({
 *     name: z.string(),
 *     where: placeField(),
 *     whereGeo: placeGeoField(),
 *   })
 *
 * A document's place field takes its `Geo` beside it without a word.
 */

/** The field that keeps the point of the place beside it: `<place>Geo`, optional, and null once the host takes it back. */
export function placeGeoField() {
  return z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict().nullable().optional();
}
