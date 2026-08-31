/// <reference types="@webgpu/types" />
//
// The WebGPU globals are part of this file's PUBLIC declarations, so the
// reference has to live HERE rather than on the package entry: TypeScript
// drops a type reference from a `.d.ts` that does not itself name one of its
// types, so a reference on `index.ts` was emitted nowhere and an installed
// consumer got "cannot find name GPUDevice" from a file they cannot change.
// Found by typechecking a scratch project against the packed tarballs.
//
// It also has to be the ONLY route in: listing `@webgpu/types` under
// `compilerOptions.types` makes the globals ambient for this build, at which
// point TypeScript considers the reference satisfied and drops it from the
// emit. The build sees no difference; a stranger does.

/**
 * THE platform seam. Every call into the HTML-in-Canvas API passes through
 * this module and nowhere else.
 *
 * The API is mid-origin-trial and its naming is still settling — the WICG
 * README calls the capture entry point `drawElementImageToTexture` in one
 * place and `copyElementImageToTexture` in another — so the whole surface is
 * resolved once, at runtime, behind names of our own. When the spec settles,
 * exactly one file changes.
 *
 * Verified against Chrome Canary 154.0.8032.0 with
 * `--enable-blink-features=CanvasDrawElement`. What that build actually
 * exposes, and the exact call shapes, are recorded in
 * `docs/platform-findings.md`; the shapes below are what it accepts, not what
 * the README suggests.
 */

import {
  IDENTITY,
  isAffine,
  perspectiveProbeMatrix,
  planeTransform,
  toDOMMatrix,
  type Matrix4,
} from "./matrix.js";

export { IDENTITY, isAffine, perspectiveProbeMatrix, planeTransform, toDOMMatrix };
export type { Matrix4 };

export type CaptureMethodName =
  | "drawElementImageToTexture"
  | "copyElementImageToTexture";

const CAPTURE_METHOD_NAMES: readonly CaptureMethodName[] = [
  "drawElementImageToTexture",
  "copyElementImageToTexture",
];

/** A 4x4 column-major matrix, the shape `canvasTransform` expects. */
export interface ElementImage {
  readonly width: number;
  readonly height: number;
  close(): void;
}

/** What may be captured or positioned: the live element, or its paint record. */
export type CaptureSource = Element | ElementImage;

export interface GeometryUpdate {
  /** Where the element was actually drawn, in canvas space. */
  readonly canvasTransform: Matrix4 | DOMMatrix;
}

export interface PlatformCapabilities {
  /** The API is present in some form. */
  readonly available: boolean;
  /** Which spelling of the capture call this build exposes. */
  readonly captureMethod: CaptureMethodName | null;
  /** `updateElementGeometry` is present, so geometry can be reported. */
  readonly geometrySync: boolean;
  /**
   * Whether reporting geometry actually redirects hit-testing. Separate from
   * `geometrySync` on purpose: Chromium 154 accepts the call and ignores it
   * for hit-testing, and the difference is the difference between an
   * interactive scene and a picture.
   */
  readonly hitTestFollowsGeometry: "yes" | "no" | "unknown";
  /** The canvas supports `layoutsubtree`. */
  readonly layoutSubtree: boolean;
  /** `paint` events and `requestPaint()` — the capture-safe moment. */
  readonly paintEvents: boolean;
  readonly webgpu: boolean;
  /** Everything needed to composite views at depth. */
  readonly usable: boolean;
  readonly notes: readonly string[];
}

interface CaptureCapableQueue extends GPUQueue {
  drawElementImageToTexture?: (source: unknown, destination: unknown) => void;
  copyElementImageToTexture?: (source: unknown, destination: unknown) => void;
}

interface ElementCanvas extends HTMLCanvasElement {
  layoutSubtree?: boolean;
  updateElementGeometry?: (source: CaptureSource, update: GeometryUpdate) => void;
  clearElementGeometry?: (source: CaptureSource) => void;
  captureElementImage?: (element: Element) => ElementImage;
  getElementTransform?: (source: CaptureSource) => DOMMatrix;
  requestPaint?: () => void;
}

function scope(): (typeof globalThis & { navigator?: Navigator }) | undefined {
  return typeof globalThis === "undefined" ? undefined : globalThis;
}

/**
 * Resolves what this browser can actually do. Called once; everything else in
 * the renderer branches on the result rather than sniffing again.
 */
