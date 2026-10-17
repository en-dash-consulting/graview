import { planeTransform, type Matrix4 } from "../platform/matrix.js";

/**
 * Discrete z-planes with the camera locked to one axis. No free orbit: every
 * view is nameable and returnable, which is what makes each stop a URL.
 */
export const PLANES = {
  /** Live, editable DOM. Captured every frame it moves. */
  focus: 0,
  /** The entity type you asked to see, with connectors. */
  relations: 1,
  /** Everything else, as aggregate blocks. */
  context: 2,
} as const;

export type PlaneIndex = 0 | 1 | 2;

/**
 * Atmospheric depth, expressed as numbers a shader can use.
 *
 * Every value here is affine or per-plane uniform — nothing per-element and
 * nothing perspective — so the visual language survives whichever way the
 * platform settles the perspective question. Blur and contrast falloff are
 * near-free in a shader and expensive in CSS, which is what justifies the GPU
 * pipeline at all.
 */
export interface PlaneStyle {
  /** Uniform scale. Recession, without foreshortening. */
  readonly scale: number;
  /** Gaussian radius in texels. */
  readonly blur: number;
  /** 0 = full contrast, 1 = fully dissolved into the ground color. */
  readonly falloff: number;
  /** Drop-shadow opacity separating this plane from the one behind it. */
  readonly shadow: number;
  /** Fidelity the plane asks its views for. */
  readonly fidelity: "full" | "summary" | "glyph";
}

export type Scheme = "light" | "dark";

/**
 * Daylight recession.
 *
 * Not the dark numbers inverted. In daylight a distant thing loses CONTRAST
 * and gains haze; it does not lose light, and it does not blur much — the eye
 * reads distance from washed-out color and a softer cast shadow. Reusing the
 * dark blur here made receded planes look out of focus rather than far away.
 */
export const LIGHT_PLANE_STYLES: Readonly<Record<PlaneIndex, PlaneStyle>> = {
  0: { scale: 1, blur: 0, falloff: 0, shadow: 0.16, fidelity: "full" },
  1: { scale: 0.95, blur: 0.3, falloff: 0.26, shadow: 0.12, fidelity: "summary" },
  /*
   * Depth comes from BLUR AND FALLOFF, not from shrinking.
   *
   * Pushing the scale to 0.6 did separate the planes and made the strip
   * illegible — ten cards reading "P…", "REA…", "S…". A map you cannot read
   * is not a map. The recession is carried by the atmosphere instead.
   *
   * 0.78 was still shrinking, and still too much: the layout allots each
   * district a slot and the renderer drew it at 78% of it, so a name set at
   * thirteen pixels reached the screen at ten and its kind at under eight.
   * That is under every floor this project holds a control to, and it is a
   * floor the reader's own text size could not lift either — the shrink
   * came after it. The planes keep a shrink small enough to read as depth
   * and no longer small enough to cost a word its legibility.
   */
  2: { scale: 0.9, blur: 0.3, falloff: 0.34, shadow: 0.07, fidelity: "glyph" },
};

export const PLANE_STYLES: Readonly<Record<PlaneIndex, PlaneStyle>> = {
  // The focus plane is unfiltered on purpose: everything else is judged
  // against it, so it has to be the one true reading of the data.
  0: { scale: 1, blur: 0, falloff: 0, shadow: 0.34, fidelity: "full" },
  // Plane 1 recedes but stays READABLE — its job is to be looked at next,
  // not to be atmosphere. Enough separation to read as further away, little
  // enough that a summary view can still be read.
  1: { scale: 0.95, blur: 0.45, falloff: 0.18, shadow: 0.24, fidelity: "summary" },
  // Plane 2 is context, not content. It should register as presence and
  // count, and reward a glance rather than a read.
  //
  // Blurrier than plane 1, necessarily: recession has to be monotonic or the
  // depth cue inverts and the furthest plane reads as the nearest. This was
  // briefly 0.6 against plane 1's 0.7, which `frame-plan.test.ts` caught.
  2: { scale: 0.9, blur: 0.45, falloff: 0.26, shadow: 0.14, fidelity: "glyph" },
};

