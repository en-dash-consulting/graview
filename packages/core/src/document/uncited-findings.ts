import type { UncitedValue } from "../cited.js";
import { warning, type Finding } from "./findings.js";

/**
 * AN UNCITED VALUE, AS THE CHECKER SAYS IT (Roadmap f-field-cites-marker):
 * a warning, since the record is whole and the app runs; what is missing is
 * where its value came from.
 */
export function uncitedFinding(one: UncitedValue, path: string): Finding {
  return warning(
    "field-uncited",
    path,
    `${one.words}: the ${one.kind} "${one.record}" holds a ${one.field} and its ${one.relation ? "relation" : "field"} "${one.cites}" ${one.relation ? "links nothing" : "is empty"}, so nothing says where the value came from.`,
    one.relation ? `Link "${one.record}" to its source by "${one.cites}", or clear its ${one.field}.` : `Fill "${one.cites}" on "${one.record}" with where its ${one.field} came from, or clear its ${one.field}.`,
  );
}
