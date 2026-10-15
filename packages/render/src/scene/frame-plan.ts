import type { Placement } from "../interaction/pointer-router.js";
import type { Matrix4 } from "../platform/matrix.js";
import { connectorStyle, type ConnectorStyle } from "./connectors.js";
import { mixStyles, styleFor, transformFor, type PlaneStyle } from "./plane.js";

/** One view drawn into the scene: a DOM subtree, and where it belongs. */
export interface PlannedView {
  readonly id: string;
  /** 0 focus, 1 relations, 2 context. May be fractional mid-transition. */
  readonly plane: number;
  /** Layout position in canvas pixels, before the plane transform. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Set when the view's DOM changed and its texture is stale. */
  readonly dirty?: boolean;
  readonly opacity?: number;
  /**
   * Drawn by its host on the DOM path rather than captured: placed, so a
   * press still finds it, but never captured, drawn or reported.
   */
  readonly dom?: boolean;
}

export interface PlannedConnector {
  readonly id: string;
  readonly kind: string;
  readonly from: string;
  readonly to: string;
  readonly opacity?: number;
}

export interface CaptureCommand {
  readonly viewId: string;
  /** Why this frame needed the pixels again — useful when a budget blows. */
  readonly reason: "first" | "live" | "changed";
}

export interface ViewDraw {
  readonly viewId: string;
  readonly transform: Matrix4;
  readonly style: PlaneStyle;
  /** Drawn width and height, after the plane's scale. */
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}

export interface ConnectorDraw {
  readonly id: string;
  readonly kind: string;
  readonly style: ConnectorStyle;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly opacity: number;
}

export interface GeometryReport {
  readonly viewId: string;
  readonly transform: Matrix4;
}

export interface FramePlan {
  /** Views whose textures need refreshing, in draw order. */
  readonly captures: readonly CaptureCommand[];
  /** Back to front, so the focus plane lands on top. */
  readonly draws: readonly ViewDraw[];
  readonly connectors: readonly ConnectorDraw[];
  /** What to tell the browser about where each view ended up. */
  readonly geometry: readonly GeometryReport[];
  /** What the pointer router needs to route a click, nearest last. */
  readonly placements: readonly (Omit<Placement, "element"> & { readonly viewId: string })[];
  /** Captures this frame. The number the budget is spent on. */
  readonly captureCount: number;
  /**
   * Views whose pixels are out of date and were not retaken this frame,
   * because the budget was spent: retaken on a later frame, nearest plane
   * first. A view with no pixels at all is never deferred.
   */
  readonly deferred: readonly string[];
  /** Views wholly outside the canvas: neither captured nor drawn. */
  readonly culled: readonly string[];
}

export interface PlanOptions {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  /** Frame index of the last capture per view; absent means never captured. */
  readonly capturedAt?: Readonly<Record<string, number>>;
  readonly connectorOverrides?: Readonly<Record<string, Partial<ConnectorStyle>>>;
  /**
   * The views whose DOM the browser says changed since the last frame (a
   * `paint` event's `changedElements`). Given, a live view is retaken only
   * when it is in here or marked dirty — which is what keeps a page under
   * the cliff: a view that did not change does not cost a capture. Absent,
   * nothing is known unchanged and a live view is retaken every frame.
   */
  readonly changed?: ReadonlySet<string>;
  /**
   * The most RE-captures one frame may spend. What is over it is deferred to
   * a later frame, nearest plane first (see `CAPTURE_BUDGET`). A view seen
   * for the first time is always taken: the frame a stop lands in is allowed
   * to be long, and it is every frame after it the budget protects. Absent,
   * no limit.
   */
  readonly captureBudget?: number;
}

/**
 * How many captures one frame may spend, measured rather than chosen.
 *
 * Chromium 158 (Canary 158.0.8105.0, Apple silicon, headless, vsync off),
 * the discography's songs as N live views all moving every frame
 * (`apps/discography/live.html`, read by `scripts/verify-scale.mjs`): frames
 * a second, median of three runs, on a desk and with GRAVIEW_SLOW=4. Other
 * builds ran beside these, so each number is noisy by a third either way.
 *
 * | Live views | all retaken, desk | all retaken, SLOW=4 | changed only, desk | changed only, SLOW=4 |
 * |-----------:|------------------:|--------------------:|-------------------:|---------------------:|
 * |         64 |                42 |                  74 |                714 |                  455 |
 * |        128 |                21 |                  37 |                769 |                  417 |
 * |        256 |                10 |                  19 |                667 |                  244 |
 * |        512 |                 6 |                  10 |                417 |                  125 |
 *
 * "All retaken" is the policy before this budget: no word from the browser
 * about what changed, so every live view every frame. "Changed only" is
 * `attachGpu`: four views change a frame, so four are retaken.
 *
 * Capture costs ~0.22 ms a view on this build — linear, where 154 was
 * 0.016 ms up to ~128 and then fell off a cliff and crashed at 256
 * (docs/platform-findings.md) — so sixty frames a second holds only below
 * about 64 captures a frame. CPU throttling barely moves it: the
 * cost is the raster, not script. Thirty-two leaves half a frame for
 * everything else, and since only a view that CHANGED is retaken, a page of
 * 512 live views spends a handful of captures a frame, not 512. A view that
 * keeps changing past the budget is handed to the DOM path (`attachGpu`),
 * where a change costs no capture at all.
 */
export const CAPTURE_BUDGET = 32;

/**
 * What a frame consists of, as data — no GPU, no DOM, no browser.
 *
 * Separating the plan from its submission is what lets the fidelity policy,
 * plane ordering and geometry reporting be tested in CI with no GPU present,
 * while the executor that turns a plan into draw calls stays thin enough to
 * verify in a real browser once.
 */
