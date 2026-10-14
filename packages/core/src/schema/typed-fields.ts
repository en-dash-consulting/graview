import { defOf } from "./zod.js";

/*
 * A PHONE NUMBER, A PLACE AND A LENGTH OF TIME, as a record keeps them.
 *
 * Templates held all three as strings, so a phone was not a link to call, an
 * address was not a link to a map and "1h 30m" could not be added up. Each
 * is now a type: a phone is the words it was entered as, refused only when
 * it cannot be one (fewer than three digits, letters other than an
 * extension's); a place is a line of text; a duration is a whole number of
 * MINUTES, entered as "1h 30m", "90", "1:30" or "1.5 h" and said as
 * "1 h 30 min".
 *
 * A hosted page loads this up front to build a document's fields, so it
 * holds the mark and the phone's shape and no more: which a field holds
 * (`typed-field-of.ts`), how each is said, linked and read from what was
 * typed (`field-words.ts`) are `@graview/core/words`'s.
 */

/** The field types a value's words and its link are read from. */
export type TypedField = "phone" | "place" | "duration";

/*
 * WHICH FIELDS ARE WHICH: a mark on the schema's def, as a file field and an
 * app-link are marked, so a clone shares it, a refinement spreads it and a
 * wrapper holds it inside.
 */
const TYPED = Symbol.for("@graview/core:typed-field");

/** Marks a schema as holding a phone number, a place or a duration, where its type is one; any other it leaves as it is. */
export const markTyped = <T extends object>(schema: T, type: string): T => (/^(phone|place|duration)$/.test(type) && ((defOf(schema) as Record<symbol, string>)[TYPED] = type), schema);

/**
 * A PHONE NUMBER, LOOSELY: at least three digits, with the spaces, `+`, `-`,
 * `.`, `/` and parentheses people write them with, and an extension
 * (`ext. 12`, `x12`). What it is entered as is what it keeps.
 */
export const PHONE = /^(?=(?:\D*\d){3})\+?[\d ()./-]+(?: *(?:ext\.?|x|#) *\d+)?$/i;
