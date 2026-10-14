import * as z from "./zod.js";
import { linkedRefOf, markLinked, type LinkedRelation } from "./linked.js";

/** The schema a relation to another app is kept in, in zod/mini: `kind:id`, or a list of them. */
export function linkedSchema(relation: LinkedRelation): z.ZodMiniType {
  const one = z.string().check(
    z.maxLength(300),
    z.refine((value: string) => linkedRefOf(value, relation) !== undefined, `a record of ${relation.kinds.join(" or ")} in ${relation.address}, as "<kind>:<id>"`),
  );
  const schema: z.ZodMiniType = relation.cardinality === "one" ? one : z.array(one).check(z.maxLength(200));
  return markLinked(relation.description ? schema.check(z.describe(relation.description)) : schema, relation);
}
