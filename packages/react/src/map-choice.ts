import { counted, type AnySchema } from "@graview/core";
import { edgeWords } from "@graview/core/words";

/*
 * WHAT THE MAP IS ASKED, AND WHAT ITS RELATIONS ARE — without the map.
 *
 * The scene draws ribbons and a chosen record's links from these; the side
 * panel beside the map lists the same relations and the same links. Here
 * rather than with the drawing, so the panel reaches them without reaching
 * the city's geometry.
 */

/** One relation between two kinds, as the graph holds it right now. */
export interface Ribbon {
  /** `edge|from|to`: stable across renders while the relation exists. */
  readonly key: string;
  readonly edge: string;
  readonly from: string;
  readonly to: string;
  /** How many links run along it. */
  readonly links: number;
  /** How many records of `from` reach along it, and how many of `to` are reached. */
  readonly fromCount: number;
  readonly toCount: number;
}

/**
 * The relations between kinds, counted from the links the graph holds. A
 * declared relation nobody has made yet has no ribbon: the map draws what is
 * there, and the Key lists what may be.
 */
export function ribbonsOf(edges: Iterable<{ readonly kind: string; readonly from: string; readonly to: string }>, kindOf: (id: string) => string | undefined): Ribbon[] {
  const found = new Map<string, { edge: string; from: string; to: string; links: number; froms: Set<string>; tos: Set<string> }>();
  for (const edge of edges) {
    const from = kindOf(edge.from);
    const to = kindOf(edge.to);
    if (from === undefined || to === undefined) continue;
    const key = `${edge.kind}|${from}|${to}`;
    let held = found.get(key);
    if (!held) found.set(key, (held = { edge: edge.kind, from, to, links: 0, froms: new Set(), tos: new Set() }));
    held.links += 1;
    held.froms.add(edge.from);
    held.tos.add(edge.to);
  }
  return [...found.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, held]) => ({ key, edge: held.edge, from: held.from, to: held.to, links: held.links, fromCount: held.froms.size, toCount: held.tos.size }));
}

/**
 * WHAT IS CHOSEN, AS THE MAP READS IT: districts (a kind's card or its
 * group), records, or nothing — and a lens open beside the map. One answer
 * for the ribbons, the record's links and the side panel, so the three never
 * disagree about what a press meant.
 */
export interface MapChoice {
  /** Kinds whose district is chosen. */
  readonly districts: readonly string[];
  /** Records chosen, in the order they were. */
  readonly records: readonly string[];
  /** The kind whose lens stands open beside the map, if one does. */
  readonly lens: string | null;
}

export function mapChoice(
  selection: readonly string[],
  view: { readonly overview?: boolean | undefined; readonly focusId: string | null },
  kindOf: (id: string) => string | undefined,
): MapChoice {
  const districts: string[] = [];
  const records: string[] = [];
  for (const id of selection) {
    const district = districtOf(id);
    if (district !== null) {
      if (!districts.includes(district)) districts.push(district);
      continue;
    }
    if (kindOf(id) !== undefined) records.push(id);
  }
  const lens = view.overview && view.focusId !== null ? districtOf(view.focusId) : null;
  return { districts, records, lens };
}

/** The kind a district id names — its card (`kind:x`) or its group (`aggregate:x`) — or null for anything else. */
export function districtOf(id: string): string | null {
  if (id.startsWith("kind:")) return id.slice(5) || null;
  if (id.startsWith("aggregate:") && !id.includes("|")) return id.slice(10) || null;
  return null;
}


/**
 * A RIBBON IN WORDS: how many of one kind reach how many of the other, and
 * the relation in the words of the kind it leaves — "146 features → 14
 * areas, the part it lives in". Where the declaration has no words, the
 * relation's own name, humanized.
 */
export function ribbonSentence(schema: AnySchema, ribbon: Ribbon): string {
  const words = edgeWords(schema, ribbon.from, ribbon.edge, "out");
  const own = ribbon.from === ribbon.to ? " of their own" : "";
  return `${counted(schema, ribbon.from, ribbon.fromCount)} → ${counted(schema, ribbon.to, ribbon.toCount)}${own}, ${words}`;
}
