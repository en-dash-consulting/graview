import { hueFor, isoShade, labelOf, LOCAL_LAYERS, orderKinds, type AnySchema, type Scheme } from "@graview/core";
import { cityMap, districtBlocks, districtState, TIER_HEIGHT, toIso, type CityMap, type StateTier } from "@graview/core/scene";
import { beginning } from "@graview/core/seat";
// A door tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts): the provider's barrel, which it reads the scheme from.
import { useGraviewIfAny } from "@graview/react/provider";
import { ribbonsOf, ribbonWidth, routeOnTheGround } from "@graview/react/ground";
import { useEffect, useLayoutEffect, useMemo, useState, type RefObject } from "react";
import type { PageContext } from "./page-context.js";
import { bestFit, nearestOnBox, overlaps, roomBeside } from "./city-fit.js";
import type { Box } from "./step-back-geometry.js";

/*
 * THE CITY BEHIND THE PAGE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * It imports nothing of this face's own: what it needs of the page — which
 * kinds this seat sees, their names, which record an address is — is handed
 * to it by the step back, so fetching it moves nothing out of the pages'
 * own chunk.
 *
 * Fetched the first time a person steps back from a page (`step-back.tsx`).
 * The scene's own map, from the same arithmetic the scene stands it with:
 * each kind on its plot of `cityMap` — the declaration's map, walked in the
 * order a blank installation fills its kinds — a row of blocks per value of
 * its main choice (`districtState`, `districtBlocks`), done lying flat, in
 * the kind's hue and the scene's lighting (`isoShade`), and the relations
 * down the streets between them (`routeOnTheGround`). Then a line from each
 * part of the page that shows a record to that record's building.
 *
 * Drawn as one SVG fitted whole into the room the stepped-back page leaves,
 * never stretched; the lines over everything, from where each part of the
 * page stands now to where its record stands.
 */

/** Lattice cells are drawn at this many units: the SVG is fitted to its room, so the number is only the drawing's own grain. */
const CELL = 40;
/** The most lines drawn: a long list stepped back from is a district's worth of rows, and past this the lines are a hatch. */
const MOST_LINES = 60;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface DrawnBuilding {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly depth: number;
  readonly tier: StateTier;
  readonly roof: string;
  readonly left: string;
  readonly right: string;
  /** The middle of its roof, in the drawing's units: where a line to it ends. */
  readonly top: Point;
}

interface Drawing {
  readonly upright: boolean;
  readonly map: CityMap;
  readonly width: number;
  readonly height: number;
  readonly minX: number;
  readonly minY: number;
  readonly plots: readonly { readonly kind: string; readonly label: string; readonly count: number; readonly hue: number; readonly corners: string; readonly front: Point }[];
  readonly buildings: readonly DrawnBuilding[];
  readonly roads: readonly { readonly key: string; readonly width: number; readonly d: string }[];
}

const pts = (list: readonly Point[]): string => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

/** One block's three faces from its foot in lattice cells, as the scene raises it. */
function faces(block: { readonly col: number; readonly row: number; readonly footprint: number; readonly height: number }): Pick<DrawnBuilding, "roof" | "left" | "right" | "top"> {
  const half = block.footprint / 2;
  const rise = block.footprint * CELL * 0.5 * block.height;
  const at = (col: number, row: number, lift = 0): Point => {
    const p = toIso(col, row, CELL);
    return { x: p.x, y: p.y - lift };
  };
  const back = at(block.col - half, block.row - half, rise);
  const right = at(block.col + half, block.row - half, rise);
  const front = at(block.col + half, block.row + half, rise);
  const left = at(block.col - half, block.row + half, rise);
  const frontFoot = at(block.col + half, block.row + half);
  const leftFoot = at(block.col - half, block.row + half);
  const rightFoot = at(block.col + half, block.row - half);
  return {
    roof: pts([back, right, front, left]),
    left: pts([left, front, frontFoot, leftFoot]),
    right: pts([front, right, rightFoot, frontFoot]),
    top: { x: (back.x + front.x) / 2, y: (back.y + front.y) / 2 },
  };
}

