import { geoOfField, isPlacePoint } from "./geo.js";
/** A sight as `withPlacePoints` reads one: the kinds it shows, and the fields it lists or hides. */
interface PointedSight {
  readonly kinds: readonly string[];
  readonly fields?: readonly string[];
  readonly hide?: readonly string[];
}

/**
 * WHO SEES A PLACE SEES ITS POINT, AND NO ONE ELSE: a sight that names a
 * place field, to show it or to hide it, says the same of the point kept
 * beside it, so a seat kept from an address is never served where it is.
 * Read off the schema, so a declaration in code and a document's compile
 * are judged alike; the store widens its policy with it once, where field sight is loaded (`FIELD_SIGHT.points`): without it a sight that hides a field shows nothing.
 */
export function withPlacePoints<P extends { readonly sees?: readonly PointedSight[] }>(policy: P | undefined, schema: { tryDefinition(kind: string): { readonly fields: unknown } | undefined }): P | undefined {
  if (!policy?.sees?.length) return policy;
  const pointsOf = (kind: string): ReadonlyMap<string, string> => {
    const shape = ((schema.tryDefinition(kind)?.fields as { shape?: Record<string, unknown> } | undefined)?.shape) ?? {};
    return new Map(Object.keys(shape).flatMap((key) => {
      const place = geoOfField(key);
      return place !== undefined && isPlacePoint(shape, key) ? [[place, key] as const] : [];
    }));
  };
  let changed = false;
  const sees = policy.sees.map((sight) => {
    if (!sight.fields && !sight.hide) return sight;
    const points = new Map(sight.kinds.flatMap((kind) => [...pointsOf(kind)]));
    if (points.size === 0) return sight;
    const along = (names: readonly string[] | undefined) => (names ? [...names, ...names.flatMap((name) => (points.has(name) && !names.includes(points.get(name)!) ? [points.get(name)!] : []))] : undefined);
    const fields = along(sight.fields);
    const hide = along(sight.hide);
    if (fields?.length === sight.fields?.length && hide?.length === sight.hide?.length) return sight;
    changed = true;
    return { ...sight, ...(fields ? { fields } : {}), ...(hide ? { hide } : {}) };
  });
  return changed ? { ...policy, sees } : policy;
}

