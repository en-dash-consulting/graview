import { GRAVIEW_COLORS } from "./identity.js";
import type { Scheme, ThemeTokens } from "./types.js";

/**
 * The two the framework ships with, as DATA.
 *
 * They live in core rather than beside the components that read them for two
 * reasons: `graview check` verifies a palette and must not import React to do
 * it, and an app declaring its own brand in its domain layer needs a neutral
 * base to build on without reaching into the UI package. A theme is a
 * declaration, and declarations live here.
 *
 * Both are built on Graview's identity (`GRAVIEW_COLORS`, the design kit's
 * revision 03): paper and reading ink, with En Dash navy as the accent in
 * daylight. Turquoise is in neither: it is the symbol's point, a fill and
 * never a word, and nothing a scheme draws depends on it.
 *
 * Two schemes, and they are not inversions of each other. Depth is the thing
 * being drawn, and depth behaves differently in the two:
 *
 * - **Dark** is a lit control surface on a deep navy. Things at depth lose
 *   luminance and dissolve into the ground; the accent is the navy's own hue
 *   made light, so it reads as light rather than as paint, and separation
 *   comes from a lit edge.
 * - **Light** is daylight and paper. Things at depth lose CONTRAST and gain
 *   haze — real atmospheric perspective — and separation comes from soft cast
 *   shadow, the way objects on a desk separate.
 *
 * Neither paints a wash or a glow behind the scene: the ground is a ground,
 * and the scene standing on it is the picture.
 *
 * One rule holds across both: **secondary text is a color, never an
 * opacity.** Opacity composites against whatever is behind and fails contrast
 * silently. `checkContrast` measures every pair on both, and axe-core checks
 * the rendered result on every run of the a11y harness.
 */

/** A lit control surface, on navy. */
export const DARK: ThemeTokens = {
  // Not black: the identity's navy taken down to a ground, so a block's hue
  // reads as light on it.
  ground: "#0a0f1f",
  groundDeep: "#060914",
  wash: "none",
  // Nearly opaque, by necessity as much as taste: a captured subtree has
  // nothing behind it, so `backdrop-filter` is a no-op and a translucent fill
  // composites against transparency.
  panel: "rgba(19, 27, 52, 0.96)",
  panelMuted: "rgba(14, 21, 42, 0.94)",
  panelWarning: "rgba(48, 33, 18, 0.95)",
  edge: "rgba(164, 178, 222, 0.18)",
  edgeBright: "rgba(154, 171, 255, 0.6)",
  ink: "#eef0f6",
  inkMuted: "#aab2c6",
  inkFaint: "#97a0b6",
  // The navy's own hue, lightened until it reads as light: 7.8:1 on the
  // panel, and the navy itself is the text on it (7.3:1).
  accent: "#9aabff",
  accentDim: "rgba(154, 171, 255, 0.32)",
  accentInk: GRAVIEW_COLORS.navy,
  warn: "#f0a868",
  good: "#8fdcaa",
  bad: "#ffa3a3",
  glow: "rgba(154, 171, 255, 0.18)",
  bar: "rgba(10, 15, 31, 0.96)",
  // No lighter than the panel: an accent derived to read on the panel reads here too.
  float: "rgba(16, 23, 45, 0.98)",
  liftLow: "0 14px 36px -22px #000",
  liftHigh: "0 28px 64px -30px #000",
  tintAlpha: 0.2,
  tintLightness: 52,
  gridAlpha: 0.35,
};

/** Daylight and paper. */
export const LIGHT: ThemeTokens = {
  // The identity's paper: warm off-white, because pure white under a
  // full-bleed scene glares.
  ground: GRAVIEW_COLORS.paper,
  groundDeep: "#efefe8",
  wash: "none",
  panel: "#ffffff",
  panelMuted: "#fafaf6",
  panelWarning: "#fdf4ea",
  edge: "rgba(24, 33, 58, 0.12)",
  /*
   * A lit edge is not text and still owes 3:1 — an outline nobody can see is
   * a panel with no edge. Navy at 0.6 over white clears it.
   */
  edgeBright: "rgba(0, 23, 105, 0.6)",
  ink: GRAVIEW_COLORS.ink,
  // Both clear 4.5:1 on white, on the muted panel and on paper.
  inkMuted: GRAVIEW_COLORS.muted,
  inkFaint: "#626b7d",
  accent: GRAVIEW_COLORS.navy,
  accentDim: "rgba(0, 23, 105, 0.16)",
  accentInk: "#ffffff",
  warn: "#9a5312",
  good: "#1b6436",
  bad: "#a1232d",
  glow: "rgba(0, 23, 105, 0.08)",
  bar: "rgba(255, 255, 255, 0.96)",
  float: "#ffffff",
  // Layered, short-then-long: how something actually casts on a desk.
  liftLow: "0 1px 2px rgba(24,33,58,0.06), 0 8px 24px -12px rgba(24,33,58,0.16)",
  liftHigh: "0 2px 6px rgba(24,33,58,0.08), 0 24px 56px -24px rgba(24,33,58,0.26)",
  tintAlpha: 0.16,
  tintLightness: 46,
  gridAlpha: 0.5,
};

export const SCHEMES: Record<Scheme, ThemeTokens> = { dark: DARK, light: LIGHT };
