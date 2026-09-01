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
import { SCHEMES } from "@graview/core";


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
export function themeCss(scheme: Scheme = "dark", brand: Brand = GRAVIEW_BRAND): string {
  const tokens = brand.schemes[scheme];
  const radius = brand.shape?.radius ?? 12;
  const density = brand.shape?.density ?? 1;
  const body =
    brand.typography?.body ??
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  return `:root {
${themeVariables(tokens)}
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

html, body {
  margin: 0;
  background: var(--graview-ground-deep);
  color: var(--graview-ink);
  font: 14px/1.55 var(--graview-font-body);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

/* Headings and the wordmark take the display face when a brand supplies one,
   and the body face when it does not — so a brand with one font is not asked
   to name it twice. */
h1, h2, h3, h4, .graview-wordmark { font-family: var(--graview-font-display); }
code, kbd, samp { font-family: var(--graview-font-mono); }

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
  background-size: 64px 64px;
  opacity: calc(var(--graview-grid-alpha) * (1 - var(--graview-altitude)));
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
    repeating-linear-gradient(116.565deg, var(--graview-edge) 0 1px, transparent 1px 46px),
    repeating-linear-gradient(63.435deg, var(--graview-edge) 0 1px, transparent 1px 46px),
    repeating-linear-gradient(116.565deg, var(--graview-edge) 0 1px, transparent 1px 23px),
    repeating-linear-gradient(63.435deg, var(--graview-edge) 0 1px, transparent 1px 23px);
  opacity: calc(var(--graview-grid-alpha) * var(--graview-altitude));
  mask-image: linear-gradient(to top, #000 42%, rgba(0,0,0,0.35) 70%, transparent 92%);
  -webkit-mask-image: linear-gradient(to top, #000 42%, rgba(0,0,0,0.35) 70%, transparent 92%);
}

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
  min-height: 24px;
  padding: 1px 9px;
  margin: -3px 0;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-panel);
  box-shadow: none;
  color: var(--graview-ink-muted);
  cursor: pointer;
  font-size: 10px;
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
/* An OPENED nameplate is a small panel again: the roster needs a column,
   and a pill of chips is neither. */
[data-graview-altitude] .graview-kind-face[data-graview-opened] {
  flex-direction: column !important;
  align-items: stretch !important;
  border-radius: 11px !important;
  padding: 9px 11px 10px !important;
  width: 208px;
  max-width: 208px;
}

/* The way into the archive, on the card that fed it: quiet, but a real
   control at a real size. */
.graview-kind-past {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 24px;
  padding: 1px 8px;
  margin: -3px 0;
  border-radius: 999px;
  border: 1px dashed var(--graview-edge);
  background: none;
  box-shadow: none;
  color: var(--graview-ink-faint);
  cursor: pointer;
  font-size: 10.5px;
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
  max-width: 98%;
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
[data-graview-pinned] {
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

code { color: var(--graview-ink-muted); font-size: 12px; letter-spacing: 0.02em; }

/* A view host, once the scene has placed it. The transition is on filter
   only — never on layout properties, which would make every navigation
   reflow the page. */
[data-graview-view] {
  transition: filter 260ms cubic-bezier(0.22, 1, 0.36, 1);
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
[data-graview-view][data-graview-read] > * {
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

@media (prefers-reduced-motion: reduce) {
  [data-graview-view] { transition: none; }
  [data-graview-touched] > * { animation: none; }
  /*
   * Motion is removed; the INFORMATION is not. A steady ring in the mover's
   * colour says the same thing the pulse did, and someone who cannot take
   * the animation still gets to watch the system work.
   */
  [data-graview-view][data-graview-wrote] > *,
  [data-graview-view][data-graview-read] > * {
    animation: none;
    box-shadow: 0 0 0 2px var(--graview-activity);
  }
  [data-graview-view][data-graview-read] > * { box-shadow: 0 0 0 1px var(--graview-activity); }
  [data-graview-connector][data-graview-activity] { animation: none; stroke-opacity: 1; }
}
`;
}
