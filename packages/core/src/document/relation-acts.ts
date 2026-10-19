import { relationActName, relationActOf, type RelationActName } from "../mutations/derived-names.js";
import { localEdges } from "../schema/linked.js";

type Kinds = Readonly<Record<string, { readonly edges?: Readonly<Record<string, { readonly to: readonly string[] | "*"; readonly appendOnly?: boolean | undefined }>> | undefined }>>;

/** Each kind and the relations it declares to a kind of this document: what is given a connect and a disconnect (a relation to another app's kind is a field). */
export const documentRelations = (kinds: Kinds): (readonly [string, string[]])[] =>
  Object.entries(kinds).map(([kind, spec]) => [kind, Object.keys(localEdges(spec?.edges as never))] as const);

/** The relation act a document's name says — `connect-moment-taken-on` — read against its kinds. */
export const documentRelationActOf = (name: string, kinds: Kinds): { readonly act: RelationActName; readonly kind: string; readonly relation: string } | undefined =>
  relationActOf(name, documentRelations(kinds));

/** Whether a document is given this relation act at all: never a disconnect of an append-only relation. */
export function givesRelationAct(name: string, kinds: Kinds): boolean {
  const found = documentRelationActOf(name, kinds);
  return found !== undefined && !(found.act === "disconnect" && kinds[found.kind]?.edges?.[found.relation]?.appendOnly);
}

/** A relation act renamed with its kind or its relation; any other act as it was. */
export function renamedRelationAct(act: string, kinds: Kinds, change: { readonly t: "kind" | "edge"; readonly from: string; readonly to: string }): string {
  const found = documentRelationActOf(act, kinds);
  if (!found) return act;
  if (change.t === "kind" && found.kind === change.from) return relationActName(found.act, change.to, found.relation);
  if (change.t === "edge" && found.relation === change.from) return relationActName(found.act, found.kind, change.to);
  return act;
}
