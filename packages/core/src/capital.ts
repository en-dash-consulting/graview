/** The text with its first letter upper-cased, as a sentence starts: the one place this package says how. */
export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
