import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import { areaOf, boxOf, centroidOf, fitLabel, overlaps, spanAt, type FittedLabel, type LabelBox } from "@graview/layout";
import { hueFor } from "../default-views.js";
import { Chip, Panel } from "../primitives/index.js";
import { useDrawnSize, useGraview, useTextMeasure, type ViewProps } from "@graview/react";
import { useMemo, useRef, useState, type MouseEvent, type ReactElement } from "react";

/**
 * THE MAP LENS: regions drawn where they are, with points inside them.
 *
 * A timeline places by time. A matrix places by two sets. A board places by
 * coordinates on its own nodes. This places by an OUTLINE — a closed shape
 * the domain gave a region — and that is a different picture from all three,
 * because the thing you recognise ground by is its shape and its neighbours,
 * not its position in a list.
 *
 * It knows nothing about grass. It knows there are regions, each with an
 * outline; that some of them nest inside others; that markers stand at a
 * point and belong to a region. A building's floor plan is rooms and
 * fixtures and reuses every line of this unchanged, which is the test in
 * `tests/lens-reuse.test.ts`.
 *
 * WHAT IT EXISTS TO SHOW is the same shape of thing the board's empty slot
 * shows: an absence. Ground somebody named and never drew is invisible on
 * every list ever written and obvious the moment you look at a map with a
 * hole in it — and a thing that stands nowhere is a record nobody can act
 * on, because "go and look at it" has no answer.
 */

export const PLAN_REQUIRED_ROLES = ["regions", "outline"] as const;

export interface PlanLensOptions {
  /** Kind whose nodes are regions, drawn as their outlines. */
  readonly regions: string;
  /** Field on a region holding its outline: `{ x, y }[]`, each 0..1. */
  readonly outline: string;
  /** Kind whose nodes are markers, drawn as points inside the regions. */
  readonly markers?: string;
  /** Field on a marker holding its point, `{ x, y }` 0..1. */
  readonly at?: string;
  /** Edge kind from a marker to the region it stands in. */
  readonly within?: string;
  /** Edge kind nesting one region inside another, child → parent. */
  readonly nests?: string;
  /**
   * Field naming what a region or marker IS — a surface, a room type, a
   * fixture type. Drives the hue, so the picture groups by category without
   * the lens ever learning what the categories mean.
   */
  readonly regionKind?: string;
  readonly markerKind?: string;
  /**
   * Hue in DEGREES per category value, when the domain has an opinion.
   *
   * A hash gives every category a stable colour and no meaning, which is
   * right for a lens that cannot know what the categories are — and wrong
   * the moment a domain does know. Grass drawn violet and tarmac drawn
   * green is a picture actively working against the reader. So the hue is
   * a binding like every other: the lens still knows nothing, and the app
   * says turf is green. Anything not named here still hashes.
   */
  readonly hues?: Readonly<Record<string, number>>;
  /** Width divided by height. A site is usually wider than it is deep. */
  readonly aspect?: number;
  /** What a region with no outline is called, in the app's own words. */
  readonly undrawnLabel?: string;
  /** What a marker standing nowhere is called. */
  readonly strayLabel?: string;
  /**
   * HOW TO DRAW, in the domain's own acts.
   *
   * The lens knows how to draw an outline from a click on the canvas per
   * corner; what it does not know is which act writes it. The domain says:
   * `draw` names the act and the argument that takes the region's id and
   * the one that takes the outline; `place` the same for a marker's point.
   * Without these the map is read-only, which is a legitimate lens too.
   */
  readonly draw?: { readonly act: string; readonly id: string; readonly outline: string };
  readonly place?: { readonly act: string; readonly id: string; readonly at: string };
  /**
   * Somewhere else that can draw what is undrawn — a desk, a model, an
   * import. Offered beside the drawing tools whenever there is something
   * left to draw, in the app's own words.
   */
  readonly help?: { readonly label: string; readonly href: string };
}

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface MappedMarker {
  readonly id: string;
  readonly label: string;
  readonly at: MapPoint;
  readonly what?: string;
}

export interface MappedRegion {
  readonly id: string;
  readonly label: string;
  readonly outline: readonly MapPoint[];
  /** Where a label sits. The polygon's own centroid, not its bounding box. */
  readonly centre: MapPoint;
  readonly what?: string;
  /** How deep this region is nested. Deeper draws later, so it draws on top. */
  readonly depth: number;
  readonly markers: readonly MappedMarker[];
}

export interface PlanLensState {
  /** Regions that can actually be drawn, parents before children. */
  readonly regions: readonly MappedRegion[];
  /** Named but never drawn. Half the reason the lens exists. */
  readonly undrawn: readonly { readonly id: string; readonly label: string }[];
  /** Markers with no point, or belonging to no region. The other half. */
  readonly strays: readonly { readonly id: string; readonly label: string }[];
}

/**
 * Fails LOUDLY and by name. A lens that renders empty when it has been
 * misbound costs an hour of looking at the data, and the data is fine.
 */
export class PlanBindingError extends Error {
  constructor(message: string, readonly hint: string) {
    super(`${message}\n  ${hint}`);
    this.name = "PlanBindingError";
  }
}

const HINT =
  'Check the lens bindings: { regions: "<kind>", outline: "<field>", markers?: "<kind>", at?: "<field>", within?: "<edge>" }';

const isPoint = (value: unknown): value is MapPoint =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as MapPoint).x === "number" &&
  typeof (value as MapPoint).y === "number";

