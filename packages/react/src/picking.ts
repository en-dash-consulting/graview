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
 * WHAT A MARK JOINS, when it stands for a relation rather than a thing
 * (FR-111): a coverage cell says `data-graview-joins='["<row>","<column>",
 * …the records on the path]'`, and choosing it chooses all of them.
 */
export function joinedFrom(target: EventTarget | null): readonly string[] | null {
  const said = (target as HTMLElement | null)?.closest?.("[data-graview-pick]")?.getAttribute("data-graview-joins");
  if (!said) return null;
  try {
    const ids: unknown = JSON.parse(said);
    return Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string") ? ids : null;
  } catch {
    return null;
  }
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
  /*
   * WHEN THE CONTENT CHANGES, not after every render. This ran on every
   * render of every host — every frame of a transition, for every card —
   * scanning each subtree for marks that had not moved (docs/scale.md). The
   * marks only change when a view draws something new, so the scan runs
   * when the host mounts and when elements are added under it, at most
   * once a frame.
   */
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const mark = () => {
      for (const target of host.querySelectorAll<Element>("[data-graview-pick]")) {
        if (target.getAttribute("tabindex") === null) target.setAttribute("tabindex", "0");
        if (target.getAttribute("role") === null && takesButton(target)) {
          target.setAttribute("role", "button");
        }
      }
    };
    mark();
    if (typeof MutationObserver === "undefined") return;
    let queued = 0;
    const watch = new MutationObserver(() => {
      if (queued !== 0) return;
      queued = typeof requestAnimationFrame === "undefined" ? 0 : requestAnimationFrame(() => {
        queued = 0;
        mark();
      });
      if (queued === 0) mark();
    });
    watch.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-graview-pick"] });
    return () => {
      watch.disconnect();
      if (queued !== 0) cancelAnimationFrame(queued);
    };
  }, [ref]);
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
  /*
   * AND THE SHAPES, because any lens that draws a picture draws it in SVG.
   *
   * The allowlist was HTML only, so a map, a chart, a floor plan or a
   * network diagram marked its regions with `data-graview-pick`, got the tab
   * stop, and got no role at all — every target announced as nothing, which
   * is a worse outcome than not being focusable, because a keyboard user now
   * tabs through silent stops. ARIA permits `role="button"` on all of these,
   * and `takesButton` still keeps `<header>`, headings and form controls
   * safe, because the guard is an allowlist rather than a list of things to
   * avoid.
   *
   * The role is the framework's half. The NAME is the view's: a shape has no
   * text inside it, so a lens drawing in SVG sets `aria-label` on what it
   * marks. `graview-lens` says so.
   */
  "g",
  "polygon",
  "circle",
  "rect",
  "path",
  "ellipse",
  "polyline",
  "line",
  "use",
]);

function takesButton(element: Element): boolean {
  /*
   * `tagName` is upper-case on an HTML element and EXACTLY AS WRITTEN on an
   * SVG one, so the comparison is lower-cased on both sides. `localName` is
   * already lower-case for HTML and correct-case for SVG; these tags are all
   * lower-case in the SVG namespace, so either answer agrees.
   */
  return GENERIC.has(element.localName.toLowerCase());
}
