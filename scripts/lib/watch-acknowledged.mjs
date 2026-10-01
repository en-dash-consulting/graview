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
export const ACKNOWLEDGED = [];

/** The acknowledgement that covers this violation, if one does. */
export function acknowledgedBy(script, violation) {
  return ACKNOWLEDGED.find(
    (entry) =>
      entry.rule === violation.rule &&
      (entry.harness === undefined || entry.harness === script) &&
      violation.detail.includes(entry.match),
  );
}
