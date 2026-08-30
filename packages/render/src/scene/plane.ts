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

export const PLANE_STYLES: Readonly<Record<PlaneIndex, PlaneStyle>> = {
  0: { scale: 1, blur: 0, falloff: 0, shadow: 0.28, fidelity: "full" },
  1: { scale: 0.72, blur: 1.4, falloff: 0.3, shadow: 0.2, fidelity: "summary" },
  2: { scale: 0.52, blur: 3.2, falloff: 0.58, shadow: 0.12, fidelity: "glyph" },
};

export function styleFor(plane: number): PlaneStyle {
  const clamped = Math.max(0, Math.min(2, Math.round(plane))) as PlaneIndex;
  return PLANE_STYLES[clamped];
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
 * The transform a view at `plane` gets, given where layout put it. Scale is
 * about the canvas centre so receding planes pull inward rather than toward
 * the origin.
 */
export function transformFor(
  style: PlaneStyle,
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
): Matrix4 {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  return planeTransform(
    style.scale,
    cx + (x - cx) * style.scale,
    cy + (y - cy) * style.scale,
  );
}
