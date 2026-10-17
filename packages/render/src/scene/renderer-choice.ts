/**
 * Which path a scene draws on, decided before anything is loaded.
 *
 * Pure, and free of WebGPU types: it asks the page whether the globals the
 * capture path needs are there, without naming them, so the main entry can
 * carry it and a page that cannot draw on the GPU never fetches `./gpu`.
 */

/** The two ways a scene is drawn. */
export type RendererPath = "gpu" | "dom";

/** What a host asks for: one path, or whichever this browser holds. */
export type RendererChoice = RendererPath | "auto";

/**
 * A frame, in milliseconds, at sixty a second. The first-frame check and the
 * DOM path's blur are both held to it.
 */
export const FRAME_BUDGET_MS = 1000 / 60;

interface PageLike {
  readonly location?: { readonly search?: string };
  readonly navigator?: object;
  readonly graviewRenderer?: unknown;
  readonly GPUQueue?: { readonly prototype?: object };
  readonly HTMLCanvasElement?: { readonly prototype?: object };
}

const pathOf = (value: unknown): RendererPath | null => (value === "gpu" || value === "dom" ? value : null);

/**
 * The path an operator asked for over the host's `auto`: `?renderer=gpu` or
 * `?renderer=dom` on the address, or `graviewRenderer` set on the page
 * before it loads — which is how a test runner forces a path on every page
 * without changing an address the test reads. Null when nobody asked.
 */
export function rendererAsked(page: PageLike = globalThis as PageLike): RendererPath | null {
  const fromPage = pathOf(page.graviewRenderer);
  if (fromPage) return fromPage;
  const search = page.location?.search;
  if (!search) return null;
  return pathOf(new URLSearchParams(search).get("renderer"));
}

/**
 * Whether this browser could draw the scene on the GPU at all: WebGPU, an
 * element-capture call on its queue, a canvas that says when capture is
 * legal, and a browser whose own hit-testing follows the drawn geometry.
 * Synchronous and without a device — an adapter may still be refused, which
 * the capture path's own first-frame check finds.
 *
 * THE LAST OF THESE IS WHAT MAKES THE GPU PATH THE SAME PAGE. A press, a
 * screen reader's box, an automation's click and a focused field's scroll
 * all land on where the browser thinks a view is. Chromium 158 (paint
 * records, no `layoutSubtree`) moves a view's box to where it was drawn
 * when told; Chrome 155 with capture switched on still spells
 * `layoutSubtree`, accepts the geometry and ignores it, so every box stays
 * where it was laid out and a press on a drawn district misses it. The
 * pointer router covered a mouse there and nothing else, so such a browser
 * draws on the DOM path, which it draws exactly.
 */
export function gpuCapturePresent(page: PageLike = globalThis as PageLike): boolean {
  if (!page.navigator || !("gpu" in page.navigator)) return false;
  const queue = page.GPUQueue?.prototype as Record<string, unknown> | undefined;
  if (!queue) return false;
  const captures = typeof queue["drawElementImageToTexture"] === "function" || typeof queue["copyElementImageToTexture"] === "function";
  const canvas = page.HTMLCanvasElement?.prototype as Record<string, unknown> | undefined;
  if (!captures || !canvas || typeof canvas["requestPaint"] !== "function") return false;
  return hitTestingFollowsDrawing(canvas);
}

/** The paint-record build, which places a view's box where it was drawn, and not the `layoutSubtree` one, which does not. */
function hitTestingFollowsDrawing(canvas: Record<string, unknown>): boolean {
  return typeof canvas["captureElementImage"] === "function" && !("layoutSubtree" in canvas);
}

/**
 * The path a scene starts on. `auto` is the GPU where the browser can draw
 * on it, and an operator's ask decides `auto` either way; a host that named
 * a path keeps it. Nothing reaches the GPU where it is absent — asked or not,
 * such a page draws on the DOM path and says nothing.
 */
export function chooseRenderer(
  asked: RendererChoice,
  { operator = null, present }: { readonly operator?: RendererPath | null; readonly present: boolean },
): RendererPath {
  const wanted = asked === "auto" ? (operator ?? "gpu") : asked;
  return wanted === "gpu" && present ? "gpu" : "dom";
}

/** What decides whether receded planes are blurred. */
export interface BlurPreferences {
  /** The host's off switch: `blur={false}`. */
  readonly off?: boolean;
  /** `prefers-reduced-motion: reduce`. */
  readonly reducedMotion?: boolean;
  /** `prefers-reduced-transparency: reduce`. */
  readonly reducedTransparency?: boolean;
}

/**
 * Whether receded planes are blurred: unless the host turned it off, or the
 * reader asked for less motion or less transparency. A blur is depth drawn
 * as softness, and a reader who asked for either does not want it.
 */
export function planeBlurOn({ off = false, reducedMotion = false, reducedTransparency = false }: BlurPreferences): boolean {
  return !off && !reducedMotion && !reducedTransparency;
}

/** The value at a share of the way through, sorted; 0 when there is none. */
function percentile(values: readonly number[], share: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]!;
}

/**
 * Whether a run of frames kept to a budget: its 95th percentile within it.
 * One slow frame is a hiccup; a slow twentieth is the cost of what is drawn.
 */
export function framesHeld(durations: readonly number[], budget = FRAME_BUDGET_MS): boolean {
  return percentile(durations, 0.95) <= budget;
}