/*
 * THE ARITHMETIC OF A NAME THAT FITS is the framework's now, in
 * `@graview/layout` — the scanline, the break at the middle, shrink before
 * cut, cut before lie, nothing rather than a stub. It was written here,
 * against a real survey, and every line of it turned out to be about
 * drawing rather than about grounds. What stays here is the part that IS
 * about grounds: which shapes, what they are called, and where the key goes.
 */

/**
 * Reads the map out of the graph. PURE and exported, so a test can assert
 * on what is missing from the picture rather than on the drawing of it —
 * and so a second domain can build it without rendering anything.
 */
export function buildPlanLens<S extends AnySchema>(
  nodes: readonly NodeOfSchema<S>[],
  edges: readonly { kind: string; from: string; to: string }[],
  options: PlanLensOptions,
  schema?: S,
): PlanLensState {
  const record = (node: NodeOfSchema<S>) => node as unknown as Record<string, unknown>;
  const name = (node: NodeOfSchema<S>) =>
    schema
      ? labelOf(schema.tryDefinition(node.kind), node as never)
      : String(record(node)["label"] ?? node.id);

  /*
   * AN EMPTY GRAPH IS NOT A MISBINDING. A blank installation has no ground
   * yet and the map's title is already in the bar, so throwing on "no
   * regions" would take the scene down at exactly the moment somebody went
   * looking for the empty picture. A kind nobody declared IS a misbinding,
   * and that is what is worth shouting about.
   */
  if (schema && schema.tryDefinition(options.regions) === undefined) {
    throw new PlanBindingError(`No kind is declared for "${options.regions}".`, HINT);
  }
  if (options.markers && schema && schema.tryDefinition(options.markers) === undefined) {
    throw new PlanBindingError(`No kind is declared for "${options.markers}".`, HINT);
  }
  const regionNodes = nodes.filter((node) => node.kind === options.regions);
  if (!schema && regionNodes.length === 0) {
    throw new PlanBindingError(`Nothing to draw: no "${options.regions}" nodes.`, HINT);
  }
  /*
   * IS THE FIELD DECLARED — asked of the SCHEMA, never of the nodes.
   *
   * The first version asked the nodes: "does any region carry the outline
   * field?" On the first real survey the answer was no — seven areas, none
   * drawn, because a model cannot give coordinates from photographs — and
   * the lens threw a binding error over a state that is not only legal but
   * the normal state of a property that has just been staked out. The
   * framework has no error boundary around a view, so one thrown lens
   * blacked out the whole scene. (docs/graview-feedback.md F-026.)
   *
   * Nothing drawn yet is what `undrawn` is for. A misbinding is a field the
   * kind does not HAVE, and only the declaration can say that.
   */
  const declared = schema?.tryDefinition(options.regions) as
    | { fields?: { shape?: Record<string, unknown> } }
    | undefined;
  const shape = declared?.fields?.shape;
  if (shape !== undefined && !(options.outline in shape)) {
    throw new PlanBindingError(
      `"${options.regions}" has no field called "${options.outline}".`,
      HINT,
    );
  }

  const depthOf = (() => {
    const parent = new Map<string, string>();
    if (options.nests) {
      for (const edge of edges) {
        if (edge.kind === options.nests) parent.set(edge.from, edge.to);
      }
    }
    return (id: string): number => {
      let depth = 0;
      let at = parent.get(id);
      // A cycle would spin forever; the region count is a hard ceiling on
      // how deep any honest nesting can be.
      const seen = new Set<string>([id]);
      while (at !== undefined && !seen.has(at) && depth < regionNodes.length) {
        seen.add(at);
        depth += 1;
        at = parent.get(at);
      }
      return depth;
    };
  })();

  const markerNodes = options.markers
    ? nodes.filter((node) => node.kind === options.markers)
    : [];
  const homeOf = new Map<string, string>();
  if (options.within) {
    for (const edge of edges) {
      if (edge.kind === options.within) homeOf.set(edge.from, edge.to);
    }
  }

  const strays: { id: string; label: string }[] = [];
  const markersByRegion = new Map<string, MappedMarker[]>();
  for (const node of markerNodes) {
    const at = options.at === undefined ? undefined : record(node)[options.at];
    const home = homeOf.get(node.id);
    if (!isPoint(at) || home === undefined) {
      // Recorded but not placeable. Said out loud rather than dropped: a
      // marker that vanishes from the picture is a record nobody can act on.
      strays.push({ id: node.id, label: name(node) });
      continue;
    }
    const what = options.markerKind === undefined ? undefined : record(node)[options.markerKind];
    const list = markersByRegion.get(home) ?? [];
    list.push({
      id: node.id,
      label: name(node),
      at,
      ...(typeof what === "string" ? { what } : {}),
    });
    markersByRegion.set(home, list);
  }

  const undrawn: { id: string; label: string }[] = [];
  const regions: MappedRegion[] = [];
  for (const node of regionNodes) {
    const outline = record(node)[options.outline];
    if (!Array.isArray(outline) || outline.length < 3 || !outline.every(isPoint)) {
      undrawn.push({ id: node.id, label: name(node) });
      continue;
    }
    const what = options.regionKind === undefined ? undefined : record(node)[options.regionKind];
    regions.push({
      id: node.id,
      label: name(node),
      outline,
      centre: centroidOf(outline),
      depth: depthOf(node.id),
      markers: markersByRegion.get(node.id) ?? [],
      ...(typeof what === "string" ? { what } : {}),
    });
  }
  // Parents before children, so nested ground draws on top of the ground it
  // is part of rather than under it.
  regions.sort((a, b) => a.depth - b.depth);

  return { regions, undrawn, strays };
}

