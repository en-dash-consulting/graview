/*
 * The rule that makes a mark a target (see `./picking.ts`), the half the
 * presence reads from the first paint: which node an event is about.
 */

/** The node a pointer or key event is really about, if any. */
export function pickedFrom(target: EventTarget | null): string | null {
  return (
    (target as HTMLElement | null)?.closest?.("[data-graview-pick]")?.getAttribute(
      "data-graview-pick",
    ) ?? null
  );
}

/**
 * THE RECORD A PRESS BESIDE TARGETS IS ABOUT (Roadmap f-make-any-page-better).
 * A right-click in a list's column, between its tasks and below them, was
 * about the whole picture — every list at once — and the menu said nothing
 * could be done. The nearest part around the pointer that holds targets
 * decides: one record alone, or a record and only what it holds or is
 * linked to (a list's heading and its tasks), is that record; anything
 * else — several lists side by side — is no one record, and the press stays
 * about the picture. `linked` says whether two records are linked.
 */
export function holderFrom(target: EventTarget | null, within: Element | null, linked: (from: string, to: string) => boolean, own?: string): string | null {
  for (let at = target as Element | null; at && at !== within?.parentElement; at = at.parentElement) {
    if (typeof at.querySelectorAll !== "function") continue;
    const picks = [...new Set([...at.querySelectorAll("[data-graview-pick]")].map((one) => one.getAttribute("data-graview-pick") ?? "").filter((id) => id !== "" && id !== own))];
    if (picks.length === 0) continue;
    const first = picks[0]!;
    return picks.slice(1).every((id) => linked(first, id)) ? first : null;
  }
  return null;
}
