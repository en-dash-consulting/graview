import type { AnySchema, Fidelity, NodeOfSchema } from "@graview/core";
import {
  isAggregateId,
  kindsOfAggregate,
  layout,
  withRelation,
  type InterpolatedLayout,
  type Layout,
  type LayoutNode,
  type LayoutOptions,
} from "@graview/layout";
import {
  connectorStyle,
  mixStyles,
  PLANE_STYLES,
  styleFor,
  transformFor,
  type Matrix4,
} from "@graview/render";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAnimatedLayout, useTouched } from "./animation.js";
import { useGraph, useGraview, type ViewMode } from "./context.js";
import type { ViewComponent, ViewProps } from "./view-registry.js";

export interface SceneProps<S extends AnySchema> {
  readonly options?: LayoutOptions;
  /**
   * `gpu` composites through @graview/render; `dom` positions views with CSS
   * transforms. `auto` picks gpu when the platform supports it.
   *
   * The DOM path is not a toy: the plane model is affine by design, so a CSS
   * transform reproduces the geometry exactly. What it cannot do is per-plane
   * blur and falloff — which is precisely the thing that justified the GPU
   * pipeline, and precisely what is safe to lose when it is unavailable.
   */
  readonly renderer?: "gpu" | "dom" | "auto";
  /**
   * Wires a renderer to the canvas. Called whenever the layout changes, with
   * the canvas and the current picture; return a cleanup.
   *
   * The binding stays out of the renderer's business deliberately: it hands
   * over the canvas and what layout decided, and the renderer decides pixels.
   */
  readonly attachRenderer?: (scene: {
    canvas: HTMLCanvasElement;
    /**
     * The picture as it is RIGHT NOW, which mid-transition is between two
     * view states. Planes may be fractional and nodes may be part-faded.
     */
    layout: InterpolatedLayout;
    /**
     * Views whose CONTENT changed, so a cached texture must be retaken.
     *
     * Position and size changes the renderer can see for itself; a count
     * inside an aggregate changing is invisible to it, and `glyph` fidelity
     * would otherwise show the old number for ever.
     */
    dirty: ReadonlySet<string>;
    /** The DOM host for a view id — what the capture API is given. */
    hostOf(id: string): HTMLElement | null;
  }) => (() => void) | void;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Animate between view states. Off in tests and SSR. */
  readonly animate?: boolean;
  /** Rendered over the scene — an affordance surface, a header, a legend. */
  readonly children?: ReactNode;
}

/**
 * A node as the scene draws it: a laid-out node, possibly mid-transition, so
 * its plane is fractional and it may be fading in or out.
 */
export type SceneNode = Omit<LayoutNode, "plane"> & {
  readonly plane: number;
  readonly opacity?: number;
};

/**
 * The spatial scene: one `<canvas layoutsubtree>` with the views as its
 * IMMEDIATE children.
 *
 * That flatness is a platform constraint, not a style: capture rejects
 * anything deeper than a direct child of the canvas. Nesting happens inside a
 * view, never between views.
 */
