import type { AnySchema, Fidelity, NodeOfSchema } from "@graview/core";
import {
  isAggregateId,
  kindOfCard,
  kindsOf,
  layout,
  withFocus,
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
import { useFlagged, useImplicated } from "./hooks.js";
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
  const { store, scheme, views, view, setView, selection, setSelection, setJackedIn, setMenuAt } =
    useGraview<S>();
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
      scheme={scheme}
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
        const kinds = node.aggregate ? kindsOf(node.id) : [];
        if (kinds.length === 1 && !additive && Math.round(node.plane) !== 0) {
          const kind = kinds[0]!;
          setView((current) => withRelation(current, current.relation === kind ? null : kind));
          return;
        }
        setSelection((current) => selectionFor(node, current, additive));
      }}
      /*
       * Picking a thing SELECTS it, and leaves the picture where it is.
       *
       * It used to travel, which is the wrong default: most of the time you
       * want to act on the thing where it is — substitute a player without
       * leaving the formation, move an event without leaving the week — and
       * being thrown into a detail view to do it costs you the context that
       * made the decision obvious. Travel is the deliberate second gesture.
       */
      onPick={(id, additive) =>
        setSelection((current) =>
          additive
            ? current.includes(id)
              ? current.filter((other) => other !== id)
              : [...current, id]
            : [id],
        )
      }
      /*
       * Double click means GO DEEPER, whatever it lands on: into the node a
       * view nominated, or — where a view nominated nothing — into the view
       * itself as a full page. One gesture, one meaning.
       */
      onTravel={(id) => {
        setView((current) => ({ ...withFocus(current, id), relation: null }));
        setSelection([id]);
      }}
      onMenu={setMenuAt}
      selection={selection}
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
      <Connectors result={frame} above={!useDom} scheme={scheme} overview={view.overview ?? false} />
      <RelationCaptions nodes={frame.nodes} scheme={scheme} />
      {children}
    </div>
  );
}

/**
 * What plane 1 is, said in words, over the run of cards it applies to.
 *
 * The schema has always carried a description on every edge — "who does the
 * run", "a nap that must not be interrupted" — and nothing ever showed them.
 * A row of anonymous cards under the thing you clicked is a puzzle; the same
 * row under "who does the run" is an answer. Layout groups the neighbourhood
 * by edge kind, so each caption spans one contiguous run rather than
 * repeating itself once per card.
 */
