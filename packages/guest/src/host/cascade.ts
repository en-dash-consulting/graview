/*
 * THE APP'S THEME WINS (Roadmap f-view-authoring-friction-2026-11). The
 * app's stylesheet for every view (`brand.views.css`) was drawn before the
 * view's own sheet, unlayered as it was, so any rule a view wrote beat it
 * and a design system could not hold. Every sheet in a view's region is now
 * in a cascade layer of the host's, in this order:
 *
 *   graview-motion   less motion where a person asks for it (`!important`)
 *   graview-region   the host's own rules: the ring, the plain button, the
 *                    screen-reader text (`!important` where they must hold)
 *   graview-view     the view's own sheets
 *   graview-theme    the app's stylesheet for every view
 *
 * A later layer's rule wins over an earlier one's whatever the specificity,
 * so wherever the theme and the view style the same element the theme's
 * rule wins, and the view's own class still beats the host's plain button.
 * An `!important` reverses the order: the host's ring and less motion beat
 * anything, and a view's `!important` is the one way it overrides the theme
 * — written on purpose, and seen in its source. Neither sheet can write
 * `@layer` itself (the open kit refuses it), so the order is the host's.
 * Inheritance is not the cascade: a theme that sets a font on the root is
 * overridden by a view that sets one on its own element.
 *
 * No imports: the page's host and a headless run compose sheets alike.
 */
export const VIEW_LAYERS = "@layer graview-motion, graview-region, graview-view, graview-theme;";

/** A sheet in one of the host's layers; nothing for an empty sheet. */
export function inLayer(layer: "graview-region" | "graview-view" | "graview-theme", css: string): string {
  return css.trim() === "" ? "" : `@layer ${layer} {\n${css}\n}`;
}

/** The theme and the view's own sheets as the page draws them: the theme in the layer that wins. The view's alone where there is no theme. */
export function dressedCss(theme: string, own: string): string {
  if (theme.trim() === "") return own;
  return [VIEW_LAYERS, inLayer("graview-theme", theme), inLayer("graview-view", own)].filter((one) => one !== "").join("\n");
}
