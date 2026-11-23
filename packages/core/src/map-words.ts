/** Why a map cannot pin a kind: a role bound to a field of the wrong type, a latitude or a longitude bound without the other (`role`, the one missing), or nothing to pin by. */
export type MapProblem = { readonly problem: "wrong" | "half"; readonly role: "place" | "lat" | "lng" } | { readonly problem: "none" };

/** Why a map cannot pin a kind whose fields have these types (`mapTypesOf`), where `mapCoordinatesOf` says it cannot. */
export function mapProblemOf(roles: Readonly<Record<string, unknown>>, types: Readonly<Record<string, string>>): MapProblem {
  const { place, lat, lng } = roles as Record<string, string | undefined>;
  if (place !== undefined) return { problem: "wrong", role: "place" };
  if (lat === undefined && lng === undefined) return { problem: "none" };
  for (const [role, field] of [["lat", lat], ["lng", lng]] as const) {
    if (field === undefined) return { problem: "half", role };
    if (types[field] !== "number") return { problem: "wrong", role };
  }
  return { problem: "none" };
}

/*
 * WHY A MAP CANNOT PIN A KIND, IN WORDS (Graview HQ feature:f-map-lens):
 * what `graview check` and `add-lens` say, in one code and one fix each.
 * Apart from `./places.ts`, which a page draws its bar with and which only
 * decides whether a map draws: a page carries none of these sentences.
 */

/** What a map takes, in words: the bindings it reads, said wherever a map is refused. */
export const mapBindingsWords = (kind: string): string =>
  `Give ${kind} a place field ("type": "place"), whose point the host keeps beside it as "<field>Geo": { "lat", "lng" }, and bind it: "bindings": { "${kind}": { "place": "<the place field>" } } — or bind two number fields: "bindings": { "${kind}": { "lat": "<a number field>", "lng": "<a number field>" } }.`;

/** A map's problem with one kind, as the checker and `add-lens` say it: the code, the binding it is at (under the lens), and the sentence. */
export function mapProblemWords(kind: string, roles: Readonly<Record<string, unknown>>, found: MapProblem): { readonly code: "lens-no-coordinates" | "lens-cannot-draw"; readonly path: string; readonly message: string; readonly fix: string } {
  const fix = mapBindingsWords(kind);
  if (found.problem === "none") return { code: "lens-no-coordinates", path: `bindings.${kind}`, message: `${kind} has no coordinates — no place field the host finds a point for, and no latitude and longitude`, fix };
  const path = `bindings.${kind}.${found.role}`;
  if (found.problem === "half") return { code: "lens-cannot-draw", path, message: `it binds ${found.role === "lng" ? "a latitude and no longitude" : "a longitude and no latitude"}`, fix };
  const field = String(roles[found.role]);
  const message = found.role === "place" ? `its place "${field}" is not a place field, so it holds no point the host found` : `its ${found.role} "${field}" is not a number, and a ${found.role === "lat" ? "latitude" : "longitude"} is`;
  return { code: "lens-cannot-draw", path, message, fix };
}
