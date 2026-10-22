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

/**
 * THE ADDRESS IT ARRIVES AT (0.1.47), as the face writes it (`GoTo.href`):
 * what a view's `<a data-record>` carries as its `href`. None on a face
 * whose places are no addresses.
 */
export function addressAt(goTo: GoTo | undefined, to: Arrival): string | undefined {
  if (!goTo?.href) return undefined;
  const also = { ...("filter" in to && to.filter ? { filter: to.filter } : {}), ...(to.section ? { section: to.section } : {}) };
  return goTo.href("record" in to ? { record: to.record } : "list" in to ? { list: to.list } : { place: to.place }, also);
}
