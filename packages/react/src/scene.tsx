import type { AnySchema, Fidelity, NodeOfSchema } from "@graview/core";
import { isAggregateId, layout, type Layout, type LayoutNode, type LayoutOptions } from "@graview/layout";
import { PLANE_STYLES, styleFor, transformFor, type Matrix4 } from "@graview/render";
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { useGraview, type ViewMode } from "./context.js";
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
  /** Wires the compositor up. Omit to run the DOM path. */
  readonly attachRenderer?: (canvas: HTMLCanvasElement) => (() => void) | void;
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

  const nodes = store.graph.allNodes();
  const result = useMemo<Layout>(
    () => layout(store.graph, store.schema, view, options),
    // The graph is read through the store on every render; `nodes.length` and
    // the view are what actually change the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, view, options, nodes.length],
  );

  useEffect(() => {
    if (renderer === "dom") return;
    const canvas = canvasRef.current;
    if (!canvas || !attachRenderer) return;
    const detach = attachRenderer(canvas);
    return () => {
      detach?.();
    };
  }, [renderer, attachRenderer]);

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
              setSelection((current) =>
                additive
                  ? current.includes(node.id)
                    ? current.filter((id) => id !== node.id)
                    : [...current, node.id]
                  : [node.id],
              )
            }
            onJackIn={() => setJackedIn(node.id)}
          >
            <ResolvedView node={node} mode="scene" selected={selection.includes(node.id)} />
          </SceneViewHost>
        ))}
      </canvas>
      {useDom ? <Connectors result={result} /> : null}
      {children}
    </div>
  );
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

/** Connectors, drawn in SVG on the DOM path. The GPU path draws its own. */
function Connectors({ result }: { result: Layout }) {
  if (result.connectors.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      width={result.width}
      height={result.height}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
    >
      {result.connectors.map((connector) => (
        <line
          key={connector.id}
          data-graview-connector={connector.kind}
          x1={connector.x1}
          y1={connector.y1}
          x2={connector.x2}
          y2={connector.y2}
          stroke="currentColor"
          strokeWidth={1.5}
          opacity={0.5}
        />
      ))}
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
