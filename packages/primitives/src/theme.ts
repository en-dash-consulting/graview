/**
 * The visual system.
 *
 * Two schemes, and they are not inversions of each other. Depth is the thing
 * being drawn, and depth behaves differently in the two:
 *
 * - **Dark** is a lit control surface. Things at depth lose luminance and
 *   dissolve into the ground; the accent reads as light, and separation comes
 *   from glow and a lit edge.
 * - **Light** is daylight and paper. Things at depth lose CONTRAST and gain
 *   haze — real atmospheric perspective — and separation comes from soft
 *   cast shadow, the way objects on a desk separate. Inverting the dark
 *   scheme would give gray-on-gray mush, because glow does not exist in
 *   daylight.
 *
 * One rule holds across both: **secondary text is a color, never an
 * opacity.** Opacity composites against whatever is behind and fails contrast
 * silently. axe-core checks this on every run of `scripts/run-a11y.mjs`.
 */

/*
 * The token CONTRACT lives in `@graview/core`, not here.
 *
 * A theme is a declaration, and `graview check` reads declarations — so a
 * brand's palette can be verified before it ships rather than after somebody
 * files a bug about gray-on-gray. What lives here is the two the framework
 * ships with, and they are ordinary declared themes: there is no special case
 * for the built-ins, which is the only way to know a third party's theme goes
 * through the same path.
 */
export type { Brand, Scheme, ThemeTokens } from "@graview/core";
import type { Brand, Scheme, ThemeTokens } from "@graview/core";

/*
 * The palettes moved to `@graview/core`.
 *
 * They are data, not components, and two things needed them where React is
 * not: `graview check` verifies a palette and must not import React to do it,
 * and an app declaring its own brand in its domain layer needs a neutral base
 * without reaching into the UI package.
 */
export { DARK, LIGHT, SCHEMES } from "@graview/core";
import { SCHEMES, kitVariables, layer, layerVariables, resolveKit, SCENE_LAYERS, shapeOf, TYPOGRAPHY, typographyOf } from "@graview/core";
import { MARQUEE_GAP, MARQUEE_WIDTH } from "@graview/layout/view";
import { SPEC_VIEW_CSS } from "./spec-css.js";


/**
 * The framework's own brand, expressed as an ordinary declared one.
 *
 * No special case for the built-ins: `themeCss` takes a brand and this is
 * simply the default value. That is the only way to know a third party's
 * theme goes through the same path — if the shipped one took a shortcut, the
 * shortcut is where a stranger's theme would break.
 */
export const GRAVIEW_BRAND: Brand = {
  name: "Graview",
  // The framework's own faces (`TYPOGRAPHY` in @graview/core), named here so the brand reads as any other.
  typography: { body: TYPOGRAPHY.body, mono: TYPOGRAPHY.mono },
  schemes: SCHEMES,
};

const VARIABLE: Record<keyof ThemeTokens, string> = {
  ground: "--graview-ground",
  groundDeep: "--graview-ground-deep",
  wash: "--graview-wash",
  panel: "--graview-panel",
  panelMuted: "--graview-panel-muted",
  panelWarning: "--graview-panel-warning",
  edge: "--graview-edge",
  edgeBright: "--graview-edge-bright",
  ink: "--graview-ink",
  inkMuted: "--graview-ink-muted",
  inkFaint: "--graview-ink-faint",
  accent: "--graview-accent",
  accentDim: "--graview-accent-dim",
  accentInk: "--graview-accent-ink",
  warn: "--graview-warn",
  good: "--graview-good",
  bad: "--graview-bad",
  glow: "--graview-glow",
  bar: "--graview-bar",
  float: "--graview-float",
  liftLow: "--graview-lift-low",
  liftHigh: "--graview-lift-high",
  tintAlpha: "--graview-tint-alpha",
  tintLightness: "--graview-tint-lightness",
  gridAlpha: "--graview-grid-alpha",
};

export function themeVariables(tokens: ThemeTokens): string {
  return (Object.keys(VARIABLE) as (keyof ThemeTokens)[])
    .map((key) => `  ${VARIABLE[key]}: ${tokens[key]};`)
    .join("\n");
}

/**
 * The stylesheet an app drops in.
 *
 * Everything the primitives reference is a custom property, so a host can
 * override a single token without forking a component — and switching scheme
 * is one `replaceSync`, not a re-render.
 */
export interface ThemeCssOptions {
  /**
   * A selector to scope the theme to — an embed's root element — instead of
   * the document. The tokens land on that element and the ground, type and
   * color that `html, body` would have taken land there too, so a Graview
   * inside somebody else's page is themed without touching their page.
   *
   * Every other rule is held inside the box as well (FR-64): a selector is
   * written under `:where(<scope>)`, so it weighs what it weighed on a whole
   * page and reaches nothing of the host's. Only the reader's motion answer
   * is asked of the document element, and only to apply inside the box; the
   * registered custom property and the keyframes name no element.
   */
  readonly scope?: string;
}

/**
 * Everything that stops moving when motion is not wanted — as rules under
 * whichever root selector is asking for them.
 *
 * Motion is removed; the INFORMATION is not. A steady ring in the mover's
 * color says the same thing the pulse did, and someone who cannot take the
 * animation still gets to watch the system work.
 */
