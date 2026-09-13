import { useMemo } from "react";

/**
 * DECLARED MARKUP, handed to the DOM once.
 *
 * A brand's logo and a kind's figure are both vector art the installation
 * declares, and both reach the DOM as `dangerouslySetInnerHTML` — which
 * React 19 decides to re-apply by comparing the PROP OBJECT to the last one
 * by identity. Written inline, `{{ __html: art }}` is a new object on every
 * render, so the art was torn out and parsed again every time anything on
 * the screen moved: thirty-four times for a single click on the ground.
 *
 * The wasted parsing is the smaller half. A double-click only pairs if both
 * clicks land on the SAME node, and the re-render the first click caused had
 * already replaced it — so double-clicking a district on its figure selected
 * the card and went nowhere, while double-clicking the same card an inch to
 * the left travelled into it.
 *
 * One hook rather than a `useMemo` at each of the five call sites, because
 * the next person to write innerHTML will copy whichever they find.
 */
export function useMarkup(html: string | undefined): { readonly __html: string } | undefined {
  return useMemo(() => (html === undefined || html === "" ? undefined : { __html: html }), [html]);
}