export function planFrame(
  views: readonly PlannedView[],
  connectors: readonly PlannedConnector[],
  options: PlanOptions,
): FramePlan {
  const capturedAt = options.capturedAt ?? {};
  const wanted: (CaptureCommand & { plane: number })[] = [];
  const culled: string[] = [];
  const draws: ViewDraw[] = [];
  const geometry: GeometryReport[] = [];
  const placements: (Omit<Placement, "element"> & { viewId: string })[] = [];
  const centers = new Map<string, { x: number; y: number }>();

  // Back to front: the deepest plane is drawn first so the focus plane lands
  // on top of it. Sorting explicitly means callers may hand views over in any
  // order without changing what the scene looks like.
  const ordered = [...views].sort((a, b) => b.plane - a.plane);

  for (const view of ordered) {
    const style = styleAt(view.plane);
    const transform = transformFor(
      style,
      view.x,
      view.y,
      options.canvasWidth,
      options.canvasHeight,
    );
    const width = view.width * style.scale;
    const height = view.height * style.scale;
    centers.set(view.id, {
      x: transform[12] + width / 2,
      y: transform[13] + height / 2,
    });

    // IN VIEW, or nothing: a view wholly off the canvas costs no capture and
    // no draw. Its connector still runs toward it, from its center.
    const left = transform[12];
    const top = transform[13];
    if (left >= options.canvasWidth || top >= options.canvasHeight || left + width <= 0 || top + height <= 0) {
      culled.push(view.id);
      continue;
    }

    placements.push({
      viewId: view.id,
      transform,
      width: view.width,
      height: view.height,
      depth: view.plane,
    });
    if (view.dom) continue;

    const reason = captureReason(view, style, capturedAt[view.id], options.changed);
    if (reason) wanted.push({ viewId: view.id, reason, plane: view.plane });

    draws.push({
      viewId: view.id,
      transform,
      style,
      width,
      height,
      opacity: view.opacity ?? 1,
    });
    geometry.push({ viewId: view.id, transform });
  }

  // THE BUDGET, on what is only out of date: the nearest plane first. A view
  // with no pixels at all is always taken — a stale texture is a frame late,
  // a missing one is a hole.
  const budget = options.captureBudget ?? Number.POSITIVE_INFINITY;
  const granted = new Set(
    wanted
      .filter((capture) => capture.reason !== "first")
      .sort((a, b) => a.plane - b.plane)
      .slice(0, Math.max(0, budget))
      .map((capture) => capture.viewId),
  );
  const taken = (capture: CaptureCommand) => capture.reason === "first" || granted.has(capture.viewId);
  const captures: CaptureCommand[] = wanted.filter(taken).map(({ viewId, reason }) => ({ viewId, reason }));
  const deferred = wanted.filter((capture) => !taken(capture));

  const connectorDraws: ConnectorDraw[] = [];
  for (const connector of connectors) {
    const from = centers.get(connector.from);
    const to = centers.get(connector.to);
    // A connector to something off-scene is a line into nowhere.
    if (!from || !to) continue;
    connectorDraws.push({
      id: connector.id,
      kind: connector.kind,
      style: connectorStyle(connector.kind, options.connectorOverrides ?? {}),
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      opacity: connector.opacity ?? 1,
    });
  }

  return {
    captures,
    draws,
    connectors: connectorDraws,
    geometry,
    placements,
    captureCount: captures.length,
    deferred: deferred.map((capture) => capture.viewId),
    culled,
  };
}

/**
 * The treatment for a possibly-fractional plane. Mid-transition a view is
 * between two planes, and mixing their treatments is what makes the move read
 * as travel rather than a cut.
 */
function styleAt(plane: number): PlaneStyle {
  const lower = Math.floor(plane);
  const upper = Math.ceil(plane);
  if (lower === upper) return styleFor(plane);
  return mixStyles(styleFor(lower), styleFor(upper), plane - lower);
}

/**
 * Whether a view needs recapturing, and why. Fidelity decides, not plane
 * index — and the split is load-bearing rather than an optimization:
 * capture costs ~0.016 ms per node up to about 128 live captures a frame and
 * then falls off a cliff (see docs/platform-findings.md).
 *
 * - `full`    live: captured every frame its DOM changed — every frame,
 *             when the browser does not say what changed
 * - `summary` cached: captured only when its DOM actually changed
 * - `glyph`   captured once, then only when its content actually changed —
 *             at glyph scale a cached texture is indistinguishable from a
 *             live one, but a stale one shows last week's number for ever
 */
function captureReason(
  view: PlannedView,
  style: PlaneStyle,
  lastCapture: number | undefined,
  changed: ReadonlySet<string> | undefined,
): CaptureCommand["reason"] | null {
  if (lastCapture === undefined) return "first";
  // Mid-transition a view's own DOM is still fading, so whatever was captured
  // is not what it looks like. Caching that leaves an entering node stuck as
  // the transparent frame it was first seen in — which is precisely what
  // happened to every person raised onto plane 1.
  if (view.opacity !== undefined && view.opacity < 1) return "changed";
  switch (style.fidelity) {
    case "full":
      // Live means CAN change any frame, not does: told what changed, a
      // live view whose DOM did not is not retaken.
      if (changed) return view.dirty || changed.has(view.id) ? "live" : null;
      return "live";
    // A cached view is retaken when its host says it changed, or the browser does.
    case "summary":
    case "glyph":
      return view.dirty || changed?.has(view.id) ? "changed" : null;
  }
}
