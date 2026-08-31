/**
 * Affine 4x4 matrices, and the plane transform built from one.
 *
 * Split out of the platform seam because it is PURE: no DOM, no WebGPU, no
 * ambient globals. That matters for more than tidiness — the platform module's
 * declarations name `GPUQueue`, which is an ambient global from
 * `@webgpu/types`, so anything re-exported from there drags that requirement
 * onto every consumer. The geometry every app uses should not.
 *
 * Affine is not a style choice here. The capture pipeline composites textures
 * with a per-plane transform, and a perspective divide would mean resampling
 * each captured view every frame; `isAffine` is the guard that keeps that
 * true, and it is checked in tests on both renderer paths.
 */

export type Matrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

/** An opaque cached paint record for one element, from `captureElementImage`. */

/**
 * Whether a matrix is affine — no perspective row.
 *
 * The plane model is designed so that everything it emits passes this test:
 * depth is per-plane uniform scale, blur and shadow, never per-element
 * foreshortening. That keeps the model correct whichever way the platform
 * settles the perspective question.
 */
export function isAffine(matrix: Matrix4): boolean {
  return matrix[3] === 0 && matrix[7] === 0 && matrix[11] === 0 && matrix[15] === 1;
}

/** Column-major 4x4 identity. */
export const IDENTITY: Matrix4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

/**
 * The affine transform a plane contributes: uniform scale about the canvas
 * origin plus a translation. Deliberately nothing else.
 */
export function planeTransform(
  scale: number,
  translateX: number,
  translateY: number,
): Matrix4 {
  return [
    scale, 0, 0, 0,
    0, scale, 0, 0,
    0, 0, 1, 0,
    translateX, translateY, 0, 1,
  ];
}

/** A perspective matrix, used only to ask the browser whether it takes one. */
export function perspectiveProbeMatrix(depth = 800): Matrix4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, -1 / depth,
    0, 0, 0, 1,
  ];
}

export function toDOMMatrix(matrix: Matrix4 | DOMMatrix): DOMMatrix {
  if (typeof DOMMatrix === "undefined") {
    throw new Error("DOMMatrix is unavailable outside a browser");
  }
  return matrix instanceof DOMMatrix ? matrix : new DOMMatrix([...matrix]);
}
