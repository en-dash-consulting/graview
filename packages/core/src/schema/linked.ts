import { isAppAddress } from "./app-address.js";

/*
 * Nothing of zod here: the rule language reads a link through this module,
 * and a page that judges a rule carries no zod for it. A schema's
 * definition is read where zod keeps it; the schema a link is kept in is
 * `linked-schema.ts`'s.
 */
const defOf = (schema: unknown): Record<PropertyKey, unknown> | undefined =>
  typeof schema === "object" && schema !== null ? (schema as { _zod?: { def?: Record<PropertyKey, unknown> } })._zod?.def : undefined;

/*
 * A RELATION TO A KIND IN ANOTHER APP (FR-171, the full relation).
 *
 * 0.1.29's `app-link` field named another app. This names a RECORD there:
 * a relation whose `to` is `@<app address>/<kind>` —
 *
 *   "edges": { "forHouse": { "to": ["@nick/house/house"], "cardinality": "one" } }
 *
 * — and linking one picks a record in that app; the far document is never
 * touched. The record that links keeps which one, as a value of its own
 * (`house:h1`, the far kind and its id), so the edit that sets it, its undo,
 * its history and who may see it are the reading app's like any field's.
 * What the far record IS — its card, its describe line, the fields this
 * viewer may see there — is the host's to say, as the viewer
 * (`LinkedRecords`); a viewer who may not open the far app sees "linked
 * record (no access)" and nothing of it.
 *
 * This module is what a page builds a document's fields with, and what the
 * rule language reads a link through, so it holds that and no more. What
 * draws one is `@graview/primitives`'s, fetched with the first one drawn;
 * the in-memory host, the history of a far change and the words for a
 * relation are `@graview/core/linked`'s.
 */

