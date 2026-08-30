import type { Matrix4 } from "../platform/html-in-canvas.js";

/**
 * Routes pointer events against where views were DRAWN, not where their
 * source elements are laid out.
 *
 * This exists because of a measured platform gap, not a design preference:
 * `updateElementGeometry` is accepted by Chromium 154 and does not redirect
 * hit-testing (see `docs/platform-findings.md`). Keep calling it — it costs
 * nothing and will start working — and route pointers here meanwhile, so the
 * zoomed-out scene stays interactive rather than becoming a picture.
 *
 * Accessibility does NOT need this fallback: the source elements remain real,
 * focusable DOM inside the `layoutsubtree` canvas, which the probe confirmed.
 */

export interface Placement {
  /** The live element this quad was captured from. */
  readonly element: Element;
  /** Where it was drawn, in canvas pixels. Affine only. */
  readonly transform: Matrix4;
  /** The element's own size in CSS pixels, before the transform. */
  readonly width: number;
  readonly height: number;
  /** Higher wins when quads overlap — plane 0 is nearest the viewer. */
  readonly depth: number;
}

export interface LocalHit {
  readonly placement: Placement;
  /** Coordinates inside the element's own box, in CSS pixels. */
  readonly x: number;
  readonly y: number;
}

/**
 * Inverts the affine part of a column-major 4x4 that only ever carries
 * scale and translation in x/y. Restricting the shape is what makes the
 * inverse exact and cheap — and the plane model emits nothing else.
 */
export function invertPlaneTransform(
  transform: Matrix4,
): { scaleX: number; scaleY: number; translateX: number; translateY: number } | null {
  const scaleX = transform[0];
  const scaleY = transform[5];
  if (scaleX === 0 || scaleY === 0) return null;
  return {
    scaleX: 1 / scaleX,
    scaleY: 1 / scaleY,
    translateX: transform[12],
    translateY: transform[13],
  };
}

/** Canvas-space point to element-local point, or null if outside the quad. */
export function toLocal(placement: Placement, canvasX: number, canvasY: number): LocalHit | null {
  const inverse = invertPlaneTransform(placement.transform);
  if (!inverse) return null;
  const x = (canvasX - inverse.translateX) * inverse.scaleX;
  const y = (canvasY - inverse.translateY) * inverse.scaleY;
  if (x < 0 || y < 0 || x > placement.width || y > placement.height) return null;
  return { placement, x, y };
}

/**
 * The topmost placement under a canvas-space point. Depth ordering is
 * explicit rather than array order, so a renderer may draw back-to-front
 * without changing what a click means.
 */
export function hitTest(
  placements: readonly Placement[],
  canvasX: number,
  canvasY: number,
): LocalHit | null {
  let best: LocalHit | null = null;
  for (const placement of placements) {
    const hit = toLocal(placement, canvasX, canvasY);
    if (!hit) continue;
    if (!best || placement.depth < best.placement.depth) best = hit;
  }
  return best;
}

export interface PointerRouterOptions {
  /**
   * Set true once a browser redirects hit-testing itself, to stand the
   * router down rather than double-handling every event.
   */
  readonly platformHandlesHitTesting?: boolean;
  /** Events to intercept. Defaults to the ones a view actually needs. */
  readonly events?: readonly string[];
}

const DEFAULT_EVENTS = ["pointerdown", "pointerup", "click", "dblclick", "contextmenu"];

/**
 * Attaches to the scene canvas, maps each pointer event onto the element that
 * was drawn under the cursor, and replays it there.
 *
 * The replay targets the deepest real element at the corresponding point of
 * the source element's own layout box — the source subtree is still laid out
 * and hit-testable at its layout position, so the browser's own hit-testing
 * does the hard part and this only has to move the coordinates.
 */
export class PointerRouter {
  private placements: readonly Placement[] = [];
  private readonly detachers: (() => void)[] = [];
  private replaying = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: PointerRouterOptions = {},
  ) {}

  /** Called by the renderer every time the scene's geometry changes. */
  setPlacements(placements: readonly Placement[]): void {
    this.placements = placements;
  }

  attach(): () => void {
    if (this.options.platformHandlesHitTesting) return () => {};
    for (const type of this.options.events ?? DEFAULT_EVENTS) {
      const handler = (event: Event) => this.route(event as PointerEvent);
      this.canvas.addEventListener(type, handler, true);
      this.detachers.push(() => this.canvas.removeEventListener(type, handler, true));
    }
    return () => this.detach();
  }

  detach(): void {
    for (const detach of this.detachers.splice(0)) detach();
  }

  /**
   * The deepest real element at the corresponding point inside the source
   * view's own layout box.
   *
   * `elementFromPoint` is not enough here: under `layoutsubtree` every
   * immediate child of the canvas is laid out at the canvas origin, so all
   * views stack on top of each other in layout space and the singular call
   * always returns whichever one is topmost. Walking `elementsFromPoint` and
   * taking the first hit that belongs to the view we actually want is what
   * makes routing correct with overlapping views.
   */
  private deepestAt(hit: LocalHit): Element {
    const view = hit.placement.element;
    const rect = view.getBoundingClientRect();
    const x = rect.left + hit.x;
    const y = rect.top + hit.y;
    const stack =
      typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(x, y)
        : [document.elementFromPoint(x, y)].filter((el): el is Element => el !== null);
    for (const candidate of stack) {
      if (candidate === view || view.contains(candidate)) return candidate;
    }
    return view;
  }

  private route(event: PointerEvent): void {
    if (this.replaying) return;
    const rect = this.canvas.getBoundingClientRect();
    const hit = hitTest(
      this.placements,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    if (!hit) return;

    const view = hit.placement.element;
    const sourceRect = view.getBoundingClientRect();
    const target = this.deepestAt(hit);

    event.preventDefault();
    event.stopPropagation();
    this.replaying = true;
    try {
      target.dispatchEvent(
        new PointerEvent(event.type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: sourceRect.left + hit.x,
          clientY: sourceRect.top + hit.y,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          button: event.button,
          buttons: event.buttons,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
        }),
      );
      if (event.type === "pointerdown" && target instanceof HTMLElement) {
        // Focus follows the pointer, so keyboard use continues from where the
        // click landed rather than from the canvas.
        target.focus({ preventScroll: true });
      }
    } finally {
      this.replaying = false;
    }
  }
}
