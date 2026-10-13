/** The text with its first letter upper-cased, as a sentence starts: the one place this package says how. */
export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "A", "A and B", "A, B and C" — or with "or": the one place this package says a list in words. */
export const listed = (items: readonly string[], word = "and"): string => (items.length > 1 ? `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}` : (items[0] ?? ""));