/* ------------------------------------------------------------------ *
 * The drawing.
 * ------------------------------------------------------------------ */

/** The viewBox is in hundredths, so every number below reads as a percent. */
/**
 * THE SAME GROUND AS A LIST — what a map says when it cannot be drawn.
 *
 * A picture is not the only honest way to show ground, and below a certain
 * size it stops being one at all. This is what the summary fidelity draws,
 * and what the full one falls back to when the scene hands it a hundred and
 * thirty-six pixels: every area, what is standing in it, and what was named
 * and never drawn. Denser than the map, and at that size, more.
 */
function Roster({
  map,
  options,
  implicated,
  flagged,
}: {
  readonly map: PlanLensState;
  readonly options: PlanLensOptions;
  readonly implicated?: readonly string[];
  readonly flagged?: readonly string[];
}) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ".25rem" }}>
      {map.regions.map((region) => {
        const emphasis = emphasisOf(region.id, implicated, flagged);
        return (
          <li
            key={region.id}
            data-graview-pick={region.id}
            {...(emphasis ? { "data-graview-emphasis": emphasis } : {})}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: ".5rem",
              justifyContent: "space-between",
              minWidth: 0,
              padding: ".25rem .4rem",
              borderRadius: ".35rem",
              background: emphasis === "flagged" ? fillFor(region.what, emphasis, options.hues) : undefined,
            }}
          >
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{region.label}</span>
            <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>
              {region.what ? `${region.what} · ` : ""}
              {region.markers.length}
            </span>
          </li>
        );
      })}
      {map.undrawn.map((region) => (
        <li
          key={region.id}
          data-graview-pick={region.id}
          style={{ display: "flex", gap: ".5rem", opacity: 0.7, padding: ".25rem .4rem" }}
        >
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{region.label}</span>
          <span style={{ whiteSpace: "nowrap" }}>{options.undrawnLabel ?? "not drawn"}</span>
        </li>
      ))}
    </ul>
  );
}

const W = 1000;
/** A marker's hit radius, in canvas units. Twice the dot it draws. */
const HIT = 0.022;

type Emphasis = "implicated" | "flagged" | undefined;

/** A tool button: a control, never a pick target, and never under 24px. */
const TOOL = {
  minHeight: "1.9rem",
  padding: ".25rem .65rem",
  borderRadius: ".35rem",
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  font: "inherit",
  fontSize: ".82rem",
  cursor: "pointer",
} as const;

const emphasisOf = (
  id: string,
  implicated: readonly string[] | undefined,
  flagged: readonly string[] | undefined,
): Emphasis => {
  if (flagged?.includes(id)) return "flagged";
  if (implicated?.includes(id)) return "implicated";
  return undefined;
};

/** A hue for a category: the app's declared degrees, or the framework's stable hash (degrees since F-014). */
const degrees = (what: string | undefined, hues: PlanLensOptions["hues"]) => {
  const named = what === undefined ? undefined : hues?.[what];
  return named ?? hueFor(what ?? "region");
};

const fillFor = (what: string | undefined, emphasis: Emphasis, hues: PlanLensOptions["hues"]) =>
  emphasis === "flagged"
    ? "color-mix(in oklab, var(--graview-warn) 26%, var(--graview-panel))"
    : `color-mix(in oklab, hsl(${degrees(what, hues)} 52% 48%) 24%, var(--graview-panel))`;

const strokeFor = (what: string | undefined, emphasis: Emphasis, hues: PlanLensOptions["hues"]) =>
  emphasis === "flagged"
    ? "var(--graview-warn)"
    : `color-mix(in oklab, hsl(${degrees(what, hues)} 48% 42%) 78%, var(--graview-ink))`;

/** Where a click landed, 0..1 across and down the drawn site. */
function pointOf(event: MouseEvent<SVGSVGElement>): MapPoint {
  const box = event.currentTarget.getBoundingClientRect();
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
  return {
    x: clamp(box.width === 0 ? 0 : (event.clientX - box.left) / box.width),
    y: clamp(box.height === 0 ? 0 : (event.clientY - box.top) / box.height),
  };
}

type Drawing =
  | { readonly kind: "region"; readonly id: string; readonly label: string; readonly corners: readonly MapPoint[] }
  | { readonly kind: "marker"; readonly id: string; readonly label: string };

export interface PlanViewProps<S extends AnySchema> extends ViewProps<S> {
  readonly schema?: S;
  readonly options: PlanLensOptions;
}

