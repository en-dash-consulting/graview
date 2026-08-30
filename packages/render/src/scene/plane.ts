import type { Matrix4 } from "../platform/html-in-canvas.js";
import { planeTransform } from "../platform/html-in-canvas.js";

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
  /** 0 = full contrast, 1 = fully dissolved into the ground colour. */
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
 * reads distance from washed-out colour and a softer cast shadow. Reusing the
 * dark blur here made receded planes look out of focus rather than far away.
 */
export const LIGHT_PLANE_STYLES: Readonly<Record<PlaneIndex, PlaneStyle>> = {
  0: { scale: 1, blur: 0, falloff: 0, shadow: 0.16, fidelity: "full" },
  1: { scale: 0.74, blur: 0.3, falloff: 0.3, shadow: 0.12, fidelity: "summary" },
  2: { scale: 0.68, blur: 0.5, falloff: 0.46, shadow: 0.08, fidelity: "glyph" },
};

export const PLANE_STYLES: Readonly<Record<PlaneIndex, PlaneStyle>> = {
  // The focus plane is unfiltered on purpose: everything else is judged
  // against it, so it has to be the one true reading of the data.
  0: { scale: 1, blur: 0, falloff: 0, shadow: 0.34, fidelity: "full" },
  // Plane 1 recedes but stays READABLE — its job is to be looked at next,
  // not to be atmosphere. Enough separation to read as further away, little
  // enough that a summary view can still be read.
  1: { scale: 0.74, blur: 0.45, falloff: 0.2, shadow: 0.24, fidelity: "summary" },
  // Plane 2 is context, not content. It should register as presence and
  // count, and reward a glance rather than a read.
  //
  // Blurrier than plane 1, necessarily: recession has to be monotonic or the
  // depth cue inverts and the furthest plane reads as the nearest. This was
  // briefly 0.6 against plane 1's 0.7, which `frame-plan.test.ts` caught.
  2: { scale: 0.68, blur: 0.9, falloff: 0.3, shadow: 0.16, fidelity: "glyph" },
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
 * An earlier version scaled positions about the canvas centre as well, so a
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
