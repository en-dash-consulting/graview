import type { GoogleCalendarConnectionSpec } from "../document/connection-spec.js";

/*
 * What a declared connection's filter means, apart from the engine — so the
 * checker (`graview check`) can judge a color or a tag without reaching it.
 */

/** Google's event colors by the names its calendar shows, and the `colorId` each one is. */
export const GOOGLE_COLORS: Readonly<Record<string, string>> = {
  Lavender: "1",
  Sage: "2",
  Grape: "3",
  Flamingo: "4",
  Banana: "5",
  Tangerine: "6",
  Peacock: "7",
  Graphite: "8",
  Blueberry: "9",
  Basil: "10",
  Tomato: "11",
};

/** A tag is one word, `#` and letters, digits or hyphens: `#graview`, `#team-sync`. */
export const CONNECTION_TAG = /^#[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** The private extended property every event made here carries, naming the app. */
export const MADE_BY_GRAVIEW = "graview";

/** A title tag, matched as a whole word anywhere in a title, in any case. */
export const tagPattern = (tag: string) => new RegExp(`(^|\\s)${tag.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}(?=\\s|$)`, "i");

/** Whether a Google event is one this connection keeps: its color, or its title's tag. */
export function inConnectionFilter(declaration: GoogleCalendarConnectionSpec, item: Readonly<Record<string, unknown>>): boolean {
  const filter = declaration.filter;
  if (filter?.color) return String(item["colorId"] ?? "") === GOOGLE_COLORS[filter.color];
  if (filter?.tag) return tagPattern(filter.tag).test(String(item["summary"] ?? ""));
  return true;
}

