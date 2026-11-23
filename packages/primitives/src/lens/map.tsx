import { counted, isCurrent, type AnyGraphNode, numberAsRead, pluralOf, type AnySchema, type MapCoordinates, type NodeOfSchema } from "@graview/core";
import { useGraview, useNavigation, type ViewProps } from "@graview/react";
import { createContext, useContext, useRef, type ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel, useWidth, VISUALLY_HIDDEN } from "../primitives/index.js";
import { SpecLinks } from "../spec-views.js";
import { useArranging } from "./arranging.js";
import { fanOut, frameOf, graticuleOf, inFrame, pinsOf, tilesFor, type MapPin, type MapTiles } from "./map-ground.js";
import { withMore } from "./more.js";

export type { MapTiles } from "./map-ground.js";

/*
 * THE MAP LENS (Graview HQ feature:f-map-lens): a kind's records pinned
 * where they are, each pin a link to its record.
 *
 * Bound by roles, like every lens: a place field whose point the host kept
 * beside it (`<place>Geo`, `@graview/core`'s `geo.ts`), or a latitude and
 * a longitude. It has never heard of a field trip or a venue.
 *
 * NOTHING IS FETCHED. The ground is drawn here — the pins' own bounds in
 * Web Mercator, lines of latitude and longitude at a round step, said in
 * degrees at their edge — so a map works offline, in a sandbox and on a
 * page that may load nothing from elsewhere. A host that has tiles of its
 * own hands them (`MapTilesContext`); they lie under the same pins in the
 * same projection, and the words owed for them are said under the map.
 *
 * A RECORD WITH NO POINT IS SAID, NEVER DROPPED: "3 trips have no place
 * yet", under the map, so nineteen records do not pass for sixteen.
 */

/** Where a host's tiles come from, handed to every map under it; none, and the map draws its own plain ground. */
export const MapTilesContext = createContext<MapTiles | null>(null);

export interface MapOptions {
  /** What each kind is pinned by, as `declaredLenses` resolved it: `{ trip: { place: "where" } }`, `{ stop: { lat: "lat", lng: "lng" } }`. */
  readonly bindings: Readonly<Record<string, MapCoordinates>>;
  readonly search?: readonly string[];
  readonly filters?: readonly string[];
  readonly arranging?: boolean;
  /** A host's tiles for this map alone, before `MapTilesContext`. */
  readonly tiles?: MapTiles;
}

export interface MapLens<S extends AnySchema> {
  readonly name: "map";
  readonly requiredRoles: readonly string[];
  readonly bindings: MapOptions["bindings"];
  View(props: ViewProps<S>): ReactElement | null;
}

const CSS = `
.graview-map { position: relative; width: 100%; overflow: hidden; border-radius: 10px; border: 1px solid var(--graview-edge); background: var(--graview-ground, color-mix(in oklab, var(--graview-panel) 92%, var(--graview-ink) 8%)); }
.graview-map svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.graview-map-pins { list-style: none; margin: 0; padding: 0; position: absolute; inset: 0; }
.graview-map-pin { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; }
.graview-map-press { box-sizing: border-box; width: 24px; height: 24px; display: grid; place-items: center; padding: 0; margin: 0; border: 0; border-radius: 50%; background: none; cursor: pointer; color: inherit; text-decoration: none; }
.graview-map-press:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 1px; }
.graview-map-dot { width: 12px; height: 12px; border-radius: 50%; box-sizing: border-box; border: 2px solid var(--graview-panel); box-shadow: 0 0 0 1px var(--graview-ink-muted); }
.graview-map-press[data-graview-emphasis="lit"] .graview-map-dot { box-shadow: 0 0 0 2px var(--graview-accent); }
.graview-map-press[data-graview-emphasis="dimmed"] { opacity: 0.35; }
.graview-map-press[data-graview-flagged] .graview-map-dot { box-shadow: 0 0 0 2px var(--graview-warn); }
.graview-map-name { position: absolute; left: 22px; top: 50%; transform: translateY(-50%); white-space: nowrap; font-size: 0.75rem; line-height: 1.2; color: var(--graview-ink); pointer-events: none; text-shadow: 0 0 3px var(--graview-panel), 0 0 3px var(--graview-panel); }
.graview-map-said { margin: 6px 0 0; font-size: 0.8125rem; color: var(--graview-ink-muted); }
.graview-map-credit { position: absolute; right: 4px; bottom: 2px; font-size: 0.6875rem; color: var(--graview-ink-muted); background: color-mix(in oklab, var(--graview-panel) 80%, transparent); padding: 0 4px; border-radius: 4px; }
`;

