/*
 * THE ORDER A GRID LENS DRAWS ITS ROWS, COLUMNS OR CARDS IN (2026-10-15).
 *
 * "Releases by era" listed its releases in the order they were written. A
 * coverage lens takes `sort` for its rows and `columnSort` for its columns,
 * and a status board `sort` for the cards in each column, written as a
 * kind's list writes its order: a field (`"released"`), or
 * `{ "by": "released", "direction": "desc" }`. `label` is the record's name.
 * One comparison, so the picture and `describePlace` say the same order.
 */

/** A grid's order, as a declaration writes it. */
export type GridSort = string | { readonly by: string; readonly direction?: "asc" | "desc" };

/** The order in its whole form, or nothing where it is not one. */
export function gridSortOf(sort: unknown): { readonly by: string; readonly direction: "asc" | "desc" } | undefined {
  if (typeof sort === "string" && sort.length > 0) return { by: sort, direction: "asc" };
  if (typeof sort !== "object" || sort === null) return undefined;
  const { by, direction } = sort as { by?: unknown; direction?: unknown };
  if (typeof by !== "string" || by.length === 0) return undefined;
  return { by, direction: direction === "desc" ? "desc" : "asc" };
}

/** What a grid's order is wrong with, in a sentence, or nothing: a field the kind does not have, or a direction that is not one. */
export function gridSortProblem(sort: unknown, fields: readonly string[], kind: string): string | undefined {
  const whole = gridSortOf(sort);
  if (!whole) return `an order is a field, like "released", or { "by": "released", "direction": "asc" | "desc" }`;
  const direction = typeof sort === "object" && sort !== null ? (sort as { direction?: unknown }).direction : undefined;
  if (direction !== undefined && direction !== "asc" && direction !== "desc") return `an order runs "asc" or "desc", not "${String(direction)}"`;
  if (whole.by !== "label" && !fields.includes(whole.by)) return `${kind} has no field "${whole.by}" to order by (it has ${fields.length > 0 ? fields.map((field) => `"${field}"`).join(", ") : "none"}, and "label", its name)`;
  return undefined;
}

/**
 * `items` in the order `sort` says: by the field's value — numbers as
 * numbers, words and dates as words in the page's order — the ones with
 * none last whichever way it runs, and the order they came in where two are
 * the same. Unsaid, as they came.
 */
export function sortForGrid<T>(items: readonly T[], sort: unknown, read: (item: T, field: string) => unknown): readonly T[] {
  const whole = gridSortOf(sort);
  if (!whole) return items;
  const flip = whole.direction === "desc" ? -1 : 1;
  return items
    .map((item, at) => ({ item, at, value: read(item, whole.by) }))
    .sort((a, b) => {
      const none = (a.value === undefined || a.value === null || a.value === "" ? 1 : 0) - (b.value === undefined || b.value === null || b.value === "" ? 1 : 0);
      if (none !== 0) return none;
      if (a.value === b.value || a.value === undefined || a.value === null) return a.at - b.at;
      const order = typeof a.value === "number" && typeof b.value === "number" ? a.value - b.value : String(a.value).localeCompare(String(b.value), undefined, { numeric: true });
      return order === 0 ? a.at - b.at : order * flip;
    })
    .map((one) => one.item);
}
