import { labelOf, numberAsRead, SCENE_LAYERS, type Brand, type Scheme } from "@graview/core";
import { districtBlocks, districtState, TIER_HEIGHT, toIso, type Building, type StateTier } from "@graview/core/scene";
import type { InterpolatedLayout } from "@graview/layout";
import { memo, useCallback, useMemo, useRef, type CSSProperties, type ReactElement } from "react";
import { useGraph, useGraview } from "./context.js";
import { useFlagged } from "./emphasis.js";
import { ownRecords, useSinceLastVisit } from "./last-visit.js";
import "./provider.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

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
  /** A cell's height over its width: 0.5 at an angle, 1 from straight above. */
  readonly tilt?: number;
}
export interface PlotLike {
  readonly col: number;
  readonly row: number;
  readonly side: number;
}

/** The four corners of a plot's tile on the canvas: back, right, front, left — clockwise from the top. */
export function tileCorners(plot: PlotLike, city: City, pan: Point = { x: 0, y: 0 }): [Point, Point, Point, Point] {
  const at = (col: number, row: number): Point => {
    const iso = toIso(col, row, city.cell, city.tilt);
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
  /** The camera has come down past the whole map: the blocks say their names. */
  readonly close?: boolean;
  /** The day overdue is judged against (ISO date). */
  readonly today?: string;
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
export function Plots({ frame, width, height, pan, pinned, close, today, swallowed, onFocus }: PlotsProps): ReactElement | null {
  const { selection, store, scheme, principal } = useGraview();
  const nodes = useGraph();
  /* What somebody else wrote since this seat last left, and what is its own (last-visit.ts). */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ops = useMemo(() => store.log.all(), [store, nodes]);
  const recent = useSinceLastVisit(ops, store.schema.kinds as readonly string[], principal);
  const own = useMemo(() => ownRecords(store.graph, ops, principal?.id), [store, ops, principal?.id]);
  const flagged = useFlagged();
  const city = frame.city;
  const tiles = frame.nodes.filter((node) => node.plot !== undefined && Math.round(node.plane) === 2);
  const cell = city?.cell ?? 0;
  const tilt = city?.tilt ?? 0.5;
  // The callback is read when the tile is pressed, so a new one each render redraws nothing.
  const focus = useRef(onFocus);
  focus.current = onFocus;
  const press = useCallback((id: string) => {
    if (!focus.current || swallowed?.current) return false;
    focus.current(id);
    return true;
  }, [swallowed]);

  /*
   * EACH PLOT'S GROUND, kept while that plot and where its members stand
   * are unchanged: a row of blocks per value of the kind's main choice
   * (`districtState`), back row first in the declared order, each block as
   * tall as its value reads — done flat, active raised.
   */
  const drawn = useRef(new Map<string, PlotDrawing>());
  const kept = new Map<string, PlotDrawing>();
  for (const node of tiles) {
    const members = node.aggregate?.memberIds ?? [];
    const state = districtState(store.schema, node.kind);
    const valueOf = (id: string) => (state ? (store.graph.getNode(id) as Record<string, unknown> | undefined)?.[state.field] : undefined);
    const key = `${cell}|${tilt}|${node.plot!.col},${node.plot!.row},${node.plot!.side}|${members.map((id) => `${id}=${String(valueOf(id))}`).join(",")}`;
    const held = drawn.current.get(node.id);
    if (held && held.key === key) {
      kept.set(node.id, held);
      continue;
    }
    const at0 = { cell, originX: 0, originY: 0, tilt };
    const none = { x: 0, y: 0 };
    const definition = store.schema.tryDefinition(node.kind);
    const nameOf = (id: string) => {
      const record = store.graph.getNode(id);
      return record ? labelOf(definition, record) : id;
    };
    const lanes: string[][] = state ? state.values.map(() => []) : [[]];
    const tiers: StateTier[] = state ? [...state.tiers] : ["waiting"];
    for (const id of members) {
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
    const { blocks, rests } = districtBlocks(node.plot!, lanes, tiers.map((tier) => TIER_HEIGHT[tier]));
    const corners = tileCorners(node.plot!, at0, none);
    // A record's due date past and not done: overdue, lit like a problem.
    const due = state ? dueField(store.schema, node.kind) : undefined;
    kept.set(node.id, {
      key,
      tile: points(corners),
      rests: rests.map((rest) => ({ count: rest.count, at: toIso(rest.col, rest.row, cell, tilt) })),
      buildings: blocks.map((block) => {
        const record = due ? (store.graph.getNode(block.id) as Record<string, unknown> | undefined) : undefined;
        const when = record?.[due!];
        return {
          id: block.id,
          tier: tiers[block.lane]!,
          overdue: typeof when === "string" && tiers[block.lane] !== "done" && when.slice(0, 10) < (today ?? new Date().toISOString().slice(0, 10)),
          name: nameOf(block.id),
          width: block.footprint * cell,
          ...buildingFaces(block, at0, none),
        };
      }),
    });
  }
  drawn.current = kept;

  if (!city) return null;
  const style: CSSProperties = { position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" };
  const chosenKey = selection.join("\n");
  const flaggedKey = flagged.join("\n");
  const recentKey = recent ? [...recent].join("\n") : "";
  const ownKey = own ? [...own].join("\n") : "";
  return (
    <>
    <style>{groundCss(scheme)}</style>
    <svg className="graview-plots" aria-hidden="true" data-graview-world="" width={width} height={height} style={style} data-graview-plots={tiles.length}>
      <g transform={`translate(${(city.originX + pan.x).toFixed(1)} ${(city.originY + pan.y).toFixed(1)})`}>
        {tiles.map((node) => (
          <PlotTile
            key={node.id}
            id={node.id}
            drawing={kept.get(node.id)!}
            pinned={pinned?.has(node.id) ?? false}
            chosenKey={chosenKey}
            flaggedKey={flaggedKey}
            recentKey={recentKey}
            ownKey={ownKey}
            named={close ?? false}
            press={press}
          />
        ))}
      </g>
    </svg>
    </>
  );
}

/** One plot's ground at origin zero: its tile, and the blocks standing on it. */
interface PlotDrawing {
  /** What it was drawn from, so it is drawn again only when that changes. */
  readonly key: string;
  readonly tile: string;
  /** A row's records it had no room for, counted at the row's own end. */
  readonly rests: readonly { readonly count: number; readonly at: Point }[];
  readonly buildings: readonly {
    readonly id: string;
    readonly tier: StateTier;
    readonly overdue: boolean;
    readonly name: string;
    /** How wide the block is on the screen, so a name is written on it only once there is room. */
    readonly width: number;
    readonly roof: string;
    readonly left: string;
    readonly right: string;
    readonly top: Point;
  }[];
}

/** A block's name is written over it once the block is this wide on the screen: coming down, the blocks are named. */
const NAMED_FROM = 34;

const PlotTile = memo(function PlotTile({
  id,
  drawing,
  pinned,
  chosenKey,
  flaggedKey,
  recentKey,
  ownKey,
  named,
  press,
}: {
  readonly id: string;
  readonly drawing: PlotDrawing;
  readonly pinned: boolean;
  /** The selection, the flags, the changed and the own as keys, so a tile compares them by value. */
  readonly chosenKey: string;
  readonly flaggedKey: string;
  readonly recentKey: string;
  readonly ownKey: string;
  /** Come down past the whole map: the blocks wide enough for a name say it. */
  readonly named: boolean;
  readonly press: (id: string) => boolean;
}) {
  const chosen = new Set(chosenKey.split("\n"));
  const broken = new Set(flaggedKey.split("\n"));
  const recent = new Set(recentKey.split("\n"));
  const own = new Set(ownKey.split("\n"));
  return (
    <g className="graview-plot" data-graview-plot={id} data-graview-pinned={pinned ? "" : undefined}>
      <polygon
        className="graview-plot-tile"
        points={drawing.tile}
        onClick={(event) => {
          if (press(id)) event.stopPropagation();
        }}
      />
      {/* THE BLOCKS: a row per value, back to front; a problem lit, a change since you were here aglow, your own marked. */}
      {drawing.buildings.length > 0 ? (
        <g className="graview-village" data-graview-village={drawing.buildings.length} data-graview-rest={drawing.rests.reduce((sum, rest) => sum + rest.count, 0) || undefined}>
          {drawing.buildings.map((block) => (
            <g
              key={block.id}
              className="graview-building"
              data-graview-building={block.id}
              data-graview-tier={block.tier}
              data-graview-flagged={broken.has(block.id) || block.overdue ? "" : undefined}
              data-graview-overdue={block.overdue ? "" : undefined}
              data-graview-recent={recent.has(block.id) ? "" : undefined}
              data-graview-own={own.has(block.id) ? "" : undefined}
              data-graview-selected={chosen.has(block.id) ? "" : undefined}
            >
              <polygon className="graview-iso-left" points={block.left} />
              <polygon className="graview-iso-right" points={block.right} />
              <polygon className="graview-iso-roof" points={block.roof} />
              {named && block.width >= NAMED_FROM ? (
                <text className="graview-building-name" x={block.top.x} y={block.top.y - 3} textAnchor="middle">
                  {block.name.length * 6 > block.width * 1.6 ? `${block.name.slice(0, Math.max(1, Math.floor((block.width * 1.6) / 6) - 1))}…` : block.name}
                </text>
              ) : null}
            </g>
          ))}
          {drawing.rests.map((rest, i) => (
            <text key={i} className="graview-village-rest" x={rest.at.x - 3} y={rest.at.y + 4} textAnchor="end">
              <title>{`${numberAsRead(rest.count)} more in this row than the plot has room to show`}</title>+{numberAsRead(rest.count)}
            </text>
          ))}
        </g>
      ) : null}
    </g>
  );
});

/** A kind's due date, by the name such a field goes by; undefined when it has none. */
function dueField(schema: { tryDefinition(kind: string): { readonly fields: { readonly shape?: unknown } } | undefined }, kind: string): string | undefined {
  return Object.keys((schema.tryDefinition(kind)?.fields.shape ?? {}) as Record<string, unknown>).find((name) => /^(due|deadline|due[-_ ]?(on|date|at|by))$/i.test(name));
}

/* ------------------------------------------------------------ the village */

/*
 * WHERE THE MEMBERS STAND is @graview/core's (`villageOf`), so a picture
 * drawn without a browser (`sceneThumbnail`) puts them where this does.
 */
export { districtBlocks, heightOf, villageCap, villageOf } from "@graview/core/scene";
export type { Building } from "@graview/core/scene";

/** The three faces of one building on the canvas, from its foot cell. */
export function buildingFaces(building: Building, city: City, pan: Point): { readonly roof: string; readonly left: string; readonly right: string; readonly top: Point } {
  const half = building.footprint / 2;
  const at = (col: number, row: number, lift = 0): Point => {
    const iso = toIso(col, row, city.cell, city.tilt);
    return { x: city.originX + pan.x + iso.x, y: city.originY + pan.y + iso.y - lift };
  };
  // A wall shows as much as the ground is tilted away from straight above: none at all from there.
  const tilt = Math.min(1, city.tilt ?? 0.5);
  const rise = building.footprint * city.cell * 0.5 * building.height * (Math.sqrt(1 - tilt * tilt) / Math.sqrt(0.75));
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
  const t = city.tilt ?? 0.5;
  return { col: x / city.cell + y / (city.cell * t), row: y / (city.cell * t) - x / city.cell };
}

/*
 * THE GROUND'S OWN RULES, fetched with the ground: the scene draws the city
 * only from altitude, so a page that never rises never carries them.
 *
 * COLOR CARRIES STATE, NOT KIND. Every district stands on the same neutral
 * ground in the ground's own ink — a kind is told by its name and where it
 * stands, not by a hue of its own — so the strong colors are left for what
 * needs seeing. The blocks, a row per value: waiting in a middle gray,
 * active darker (and taller), done flat and pale; a record with a problem,
 * or past its due date and not done, lit in the warning color; one
 * somebody else changed since you were last here aglow in the accent; your
 * own with an ink rim; a selected one in the accent. A hand-placed district's curb is dashed.
 */
function groundCss(scheme: Scheme): string {
  const light = scheme === "light";
  const mix = (share: string, of = "var(--graview-ink)") => `color-mix(in oklab, ${of} ${share}, var(--graview-panel))`;
  return `.graview-plots{z-index:${SCENE_LAYERS.plots};opacity:var(--graview-altitude);transition:opacity 640ms cubic-bezier(.33,0,.2,1)}
.graview-plot-tile{fill:color-mix(in oklab,var(--graview-ink) ${light ? 5 : 9}%,transparent);stroke:color-mix(in oklab,var(--graview-ink) ${light ? 22 : 30}%,transparent);stroke-linejoin:round;pointer-events:auto;cursor:pointer}
.graview-plot-tile:hover{fill:color-mix(in oklab,var(--graview-ink) ${light ? 10 : 16}%,transparent)}
.graview-plot[data-graview-pinned] .graview-plot-tile{stroke-dasharray:4 3}
.graview-village{pointer-events:none}
.graview-building{--s:${light ? 30 : 40}%}
.graview-building[data-graview-tier=active]{--s:${light ? 64 : 70}%}
.graview-building polygon{stroke:var(--graview-panel);stroke-width:.6;stroke-opacity:.6;fill:${mix("var(--s)")}}
.graview-building .graview-iso-left{fill:${mix(`calc(var(--s) + ${light ? 15 : -10}%)`)}}
.graview-building .graview-iso-right{fill:${mix(`calc(var(--s) + ${light ? 8 : -16}%)`)}}
.graview-building[data-graview-tier=done] polygon{fill:${mix(light ? "13%" : "18%")}}
.graview-building[data-graview-flagged] polygon{fill:var(--graview-warn);stroke:var(--graview-warn)}
.graview-building[data-graview-flagged] .graview-iso-left{fill:color-mix(in oklab,var(--graview-warn) 80%,var(--graview-ink))}
.graview-building[data-graview-recent]{filter:drop-shadow(0 0 2px color-mix(in oklab,var(--graview-accent) 70%,transparent))}
.graview-building[data-graview-own] .graview-iso-roof{stroke:var(--graview-ink);stroke-width:1.4;stroke-opacity:1}
.graview-building[data-graview-selected] polygon{stroke:var(--graview-accent);stroke-width:1.4;stroke-opacity:1}
.graview-building[data-graview-selected] .graview-iso-roof{fill:${mix("45%", "var(--graview-accent)")}}
.graview-building-name{font-size:.625rem;fill:var(--graview-ink);paint-order:stroke;stroke:var(--graview-ground);stroke-width:3px}
.graview-village-rest{font-size:.6875rem;font-variant-numeric:tabular-nums;fill:var(--graview-ink-muted)}`;
}

