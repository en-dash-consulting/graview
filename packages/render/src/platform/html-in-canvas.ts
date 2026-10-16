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
 * Verified against Chrome Canary 154.0.8032.0 and 158.0.8105.0 with
 * `--enable-blink-features=CanvasDrawElement`. What those builds actually
 * expose, and the exact call shapes, are recorded in
 * `docs/platform-findings.md`; the shapes below are what they accept, not what
 * the README suggests.
 *
 * Between the two the API was respelled, and every capture on 158 threw:
 * the canvas opts its children in with `content="drawable"` (not
 * `layoutsubtree`, which 158 no longer knows), each element drawn carries a
 * `drawable` attribute, and the capture's destination is the texture copy
 * itself (`{ texture }`) rather than `{ destination: { texture } }`. Both
 * spellings are written, and the call shape is found on the first capture.
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

/**
 * The second argument of the capture call. Chromium 154 took
 * `{ destination: { texture } }`; 158 takes the texture copy itself. Which
 * one this build wants is learned from the first call and kept.
 */
type DestinationShape = "texture" | "destination";
let destinationShape: DestinationShape | null = null;

const destinationFor = (shape: DestinationShape, texture: GPUTexture) =>
  shape === "texture" ? { texture } : { destination: { texture } };

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
  let hitTestFollowsGeometry: PlatformCapabilities["hitTestFollowsGeometry"] = "unknown";
  if (typeof document !== "undefined") {
    const probe = document.createElement("canvas") as ElementCanvas;
    // 158 dropped the property along with the attribute's old name; the
    // paint record API is what says a canvas lays its children out now.
    layoutSubtree = "layoutSubtree" in probe || typeof probe.captureElementImage === "function";
    /*
     * WHERE HIT-TESTING LANDS. The spelling says which build this is: 154
     * and 155 (`layoutSubtree`) lay every child out at the canvas origin and
     * ignore the reported geometry, and their hit-test into a child is the
     * one that brought the renderer down. 158 (`content="drawable"`, paint
     * records) lays each child out in place, and a reported geometry moves
     * its box — `getBoundingClientRect` and `elementsFromPoint` answer where
     * the view was drawn — without a crash on hover or press.
     */
    if ("layoutSubtree" in probe) hitTestFollowsGeometry = "no";
    else if (typeof probe.captureElementImage === "function") hitTestFollowsGeometry = "yes";
  }

  return {
    available: captureMethod !== null,
    captureMethod,
    geometrySync,
    hitTestFollowsGeometry: geometrySync ? hitTestFollowsGeometry : "no",
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
    if (typeof method !== "function") continue;
    if (destinationShape) {
      method.call(q, { source }, destinationFor(destinationShape, texture));
      return;
    }
    // The first capture finds the shape: a build that wants the other one
    // rejects this one with a TypeError naming the member it missed.
    try {
      method.call(q, { source }, destinationFor("texture", texture));
      destinationShape = "texture";
    } catch (error) {
      if (!(error instanceof TypeError) || !/texture/i.test(error.message)) throw error;
      method.call(q, { source }, destinationFor("destination", texture));
      destinationShape = "destination";
    }
    return;
  }
  throw new PlatformUnavailableError(detectCapabilities(queue));
}

/**
 * Marks an element as one the canvas draws. Chromium 158 captures only an
 * immediate child that carries `drawable`; 154 ignores the attribute.
 */
export function markDrawable(element: Element, on = true): void {
  if (on) element.setAttribute("drawable", "");
  else element.removeAttribute("drawable");
}

/**
 * The elements the browser says changed since the canvas last painted, from
 * a `paint` event — `null` when this build does not say, in which case
 * nothing can be assumed unchanged.
 */
export function changedElementsOf(event: Event): ReadonlySet<Element> | null {
  const changed = (event as Event & { changedElements?: ArrayLike<Element> }).changedElements;
  return changed ? new Set(Array.from(changed)) : null;
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

/**
 * Marks a canvas as owning its descendants' layout, in both spellings:
 * `content="drawable"` (Chromium 158) and `layoutsubtree` (154).
 */
export function setLayoutSubtree(canvas: HTMLCanvasElement, on = true): void {
  const target = canvas as ElementCanvas;
  if (on) target.setAttribute("content", "drawable");
  else target.removeAttribute("content");
  if ("layoutSubtree" in target) target.layoutSubtree = on;
  else if (on) target.setAttribute("layoutsubtree", "");
  else target.removeAttribute("layoutsubtree");
}