/**
 * The city as this seat sees it: every kind it may see on its plot, every
 * record on its district, and every relation down its street. `first` are
 * the records the page shows, stood first in their rows so none of them is
 * one of a district's "+n".
 */
function drawCity<S extends AnySchema>(context: PageContext<S>, seen: Seen, first: readonly string[], upright: boolean): Drawing {
  const { store } = context;
  const schema = store.schema;
  const live = new Set(seen.kinds);
  const order = orderKinds(
    beginning({ name: "pages", schema, mutations: store.allMutations().filter((mutation) => !mutation.derived) }).order.map((entry) => entry.kind),
    context.views?.arrangement?.()?.order,
  );
  const members = new Map<string, string[]>();
  for (const node of store.graph.allNodes()) {
    if (!live.has(node.kind as string)) continue;
    (members.get(node.kind as string) ?? members.set(node.kind as string, []).get(node.kind as string)!).push(node.id);
  }
  const counts = Object.fromEntries([...members].map(([kind, ids]) => [kind, ids.length]));
  const map = cityMap(schema, { order: [...order], counts, upright });
  const accents = context.brand?.accents;
  const plots: Drawing["plots"][number][] = [];
  const buildings: DrawnBuilding[] = [];
  const reach: Point[] = [];
  for (const kind of order) {
    const plot = map.get(kind);
    if (!plot || !live.has(kind)) continue;
    const hue = Math.round(hueFor(kind, accents));
    const corners = [toIso(plot.col, plot.row, CELL), toIso(plot.col + plot.side, plot.row, CELL), toIso(plot.col + plot.side, plot.row + plot.side, CELL), toIso(plot.col, plot.row + plot.side, CELL)];
    reach.push(...corners);
    const ids = members.get(kind) ?? [];
    plots.push({ kind, label: seen.plurals[kind] ?? kind, count: ids.length, hue, corners: pts(corners), front: corners[2]! });
    const state = districtState(schema, kind);
    const valueOf = (id: string) => (state ? (store.graph.getNode(id) as Record<string, unknown> | undefined)?.[state.field] : undefined);
    const lanes: string[][] = state ? state.values.map(() => []) : [[]];
    const tiers: StateTier[] = state ? [...state.tiers] : ["waiting"];
    const chosen = ids.filter((id) => first.includes(id));
    for (const id of [...chosen, ...ids.filter((id) => !chosen.includes(id))]) {
      const at = state ? state.values.indexOf(valueOf(id) as string) : 0;
      if (at >= 0) lanes[at]!.push(id);
      else {
        if (lanes.length === tiers.length) {
          lanes.push([]);
          tiers.push("waiting");
        }
        lanes[lanes.length - 1]!.push(id);
      }
    }
    const definition = schema.tryDefinition(kind);
    const { blocks } = districtBlocks(plot, lanes, tiers.map((tier) => TIER_HEIGHT[tier]));
    for (const block of blocks) {
      const record = store.graph.getNode(block.id);
      const drawn = faces(block);
      reach.push(drawn.top);
      buildings.push({ id: block.id, name: record ? labelOf(definition, record) : "", kind, depth: block.col + block.row, tier: tiers[block.lane]!, ...drawn });
    }
  }
  buildings.sort((a, b) => a.depth - b.depth);

  /* THE STREETS: each relation between two districts, as wide as how many run along it, routed on the lattice as the scene routes it. */
  const kindOf = (id: string) => {
    const kind = store.graph.getNode(id)?.kind as string | undefined;
    return kind && live.has(kind) ? kind : undefined;
  };
  const ribbons = ribbonsOf(store.graph.allEdges(), kindOf).filter((ribbon) => map.has(ribbon.from) && map.has(ribbon.to) && ribbon.from !== ribbon.to);
  const most = Math.max(0, ...ribbons.map((ribbon) => ribbon.links));
  const widths = new Map(ribbons.map((ribbon) => [ribbon.key, ribbonWidth(ribbon.links, most)]));
  const routes = routeOnTheGround({ ribbons: ribbons.map((ribbon) => ({ key: ribbon.key, from: ribbon.from, to: ribbon.to, width: widths.get(ribbon.key)! })), plots: map, cell: CELL, tilt: 0.5 });
  const roads = [...routes].map(([key, points]) => {
    reach.push(...points);
    return { key, width: widths.get(key) ?? 2, d: points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") };
  });

  const pad = CELL * 0.8;
  const minX = Math.min(0, ...reach.map((p) => p.x)) - pad;
  const maxX = Math.max(0, ...reach.map((p) => p.x)) + pad;
  const minY = Math.min(0, ...reach.map((p) => p.y)) - pad;
  // Room under the front corners for each district's name.
  const maxY = Math.max(0, ...reach.map((p) => p.y)) + pad + CELL * 0.4;
  return { upright, map, width: maxX - minX, height: maxY - minY, minX, minY, plots, buildings, roads };
}

/** Whether the page is drawn dark: the scene's night lighting under a dark page, its daylight otherwise. */
function schemeOf(element: Element | null): Scheme {
  if (!element) return "light";
  const color = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
  const [r = 255, g = 255, b = 255] = color;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "dark" : "light";
}

/** What the page knows that the city draws by: the kinds this seat sees and what each is called, and which record an address is. */
export interface Seen {
  readonly kinds: readonly string[];
  readonly plurals: Readonly<Record<string, string>>;
  /** The record whose page a path is (`/<plural>/<id>`, under the face's base), or none. */
  readonly recordAt: (pathname: string) => string | null;
}

/** The record a page part shows: a link to a record's own page, or a row that names its record. */
function recordOfPart<S extends AnySchema>(element: Element, context: PageContext<S>, seen: Seen): string | null {
  const named = element.getAttribute("data-graview-record");
  if (named && context.store.graph.getNode(named)) return named;
  if (element instanceof HTMLAnchorElement && element.href) return seen.recordAt(element.pathname);
  return null;
}

interface Line {
  readonly key: string;
  readonly to: string;
  readonly part: "link" | "row" | "self";
  readonly from: Point;
  readonly at: Point;
  readonly hue: number;
  readonly said: string;
}

const asBox = (rect: DOMRect): Box => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });

