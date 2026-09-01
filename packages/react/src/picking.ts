import { useEffect } from "react";

/**
 * The one rule that makes anything a view drew into a real target.
 *
 * A view marks an element with `data-graview-pick="<node id>"` and that is the
 * WHOLE contract: whatever surface the view is drawn on routes the gesture to
 * that node. Which surface is the part that was wrong — the rule lived inside
 * the scene's host, so a view lifted out into a full page kept its marks and
 * lost its behaviour. Every chip on it was a button-shaped thing that did
 * nothing, which is precisely the "I clicked it and nothing happened" the
 * marks exist to prevent.
 *
 * So it lives here, and both surfaces use it.
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
 * Makes every `data-graview-pick` element inside a host a real control.
 *
 * Having made clicking the primary way to move through the graph, leaving
 * those targets unreachable by keyboard would make the primary interaction
 * mouse-only.
 *
 * Set as attributes rather than as props because the elements belong to
 * whatever view drew them; React is not managing these, so there is nothing
 * to fight over.
 */
export function usePickTargets(ref: { current: HTMLElement | null }): void {
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    for (const target of host.querySelectorAll<HTMLElement>("[data-graview-pick]")) {
      if (target.getAttribute("tabindex") === null) target.setAttribute("tabindex", "0");
      if (target.getAttribute("role") === null) target.setAttribute("role", "button");
    }
  });
}
