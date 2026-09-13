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
      if (target.getAttribute("role") === null && takesButton(target)) {
        target.setAttribute("role", "button");
      }
    }
  });
}

/**
 * Whether `role="button"` is a legal thing to say about this element.
 *
 * It was said about EVERY pick target, and a view is free to mark whatever
 * it drew — so a list whose heading was a `<header>` got
 * `<header role="button">`, which ARIA forbids and axe reports
 * (`aria-allowed-role`). Three of them on the first screen of the app this
 * repository shows people first, unnoticed because nothing had ever run axe
 * over the scene.
 *
 * An allowlist rather than a list of forbidden tags: the elements that carry
 * no semantics of their own are a short, closed set, and everything else —
 * landmarks, headings, lists, form controls, links — either already means
 * something or is somewhere a button may not be. A target that is not on it
 * still gets `tabindex`, so the keyboard reaches it; what it does not get is
 * a role that is a lie about the markup.
 */
const GENERIC = new Set([
  "div",
  "span",
  "p",
  "figure",
  "img",
  "td",
  "output",
  "b",
  "i",
  "em",
  "strong",
  "small",
  "canvas",
]);

function takesButton(element: HTMLElement): boolean {
  return GENERIC.has(element.tagName.toLowerCase());
}