export function Scene<S extends AnySchema>({
  options,
  renderer = "auto",
  attachRenderer,
  className,
  style,
  animate = true,
  children,
}: SceneProps<S>) {
  const { store, views, view, setView, selection, setSelection, setJackedIn } = useGraview<S>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(wrapperRef);

  // `nodes` is a cached snapshot that only changes when the graph does, so
  // the layout is recomputed exactly when the picture could have changed.
  const nodes = useGraph<S>();
  // The scene is laid out to the space it actually has. A fixed canvas leaves
  // dead ground on a wide screen and clips on a narrow one, and the plane
  // bands are proportions rather than pixels, so they follow.
  const sized = useMemo<LayoutOptions>(
    () => ({
      ...options,
      ...(size ? { width: size.width, height: size.height } : {}),
    }),
    [options, size],
  );
  const result = useMemo<Layout>(
    () => layout(store.graph, store.schema, view, sized),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, view, sized, nodes],
  );

  // The picture as it is right now, part-way between the last view and this
  // one. Everything downstream draws the tween, not the destination.
  const frame = useAnimatedLayout(result, { enabled: animate });
  const touched = useTouched<S>();

  useEffect(() => {
    if (renderer === "dom") return;
    const canvas = canvasRef.current;
    if (!canvas || !attachRenderer) return;
    // The renderer is handed the FRAME, not the target.
    //
    // Two reasons, both of which were bugs before: the DOM holds the tween,
    // so a host for a node that has not entered yet does not exist to be
    // captured; and drawing the target during a transition would snap every
    // view to its final position while the DOM animated underneath it.
    // A group is stale when any of its members changed, since its own view
    // is a summary of them.
    const dirty = new Set<string>();
    for (const node of frame.nodes) {
      if (touched.has(node.id)) dirty.add(node.id);
      else if (node.aggregate?.memberIds.some((id) => touched.has(id))) dirty.add(node.id);
    }

    const detach = attachRenderer({
      canvas,
      layout: frame,
      dirty,
      hostOf: (id) =>
        canvas.querySelector<HTMLElement>(`[data-graview-view="${CSS.escape(id)}"]`),
    });
    return () => {
      detach?.();
    };
  }, [renderer, attachRenderer, frame, touched]);

  const useDom = renderer === "dom" || (renderer === "auto" && !attachRenderer);

  const hosts = frame.nodes.map((node) => (
    <SceneViewHost
      key={node.id}
      node={node}
      useDom={useDom}
      touched={touched.has(node.id)}
      canvasWidth={result.width}
      canvasHeight={result.height}
      selected={selection.includes(node.id)}
      onSelect={(additive) => {
        /*
         * A group is a PLACE; a node is a THING.
         *
         * Clicking a group raises its members onto plane 1 — which is what
         * "open the People block" obviously means, and what the whole
         * aggregate model is for. Before this, clicking a group silently
         * selected members that were not on screen and looked like nothing
         * had happened, and the only way to raise anything was a button in
         * the far corner of the command bar.
         *
         * Hold shift or meta to select the members instead.
         */
        const kinds = node.aggregate ? kindsOfAggregate(node.id) : [];
        if (kinds.length === 1 && !additive && Math.round(node.plane) !== 0) {
          const kind = kinds[0]!;
          setView((current) => withRelation(current, current.relation === kind ? null : kind));
          return;
        }
        setSelection((current) => selectionFor(node, current, additive));
      }}
      onJackIn={() => setJackedIn(node.id)}
    >
      <ResolvedView node={node} mode="scene" selected={selection.includes(node.id)} />
    </SceneViewHost>
  ));

  return (
    <div
      ref={wrapperRef}
      className={`graview-ground${className ? ` ${className}` : ""}`}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        // The stage is sized to the measurement, but a stale measurement
        // during a resize can briefly exceed it. Clipping keeps the scene
        // inside its own bounds instead of pushing the page taller and
        // cutting off anything floating over it.
        overflow: "hidden",
        ...style,
      }}
    >
      {useDom ? (
        /*
         * The DOM path uses an ORDINARY container, not a capture canvas.
         *
         * `layoutsubtree` exists so the GPU can capture these elements, and
         * it changes how the browser lays them out. Combining it with the CSS
         * transforms and filters this path applies crashes the renderer
         * process in Chromium 154 — silently, on first paint. Since the DOM
         * path never captures anything, the canvas has no job here, and not
         * creating one removes the whole interaction.
         */
        <div
          data-graview-stage="dom"
          style={{
            position: "relative",
            zIndex: 1,
            width: result.width,
            height: result.height,
            overflow: "hidden",
          }}
        >
          {hosts}
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          data-graview-stage="gpu"
          // The attribute form works before the property is available.
          {...{ layoutsubtree: "" }}
          width={result.width}
          height={result.height}
          style={{
            display: "block",
            position: "relative",
            zIndex: 1,
            width: result.width,
            height: result.height,
          }}
        >
          {hosts}
        </canvas>
      )}
      <Connectors result={frame} above={!useDom} />
      {children}
    </div>
  );
}

