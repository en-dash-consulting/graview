import type { AnySchema } from "@graview/core";
import type { InterpolatedLayout } from "@graview/layout";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { districtOf, mapChoice, ribbonsOf, ribbonSentence } from "./map-choice.js";
import { ribbonWidth } from "./ribbon-width.js";
import { loopPoints, midpointOf, onCanvas, pathOf, routeOnTheGround, type Box, type PlotLike, type Point } from "./ribbons.js";
import "./provider.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * THE RELATIONS FROM ALTITUDE: one ribbon per relation between two
 * districts, as wide as the links along it, the short way along the
 * ground between them so it never crosses a third district (`routeOnTheGround`)
 * — and saying what it is when
 * pointed at: "146 features → 14 areas, the part it lives in".
 *
 * At rest every ribbon is drawn and no record has a line of its own. With a
 * district chosen only its relations stay. With a record chosen none do:
 * the record's own links are drawn instead (`RecordLinks`), and a ribbon
 * under them would say the same thing twice in two manners.
 *
 * Drawn at origin zero and moved by one translate, as the ground is, so a
 * pan moves it with the plots it runs between.
 */
export interface RibbonsProps {
  readonly frame: InterpolatedLayout;
  readonly width: number;
  readonly height: number;
  readonly pan: Point;
  /*
   * WHAT THE SCENE KNOWS, HANDED IN. This layer is fetched when the city is
   * first drawn, and a part fetched apart that reached into the provider's
   * own modules would split the page's first chunks around it.
   */
  readonly store: { readonly schema: AnySchema; readonly graph: { allEdges(): Iterable<{ readonly kind: string; readonly from: string; readonly to: string }>; getNode(id: string): { readonly kind: string } | undefined } };
  /** The graph's version: the relations are counted again when it changes. */
  readonly graphVersion: unknown;
  readonly selection: readonly string[];
  readonly view: { readonly overview?: boolean | undefined; readonly focusId: string | null; readonly beside?: boolean };
  /** A relation the Key or the panel is asking about. */
  readonly emphasis: string | null;
  readonly hiddenKinds: ReadonlySet<string>;
  /** Whether the kit draws a relation at all: one it keeps quiet has no ribbon. */
  readonly drawn: (edge: string) => boolean;
}

