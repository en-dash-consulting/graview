import { NOTION_INFERABLE } from "../sync/notion-types.js";

/*
 * THE FIELDS ANOTHER SYSTEM KEEPS IN STEP, by kind: what a document's
 * connections map, read loosely (a page that draws an app never runs a
 * connection, so this reads the declaration's plain shape and nothing that
 * judges it — `connection-findings.ts` does that). The compile writes them
 * on the kind's plan, and the compiled kind carries them as `keptInStep`, so
 * its derived edit writes them even where another act does: a change in
 * Notion or a calendar lands through `edit-<kind>`.
 */

type Loose = { readonly system?: unknown; readonly kind?: unknown; readonly fields?: unknown; readonly properties?: unknown };

/** Kind → the fields of it a declared connection maps, in the kind's own order. */
export function fieldsKeptInStep(connections: unknown, kinds: Readonly<Record<string, { readonly fields: Readonly<Record<string, { readonly type: string }>> }>>): ReadonlyMap<string, readonly string[]> {
  const kept = new Map<string, Set<string>>();
  if (!connections || typeof connections !== "object") return new Map();
  // A Notion connection of several data sources is read as one per source, each with its kind and properties.
  const each = Object.values(connections as Record<string, Loose & { readonly sources?: unknown }>).flatMap((raw): Loose[] =>
    raw && typeof raw === "object" && raw.system === "notion" && Array.isArray(raw.sources) ? (raw.sources as Loose[]).filter((one) => one && typeof one === "object").map((one) => ({ system: "notion", kind: one.kind, properties: one.properties })) : [raw],
  );
  for (const raw of each) {
    if (!raw || typeof raw !== "object" || typeof raw.kind !== "string") continue;
    const fields = kinds[raw.kind]?.fields;
    if (!fields) continue;
    let mapped: string[] = [];
    if (raw.system === "google-calendar" && raw.fields && typeof raw.fields === "object") {
      mapped = Object.values(raw.fields as Record<string, unknown>).filter((field): field is string => typeof field === "string");
    } else if (raw.system === "notion") {
      mapped = raw.properties && typeof raw.properties === "object" ? Object.keys(raw.properties) : Object.keys(fields).filter((field) => NOTION_INFERABLE.has(fields[field]!.type));
    }
    const set = kept.get(raw.kind) ?? new Set<string>();
    for (const field of mapped) if (Object.hasOwn(fields, field)) set.add(field);
    kept.set(raw.kind, set);
  }
  return new Map([...kept].filter(([, set]) => set.size > 0).map(([kind, set]) => [kind, Object.keys(kinds[kind]!.fields).filter((field) => set.has(field))]));
}

