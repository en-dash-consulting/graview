/*
 * WHERE A VIEW SENT SOMEBODY, AS AN ADDRESS: a list's or a place's path
 * narrowed (`?filter=`) and to a section (`#…`). A file of its own, so the
 * page that draws first carries none of it: the routed face and a worker
 * view's host reach it, each fetched as it is drawn.
 */

/** A section's words as an address carries them after `#`: lower-cased, hyphenated (`"Shipping soon"` → `shipping-soon`). */
export function sectionSlug(words: string): string {
  return words
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

/**
 * A PAGE'S ADDRESS, NARROWED AND TO A SECTION: a list's or a place's path
 * with `?filter=` — the word the list's arranging line already writes
 * (`stage:building`) — and `#<section>`, so where a view sent somebody is
 * a link they can share. `/features?filter=stage%3Abuilding#shipping-soon`.
 */
export function narrowedPath(path: string, also: { readonly filter?: string | undefined; readonly section?: string | undefined } = {}): string {
  const [pathname = "/", search = ""] = path.split("#")[0]!.split("?");
  const params = new URLSearchParams(search);
  if (also.filter) params.set("filter", also.filter);
  const query = params.toString();
  const section = also.section ? sectionSlug(also.section) : "";
  return `${pathname}${query ? `?${query}` : ""}${section ? `#${section}` : ""}`;
}
