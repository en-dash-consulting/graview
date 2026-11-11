/*
 * A TIME OF DAY AS IT IS TYPED, read into the `HH:MM` a `time` field keeps
 * (`TIME_OF_DAY`, `days.ts`). A file of its own, on `@graview/core/words`:
 * a form reads one as it sends it, an import as it reads a cell and a
 * template as it takes an answer — none of it before anybody types.
 */

/**
 * A TIME OF DAY AS IT IS TYPED: "15:00", "3 PM", "3:30pm", "9.15 a.m.",
 * "noon", "midnight" — kept as `HH:MM`. A bare "3" is not said clearly
 * enough to be one; anything else is undefined.
 */
export function parseTimeOfDay(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const s = input.trim().toLowerCase();
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const m = /^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.|a|p)?$/.exec(s);
  if (!m) return undefined;
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const half = m[3]?.[0];
  if ((!half && !m[2]) || minute > 59 || (half ? hour < 1 || hour > 12 : hour > 23)) return undefined;
  const h24 = half ? (hour % 12) + (half === "p" ? 12 : 0) : hour;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
