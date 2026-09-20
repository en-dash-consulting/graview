import { BLOCK, hueFor, toIso, type Brand } from "@graview/core";
import type { InterpolatedLayout } from "@graview/layout";
import type { CSSProperties, ReactElement } from "react";

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

/** The robot's pad: one cell at the origin block's street corner, where `padAt` stands it. */
export function padPlot(): PlotLike {
  return { col: BLOCK - 1, row: BLOCK - 1, side: 1 };
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
  onFocus?(id: string): void;
}

/**
 * One SVG for every tile, under the cards and over the fields. Aria-hidden:
 * the district card is the thing with a name; this is the ground it stands
 * on. The fill takes the pointer so a click on the land focuses its
 * district, the same as a click on the card.
 */
export function Plots({ frame, width, height, pan, brand, pinned, onFocus }: PlotsProps): ReactElement | null {
  const city = frame.city;
  if (!city) return null;
  const tiles = frame.nodes.filter((node) => node.plot !== undefined && Math.round(node.plane) === 2);
  const style: CSSProperties = { position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" };
  const pad = tileCorners(padPlot(), city, pan);
  return (
    <svg className="graview-plots" aria-hidden="true" width={width} height={height} style={style} data-graview-plots={tiles.length}>
      <g className="graview-plot-pad">
        <polygon points={points(pad)} />
      </g>
      {tiles.map((node) => {
        const corners = tileCorners(node.plot!, city, pan);
        const hue = Math.round(hueFor(node.kind, brand?.accents));
        return (
          <g
            key={node.id}
            className="graview-plot"
            data-graview-plot={node.id}
            data-graview-pinned={pinned?.has(node.id) ? "" : undefined}
            style={{ ["--graview-hue" as string]: hue }}
          >
            <polygon
              className="graview-plot-tile"
              points={points(corners)}
              onClick={(event) => {
                if (!onFocus) return;
                event.stopPropagation();
                onFocus(node.id);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
