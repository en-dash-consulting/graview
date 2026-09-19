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
 *   scheme would give grey-on-grey mush, because glow does not exist in
 *   daylight.
 *
 * One rule holds across both: **secondary text is a colour, never an
 * opacity.** Opacity composites against whatever is behind and fails contrast
 * silently. axe-core checks this on every run of `scripts/run-a11y.mjs`.
 */

/*
 * The token CONTRACT lives in `@graview/core`, not here.
 *
 * A theme is a declaration, and `graview check` reads declarations — so a
 * brand's palette can be verified before it ships rather than after somebody
 * files a bug about grey-on-grey. What lives here is the two the framework
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
import { SCHEMES, kitVariables, resolveKit } from "@graview/core";


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
  typography: {
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
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
   * colour that `html, body` would have taken land there too, so a Graview
   * inside somebody else's page is themed without touching their page.
   */
  readonly scope?: string;
}

/**
 * Everything that stops moving when motion is not wanted — as rules under
 * whichever root selector is asking for them.
 *
 * Motion is removed; the INFORMATION is not. A steady ring in the mover's
 * colour says the same thing the pulse did, and someone who cannot take the
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

export function themeCss(
  scheme: Scheme = "dark",
  brand: Brand = GRAVIEW_BRAND,
  options: ThemeCssOptions = {},
): string {
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
   * setting can be honoured, because the stylesheet was already occupying
   * it. The body is sized; the root is left exactly as the person has it.
   */
  const text = options.scope ?? "body";
  /*
   * WHERE THE READER'S MOTION ANSWER IS WRITTEN.
   *
   * On the document element, always — it is a fact about the person, not
   * about one embed. A scoped stylesheet therefore asks about the document
   * and applies WITHIN its own box, so an embed on somebody else's page
   * still honours a Graview host's setting without restyling anything of
   * the host's. Nothing is emitted at `:root { ... }` in a scoped
   * stylesheet, which is the rule an embed must not break.
   */
  const motionRoot = ":root";
  const radius = brand.shape?.radius ?? 12;
  const density = brand.shape?.density ?? 1;
  const body =
    brand.typography?.body ??
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  const kit = resolveKit(brand.kit);
  return `${root} {
${themeVariables(tokens)}
${kitVariables(kit)}
  --graview-font-body: ${body};
  --graview-font-display: ${brand.typography?.display ?? body};
  --graview-font-mono: ${brand.typography?.mono ?? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'};
  /* Shape, as tokens, so a component never has to know whose product it is. */
  --graview-radius: ${radius}px;
  --graview-radius-sm: ${Math.max(2, Math.round(radius * 0.72))}px;
  --graview-pad: ${Math.round(15 * density)}px;
  --graview-pad-sm: ${Math.round(10 * density)}px;
  --graview-gap: ${Math.round(7 * density)}px;
  color-scheme: ${scheme};
}

${surface} {
  margin: 0;
  background: var(--graview-ground-deep);
  color: var(--graview-ink);
}

/*
 * THE READER'S OWN TEXT SIZE.
 *
 * Every size in the framework was once an absolute pixel count, so somebody
 * who sets a larger default font in their browser — the setting WCAG 1.4.4
 * is about — got a Graview that ignored them completely. 0.875rem is 14px
 * at the default 16px root, so nothing moves for anyone who has not asked
 * for anything, and everything moves together for anyone who has.
 */
${text} {
  font: 0.875rem/1.55 var(--graview-font-body);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

/* Headings and the wordmark take the display face when a brand supplies one,
   and the body face when it does not — so a brand with one font is not asked
   to name it twice. */
h1, h2, h3, h4, .graview-wordmark { font-family: var(--graview-font-display); }
code, kbd, samp { font-family: var(--graview-font-mono); }

/*
 * A KIND'S FIGURE fills the box it is given.
 *
 * The art declares its own viewBox and knows nothing about where it is
 * drawn — a chip at twelve pixels, a district's heading at eighteen, a kind
 * card's landmark at forty — so the SIZE is the container's and the drawing
 * scales into it. currentColor on the strokes means the kind's own hue
 * arrives through the cascade without the art being redrawn.
 */
[data-graview-figure] > svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

/* How far above the stack the camera is, 0..1 — REGISTERED so it can
   transition. Rising to the Graview morphs the scene instead of cutting:
   the square grid dissolves into the iso lattice and the districts grow up
   out of their cards, all riding this one number. */
@property --graview-altitude {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

/* The ground: a slow wash, so depth has something to recede into. */
.graview-ground {
  position: relative;
  background: var(--graview-wash), var(--graview-ground);
  --graview-altitude: 0;
  transition: --graview-altitude 640ms cubic-bezier(0.33, 0, 0.2, 1);
}

/*
 * The altitude control rides the SAME number the scene rides — its own copy,
 * because it sits beside the ground rather than inside it — on the same
 * curve. So the mark morphs exactly as long as the scene does, and where an
 * engine cannot register the property, both cut together: one mechanism,
 * and no way for the control and the picture to disagree about the change.
 */
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
/* The ring of three kinds tightens to one ring around one node. */
.graview-altitude-mark-ring {
  transform: scaleX(calc(1 - 0.48 * var(--graview-altitude)));
  opacity: calc(0.55 + 0.4 * var(--graview-altitude));
}
.graview-altitude-mark-apex {
  transform: translateY(calc(2.6px * var(--graview-altitude)));
}
/* The two wings gather into the centre and give their ink to the apex. */
.graview-altitude-mark-wing {
  opacity: calc(0.75 * (1 - var(--graview-altitude)));
}
.graview-altitude-mark-wing[data-side="left"] {
  transform: translate(calc(4.4px * var(--graview-altitude)), calc(-0.8px * var(--graview-altitude)));
}
.graview-altitude-mark-wing[data-side="right"] {
  transform: translate(calc(-4.4px * var(--graview-altitude)), calc(-0.8px * var(--graview-altitude)));
}

/* A fine measure under the scene. Faint enough to feel like calibration
   rather than graph paper, and it fades out at the edges so the scene has no
   hard boundary. */
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

/* Content that scrolls inside a panel, and SAYS SO.
 *
 * A pure-CSS scroll shadow: two cover gradients painted in the panel's own
 * ground scroll with the content, two shadows stay put, and so a shadow
 * only shows at an edge there is more content past. No
 * JavaScript, no measurement, and nothing to go stale — which matters
 * because the failure it prevents is silent. macOS hides overlay scrollbars
 * until you scroll, so without this a clipped list looks like a finished
 * one. */
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

/* A card on the kinds plane.
 *
 * Title and count only at rest — a strip of ten cards each showing three
 * truncated member names is ten unreadable things, and the members are not
 * what you are asking the strip. Hovering lifts one and reveals the kind's
 * own description, which the declaration has always carried and nothing has
 * ever shown. */
.graview-kind-card {
  height: 100%;
  transition: transform 170ms cubic-bezier(0.22, 1, 0.36, 1), height 170ms ease,
    box-shadow 170ms ease;
}
.graview-kind-card:hover,
.graview-kind-card:focus-within {
  height: auto;
  transform: translateY(-4px) scale(1.05);
  box-shadow: var(--graview-lift-high);
  position: relative;
  z-index: 3;
}
.graview-kind-note {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 190ms ease, opacity 190ms ease;
}
.graview-kind-card:hover .graview-kind-note,
.graview-kind-card:focus-within .graview-kind-note {
  max-height: 5.4em;
  opacity: 1;
}

/* FROM ALTITUDE the ground is an ISOMETRIC LATTICE — diamond cells at the
   classic 2:1 pitch, a finer far weave above, dissolving toward the
   horizon. Always present, faded by the altitude number, so rising
   CROSSFADES the square grid into the lattice instead of cutting. */
.graview-ground::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(116.565deg, var(--graview-edge) 0 1px, transparent 1px var(--graview-kit-lattice-size, 46px)),
    repeating-linear-gradient(63.435deg, var(--graview-edge) 0 1px, transparent 1px var(--graview-kit-lattice-size, 46px)),
    repeating-linear-gradient(116.565deg, var(--graview-edge) 0 1px, transparent 1px calc(var(--graview-kit-lattice-size, 46px) / 2)),
    repeating-linear-gradient(63.435deg, var(--graview-edge) 0 1px, transparent 1px calc(var(--graview-kit-lattice-size, 46px) / 2));
  /* Anchored where the city's cell (0,0) meets the canvas, so a plot placed
     by the map sits ON the grid a person can see, and pans with it. */
  background-position: var(--graview-lattice-x, 0px) var(--graview-lattice-y, 0px);
  opacity: calc(var(--graview-kit-lattice, 1) * var(--graview-grid-alpha) * var(--graview-altitude));
  mask-image: linear-gradient(to top, #000 42%, rgba(0,0,0,0.35) 70%, transparent 92%);
  -webkit-mask-image: linear-gradient(to top, #000 42%, rgba(0,0,0,0.35) 70%, transparent 92%);
}

/* THE KEEPER'S BLOCK IN THE PROFILE, which hides itself when it is empty.
   Both controls inside it draw nothing for a seat that may not administer,
   and a heading with nothing under it is worse than no heading — so the
   block is drawn only when it actually holds a control. */
.graview-profile-keeping { display: grid; gap: 6px; }
.graview-profile-keeping:not(:has(button, a)) { display: none; }
.graview-profile-keeping > * { justify-self: start; }

/* The district-open control and its roster: altitude-only chrome. Inside
   the stack expanding dissolves a card, so the control does not exist
   there. A full fingertip even though the glyph is small — the audit holds
   every control to 24px. */
.graview-kind-open { display: none; }
[data-graview-altitude] .graview-kind-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  /* A FINGERTIP, AND THE READER'S FINGERTIP IF IT IS BIGGER. 24px is the
     floor audit-ui holds every control to; 1.5rem is the same 24 at the
     default text size and grows with a reader who asked for more, so the
     control never drifts under the words it sits beside. A max() rather than
     either one alone: rem alone drops below the fingertip at a smaller
     setting, px alone ignores the setting altogether. */
  min-height: max(1.5rem, 24px);
  padding: 1px 9px;
  margin: -3px 0;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-panel);
  box-shadow: none;
  color: var(--graview-ink-muted);
  cursor: pointer;
  /* IN REM, LIKE EVERY OTHER SIZE HERE. At 10px this control's words were
     the one piece of text in the framework that ignored the reader's text
     size completely: set to Largest, every name on the screen doubled and
     "open" stayed ten pixels tall. A size a person chose and a control that
     will not take it is the accessibility setting failing on its own
     surface. */
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
}
[data-graview-altitude] .graview-kind-open:hover {
  color: var(--graview-accent);
  border-color: var(--graview-accent-dim);
}
/* The roster reads as a LIST, one member a row — chips wrapping at their
   own widths read as spilled tiles, and a district's population is a roll
   call, not a mosaic. */
.graview-kind-members {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  margin-top: 7px;
  animation: graview-settle 240ms ease backwards;
}
[data-graview-altitude] .graview-kind-members > [data-graview-pick] {
  width: 100%;
  box-sizing: border-box;
  justify-content: flex-start;
  max-width: none;
}
/* An OPENED district is a PANEL, not a pill with a list stuffed in it:
   name and count share the header line, the roster sits under a hairline,
   and the block behind fades — the plate IS the district while it is
   open, so no roof pokes out above the roster. */
[data-graview-altitude] .graview-kind-face[data-graview-opened] {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline !important;
  column-gap: 10px;
  border-radius: 12px !important;
  padding: 10px 12px 11px !important;
  width: 236px;
  max-width: 236px;
  box-shadow: var(--graview-lift-high) !important;
}
[data-graview-altitude] .graview-kind-face[data-graview-opened] .graview-kind-members {
  grid-column: 1 / -1;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--graview-edge);
}
[data-graview-altitude] .graview-kind-block[data-graview-opened] {
  opacity: calc(var(--graview-altitude) * 0.22);
}

/* WHAT KIND OF THING THIS IS, astride the focus panel's top-right edge —
   the kind's dot and its name, the same thread the chips and the legend
   carry. Scene chrome, so no view has to remember to say it. */
.graview-kind-tag {
  position: absolute;
  top: -9px;
  right: 14px;
  z-index: 2;
  display: var(--graview-kit-tags, inline-flex);
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  /* The kind's own hue on the border and the words, so the tag and the
     district it belongs to read as one thread. */
  border: 1px solid hsl(var(--graview-hue, 200) 45% var(--graview-tint-lightness) / 0.55);
  color: hsl(var(--graview-hue, 200) 45% calc(var(--graview-tint-lightness) + ${scheme === "light" ? "-32%" : "28%"}));
  background: var(--graview-float);
  box-shadow: var(--graview-lift-low);
  font-size: 0.59375rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--graview-ink-faint);
  pointer-events: none;
}

/* A LINE UNDER THE POINTER says it will take the press: the invisible hit
   run ghosts in, so editability is discoverable by hovering the relation
   itself rather than by rumor. */
.graview-edge-hit:hover {
  stroke: var(--graview-accent);
  opacity: 0.3;
}

/* THE DISTRICTS THE ROW COULD NOT HOLD.
   Not a district: no figure, no count, no tint of its own. A quiet card that
   says how many are missing and names them, each name a real control at a
   real size — a district is read, not glanced at, and so is this. */
.graview-beyond {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  padding: var(--graview-pad-sm, 8px);
  box-sizing: border-box;
  overflow: auto;
  /* The same fade the panels have: a district name sliced flat across the
     bottom of this card reads as broken, and it is only scrolled. */
  mask-image: linear-gradient(to bottom, #000 calc(100% - 12px), transparent);
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 12px), transparent);
  border-radius: var(--graview-radius-sm, 8px);
  border: 1px dashed var(--graview-edge);
  background: var(--graview-panel);
}
.graview-beyond-count {
  flex: 0 0 auto;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--graview-ink-faint);
}
.graview-beyond-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.graview-beyond-list button {
  display: flex;
  align-items: center;
  width: 100%;
  /* A FINGERTIP WHERE IT IS ACTUALLY DRAWN, not where it was designed.
     Every other control in this sheet is floored at 24 and the audit divides
     by the plane's scale before judging it, which is right for a control
     that sits ON a large target: the chip's disclosure is small, and the
     card behind it is the size of a card. These names are not that. They are
     the ONLY way to the districts the row could not hold, and plane two is
     drawn at 0.90 — so a designed 24 meets a finger as 21.7. Designed at 28
     it is drawn at 25, which is the number the floor was always about. */
  min-height: max(1.75rem, 28px);
  padding: 0 4px;
  border: none;
  border-radius: var(--graview-radius-sm, 6px);
  background: none;
  color: var(--graview-ink-muted);
  cursor: pointer;
  font-size: 0.78125rem;
  text-align: left;
  overflow-wrap: anywhere;
}
.graview-beyond-list button:hover {
  color: var(--graview-accent);
  background: var(--graview-wash);
}

/* The way into the archive, on the card that fed it: quiet, but a real
   control at a real size. */
.graview-kind-past {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  /* The same floor as the disclosure beside it — see .graview-kind-open. */
  min-height: max(1.5rem, 24px);
  padding: 1px 8px;
  margin: -3px 0;
  border-radius: 999px;
  border: 1px dashed var(--graview-edge);
  background: none;
  box-shadow: none;
  color: var(--graview-ink-faint);
  cursor: pointer;
  font-size: 0.65625rem;
  white-space: nowrap;
}
.graview-kind-past:hover {
  color: var(--graview-accent);
  border-color: var(--graview-accent-dim);
}

/* Chrome that arrives with a state settles in rather than popping. */
@keyframes graview-settle {
  from { opacity: 0; transform: translateY(7px); }
}

/* A district STANDS: an isometric block — roof, two shaded walls — whose
   height is its population. Always in the tree, faded and settled by the
   altitude number: rising, each block grows up out of its card while the
   card flies to its ring stop — a morph, not a cut. At altitude zero it is
   fully transparent and costs nothing. */
.graview-kind-block {
  display: block;
  /* Architecture, not a control: clicks fall through to the card, and an
     invisible in-stack block must never sit over a neighbour's tuck. */
  pointer-events: none;
  position: absolute;
  left: 8%;
  bottom: 2px;
  width: 84%;
  height: auto;
  opacity: var(--graview-altitude);
  transform: translateY(calc((1 - var(--graview-altitude)) * 18px));
  filter: drop-shadow(${
    scheme === "light" ? "10px 7px 14px rgba(20,30,32,0.28)" : "12px 8px 18px rgba(0,0,0,0.6)"
  });
}
.graview-iso-roof {
  fill: hsl(var(--graview-hue, 200) ${scheme === "light" ? "48% 82%" : "42% 32%"});
  stroke: ${scheme === "light" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.14)"};
  stroke-width: 1;
}
.graview-iso-right {
  fill: hsl(var(--graview-hue, 200) ${scheme === "light" ? "40% 66%" : "40% 21%"});
}
.graview-iso-left {
  fill: hsl(var(--graview-hue, 200) ${scheme === "light" ? "34% 55%" : "38% 13%"});
}

/* WHERE THE KIND HAS ITS OWN DRAWING, the drawing is the building.
   Same footprint as the block, same ground line, same cast shadow — the
   difference is that the district is now a person, a plot or a vehicle
   rather than one more box. Size carries the population the box's height
   used to: the rise the card computed, in a channel a drawing can use.

   Stroke weight is set HERE rather than in the art, because the art is
   drawn to read at twenty pixels and a 1.4-unit stroke on a 24-unit box
   becomes a six-pixel marker line at a hundred. Thinned to a drafting
   line, which is what a blueprint of a thing looks like. */
.graview-kind-landmark {
  display: block;
  left: 50%;
  /* The block's own two pixels of ground clearance, kept: at altitude zero
     every block is pushed eighteen pixels down as part of the morph, and
     without them the drawing hangs two pixels past the bottom of the scene
     and gives the whole page a scrollbar's worth of overflow. */
  bottom: 2px;
  aspect-ratio: 1;
  /* Sized by the card's HEIGHT, not its width: a district card is wider
     than it is tall, and a square drawing at 96% of the width stood a third
     of itself above the card and back through the nameplate. Population is
     in the drawing's size either way — the same rise the box's height
     carried, 10 for a district of one and 46 for the largest. */
  height: calc((72 + var(--graview-rise, 24) * 0.8) * 1%);
  width: auto;
  /* AND IT KEEPS UP WITH THE WORDS. The card is laid out in pixels off the
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
     and one of them ends it.) */
  min-height: min(5em, 96%);
  /* The morph is a GROWTH from the ground line, not a drop: a block slides
     eighteen pixels down at altitude zero and grows up out of the card, and
     a drawing given the same treatment hangs below the card it belongs to —
     two pixels past the bottom of the scene on the lowest row, which is a
     scrollbar on every ground-level screen in the app. Scaling from the
     drawing's own feet is the same reading and costs nothing below. */
  transform-origin: bottom center;
  transform: translateX(-50%) scale(calc(0.55 + var(--graview-altitude) * 0.45));
  /* A cast shadow belongs to a solid; on a line drawing it is a blurred
     second copy of every stroke. The drawing keeps a hint of one so it
     still stands on the lattice rather than floating over it. */
  filter: drop-shadow(${
    scheme === "light" ? "6px 5px 7px rgba(20,30,32,0.16)" : "7px 6px 9px rgba(0,0,0,0.45)"
  });
}
/* The nameplate floats ABOVE a drawing rather than standing on it. On a box
   the pill sits on the roof, which is what a label does over a building; on
   a figure the same 2% put it across the head. */
[data-graview-altitude] [data-graview-landmark] .graview-kind-face {
  top: 0 !important;
  transform: translate(-50%, calc(-100% - 7px));
}
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

/* From altitude the card's face becomes the district's NAMEPLATE: an
   upright pill standing on the roof, the way a label floats over a building
   in any city view — the block carries the architecture, the pill carries
   the words. Inline styles drew the in-stack card, so the pill overrides
   must outrank them. */
.graview-kind-face {
  transition: border-radius 640ms cubic-bezier(0.33, 0, 0.2, 1),
    padding 640ms cubic-bezier(0.33, 0, 0.2, 1),
    box-shadow 640ms ease;
}
[data-graview-altitude] .graview-kind-face {
  position: absolute !important;
  left: 50% !important;
  top: 2% !important;
  transform: translateX(-50%);
  width: max-content;
  /* Wider than the block when the name is: a label overflows its building
     the way a map label does. "REQUIRE / MENTS" on two lines does not. */
  max-width: none;
  white-space: nowrap;
  height: auto !important;
  flex-direction: row !important;
  align-items: baseline !important;
  gap: 7px !important;
  padding: 3px 11px !important;
  border-radius: 999px !important;
  box-shadow: var(--graview-lift-low) !important;
  z-index: 2;
}

/* A thing inside a view that is itself a thing: an event in a calendar, a
   person in a list. It has to look reachable, and it has to SHOW focus —
   these are the primary way anyone moves through the graph, so a keyboard
   user who cannot see where they are is stuck. */
/* A card someone dragged into place. Marked, not decorated: a dotted tie to
   say this position is held rather than computed. */
/* On the CHILD, not the host: the host is the layout's box, and a view
   that sizes to its content (a zoomed record, a fit panel) fills only part
   of it — a dashed box around the empty remainder read as a drawing
   mistake, not a mark. */
/* And never on the natural box either — a view drawn scaled sits inside a
   box the size of the whole scene, and the mark belongs on the drawing, not
   on the box; nor on the kind tag, which is a label and not the thing. */
[data-graview-pinned] > :not([data-graview-natural]):not(.graview-kind-tag),
[data-graview-pinned] > [data-graview-natural] > * {
  outline: 1px dashed var(--graview-edge-bright);
  outline-offset: 3px;
  border-radius: 12px;
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
/* On a board the keyboard ring hugs the DISC, not the disc-plus-label
   group: a rectangle drawn around a circle read as a mystery box on the
   pitch ("why does Left Midfield have this box?"), when all it ever said
   was "the keyboard is here". */
[data-graview-slot]:focus-visible {
  outline: none;
}
[data-graview-slot]:focus-visible > span:first-of-type {
  box-shadow: 0 0 0 2px var(--graview-ground), 0 0 0 4px var(--graview-accent);
}

/* A view is a thing you can act on. It should look like one. */
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

code { color: var(--graview-ink-muted); font-size: 0.75rem; letter-spacing: 0.02em; }

/* A view host, once the scene has placed it. The transition is on filter
   only — never on layout properties, which would make every navigation
   reflow the page. */
[data-graview-view] {
  transition: filter 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* WHAT YOU CAN PRESS IS WHAT YOU CAN SEE.

   A host is the box the LAYOUT gave a view — a band on the ground, the whole
   scene scaled small from altitude — and a view that sizes to its content
   fills only part of it. The rest is invisible, and an invisible box must
   not be a target: a record read from altitude and pinned beside a district
   covered that district's open button with nothing at all, and the button
   stopped answering. So the host itself is out of hit-testing on the DOM
   path and only the drawn content is in; every handler still hears the
   content's events on the way up. The GPU path keeps its own rule: there
   the whole subtree stays out, because the platform's hit-test descending
   into a captured view brings the renderer down. */
[data-graview-stage="dom"] [data-graview-view],
[data-graview-stage="dom"] [data-graview-view] > [data-graview-natural] {
  pointer-events: none;
}
[data-graview-stage="dom"] [data-graview-view] > :not([data-graview-natural]),
[data-graview-stage="dom"] [data-graview-view] > [data-graview-natural] > * {
  pointer-events: auto;
}
[data-graview-view][data-graview-selected] {
  filter: drop-shadow(0 0 14px var(--graview-accent-dim));
}

/* A node implicated by the last change, whoever made it. The pulse is the
   same for a human edit and an agent edit, because the diff is. */
@keyframes graview-touched {
  0%   { box-shadow: 0 0 0 0 var(--graview-accent-dim); }
  35%  { box-shadow: 0 0 26px 3px var(--graview-accent-dim); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
[data-graview-touched] > * {
  animation: graview-touched 1100ms cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 10px;
}

/* ------------------------------------------------------------ watching
 *
 * From outside the plane stack, activity has somewhere to HAPPEN: a kind
 * lights where an edit landed, an edge pulses where a relation was made or
 * broken, and a flag appears where a rule started failing. All of it is
 * derived from the op log — author, intent, reads and writes — and all of it
 * is drawn by these rules rather than by a frame loop, which is why watching
 * costs nothing while nothing is happening.
 *
 * Who moved is carried in HUE, not in a badge. A person is the accent the
 * whole interface already uses for "you did this"; an agent is a colder cast,
 * so a turn it took on its own is distinguishable at a glance from one you
 * directed; both at once takes both.
 */
[data-graview-activity] {
  --graview-activity: var(--graview-accent);
}
[data-graview-activity="autonomous"] {
  --graview-activity: hsl(212 72% 62%);
}
[data-graview-activity="co-edited"] {
  --graview-activity: hsl(280 60% 66%);
}
[data-graview-activity="rule"] {
  --graview-activity: var(--graview-warn);
}

@keyframes graview-landed {
  0%   { box-shadow: 0 0 0 0 var(--graview-activity); opacity: 0.55; }
  30%  { box-shadow: 0 0 30px 4px var(--graview-activity); opacity: 1; }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
}
[data-graview-view][data-graview-wrote] > * {
  animation: graview-landed 900ms cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 10px;
}

/* What an agent READ is the half a diff cannot show, and the half that says
   whether to trust what it then did. Quieter than a write on purpose: it is
   evidence of attention, not of a change. */
@keyframes graview-considered {
  0%   { outline-color: transparent; }
  25%  { outline-color: var(--graview-activity); }
  100% { outline-color: transparent; }
}
[data-graview-view][data-graview-read] > :not([data-graview-natural]):not(.graview-kind-tag),
[data-graview-view][data-graview-read] > [data-graview-natural] > * {
  outline: 1px dashed transparent;
  outline-offset: 3px;
  border-radius: 10px;
  animation: graview-considered 1800ms ease-out;
}

/* A rule that has just begun to fail. It outlives the edit that caused it,
   because the problem does. */
[data-graview-view][data-graview-broke] > * {
  box-shadow: 0 0 0 1px var(--graview-warn), 0 0 22px -6px var(--graview-warn);
  border-radius: 10px;
}

/* A relation made or broken: both ends were written, so the line between
   them is the thing that changed. */
@keyframes graview-relation {
  0%   { stroke-opacity: 0.28; stroke-width: 1.4; }
  30%  { stroke-opacity: 1; stroke-width: 3; }
  100% { stroke-opacity: 0.28; stroke-width: 1.4; }
}
[data-graview-connector][data-graview-activity] {
  animation: graview-relation 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

/*
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
 */
@media (prefers-reduced-motion: reduce) {
${stillness(`${motionRoot}:not([data-graview-motion='full'])`, text)}
}
${stillness(`${motionRoot}[data-graview-motion='reduce']`, text)}
`;
}
