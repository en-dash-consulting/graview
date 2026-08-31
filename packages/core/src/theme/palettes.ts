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
 * Two schemes, and they are not inversions of each other. Depth is the thing
 * being drawn, and depth behaves differently in the two:
 *
 * - **Dark** is a lit control surface. Things at depth lose luminance and
 *   dissolve into the ground; the accent reads as light, and separation comes
 *   from glow and a lit edge.
 * - **Light** is daylight and paper. Things at depth lose CONTRAST and gain
 *   haze — real atmospheric perspective — and separation comes from soft cast
 *   shadow, the way objects on a desk separate. Inverting the dark scheme
 *   would give grey-on-grey mush, because glow does not exist in daylight.
 *
 * One rule holds across both: **secondary text is a colour, never an
 * opacity.** Opacity composites against whatever is behind and fails contrast
 * silently. `checkContrast` measures every pair on both, and axe-core checks
 * the rendered result on every run of the a11y harness.
 */

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
  /*
   * 0.67, not 0.42. A lit edge is not text and still owes 3:1 — an outline
   * nobody can see is a panel with no edge — and at 0.42 over white this read
   * at 1.93:1. Found by pointing the framework's own contrast check at the
   * framework's own palette, which is the argument for having one.
   */
  edgeBright: "rgba(12, 110, 120, 0.67)",
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