function stillness(asking: string, within: string): string {
  // The asking element and the element the rules live under are the same
  // thing for a whole page and two different things for an embed, where the
  // reader's answer is on the document and the rules must not escape the box.
  const at = asking === within ? asking : `${asking} ${within}`;
  return `  ${at} [data-graview-view] { transition: none; }
  ${at} [data-graview-touched] > * { animation: none; }
  ${at} [data-graview-view][data-graview-wrote] > *,
  ${at} [data-graview-view][data-graview-read] > * {
    animation: none;
    box-shadow: 0 0 0 2px var(--graview-activity);
  }
  ${at} [data-graview-view][data-graview-read] > * { box-shadow: 0 0 0 1px var(--graview-activity); }
  ${at} [data-graview-connector][data-graview-activity] { animation: none; stroke-opacity: 1; }`;
}

/*
 * WHY THE STYLESHEET'S NOTES ARE WRITTEN `${/* … *\/ ""}`. They were CSS
 * comments inside the template, and every page carried them — 25 KB of the
 * 60 this function was, shipped to each reader and parsed into each embed's
 * <style> (FR-57). As a JS comment in an empty interpolation the words stay
 * where they explain the rule, and a minifier folds them away.
 */
/*
 * THE SHEET WITHOUT THE SCENE (FR-104). What every face draws on: the
 * tokens, the type, the panels, the views as data, motion. The scene's own
 * rules — the districts from altitude, the plots, the village, the roads,
 * the billboards, the bands — are `sceneCss` (scene-css.ts), which the
 * scene face draws beside it, so a page that opens on the pages face
 * carries none of them. `themeCss` is the two together, in that order.
 */
export function themeBaseCss(
  scheme: Scheme = "dark",
  brand: Brand = GRAVIEW_BRAND,
  options: ThemeCssOptions = {},
): string {
  const css = baseSheet(scheme, brand, options);
  return options.scope === undefined ? css : withinTheBox(css, options.scope);
}

/*
 * A SCOPED STYLESHEET KEEPS TO ITS BOX (FR-64).
 *
 * The tokens, the ground and the type were written on the scope, but every
 * other rule was written for a whole page — `button`, `h1, h2, h3, h4`,
 * `code` — and an embed's <style> is a whole page's stylesheet: on Cloud's
 * builder the host's own buttons, below the studio, took the framework's
 * ink on a transparent ground and failed contrast in dark. Rather than
 * remember to scope each rule as it is written, the finished sheet is
 * rewritten: every selector that does not already start at the box is put
 * under `:where(<scope>)`. `:where` weighs nothing, so each rule wins and
 * loses exactly the contests it did on a whole page, and only where it
 * applies changes. What is not a style rule (a registered property, the
 * keyframes) names no element and is left as it is; @media and @supports
 * are walked into.
 */
export function withinTheBox(css: string, scope: string): string {
  const under = `:where(${scope}) `;
  const at = (selector: string) =>
    selector === scope ||
    selector.startsWith(`${scope} `) ||
    selector.startsWith(`${scope}:`) ||
    selector.startsWith(`${scope}[`) ||
    // The reader's motion answer: asked of the document, applied inside the box.
    (selector.startsWith(":root") && selector.includes(` ${scope} `));
  const rewrite = (prelude: string) => {
    const lead = prelude.match(/^\s*/)![0];
    const list = splitSelectors(prelude.trim()).map((selector) => (at(selector) ? selector : `${under}${selector}`));
    return `${lead}${list.join(", ")} `;
  };
  const walk = (text: string): string => {
    let out = "";
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open === -1) return out + text.slice(i);
      const close = blockEnd(text, open);
      const prelude = text.slice(i, open);
      const body = text.slice(open + 1, close);
      const name = prelude.trim().startsWith("@") ? prelude.trim().split(/[\s(]/)[0] : null;
      if (name === null) out += `${rewrite(prelude)}{${body}}`;
      else if (name === "@media" || name === "@supports" || name === "@container" || name === "@layer") out += `${prelude}{${walk(body)}}`;
      else out += `${prelude}{${body}}`;
      i = close + 1;
    }
    return out;
  };
  return walk(css);
}

/** The index of the brace that closes the block opened at `open`, past strings and comments. */
function blockEnd(text: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let j = open; j < text.length; j++) {
    const ch = text[j]!;
    if (quote) {
      if (ch === "\\") j++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "/" && text[j + 1] === "*") j = text.indexOf("*/", j + 2) + 1 || text.length;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return j;
  }
  return text.length;
}

