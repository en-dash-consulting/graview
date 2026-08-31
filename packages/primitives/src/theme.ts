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

export type Scheme = "light" | "dark";

export interface ThemeTokens {
  readonly ground: string;
  readonly groundDeep: string;
  /** The wash behind the scene: two radial gradients over the ground. */
  readonly wash: string;
  readonly panel: string;
  readonly panelMuted: string;
  readonly panelWarning: string;
  readonly edge: string;
  readonly edgeBright: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly inkFaint: string;
  readonly accent: string;
  readonly accentDim: string;
  readonly accentInk: string;
  readonly warn: string;
  readonly glow: string;
  /** The command bar's ground. Chrome, not scene. */
  readonly bar: string;
  /** A surface floating over the scene — the inspector. */
  readonly float: string;
  /** Elevation for a panel sitting in the scene. */
  readonly liftLow: string;
  /** Elevation for something floating over it — the inspector. */
  readonly liftHigh: string;
  /** How strongly a chip or span tint reads over the panel ground. */
  readonly tintAlpha: number;
  readonly tintLightness: number;
  readonly gridAlpha: number;
}

/** A lit control surface. */
export const DARK: ThemeTokens = {
  // Not black: a deep blue-green that lets the accent read as light rather
  // than as paint.
  ground: "#080d12",
  groundDeep: "#04070a",
  wash:
    "radial-gradient(120% 80% at 50% -10%, var(--graview-glow) 0%, transparent 60%), " +
    "radial-gradient(90% 60% at 12% 108%, rgba(111,220,234,0.10) 0%, transparent 62%)",
  // Nearly opaque, by necessity as much as taste: a captured subtree has
  // nothing behind it, so `backdrop-filter` is a no-op and a translucent fill
  // composites against transparency.
  panel: "rgba(20, 31, 39, 0.94)",
  panelMuted: "rgba(15, 23, 30, 0.92)",
  panelWarning: "rgba(44, 30, 17, 0.94)",
  edge: "rgba(126, 196, 214, 0.20)",
  edgeBright: "rgba(126, 220, 232, 0.55)",
  ink: "#e8f3f6",
  inkMuted: "#9fb6bf",
  inkFaint: "#8aa3ad",
  accent: "#6fdcea",
  accentDim: "rgba(111, 220, 234, 0.35)",
  accentInk: "#06232a",
  warn: "#f0a868",
  glow: "rgba(111, 220, 234, 0.28)",
  bar: "linear-gradient(rgba(10,16,21,0.92), rgba(6,10,14,0.78))",
  float: "linear-gradient(rgba(14,22,29,0.96), rgba(8,13,18,0.97))",
  liftLow: "0 18px 50px -26px #000, inset 0 1px 0 rgba(126,196,214,0.20)",
  liftHigh: "0 30px 70px -30px #000",
  tintAlpha: 0.2,
  tintLightness: 52,
  gridAlpha: 0.35,
};

/** Daylight and paper. */
export const LIGHT: ThemeTokens = {
  // Warm off-white rather than pure white: pure white under a full-bleed
  // scene glares, and paper is never #fff.
  ground: "#f6f4f0",
  groundDeep: "#efece6",
  wash:
    "radial-gradient(120% 80% at 50% -20%, rgba(255,255,255,0.9) 0%, transparent 58%), " +
    "radial-gradient(80% 60% at 92% 104%, rgba(12,110,120,0.06) 0%, transparent 60%)",
  panel: "#ffffff",
  panelMuted: "#faf8f5",
  panelWarning: "#fdf4ea",
  edge: "rgba(24, 34, 38, 0.10)",
  edgeBright: "rgba(12, 110, 120, 0.42)",
  ink: "#15201f",
  // Both clear 4.5:1 on white and on the muted panel.
  inkMuted: "#54605f",
  inkFaint: "#67716f",
  accent: "#0c6e78",
  accentDim: "rgba(12, 110, 120, 0.22)",
  accentInk: "#ffffff",
  warn: "#9a5312",
  glow: "rgba(12, 110, 120, 0.10)",
  bar: "linear-gradient(rgba(255,255,255,0.96), rgba(250,248,245,0.86))",
  float: "linear-gradient(#ffffff, #fcfbf9)",
  // Layered, short-then-long: how something actually casts on a desk.
  liftLow: "0 1px 2px rgba(20,30,32,0.06), 0 8px 24px -12px rgba(20,30,32,0.18)",
  liftHigh: "0 2px 6px rgba(20,30,32,0.08), 0 28px 60px -24px rgba(20,30,32,0.28)",
  tintAlpha: 0.16,
  tintLightness: 46,
  gridAlpha: 0.5,
};

export const SCHEMES: Record<Scheme, ThemeTokens> = { dark: DARK, light: LIGHT };

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
export function themeCss(scheme: Scheme = "dark"): string {
  const tokens = SCHEMES[scheme];
  return `:root {
${themeVariables(tokens)}
  color-scheme: ${scheme};
}

html, body {
  margin: 0;
  background: var(--graview-ground-deep);
  color: var(--graview-ink);
  font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

/* The ground: a slow wash, so depth has something to recede into. */
.graview-ground {
  position: relative;
  background: var(--graview-wash), var(--graview-ground);
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
  opacity: var(--graview-grid-alpha);
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

/* A thing inside a view that is itself a thing: an event in a calendar, a
   person in a list. It has to look reachable, and it has to SHOW focus —
   these are the primary way anyone moves through the graph, so a keyboard
   user who cannot see where they are is stuck. */
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
  border-radius: 8px;
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