/**
 * What a click on a view selects.
 *
 * Selecting a GROUP selects its members, because a group is a view of a set
 * of nodes rather than a node itself — "select the People block" means the
 * people. Everything downstream then works unchanged: the affordance layer
 * sees a selection of real nodes and can say what is true about them.
 */
export function selectionFor(
  node: SceneNode,
  current: readonly string[],
  additive: boolean,
): string[] {
  const ids = node.aggregate ? [...node.aggregate.memberIds] : [node.id];
  if (!additive) return ids;
  const alreadyIn = ids.every((id) => current.includes(id));
  return alreadyIn
    ? current.filter((id) => !ids.includes(id))
    : [...current, ...ids.filter((id) => !current.includes(id))];
}

/**
 * The element's size, tracked. Returns null until it has been measured, so a
 * first render never lays out against a guess.
 */
function useElementSize(
  ref: { current: HTMLElement | null },
): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width === 0 || box.height === 0) return;
      // Round to whole pixels: a fractional width would recompute the layout
      // on every sub-pixel wobble and never settle.
      setSize((current) => {
        const next = { width: Math.round(box.width), height: Math.round(box.height) };
        return current && current.width === next.width && current.height === next.height
          ? current
          : next;
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function cssTransform(transform: Matrix4): string {
  // Column-major 4x4 into CSS matrix3d, which is also column-major.
  return `matrix3d(${transform.join(",")})`;
}

interface HostProps {
  readonly node: SceneNode;
  readonly useDom: boolean;
  readonly touched: boolean;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly selected: boolean;
  onSelect(additive: boolean): void;
  onJackIn(): void;
  readonly children: ReactNode;
}

/**
 * One view's box. Absolutely positioned so the canvas can place it, and sized
 * so the capture texture matches the DOM exactly.
 */
function SceneViewHost({
  node,
  useDom,
  touched,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onJackIn,
  children,
}: HostProps) {
  // Mid-transition a node's plane is fractional, so its treatment is mixed
  // from the two planes it is between rather than snapping at the halfway
  // point. That is what makes a plane change read as travel.
  const lower = Math.max(0, Math.min(2, Math.floor(node.plane))) as 0 | 1 | 2;
  const upper = Math.max(0, Math.min(2, Math.ceil(node.plane))) as 0 | 1 | 2;
  const style =
    lower === upper
      ? styleFor(lower)
      : mixStyles(styleFor(lower), styleFor(upper), node.plane - lower);
  const transform = transformFor(style, node.x, node.y, canvasWidth, canvasHeight);

  const domOnly: CSSProperties = useDom
    ? {
        transform: cssTransform(transform),
        transformOrigin: "0 0",
        filter: style.blur > 0 ? `blur(${style.blur}px)` : undefined,
        // Recession dims toward the ground; entering and leaving nodes carry
        // their own fade on top of it.
        opacity: (1 - style.falloff * 0.55) * (node.opacity ?? 1),
        boxShadow: `0 ${10 * style.shadow}px ${34 * style.shadow}px rgba(0,0,0,${style.shadow + 0.2})`,
      }
    : // The GPU path does NOT fade the host: the shader owns opacity there,
      // and applying it in both places made an entering view fade as
      // opacity² — visibly faster and dimmer than the DOM path, so the two
      // renderers disagreed about the same transition. It also meant a view
      // captured mid-fade baked its own transparency into the texture.
      {};

  return (
    <div
      data-graview-view={node.id}
      data-graview-plane={Math.round(node.plane)}
      data-graview-selected={selected || undefined}
      data-graview-touched={touched || undefined}
      title={node.aggregate ? `Open ${node.aggregate.label}` : undefined}
      role="group"
      aria-label={node.aggregate ? node.aggregate.label : node.id}
      tabIndex={0}
      onClick={(event) => onSelect(event.metaKey || event.shiftKey)}
      onDoubleClick={onJackIn}
      style={{
        position: "absolute",
        // Each host sits at its own layout position, on BOTH paths.
        //
        // Under `layoutsubtree` every child is laid out at the canvas origin,
        // so hosts pinned to 0,0 pile up on each other and only some of them
        // end up with usable paint records — five views captured completely
        // blank because of it. Giving each its own box keeps them distinct
        // for the capture. The GPU still draws each wherever its plane
        // transform says; this only decides what gets rasterised.
        left: useDom ? 0 : Math.round(node.x),
        top: useDom ? 0 : Math.round(node.y),
        // Whole pixels, matching what the renderer allocates a texture for.
        // A host of height 399.4 rasterises into 400 rows; a texture sized
        // from the rounded 399 rejects the copy, and the view keeps whatever
        // was in the texture before — silently.
        width: Math.round(node.width),
        height: Math.round(node.height),
        boxSizing: "border-box",
        ...domOnly,
      }}
    >
      {children}
    </div>
  );
}

/** The centre of a node's box as DRAWN, after its plane's scale. */
function drawnCentre(node: SceneNode | undefined): { x: number; y: number } | null {
  if (!node) return null;
  const lower = Math.max(0, Math.min(2, Math.floor(node.plane))) as 0 | 1 | 2;
  const upper = Math.max(0, Math.min(2, Math.ceil(node.plane))) as 0 | 1 | 2;
  const { scale } =
    lower === upper
      ? styleFor(lower)
      : mixStyles(styleFor(lower), styleFor(upper), node.plane - lower);
  return { x: node.x + (node.width * scale) / 2, y: node.y + (node.height * scale) / 2 };
}

const DASH: Record<string, string | undefined> = {
  solid: undefined,
  dashed: "7 5",
  dotted: "1 5",
  double: "12 3",
  tapered: "10 3 3 3",
};

/**
 * Connectors, drawn in SVG over the scene on BOTH renderer paths.
 *
 * A deliberate choice, not an omission: the GPU pipeline earns its cost on
 * per-plane blur of captured pixels, and lines are the one thing it would be
 * worse at. SVG strokes stay crisp at any scale, carry their edge kind into
 * the DOM where a test or a screen reader can find it, and cost nothing to
 * restyle. The capture inside a `layoutsubtree` canvas is not disturbed,
 * because this sits outside it.
 */
function Connectors({
  result,
  above,
}: {
  result: {
    nodes: readonly SceneNode[];
    connectors: Layout["connectors"] | InterpolatedLayout["connectors"];
    width: number;
    height: number;
  };
  /** The GPU canvas is opaque, so connectors have to sit over it, not under. */
  above: boolean;
}) {
  const byId = new Map(result.nodes.map((node) => [node.id, node]));
  /*
   * Only relationships involving a RAISED node are drawn.
   *
   * With nothing on plane 1, every edge between the focus and a context
   * group still had two endpoints on screen, so the scene filled with long
   * curves nobody asked to see. A connector earns its ink by explaining the
   * thing you just asked for.
   */
  const connectors = result.connectors.filter((connector) => {
    const from = byId.get(connector.from);
    const to = byId.get(connector.to);
    return from && to && (Math.round(from.plane) === 1 || Math.round(to.plane) === 1);
  });
  if (connectors.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      width={result.width}
      height={result.height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
        // Behind the views on the DOM path, where the stage is transparent
        // and a relationship should not compete with what it connects. Above
        // on the GPU path, where the canvas clears to the ground colour and
        // anything beneath it is simply painted over.
        zIndex: above ? 2 : 0,
      }}
    >
      {connectors.map((connector) => {
        // Endpoints are recomputed against the DRAWN boxes, not layout's own
        // centres: a plane scales its box in place, so a receded node's centre
        // is not where layout's unscaled box says it is. Using layout's
        // coordinates here sent every connector to a point off the canvas.
        const from = drawnCentre(byId.get(connector.from));
        const to = drawnCentre(byId.get(connector.to));
        if (!from || !to) return null;
        // Stroke treatment is derived from the edge kind, so `protects` can
        // never be mistaken for `assigned-to`.
        const style = connectorStyle(connector.kind);
        // A gentle curve, bowed along the dominant axis. Straight lines
        // between distant planes read as lasers crossing the scene; a curve
        // reads as a relationship and lets several of them stay apart.
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const bow = Math.min(90, Math.hypot(to.x - from.x, to.y - from.y) * 0.16);
        const control =
          Math.abs(to.y - from.y) > Math.abs(to.x - from.x)
            ? `${midX + bow} ${midY}`
            : `${midX} ${midY - bow}`;
        return (
          <path
            key={connector.id}
            data-graview-connector={connector.kind}
            d={`M ${from.x} ${from.y} Q ${control} ${to.x} ${to.y}`}
            fill="none"
            stroke={`hsl(${Math.round(style.hue * 360)} 55% 62%)`}
            strokeWidth={Math.min(1.4, style.width)}
            strokeDasharray={DASH[style.pattern]}
            strokeLinecap="round"
            opacity={style.opacity * 0.34 * ((connector as { opacity?: number }).opacity ?? 1)}
          />
        );
      })}
    </svg>
  );
}

export interface ResolvedViewProps<S extends AnySchema> {
  readonly node: SceneNode;
  readonly mode: ViewMode;
  readonly selected: boolean;
  /** Overrides the fidelity the plane would ask for. Jack-in uses this. */
  readonly fidelity?: Fidelity;
}

/**
 * Picks the view for a cell of the matrix — cardinality by whether this is an
 * aggregate, fidelity by plane depth — and renders it.
 *
 * A kind with no registered view falls back to the primitive the app
 * supplied, which is why a new node kind renders sensibly before anyone
 * writes a view for it.
 */
export function ResolvedView<S extends AnySchema>({
  node,
  mode,
  selected,
  fidelity,
}: ResolvedViewProps<S>) {
  const { store, views } = useGraview<S>();
  const cardinality = node.aggregate || isAggregateId(node.id) ? "many" : "one";
  const cell = {
    cardinality,
    fidelity: fidelity ?? PLANE_STYLES[clampPlane(node.plane)].fidelity,
  } as const;

  const registration = views.resolve(node.kind, cell);
  const Component = registration?.view as ViewComponent<S> | undefined;

  const props: ViewProps<S> = {
    ...(node.aggregate
      ? {
          nodes: node.aggregate.memberIds
            .map((id) => store.graph.getNode(id))
            .filter((n): n is NodeOfSchema<S> => n !== undefined),
          label: node.aggregate.label,
        }
      : { node: store.graph.getNode(node.id) as never }),
    fidelity: cell.fidelity,
    cardinality: cell.cardinality,
    mode,
    selected,
  };

  if (!Component) return <MissingView node={node} props={props} />;
  return <Component {...props} />;
}

function clampPlane(plane: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(2, Math.round(plane))) as 0 | 1 | 2;
}

/**
 * What a kind with no view looks like. Deliberately readable rather than
 * apologetic: an undecorated node is a legitimate state during development,
 * and it should still say what it is.
 */
function MissingView<S extends AnySchema>({
  node,
  props,
}: {
  node: SceneNode;
  props: ViewProps<S>;
}) {
  return (
    <div style={{ padding: 8, font: "13px/1.4 system-ui", overflow: "hidden" }}>
      <strong>{props.label ?? node.kind}</strong>
      {props.nodes ? <div>{props.nodes.length} items</div> : <div>{node.id}</div>}
    </div>
  );
}
