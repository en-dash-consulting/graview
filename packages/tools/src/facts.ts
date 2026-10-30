import { humanizeField, labelOf, type AnySchema, type Principal, type Store } from "@graview/core";

/**
 * WHAT IS TRUE OF THE RECORDS, AS THE SEAT SEES THEM (Roadmap
 * f-menu-type-anything). An open answer is only as true as what the model
 * was told: "who is on this?" said nobody covered Monday open up while Ada
 * did, because the model was told the shift's name and nothing it links.
 * Each record the words are about is told with its fields and its links,
 * each said as "covered by Ada Nowak" or "held by This week" — read from
 * the store as this person sees it, so nothing they may not see is said.
 */
export interface RecordFacts {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly links: readonly string[];
}

/** The records' fields and links, as the person sees them, at most `limit` records and 12 links each. */
export function factsOf<S extends AnySchema>(store: Store<S>, principal: Principal, ids: readonly string[], today?: string, limit = 40): readonly RecordFacts[] {
  const seen = store.seenBy(principal).graph;
  const schema = store.schema as AnySchema;
  const name = (id: string) => {
    const node = seen.getNode(id);
    return node ? labelOf(schema.tryDefinition(node.kind), node as never) : undefined;
  };
  return ids.slice(0, limit).flatMap((id) => {
    const node = seen.getNode(id) as (Record<string, unknown> & { id: string; kind: string }) | undefined;
    if (!node) return [];
    const fields = Object.fromEntries(
      Object.entries(node)
        .filter(([key, value]) => !["id", "kind", "label"].includes(key) && !key.startsWith("_") && value !== undefined && value !== null && (typeof value !== "object" || Array.isArray(value)) && JSON.stringify(value).length <= 200)
        // A day said against today, as code reckons it: a light model's date arithmetic is not to be trusted.
        .map(([key, value]) => [key, typeof value === "string" && today ? relativeDay(value, today) : value]),
    );
    const links = [
      ...seen.outEdges(id).flatMap((edge) => {
        const other = name(edge.to);
        return other ? [`${humanizeField(edge.kind).toLowerCase()} ${other}`] : [];
      }),
      ...seen.inEdges(id).flatMap((edge) => {
        const other = name(edge.from);
        return other ? [`${humanizeField(edge.kind).toLowerCase()} it: ${other}`] : [];
      }),
    ].slice(0, 12);
    return [{ id, kind: node.kind, label: name(id) ?? id, fields, links }];
  });
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-08-28" → "2026-08-28, Friday, 4 days ago, already past"; anything not a day, as it was. */
export function relativeDay(value: string, today: string): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  const now = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today.slice(0, 10));
  if (!day || !now || value.length !== 10) return value;
  const at = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  const from = Date.UTC(Number(now[1]), Number(now[2]) - 1, Number(now[3]));
  const apart = Math.round((at - from) / 86_400_000);
  const said = apart === 0 ? "today" : apart === 1 ? "tomorrow" : apart === -1 ? "yesterday, already past" : apart > 0 ? `in ${apart} days` : `${-apart} days ago, already past`;
  return `${value}, ${DAYS[new Date(at).getUTCDay()]}, ${said}`;
}

/** Today as a model is told it: the day, its name. */
export function todayWords(today: string): string {
  return relativeDay(today, today).replace(/, today$/, "");
}
