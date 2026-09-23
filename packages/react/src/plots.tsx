import { BLOCK, hueFor, roadsOf, toIso, type Brand, type Plot } from "@graview/core";
import { kindOfCard, type InterpolatedLayout } from "@graview/layout";
import { memo, useCallback, useMemo, useRef, type CSSProperties, type ReactElement } from "react";
import { useGraview } from "./context.js";
import { useFlagged } from "./hooks.js";

/*
 * THE GROUND UNDER A DISTRICT. The layout gives every district a plot on
 * the 2:1 lattice — a corner cell and a side — and the city a cell size and
 * an origin; until now nothing drew the plot, so a district floated on a
 * hatch. This layer draws each plot as the iso tile it is: four corners of
 * the lattice, filled in the kind's hue, a kerb, a cast shadow. It is the
 * arithmetic the layout already did, made visible — honest geometry, not
 * decoration — and it rides the same origin and pan the lattice rides, so a
 * tile sits exactly on the diamonds a person can see.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface City {
  readonly cell: number;
  readonly originX: number;
  readonly originY: number;
}
export interface PlotLike {
  readonly col: number;
  readonly row: number;
  readonly side: number;
}

/** The four corners of a plot's tile on the canvas: back, right, front, left — clockwise from the top. */
export function tileCorners(plot: PlotLike, city: City, pan: Point = { x: 0, y: 0 }): [Point, Point, Point, Point] {
  const at = (col: number, row: number): Point => {
    const iso = toIso(col, row, city.cell);
    return { x: city.originX + pan.x + iso.x, y: city.originY + pan.y + iso.y };
  };
  return [
    at(plot.col, plot.row),
    at(plot.col + plot.side, plot.row),
    at(plot.col + plot.side, plot.row + plot.side),
    at(plot.col, plot.row + plot.side),
  ];
}

const points = (corners: readonly Point[]): string => corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

export interface PlotsProps {
  readonly frame: InterpolatedLayout;
  readonly width: number;
  readonly height: number;
  /** The pan baked into the frame's cards, so a tile sits under its card. */
  readonly pan: Point;
  readonly brand?: Brand | undefined;
  /** Which district ids are hand-placed: their kerb is dashed, as the pinned mark. */
  readonly pinned?: ReadonlySet<string>;
  /** The scene's own flag for a click that a drag is about to produce: a pan that ends on a tile is not a press. */
  readonly swallowed?: { readonly current: boolean };
  onFocus?(id: string): void;
}

/**
 * One SVG for every tile, under the cards and over the fields. Aria-hidden:
 * the district card is the thing with a name; this is the ground it stands
 * on. The fill takes the pointer so a click on the land focuses its
 * district, the same as a click on the card.
 *
 * THE GROUND IS DRAWN AT THE ORIGIN AND MOVED AS ONE. Every piece of it is
 * computed at origin zero and the pan and origin are one translate on the
 * group, so a pan or a tween changes one attribute. Each plot is its own
 * memoised tile whose village is kept for as long as that plot and its
 * members are the same, so dragging one district redraws that district and
 * the roads, not every building in the city on every frame.
 */
