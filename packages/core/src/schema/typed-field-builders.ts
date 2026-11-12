import * as z from "zod";
import { markTyped, PHONE } from "./typed-fields.js";
import { TIME_OF_DAY } from "../days.js";

/*
 * A DECLARATION'S PHONE, PLACE AND DURATION, in the classic zod a product
 * writes its kinds in, so each chains like any other field:
 *
 *   fields: z.object({
 *     name: z.string(),
 *     phone: phoneField().optional(),
 *     venue: placeField().optional(),
 *     length: durationField(),
 *   })
 *
 * A document says the same as `{"type": "phone"}`, `{"type": "place"}` and
 * `{"type": "duration"}`, and its fields hold the same: a form trims what
 * it sends, so a value is kept as it was entered, trimmed.
 */

/** A phone number, kept as it is entered and refused only when it cannot be one; drawn as a `tel:` link. */
export function phoneField(): z.ZodString {
  return markTyped(z.string().max(40).regex(PHONE, "a phone number"), "phone");
}

/** An address or a place's name, drawn as a link that opens the reader's maps app. */
export function placeField(): z.ZodString {
  return markTyped(z.string().min(1).max(500), "place");
}

/** A length of time in whole minutes: entered as "1h 30m", "90", "1:30" or "1.5 h", said as "1 h 30 min". */
export function durationField(): z.ZodNumber {
  return markTyped(z.number().int().min(0), "duration");
}

/** A time of day with no day and no zone, kept as "15:00": typed in a time input, said "3:00 PM" where the reader's clock says it so. */
export function timeField(): z.ZodString {
  return markTyped(z.string().regex(TIME_OF_DAY, "a time of day like 15:00"), "time");
}
