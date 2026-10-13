import { edgeWords } from "@graview/core";

/*
 * A CHOSEN RECORD'S OWN LINKS, AND NOTHING ELSE.
 *
 * Choosing a record from altitude used to light every line its district's
 * relations drew — double tracks, dotted lines and curved red ones at once,
 * across districts, labels and the lens standing on its plot — and none of
 * them said which relation it was, which way it ran or how many it stood
 * for. This decides, without a browser, which lines a chosen record gets:
 * one per link that reaches a record the map draws on its own (a building,
 * a chip), each in the words of the kind it is read from; and one per
 * relation into a district for the links whose records the map does not
 * draw one by one, saying how many.
 */

export interface LinkOfRecord {
  /** The chosen record this line leaves. */
  readonly self: string;
  /** The relation, by edge kind. */
  readonly edge: string;
  /** Which way the relation reads from the chosen record. */
  readonly direction: "out" | "in";
  /** The kind the far end belongs to. */
  readonly kind: string;
  /** The far records it stands for: one when it lands on the record, several when it lands on their district. */
  readonly others: readonly string[];
  /** Whether the far end is the record itself, or the district standing in for the records it holds. */
  readonly lands: "record" | "district";
  /** The relation in the words of the chosen record's kind. */
  readonly words: string;
}

/** The most lines into one district for one relation before they are said as one, with a count. */
export const LINKS_TO_EACH = 6;

/**
 * The lines a chosen record draws. `drawn(id)` answers whether the map draws
 * that record on its own (a building or a chip); a record it does not is
 * reached through its district. A relation reaching more than
 * `LINKS_TO_EACH` records in one district is one line into the district,
 * whose count says how many — six rays into one village say that, and
 * forty-six say nothing.
 */
export function linksOfRecords(
  records: readonly string[],
  edges: Iterable<{ readonly kind: string; readonly from: string; readonly to: string }>,
  kindOf: (id: string) => string | undefined,
  drawn: (id: string) => boolean,
  schema: { tryDefinition(kind: string): { readonly edges?: unknown } | undefined },
): LinkOfRecord[] {
  const chosen = new Set(records);
  const groups = new Map<string, { self: string; edge: string; direction: "out" | "in"; kind: string; others: string[] }>();
  for (const edge of edges) {
    for (const [self, other, direction] of [
      [edge.from, edge.to, "out"],
      [edge.to, edge.from, "in"],
    ] as const) {
      if (!chosen.has(self) || chosen.has(other)) continue;
      const kind = kindOf(other);
      if (kind === undefined) continue;
      const key = `${self}|${edge.kind}|${direction}|${kind}`;
      const held = groups.get(key);
      if (held) {
        if (!held.others.includes(other)) held.others.push(other);
      } else groups.set(key, { self, edge: edge.kind, direction, kind, others: [other] });
    }
  }
  const out: LinkOfRecord[] = [];
  for (const group of groups.values()) {
    const selfKind = kindOf(group.self) ?? "";
    const words = edgeWords(schema, group.direction === "out" ? selfKind : group.kind, group.edge, group.direction);
    const own = group.others.filter(drawn);
    const rest = group.others.filter((id) => !drawn(id));
    if (group.others.length > LINKS_TO_EACH) {
      out.push({ ...group, others: group.others, lands: "district", words });
      continue;
    }
    for (const other of own) out.push({ ...group, others: [other], lands: "record", words });
    if (rest.length > 0) out.push({ ...group, others: rest, lands: "district", words });
  }
  return out;
}

/**
 * WHERE THE WORDS GO: each label at its line's far end, moved down past any
 * label already placed there — a few labels at one district are a short
 * column, not a pile. Boxes are in stage pixels.
 */
export function placeLabels(
  labels: readonly { readonly key: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }[],
  /** What is already said where a label must not go: the districts' own names. */
  taken: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[] = [],
): Map<string, { x: number; y: number }> {
  const placed: { x: number; y: number; width: number; height: number }[] = [...taken];
  const at = new Map<string, { x: number; y: number }>();
  const clash = (box: { x: number; y: number; width: number; height: number }) =>
    placed.some((other) => box.x < other.x + other.width && other.x < box.x + box.width && box.y < other.y + other.height && other.y < box.y + box.height);
  for (const label of [...labels].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const box = { x: label.x - label.width / 2, y: label.y - label.height, width: label.width, height: label.height };
    for (let tries = 0; tries < 12 && clash(box); tries++) box.y += label.height + 2;
    placed.push(box);
    at.set(label.key, { x: box.x, y: box.y });
  }
  return at;
}
