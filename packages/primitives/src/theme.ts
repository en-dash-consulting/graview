/**
 * The visual system.
 *
 * Deep ground, luminous edges, translucent glass, thin light strokes. The
 * reference is a control surface for something real — precise, quiet, and
 * lit from within — not a game and not a dashboard. Restraint is the whole
 * effect: one accent hue, one warm counter-hue, and everything else is light
 * on darkness.
 *
 * Two rules hold it together:
 *
 * 1. **Depth is light, not decoration.** A plane recedes by losing luminance
 *    and gaining atmosphere, the way distance actually works. Nothing recedes
 *    by being made smaller alone.
 * 2. **Secondary text is a colour, never an opacity.** Opacity composites
 *    against whatever is behind and fails contrast silently; a token
 *    composites against a known ground and can be checked. axe-core checks it.
 */

export interface ThemeTokens {
  readonly ground: string;
  readonly groundDeep: string;
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
  readonly warn: string;
  readonly glow: string;
}

/** The dark scheme. Light text on darkness, one cool accent, one warm. */
export const DARK: ThemeTokens = {
  // Not black: a deep blue-green that lets the accent read as light rather
  // than as paint.
  ground: "#080d12",
  groundDeep: "#04070a",
  // Nearly opaque, by necessity as much as taste.
  //
  // A captured subtree has NOTHING behind it: `backdrop-filter` is a no-op
  // and a translucent fill composites against transparency, so a sparse panel
  // came out invisible on the GPU path while looking fine in the DOM. Panels
  // carry their own ground and earn their glass from the lit border instead.
  panel: "rgba(20, 31, 39, 0.94)",
  panelMuted: "rgba(15, 23, 30, 0.92)",
  panelWarning: "rgba(44, 30, 17, 0.94)",
  edge: "rgba(126, 196, 214, 0.20)",
  edgeBright: "rgba(126, 220, 232, 0.55)",
  ink: "#e8f3f6",
  // Both clear 4.5:1 against ground and both panel tones.
  inkMuted: "#9fb6bf",
  inkFaint: "#8aa3ad",
  accent: "#6fdcea",
  accentDim: "rgba(111, 220, 234, 0.35)",
  warn: "#f0a868",
  glow: "rgba(111, 220, 234, 0.28)",
};

/** The light scheme, kept honest so the system is not dark-only by accident. */
export const LIGHT: ThemeTokens = {
  ground: "#f4f2ee",
  groundDeep: "#e9e6e0",
  panel: "rgba(255, 255, 255, 0.92)",
  panelMuted: "rgba(247, 245, 241, 0.92)",
  panelWarning: "rgba(253, 243, 236, 0.95)",
  edge: "rgba(26, 26, 26, 0.12)",
  edgeBright: "rgba(26, 60, 70, 0.42)",
  ink: "#14201f",
  inkMuted: "#55514a",
  inkFaint: "#625d55",
  accent: "#0e6f7d",
  accentDim: "rgba(14, 111, 125, 0.28)",
  warn: "#8a4b12",
  glow: "rgba(14, 111, 125, 0.16)",
};

const VARIABLE: Record<keyof ThemeTokens, string> = {
  ground: "--graview-ground",
  groundDeep: "--graview-ground-deep",
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
  warn: "--graview-warn",
  glow: "--graview-glow",
};

export function themeVariables(tokens: ThemeTokens): string {
  return (Object.keys(VARIABLE) as (keyof ThemeTokens)[])
    .map((key) => `  ${VARIABLE[key]}: ${tokens[key]};`)
    .join("\n");
}

/**
 * The stylesheet an app drops in. Everything the primitives reference is a
 * custom property, so a host can override any single token without forking a
 * component.
 *
 * The scene's atmosphere lives here too: a slow radial wash behind everything
 * so the ground reads as space rather than as a flat backdrop, and a fine
 * grid that gives depth something to be measured against. Both are pure CSS
 * on the container, never on the captured views — the GPU is compositing
 * those, and painting under them is the container's job.
 */
export function themeCss(tokens: ThemeTokens = DARK): string {
  return `:root {
${themeVariables(tokens)}
  color-scheme: ${tokens === LIGHT ? "light" : "dark"};
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
  background:
    radial-gradient(120% 80% at 50% -10%, var(--graview-glow) 0%, transparent 60%),
    radial-gradient(90% 60% at 12% 108%, rgba(111, 220, 234, 0.10) 0%, transparent 62%),
    var(--graview-ground);
}

/* A fine measure under the scene. Faint enough to feel like calibration
   rather than graph paper. */
.graview-ground::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--graview-edge) 1px, transparent 1px),
    linear-gradient(90deg, var(--graview-edge) 1px, transparent 1px);
  background-size: 64px 64px;
  opacity: 0.35;
  mask-image: radial-gradient(120% 90% at 50% 40%, #000 30%, transparent 78%);
}

button {
  font: inherit;
  color: var(--graview-ink);
  padding: 7px 13px;
  border: 1px solid var(--graview-edge);
  border-radius: 8px;
  background: var(--graview-panel);
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}
button:hover:not(:disabled) {
  border-color: var(--graview-edge-bright);
  box-shadow: 0 0 0 1px var(--graview-accent-dim), 0 0 18px -6px var(--graview-accent);
}
button:focus-visible {
  outline: 2px solid var(--graview-accent);
  outline-offset: 2px;
}
button:disabled { opacity: 0.45; cursor: default; }

code { color: var(--graview-ink-muted); font-size: 12px; letter-spacing: 0.02em; }

/* A view host, once the scene has placed it. The transition is on transform
   and filter only — never on layout properties, which would make every
   navigation reflow the page. */
[data-graview-view] {
  transition: filter 320ms cubic-bezier(0.22, 1, 0.36, 1);
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

@media (prefers-reduced-motion: reduce) {
  [data-graview-view] { transition: none; }
  [data-graview-touched] > * { animation: none; }
}
`;
}