export function Plots({ frame, width, height, pan, brand, pinned, swallowed, onFocus }: PlotsProps): ReactElement | null {
  const { selection, store, emphasis } = useGraview();
  const flagged = useFlagged();
  const city = frame.city;
  const tiles = frame.nodes.filter((node) => node.plot !== undefined && Math.round(node.plane) === 2);
  const cell = city?.cell ?? 0;
  // The callback is read when the tile is pressed, so a new one each render redraws nothing.
  const focus = useRef(onFocus);
  focus.current = onFocus;
  const press = useCallback((id: string) => {
    if (!focus.current || swallowed?.current) return false;
    focus.current(id);
    return true;
  }, [swallowed]);

  /*
   * THE ROADS, one per pair of plots joined by any declared edge
   * (`roadsOf`), kerb to kerb along the gutters. They depend on every
   * plot, so they are routed again when any plot moves — and only then.
   */
  const plotsSignature = `${cell}|${tiles.map((node) => `${node.id}:${node.plot!.col},${node.plot!.row},${node.plot!.side}`).join(";")}`;
  const roads = useMemo(() => {
    if (!city) return [];
    const at0 = { cell, originX: 0, originY: 0 };
    const plotsByKind = new Map<string, Plot>();
    for (const node of tiles) {
      const kind = kindOfCard(node.id);
      if (kind !== null && node.plot) plotsByKind.set(kind, node.plot);
    }
    return roadsOf(store.schema, plotsByKind).map((road) => ({
      ...road,
      d: roadBetween(plotsByKind.get(road.from)!, plotsByKind.get(road.to)!, at0, { x: 0, y: 0 })
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" "),
    }));
    // `plotsSignature` stands for the tiles and the cell.
  }, [plotsSignature, store.schema]);

  /* EACH PLOT'S GROUND, kept while that plot and its members are unchanged. */
  const drawn = useRef(new Map<string, PlotDrawing>());
  const kept = new Map<string, PlotDrawing>();
  for (const node of tiles) {
    const members = node.aggregate?.memberIds ?? [];
    const key = `${cell}|${node.plot!.col},${node.plot!.row},${node.plot!.side}|${members.join(",")}`;
    const held = drawn.current.get(node.id);
    if (held && held.key === key) {
      kept.set(node.id, held);
      continue;
    }
    const at0 = { cell, originX: 0, originY: 0 };
    const none = { x: 0, y: 0 };
    const { buildings, rest } = villageOf(node.plot!, members);
    const corners = tileCorners(node.plot!, at0, none);
    kept.set(node.id, {
      key,
      tile: points(corners),
      front: corners[2]!,
      rest,
      buildings: buildings.map((building) => ({ id: building.id, ...buildingFaces(building, at0, none) })),
    });
  }
  drawn.current = kept;

  if (!city) return null;
  const style: CSSProperties = { position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" };
  const chosenKey = selection.join("\n");
  const flaggedKey = flagged.join("\n");
  return (
    <svg className="graview-plots" aria-hidden="true" data-graview-world="" width={width} height={height} style={style} data-graview-plots={tiles.length}>
      <g transform={`translate(${(city.originX + pan.x).toFixed(1)} ${(city.originY + pan.y).toFixed(1)})`}>
        <g className="graview-roads" data-graview-roads={roads.length}>
          {roads.map((road) =>
            road.d.includes("L") ? (
              <g
                key={`${road.from}|${road.to}`}
                className="graview-road"
                data-graview-road={road.edges.join(",")}
                data-graview-lit={emphasis !== null && road.edges.includes(emphasis) ? "" : undefined}
              >
                <path className="graview-road-edge" d={road.d} />
                <path className="graview-road-bed" d={road.d} />
              </g>
            ) : null,
          )}
        </g>
        {tiles.map((node) => (
          <PlotTile
            key={node.id}
            id={node.id}
            hue={Math.round(hueFor(node.kind, brand?.accents))}
            drawing={kept.get(node.id)!}
            pinned={pinned?.has(node.id) ?? false}
            chosenKey={chosenKey}
            flaggedKey={flaggedKey}
            press={press}
          />
        ))}
      </g>
    </svg>
  );
}

/** One plot's ground at origin zero: its tile, and the village standing on it. */
interface PlotDrawing {
  /** What it was drawn from, so it is drawn again only when that changes. */
  readonly key: string;
  readonly tile: string;
  readonly front: Point;
  readonly rest: number;
  readonly buildings: readonly { readonly id: string; readonly roof: string; readonly left: string; readonly right: string }[];
}

const PlotTile = memo(function PlotTile({
  id,
  hue,
  drawing,
  pinned,
  chosenKey,
  flaggedKey,
  press,
}: {
  readonly id: string;
  readonly hue: number;
  readonly drawing: PlotDrawing;
  readonly pinned: boolean;
  /** The selection and the flags as keys, so a tile compares them by value. */
  readonly chosenKey: string;
  readonly flaggedKey: string;
  readonly press: (id: string) => boolean;
}) {
  const chosen = new Set(chosenKey.split("\n"));
  const broken = new Set(flaggedKey.split("\n"));
  return (
    <g className="graview-plot" data-graview-plot={id} data-graview-pinned={pinned ? "" : undefined} style={{ ["--graview-hue" as string]: hue }}>
      <polygon
        className="graview-plot-tile"
        points={drawing.tile}
        onClick={(event) => {
          if (press(id)) event.stopPropagation();
        }}
      />
      {/* THE VILLAGE: one building per member, back to front, the square in the middle kept for the hall. */}
      {drawing.buildings.length > 0 ? (
        <g className="graview-village" data-graview-village={drawing.buildings.length} data-graview-rest={drawing.rest || undefined}>
          {drawing.buildings.map((faces) => (
            <g
              key={faces.id}
              className="graview-building"
              data-graview-building={faces.id}
              data-graview-flagged={broken.has(faces.id) ? "" : undefined}
              data-graview-selected={chosen.has(faces.id) ? "" : undefined}
            >
              <polygon className="graview-iso-left" points={faces.left} />
              <polygon className="graview-iso-right" points={faces.right} />
              <polygon className="graview-iso-roof" points={faces.roof} />
            </g>
          ))}
          {drawing.rest > 0 ? (
            <text className="graview-village-rest" x={drawing.front.x} y={drawing.front.y - 4} textAnchor="middle">
              +{drawing.rest}
            </text>
          ) : null}
        </g>
      ) : null}
    </g>
  );
});