export function detectCapabilities(
  queue?: GPUQueue,
  canvas?: HTMLCanvasElement,
): PlatformCapabilities {
  const notes: string[] = [];
  const g = scope();
  const webgpu = Boolean(g?.navigator && "gpu" in g.navigator);
  if (!webgpu) notes.push("navigator.gpu is absent — WebGPU is unavailable.");

  const queueProto =
    (queue as CaptureCapableQueue | undefined) ??
    ((g as { GPUQueue?: { prototype: CaptureCapableQueue } } | undefined)?.GPUQueue
      ?.prototype ??
      undefined);
  let captureMethod: CaptureMethodName | null = null;
  if (queueProto) {
    for (const name of CAPTURE_METHOD_NAMES) {
      if (typeof queueProto[name] === "function") {
        captureMethod = name;
        break;
      }
    }
  }
  if (!captureMethod) {
    notes.push(
      "No element-capture method on GPUQueue. Run Chromium 147+ with " +
        "--enable-blink-features=CanvasDrawElement.",
    );
  }

  const canvasProto =
    (canvas as ElementCanvas | undefined) ??
    ((g as { HTMLCanvasElement?: { prototype: ElementCanvas } } | undefined)
      ?.HTMLCanvasElement?.prototype ??
      undefined);
  const geometrySync = typeof canvasProto?.updateElementGeometry === "function";
  if (!geometrySync) {
    notes.push("canvas.updateElementGeometry is absent — geometry cannot be reported.");
  }
  const paintEvents = typeof canvasProto?.requestPaint === "function";
  if (!paintEvents) {
    notes.push("canvas.requestPaint is absent — there is no capture-safe moment to hook.");
  }

  let layoutSubtree = false;
  if (typeof document !== "undefined") {
    const probe = document.createElement("canvas") as ElementCanvas;
    layoutSubtree = "layoutSubtree" in probe;
  }

  return {
    available: captureMethod !== null,
    captureMethod,
    geometrySync,
    hitTestFollowsGeometry: "unknown",
    layoutSubtree,
    paintEvents,
    webgpu,
    usable: webgpu && captureMethod !== null,
    notes,
  };
}

export class PlatformUnavailableError extends Error {
  constructor(readonly capabilities: PlatformCapabilities) {
    super(`HTML-in-Canvas is unavailable:\n  ${capabilities.notes.join("\n  ")}`);
    this.name = "PlatformUnavailableError";
  }
}

/**
 * Captures a DOM element (or a previously taken paint record) into an
 * existing GPU texture.
 *
 * Two preconditions the errors do not make obvious:
 * - the element must be a descendant of a `<canvas layoutsubtree>`, and
 * - that canvas must have a CONFIGURED WebGPU context of its own, or the call
 *   fails with "containing canvas does not have a rendering context".
 *
 * The texture is written in place, so the caller keeps ownership and no copy
 * happens on our side.
 */
export function captureElement(
  queue: GPUQueue,
  source: CaptureSource,
  texture: GPUTexture,
): void {
  const q = queue as CaptureCapableQueue;
  for (const name of CAPTURE_METHOD_NAMES) {
    const method = q[name];
    if (typeof method === "function") {
      method.call(q, { source }, { destination: { texture } });
      return;
    }
  }
  throw new PlatformUnavailableError(detectCapabilities(queue));
}

/**
 * Takes a cached paint record for an element. Only valid inside a `paint`
 * event — outside one the browser has no paint record and throws
 * `InvalidStateError`.
 */
export function captureElementImage(
  canvas: HTMLCanvasElement,
  element: Element,
): ElementImage {
  const target = canvas as ElementCanvas;
  if (typeof target.captureElementImage !== "function") {
    throw new PlatformUnavailableError(detectCapabilities(undefined, canvas));
  }
  return target.captureElementImage(element);
}

/**
 * Tells the browser where an element was actually drawn.
 *
 * The intent of the spec is that hit-testing, focus order, screen readers and
 * find-in-page then resolve against the drawn pixels. In Chromium 154 the
 * call is accepted and has no observable effect on hit-testing — see
 * `docs/platform-findings.md`. Call it anyway (it costs nothing and will
 * start working), and route pointers through `PointerRouter` meanwhile.
 */
export function updateElementGeometry(
  canvas: HTMLCanvasElement,
  source: CaptureSource,
  update: GeometryUpdate,
): void {
  const target = canvas as ElementCanvas;
  if (typeof target.updateElementGeometry !== "function") {
    throw new PlatformUnavailableError(detectCapabilities(undefined, canvas));
  }
  target.updateElementGeometry(source, update);
}

/** Drops a reported geometry, returning the element to its layout position. */
export function clearElementGeometry(
  canvas: HTMLCanvasElement,
  source: CaptureSource,
): void {
  (canvas as ElementCanvas).clearElementGeometry?.(source);
}

/** Asks for a `paint` event — the moment at which capture is legal. */
export function requestPaint(canvas: HTMLCanvasElement): void {
  (canvas as ElementCanvas).requestPaint?.();
}

/** Marks a canvas as owning its descendants' layout. */
export function setLayoutSubtree(canvas: HTMLCanvasElement, on = true): void {
  const target = canvas as ElementCanvas;
  if ("layoutSubtree" in target) target.layoutSubtree = on;
  else if (on) target.setAttribute("layoutsubtree", "");
  else target.removeAttribute("layoutsubtree");
}