/** Past this many pins the names are left to each pin's own words: a crowd of labels is read by nobody. */
const MOST_NAMED = 12;

/** How many records of each kind have no point, in the kind's words: "3 trips have no place yet". */
export function unplacedWords(schema: AnySchema, unplaced: readonly { readonly kind: string; readonly count: number }[]): string | undefined {
  if (unplaced.length === 0) return undefined;
  const parts = unplaced.map(({ kind, count }) => counted(schema, kind, count));
  const total = unplaced.reduce((sum, one) => sum + one.count, 0);
  return `${parts.join(" and ")} ${total === 1 ? "has" : "have"} no place yet`;
}

export function createMapLens<S extends AnySchema>(options: MapOptions): MapLens<S> {
  function View(props: ViewProps<S>) {
    const { store } = useGraview<S>();
    const { view } = useNavigation();
    const kinds = Object.keys(options.bindings).filter((kind) => store.schema.tryDefinition(kind) !== undefined);
    const given = props.nodes ?? [];
    const own = new Set(given.map((node) => String(node.kind)));
    const first = kinds.find((kind) => own.has(kind)) ?? kinds[0];
    /* Its first bound kind arranged by the line — Find and the chips — and every other bound kind from the graph this seat sees, as the calendar reads them. */
    const subject = first === undefined ? [] : own.has(first) ? given.filter((node) => node.kind === first) : (store.graph.nodesOfKind(first as never) as NodeOfSchema<S>[]).filter((node) => view.past === true || isCurrent(store.schema.tryDefinition(first), node as never));
    const { nodes, bar } = useArranging<S>(props, {
      ...(options.arranging !== undefined ? { allow: options.arranging } : {}),
      lensAllows: { sort: false, group: false },
      subject,
      ...(first !== undefined ? { kind: first } : {}),
      ...(options.search ? { search: options.search } : {}),
      ...(options.filters ? { filters: options.filters } : {}),
    });
    const others = kinds
      .filter((kind) => kind !== first)
      .flatMap((kind) => (own.has(kind) ? given.filter((node) => node.kind === kind) : (store.graph.nodesOfKind(kind as never) as NodeOfSchema<S>[]).filter((node) => view.past === true || isCurrent(store.schema.tryDefinition(kind), node as never))));
    const drawn = [...nodes, ...others] as unknown as readonly { readonly id: string; readonly kind: string }[];
    const { pins, unplaced } = pinsOf(store.schema, drawn, options.bindings);
    const title = props.label ?? "Map";
    const missing = unplacedWords(store.schema, unplaced);

    if (props.fidelity === "glyph") return <Chip label={`${title} · ${numberAsRead(pins.length)}`} hue={hueFor("map")} />;
    const ground = <MapGround pins={pins} title={title} props={props} named={props.fidelity === "full" && pins.length <= MOST_NAMED} tiles={options.tiles} />;
    const picture = (
      <div style={{ display: "grid", gap: 6 }} data-testid="map-lens">
        {bar}
        {pins.length > 0 ? ground : null}
        {missing ? (
          <p className="graview-map-said" data-testid="map-unplaced">
            {missing}.
          </p>
        ) : null}
        {pins.length === 0 && !missing && first ? (
          <p className="graview-map-said" data-testid="map-empty">
            No {pluralOf(store.schema, first)} to show yet.
          </p>
        ) : null}
      </div>
    );
    const meta = first ? `${counted(store.schema, first, pins.length)} on the map` : undefined;
    if (props.fidelity === "summary") return <Panel title={title} {...(meta ? { meta } : {})} tone="muted">{picture}</Panel>;
    // On a page the page's own heading already says what it is; in the scene it is a card, as every lens is.
    return withMore(
      props,
      store.schema,
      props.mode === "fullscreen" ? <div style={{ padding: "14px 16px" }}>{picture}</div> : <Panel title={title} {...(meta ? { meta } : {})}>{picture}</Panel>,
    );
  }
  return { name: "map", requiredRoles: [], bindings: options.bindings, View };
}

