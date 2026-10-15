import type { GoTo } from "@graview/react/provider";
import type { Arrival } from "./links.js";

/**
 * WHERE A VIEW'S NAVIGATE ARRIVES, on whichever face draws it: a record, a
 * place or a kind's list, through the face's own way of going (`useGoTo`),
 * narrowed and to a section as it was judged.
 */
export function arriveAt(goTo: GoTo | undefined, to: Arrival): void {
  if (!goTo) return;
  const also = { ...("filter" in to && to.filter ? { filter: to.filter } : {}), ...(to.section ? { section: to.section } : {}) };
  if ("record" in to) goTo.record(to.record, also);
  else if ("list" in to) goTo.list(to.list, also);
  else goTo.place(to.place, also);
}
