import { sectionSlug } from "@graview/core/navigate";

/*
 * A SECTION OF A PAGE: what `#shipping-soon` on the routed face scrolls to,
 * as a view's `navigate({ …, section })` asks. The routed face's alone: a
 * stop in the scene is a picture, not a page of headings.
 */

/**
 * THE ELEMENT A SECTION NAMES on the page drawn now: one whose `id` or
 * `data-section` it is, else a heading whose words it says — in the page,
 * then inside each worker view's own region, where a view's headings are.
 */
export function findSection(section: string, root: ParentNode = document): HTMLElement | null {
  const want = sectionSlug(section);
  if (!want) return null;
  const roots: ParentNode[] = [root, ...[...root.querySelectorAll<HTMLElement>("[data-worker-view]")].flatMap((region) => (region.shadowRoot ? [region.shadowRoot] : []))];
  for (const one of roots) {
    for (const element of one.querySelectorAll<HTMLElement>("[id], [data-section]")) {
      const named = element.getAttribute("data-section") ?? element.id;
      if (named === section || sectionSlug(named) === want) return element;
    }
  }
  for (const one of roots) {
    for (const heading of one.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6, [role=heading]")) {
      if (sectionSlug(heading.textContent ?? "") === want) return heading;
    }
  }
  return null;
}

/**
 * GO TO A SECTION ONCE IT IS DRAWN: a page's list, a lens or a worker view
 * draws after the address changes, so the section is looked for each frame
 * for about two seconds, scrolled to the top of its scroller and given the
 * keyboard (a screen reader says where the reader landed). Returns a way to
 * stop looking.
 */
export function revealSection(section: string, options: { readonly root?: ParentNode; readonly frames?: number } = {}): () => void {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return () => {};
  let left = options.frames ?? 120;
  let handle = 0;
  const look = () => {
    const found = findSection(section, options.root ?? document);
    if (found) {
      if (!found.hasAttribute("tabindex")) found.setAttribute("tabindex", "-1");
      found.scrollIntoView?.({ block: "start" });
      found.focus({ preventScroll: true });
      return;
    }
    left -= 1;
    if (left > 0) handle = requestAnimationFrame(look);
  };
  // After the frame the destination is committed in, so the keyboard lands past whatever the arrival focuses.
  handle = requestAnimationFrame(() => {
    handle = requestAnimationFrame(look);
  });
  return () => cancelAnimationFrame(handle);
}