export function PlanView<S extends AnySchema>({
  schema,
  options,
  nodes,
  label,
  fidelity,
  selected,
  implicated,
  flagged,
}: PlanViewProps<S>): ReactElement | null {
  const { store } = useGraview<S>();
  const edges = store.graph.allEdges() as readonly { kind: string; from: string; to: string }[];
  /*
   * REGIONS COME FROM THE GROUP; MARKERS CANNOT.
   *
   * Registered over the region kind's `many` cell, this view is handed
   * `nodes` — that kind's members, already filtered by the horizon. The
   * markers are a DIFFERENT kind, so they are never in that array, and
   * building from `nodes` alone drew every piece of ground with nothing
   * standing in it. Reading the whole graph and narrowing the regions back
   * to what the group gave keeps both: the scene's filtering, and the
   * things that stand on the filtered ground.
   */
  const everything = store.graph.allNodes() as readonly NodeOfSchema<S>[];
  const shown = nodes === undefined ? undefined : new Set(nodes.map((node) => node.id));
  const visible =
    shown === undefined
      ? everything
      : everything.filter((node) => node.kind !== options.regions || shown.has(node.id));
  const map = buildPlanLens<S>(visible, edges, options, schema);

  const drawn = map.regions.length;
  const things = map.regions.reduce((n, region) => n + region.markers.length, 0);

  /*
   * A CHIP. Standing in for the whole map at the smallest fidelity, the
   * useful thing to say is how much ground there is — and, when some of it
   * is not drawn, that there is ground this picture is not showing.
   */
  if (fidelity === "glyph") {
    return (
      <Chip
        label={`${label ?? "Ground"} · ${drawn}`}
        {...(map.undrawn.length > 0 ? { meta: `+${map.undrawn.length} undrawn` } : {})}
        selected={selected}
      />
    );
  }

  /*
   * A SUMMARY IS DENSER CONTENT, NOT THE PICTURE SCALED DOWN. A map at a
   * third of its size is a map with no legible labels, which answers
   * nothing; a roster of the same ground with what stands in it and what is
   * wrong with it answers several things in the same space.
   */
  if (fidelity === "summary") {
    return (
      <Panel title={label ?? "The plan"} subtitle={`${drawn} drawn · ${things} standing in them`}>
        <Roster map={map} options={options} {...(implicated ? { implicated } : {})} {...(flagged ? { flagged } : {})} />
      </Panel>
    );
  }

  const aspect = options.aspect ?? 1.45;
  const H = Math.round(W / aspect);
  const anyEmphasis = (implicated?.length ?? 0) > 0 || (flagged?.length ?? 0) > 0;

  /*
   * WHAT CAN BE WRITTEN ON THE PICTURE, worked out before any of it is
   * drawn — because whether a name fits decides whether the key below has
   * to say it, and a component cannot find that out while rendering.
   *
   * Regions first and markers into the gaps left over: a marker is a dot
   * with a name beside it, and the dot is the thing that carries the
   * meaning. A name that will not fit is dropped rather than overlapped,
   * which is the whole difference between a plan and a pile of words.
   */
  /*
   * WHETHER THIS IS A CONTROL SURFACE, A PICTURE, OR NEITHER.
   *
   * The framework asks this now — `useDrawnSize` — because it turned out
   * not to be a question about grounds. A drawing written in its own units
   * and handed whatever room the page has hides it: at THIS size, is what
   * I am drawing still a thing a person can read, or press? The scene lays
   * this panel out at 136 pixels on a phone, where the answer is no twice.
   */
  const canvas = useRef<SVGSVGElement>(null);
  const { touchable, legible: drawable } = useDrawnSize(canvas, { units: W, target: W * HIT * 2 });
  const display = useTextMeasure("--graview-font-display", "serif");
  const body = useTextMeasure("--graview-font-body", "sans-serif");

  const { named, placed, tagged } = useMemo(() => {
    const taken: LabelBox[] = [];
    /*
     * THE NAME GOES IN THE CORNER, NOT ACROSS THE MIDDLE.
     *
     * A name set large and centred looks like a title and behaves like a
     * wall: it owns the widest part of the shape, which is exactly where
     * the things standing in that shape are, so twenty-two markers had
     * nowhere to put their own names and went unlabelled. Every site plan
     * ever drawn does the opposite — the area is named quietly along its
     * top edge, and the middle is left for what is in it.
     */
    const inset = W * 0.012;
    const clear = (box: LabelBox) => !taken.some((other) => overlaps(box, other));

    /*
     * BIGGEST GROUND FIRST. Where two names cannot both be drawn, the one
     * that keeps its place should be the one with more room to keep it in —
     * and the one that loses goes to the key, which is a demotion a small
     * shape can afford and a large one cannot.
     */
    const byRoom = [...map.regions].sort((a, b) => areaOf(b.outline) - areaOf(a.outline));
    const named = new Map<string, FittedLabel | null>();
    const placed = new Map<string, { readonly x: number; readonly y: number }>();
    for (const region of byRoom) {
      const box = boxOf(region.outline);
      const height = Math.max(0, (box.bottom - box.top) * H * 0.55);
      /*
       * Down the inside of the top edge, looking for a line with room. Two
       * areas that overlap — which a survey produces more often than
       * anybody would like — have their top edges close together, and a
       * name drawn over another name belongs to neither of them.
       */
      let put: { fitted: FittedLabel; x: number; y: number } | null = null;
      for (const down of [0.1, 0.24, 0.4, 0.58, 0.76]) {
        const y = box.top + down * (box.bottom - box.top);
        const span = spanAt(region.outline, y);
        const room = Math.max(0, (span.x1 - span.x0) * W - inset * 2);
        const fitted = fitLabel(region.label, {
          room,
          height,
          size: W * 0.023,
          floor: W * 0.015,
          measure: display,
        });
        if (fitted === null) continue;
        const wide = Math.max(...fitted.lines.map((line) => display(line, fitted.fontSize)));
        const tall = fitted.lines.length * fitted.fontSize * 1.15;
        const x = span.x0 * W + inset;
        /*
         * OFF THE EDGE IT IS DRAWN ON. A short band's tenth-of-the-way-down
         * is a couple of pixels, so the first row of names came back with
         * the outline stroke ruled straight through them — a name on a
         * boundary reads as belonging to whichever side you looked at
         * first. Pushed down until the whole of it clears the edge, and
         * back up if that would push it out of the bottom.
         */
        const top = box.top * H + inset + tall / 2;
        const bottom = box.bottom * H - inset - tall / 2;
        const mid = bottom < top ? (box.top + box.bottom) * H / 2 : Math.min(Math.max(y * H, top), bottom);
        const candidate = { x0: x, y0: mid - tall / 2, x1: x + wide, y1: mid + tall / 2 };
        if (!clear(candidate)) continue;
        taken.push(candidate);
        put = { fitted, x, y: mid };
        break;
      }
      named.set(region.id, put?.fitted ?? null);
      if (put !== null) placed.set(region.id, { x: put.x, y: put.y });
    }

    /*
     * TWENTY-TWO COLOURED DOTS AND NO WORDS is not a map of anything. The
     * first survey drew exactly that, and every one of them was reachable,
     * announced and pickable — and unreadable, because knowing a thing is
     * THERE is not knowing what it is.
     *
     * A marker's name dodges everything already on the picture, including
     * the area names. Letting them overlap was tried and is worse than
     * silence: "Cedar ra…" under "Perimeter raised" reads as one damaged
     * sentence rather than as two things. What buys the room is the area
     * names moving out of the middle, above.
     */
    const size = W * 0.018;
    const tagged = new Map<string, { readonly at: MapPoint; readonly anchor: "start" | "end"; readonly size: number }>();
    /*
     * And none of them at all when the drawing is too small to press,
     * because it is then also too small to read: at phone width this canvas
     * lands in about a hundred and forty pixels, where an eighteen-unit
     * name renders at two and a half. Two-and-a-half-pixel words are not a
     * smaller version of the information; they are a texture. The key
     * carries every marker at that size, in rows a finger can hit.
     */
    for (const region of touchable ? map.regions : []) {
      for (const marker of region.markers) {
        const gap = W * 0.018;
        const wide = body(marker.label, size);
        const right = marker.at.x * W + gap;
        const anchor: "start" | "end" = right + wide <= W - 4 ? "start" : "end";
        const x0 = anchor === "start" ? right : marker.at.x * W - gap - wide;
        const y = marker.at.y * H;
        const box = { x0, y0: y - size * 0.62, x1: x0 + wide, y1: y + size * 0.62 };
        if (x0 < 4 || !clear(box)) continue;
        taken.push(box);
        tagged.set(marker.id, { at: { x: anchor === "start" ? right : marker.at.x * W - gap, y }, anchor, size });
      }
    }
    return { named, placed, tagged };
  }, [map.regions, W, H, touchable, display, body]);

  /** Everything the drawing could not say for itself, in the order it is drawn. */
  const unsaid = useMemo(() => {
    const out: { id: string; label: string; what: string | undefined; round: boolean }[] = [];
    for (const region of map.regions) {
      if ((named.get(region.id)?.whole ?? false) === false) {
        out.push({ id: region.id, label: region.label, what: region.what, round: false });
      }
    }
    for (const region of map.regions) {
      for (const marker of region.markers) {
        /* Everything, when the drawing is too small to be pressed: the key
           is then not a footnote about what would not fit, it is the only
           way to reach anything standing on the ground. */
        if (!touchable || !tagged.has(marker.id)) {
          out.push({ id: marker.id, label: marker.label, what: marker.what, round: true });
        }
      }
    }
    return out;
  }, [map.regions, named, tagged, touchable]);

  /*
   * STAKING OUT, ON THE MAP ITSELF.
   *
   * The vision's sentence was "dragging corners on a sketch", and the first
   * real survey — seven areas, none drawn — landed a person on an empty
   * rectangle with a paragraph of names under it. This is where drawing
   * belongs: choose an area, click its corners, done. Each finished outline
   * is the domain's own act through the store, authored by whoever is in
   * the seat, so it lands in the log and undoes like anything else.
   */
  const { principal } = useGraview<S>();
  const [drawing, setDrawing] = useState<Drawing | null>(null);


  const canDraw = options.draw !== undefined;
  const canPlace = options.place !== undefined;

  const onCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    if (drawing === null) return;
    // A click that is laying a corner must not also select or travel.
    event.stopPropagation();
    const point = pointOf(event);
    if (drawing.kind === "marker") {
      store.apply(
        { name: options.place!.act, args: { [options.place!.id]: drawing.id, [options.place!.at]: point } },
        { author: principal, intent: `Placed ${drawing.label} on the map` },
      );
      setDrawing(null);
      return;
    }
    setDrawing({ ...drawing, corners: [...drawing.corners, point] });
  };

  const finishRegion = () => {
    if (drawing === null || drawing.kind !== "region" || drawing.corners.length < 3) return;
    store.apply(
      {
        name: options.draw!.act,
        args: { [options.draw!.id]: drawing.id, [options.draw!.outline]: drawing.corners },
      },
      { author: principal, intent: `Drew ${drawing.label} on the map — ${drawing.corners.length} corners` },
    );
    setDrawing(null);
  };

  const hint =
    drawing === null
      ? map.regions.length === 0
        ? "Nothing drawn yet. Choose an area below, then click its corners here."
        : null
      : drawing.kind === "marker"
        ? `Click where ${drawing.label} stands.`
        : drawing.corners.length < 3
          ? `Click the corners of ${drawing.label} — ${3 - drawing.corners.length} more to make an area.`
          : `${drawing.corners.length} corners. Keep clicking, or press Done.`;

  if (!drawable) {
    return (
      <Panel
        title={label ?? "The plan"}
        subtitle={`${drawn} drawn · ${things} standing in them`}
        selected={selected}
      >
        <Roster map={map} options={options} {...(implicated ? { implicated } : {})} {...(flagged ? { flagged } : {})} />
      </Panel>
    );
  }

  return (
    <Panel
      title={label ?? "The plan"}
      subtitle={`${drawn} drawn · ${things} standing in them`}
      {...(map.undrawn.length > 0
        ? { meta: `${map.undrawn.length} ${options.undrawnLabel ?? "not drawn yet"}` }
        : {})}
      selected={selected}
      fit
    >
      {/*
        * A BOX THAT OWNS THE SHAPE, and a canvas that fills it.
        *
        * `width="100%"` with `height:auto` is the usual way to make an
        * SVG responsive and it depends on the parent agreeing. At phone
        * width the scene lays this panel out at 136 pixels and something
        * in that chain resolved the canvas to 138 by TWO — at which point
        * the drawing did not scale down, it OVERFLOWED: a thousand units
        * of ground painted across the page, region names ending nine
        * hundred pixels past the right edge of a 390-pixel screen,
        * invisible because they sat behind everything else and caught
        * only because a harness measures where text actually lands.
        *
        * So the aspect ratio lives on a plain block that nothing argues
        * with, and the canvas is pinned to its inside.
        */}
      <div style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}`, overflow: "hidden" }}>
      <svg
        ref={canvas}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        /*
         * A DRAWING WHOSE PARTS ARE CONTROLS IS NOT AN IMAGE.
         *
         * `role="img"` is a leaf: it promises a screen reader that what
         * is inside is decoration described by the label, so a focusable
         * shape in there is a control the reader has been told is not
         * there. axe calls it nested-interactive and it is right. Every
         * area here is a button, so this is a group — and an image only
         * when the picture is too small to have given anything a target,
         * which is exactly when it IS decoration.
         */
        role={drawing !== null ? "application" : touchable ? "group" : "img"}
        aria-label={
          drawing === null
            ? `${label ?? "The plan"}: ${drawn} drawn, ${things} standing in them`
            : hint ?? "Drawing"
        }
        onClick={onCanvasClick}
        data-testid="plan-canvas"
        style={{
          display: "block",
          position: "absolute",
          inset: 0,
          /*
           * THE PICTURE STAYS INSIDE ITS BOX.
           *
           * At phone width the scene lays this panel out at 136 pixels and
           * something in that chain resolved the canvas to 138 by TWO — at
           * which point the drawing did not scale down, it OVERFLOWED: a
           * thousand units of ground painted across the page, region names
           * ending nine hundred pixels past the right edge of a 390-pixel
           * screen, invisible because they sat behind everything else and
           * caught only because a harness measures where text actually
           * lands. `aspect-ratio` makes the height follow the width even
           * where a flex parent would rather it did not, and `overflow`
           * makes the escape impossible rather than unlikely.
           */
          cursor: drawing === null ? undefined : "crosshair",
          // A dashed edge and a faint grid: a sheet to draw on, not a void.
          border: `1px dashed color-mix(in oklab, var(--graview-edge) 80%, transparent)`,
          borderRadius: ".4rem",
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--graview-edge) 35%, transparent) 1px, transparent 1px)," +
            "linear-gradient(90deg, color-mix(in oklab, var(--graview-edge) 35%, transparent) 1px, transparent 1px)",
          backgroundSize: "10% 10%",
        }}
      >
        {/* North, so the drawing has an orientation somebody can agree on. */}
        <text x={W - 28} y={34} fontSize={W * 0.022} textAnchor="middle" fill="var(--graview-ink)" opacity={0.55}>
          N
        </text>
        {/* Centre-canvas only while the canvas is empty; over a drawn site
            the same words go in the tool row rather than across the labels. */}
        {hint !== null && map.regions.length === 0 ? (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={W * 0.026}
            fill="var(--graview-ink)"
            opacity={0.7}
            style={{ pointerEvents: "none", fontFamily: "var(--graview-font-body)" }}
          >
            {hint}
          </text>
        ) : null}
        {drawing !== null && drawing.kind === "region" && drawing.corners.length > 0 ? (
          <g style={{ pointerEvents: "none" }}>
            <polyline
              points={drawing.corners.map((p) => `${p.x * W},${p.y * H}`).join(" ")}
              fill={drawing.corners.length >= 3 ? "color-mix(in oklab, var(--graview-accent) 22%, transparent)" : "none"}
              stroke="var(--graview-accent)"
              strokeWidth={3}
              strokeDasharray="8 6"
            />
            {drawing.corners.map((p, index) => (
              <circle key={index} cx={p.x * W} cy={p.y * H} r={7} fill="var(--graview-accent)" />
            ))}
          </g>
        ) : null}
        {map.regions.map((region) => {
          const emphasis = emphasisOf(region.id, implicated, flagged);
          const dim = anyEmphasis && emphasis === undefined ? 0.34 : 1;
          const points = region.outline.map((p) => `${p.x * W},${p.y * H}`).join(" ");
          return (
            <g
              key={region.id}
              data-graview-pick={region.id}
              {...(emphasis ? { "data-graview-emphasis": emphasis } : {})}
              /*
               * The host's `usePickTargets` gives every pick target a tab
               * stop, but it only grants `role="button"` to a closed set of
               * generic HTML tags — no SVG element is on it. So an SVG
               * target would be focusable and announced as nothing at all.
               * Saying it here is the fix; the host leaves an attribute
               * alone once it is set. (docs/graview-feedback.md F-013.)
               */
              role="button"
              aria-label={`${region.label}${region.what ? `, ${region.what}` : ""}, ${region.markers.length} standing in it`}
              style={{ opacity: dim, cursor: "pointer" }}
            >
              <polygon
                points={points}
                fill={fillFor(region.what, emphasis, options.hues)}
                stroke={strokeFor(region.what, emphasis, options.hues)}
                strokeWidth={emphasis === "flagged" ? 5 : 2.5}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {map.regions.flatMap((region) =>
          region.markers.map((marker) => {
            const emphasis = emphasisOf(marker.id, implicated, flagged);
            const dim = anyEmphasis && emphasis === undefined ? 0.34 : 1;
            return (
              <g
                key={marker.id}
                {...(touchable
                  ? {
                      "data-graview-pick": marker.id,
                      role: "button",
                      "aria-label": `${marker.label}${marker.what ? `, ${marker.what}` : ""}, in ${region.label}`,
                    }
                  : { "aria-hidden": true })}
                {...(emphasis ? { "data-graview-emphasis": emphasis } : {})}
                style={{ opacity: dim, cursor: touchable ? "pointer" : "default" }}
              >
                {/* Transparent, and twice the dot: the thing a finger has to
                    land on is bigger than the thing an eye has to see. */}
                {touchable ? (
                  <circle cx={marker.at.x * W} cy={marker.at.y * H} r={W * HIT} fill="transparent" />
                ) : null}
                <circle
                  cx={marker.at.x * W}
                  cy={marker.at.y * H}
                  r={W * 0.011}
                  fill={
                    emphasis === "flagged"
                      ? "var(--graview-warn)"
                      : `hsl(${degrees(marker.what, options.hues)} 55% 45%)`
                  }
                  stroke="var(--graview-panel)"
                  strokeWidth={W * 0.004}
                />
                {tagged.has(marker.id) ? (
                  <text
                    x={tagged.get(marker.id)!.at.x}
                    y={tagged.get(marker.id)!.at.y}
                    textAnchor={tagged.get(marker.id)!.anchor}
                    dominantBaseline="middle"
                    fontSize={tagged.get(marker.id)!.size}
                    fill="var(--graview-ink)"
                    stroke="var(--graview-panel)"
                    strokeWidth={Math.max(2, tagged.get(marker.id)!.size * 0.3)}
                    paintOrder="stroke"
                    data-testid={`marker-label-${marker.id}`}
                    style={{ pointerEvents: "none", fontFamily: "var(--graview-font-body)" }}
                  >
                    {marker.label}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}
        {/*
          * THE NAMES, LAST — so nothing can take the first letter off one.
          *
          * They were drawn inside each region's own group, which put every
          * later region and all twenty-two markers on top of them: the
          * picture came back reading "rick patio with gravel joints" and
          * "louse elevation", with a coloured dot sitting exactly where the
          * B and the H should have been. A name is the one thing on this
          * drawing that must survive everything else, so it is painted
          * after everything else.
          */}
        {map.regions.map((region) => {
          const fitted = named.get(region.id);
          const at = placed.get(region.id);
          if (!fitted || at === undefined) return null;
          const emphasis = emphasisOf(region.id, implicated, flagged);
          return (
            <text
              key={`label-${region.id}`}
              x={at.x}
              y={at.y - ((fitted.lines.length - 1) * fitted.fontSize * 1.15) / 2}
              textAnchor="start"
              dominantBaseline="middle"
              fontSize={fitted.fontSize}
              fill="var(--graview-ink)"
              opacity={anyEmphasis && emphasis === undefined ? 0.34 : 1}
              /* Painted stroke-first so a label stays legible wherever it
                 lands — over a dark fill, over a neighbour's edge, over
                 another label. Without it the name of the ground is the
                 first thing the picture loses. */
              stroke="var(--graview-panel)"
              strokeWidth={Math.max(2, fitted.fontSize * 0.26)}
              paintOrder="stroke"
              data-testid={`region-label-${region.id}`}
              style={{ pointerEvents: "none", fontFamily: "var(--graview-font-display)" }}
            >
              {fitted.lines.map((line, index) => (
                <tspan key={line + String(index)} x={at.x} dy={index === 0 ? 0 : fitted.fontSize * 1.15}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      </div>
      {/*
        * SAID, NOT HIDDEN. Ground nobody drew and things standing nowhere
        * are the two absences this picture exists to surface, and a map that
        * silently omits them is a map that lies by being tidy. They are NOT
        * given pick targets here: the summary list above already reaches
        * every region, and a second tab stop for the same node puts extra
        * stops between a keyboard user and the rest of the page.
        */}
      {/*
        * THE KEY — for whatever the picture could not say itself.
        *
        * A map that truncates a name has not lost it, so long as something
        * under the picture still says it in full; a map that truncates a
        * name and says nothing has renamed somebody's ground. And a dense
        * corner where three things stand within a few pixels of each other
        * will always have markers that could not be named without writing
        * over their neighbours — so those are here too, by the colour they
        * were drawn in.
        *
        * Only those. A key repeating seven names already legible on the
        * shapes is furniture, and it is the first thing a person stops
        * reading.
        */}
      {unsaid.length > 0 ? (
        <ul
          data-testid="map-key"
          style={{
            margin: ".5rem 0 0",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexWrap: "wrap",
            gap: ".2rem .75rem",
            fontSize: ".78rem",
          }}
        >
          {unsaid.map((one) => (
            <li
              key={one.id}
              data-graview-pick={one.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: ".35rem",
                minWidth: 0,
                /* A row in the key is a real target, because for a marker
                   on a small screen it is the only one there is. */
                minHeight: "max(1.5rem, 24px)",
                padding: "0 .15rem",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: one.round ? ".55rem" : ".7rem",
                  height: one.round ? ".55rem" : ".7rem",
                  flex: "0 0 auto",
                  borderRadius: one.round ? "50%" : ".15rem",
                  background: one.round
                    ? `hsl(${degrees(one.what, options.hues)} 55% 45%)`
                    : fillFor(one.what, undefined, options.hues),
                  border: one.round ? undefined : `1px solid ${strokeFor(one.what, undefined, options.hues)}`,
                }}
              />
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{one.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {/*
        * THE TOOLS. What is not drawn is a list of things to draw, one press
        * each; what is not placed is a list of things to place. These are
        * controls rather than pick targets — pressing "Draw the Back Lawn"
        * starts drawing it, and does not travel to it.
        */}
      {drawing !== null ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".5rem", alignItems: "center" }}>
          {map.regions.length > 0 && hint !== null ? (
            <span style={{ fontSize: ".82rem", opacity: 0.8, flexBasis: "100%" }} aria-live="polite">
              {hint}
            </span>
          ) : null}
          {drawing.kind === "region" ? (
            <button
              type="button"
              onClick={finishRegion}
              disabled={drawing.corners.length < 3}
              data-testid="draw-done"
              style={{ ...TOOL, background: "var(--graview-accent)", color: "var(--graview-accent-ink)", borderColor: "transparent" }}
            >
              Done — keep {drawing.label}
            </button>
          ) : null}
          {drawing.kind === "region" && drawing.corners.length > 0 ? (
            <button
              type="button"
              onClick={() => setDrawing({ ...drawing, corners: drawing.corners.slice(0, -1) })}
              style={TOOL}
            >
              Undo a corner
            </button>
          ) : null}
          <button type="button" onClick={() => setDrawing(null)} style={TOOL} data-testid="draw-cancel">
            Stop
          </button>
        </div>
      ) : (
        <>
          {canDraw && map.undrawn.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: ".5rem", alignItems: "center" }}>
              <span style={{ fontSize: ".8rem", opacity: 0.75 }}>{options.undrawnLabel ?? "Not drawn yet"}:</span>
              {map.undrawn.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  style={TOOL}
                  onClick={() => setDrawing({ kind: "region", id: region.id, label: region.label, corners: [] })}
                  data-testid={`draw-${region.id}`}
                >
                  Draw {region.label}
                </button>
              ))}
            </div>
          ) : null}
          {canPlace && map.strays.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: ".5rem", alignItems: "center" }}>
              <span style={{ fontSize: ".8rem", opacity: 0.75 }}>{options.strayLabel ?? "Not placed"}:</span>
              {map.strays.map((stray) => (
                <button
                  key={stray.id}
                  type="button"
                  style={TOOL}
                  onClick={() => setDrawing({ kind: "marker", id: stray.id, label: stray.label })}
                  data-testid={`place-${stray.id}`}
                >
                  Place {stray.label}
                </button>
              ))}
            </div>
          ) : null}
          {options.help !== undefined && (map.undrawn.length > 0 || map.strays.length > 0) ? (
            <p style={{ margin: ".5rem 0 0", fontSize: ".8rem" }}>
              <a href={options.help.href} data-testid="map-help">
                {options.help.label}
              </a>
            </p>
          ) : null}
          {!canDraw && (map.undrawn.length > 0 || map.strays.length > 0) ? (
            <p style={{ margin: ".5rem 0 0", fontSize: ".8rem", opacity: 0.75 }}>
              {map.undrawn.map((r) => r.label).join(", ")}
              {map.undrawn.length > 0 ? ` — ${options.undrawnLabel ?? "not drawn yet"}. ` : ""}
              {map.strays.map((s) => s.label).join(", ")}
              {map.strays.length > 0 ? ` — ${options.strayLabel ?? "not placed"}.` : ""}
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

export interface PlanLens<S extends AnySchema> {
  readonly name: "plan";
  readonly requiredRoles: readonly string[];
  readonly options: PlanLensOptions;
  View(props: ViewProps<S>): ReactElement | null;
  build(
    nodes: readonly NodeOfSchema<S>[],
    edges: readonly { kind: string; from: string; to: string }[],
    schema?: S,
  ): PlanLensState;
}

export function createPlanLens<S extends AnySchema>(
  options: PlanLensOptions,
): PlanLens<S> {
  // A real component, not a method that calls hooks — the same reason the
  // framework's own board lens is written this way.
  function Bound(props: ViewProps<S>) {
    // The schema comes from the provider: `ViewProps` carries none, and
    // without it every schema-aware decision quietly takes its fallback.
    const { store } = useGraview<S>();
    return <PlanView<S> schema={store.schema} {...props} options={options} />;
  }

  return {
    name: "plan",
    requiredRoles: [...PLAN_REQUIRED_ROLES],
    options,
    View: Bound,
    build(nodes, edges, schema) {
      return buildPlanLens<S>(nodes, edges, options, schema);
    },
  };
}
