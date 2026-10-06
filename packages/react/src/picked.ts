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
