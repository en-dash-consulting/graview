import { z } from "zod";
import { markRepeat, validRepeat, type Repeat } from "../repeat.js";

/*
 * HOW A DATE REPEATS, in the classic zod a product writes its kinds in: the
 * field beside the date, named for it with `Repeat`, and optional (a record
 * of the kind may repeat or not):
 *
 *   fields: z.object({
 *     title: z.string(),
 *     startsAt: z.string().datetime({ local: true }),
 *     startsAtRepeat: repeatField(),
 *   })
 *
 * A document says the same as `{"type": "datetime", "repeats": true}`.
 */

/** The field that keeps how the date beside it repeats: `<date>Repeat`, optional, and null once it no longer does. */
export function repeatField(): z.ZodOptional<z.ZodType<Repeat | null>> {
  return markRepeat(z.custom<Repeat | null>((value) => value === null || validRepeat(value), 'how a date repeats, like { every: "week", on: ["tue"] }, or null')).optional();
}