export function styleFor(plane: number, scheme: Scheme = "dark"): PlaneStyle {
  const clamped = Math.max(0, Math.min(2, Math.round(plane))) as PlaneIndex;
  return (scheme === "light" ? LIGHT_PLANE_STYLES : PLANE_STYLES)[clamped];
}

/**
 * Interpolates between two plane styles. Every transition is animatable
 * because both endpoints are the same small bag of numbers — the same reason
 * any two layout states interpolate.
 */
export function mixStyles(a: PlaneStyle, b: PlaneStyle, t: number): PlaneStyle {
  const clamped = Math.max(0, Math.min(1, t));
  const lerp = (x: number, y: number) => x + (y - x) * clamped;
  return {
    scale: lerp(a.scale, b.scale),
    blur: lerp(a.blur, b.blur),
    falloff: lerp(a.falloff, b.falloff),
    shadow: lerp(a.shadow, b.shadow),
    fidelity: clamped < 0.5 ? a.fidelity : b.fidelity,
  };
}

/**
 * The transform a view at `plane` gets, given where layout put it.
 *
 * Position is layout's, untouched. The plane contributes only treatment —
 * scale, and through the shader blur, falloff and shadow.
 *
 * An earlier version scaled positions about the canvas center as well, so a
 * receded plane pulled inward. It looked plausible and was wrong: layout no
 * longer knew where anything would end up, so connectors drawn from layout
 * coordinates missed the views they connected. One owner per concern —
 * layout owns position, the plane owns treatment — is what keeps the two
 * halves of the picture agreeing.
 */
export function transformFor(
  style: PlaneStyle,
  x: number,
  y: number,
  _canvasWidth?: number,
  _canvasHeight?: number,
): Matrix4 {
  return planeTransform(style.scale, x, y);
}

/** What both paths need of a view to treat it: its plane, how far back in it, and whether it stands on a plot. */
export interface TreatedView {
  readonly plane: number;
  /** 0..1 along the plane's arc; a card at the near end of a row recedes less. */
  readonly depth?: number;
  /** From altitude a district stands on its plot: the subject, never atmosphere. */
  readonly onPlot?: boolean;
}

/** A view's treatment: the plane style it is drawn at, and its blur. */
export interface Treatment {
  /** Mixed between the two planes it is between, so a move reads as travel. */
  readonly style: PlaneStyle;
  /**
   * The NEAREST plane's blur, not a mix: under half a pixel, nobody sees it
   * tween, and a filter whose radius changes is a filter repainted every
   * frame of every transition (docs/scale.md). Snapped, it changes once.
   */
  readonly blur: number;
}

/**
 * THE ONE TREATMENT BOTH PATHS DRAW. The DOM path writes it as a CSS
 * transform, opacity and filter; the GPU path packs it into the shader's
 * uniform. Worked out in one place, so the two cannot drift: a page
 * without WebGPU looks like the page with it.
 *
 * A card at the near end of its row is treated as up to 0.55 of a plane
 * nearer than its plane, which is what makes the row curve away instead of
 * lying flat; a district on its plot is treated as the focus.
 */
export function treatmentOf(view: TreatedView, scheme: Scheme = "dark"): Treatment {
  const at = view.onPlot ? 0 : view.plane - (1 - (view.depth ?? 1)) * 0.55;
  const lower = Math.max(0, Math.min(2, Math.floor(at))) as PlaneIndex;
  const upper = Math.max(0, Math.min(2, Math.ceil(at))) as PlaneIndex;
  const style = lower === upper ? styleFor(lower, scheme) : mixStyles(styleFor(lower, scheme), styleFor(upper, scheme), at - lower);
  return { style, blur: styleFor(Math.max(0, Math.min(2, Math.round(at))), scheme).blur };
}

/**
 * How much a receded plane dims, as an opacity: falloff toward the ground,
 * drawn the same on both paths — the GPU's alpha and the DOM's `opacity`.
 */
export function recededOpacity(style: PlaneStyle): number {
  return 1 - style.falloff * 0.55;
}
