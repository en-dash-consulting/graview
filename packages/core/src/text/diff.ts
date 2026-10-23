import type { TextSplice } from "./splice.js";

/** Whether a UTF-16 code unit is the first, or the second, half of a surrogate pair. */
const high = (code: number) => code >= 0xd800 && code <= 0xdbff;
const low = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * THE ONE SPLICE THAT TURNS `before` INTO `after`: what they share at the
 * start and at the end is left alone, and the middle is replaced. A page
 * that only knows the field's value before and after a keystroke says the
 * keystroke this way. Never cuts a surrogate pair in two, so an emoji is
 * removed or inserted whole.
 */
export function diffSplice(before: string, after: string): TextSplice {
  const most = Math.min(before.length, after.length);
  let start = 0;
  while (start < most && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  // A shared first half of a pair whose second halves differ: the pair is the change.
  if (start > 0 && high(before.charCodeAt(start - 1))) start--;
  let end = 0;
  while (end < most - start && before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)) end++;
  if (end > 0 && low(before.charCodeAt(before.length - end))) end--;
  return { at: start, removed: before.slice(start, before.length - end), inserted: after.slice(start, after.length - end) };
}
