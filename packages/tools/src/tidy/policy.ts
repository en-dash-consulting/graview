/*
 * WHAT A CONFIDENCE BECOMES, BY HOW MUCH THE CHANGE WOULD UNDO. The model
 * says how sure; code says what that is enough for. Above a severity's
 * `act`, the change may be made unasked — and only if the host let the
 * actor apply that sure a change (`applyAtLeast`); between `ask` and
 * `act`, a person is asked (a suggestion); below `ask`, it is dropped, and
 * nobody is bothered. A merge folds two records into one, so it is held
 * to more than setting a record aside, which is held to more than a link
 * or a filled-in choice, which a person undoes with a press.
 */

/** How much a change would undo: a merge, an archive, a link made, a choice filled in. */
export type Severity = "merge" | "archive" | "link" | "categorize";

/** At least `act` sure: may be made unasked (where the host allows). At least `ask`: suggested. Below: dropped. */
export interface Band {
  readonly act: number;
  readonly ask: number;
}

/** The bands a dream uses unless the host says others. */
export const BANDS: Readonly<Record<Severity, Band>> = {
  merge: { act: 0.9, ask: 0.5 },
  archive: { act: 0.85, ask: 0.55 },
  link: { act: 0.8, ask: 0.45 },
  categorize: { act: 0.8, ask: 0.45 },
};

/** What becomes of one judgment: made, put to a person, or let go. */
export type Route = "act" | "ask" | "drop";

/**
 * Where a confidence goes for a change of this severity. A split choice —
 * two options nearly as likely — is never made unasked, however sure its
 * top option.
 */
export function routeOf(confidence: number, severity: Severity, bands: Partial<Record<Severity, Partial<Band>>> = {}, split = false): Route {
  const band = { ...BANDS[severity], ...(bands[severity] ?? {}) };
  if (confidence >= band.act && !split) return "act";
  return confidence >= band.ask ? "ask" : "drop";
}
