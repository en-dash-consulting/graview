import { humanizeField } from "./define-node.js";
import type { AnyNodeDefinition } from "./types.js";

/*
 * A VALUE AND A RELATION IN THE DECLARATION'S WORDS, apart from
 * `define-node.ts` because only what is fetched says them — a filter, a
 * relation's key, the inspector, the seat, an import's mapping — and a file
 * the page's first chunk reaches is in that chunk whenever any chunk uses it
 * (the headroom after 0.1.29). On `@graview/core/words`.
 */

/**
 * One of a field's values, as the declaration says it: its `display.format`
 * where it has one ("SUV", "Plug-in hybrid"), else the value spoken. A
 * filter that offered "suv" and "plug-in-hybrid" beside a record that said
 * "SUV" and "Plug-in hybrid" read one field two ways.
 */
export function valueWords(definition: AnyNodeDefinition | undefined, key: string, value: unknown): string {
  const format = definition?.display?.format?.[key];
  return format ? format(value) : typeof value === "string" ? humanizeField(value) : String(value);
}

/**
 * A RELATION IN WORDS, read from the end you are standing on (FR-142): from
 * the kind that declares it, its `description`; from the far end, its
 * `inverse`. Where the declaration says nothing, the key is spoken —
 * "partOf" is "part of", never `partOf` — so a sentence a person reads never
 * carries a key, whichever surface wrote it.
 */
export function edgeWords(
  schema: { tryDefinition(kind: string): { readonly edges?: unknown } | undefined },
  ownerKind: string,
  edgeKind: string,
  direction: "out" | "in",
): string {
  const edges = schema.tryDefinition(ownerKind)?.edges as Readonly<Record<string, { readonly description?: string; readonly inverse?: string }>> | undefined;
  const declared = edges && Object.hasOwn(edges, edgeKind) ? edges[edgeKind] : undefined;
  const said = direction === "out" ? declared?.description : declared?.inverse;
  return said ?? humanizeField(edgeKind).toLowerCase();
}
