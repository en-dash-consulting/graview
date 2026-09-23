import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import { centroidOf } from "@graview/layout";

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
  const record = (node: NodeOfSchema<S>) => node as Record<string, unknown>;
  const name = (node: NodeOfSchema<S>) =>
    schema
      ? labelOf(schema.tryDefinition(node.kind), node)
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
