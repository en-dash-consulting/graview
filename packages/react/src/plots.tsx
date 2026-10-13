import { hueFor, type Brand } from "@graview/core";
import { toIso, villageOf, type Building } from "@graview/core/scene";
import type { InterpolatedLayout } from "@graview/layout";
import { memo, useCallback, useRef, type CSSProperties, type ReactElement } from "react";
import { useGraview } from "./context.js";
import { useFlagged } from "./emphasis.js";

/*
 * THE GROUND UNDER A DISTRICT. The layout gives every district a plot on
 * the 2:1 lattice — a corner cell and a side — and the city a cell size and
 * an origin; until now nothing drew the plot, so a district floated on a
 * hatch. This layer draws each plot as the iso tile it is: four corners of
 * the lattice, filled in the kind's hue, a curb, a cast shadow. It is the
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
  /** Which district ids are hand-placed: their curb is dashed, as the pinned mark. */
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
 * memoized tile whose village is kept for as long as that plot and its
 * members are the same, so dragging one district redraws that district and
 * its tile, not every building in the city on every frame.
 */
export function Plots({ frame, width, height, pan, brand, pinned, swallowed, onFocus }: PlotsProps): ReactElement | null {
  const { selection } = useGraview();
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

/*
 * WHERE THE MEMBERS STAND is @graview/core's (`villageOf`), so a picture
 * drawn without a browser (`sceneThumbnail`) puts them where this does.
 */
export { heightOf, villageCap, villageOf } from "@graview/core/scene";
export type { Building } from "@graview/core/scene";

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

/* ------------------------------------------------------------- the lattice */

/** Lattice coordinates of a canvas point: the isometric map run backwards. */
export function toLattice(point: Point, city: City, pan: Point): { readonly col: number; readonly row: number } {
  const x = point.x - city.originX - pan.x;
  const y = point.y - city.originY - pan.y;
  return { col: x / city.cell + (2 * y) / city.cell, row: (2 * y) / city.cell - x / city.cell };
}
