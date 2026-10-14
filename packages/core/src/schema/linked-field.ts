import { z } from "zod";
import { linkedRefOf, markLinked, parseLinkedTarget, type LinkedRelation } from "./linked.js";

/*
 * A DECLARATION'S RELATION TO ANOTHER APP'S KIND (FR-171), in the classic
 * zod a product writes its kinds in. A relation to another app is kept on
 * the record that links, so in TypeScript it is a field:
 *
 *   fields: z.object({
 *     name: z.string(),
 *     forHouse: linkedRecordField("@nick/house/house").optional(),
 *   })
 *
 * A document says the same as a relation, `"forHouse": { "to":
 * ["@nick/house/house"], "cardinality": "one" }`. Its value is `house:<id>`
 * (or a list of them, `{ cardinality: "many" }`); the host's
 * `linkedRecords` says what that record is, as the viewer.
 */
export function linkedRecordField(target: string | readonly string[], options: { readonly cardinality?: "one" | "many"; readonly description?: string } = {}): z.ZodString | z.ZodArray<z.ZodString> {
  const targets = [target].flat();
  const parsed = targets.map((one) => parseLinkedTarget(one));
  if (parsed.length === 0 || parsed.some((one) => !one)) throw new Error(`linkedRecordField(${JSON.stringify(target)}): a target is "@", the app's address, "/" and the kind, like "@nick/house/house"`);
  const address = parsed[0]!.address;
  if (parsed.some((one) => one!.address !== address)) throw new Error(`linkedRecordField(${JSON.stringify(target)}): a relation reaches one app`);
  const relation: LinkedRelation = { address, kinds: [...new Set(parsed.map((one) => one!.kind))], cardinality: options.cardinality ?? "one", ...(options.description ? { description: options.description } : {}) };
  const one = z
    .string()
    .max(300)
    .refine((value) => linkedRefOf(value, relation) !== undefined, `a record of ${relation.kinds.join(" or ")} in ${address}, as "<kind>:<id>"`);
  const schema = relation.cardinality === "one" ? one : z.array(one).max(200);
  return markLinked(options.description ? schema.describe(options.description) : schema, relation);
}
