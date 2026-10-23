import type { Primitive } from "../graph/primitives.js";
import type { SeatLens } from "./withheld.js";

/*
 * What a seat's lens keeps of a record's fields (Roadmap f-field-sight),
 * read where an answer is served: apart from `@graview/core/field-sight`,
 * so a page that answers its seat carries none of the judging.
 */

/** The fields of a record a lens keeps, when it keeps any. */
export const keptOf = (lens: SeatLens, id: string): ((field: string) => boolean) | undefined => {
  const kind = lens.kindOf(id);
  return kind === undefined ? undefined : lens.kept?.({ id, kind });
};

/** Primitives as the seat receives them: what a patch or a splice wrote of a field kept from it is no part of them. */
export function withoutKeptFields(primitives: readonly Primitive[], lens: SeatLens): Primitive[] {
  return primitives.flatMap((primitive): Primitive[] => {
    // A splice of a kept field is no part of them at all.
    if (primitive.op === "splice-text") return keptOf(lens, primitive.id)?.(primitive.field) ? [] : [primitive];
    if (primitive.op !== "patch-node") return [primitive];
    const kept = keptOf(lens, primitive.id);
    if (!kept || !Object.keys(primitive.after).some(kept)) return [primitive];
    const keep = (side: Readonly<Record<string, unknown>>) => Object.fromEntries(Object.entries(side).filter(([field]) => !kept(field)));
    const after = keep(primitive.after);
    return Object.keys(after).length === 0 ? [] : [{ op: "patch-node", id: primitive.id, before: keep(primitive.before), after }];
  });
}

