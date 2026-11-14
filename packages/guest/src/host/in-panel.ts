/**
 * A VIEW IN A PANEL SAYS SO (Graview HQ feature:f-one-face-panel-padding).
 *
 * The one face's page, beside the city, is a column a little over half the
 * window: the page says it is there (`data-graview-in-panel` on the page,
 * `@graview/pages`), and a worker view drawn on that page reads it on its
 * own root — `[data-graview-in-panel] .card { … }` in the view's stylesheet
 * — while it is, and not on a full page. A view's stylesheet reaches no
 * ancestor of its shadow root and may not write `:host`, so the host carries
 * the word onto the root itself, as the nearest ancestor of the region that
 * says it changes. Nothing else is read off the page.
 */
export const IN_PANEL = "data-graview-in-panel";

/** Carry `data-graview-in-panel` from the region's nearest ancestor that says it onto the view's root, now and as it changes; the returned function stops. */
export function followInPanel(region: HTMLElement, root: () => Element | null): () => void {
  const document = region.ownerDocument;
  const window = document.defaultView;
  const mark = () => {
    const at = root();
    if (!at) return;
    const inPanel = region.closest(`[${IN_PANEL}]`) !== null;
    if (at.hasAttribute(IN_PANEL) !== inPanel) at.toggleAttribute(IN_PANEL, inPanel);
  };
  mark();
  const Observer = window?.MutationObserver;
  if (typeof Observer !== "function") return () => {};
  // Only this one attribute, anywhere above: a page moving between its levels says it once each way.
  const watch = new Observer(mark);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: [IN_PANEL], subtree: true });
  return () => watch.disconnect();
}