/* ------------------------------------------------------------ the village */

/** The most buildings a plot of this side holds: a sub-lattice of side+1 to a side, minus the square in the middle. */
export function villageCap(side: number): number {
  const n = side + 1;
  return n * n - squareCells(n).length;
}

/** The sub-cells of an n×n sub-lattice that make the village square: the middle one, or the middle four; a 2×2 has no room for one. */
function squareCells(n: number): readonly (readonly [number, number])[] {
  if (n < 3) return [];
  if (n % 2 === 1) {
    const mid = (n - 1) / 2;
    return [[mid, mid]];
  }
  const a = n / 2 - 1;
  const b = n / 2;
  return [
    [a, a],
    [b, a],
    [a, b],
    [b, b],
  ];
}

/** A stable number in [0, 1) from an id, so a village is not a barracks and does not reshuffle on every render. */
export function heightOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export interface Building {
  readonly id: string;
  /** The foot, in lattice units from the plot's own corner. */
  readonly col: number;
  readonly row: number;
  /** How wide a building is on the ground, in lattice units. */
  readonly footprint: number;
  /** How tall, as a fraction of its footprint. */
  readonly height: number;
}

/**
 * WHERE THE MEMBERS STAND. One building per member on the plot's own
 * sub-lattice, back to front so the near ones are drawn last; the middle
 * of the plot is the village square, where the nameplate and the kind's
 * landmark stand, so no building is under them. Past the cap the rest are
 * a number on the kerb.
 */
export function villageOf(plot: PlotLike, memberIds: readonly string[]): { readonly buildings: readonly Building[]; readonly rest: number } {
  const n = plot.side + 1;
  const square = new Set(squareCells(n).map(([c, r]) => `${c},${r}`));
  const pitch = plot.side / n;
  const cells: (readonly [number, number])[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!square.has(`${c},${r}`)) cells.push([c, r]);
  // Back to front: a smaller col+row is further from the viewer on a 2:1 lattice.
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
  const shown = memberIds.slice(0, cells.length);
  const buildings = shown.map((id, i) => {
    const [c, r] = cells[i]!;
    return {
      id,
      col: plot.col + (c + 0.5) * pitch,
      row: plot.row + (r + 0.5) * pitch,
      footprint: pitch * 0.62,
      height: 0.55 + heightOf(id) * 0.7,
    };
  });
  return { buildings, rest: Math.max(0, memberIds.length - shown.length) };
}

/** The three faces of one building on the canvas, from its foot cell. */
export function buildingFaces(building: Building, city: City, pan: Point): { readonly roof: string; readonly left: string; readonly right: string; readonly top: Point } {
  const half = building.footprint / 2;
  const at = (col: number, row: number, lift = 0): Point => {
    const iso = toIso(col, row, city.cell);
    return { x: city.originX + pan.x + iso.x, y: city.originY + pan.y + iso.y - lift };
  };
  const rise = building.footprint * city.cell * 0.5 * building.height;
  const back = at(building.col - half, building.row - half, rise);
  const right = at(building.col + half, building.row - half, rise);
  const front = at(building.col + half, building.row + half, rise);
  const left = at(building.col - half, building.row + half, rise);
  const frontFoot = at(building.col + half, building.row + half);
  const leftFoot = at(building.col - half, building.row + half);
  const rightFoot = at(building.col + half, building.row - half);
  return {
    roof: points([back, right, front, left]),
    left: points([left, front, frontFoot, leftFoot]),
    right: points([front, right, rightFoot, frontFoot]),
    top: back,
  };
}