/**
 * Where a part of the page stands: what it draws, not the box it is laid out
 * in — a heading's box is the column's width, and a line from its far edge
 * left the page from empty paper. The extent of its contents, where it has
 * any; its own box otherwise.
 */
function partBox(element: Element): Box {
  const range = document.createRange();
  range.selectNodeContents(element);
  const drawn = range.getBoundingClientRect();
  return drawn.width > 0 && drawn.height > 0 ? asBox(drawn) : asBox(element.getBoundingClientRect());
}

export function CityBehind<S extends AnySchema>({
  context,
  seen,
  tick,
  subject,
  region,
  page,
  sheet,
  shown,
  settled,
}: {
  readonly context: PageContext<S>;
  readonly seen: Seen;
  /** The store's version: the city is drawn again when it changes. */
  readonly tick: number;
  /** The record this page is, if it is a record's page. */
  readonly subject: string | null;
  /** The region under the bar, in the window. */
  readonly region: Box;
  /** The stepped-back page's box in the region. */
  readonly page: Box;
  readonly sheet: RefObject<HTMLDivElement | null>;
  /** Whether the page has stepped back: the city fades in with it. */
  readonly shown: boolean;
  /** At rest, stepped back: the lines are drawn now. */
  readonly settled: boolean;
}) {

  /* WHAT THE PAGE SHOWS: every part of it that is a record — read once as the page steps back, from the page as it stands. */
  const [parts, setParts] = useState<readonly { readonly element: Element; readonly id: string; readonly part: Line["part"] }[]>([]);
  useLayoutEffect(() => {
    const root = sheet.current;
    if (!root) return;
    const found: { element: Element; id: string; part: Line["part"] }[] = [];
    for (const element of root.querySelectorAll("a[href], [data-graview-record]")) {
      const id = recordOfPart(element, context, seen);
      if (!id) continue;
      // A row and the link inside it show one record once: the outermost part says it.
      if (found.some((one) => one.id === id && one.element.contains(element))) continue;
      found.push({ element, id, part: element.hasAttribute("data-graview-record") ? "row" : "link" });
    }
    // The page's own title, else its first heading a person sees: a design's record page names its record its own way.
    const title = [...root.querySelectorAll("[data-graview-page-title], h1, h2")].find((one) => one.getBoundingClientRect().width > 2) ?? null;
    if (subject && title) found.unshift({ element: title, id: subject, part: "self" });
    setParts(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, seen, subject, tick]);

  const first = useMemo(() => [...new Set(parts.map((one) => one.id))], [parts]);
  const room = useMemo(() => roomBeside(region, page), [region, page]);
  const picked = useMemo(() => {
    const wide = drawCity(context, seen, first, false);
    const tall = drawCity(context, seen, first, true);
    return bestFit(room, [wide, tall]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, seen, first, room, tick]);
  /* The scene's lighting for the scheme the app is drawn in: the provider's, where the face has one, else read off the page. */
  const told = useGraviewIfAny()?.scheme;
  const [read, setRead] = useState<Scheme>("light");
  useLayoutEffect(() => setRead(schemeOf(sheet.current)), [sheet]);
  const scheme: Scheme = told === "dark" || told === "light" ? told : read;

  /* THE LINES, from where each part stands now, at rest, to its record's building: measured in the window, so they meet whatever the scale. */
  const [measured, setMeasured] = useState<readonly Line[] | null>(null);
  useEffect(() => {
    if (!settled || !picked) {
      setMeasured(null);
      return;
    }
    const measure = () => {
      const svg = document.querySelector<SVGSVGElement>('[data-testid="city-behind"] svg');
      const sheetBox = sheet.current?.getBoundingClientRect();
      const matrix = svg?.getScreenCTM();
      if (!svg || !sheetBox || !matrix) return;
      const byId = new Map(picked.drawing.buildings.map((one) => [one.id, one]));
      const hues = new Map(picked.drawing.plots.map((one) => [one.kind, one.hue]));
      const out: Line[] = [];
      for (const { element, id, part } of parts) {
        if (out.length >= MOST_LINES) break;
        const building = byId.get(id);
        if (!building) continue;
        const box = partBox(element);
        if (box.width <= 0 || box.height <= 0 || !overlaps(box, asBox(sheetBox))) continue;
        const at = { x: matrix.a * building.top.x + matrix.c * building.top.y + matrix.e, y: matrix.b * building.top.x + matrix.d * building.top.y + matrix.f };
        out.push({ key: `${out.length}`, to: id, part, from: nearestOnBox(box, at), at, hue: hues.get(building.kind) ?? 220, said: building.name });
      }
      setMeasured(out);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [settled, picked, parts, sheet]);

  if (!picked) return null;
  const lines = measured ?? [];
  const { drawing, box } = picked;
  const shade = isoShade(scheme);
  const face = (hue: number, f: { readonly saturation: number; readonly lightness: number }) => `hsl(${hue} ${f.saturation}% ${f.lightness}%)`;
  const lit = new Set(lines.map((line) => line.to));
  const hueOf = new Map(drawing.plots.map((one) => [one.kind, one.hue]));
  const fade = { opacity: shown ? 1 : 0, transition: "opacity 300ms ease" };
  const name = `The city behind this page: ${drawing.plots.length === 1 ? "one kind" : `${drawing.plots.length} kinds`}, ${drawing.plots.map((one) => `${one.label} ${one.count}`).join(", ")}`;
  return (
    <>
      <div data-testid="city-behind" data-graview-city-upright={drawing.upright ? "" : undefined} style={{ position: "fixed", left: region.x, top: region.y, width: region.width, height: region.height, zIndex: LOCAL_LAYERS.under, pointerEvents: "none", ...fade }}>
        <svg
          role="img"
          aria-label={name}
          style={{ position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height, overflow: "visible" }}
          viewBox={`${drawing.minX.toFixed(1)} ${drawing.minY.toFixed(1)} ${drawing.width.toFixed(1)} ${drawing.height.toFixed(1)}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <g strokeLinejoin="round">
            {drawing.plots.map((plot) => (
              <polygon
                key={plot.kind}
                data-graview-city-kind={plot.kind}
                points={plot.corners}
                fill={face(plot.hue, shade.plot)}
                fillOpacity={shade.plot.alpha}
                stroke={face(plot.hue, shade.plotEdge)}
                strokeOpacity={shade.plotEdge.alpha}
              />
            ))}
          </g>
          <g fill="none" stroke="var(--graview-ink-faint, rgba(120,120,120,0.6))" strokeOpacity={0.45} strokeLinecap="round" strokeLinejoin="round">
            {drawing.roads.map((road) => (
              <path key={road.key} d={road.d} strokeWidth={road.width} />
            ))}
          </g>
          <g strokeLinejoin="round">
            {drawing.buildings.map((one) => {
              const hue = hueOf.get(one.kind) ?? 220;
              const on = lit.has(one.id);
              return (
                <g key={one.id} data-graview-city-record={one.id} data-graview-lit={on ? "" : undefined}>
                  <title>{one.name}</title>
                  <polygon points={one.left} fill={face(hue, shade.left)} />
                  <polygon points={one.right} fill={face(hue, shade.right)} />
                  <polygon points={one.roof} fill={face(hue, shade.roof)} stroke={on ? "var(--graview-ink)" : shade.roofEdge} strokeWidth={on ? 2 : 1} />
                </g>
              );
            })}
          </g>
          <g fill="var(--graview-ink-muted)" fontFamily="var(--graview-font-body, system-ui)" fontSize={CELL * 0.28} textAnchor="middle">
            {drawing.plots.map((plot) => (
              <text key={plot.kind} x={plot.front.x} y={plot.front.y + CELL * 0.36}>
                {plot.count > 0 ? `${plot.label} ${plot.count}` : plot.label}
              </text>
            ))}
          </g>
        </svg>
      </div>
      {/* Over the page and the city both: a line leaves the page where its part stands and ends on its record's roof. */}
      <svg
        data-testid="city-lines"
        aria-hidden="true"
        data-graview-settled={measured ? "" : undefined}
        data-graview-lines={lines.length}
        style={{ position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", zIndex: LOCAL_LAYERS.over, pointerEvents: "none", overflow: "visible" }}
      >
        {lines.map((line) => (
          <g key={line.key} data-graview-line-to={line.to} data-graview-line-part={line.part}>
            <line x1={line.from.x} y1={line.from.y} x2={line.at.x} y2={line.at.y} stroke={`hsl(${line.hue} 45% 45%)`} strokeOpacity={0.7} strokeWidth={1.25} />
            <circle cx={line.from.x} cy={line.from.y} r={2.5} fill={`hsl(${line.hue} 45% 45%)`} />
            <circle cx={line.at.x} cy={line.at.y} r={3} fill="none" stroke={`hsl(${line.hue} 45% 45%)`} strokeWidth={1.25} />
          </g>
        ))}
      </svg>
      {/* What the lines say, for whoever cannot see them. */}
      <p data-testid="city-lines-said" role="status" style={{ position: "absolute", width: 1, height: 1, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {measured ? linesSaid(lines) : ""}
      </p>
    </>
  );
}

/** The lines in words: which records the page shows, where they stand in the city. */
function linesSaid(lines: readonly Line[]): string {
  const names = [...new Set(lines.filter((line) => line.said).map((line) => line.said))];
  if (names.length === 0) return "Stepped back. Nothing on this page stands in the city.";
  const listed = names.length <= 5 ? names.join(", ") : `${names.slice(0, 5).join(", ")} and ${names.length - 5} more`;
  return `Stepped back. Lines run from this page to ${listed} in the city.`;
}
