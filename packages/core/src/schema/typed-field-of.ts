import { defOf } from "./zod.js";
import type { TypedField } from "./typed-fields.js";

/*
 * WHICH OF PHONE, PLACE AND DURATION A FIELD HOLDS, read from the mark
 * `typed-fields.ts` puts on it. Apart from the mark because only a face, a
 * form and an agent's tool read it, each fetched when it is first wanted;
 * the mark is the same symbol, from the runtime's own registry.
 */
const TYPED = Symbol.for("@graview/core:typed-field");

/** Which of phone, place and duration a field holds — under optional, default and nullable — or undefined. */
export function typedFieldOf(schema: unknown): TypedField | undefined {
  const def = defOf(schema) as { [TYPED]?: TypedField; innerType?: unknown } | undefined;
  return def ? (def[TYPED] ?? typedFieldOf(def.innerType)) : undefined;
}