/** A selector list split on its own commas — not those inside `:is(…)`, `[…]` or a string. */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const ch of list) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function baseSheet(scheme: Scheme, brand: Brand, options: ThemeCssOptions): string {
  const tokens = brand.schemes[scheme];
  const root = options.scope ?? ":root";
  const surface = options.scope ?? "html, body";
  /*
   * THE ROOT IS THE READER'S; ONLY THE BODY IS OURS TO SIZE.
   *
   * `font: 0.875rem` was set on `html, body` together, which means it was
   * set on the ROOT — so the root's own font-size became 0.875 of the
   * browser's, and every `rem` in the framework then resolved against 14px
   * instead of 16. A 0.78125rem label was 10.9px, not the 12.5 it was
   * written as, and a reader who had set their browser to 20px got 17.5.
   * Worse, it made the root font size unusable as the one place a text-size
   * setting can be honored, because the stylesheet was already occupying
   * it. The body is sized; the root is left exactly as the person has it.
   */
  const text = options.scope ?? "body";
  /*
   * WHERE THE READER'S MOTION ANSWER IS WRITTEN.
   *
   * On the document element, always — it is a fact about the person, not
   * about one embed. A scoped stylesheet therefore asks about the document
   * and applies WITHIN its own box, so an embed on somebody else's page
   * still honors a Graview host's setting without restyling anything of
   * the host's. Nothing is emitted at `:root { ... }` in a scoped
   * stylesheet, which is the rule an embed must not break.
   */
  const motionRoot = ":root";
  /*
   * Shape, type and the iso lighting are @graview/core's (`SHAPE`,
   * `TYPOGRAPHY`, `isoShade`), resolved against the brand — read here, never
   * restated, so a host that dresses its own pages from core cannot drift
   * from this sheet (FR-73).
   */
  const shape = shapeOf(brand);
  const type = typographyOf(brand);
  const kit = resolveKit(brand.kit);
  return `${root} {
${themeVariables(tokens)}
${kitVariables(kit)}
${/* THE LAYER LADDER (FR-76): every rung a surface may stand on, written once. */ ""}
${layerVariables()}
  --graview-font-body: ${type.body};
  --graview-font-display: ${type.display};
  --graview-font-mono: ${type.mono};
  ${/* Shape, as tokens, so a component never has to know whose product it is. */ ""}
  --graview-radius: ${shape.radius}px;
  --graview-radius-sm: ${shape.radiusSmall}px;
  --graview-pad: ${shape.pad}px;
  --graview-pad-sm: ${shape.padSmall}px;
  --graview-gap: ${shape.gap}px;
  color-scheme: ${scheme};
}

${surface} {
  margin: 0;
  background: var(--graview-ground-deep);
  color: var(--graview-ink);
}

${/*
 * THE READER'S OWN TEXT SIZE.
 *
 * Every size in the framework was once an absolute pixel count, so somebody
 * who sets a larger default font in their browser — the setting WCAG 1.4.4
 * is about — got a Graview that ignored them completely. 0.875rem is 14px
 * at the default 16px root, so nothing moves for anyone who has not asked
 * for anything, and everything moves together for anyone who has.
 */ ""}
${text} {
  font: 0.875rem/1.55 var(--graview-font-body);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

${/* Headings and the wordmark take the display face when a brand supplies one,
   and the body face when it does not — so a brand with one font is not asked
   to name it twice. */ ""}
h1, h2, h3, h4, .graview-wordmark { font-family: var(--graview-font-display); }
${/* The app's mark (FR-124) is as tall as the box it is drawn in; its own width follows. */ ""}
.graview-logo > svg { display: block; height: 100%; width: auto; }
code, kbd, samp { font-family: var(--graview-font-mono); }

${/*
 * A KIND'S FIGURE fills the box it is given.
 *
 * The art declares its own viewBox and knows nothing about where it is
 * drawn — a chip at twelve pixels, a district's heading at eighteen, a kind
 * card's landmark at forty — so the SIZE is the container's and the drawing
 * scales into it. currentColor on the strokes means the kind's own hue
 * arrives through the cascade without the art being redrawn.
 */ ""}
[data-graview-figure] > svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

${/* How far above the stack the camera is, 0..1 — REGISTERED so it can
   transition. Rising to the Graview morphs the scene instead of cutting:
   the square grid dissolves into the iso lattice and the districts grow up
   out of their cards, all riding this one number. */ ""}
@property --graview-altitude {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

${/* The ground: a slow wash, so depth has something to recede into. */ ""}
.graview-ground {
  position: relative;
  ${/* THE SCENE'S RUNG, AND A STACKING CONTEXT OF ITS OWN (FR-76): the
     plots, the cards, the lines and the zoom are ordered among themselves
     (SCENE_LAYERS) and none of them can stand over a rail beside it. */ ""}
  isolation: isolate;
  z-index: ${layer("scene")};
  background: var(--graview-wash), var(--graview-ground);
  --graview-altitude: 0;
  transition: --graview-altitude 640ms cubic-bezier(0.33, 0, 0.2, 1);
}

${/*
 * The altitude control rides the SAME number the scene rides — its own copy,
 * because it sits beside the ground rather than inside it — on the same
 * curve. So the mark morphs exactly as long as the scene does, and where an
 * engine cannot register the property, both cut together: one mechanism,
 * and no way for the control and the picture to disagree about the change.
 */ ""}
.graview-altitude-control {
  --graview-altitude: 0;
  transition:
    --graview-altitude 640ms cubic-bezier(0.33, 0, 0.2, 1),
    color 240ms ease,
    border-color 240ms ease;
}
.graview-altitude-mark * {
  transform-box: fill-box;
  transform-origin: center;
}
${/* The ring of three kinds tightens to one ring around one node. */ ""}
.graview-altitude-mark-ring {
  transform: scaleX(calc(1 - 0.48 * var(--graview-altitude)));
  opacity: calc(0.55 + 0.4 * var(--graview-altitude));
}
.graview-altitude-mark-apex {
  transform: translateY(calc(2.6px * var(--graview-altitude)));
}
${/* The two wings gather into the center and give their ink to the apex. */ ""}
.graview-altitude-mark-wing {
  opacity: calc(0.75 * (1 - var(--graview-altitude)));
}
.graview-altitude-mark-wing[data-side="left"] {
  transform: translate(calc(4.4px * var(--graview-altitude)), calc(-0.8px * var(--graview-altitude)));
}
.graview-altitude-mark-wing[data-side="right"] {
  transform: translate(calc(-4.4px * var(--graview-altitude)), calc(-0.8px * var(--graview-altitude)));
}

${/* A fine measure under the scene. Faint enough to feel like calibration
   rather than graph paper, and it fades out at the edges so the scene has no
   hard boundary. */ ""}
.graview-ground::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--graview-edge) 1px, transparent 1px),
    linear-gradient(90deg, var(--graview-edge) 1px, transparent 1px);
  background-size: var(--graview-kit-grid-size, 64px) var(--graview-kit-grid-size, 64px);
  opacity: calc(var(--graview-kit-grid, 1) * var(--graview-grid-alpha) * (1 - var(--graview-altitude)));
  mask-image: radial-gradient(120% 90% at 50% 40%, #000 30%, transparent 78%);
}

${/* Content that scrolls inside a panel, and SAYS SO.
 *
 * A pure-CSS scroll shadow: two cover gradients painted in the panel's own
 * ground scroll with the content, two shadows stay put, and so a shadow
 * only shows at an edge there is more content past. No
 * JavaScript, no measurement, and nothing to go stale — which matters
 * because the failure it prevents is silent. macOS hides overlay scrollbars
 * until you scroll, so without this a clipped list looks like a finished
 * one. */ ""}
.graview-scroll {
  overflow: auto;
  min-height: 0;
  background:
    linear-gradient(var(--graview-panel-bg, var(--graview-panel)) 30%, transparent) center top,
    linear-gradient(transparent, var(--graview-panel-bg, var(--graview-panel)) 70%) center bottom,
    radial-gradient(farthest-side at 50% 0, ${scheme === "light" ? "rgba(20,30,32,0.30)" : "rgba(0,0,0,0.7)"}, transparent) center top,
    radial-gradient(farthest-side at 50% 100%, ${scheme === "light" ? "rgba(20,30,32,0.30)" : "rgba(0,0,0,0.7)"}, transparent) center bottom;
  background-repeat: no-repeat;
  background-size: 100% 24px, 100% 24px, 100% 10px, 100% 10px;
  background-attachment: local, local, scroll, scroll;
}
${/* "There is more of this", said by the ground: a few pixels of the panel's
 * own color over the last row, stuck to the bottom of what scrolls. */ ""}
.graview-scroll[data-graview-overflowing]::after {
  content: "";
  position: sticky;
  bottom: 0;
  flex: 0 0 14px;
  margin-top: calc(-14px - var(--graview-gap, 7px));
  background: linear-gradient(transparent, var(--graview-panel-bg, var(--graview-panel)));
  pointer-events: none;
}

${/* A card on the kinds plane.
 *
 * Title and count only at rest — a strip of ten cards each showing three
 * truncated member names is ten unreadable things, and the members are not
 * what you are asking the strip. Hovering lifts one and reveals the kind's
 * own description, which the declaration has always carried and nothing has
 * ever shown. */ ""}
.graview-kind-card {
  height: 100%;
  transition: transform 170ms cubic-bezier(0.22, 1, 0.36, 1), height 170ms ease,
    box-shadow 170ms ease;
  ${/* IN THE STACK NOTHING HANGS BELOW A CARD. The iso block rests eighteen
     pixels low there, invisible, ready to rise — and an invisible box that
     pokes under the bottom row still made the stage scroll by nine pixels
     with nowhere to scroll. Clipped (not hidden: no scroll container, no
     scrollable overflow), and let out again from altitude, where the plate
     floats above the card and the block stands up out of it. */ ""}
  overflow: clip;
}
.graview-kind-card:hover,
.graview-kind-card:focus-within {
  height: auto;
  transform: translateY(-4px) scale(1.05);
  box-shadow: var(--graview-lift-high);
  position: relative;
  z-index: ${SCENE_LAYERS.lines};
}

${/* FROM ALTITUDE the ground is an ISOMETRIC LATTICE — diamond cells at the
   classic 2:1 pitch, a finer far weave above, dissolving toward the
   horizon. Always present, faded by the altitude number, so rising
   CROSSFADES the square grid into the lattice instead of cutting. */ ""}
${/* DRAWN AS TILES, one cell each. A repeating gradient at the lattice's
   angle was phased from the middle of the box and seamed at the box's own
   edge when repeated with an offset, so the lines never sat where the
   city's cells were: a plot stood beside the grid, not on it. Each tile is
   one cell wide and half a cell tall — the diamond's bounding box — with
   the tile's two diagonals drawn across it, which is the whole lattice:
   corners and centers of the tiles are its vertices, and a tile corner is
   pinned where the city's cell (0,0) meets the canvas. The far weave is the
   same tile at half size. */ ""}
.graview-ground::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  --graview-lattice-tile: var(--graview-lattice-cell, calc(var(--graview-kit-lattice-size, 46px) * 2.2361));
  --graview-lattice-line: var(--graview-edge);
  background-image:
    linear-gradient(to top right, transparent calc(50% - 0.5px), var(--graview-lattice-line) calc(50% - 0.5px), var(--graview-lattice-line) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    linear-gradient(to top left, transparent calc(50% - 0.5px), var(--graview-lattice-line) calc(50% - 0.5px), var(--graview-lattice-line) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    linear-gradient(to top right, transparent calc(50% - 0.5px), var(--graview-lattice-line) calc(50% - 0.5px), var(--graview-lattice-line) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    linear-gradient(to top left, transparent calc(50% - 0.5px), var(--graview-lattice-line) calc(50% - 0.5px), var(--graview-lattice-line) calc(50% + 0.5px), transparent calc(50% + 0.5px));
  background-size:
    var(--graview-lattice-tile) calc(var(--graview-lattice-tile) / 2),
    var(--graview-lattice-tile) calc(var(--graview-lattice-tile) / 2),
    calc(var(--graview-lattice-tile) / 2) calc(var(--graview-lattice-tile) / 4),
    calc(var(--graview-lattice-tile) / 2) calc(var(--graview-lattice-tile) / 4);
  ${/* Anchored where the city's cell (0,0) meets the canvas, so a plot placed
     by the map sits ON the grid a person can see, and pans with it. */ ""}
  background-position: var(--graview-lattice-x, 0px) var(--graview-lattice-y, 0px);
  ${/* Twice the square grid's weight: fields are meant to be seen, the grid is meant to be felt. */ ""}
  opacity: calc(var(--graview-kit-lattice, 1) * var(--graview-grid-alpha) * 2 * var(--graview-altitude));
  mask-image: linear-gradient(to top, #000 42%, rgba(0,0,0,0.35) 70%, transparent 92%);
  -webkit-mask-image: linear-gradient(to top, #000 42%, rgba(0,0,0,0.35) 70%, transparent 92%);
}

${/* THE KEEPER'S BLOCK IN THE PROFILE, which hides itself when it is empty.
   Both controls inside it draw nothing for a seat that may not administer,
   and a heading with nothing under it is worse than no heading — so the
   block is drawn only when it actually holds a control. */ ""}
.graview-profile-keeping { display: grid; gap: 6px; }
.graview-profile-keeping:not(:has(button, a)) { display: none; }
.graview-profile-keeping > * { justify-self: start; }
${/* A host's own action in the profile (FR-72): a row of the pane, lit where the pointer or the keyboard is. */ ""}
.graview-host-action:hover,
.graview-host-action:focus-visible {
  background: var(--graview-wash);
  color: var(--graview-accent);
}
${/* The district-open control and its roster: altitude-only chrome. Inside
   the stack expanding dissolves a card, so the control does not exist
   there. A full fingertip even though the glyph is small — the audit holds
   every control to 24px. */ ""}
.graview-kind-open { display: none; }
${/* The roster reads as a LIST, one member a row — chips wrapping at their
   own widths read as spilled tiles, and a district's population is a roll
   call, not a mosaic. */ ""}
${/* THE PLACES, as text tabs (FR-117): the place you are on underlined, the
   others the ink's quieter shade until reached for; a row longer than its
   room scrolls, with no bar drawn under it. */ ""}
.graview-places::-webkit-scrollbar { display: none; }
.graview-place-tab:hover { color: var(--graview-ink) !important; border-bottom-color: var(--graview-edge-bright, var(--graview-edge)) !important; }
.graview-place-tab[aria-pressed="true"]:hover { border-bottom-color: var(--graview-accent) !important; }
.graview-place-tab:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: -2px; }
${/* A DRIVE-IN: a dark screen standing on the plot, and the showings under
   it as a marquee of real buttons. Only from altitude; the same list the
   places tabs carry, drawn where the pictures live. */ ""}
.graview-drive-in {
  ${/* Its own block under the nameplate, never a row inside the pill: the
     pill is one line of name and count, and a marquee flattened into it
     read as "12 • shown above The month The week". On a box the pill sits
     on the roof at the top of the card, so the marquee hangs under it; on
     a landmark the pill floats above the card, so the marquee takes the
     card's own top edge. */ ""}
  position: absolute;
  left: 50%;
  top: 42px;
  transform: translateX(-50%);
  z-index: ${SCENE_LAYERS.lines};
  display: grid;
  justify-items: center;
  gap: 4px;
  animation: graview-settle 240ms ease backwards;
}
[data-graview-landmark] .graview-drive-in {
  top: 4px;
}
${/* THE SHOWINGS, BY NAME (FR-118): a column of names hanging off the
   signpost's post, each whole and wrapped rather than cut, the one showing
   now marked by the post's rule in the accent. Words on the ground, haloed
   in the ground's color like the district's own name — no capsules, no
   pictures drawn too small to read. */ ""}
.graview-drive-in-marquee {
  display: grid;
  gap: ${MARQUEE_GAP}px;
  width: ${MARQUEE_WIDTH}px;
  justify-items: stretch;
}
.graview-drive-in-thumb {
  position: relative;
  display: block;
  box-sizing: border-box;
  min-height: max(1.5rem, 24px);
  padding: 3px 6px 3px 10px;
  border-left: 2px solid var(--graview-edge-bright, var(--graview-edge));
  color: var(--graview-ink);
  font: inherit;
  text-align: left;
}
.graview-drive-in-thumb[data-graview-pressed] {
  border-left-color: var(--graview-accent);
  color: var(--graview-accent);
}
${/* The press: the whole name, laid over it. */ ""}
.graview-drive-in-thumb-press {
  position: absolute;
  inset: 0;
  min-height: max(1.5rem, 24px);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0 4px 4px 0;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
}
.graview-drive-in-thumb-press:hover {
  background: color-mix(in srgb, var(--graview-accent) 8%, transparent);
}
.graview-drive-in-thumb-press:focus-visible {
  outline: 2px solid var(--graview-accent);
  outline-offset: 1px;
}
.graview-drive-in-thumb-title {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
  overflow-wrap: anywhere;
  text-shadow: 0 0 3px var(--graview-ground), 0 0 6px var(--graview-ground);
}
.graview-drive-in-thumb[data-graview-pressed] .graview-drive-in-thumb-title {
  font-weight: 600;
}

${/* THE OTHERS: people and their agents in the city, each a small figure in
   the scene's own line vocabulary with a name under it. They move by a
   transition on transform — one number, the layout tween's curve — so a
   quiet city runs nothing. This tab's own seat is not drawn here: the
   companion on the frame is where it speaks. */ ""}
.graview-occupants {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: ${SCENE_LAYERS.occupants};
}
.graview-figure {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  transition: transform 420ms cubic-bezier(0.33, 0, 0.2, 1);
  will-change: transform;
}
.graview-figure-body {
  position: absolute;
  left: -16px;
  top: -38px;
  width: 32px;
  height: 38px;
  min-height: max(1.5rem, 24px);
  padding: 0;
  border: 0;
  background: transparent;
  color: hsl(var(--graview-hue, 200) 50% 48%);
  cursor: pointer;
  pointer-events: auto;
  border-radius: 6px;
}
.graview-figure-body:focus-visible {
  outline: 2px solid var(--graview-accent);
  outline-offset: 2px;
}
.graview-figure-body svg {
  display: block;
  width: 32px;
  height: 38px;
  overflow: visible;
}
.graview-figure[data-graview-mode="following"] .graview-figure-body {
  color: var(--graview-accent);
}
.graview-figure[data-graview-mode="refused"] .graview-figure-body {
  color: var(--graview-warn);
}
.graview-figure-name {
  position: absolute;
  left: 50%;
  top: 2px;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--graview-ink-muted);
  pointer-events: none;
}
${/* ANOTHER PERSON, on your map: a head and shoulders in their own hue, at
   the plot their stop names or in the audience row of the showing they are
   watching. Press to follow them; their name is under them like a robot's. */ ""}
.graview-figure[data-graview-person] .graview-figure-body {
  left: -11px;
  top: -24px;
  width: 22px;
  height: 24px;
  min-height: 0;
}
.graview-figure[data-graview-person] .graview-figure-body svg {
  width: 22px;
  height: 24px;
}
.graview-figure[data-graview-person][data-graview-followed] .graview-figure-body {
  color: var(--graview-accent);
}
${/* Their robot, beside them, captioned as theirs. */ ""}
.graview-figure[data-graview-theirs] .graview-figure-body {
  opacity: 0.85;
}
${/* More than a row can hold, and the anonymous: a number where they stand. */ ""}
.graview-figure-count {
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-float);
  color: var(--graview-ink-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: auto;
}
${/* What somebody else is pointing at, outlined in their color. */ ""}
.graview-presence-over {
  position: absolute;
  border: 2px solid hsl(var(--graview-hue, 200) 55% 52%);
  border-radius: 8px;
  pointer-events: none;
  opacity: 0.75;
  transition: left 200ms ease, top 200ms ease, width 200ms ease, height 200ms ease;
}
${/* Off the visible ground: an indicator at the border, pointing at it. */ ""}
.graview-figure-edge {
  position: absolute;
  min-height: max(1.5rem, 24px);
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-float);
  color: var(--graview-ink-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
}

.graview-kind-members {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  margin-top: 7px;
  animation: graview-settle 240ms ease backwards;
}

${/* The way into the archive, on the card that fed it: quiet, but a real
   control at a real size. */ ""}
.graview-kind-past {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  ${/* The same floor as the disclosure beside it — see .graview-kind-open. */ ""}
  min-height: max(1.5rem, 24px);
  padding: 1px 8px;
  margin: -3px 0;
  border-radius: 999px;
  border: 1px dashed var(--graview-edge);
  background: none;
  box-shadow: none;
  color: var(--graview-ink-faint);
  cursor: pointer;
  font-size: 0.75rem;
  white-space: nowrap;
}
.graview-kind-past:hover {
  color: var(--graview-accent);
  border-color: var(--graview-accent-dim);
}

${/* A SEARCH OVER THE CITY. The districts the words found are lit and say how
   many; the rest recede — the same dimming a selection's reach has always
   used, so a search reads as "where the thing is", not as a new mode. The
   count is the way in: a real control, the words carried down. */ ""}
.graview-kind-card[data-graview-emphasis="dimmed"] {
  opacity: 0.42;
  transition: opacity 160ms ease;
}
.graview-kind-card[data-graview-emphasis="lit"] {
  z-index: ${SCENE_LAYERS.stage};
}
.graview-kind-card[data-graview-emphasis="lit"] .graview-kind-face {
  border-color: var(--graview-accent) !important;
  box-shadow: 0 0 0 1px var(--graview-accent-dim);
}
.graview-kind-hits {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: max(1.5rem, 24px);
  padding: 1px 8px;
  margin: -3px 0;
  border-radius: 999px;
  border: 1px solid var(--graview-accent);
  background: none;
  box-shadow: none;
  color: var(--graview-accent);
  cursor: pointer;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .graview-kind-card[data-graview-emphasis="dimmed"] { transition: none; }
}

${/* Chrome that arrives with a state settles in rather than popping. */ ""}
@keyframes graview-settle {
  from { opacity: 0; transform: translateY(7px); }
}

${/* A district STANDS: an isometric block — roof, two shaded walls — whose
   height is its population. Always in the tree, faded and settled by the
   altitude number: rising, each block grows up out of its card while the
   card flies to its ring stop — a morph, not a cut. At altitude zero it is
   fully transparent and costs nothing. */ ""}
.graview-kind-block {
  display: block;
  ${/* Architecture, not a control: clicks fall through to the card, and an
     invisible in-stack block must never sit over a neighbor's tuck. */ ""}
  pointer-events: none;
  position: absolute;
  left: 8%;
  bottom: 2px;
  width: 84%;
  height: auto;
  ${/* Under a marquee the block keeps out of its band: the drawing scales down inside the box. */ ""}
  max-height: calc(100% - var(--graview-marquee-room, 0px));
  opacity: var(--graview-altitude);
  transform: translateY(calc((1 - var(--graview-altitude)) * 18px));
  filter: drop-shadow(${
    scheme === "light" ? "10px 7px 14px rgba(20,30,32,0.28)" : "12px 8px 18px rgba(0,0,0,0.6)"
  });
}

${/* WHERE THE KIND HAS ITS OWN DRAWING, the drawing is the building.
   Same footprint as the block, same ground line, same cast shadow — the
   difference is that the district is now a person, a plot or a vehicle
   rather than one more box. Size carries the population the box's height
   used to: the rise the card computed, in a channel a drawing can use.

   Stroke weight is set HERE rather than in the art, because the art is
   drawn to read at twenty pixels and a 1.4-unit stroke on a 24-unit box
   becomes a six-pixel marker line at a hundred. Thinned to a drafting
   line, which is what a blueprint of a thing looks like. */ ""}
.graview-kind-landmark {
  display: block;
  left: 50%;
  ${/* The block's own two pixels of ground clearance, kept: at altitude zero
     every block is pushed eighteen pixels down as part of the morph, and
     without them the drawing hangs two pixels past the bottom of the scene
     and gives the whole page a scrollbar's worth of overflow. */ ""}
  bottom: 2px;
  aspect-ratio: 1;
  ${/* Sized by the card's HEIGHT, not its width: a district card is wider
     than it is tall, and a square drawing at 96% of the width stood a third
     of itself above the card and back through the nameplate. Population is
     in the drawing's size either way — the same rise the box's height
     carried, 10 for a district of one and 46 for the largest. */ ""}
  height: calc((100% - var(--graview-marquee-room, 0px)) * (0.72 + var(--graview-rise, 24) * 0.008));
  width: auto;
  ${/* AND IT KEEPS UP WITH THE WORDS. The card is laid out in pixels off the
     stage and the nameplate is sized in rem, so a reader on Largest doubled
     every name in the city while every drawing under one stayed exactly the
     size it was — a postage stamp under a headline. A floor in em ties the
     drawing to the same number the names follow; at the browser's own size
     it is below what the card already gives and nothing moves.

     Capped at the card, because a floor alone overflowed it: the drawings
     grew past the box they stand in and were sliced off at the bottom
     edge — a plot that reads as a V rather than a bed. The card's own
     height is what the picture can actually show, and the CARD is the thing
     that still does not follow the reader's size (see below).

     (No back ticks in here: this whole stylesheet is a template literal,
     and one of them ends it.) */ ""}
  min-height: min(5em, calc(96% - var(--graview-marquee-room, 0px)));
  ${/* The morph is a GROWTH from the ground line, not a drop: a block slides
     eighteen pixels down at altitude zero and grows up out of the card, and
     a drawing given the same treatment hangs below the card it belongs to —
     two pixels past the bottom of the scene on the lowest row, which is a
     scrollbar on every ground-level screen in the app. Scaling from the
     drawing's own feet is the same reading and costs nothing below. */ ""}
  transform-origin: bottom center;
  transform: translateX(-50%) scale(calc(0.55 + var(--graview-altitude) * 0.45));
  ${/* A cast shadow belongs to a solid; on a line drawing it is a blurred
     second copy of every stroke. The drawing keeps a hint of one so it
     still stands on the lattice rather than floating over it. */ ""}
  filter: drop-shadow(${
    scheme === "light" ? "6px 5px 7px rgba(20,30,32,0.16)" : "7px 6px 9px rgba(0,0,0,0.45)"
  });
}
${/* The nameplate floats ABOVE a drawing rather than standing on it. On a box
   the pill sits on the roof, which is what a label does over a building; on
   a figure the same 2% put it across the head. */ ""}

.graview-kind-landmark [data-graview-figure] {
  width: 100% !important;
  height: 100% !important;
  color: hsl(var(--graview-hue, 200) ${scheme === "light" ? "42% 44%" : "45% 62%"}) !important;
}
.graview-kind-landmark svg {
  width: 100%;
  height: 100%;
  stroke-width: 0.85;
}

${/* From altitude the card's face becomes the district's NAMEPLATE: an
   upright pill standing on the roof, the way a label floats over a building
   in any city view — the block carries the architecture, the pill carries
   the words. Inline styles drew the in-stack card, so the pill overrides
   must outrank them. */ ""}
.graview-kind-face {
  transition: border-radius 640ms cubic-bezier(0.33, 0, 0.2, 1),
    padding 640ms cubic-bezier(0.33, 0, 0.2, 1),
    box-shadow 640ms ease;
}

[data-graview-pick] {
  cursor: pointer;
  transition: filter 140ms ease, box-shadow 140ms ease;
}
[data-graview-pick]:hover {
  filter: brightness(${scheme === "light" ? 0.96 : 1.18});
}
[data-graview-pick]:focus-visible {
  outline: 2px solid var(--graview-accent);
  outline-offset: 2px;
  border-radius: 7px;
}
${/* On a board the keyboard ring hugs the DISC, not the disc-plus-label
   group: a rectangle drawn around a circle read as a mystery box on the
   pitch ("why does Left Midfield have this box?"), when all it ever said
   was "the keyboard is here". */ ""}
[data-graview-slot]:focus-visible {
  outline: none;
}
[data-graview-slot]:focus-visible > span:first-of-type {
  box-shadow: 0 0 0 2px var(--graview-ground), 0 0 0 4px var(--graview-accent);
}

${/* A view is a thing you can act on. It should look like one. */ ""}
[data-graview-view] { cursor: pointer; }
[data-graview-view]:hover { filter: brightness(${scheme === "light" ? 0.985 : 1.12}); }
[data-graview-view]:focus-visible {
  outline: 2px solid var(--graview-accent);
  outline-offset: 3px;
  border-radius: 12px;
}

button {
  font: inherit;
  color: var(--graview-ink);
  padding: 7px 13px;
  border: 1px solid var(--graview-edge);
  border-radius: var(--graview-radius-sm, 8px);
  background: var(--graview-panel);
  box-shadow: ${scheme === "light" ? "0 1px 2px rgba(20,30,32,0.05)" : "none"};
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}
button:hover:not(:disabled) {
  border-color: var(--graview-edge-bright);
  box-shadow: ${
    scheme === "light"
      ? "0 1px 2px rgba(20,30,32,0.06), 0 6px 16px -8px rgba(20,30,32,0.22)"
      : "0 0 0 1px var(--graview-accent-dim), 0 0 18px -6px var(--graview-accent)"
  };
}
button:focus-visible {
  outline: 2px solid var(--graview-accent);
  outline-offset: 2px;
}
button:disabled { opacity: 0.45; cursor: default; }

code { color: var(--graview-ink-muted); font-size: 0.8125rem; letter-spacing: 0.02em; }

${/* A view host, once the scene has placed it. The transition is on filter
   only — never on layout properties, which would make every navigation
   reflow the page. */ ""}
[data-graview-view] {
  transition: filter 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

${/* WHAT YOU CAN PRESS IS WHAT YOU CAN SEE.

   A host is the box the LAYOUT gave a view — a band on the ground, the whole
   scene scaled small from altitude — and a view that sizes to its content
   fills only part of it. The rest is invisible, and an invisible box must
   not be a target: a record read from altitude and pinned beside a district
   covered that district's open button with nothing at all, and the button
   stopped answering. So the host itself is out of hit-testing on the DOM
   path and only the drawn content is in; every handler still hears the
   content's events on the way up. The GPU path keeps its own rule: there
   the whole subtree stays out, because the platform's hit-test descending
   into a captured view brings the renderer down. */ ""}
[data-graview-stage="dom"] [data-graview-view],
[data-graview-stage="dom"] [data-graview-view] > [data-graview-natural] {
  pointer-events: none;
}

${/* A node implicated by the last change, whoever made it. The pulse is the
   same for a human edit and an agent edit, because the diff is. */ ""}
${/* THE SEAT'S MARK on what it just wrote: its own glyph, in its own hue, at
   the thing's top-right corner. It arrives with the change and fades with
   it; the companion's log is what remembers. */ ""}
.graview-seat-marks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: ${SCENE_LAYERS.seatMarks};
}
.graview-seat-mark {
  position: absolute;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-float);
  color: oklch(0.62 0.16 var(--graview-hue, 250));
  font-size: 0.6875rem;
  line-height: 1;
  box-shadow: var(--graview-lift-low);
  animation: graview-seat-mark 4000ms ease-out forwards;
}
${/* A QUESTION THE SEAT ASKED, standing at the node it is about: it says
   itself and waits, because a dot nobody can read is a question nobody
   answers. It does not fade — an unanswered question is still open. */ ""}
.graview-seat-asking {
  position: absolute;
  transform: translate(-50%, -100%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  padding: 3px 9px 3px 6px;
  border-radius: 999px;
  border: 1px solid var(--graview-accent);
  background: var(--graview-float);
  color: var(--graview-ink);
  font-size: 0.75rem;
  line-height: 1.3;
  box-shadow: var(--graview-lift-low);
  pointer-events: auto;
}
.graview-seat-asking > [aria-hidden] {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--graview-accent);
  color: var(--graview-panel);
  font-size: 0.6875rem;
}
.graview-seat-asking-said {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes graview-seat-mark {
  0% { opacity: 0; transform: translateY(3px) scale(0.8); }
  8% { opacity: 1; transform: none; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes graview-touched {
  0%   { box-shadow: 0 0 0 0 var(--graview-accent-dim); }
  35%  { box-shadow: 0 0 26px 3px var(--graview-accent-dim); }
  100% { box-shadow: 0 0 0 0 transparent; }
}

@keyframes graview-landed {
  0%   { box-shadow: 0 0 0 0 var(--graview-activity); opacity: 0.55; }
  30%  { box-shadow: 0 0 30px 4px var(--graview-activity); opacity: 1; }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
}

${/* What an agent READ is the half a diff cannot show, and the half that says
   whether to trust what it then did. Quieter than a write on purpose: it is
   evidence of attention, not of a change. */ ""}
@keyframes graview-considered {
  0%   { outline-color: transparent; }
  25%  { outline-color: var(--graview-activity); }
  100% { outline-color: transparent; }
}

${/* A relation made or broken: both ends were written, so the line between
   them is the thing that changed. */ ""}
@keyframes graview-relation {
  0%   { stroke-opacity: 0.28; stroke-width: 1.4; }
  30%  { stroke-opacity: 1; stroke-width: 3; }
  100% { stroke-opacity: 0.28; stroke-width: 1.4; }
}

${/*
 * MOTION, ASKED OF THE SYSTEM AND OVERRIDABLE BY THE PERSON.
 *
 * The system's own preference is the default and always was. The "motion"
 * setting (see readerSettings) stamps data-graview-motion on the root
 * element when — and only when — a reader overrides it: "reduce" turns the same
 * rules on for somebody whose system says otherwise, and "full" turns them
 * off for somebody whose system says reduce and who wants the movement
 * here anyway. Choosing "as your system has it" removes the attribute, so
 * the media query is what answers again.
 *
 * Written as one rule list under two selectors rather than duplicated,
 * because a stylesheet where the two copies can drift is a stylesheet where
 * they will.
 */ ""}
@media (prefers-reduced-motion: reduce) {
  .graview-figure { transition: none; }
${stillness(`${motionRoot}:not([data-graview-motion='full'])`, text)}
}
${stillness(`${motionRoot}[data-graview-motion='reduce']`, text)}

${/* VIEWS AS DATA (FR-03): the blocks a view spec is drawn with, over the tokens above. */ ""}
${SPEC_VIEW_CSS}`;
}
