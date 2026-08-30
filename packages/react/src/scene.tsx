import type { AnySchema, Fidelity, NodeOfSchema } from "@graview/core";
import { isAggregateId, layout, type Layout, type LayoutNode, type LayoutOptions } from "@graview/layout";
import {
  connectorStyle,
  PLANE_STYLES,
  styleFor,
  transformFor,
  type Matrix4,
} from "@graview/render";
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
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
    layout: Layout;
    /** The DOM host for a view id — what the capture API is given. */
    hostOf(id: string): HTMLElement | null;
  }) => (() => void) | void;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Rendered over the scene — an affordance surface, a header, a legend. */
  readonly children?: ReactNode;
}

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
  children,
}: SceneProps<S>) {
  const { store, views, view, selection, setSelection, setJackedIn } = useGraview<S>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // `nodes` is a cached snapshot that only changes when the graph does, so
  // the layout is recomputed exactly when the picture could have changed.
  const nodes = useGraph<S>();
  const result = useMemo<Layout>(
    () => layout(store.graph, store.schema, view, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, view, options, nodes],
  );

  useEffect(() => {
    if (renderer === "dom") return;
    const canvas = canvasRef.current;
    if (!canvas || !attachRenderer) return;
    const detach = attachRenderer({
      canvas,
      layout: result,
      hostOf: (id) =>
        canvas.querySelector<HTMLElement>(`[data-graview-view="${CSS.escape(id)}"]`),
    });
    return () => {
      detach?.();
    };
  }, [renderer, attachRenderer, result]);

  const useDom = renderer === "dom" || (renderer === "auto" && !attachRenderer);

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <canvas
        ref={canvasRef}
        // The attribute form works before the property is available.
        {...{ layoutsubtree: "" }}
        width={result.width}
        height={result.height}
        style={{ display: "block", width: result.width, height: result.height }}
      >
        {result.nodes.map((node) => (
          <SceneViewHost
            key={node.id}
            node={node}
            useDom={useDom}
            canvasWidth={result.width}
            canvasHeight={result.height}
            selected={selection.includes(node.id)}
            onSelect={(additive) =>
              setSelection((current) => selectionFor(node, current, additive))
            }
            onJackIn={() => setJackedIn(node.id)}
          >
            <ResolvedView node={node} mode="scene" selected={selection.includes(node.id)} />
          </SceneViewHost>
        ))}
      </canvas>
      <Connectors result={result} />
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
  node: LayoutNode,
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

function cssTransform(transform: Matrix4): string {
  // Column-major 4x4 into CSS matrix3d, which is also column-major.
  return `matrix3d(${transform.join(",")})`;
}

interface HostProps {
  readonly node: LayoutNode;
  readonly useDom: boolean;
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
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onJackIn,
  children,
}: HostProps) {
  const style = styleFor(node.plane);
  const transform = transformFor(style, node.x, node.y, canvasWidth, canvasHeight);

  const domOnly: CSSProperties = useDom
    ? {
        transform: cssTransform(transform),
        transformOrigin: "0 0",
        filter: style.blur > 0 ? `blur(${style.blur}px)` : undefined,
        opacity: 1 - style.falloff * 0.5,
        boxShadow: `0 ${8 * style.shadow}px ${28 * style.shadow}px rgba(0,0,0,${style.shadow})`,
      }
    : {};

  return (
    <div
      data-graview-view={node.id}
      data-graview-plane={node.plane}
      data-graview-selected={selected || undefined}
      role="group"
      aria-label={node.aggregate ? node.aggregate.label : node.id}
      tabIndex={0}
      onClick={(event) => onSelect(event.metaKey || event.shiftKey)}
      onDoubleClick={onJackIn}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: node.width,
        height: node.height,
        boxSizing: "border-box",
        ...domOnly,
      }}
    >
      {children}
    </div>
  );
}

/** The centre of a node's box as DRAWN, after its plane's scale. */
function drawnCentre(node: LayoutNode | undefined): { x: number; y: number } | null {
  if (!node) return null;
  const { scale } = styleFor(node.plane);
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
function Connectors({ result }: { result: Layout }) {
  if (result.connectors.length === 0) return null;
  const byId = new Map(result.nodes.map((node) => [node.id, node]));
  return (
    <svg
      aria-hidden="true"
      width={result.width}
      height={result.height}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
    >
      {result.connectors.map((connector) => {
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
        return (
          <line
            key={connector.id}
            data-graview-connector={connector.kind}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={`hsl(${Math.round(style.hue * 360)} 40% 40%)`}
            strokeWidth={style.width}
            strokeDasharray={DASH[style.pattern]}
            strokeLinecap="round"
            opacity={style.opacity * 0.75}
          />
        );
      })}
    </svg>
  );
}

export interface ResolvedViewProps<S extends AnySchema> {
  readonly node: LayoutNode;
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
  node: LayoutNode;
  props: ViewProps<S>;
}) {
  return (
    <div style={{ padding: 8, font: "13px/1.4 system-ui", overflow: "hidden" }}>
      <strong>{props.label ?? node.kind}</strong>
      {props.nodes ? <div>{props.nodes.length} items</div> : <div>{node.id}</div>}
    </div>
  );
}
