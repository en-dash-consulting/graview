import { sanitizeStylesheet } from "../host/css.js";
import { createOpenRenderer } from "../host/open-render.js";
import type { ViewRefusal } from "../host/open-draw.js";
import { createTree, type TreeElement } from "./tree.js";

/*
 * A VIEW'S DRAWING, DRAWN WITH NO DOM (FR-95): the records a view sent, in
 * order, through the open kit's own renderer and judge (host/open-render.ts,
 * host/open-judge.ts) into a tree of plain objects, and its stylesheet
 * through the same sanitiser a page uses. What a page would refuse is
 * refused here, by the same code, and written down the same way.
 */

export interface DrawnTranscript {
  readonly root: TreeElement;
  readonly refused: readonly ViewRefusal[];
  /** How many nodes are drawn. */
  readonly size: number;
  /** It went past `maxNodes`. */
  readonly over: boolean;
  /** The stylesheet as a page would draw it. */
  readonly css: string;
}

export function drawTranscript(renders: readonly unknown[], css: string | undefined, options: { readonly maxNodes: number; readonly origin?: string }): DrawnTranscript {
  const { root } = createTree();
  let over = false;
  const renderer = createOpenRenderer(root as unknown as Node, {
    /* No page, so no `blob:` of its own: an image is a `data:` image or nothing. */
    origin: options.origin ?? "null",
    maxNodes: options.maxNodes,
    onOverBudget: () => (over = true),
  });
  for (const batch of renders) renderer.apply(batch);
  const refused: ViewRefusal[] = [...renderer.refused];
  let kept = "";
  if (typeof css === "string") {
    const judged = sanitizeStylesheet(css);
    kept = judged.css;
    for (const one of judged.refused) refused.push({ reason: "css", name: "stylesheet", css: one });
  }
  return { root, refused, size: renderer.size, over, css: kept };
}