function MapGround<S extends AnySchema>({ pins, title, props, named, tiles: own }: { readonly pins: readonly Omit<MapPin, "x" | "y">[]; readonly title: string; readonly props: ViewProps<S>; readonly named: boolean; readonly tiles?: MapTiles | undefined }) {
  const box = useRef<HTMLDivElement | null>(null);
  const width = useWidth(box) ?? 640;
  const handed = useContext(MapTilesContext);
  const tiles = own ?? handed;
  const links = useContext(SpecLinks);
  const { store } = useGraview<S>();
  const nodeOf = (pin: { readonly id: string; readonly kind: string }): AnyGraphNode => (store.graph.getNode(pin.id) as AnyGraphNode | undefined) ?? ({ id: pin.id, kind: pin.kind } as AnyGraphNode);
  // A desk's picture is wider than tall, a phone's square: the frame is widened to it, never stretched.
  const aspect = width < 560 ? 1 : 1.6;
  const frame = frameOf(pins, aspect)!;
  const lines = graticuleOf(frame);
  const tall = 1000 / aspect;
  const placed = fanOut(pins.map((pin): MapPin => ({ ...pin, ...inFrame(frame, pin.lat, pin.lng) })), width, width / aspect);
  const highlit = new Set([...(props.implicated ?? [])]);
  const flagged = new Set(props.flagged ?? []);
  const emphasis = (id: string) => (highlit.size === 0 ? undefined : highlit.has(id) ? "lit" : "dimmed");
  return (
    <div ref={box} className="graview-map" role="group" aria-label={`${title}: ${placed.length === 1 ? "one place" : `${numberAsRead(placed.length)} places`} on a map`} style={{ aspectRatio: String(aspect) }} data-graview-map-step={lines.step}>
      <style>{CSS}</style>
      <svg viewBox={`0 0 1000 ${tall}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        {tiles ? tilesFor(frame, width, tiles).map((tile) => <image key={`${tile.x}:${tile.y}`} href={tile.href} x={tile.x * 1000} y={tile.y * tall} width={tile.width * 1000 + 0.5} height={tile.height * tall + 0.5} preserveAspectRatio="none" />) : null}
        <g stroke="var(--graview-edge)" strokeWidth={1} fill="none">
          {lines.meridians.map((line) => <line vectorEffect="non-scaling-stroke" key={`m${line.degrees}`} x1={line.at * 1000} x2={line.at * 1000} y1={0} y2={tall} />)}
          {lines.parallels.map((line) => <line vectorEffect="non-scaling-stroke" key={`p${line.degrees}`} x1={0} x2={1000} y1={line.at * tall} y2={line.at * tall} />)}
        </g>
        {/* A pin set out beside others at one spot keeps a line to where it is. */}
        <g stroke="var(--graview-ink-muted)" fill="var(--graview-ink-muted)">
          {placed.filter((pin) => pin.drawnX !== pin.x || pin.drawnY !== pin.y).map((pin) => (
            <g key={`l${pin.id}`}>
              <line vectorEffect="non-scaling-stroke" strokeWidth={1} x1={pin.x * 1000} y1={pin.y * tall} x2={pin.drawnX * 1000} y2={pin.drawnY * tall} />
              <circle cx={pin.x * 1000} cy={pin.y * tall} r={2.5} stroke="none" />
            </g>
          ))}
        </g>
        <g fill="var(--graview-ink-muted)" fontSize={aspect === 1 ? 26 : 16} fontFamily="inherit">
          {lines.meridians.map((line) => (
            <text key={`mt${line.degrees}`} x={line.at * 1000 + 4} y={tall - 6}>
              {line.said}
            </text>
          ))}
          {lines.parallels.map((line) => (
            <text key={`pt${line.degrees}`} x={4} y={line.at * tall - 4}>
              {line.said}
            </text>
          ))}
        </g>
      </svg>
      <ul className="graview-map-pins" aria-label={title}>
        {placed.map((pin) => {
          const lit = emphasis(pin.id);
          const warned = flagged.has(pin.id);
          const said = `${pin.label}${warned ? ", implicated in a problem" : ""}`;
          const dot = <span className="graview-map-dot" aria-hidden="true" style={{ background: `hsl(${Math.round(hueFor(pin.kind))} 65% 48%)` }} />;
          const common = { className: "graview-map-press", "aria-label": said, title: pin.label, "data-map-pin": pin.id, ...(lit ? { "data-graview-emphasis": lit } : {}), ...(warned ? { "data-graview-flagged": "" } : {}) };
          return (
            <li key={pin.id} className="graview-map-pin" style={{ left: `${pin.drawnX * 100}%`, top: `${pin.drawnY * 100}%` }}>
              {links ? (
                <a
                  {...common}
                  href={links.href(nodeOf(pin))}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    links.go(nodeOf(pin));
                  }}
                >
                  {dot}
                </a>
              ) : (
                <button type="button" {...common} data-graview-pick={pin.id}>
                  {dot}
                </button>
              )}
              {named ? (
                <span className="graview-map-name" aria-hidden="true">
                  {pin.label}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {tiles?.attribution ? <span className="graview-map-credit">{tiles.attribution}</span> : null}
      <span style={VISUALLY_HIDDEN}>{`Lines every ${lines.step}° of latitude and longitude.`}</span>
    </div>
  );
}