/** A kind in another app, as a relation's `to` names it: `@` + the app's address + `/` + the kind. */
export const LINKED_TARGET = /^@(?:https?:\/\/[^\s<>"'`\\#?]+|[A-Za-z0-9][\w.~-]*(?:\/[\w.~-]+)*)\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * THE APP AND THE KIND A RELATION'S TARGET NAMES — or undefined when it names
 * a kind of this document. The address is what an app-link field would
 * hold for that app: `@nick/house/house` is the kind `house` of `@nick/house`;
 * `@app_kf5eydr9z58jzf/house` of the app with that id; `@https://x.dev/a/house`
 * of the app at `https://x.dev/a`.
 */
export function parseLinkedTarget(target: string): { readonly address: string; readonly kind: string } | undefined {
  if (typeof target !== "string" || !target.startsWith("@") || !LINKED_TARGET.test(target)) return undefined;
  const cut = target.lastIndexOf("/");
  const body = target.slice(0, cut);
  const kind = target.slice(cut + 1);
  // `@owner/app` keeps its @, as an app-link holds it; an id or an http(s) address does not have one.
  const address = /^@https?:\/\//.test(body) || !body.includes("/") ? body.slice(1) : body;
  return isAppAddress(address) ? { address, kind } : undefined;
}

/** Whether a relation's target is a kind in another app. */
export const isLinkedTarget = (target: unknown): target is string => typeof target === "string" && parseLinkedTarget(target) !== undefined;

/** A relation to another app's kinds, as its declaration says it. */
export interface LinkedRelation {
  /** The other app's address: `@nick/house`, an app id, or an http(s) address. */
  readonly address: string;
  /** Its kinds the relation may link. */
  readonly kinds: readonly string[];
  readonly cardinality: "one" | "many";
  /** The relation's own sentence, where the declaration gave one. */
  readonly description?: string;
}

/** One record in another app: which app, which kind, which id. */
export interface LinkedRecordRef {
  readonly address: string;
  readonly kind: string;
  readonly id: string;
}

/*
 * WHAT A LINK KEEPS: `<kind>:<id>` — the far kind and the id its app knows
 * it by. A kind is a word with no colon, so the first colon divides them.
 */
const KEPT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*:\S[^\n]{0,199}$/;

/** What a link keeps for a far record: `house:h1`. */
export const linkedValue = (ref: Pick<LinkedRecordRef, "kind" | "id">): string => `${ref.kind}:${ref.id}`;

/** The far record a kept value names, read against its relation; undefined when it names none. */
export function linkedRefOf(value: unknown, relation: Pick<LinkedRelation, "address" | "kinds">): LinkedRecordRef | undefined {
  if (typeof value !== "string" || !KEPT.test(value)) return undefined;
  const at = value.indexOf(":");
  const kind = value.slice(0, at);
  return relation.kinds.includes(kind) ? { address: relation.address, kind, id: value.slice(at + 1) } : undefined;
}

/** Every far record a link's value names — one, or each of many — in order. */
export function linkedRefsOf(value: unknown, relation: Pick<LinkedRelation, "address" | "kinds">): readonly LinkedRecordRef[] {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return values.flatMap((one) => {
    const ref = linkedRefOf(one, relation);
    return ref ? [ref] : [];
  });
}

/*
 * WHICH FIELDS HOLD A LINK TO ANOTHER APP: a mark on the schema's def, as an
 * app-link is marked, carrying the relation — so a clone shares it, a
 * wrapper holds it inside, and every face, tool and checker reads the
 * relation from the field the record keeps it in.
 */
const LINKED = Symbol.for("@graview/core:linked");

/** Marks a schema as holding links to records of another app. */
export const markLinked = <T extends object>(schema: T, relation: LinkedRelation): T => (Object.defineProperty(defOf(schema)!, LINKED, { value: relation, enumerable: true }), schema);

/** The relation to another app a field holds — under optional, default and nullable — or undefined. */
export function linkedRelationOf(schema: unknown): LinkedRelation | undefined {
  const def = defOf(schema) as { [LINKED]?: LinkedRelation; innerType?: unknown } | undefined;
  return def ? (def[LINKED] ?? linkedRelationOf(def.innerType)) : undefined;
}

/** A definition's relations to other apps, by the field each is kept in. */
export function linkedRelations(definition: { readonly fields?: unknown } | undefined): ReadonlyMap<string, LinkedRelation> {
  const shape = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
  const found = new Map<string, LinkedRelation>();
  for (const [field, schema] of Object.entries(shape)) {
    const relation = linkedRelationOf(schema);
    if (relation) found.set(field, relation);
  }
  return found;
}

/** A relation as a document declares it: where it goes, how many, and its sentence. */
interface DeclaredRelation {
  readonly to: readonly string[] | "*";
  readonly cardinality?: "one" | "many" | undefined;
  readonly description?: string | undefined;
}

/**
 * The relation to another app a document's relation declares, or undefined
 * for one within the document. Only a relation whose every target is a kind
 * of ONE other app is one (`graview check` says `linked-mixed` and
 * `linked-apps` of the rest).
 */
export function linkedRelationOfSpec(edge: DeclaredRelation): LinkedRelation | undefined {
  if (edge.to === "*" || edge.to.length === 0) return undefined;
  const targets = edge.to.map(parseLinkedTarget);
  if (targets.some((target) => !target)) return undefined;
  const address = targets[0]!.address;
  if (targets.some((target) => target!.address !== address)) return undefined;
  return { address, kinds: [...new Set(targets.map((target) => target!.kind))], cardinality: edge.cardinality ?? "many", ...(edge.description ? { description: edge.description } : {}) };
}

/** Whether a document's relation reaches out of the document at all: any of its targets names another app. */
export const reachesAnotherApp = (edge: DeclaredRelation): boolean => edge.to !== "*" && edge.to.some((target) => typeof target === "string" && target.startsWith("@"));

/** A document kind's relations within the document, its relations to other apps aside. */
export function localEdges<E extends DeclaredRelation>(edges: Readonly<Record<string, E>> | undefined): Record<string, E> {
  return Object.fromEntries(Object.entries(edges ?? {}).filter(([, edge]) => !reachesAnotherApp(edge)));
}

/** A document kind's relations to other apps, by name. */
export function linkedEdges(edges: Readonly<Record<string, DeclaredRelation>> | undefined): Map<string, LinkedRelation> {
  const found = new Map<string, LinkedRelation>();
  for (const [name, edge] of Object.entries(edges ?? {})) {
    const relation = linkedRelationOfSpec(edge);
    if (relation) found.set(name, relation);
  }
  return found;
}

/** A far record as the host says it to one viewer. */
export interface LinkedRecord {
  readonly address: string;
  readonly kind: string;
  readonly id: string;
  /** What it is called in its own app: its label there. */
  readonly label: string;
  /** Its describe line there, where its kind has one. */
  readonly describe?: string;
  /** Its card's lines there — a glance at it, field by field, in words — after its title. */
  readonly card?: readonly { readonly label: string; readonly text: string }[];
  /** The fields this viewer may see there, as values, for an expression to walk (`forHouse.listPrice`). Nothing they may not see. */
  readonly fields: Readonly<Record<string, unknown>>;
  /** Where it opens in its own app: a path on the host or an http(s) address. */
  readonly href?: string;
  /** Its app's name, as the host says it. */
  readonly app?: string;
}

/** The host's answer for one far record and one viewer: the record; `{ denied: true }` when they may not open its app; null when there is no such record. */
export type LinkedRecordAnswer = LinkedRecord | { readonly denied: true } | null;

/**
 * Who is looking, as the host is told: a principal — and the person it acts
 * for, where it acts for one (`onBehalfOf`), so the far app judges it as the
 * near one does: an agent sees what both may, and a system seat acting for
 * somebody is never the system.
 */
export type LinkedViewer = { readonly kind: string; readonly id?: string | undefined; readonly roles?: readonly string[] | undefined; readonly onBehalfOf?: LinkedViewer | undefined };

/** What linking asks the host for: records of these kinds in that app, matching words. */
export interface LinkedSearch {
  readonly address: string;
  readonly kinds: readonly string[];
  /** Words a person typed; empty for the first few. */
  readonly query: string;
  readonly limit: number;
}

/**
 * THE HOST'S WAY TO READ ANOTHER APP'S RECORDS (FR-171), beside `resolveApp`
 * and handed where it is — `mount`, `<Embed>`, `GraviewProvider` and the
 * routed face (`PagesApp`) — as `linkedRecords`. Every call is AS THE VIEWER:
 * what it answers is what that viewer may see in the far app, and a viewer
 * who may not open that app is answered `{ denied: true }`. A throw is
 * taken as null.
 */
export interface LinkedRecords {
  /** One far record: its label, describe line, card and the fields this viewer may see; denied; or null. */
  resolve(ref: LinkedRecordRef, viewer: LinkedViewer): Promise<LinkedRecordAnswer>;
  /** The records a link may pick, for this viewer: at most `limit`, best first; denied when they may not open the app. */
  find(search: LinkedSearch, viewer: LinkedViewer): Promise<readonly LinkedRecord[] | { readonly denied: true }>;
  /**
   * THE NAVIGATION SEAM: open the far record in its own app. Where a host
   * gives it, pressing a linked record calls it rather than following its
   * `href` (an app on the same host opening in place); otherwise the
   * record's `href` is followed.
   */
  open?(ref: LinkedRecordRef, viewer: LinkedViewer): void;
}

/**
 * A FAR RECORD AS AN EXPRESSION READS IT, at once: the host's answer once it
 * is in; `denied`; or `unread` — not asked yet, not answered yet, no host to
 * ask, or no such record. An expression never waits and never throws for
 * one: it reads nothing, and says which.
 */
export type LinkedRead = { readonly record: LinkedRecord } | { readonly denied: true } | { readonly unread: true };

/** How the rule language reads a far record: at once, from what has been answered. */
export type LinkedReader = (ref: LinkedRecordRef) => LinkedRead;

/*
 * WHERE A GRAPH'S FAR RECORDS ARE READ FROM, for whoever is looking at it:
 * a page registers its store's graph once, with the reader of its viewer,
 * and every computed field, rule and template judged over that graph walks
 * a link through it. A seat's own graph (`store.seenBy`) is registered by
 * whoever serves the seat. A graph with none reads every far record unread.
 */
const READERS = new WeakMap<object, LinkedReader>();

/** Read far records through `reader` for every expression judged over `graph`; undefined stops. */
export function readLinkedThrough(graph: object, reader: LinkedReader | undefined): void {
  if (reader) READERS.set(graph, reader);
  else READERS.delete(graph);
}

/** The reader a graph's far records are read through, if any. */
export const linkedReaderOf = (graph: object): LinkedReader | undefined => READERS.get(graph);
