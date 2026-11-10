import { hueFor, isoShade, labelOf, LOCAL_LAYERS, orderKinds, type AnySchema, type Scheme, type Store } from "@graview/core";
import { cityMap, districtBlocks, districtState, TIER_HEIGHT, toIso, type CityMap, type StateTier } from "@graview/core/scene";
import { beginning } from "@graview/core/seat";
// A door tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts): the provider's barrel, which it reads the scheme from.
import { useGraviewIfAny } from "@graview/react/provider";
import { ribbonsOf, ribbonWidth, routeBetweenFrames } from "@graview/react/ground";
import { useEffect, useLayoutEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import type { PageContext } from "./page-context.js";
import { bestFit, nearestOnBox, overlaps, roomBeside } from "./city-fit.js";
import type { Box } from "./step-back-geometry.js";

/*
 * THE CITY BEHIND THE PAGE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * It imports nothing of this face's own: what it needs of the page — which
 * kinds this seat sees, their names, which record an address is, how to go
 * to one — is handed to it by the step back, so fetching it moves nothing
 * out of the pages' own chunk.
 *
 * Fetched the first time a person steps back from a page (`step-back.tsx`).
 * The scene's own map, from the same arithmetic the scene stands it with:
 * each kind on its plot of `cityMap` — the declaration's map, walked in the
 * order a blank installation fills its kinds — a row of blocks per value of
 * its main choice (`districtState`, `districtBlocks`), done lying flat, in
 * the kind's hue and the scene's lighting (`isoShade`), and the relations
 * down the streets between them. Then a line from each part of the page
 * that shows a record to that record's building.
 *
 * NOTHING HERE HOLDS THE FRAME ON A BIG APP. The streets are the expensive
 * part, and they are routed as the scene routes them: between frames, a
 * ribbon at a time, and remembered for the ground they were routed on
 * (`routeBetweenFrames`), so the city draws at once and its streets arrive
 * after; stepping back again, or a change that moves no plot, routes
 * nothing. Which way the map runs is chosen from its plots alone, so only
 * the map drawn is ever routed. The rest — the map, each district's blocks —
 * is kept at module scope for the store's version and the records the page
 * shows, across steps in and out.
 *
 * Drawn as one SVG fitted whole into the room the stepped-back page leaves,
 * never stretched; the lines over everything, from where each part of the
 * page stands now to where its record stands.
 */

/** Lattice cells are drawn at this many units: the SVG is fitted to its room, so the number is only the drawing's own grain. */
const CELL = 40;
/** The most lines drawn: a long list stepped back from is a district's worth of rows, and past this the lines are a hatch. */
const MOST_LINES = 60;
/** Air around what stands, in the drawing's units: a street runs in the gutter outside a plot, and a name stands under its front corner. */
const PAD = CELL * 1.5;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DrawnPlot {
  readonly kind: string;
  readonly label: string;
  readonly count: number;
  readonly hue: number;
  readonly corners: string;
  readonly front: Point;
}

export interface DrawnBuilding {
  readonly id: string;
  readonly kind: string;
  readonly depth: number;
  readonly tier: StateTier;
  readonly roof: string;
  readonly left: string;
  readonly right: string;
  /** The middle of its roof, in the drawing's units: where a line to it ends. */
  readonly top: Point;
}

/** The map one way round: where each kind stands, and the box its plots fill. */
export interface Ground {
  readonly upright: boolean;
  readonly map: CityMap;
  readonly plots: readonly DrawnPlot[];
  readonly box: { readonly minX: number; readonly minY: number; readonly width: number; readonly height: number };
}

/** What the page knows that the city draws by: the kinds this seat sees and what each is called, and which record an address is. */
export interface Seen {
  readonly kinds: readonly string[];
  readonly plurals: Readonly<Record<string, string>>;
  /** The record whose page a path is (`/<plural>/<id>`, under the face's base), or none. */
  readonly recordAt: (pathname: string) => string | null;
}

/** What `drawCity` reads the store by. */
export interface CitySource<S extends AnySchema> {
  readonly store: Store<S>;
  readonly accents?: Readonly<Record<string, number>> | undefined;
  /** The order the declaration arranges its kinds in, if it says one. */
  readonly arranged?: readonly string[] | undefined;
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

/* ----------------------------------------------------- kept across steps */

/** The order a blank installation fills the kinds in: read from the acts, which do not change while a page is open. */
const orders = new WeakMap<object, readonly string[]>();
function orderOf<S extends AnySchema>(source: CitySource<S>): readonly string[] {
  const { store } = source;
  let order = orders.get(store.schema);
  if (!order) {
    order = beginning({ name: "pages", schema: store.schema, mutations: store.allMutations().filter((mutation) => !mutation.derived) }).order.map((entry) => entry.kind);
    orders.set(store.schema, order);
  }
  return orderKinds(order, source.arranged);
}

/** One reading of the store per version: each kind's records, and the streets between the kinds. */
interface Reading {
  readonly members: ReadonlyMap<string, readonly string[]>;
  readonly counts: Readonly<Record<string, number>>;
  readonly ribbons: readonly { readonly key: string; readonly from: string; readonly to: string; readonly width: number }[];
}
let lastReading: { readonly store: object; readonly version: number; readonly kinds: string; readonly reading: Reading } | null = null;
function readingOf<S extends AnySchema>(store: Store<S>, seen: Seen): Reading {
  const version = (store as unknown as { version?: number }).version ?? -1;
  const kinds = seen.kinds.join("|");
  if (lastReading && lastReading.store === store && lastReading.version === version && version >= 0 && lastReading.kinds === kinds) return lastReading.reading;
  const live = new Set(seen.kinds);
  const members = new Map<string, string[]>();
  for (const node of store.graph.allNodes()) {
    const kind = node.kind as string;
    if (!live.has(kind)) continue;
    const ids = members.get(kind);
    if (ids) ids.push(node.id);
    else members.set(kind, [node.id]);
  }
  const counts = Object.fromEntries([...members].map(([kind, ids]) => [kind, ids.length]));
  const kindOf = (id: string) => {
    const kind = store.graph.getNode(id)?.kind as string | undefined;
    return kind && live.has(kind) ? kind : undefined;
  };
  const found = ribbonsOf(store.graph.allEdges(), kindOf).filter((ribbon) => ribbon.from !== ribbon.to);
  const most = found.reduce((top, ribbon) => Math.max(top, ribbon.links), 0);
  const ribbons = found.map((ribbon) => ({ key: ribbon.key, from: ribbon.from, to: ribbon.to, width: ribbonWidth(ribbon.links, most) }));
  const reading = { members, counts, ribbons };
  lastReading = { store, version, kinds, reading };
  return reading;
}

/** The map one way round, from the declaration and the counts alone. */
function groundOf<S extends AnySchema>(source: CitySource<S>, seen: Seen, reading: Reading, upright: boolean): Ground {
  const order = orderOf(source);
  const live = new Set(seen.kinds);
  const map = cityMap(source.store.schema, { order: [...order], counts: reading.counts, upright });
  const plots: DrawnPlot[] = [];
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const kind of order) {
    const plot = map.get(kind);
    if (!plot || !live.has(kind)) continue;
    const corners = [toIso(plot.col, plot.row, CELL), toIso(plot.col + plot.side, plot.row, CELL), toIso(plot.col + plot.side, plot.row + plot.side, CELL), toIso(plot.col, plot.row + plot.side, CELL)];
    for (const p of corners) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    plots.push({ kind, label: seen.plurals[kind] ?? kind, count: reading.members.get(kind)?.length ?? 0, hue: Math.round(hueFor(kind, source.accents)), corners: pts(corners), front: corners[2]! });
  }
  // The tallest block stands about a cell above its plot's back corner: room for it over the top, and for the streets and names around.
  return { upright, map, plots, box: { minX: minX - PAD, minY: minY - PAD - CELL, width: maxX - minX + 2 * PAD, height: maxY - minY + 2 * PAD + CELL } };
}

/** What stands on every district: a row of blocks per value of its main choice, the records the page shows first in their rows. */
let lastStanding: { readonly key: string; readonly store: object; readonly buildings: readonly DrawnBuilding[] } | null = null;
function standingOf<S extends AnySchema>(store: Store<S>, ground: Ground, reading: Reading, first: ReadonlySet<string>): readonly DrawnBuilding[] {
  const version = (store as unknown as { version?: number }).version ?? -1;
  const key = `${version}|${ground.upright}|${ground.plots.map((plot) => plot.kind).join(",")}|${[...first].join(",")}`;
  if (lastStanding && lastStanding.store === store && lastStanding.key === key && version >= 0) return lastStanding.buildings;
  const schema = store.schema;
  const buildings: DrawnBuilding[] = [];
  for (const { kind } of ground.plots) {
    const plot = ground.map.get(kind)!;
    const ids = reading.members.get(kind) ?? [];
    const state = districtState(schema, kind);
    const lanes: string[][] = state ? state.values.map(() => []) : [[]];
    const tiers: StateTier[] = state ? [...state.tiers] : ["waiting"];
    const lane = new Map(state ? state.values.map((value, at) => [value, at]) : []);
    const put = (id: string) => {
      const at = state ? (lane.get((store.graph.getNode(id) as Record<string, unknown> | undefined)?.[state.field] as string) ?? -1) : 0;
      if (at >= 0) lanes[at]!.push(id);
      else {
        if (lanes.length === tiers.length) {
          lanes.push([]);
          tiers.push("waiting");
        }
        lanes[lanes.length - 1]!.push(id);
      }
    };
    for (const id of ids) if (first.has(id)) put(id);
    for (const id of ids) if (!first.has(id)) put(id);
    const { blocks } = districtBlocks(plot, lanes, tiers.map((tier) => TIER_HEIGHT[tier]));
    for (const block of blocks) buildings.push({ id: block.id, kind, depth: block.col + block.row, tier: tiers[block.lane]!, ...faces(block) });
  }
  buildings.sort((a, b) => a.depth - b.depth);
  lastStanding = { key, store, buildings };
  return buildings;
}

export interface City {
  readonly ground: Ground;
  readonly buildings: readonly DrawnBuilding[];
  /** What the streets are routed from: the ribbons, and the plots of the map drawn. */
  readonly ribbons: Reading["ribbons"];
  /** Where it is drawn, in the window, and at what scale. */
  readonly box: Box;
}

/**
 * THE CITY TO DRAW in the room the page leaves: the map run whichever way
 * draws it larger, chosen from the plots alone, and what stands on it. No
 * street is routed here (`routeBetweenFrames` does that, after).
 */
export function drawCity<S extends AnySchema>(source: CitySource<S>, seen: Seen, first: ReadonlySet<string>, rooms: { readonly right: Box; readonly below: Box }): City | null {
  const reading = readingOf(source.store, seen);
  const wide = groundOf(source, seen, reading, false);
  const tall = groundOf(source, seen, reading, true);
  const picked = bestFit(rooms, [
    { ground: wide, width: wide.box.width, height: wide.box.height },
    { ground: tall, width: tall.box.width, height: tall.box.height },
  ]);
  if (!picked) return null;
  const ground = picked.drawing.ground;
  const ribbons = reading.ribbons.filter((ribbon) => ground.map.has(ribbon.from) && ground.map.has(ribbon.to));
  return { ground, buildings: standingOf(source.store, ground, reading, first), ribbons, box: picked.box };
}

/* ------------------------------------------------------------ the page */

/** Whether the page is drawn dark: the scene's night lighting under a dark page, its daylight otherwise. */
function schemeOf(element: Element | null): Scheme {
  if (!element) return "light";
  const color = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
  const [r = 255, g = 255, b = 255] = color;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "dark" : "light";
}

interface Part {
  readonly element: Element;
  readonly id: string;
  readonly part: "link" | "row" | "self";
}

/**
 * WHAT THE PAGE SHOWS: every part of it that is a record — a row that
 * names one, a link to one's page — and the title, for the record the page
 * is. A link inside a row of the same record is that row's: the outermost
 * part says it, found by walking up from each link once.
 */
export function partsOf(root: Element, store: Store<AnySchema>, seen: Seen, subject: string | null): readonly Part[] {
  const found: Part[] = [];
  for (const element of root.querySelectorAll("a[href], [data-graview-record]")) {
    const named = element.getAttribute("data-graview-record");
    const id = named !== null ? (store.graph.getNode(named) ? named : null) : element instanceof HTMLAnchorElement && element.href ? seen.recordAt(element.pathname) : null;
    if (!id) continue;
    const row = element.parentElement?.closest("[data-graview-record]");
    if (row && root.contains(row) && row.getAttribute("data-graview-record") === id) continue;
    found.push({ element, id, part: named !== null ? "row" : "link" });
  }
  // The page's own title, else its first heading a person sees: a design's record page names its record its own way.
  const title = [...root.querySelectorAll("[data-graview-page-title], h1, h2")].find((one) => one.getBoundingClientRect().width > 2) ?? null;
  if (subject && title) found.unshift({ element: title, id: subject, part: "self" });
  return found;
}

interface Line {
  readonly key: string;
  readonly to: string;
  readonly part: Part["part"];
  readonly from: Point;
  readonly at: Point;
  readonly hue: number;
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

/** A frame's worth of calls, as one: a resize or a layout change asks many times and is answered once. */
function perFrame(run: () => void): { (): void; cancel(): void } {
  let asked = 0;
  const once = Object.assign(
    () => {
      if (asked) return;
      asked = requestAnimationFrame(() => {
        asked = 0;
        run();
      });
    },
    { cancel: () => (asked ? cancelAnimationFrame(asked) : undefined) },
  );
  return once;
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
  open,
  hrefOf,
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
  /** Go to a record's own page, the page coming back in on the way. */
  readonly open: (id: string) => void;
  /** A record page's address, for the link a building is. */
  readonly hrefOf: (id: string) => string;
}) {
  const store = context.store as unknown as Store<AnySchema>;

  /* WHAT THE PAGE SHOWS, read from the page as it stands when it steps back, and again when the store changes. */
  const [parts, setParts] = useState<readonly Part[]>([]);
  useLayoutEffect(() => {
    if (sheet.current) setParts(partsOf(sheet.current, store, seen, subject));
  }, [sheet, store, seen, subject, tick]);

  const firstKey = useMemo(() => [...new Set(parts.map((one) => one.id))].join("\n"), [parts]);
  const room = useMemo(() => roomBeside(region, page), [region, page]);
  const city = useMemo(
    () => drawCity({ store, accents: context.brand?.accents, arranged: context.views?.arrangement?.()?.order }, seen, new Set(firstKey ? firstKey.split("\n") : []), room),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, seen, firstKey, room, tick],
  );

  /* THE STREETS, routed between frames for the map drawn, and remembered for its ground: answered at once when it was routed before. */
  const [roads, setRoads] = useState<{ readonly ground: Ground; readonly runs: ReadonlyMap<string, readonly Point[]> } | null>(null);
  useEffect(() => {
    if (!city) return;
    const ground = city.ground;
    return routeBetweenFrames({ ribbons: city.ribbons, plots: ground.map, cell: CELL, tilt: 0.5 }, (runs) => setRoads({ ground, runs }));
  }, [city]);

  /* The scene's lighting for the scheme the app is drawn in: the provider's, where the face has one, else read off the page. */
  const told = useGraviewIfAny()?.scheme;
  const [read, setRead] = useState<Scheme>("light");
  useLayoutEffect(() => setRead(schemeOf(sheet.current)), [sheet]);
  const scheme: Scheme = told === "dark" || told === "light" ? told : read;

  /*
   * THE LINES, from where each part stands now, at rest, to its record's
   * building: measured in the window, so they meet whatever the scale — when
   * the step has ended, and again (a frame later, once) when the window or
   * the sheet changes size, or the page's fonts arrive and move its words.
   */
  const [measured, setMeasured] = useState<readonly Line[] | null>(null);
  useEffect(() => {
    if (!settled || !city) {
      setMeasured(null);
      return;
    }
    const byId = new Map(city.buildings.map((one) => [one.id, one]));
    const hues = new Map(city.ground.plots.map((one) => [one.kind, one.hue]));
    const measure = () => {
      const svg = document.querySelector<SVGSVGElement>('[data-testid="city-behind"] svg');
      const sheetBox = sheet.current?.getBoundingClientRect();
      const matrix = svg?.getScreenCTM();
      if (!svg || !sheetBox || !matrix) return;
      const out: Line[] = [];
      for (const { element, id, part } of parts) {
        if (out.length >= MOST_LINES) break;
        const building = byId.get(id);
        if (!building) continue;
        const box = partBox(element);
        if (box.width <= 0 || box.height <= 0 || !overlaps(box, asBox(sheetBox))) continue;
        const at = { x: matrix.a * building.top.x + matrix.c * building.top.y + matrix.e, y: matrix.b * building.top.x + matrix.d * building.top.y + matrix.f };
        out.push({ key: `${out.length}`, to: id, part, from: nearestOnBox(box, at), at, hue: hues.get(building.kind) ?? 220 });
      }
      setMeasured(out);
    };
    measure();
    const again = perFrame(measure);
    window.addEventListener("resize", again);
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(again);
    if (sheet.current) watch?.observe(sheet.current);
    let live = true;
    document.fonts?.ready.then(() => live && again()).catch(() => undefined);
    return () => {
      live = false;
      again.cancel();
      watch?.disconnect();
      window.removeEventListener("resize", again);
    };
  }, [settled, city, parts, sheet]);

  if (!city) return null;
  const lines = measured ?? [];
  const { ground, buildings, box } = city;
  const shade = isoShade(scheme);
  const face = (hue: number, f: { readonly saturation: number; readonly lightness: number }) => `hsl(${hue} ${f.saturation}% ${f.lightness}%)`;
  const lit = new Set(lines.map((line) => line.to));
  const hueOf = new Map(ground.plots.map((one) => [one.kind, one.hue]));
  const nameOf = (id: string) => {
    const record = store.graph.getNode(id);
    return record ? labelOf(store.schema.tryDefinition(record.kind as string), record) : "";
  };
  const runs = roads && roads.ground === ground ? roads.runs : null;
  const most = new Map(city.ribbons.map((ribbon) => [ribbon.key, ribbon.width]));
  const fade = { opacity: shown ? 1 : 0, transition: "opacity 300ms ease" };
  const name = `The city behind this page: ${ground.plots.length === 1 ? "one kind" : `${ground.plots.length} kinds`}, ${ground.plots.map((one) => `${one.label} ${one.count}`).join(", ")}`;
  const go = (id: string) => (event: ReactMouseEvent | ReactKeyboardEvent) => {
    if ("key" in event && event.key !== "Enter") return;
    if (!("key" in event) && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
    event.preventDefault();
    open(id);
  };
  return (
    <>
      <div data-testid="city-behind" data-graview-city-upright={ground.upright ? "" : undefined} data-graview-roads={runs ? "" : undefined} style={{ position: "fixed", left: region.x, top: region.y, width: region.width, height: region.height, zIndex: LOCAL_LAYERS.under, pointerEvents: "none", ...fade }}>
        <svg
          role="group"
          aria-label={name}
          style={{ position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height, overflow: "visible" }}
          viewBox={`${ground.box.minX.toFixed(1)} ${ground.box.minY.toFixed(1)} ${ground.box.width.toFixed(1)} ${ground.box.height.toFixed(1)}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <g strokeLinejoin="round" aria-hidden="true">
            {ground.plots.map((plot) => (
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
          <g fill="none" stroke="var(--graview-ink-faint, rgba(120,120,120,0.6))" strokeOpacity={0.45} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {runs
              ? [...runs].map(([key, points]) => (
                  <path key={key} d={points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")} strokeWidth={most.get(key) ?? 2} />
                ))
              : null}
          </g>
          <g strokeLinejoin="round">
            {buildings.map((one) => {
              const hue = hueOf.get(one.kind) ?? 220;
              const on = lit.has(one.id);
              const drawn = (
                <>
                  <polygon points={one.left} fill={face(hue, shade.left)} />
                  <polygon points={one.right} fill={face(hue, shade.right)} />
                  <polygon points={one.roof} fill={face(hue, shade.roof)} stroke={on ? "var(--graview-ink)" : shade.roofEdge} strokeWidth={on ? 2 : 1} />
                </>
              );
              if (!on) {
                return (
                  <g key={one.id} data-graview-city-record={one.id} aria-hidden="true">
                    {drawn}
                  </g>
                );
              }
              /* A record a line runs to is a way to it: a stop for the keyboard, named for its record, that opens its page. */
              const said = nameOf(one.id);
              return (
                <a
                  key={one.id}
                  href={hrefOf(one.id)}
                  tabIndex={0}
                  aria-label={`Open ${said}`}
                  data-graview-city-record={one.id}
                  data-graview-lit=""
                  className="graview-city-open"
                  style={{ pointerEvents: "auto", cursor: "pointer" }}
                  onClick={go(one.id)}
                  onKeyDown={go(one.id)}
                >
                  <title>{said}</title>
                  {drawn}
                </a>
              );
            })}
          </g>
          <g fill="var(--graview-ink-muted)" fontFamily="var(--graview-font-body, system-ui)" fontSize={CELL * 0.28} textAnchor="middle" aria-hidden="true">
            {ground.plots.map((plot) => (
              <text key={plot.kind} x={plot.front.x} y={plot.front.y + CELL * 0.36}>
                {plot.count > 0 ? `${plot.label} ${plot.count}` : plot.label}
              </text>
            ))}
          </g>
        </svg>
        <style>{CITY_CSS}</style>
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
        {measured ? linesSaid([...lit].map(nameOf).filter(Boolean)) : ""}
      </p>
    </>
  );
}

/* A way into the city held by the keyboard is ringed as the face rings any: on the building itself. */
const CITY_CSS = `.graview-city-open{outline:none}.graview-city-open:focus-visible polygon:last-of-type{stroke:var(--graview-accent);stroke-width:4px}`;

/** The lines in words: which records the page shows, where they stand in the city. */
function linesSaid(names: readonly string[]): string {
  if (names.length === 0) return "Stepped back. Nothing on this page stands in the city.";
  const listed = names.length <= 5 ? names.join(", ") : `${names.slice(0, 5).join(", ")} and ${names.length - 5} more`;
  return `Stepped back. Lines run from this page to ${listed} in the city. Each is a way to its page.`;
}
