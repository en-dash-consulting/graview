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
import { DISPLAY_TRACKING, SCHEMES, kitVariables, layer, layerVariables, resolveKit, shapeOf, TYPOGRAPHY, typographyOf } from "@graview/core";


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
 * tokens, the type, the panels, motion. The scene's own rules — the
 * districts from altitude, the plots, the village, the roads, the
 * billboards, the bands, the district's card and drive-in, the altitude
 * control, the others in the city and the seat's marks — are `sceneCss`
 * (scene-css.ts), which the scene
 * face draws beside it, so a page that opens on the pages face carries none
 * of them; and the blocks a view spec is drawn with are `viewsCss`, which
 * every face that draws a view draws beside it (FR-131), so the frame
 * stands — the bar, the notices — before them. `themeCss` is all three.
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
  ${/* The weights: headings, reading text, action labels (the identity's 550, 450 and 600 on its own face). */ ""}
  --graview-weight-display: ${type.weights.display};
  --graview-weight-body: ${type.weights.body};
  --graview-weight-label: ${type.weights.label};
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
  font-weight: var(--graview-weight-body);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

${/* Headings and the wordmark take the display face when a brand supplies one,
   and the body face when it does not — so a brand with one font is not asked
   to name it twice. */ ""}
h1, h2, h3, h4, .graview-wordmark { font-family: var(--graview-font-display); font-weight: var(--graview-weight-display); }
h1, h2 { letter-spacing: ${DISPLAY_TRACKING}; }
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
${/* THE PLACES, as text tabs (FR-117): the place you are on underlined, the
   others the ink's quieter shade until reached for; a row longer than its
   room scrolls, with no bar drawn under it. */ ""}
.graview-places::-webkit-scrollbar { display: none; }
.graview-place-tab:hover { color: var(--graview-ink) !important; border-bottom-color: var(--graview-edge-bright, var(--graview-edge)) !important; }
.graview-place-tab[aria-pressed="true"]:hover { border-bottom-color: var(--graview-accent) !important; }
.graview-place-tab:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: -2px; }


${/* Chrome that arrives with a state settles in rather than popping. */ ""}
@keyframes graview-settle {
  from { opacity: 0; transform: translateY(7px); }
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
  border-radius: var(--graview-radius);
}

button {
  font: inherit;
  font-weight: var(--graview-weight-label);
  color: var(--graview-ink);
  padding: 7px 13px;
  border: 1px solid var(--graview-edge);
  border-radius: var(--graview-radius-sm, 8px);
  background: var(--graview-panel);
  box-shadow: ${scheme === "light" ? "0 1px 2px rgba(24,33,58,0.05)" : "none"};
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}
${/* Hover firms the edge; it does not glow. A ring the accent's width says "this one" in both schemes. */ ""}
button:hover:not(:disabled) {
  border-color: var(--graview-edge-bright);
  box-shadow: ${scheme === "light" ? "0 1px 2px rgba(24,33,58,0.06), 0 6px 16px -8px rgba(24,33,58,0.2)" : "0 0 0 1px var(--graview-accent-dim)"};
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
${stillness(`${motionRoot}:not([data-graview-motion='full'])`, text)}
}
${stillness(`${motionRoot}[data-graview-motion='reduce']`, text)}`;
}
