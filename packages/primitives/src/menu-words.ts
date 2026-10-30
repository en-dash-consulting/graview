/**
 * WHAT A WORD TYPED IN THE MENU FINDS (Roadmap f-menu-type-anything): every
 * row whose words begin with what was typed. Each word typed must be the
 * start of one of the row's words, in any order — "copy l" finds "Copy
 * link", "fin" finds "Finish it", "it fin" finds it too — read without case
 * or accents. A plain word-start match, not Find's matcher
 * (`@graview/core/search`): the menu's rows are a dozen sentences already
 * drawn, not records to rank, and the match must be the same on every row
 * — an act, Go, Show, Copy link — whoever drew it.
 */

/** A row's words, or the words typed, folded: lower case, no accents, split at anything not a letter or a digit. */
export function menuWords(text: string): readonly string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Whether every word typed begins one of the row's words. Nothing typed matches every row. */
export function menuMatches(label: string, typed: string): boolean {
  const wanted = menuWords(typed);
  if (wanted.length === 0) return true;
  const words = menuWords(label);
  return wanted.every((word) => words.some((one) => one.startsWith(word)));
}
