/**
 * What the watch saw and the framework stands behind, each with its reason.
 *
 * A violation listed here is written into the harness's report as
 * acknowledged and does not fail it. Everything else does. Keep this list
 * short: an entry is a decision somebody can read and disagree with, not a
 * place to put a failure until it goes away.
 *
 * { rule, harness?, match, reason }
 *   rule     the watch's rule
 *   harness  the script it applies to (all, when absent)
 *   match    a substring of the violation's detail
 *   reason   why this is right, in a sentence
 */
export const ACKNOWLEDGED = [
  /*
   * WHAT `control-covered` FOUND THE DAY IT WAS TAUGHT (the tenth walk's
   * carried pass, W-224), and is carried open rather than fixed in that
   * pull request: each a collision a person meets, each named to the
   * harness that met it so a new one anywhere else still fails. Fixed, an
   * entry goes.
   */
  {
    rule: "control-covered",
    match: 'is covered by <div data-testid="drive-in-task">',
    reason: "W-224, carried: from altitude, todo's Tasks district hangs its drive-in pictures over its own problem count; the count is also on the district's name and in the map's panel.",
  },
  {
    rule: "control-covered",
    harness: "verify-chrome",
    match: '<button data-testid="presence-edge"',
    reason: "W-224, carried: the sign to a person somewhere else stands under the altitude control in the corner; the person is also in the bar's presence list.",
  },
  {
    rule: "control-covered",
    match: 'data-testid="app-home"> "Program" in [data-testid="app-bar"] is covered by <button data-testid="app-face-scene">',
    reason: "W-224, carried: at 320 wide the bar's faces switch stands over the app's name; the name is also the home link in the menu.",
  },
  {
    rule: "control-covered",
    harness: "verify-chrome",
    match: 'data-testid="app-home"> "Things" in [data-testid="app-bar"] is covered by <button data-testid="app-face-scene">',
    reason: "W-224, carried: at 390 wide the bar's faces switch stands over the app's name; the name is also the home link in the menu.",
  },
  {
    rule: "control-covered",
    harness: "verify-chrome",
    match: 'is covered by <button data-testid="zoom-out"',
    reason: "W-224, carried: on a phone at altitude a district's problem count can lie under the zoom in the corner; the count is in the map's panel too.",
  },
  {
    rule: "control-covered",
    harness: "verify-playback",
    match: 'is covered by <button data-testid="back-to-now"',
    reason: "W-224, carried: playing the history back, its timeline stands over a district's problem count; Back to now puts it away.",
  },
  {
    rule: "control-covered",
    harness: "verify-navigation",
    match: 'past the top edge — bring it into view"',
    reason: "W-224, carried: panned by hand on a phone, a sign at the top edge stands under the trail's Reset view, which brings the district back in.",
  },
  {
    rule: "control-covered",
    harness: "verify-navigation",
    match: '<button data-testid="beyond-more"',
    reason: "W-224, carried: on a phone the folded districts' \"+3 more\" stands under the focused picture's foot; the bar's places reach the same districts.",
  },
  {
    rule: "control-covered",
    harness: "verify-declared",
    match: 'in [data-testid="place-lens"] is covered by <a aria-label="Codebase analysis">',
    reason: "W-224, carried: a declared lens in the lifelogics document draws its records' links over each other where two share a cell.",
  },
  {
    rule: "control-covered",
    harness: "verify-declared",
    match: 'in [data-testid="record-row"] is covered by <a aria-label="A suite they trust">',
    reason: "W-224, carried: a declared row in the lifelogics document draws two record links over each other at 390 wide.",
  },
  ...["verify-gauntlet", "verify-pages", "verify-screen-reader"].map((harness) => ({
    rule: "control-covered",
    harness,
    match: 'is covered by <input data-testid="seat-field"',
    reason: "W-224, carried: a page or a lens column that ends under the closed ask field and cannot scroll clear of it (an app's own page with no foot room, a lens's own scroller) has the field over its last record; the scene's foot and the routed face's end are fixed (W-225).",
  })),
];

/** The acknowledgment that covers this violation, if one does. */
export function acknowledgedBy(script, violation) {
  return ACKNOWLEDGED.find(
    (entry) =>
      entry.rule === violation.rule &&
      (entry.harness === undefined || entry.harness === script) &&
      violation.detail.includes(entry.match),
  );
}