/* --------------------------------------------------------------- the roads */

/** Lattice coordinates of a canvas point: the isometric map run backwards. */
export function toLattice(point: Point, city: City, pan: Point): { readonly col: number; readonly row: number } {
  const x = point.x - city.originX - pan.x;
  const y = point.y - city.originY - pan.y;
  return { col: x / city.cell + (2 * y) / city.cell, row: (2 * y) / city.cell - x / city.cell };
}

const insidePlot = (point: Point, plot: PlotLike, city: City, pan: Point): boolean => {
  const { col, row } = toLattice(point, city, pan);
  return col >= plot.col && col <= plot.col + plot.side && row >= plot.row && row <= plot.row + plot.side;
};

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * THE STREETS. Plots stand at multiples of BLOCK and never fill their
 * block, so between every block there is a gutter — a row and a column
 * of cells nothing stands on. A road runs along them: out of its plot to
 * the gutter beside its block, along that gutter, up the gutter beside
 * the other block, and in. Every leg is a lattice line (one coordinate
 * held), no leg crosses a third plot, and the whole city reads as
 * villages on a street grid rather than lines drawn over it.
 */
export function streetPoints(from: PlotLike, to: PlotLike): { readonly col: number; readonly row: number }[] {
  const ca = from.col + from.side / 2;
  const ra = from.row + from.side / 2;
  const cb = to.col + to.side / 2;
  const rb = to.row + to.side / 2;
  const blockRow = (plot: PlotLike) => Math.floor(plot.row / BLOCK);
  const blockCol = (plot: PlotLike) => Math.floor(plot.col / BLOCK);
  const ja = blockRow(from);
  const jb = blockRow(to);
  const ia = blockCol(from);
  const ib = blockCol(to);
  // The gutter row beside `from`, on the side `to` lies; the gutter column beside `to`, on the side `from` lies.
  const gr = jb > ja ? ja * BLOCK + BLOCK - 0.5 : jb < ja ? ja * BLOCK - 0.5 : ja * BLOCK + BLOCK - 0.5;
  const gc = ib > ia ? ib * BLOCK - 0.5 : ib < ia ? ib * BLOCK + BLOCK - 0.5 : ib * BLOCK - 0.5;
  const raw = [
    { col: ca, row: ra },
    { col: ca, row: gr },
    { col: gc, row: gr },
    { col: gc, row: rb },
    { col: cb, row: rb },
  ];
  // Drop a leg of no length, and a middle point that lies on the line of its neighbours.
  const out: { col: number; row: number }[] = [];
  for (const p of raw) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.col - p.col) < 1e-9 && Math.abs(last.row - p.row) < 1e-9) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1]!;
    const b = out[i]!;
    const c = out[i + 1]!;
    const sameCol = Math.abs(a.col - b.col) < 1e-9 && Math.abs(b.col - c.col) < 1e-9;
    const sameRow = Math.abs(a.row - b.row) < 1e-9 && Math.abs(b.row - c.row) < 1e-9;
    if (sameCol || sameRow) out.splice(i, 1);
  }
  return out;
}

/**
 * A ROAD FROM KERB TO KERB: the street between two plots, with the run
 * inside either plot cut away, so the road starts at one kerb and ends at
 * the other rather than diving under the buildings. Sampled and bisected,
 * the same way a connector is clipped against a box.
 */
export function roadBetween(from: PlotLike, to: PlotLike, city: City, pan: Point): Point[] {
  const points = streetPoints(from, to).map((p) => {
    const iso = toIso(p.col, p.row, city.cell);
    return { x: city.originX + pan.x + iso.x, y: city.originY + pan.y + iso.y };
  });
  // Walk out of `from`: the first point on the polyline outside its plot.
  const out: Point[] = [];
  let started = false;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (!started) {
      if (insidePlot(b, from, city, pan)) continue;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (insidePlot(lerp(a, b, mid), from, city, pan)) lo = mid;
        else hi = mid;
      }
      out.push(lerp(a, b, hi));
      started = true;
    }
    // Walk into `to`: the first point on the polyline inside its plot.
    if (insidePlot(b, to, city, pan)) {
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (insidePlot(lerp(a, b, mid), to, city, pan)) hi = mid;
        else lo = mid;
      }
      out.push(lerp(a, b, lo));
      return out;
    }
    out.push(b);
  }
  return out;
}
