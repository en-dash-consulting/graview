import { SPEC_VIEW_CSS } from "./spec-css.js";
import { withinTheBox, type ThemeCssOptions } from "./theme.js";

/**
 * THE BLOCKS A VIEW SPEC IS DRAWN WITH (FR-03), as their own sheet: what
 * each face that draws a view — the scene, the routed face, a picture alone —
 * draws beside the frame's `themeBaseCss`, scoped as it is. Fetched with the
 * face, so the frame and its bar stand before any view does (FR-131).
 */
export function viewsCss(options: ThemeCssOptions = {}): string {
  return options.scope === undefined ? SPEC_VIEW_CSS : withinTheBox(SPEC_VIEW_CSS, options.scope);
}
