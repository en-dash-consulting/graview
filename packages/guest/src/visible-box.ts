/** A box in the window's pixels. */
export interface SeenBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * WHAT OF AN ELEMENT IS IN SIGHT: its box cut by every box above it that
 * clips what it holds (a list that scrolls, a card that hides its
 * overflow), up to `until`, which is not itself looked at. A row scrolled
 * out of its list is nothing in sight, so no line is drawn from it.
 * `clips` is kept across one reading, so an ancestor is asked once.
 */
export function visibleBox(element: Element, until: Node | null, clips: Map<Element, boolean>, style: (element: Element) => { readonly overflowX: string; readonly overflowY: string }): SeenBox | null {
  const own = element.getBoundingClientRect();
  let left = own.left;
  let top = own.top;
  let right = own.right;
  let bottom = own.bottom;
  for (let at = parentOf(element); at && at !== until; at = parentOf(at)) {
    let clipping = clips.get(at);
    if (clipping === undefined) {
      const said = style(at);
      clipping = said.overflowX !== "visible" || said.overflowY !== "visible";
      clips.set(at, clipping);
    }
    if (!clipping) continue;
    const box = at.getBoundingClientRect();
    left = Math.max(left, box.left);
    top = Math.max(top, box.top);
    right = Math.min(right, box.right);
    bottom = Math.min(bottom, box.bottom);
    if (right - left < 1 || bottom - top < 1) return null;
  }
  return right - left < 1 || bottom - top < 1 ? null : { left, top, right, bottom };
}

/** The element above, across a shadow root to its host. */
function parentOf(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.parentNode;
  return root && "host" in root ? ((root as ShadowRoot).host ?? null) : null;
}
