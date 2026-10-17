import { useLayoutEffect, type RefObject } from "react";

/**
 * A LINK STRETCHED OVER ITS ITEM ENDS WHERE A LIST INSIDE IT BEGINS.
 *
 * A row or a card is the way to its record by a link stretched over the
 * whole of it, under the links it draws itself. Where the item holds a
 * list of its own records (a package's offers, the offers that answer
 * what was heard), that list's links stood over the middle of the
 * stretched one: a press on the item's middle went to one of its offers,
 * and the item's own link was reached only at its edges (W-224). The
 * stretched link now covers the item down to where its list begins — the
 * name and the words above it — and the list's records are each their own
 * way in. An item with no list inside is covered whole, as before, by the
 * bottom the link was drawn with: removing it took an inline `inset: 0`'s
 * bottom too, and Pages' declared rows stood 0 pixels tall.
 */
export function useEndsAboveItsList(link: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = link.current;
    const item = element?.parentElement;
    if (!element || !item) return;
    // The bottom the link was drawn with: a link stretched by its own inline `inset: 0` keeps it, one stretched by a class has none.
    const own = element.style.bottom;
    const place = () => {
      const listing = item.querySelector<HTMLElement>(LISTING);
      if (!listing) {
        element.style.bottom = own;
        return;
      }
      const box = item.getBoundingClientRect();
      const list = listing.getBoundingClientRect();
      // In the item's own pixels: an item drawn scaled on the scene measures smaller on the screen.
      const scale = box.height > 0 ? item.offsetHeight / box.height : 1;
      element.style.bottom = `${Math.max(0, Math.round((box.bottom - list.top) * scale))}px`;
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(place);
    watch.observe(item);
    return () => watch.disconnect();
  }, [link]);
}

/** A list of records drawn inside an item (`SpecList`). */
const LISTING = ".graview-spec-listing";
