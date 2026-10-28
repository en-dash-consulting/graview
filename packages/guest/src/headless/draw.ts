import { sanitizeStylesheet, sanitizeStylesheets } from "../host/css.js";
import { createOpenRenderer } from "../host/open-render.js";
import type { ViewRefusal } from "../host/open-draw.js";
import { createTree, type TreeElement } from "./tree.js";

/*
 * A VIEW'S DRAWING, DRAWN WITH NO DOM (FR-95): the records a view sent, in
 * order, through the open kit's own renderer and judge (host/open-render.ts,
 * host/open-judge.ts) into a tree of plain objects, and its stylesheet
 * through the same sanitizer a page uses. What a page would refuse is
 * refused here, by the same code, and written down the same way.
 */

export interface DrawnTranscript {
  readonly root: TreeElement;
  readonly refused: readonly ViewRefusal[];
  /** How many nodes are drawn. */
  readonly size: number;
  /** It went past `maxNodes`. */
  readonly over: boolean;
  /** The stylesheets as a page would draw them, one after another — the app's own for every view first (`theme`), where it has one. */
  readonly css: string;
  /** The element drawn for a view's id: what a press the run made landed on (0.1.45). */
  elementOf(id: string): TreeElement | undefined;
}

export interface DrawTranscriptOptions {
  readonly maxNodes: number;
  readonly origin?: string;
  readonly imageOrigins?: readonly string[];
  readonly asset?: (path: string) => string | undefined;
  readonly link?: (value: string) => string | undefined;
  /** The app's stylesheet for every view (`brand.views.css`, Roadmap f-app-wide-view-theme), drawn before the view's own as the page draws it; its refusals are the checker's to say, not the view's. */
  readonly theme?: string;
}

export function drawTranscript(renders: readonly unknown[], sheets: readonly string[] | undefined, options: DrawTranscriptOptions): DrawnTranscript {
  const { root } = createTree();
  let over = false;
  const renderer = createOpenRenderer(root as unknown as Node, {
    /* No page, so no `blob:` of its own: an image is a `data:` image or nothing. */
    origin: options.origin ?? "null",
    ...(options.imageOrigins ? { imageOrigins: options.imageOrigins } : {}),
    ...(options.asset ? { asset: options.asset } : {}),
    ...(options.link ? { link: options.link } : {}),
    maxNodes: options.maxNodes,
    onOverBudget: () => (over = true),
  });
  for (const batch of renders) renderer.apply(batch);
  const refused: ViewRefusal[] = [...renderer.refused];
  let kept = "";
  if (sheets) {
    const judged = sanitizeStylesheets(sheets);
    kept = judged.css;
    for (const one of judged.refused) refused.push({ reason: "css", name: "stylesheet", css: one });
  }
  const dressed = options.theme ? sanitizeStylesheet(options.theme).css : "";
  const css = dressed && kept ? `${dressed}\n${kept}` : dressed || kept;
  return { root, refused, size: renderer.size, over, css, elementOf: (id) => renderer.elementOf(id) as unknown as TreeElement | undefined };
}