function RelationCaptions({
  nodes,
  scheme,
}: {
  readonly nodes: readonly SceneNode[];
  readonly scheme: "light" | "dark";
}) {
  const runs: { key: string; text: string; left: number; right: number; top: number }[] = [];
  for (const node of nodes) {
    if (!node.via || Math.round(node.plane) !== 1) continue;
    const { scale } = styleFor(1, scheme);
    const left = node.x;
    const right = node.x + node.width * scale;
    const top = node.y;
    const last = runs[runs.length - 1];
    if (last && last.key === node.via.edgeKind) {
      last.right = Math.max(last.right, right);
      last.top = Math.min(last.top, top);
      continue;
    }
    runs.push({
      key: node.via.edgeKind,
      text: node.via.description ?? node.via.edgeKind.replace(/-/g, " "),
      left,
      right,
      top,
    });
  }
  if (runs.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}
    >
      {runs.map((run) => (
        <div
          key={run.key}
          data-graview-relation={run.key}
          style={{
            position: "absolute",
            left: run.left,
            width: Math.max(0, run.right - run.left),
            // Sits in the gutter above the run, not on top of the cards.
            top: Math.max(0, run.top - 17),
            fontSize: 10,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "var(--graview-ink-faint)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {run.text}
        </div>
      ))}
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

/**
 * A plane's elevation, in the idiom of its scheme.
 *
 * Dark separates by luminance, so one soft dark pool is right. Light
 * separates the way objects on a desk do — a tight contact shadow plus a
 * long diffuse one — so it gets both, and the further plane casts the
 * longer, weaker one.
 */
function planeShadow(shadow: number, scheme: "light" | "dark"): string {
  if (scheme === "dark") {
    return `0 ${(10 * shadow).toFixed(1)}px ${(34 * shadow).toFixed(1)}px rgba(0,0,0,${(shadow + 0.12).toFixed(2)})`;
  }
  const contact = `0 ${(1 + 2 * shadow).toFixed(1)}px ${(2 + 5 * shadow).toFixed(1)}px rgba(20,30,32,${(0.03 + 0.06 * shadow).toFixed(3)})`;
  const cast = `0 ${(6 + 26 * shadow).toFixed(1)}px ${(18 + 60 * shadow).toFixed(1)}px -${(10 + 10 * shadow).toFixed(1)}px rgba(20,30,32,${(0.1 + 0.3 * shadow).toFixed(3)})`;
  return `${contact}, ${cast}`;
}

function cssTransform(transform: Matrix4): string {
  // Column-major 4x4 into CSS matrix3d, which is also column-major.
  return `matrix3d(${transform.join(",")})`;
}

interface HostProps {
  readonly node: SceneNode;
  readonly useDom: boolean;
  readonly touched: boolean;
  readonly scheme: "light" | "dark";
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly selected: boolean;
  onSelect(additive: boolean): void;
  /** A view marked an inner element with `data-graview-pick`. */
  onPick(id: string, additive: boolean): void;
  /** The deliberate second gesture: go into the thing that was picked. */
  onTravel(id: string): void;
  /** Ask for the actions at a point, in viewport coordinates. */
  onMenu(at: { x: number; y: number }): void;
  /** The whole selection, so the keyboard can tell a first press from a second. */
  readonly selection: readonly string[];
  onJackIn(): void;
  readonly children: ReactNode;
}

/**
 * One view's box. Absolutely positioned so the canvas can place it, and sized
 * so the capture texture matches the DOM exactly.
 */
/**
 * Makes every `data-graview-pick` element a real control.
 *
 * The host owns this for the same reason it owns click routing: marking an
 * element is meant to be the WHOLE contract. Having made clicking an event
 * the primary way to move through the graph, leaving those targets
 * unreachable by keyboard would have made the primary interaction
 * mouse-only — a worse accessibility regression than the one it fixed.
 *
 * Set as attributes rather than as props because the elements belong to
 * whatever view drew them; React is not managing these, so there is nothing
 * to fight over.
 */
function usePickTargets(ref: { current: HTMLElement | null }): void {
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    for (const target of host.querySelectorAll<HTMLElement>("[data-graview-pick]")) {
      if (target.getAttribute("tabindex") === null) target.setAttribute("tabindex", "0");
      if (target.getAttribute("role") === null) target.setAttribute("role", "button");
    }
  });
}

function SceneViewHost({
  node,
  useDom,
  touched,
  scheme,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onPick,
  onTravel,
  onMenu,
  selection,
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
      ? styleFor(lower, scheme)
      : mixStyles(styleFor(lower, scheme), styleFor(upper, scheme), node.plane - lower);
  const transform = transformFor(style, node.x, node.y, canvasWidth, canvasHeight);
  const ref = useRef<HTMLDivElement | null>(null);
  usePickTargets(ref);

  /** The node a pointer or key event is really about. */
  const pickedFrom = (target: EventTarget | null): string | null =>
    (target as HTMLElement | null)?.closest?.("[data-graview-pick]")?.getAttribute(
      "data-graview-pick",
    ) ?? null;

  const domOnly: CSSProperties = useDom
    ? {
        transform: cssTransform(transform),
        transformOrigin: "0 0",
        filter: style.blur > 0 ? `blur(${style.blur}px)` : undefined,
        // Recession dims toward the ground; entering and leaving nodes carry
        // their own fade on top of it.
        opacity: (1 - style.falloff * 0.55) * (node.opacity ?? 1),
        /*
         * Depth is handed DOWN as the elevation token, not painted on the
         * host.
         *
         * A host box-shadow outlines the box the layout allotted, which is
         * only the same shape as the view when the view fills it. Once a
         * detail panel sized to its own content, every focused node picked
         * up a large ghost rectangle behind it. Setting the token means the
         * panel casts the plane's shadow from its own edges — and any view
         * built on `Panel` gets it without knowing planes exist.
         */
        ["--graview-lift-low" as string]: planeShadow(style.shadow, scheme),
      }
    : // The GPU path does NOT fade the host: the shader owns opacity there,
      // and applying it in both places made an entering view fade as
      // opacity² — visibly faster and dimmer than the DOM path, so the two
      // renderers disagreed about the same transition. It also meant a view
      // captured mid-fade baked its own transparency into the texture.
      {};

  return (
    <div
      ref={ref}
      data-graview-view={node.id}
      data-graview-plane={Math.round(node.plane)}
      data-graview-selected={selected || undefined}
      data-graview-touched={touched || undefined}
      /*
        * "Open X" only where clicking raises X. On plane 0 the group IS what
        * you are looking at, so the tooltip promised something clicking does
        * not do — and it shadowed the more specific titles a view puts on its
        * own contents.
        */
      title={
        node.aggregate && Math.round(node.plane) !== 0
          ? `Open ${node.aggregate.label}`
          : undefined
      }
      role="group"
      aria-label={node.aggregate ? node.aggregate.label : node.id}
      tabIndex={0}
      onClick={(event) => {
        const additive = event.metaKey || event.shiftKey;
        /*
         * A view may nominate its own inner targets.
         *
         * Any element carrying `data-graview-pick="<node id>"` is a real
         * thing in the graph, and clicking it means that thing — not the
         * view that happens to be drawing it. One rule, in one place, and
         * every view gets it: a span in the calendar, a row in a roster, a
         * chip in a summary.
         *
         * Without this, clicking an event in the week could only ever mean
         * "the week", which is why clicking an event appeared to do nothing.
         */
        const picked = pickedFrom(event.target);
        if (picked && picked !== node.id) {
          event.stopPropagation();
          onPick(picked, additive);
          return;
        }
        onSelect(additive);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const picked = pickedFrom(event.target);
        // Only when the key landed on an inner target; the host itself is
        // reached by Tab and has its own meaning.
        if (!picked || picked === node.id) return;
        event.preventDefault();
        event.stopPropagation();
        /*
         * Enter selects; Enter again on something already selected alone
         * travels. The keyboard needs the same two-step the pointer has, and
         * a modifier would have been a worse answer than repeating yourself.
         */
        const already = selection.length === 1 && selection[0] === picked;
        if (already && !event.metaKey && !event.shiftKey) onTravel(picked);
        else onPick(picked, event.metaKey || event.shiftKey);
      }}
      onContextMenu={(event) => {
        const picked = pickedFrom(event.target);
        event.preventDefault();
        event.stopPropagation();
        if (picked && picked !== node.id) onPick(picked, false);
        else onSelect(false);
        onMenu({ x: event.clientX, y: event.clientY });
      }}
      onDoubleClick={(event) => {
        const picked = pickedFrom(event.target);
        if (picked && picked !== node.id) {
          event.stopPropagation();
          onTravel(picked);
          return;
        }
        onJackIn();
      }}
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
        // A view that sizes to its content is centred in the box the layout
        // gave it, rather than pinned to the top with the remainder left as
        // dead white space.
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        ...domOnly,
      }}
    >
      {children}
    </div>
  );
}

