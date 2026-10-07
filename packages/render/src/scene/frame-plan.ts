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
  /** What the pointer router needs to route a click. */
  readonly placements: readonly Omit<Placement, "element">[];
  /** Captures this frame. The number the budget is spent on. */
  readonly captureCount: number;
}

export interface PlanOptions {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  /** Frame index of the last capture per view; absent means never captured. */
  readonly capturedAt?: Readonly<Record<string, number>>;
  readonly connectorOverrides?: Readonly<Record<string, Partial<ConnectorStyle>>>;
}

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
  const captures: CaptureCommand[] = [];
  const draws: ViewDraw[] = [];
  const geometry: GeometryReport[] = [];
  const placements: Omit<Placement, "element">[] = [];
  const centers = new Map<string, { x: number; y: number }>();

  // Back to front: the deepest plane is drawn first so the focus plane lands
  // on top of it. Sorting explicitly means callers may hand views over in any
  // order without changing what the scene looks like.
  const ordered = [...views].sort((a, b) => b.plane - a.plane);

  for (const view of ordered) {
    const style = styleAt(view.plane);
    const reason = captureReason(view, style, capturedAt[view.id]);
    if (reason) captures.push({ viewId: view.id, reason });

    const transform = transformFor(
      style,
      view.x,
      view.y,
      options.canvasWidth,
      options.canvasHeight,
    );
    const width = view.width * style.scale;
    const height = view.height * style.scale;

    draws.push({
      viewId: view.id,
      transform,
      style,
      width,
      height,
      opacity: view.opacity ?? 1,
    });
    geometry.push({ viewId: view.id, transform });
    placements.push({
      transform,
      width: view.width,
      height: view.height,
      depth: view.plane,
    });
    centers.set(view.id, {
      x: transform[12] + width / 2,
      y: transform[13] + height / 2,
    });
  }

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
 * - `full`    live: captured every frame, because it is being edited
 * - `summary` cached: captured only when its DOM actually changed
 * - `glyph`   captured once, then only when its content actually changed —
 *             at glyph scale a cached texture is indistinguishable from a
 *             live one, but a stale one shows last week's number for ever
 */
function captureReason(
  view: PlannedView,
  style: PlaneStyle,
  lastCapture: number | undefined,
): CaptureCommand["reason"] | null {
  if (lastCapture === undefined) return "first";
  // Mid-transition a view's own DOM is still fading, so whatever was captured
  // is not what it looks like. Caching that leaves an entering node stuck as
  // the transparent frame it was first seen in — which is precisely what
  // happened to every person raised onto plane 1.
  if (view.opacity !== undefined && view.opacity < 1) return "changed";
  switch (style.fidelity) {
    case "full":
      return "live";
    case "summary":
      return view.dirty ? "changed" : null;
    case "glyph":
      return view.dirty ? "changed" : null;
  }
}