export function Ribbons({ frame, width, height, pan, store, graphVersion: nodes, selection, view, emphasis, hiddenKinds, drawn: kitDraws }: RibbonsProps): ReactElement | null {
  const [pointed, setPointed] = useState<string | null>(null);
  const city = frame.city;
  const kindOf = (id: string) => store.graph.getNode(id)?.kind as string | undefined;
  const ribbons = useMemo(() => ribbonsOf(store.graph.allEdges(), (id) => store.graph.getNode(id)?.kind as string | undefined), [store, nodes]);

  const plots = new Map<string, PlotLike>();
  for (const node of frame.nodes) {
    const kind = node.id.startsWith("kind:") ? districtOf(node.id) : null;
    if (kind !== null && node.plot && Math.round(node.plane) === 2) plots.set(kind, node.plot);
  }
  const plotsKey = [...plots].map(([kind, plot]) => `${kind}:${plot.col},${plot.row},${plot.side}`).join(";");
  const cell = city?.cell ?? 0;
  const drawable = ribbons.filter((ribbon) => plots.has(ribbon.from) && plots.has(ribbon.to) && !hiddenKinds.has(ribbon.from) && !hiddenKinds.has(ribbon.to) && kitDraws(ribbon.edge));
  const tilt = city?.tilt ?? 0.5;
  /*
   * THE DISTRICTS' NAME CARDS, where they were drawn: a ribbon goes round
   * them rather than behind them. Measured once the picture has landed, on
   * the canvas from the city's origin, so a pan moves nothing here.
   */
  const [labels, setLabels] = useState<readonly Box[]>([]);
  const labelsKey = labels.map((box) => `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`).join(";");
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const settled = frame.t >= 1;
  useLayoutEffect(() => {
    const ground = svg?.parentElement;
    if (!ground || !city || !settled) return;
    const box = ground.getBoundingClientRect();
    const ox = city.originX + pan.x;
    const oy = city.originY + pan.y;
    const found = [...ground.querySelectorAll('[data-graview-view^="kind:"] .graview-kind-face')].flatMap((el) => {
      const at = el.getBoundingClientRect();
      return at.width > 0 && at.height > 0 ? [{ x: at.left - box.left - ox, y: at.top - box.top - oy, width: at.width, height: at.height }] : [];
    });
    const key = found.map((one) => `${Math.round(one.x)},${Math.round(one.y)},${Math.round(one.width)},${Math.round(one.height)}`).join(";");
    if (key !== labelsKey) setLabels(found);
    // Measured again when the plots or the city's scale move the cards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, settled, plotsKey, cell, tilt]);
  const routed = useMemo(() => {
    if (cell === 0) return [];
    const loops = new Map<string, number>();
    const most = Math.max(0, ...drawable.map((ribbon) => ribbon.links));
    const runs = routeOnTheGround({
      ribbons: drawable.map((ribbon) => ({ key: ribbon.key, from: ribbon.from, to: ribbon.to, width: ribbonWidth(ribbon.links, most) })),
      plots,
      cell,
      tilt,
      labels,
    });
    return drawable.flatMap((ribbon) => {
      let points: Point[] | undefined;
      if (ribbon.from === ribbon.to) {
        const index = loops.get(ribbon.from) ?? 0;
        loops.set(ribbon.from, index + 1);
        points = onCanvas(loopPoints(plots.get(ribbon.from)!, index), { cell, tilt });
      } else points = runs.get(ribbon.key);
      if (!points || points.length < 2) return [];
      return [{ ribbon, points, d: pathOf(points), middle: midpointOf(points), width: ribbonWidth(ribbon.links, most) }];
    });
    // `plotsKey` stands for the plots; `drawable` follows the ribbons and the kit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, tilt, plotsKey, ribbons, kitDraws, hiddenKinds, labelsKey]);

  /*
   * POINTED AT, NEVER PRESSED. A ribbon runs up to its districts' curbs,
   * where their names and controls are, and a hit stroke over it took their
   * presses. So the ground is listened to instead: a mouse or a pen over
   * bare ground near a ribbon says it, and anything drawn there — a card,
   * a control, a panel — keeps the pointer as it always had.
   */
  const bands = useRef<{ key: string; points: readonly Point[]; reach: number }[]>([]);
  const at = useRef({ x: 0, y: 0 });
  at.current = city ? { x: city.originX + pan.x, y: city.originY + pan.y } : { x: 0, y: 0 };
  useEffect(() => {
    const ground = svg?.parentElement;
    if (!ground || typeof window === "undefined") return;
    let queued = 0;
    let last: PointerEvent | null = null;
    const look = () => {
      queued = 0;
      const event = last;
      if (!event) return;
      const target = event.target as Element | null;
      if (event.pointerType === "touch" || event.buttons !== 0 || target?.closest("[data-graview-view], button, a, input, select, textarea, [data-graview-overlay], [data-graview-offstage]")) {
        setPointed(null);
        return;
      }
      const box = ground.getBoundingClientRect();
      const x = event.clientX - box.left - at.current.x;
      const y = event.clientY - box.top - at.current.y;
      let found: string | null = null;
      let nearest = Infinity;
      for (const band of bands.current) {
        const gap = distanceTo(band.points, x, y);
        if (gap <= band.reach && gap < nearest) {
          nearest = gap;
          found = band.key;
        }
      }
      setPointed(found);
    };
    const move = (event: PointerEvent) => {
      last = event;
      if (queued === 0) queued = requestAnimationFrame(look);
    };
    const leave = () => setPointed(null);
    ground.addEventListener("pointermove", move, { passive: true });
    ground.addEventListener("pointerleave", leave);
    return () => {
      if (queued !== 0) cancelAnimationFrame(queued);
      ground.removeEventListener("pointermove", move);
      ground.removeEventListener("pointerleave", leave);
    };
  }, [svg]);

  if (!city || !view.overview || routed.length === 0) return null;
  const choice = mapChoice(selection, view, kindOf);
  // A record's own links say it; an open lens is not drawn over.
  if (choice.records.length > 0 || choice.lens !== null) return null;
  const shown = choice.districts.length > 0 ? routed.filter(({ ribbon }) => choice.districts.includes(ribbon.from) || choice.districts.includes(ribbon.to)) : routed;
  if (shown.length === 0) return null;
  const asking = emphasis ?? null;
  const said = shown.find(({ ribbon }) => ribbon.key === pointed);
  bands.current = shown.map(({ ribbon, points, width: wide }) => ({ key: ribbon.key, points, reach: wide / 2 + 6 }));
  const origin = { x: city.originX + pan.x, y: city.originY + pan.y };
  const transform = `translate(${origin.x.toFixed(1)} ${origin.y.toFixed(1)})`;
  return (
    <>
      {/* The bands, on the ground under the districts' names. */}
      <svg ref={setSvg} className="graview-ribbons" aria-hidden="true" data-graview-world="" data-graview-ribbons={shown.length} width={width} height={height} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}>
        <g transform={transform}>
          {shown.map(({ ribbon, d, width: wide }) => {
            const lit = pointed === ribbon.key || (asking !== null && asking === ribbon.edge) || choice.districts.length > 0;
            const receded = asking !== null && asking !== ribbon.edge;
            return (
              <g
                key={ribbon.key}
                className="graview-ribbon"
                data-graview-ribbon={ribbon.edge}
                data-graview-from={`kind:${ribbon.from}`}
                data-graview-to={`kind:${ribbon.to}`}
                data-graview-links={ribbon.links}
                data-graview-lit={lit && !receded ? "" : undefined}
                data-graview-receded={receded ? "" : undefined}
              >
                <path className="graview-ribbon-band" d={d} style={{ strokeWidth: wide }} />
              </g>
            );
          })}
        </g>
      </svg>
      {said ? (
        /* The words, at the size a person reads, on a solid backing, where the ribbon is pointed at. */
        <div
          className="graview-ribbon-said"
          data-graview-world=""
          data-testid="ribbon-said"
          role="status"
          style={{ position: "absolute", left: origin.x + said.middle.x, top: origin.y + said.middle.y, pointerEvents: "none" }}
        >
          {ribbonSentence(store.schema, said.ribbon)}
        </div>
      ) : null}
    </>
  );
}


/** How far a point is from a polyline, in the same coordinates. */
export function distanceTo(points: readonly Point[], x: number, y: number): number {
  let nearest = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length));
    nearest = Math.min(nearest, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return nearest;
}
