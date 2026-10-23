/** The text with its first letter upper-cased, as a sentence starts: the one place this package says how. */
export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The text with its first letter lower-cased, as a word inside a sentence
 * reads: "Tasks" → "tasks". Never an acronym — a word whose second letter
 * is upper case ("CVEs", "AI uses", "URL") is said as it was written, not
 * "cVEs". The one place this package says how.
 */
export const lowerFirst = (text: string): string => (/^.\p{Lu}/u.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1));

/** "A", "A and B", "A, B and C" — or with "or": the one place this package says a list in words. */
export const listed = (items: readonly string[], word = "and"): string => (items.length > 1 ? `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}` : (items[0] ?? ""));