/** The centre of a node's box as DRAWN, after its plane's scale. */
function drawnCentre(
  node: SceneNode | undefined,
  scheme: "light" | "dark",
): { x: number; y: number } | null {
  if (!node) return null;
  const lower = Math.max(0, Math.min(2, Math.floor(node.plane))) as 0 | 1 | 2;
  const upper = Math.max(0, Math.min(2, Math.ceil(node.plane))) as 0 | 1 | 2;
  const { scale } =
    lower === upper
      ? styleFor(lower, scheme)
      : mixStyles(styleFor(lower, scheme), styleFor(upper, scheme), node.plane - lower);
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
  scheme,
  overview,
}: {
  readonly overview: boolean;
  result: {
    nodes: readonly SceneNode[];
    connectors: Layout["connectors"] | InterpolatedLayout["connectors"];
    width: number;
    height: number;
  };
  /** The GPU canvas is opaque, so connectors have to sit over it, not under. */
  above: boolean;
  scheme: "light" | "dark";
}) {
  const byId = new Map(result.nodes.map((node) => [node.id, node]));
  const centre = (node: SceneNode | undefined) => drawnCentre(node, scheme);
  /*
   * A connector must touch a RAISED node, and must not end on a receded
   * GROUP.
   *
   * "Touches plane 1" alone was too loose: a person belongs to half the
   * context groups, so raising one drew a fan of long curves down to Blocks,
   * Runs and Agreements. A line into a group of nine says "some of these",
   * which is not a relationship anyone can read — while a line to a real
   * node on plane 2, like the run a person drives, says something exact.
   */
  const connectors = result.connectors.filter((connector) => {
    const from = byId.get(connector.from);
    const to = byId.get(connector.to);
    if (!from || !to) return false;
    /*
     * Above the stack, every relation earns its ink: the shape of the domain
     * IS the content, and a line into a group is no longer vague because a
     * group is what the ring is made of.
     */
    if (overview) return true;
    const raised = Math.round(from.plane) === 1 || Math.round(to.plane) === 1;
    const vagueEnd = (node: SceneNode) => node.aggregate && Math.round(node.plane) === 2;
    return raised && !vagueEnd(from) && !vagueEnd(to);
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
        const from = centre(byId.get(connector.from));
        const to = centre(byId.get(connector.to));
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
  const implicated = useImplicated();
  const flagged = useFlagged();
  const cardinality =
    node.aggregate || isAggregateId(node.id) || kindOfCard(node.id) !== null ? "many" : "one";
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
    implicated,
    flagged,
    ...(node.raised ? { raised: true } : {}),
    ...(node.focused ? { focused: true } : {}),
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
