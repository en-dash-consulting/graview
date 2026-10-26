/**
 * `@graview/core/catalog` — WHAT AN AI MAY PICK FROM, AND WHAT IT IS TOLD
 * (Roadmap f-ai-candidate-catalog, f-activity-ai-entries).
 *
 * The inline AI does not invent. Pointed at something — a record, a
 * selection, a field, a list or a lens, an act, a place — it picks from
 * what the app already knows can be done there: the acts this viewer may
 * run, the panels a kind can be drawn as (a list, grouped by a choice,
 * sorted by a number or a date, a calendar of a date, columns of a choice),
 * the places and the records next to it, and the values a field may take.
 * `catalogOf` derives those candidates, each with an id and one line, and
 * `aiContextOf` the compact state a model reads beside them: where the
 * viewer is, what they point at, what is selected, the records one link
 * away, what was done lately and a digest of the declaration, cached per
 * declaration. Both read the store AS THE VIEWER SEES IT: a record, a
 * field or a kind the viewer may not see is no candidate and is never
 * said, and an act the viewer may not run is never offered.
 *
 * Here too is the shape of what an interaction leaves behind
 * (`AiInteraction`): who asked what about which target, what was offered,
 * what was accepted, the batches it made and what the models cost — the
 * entry Activity draws, and the one a host (Graview Cloud) stores.
 *
 * Its own entry, because a page that never asks carries none of it: the
 * inline AI is fetched when somebody first opens it.
 */
import { fieldSpecOf } from "./document/field-spec.js";
import { frictionDigest, type FrictionDigest, type FrictionEvent } from "./friction.js";
import { fieldWriters, subjectKindsOf } from "./mutations/derive-edits.js";
import { nodeRefArgs } from "./mutations/node-ref.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import type { Author } from "./ops/types.js";
import { isWithheld } from "./ops/withheld.js";
import type { Principal } from "./permissions/types.js";
import { fieldWords, humanizeField, labelOf, nounOf, pluralOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import { seatOf } from "./seat-of.js";
import { jobIsFor, type AppPurpose } from "./job-shape.js";
import type { Store } from "./store.js";

// ── targets ─────────────────────────────────────────────────────────────────

/**
 * WHAT THE AI IS POINTED AT: a record, several, one field of a record, a
 * kind's list, a lens (a place, by its slug), an act (and the record it
 * would run on), or a place with nothing in particular under the pointer.
 */
export type AiTarget =
  | { readonly on: "record"; readonly id: string }
  | { readonly on: "selection"; readonly ids: readonly string[] }
  | { readonly on: "field"; readonly id: string; readonly field: string }
  | { readonly on: "list"; readonly kind: string }
  | { readonly on: "lens"; readonly place: string; readonly kind?: string }
  | { readonly on: "act"; readonly act: string; readonly id?: string }
  | { readonly on: "place"; readonly place: string };

/** What a context menu was opened on, as a face says it (`MenuTarget` in `@graview/react`). */
export interface PointedAt {
  readonly on?: string | undefined;
  readonly about?: readonly string[] | undefined;
  readonly field?: string | undefined;
  readonly place?: string | undefined;
}

/** The kind a district or kind card's id names: `aggregate:task`, `kind:task`. */
const kindOfCard = (id: string): string | undefined => /^(?:aggregate|kind):([^,]+)$/.exec(id)?.[1];

/**
 * THE TARGET A MENU WAS OPENED ON: a field of a record, a record, several,
 * a kind's district or list, a lens, else the place itself ("home" when
 * the menu landed on nothing at all).
 */
export function aiTargetOf(pointed: PointedAt, has: (id: string) => boolean): AiTarget {
  const about = pointed.about ?? [];
  if (pointed.field !== undefined && pointed.on !== undefined && has(pointed.on)) return { on: "field", id: pointed.on, field: pointed.field };
  const records = about.filter(has);
  if (records.length > 1) return { on: "selection", ids: records };
  if (pointed.on !== undefined && has(pointed.on)) return { on: "record", id: pointed.on };
  if (records.length === 1) return { on: "record", id: records[0]! };
  const kind = [pointed.on, ...about].map((id) => (id === undefined ? undefined : kindOfCard(id))).find((one) => one !== undefined);
  if (pointed.place !== undefined) return { on: "lens", place: pointed.place, ...(kind ? { kind } : {}) };
  if (kind !== undefined) return { on: "list", kind };
  return { on: "place", place: "home" };
}

/** The records a target names, in order. */
export const recordsOfTarget = (target: AiTarget): readonly string[] =>
  target.on === "record" || target.on === "field" ? [target.id] : target.on === "selection" ? target.ids : target.on === "act" && target.id !== undefined ? [target.id] : [];

// ── candidates ──────────────────────────────────────────────────────────────

/**
 * A PANEL A KIND CAN BE DRAWN AS: a lens the framework ships, bound to the
 * kind's own fields — the recipe `@graview/tools/draft` makes a draft of
 * (`recipeDraft`), which is kept as a real lens with "Keep as a lens".
 */
export interface PanelRecipe {
  readonly lens: "blocks" | "columns" | "calendar";
  readonly kind: string;
  readonly group?: string;
  readonly sort?: { readonly by: string; readonly direction?: "asc" | "desc" };
  readonly column?: string;
  readonly start?: string;
  readonly title?: string;
}

interface CandidateBase {
  /** Unique in its catalog, stable for the same target and graph: what a model answers with. */
  readonly id: string;
  /** What it is, in a few words. */
  readonly label: string;
  /** One line a model and a person both read. */
  readonly description: string;
}

/** An act this viewer may run here: its call, settled as far as the target settles it, and what it still asks. */
export interface ActCandidate extends CandidateBase {
  readonly type: "act";
  readonly mutation: string;
  readonly args: Readonly<Record<string, unknown>>;
  /** Arguments it still needs before it can run. */
  readonly asks: readonly string[];
}
/** A panel of a kind (`PanelRecipe`). */
export interface PanelCandidate extends CandidateBase {
  readonly type: "panel";
  readonly panel: PanelRecipe;
}
/** A place of the app, by its slug. */
export interface PlaceCandidate extends CandidateBase {
  readonly type: "place";
  readonly place: string;
}
/** A record next to the target (or of the target's kind), and the relation that joins them. */
export interface RecordCandidate extends CandidateBase {
  readonly type: "record";
  readonly record: string;
  readonly relation?: string;
}
/** A value for a field of a record, or a link a relation of it may make: the call that would set it, judged for this viewer. */
export interface FillCandidate extends CandidateBase {
  readonly type: "fill";
  readonly record: string;
  readonly field: string;
  readonly value: unknown;
  readonly call: MutationCall;
}

export type AiCandidate = ActCandidate | PanelCandidate | PlaceCandidate | RecordCandidate | FillCandidate;

/** What an AI may pick from, for one target. */
export interface AiCatalog {
  readonly target: AiTarget;
  readonly candidates: readonly AiCandidate[];
}

/** An act a derivation already offers this viewer (`deriveAffordances(...).affordances` in `@graview/tools`). */
export interface CatalogAct {
  readonly mutation: string;
  readonly label: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly open?: readonly { readonly name: string; readonly optional?: boolean }[];
  readonly why?: string;
  readonly destructive?: boolean;
}

/** A place of the app as the catalog reads it: its slug, its title and the kind it pictures. */
export interface CatalogPlace {
  readonly as: string;
  readonly title: string;
  readonly kind?: string;
  /** Every kind the one picture is over, when it is over several (`Place.over`). */
  readonly over?: readonly string[];
  /** What it is: a shipped lens's name ("columns", "calendar"…), or "view" for a worker view (`Place.lens`). */
  readonly lens?: string;
  /** The other kinds it reads beyond its own: a worker view's manifest `reads.kinds` (`Place.reads`). */
  readonly reads?: readonly string[];
  /** Kept off the lists (`Place.hidden`): never offered as a view to open. */
  readonly hidden?: boolean;
}

export interface CatalogOptions {
  /** Who is asking: every candidate is one this seat may see and run. */
  readonly principal: Principal;
  /**
   * The acts the derivation offers this viewer here. Unsaid, the acts whose
   * subject is the target's record, judged here. Either way an act is held
   * to the policy again, and one that destroys is never a candidate.
   */
  readonly acts?: readonly CatalogAct[];
  /** The app's places (`views.places()`, `placesOf(app)`). */
  readonly places?: readonly CatalogPlace[];
  /** The most of each type of candidate. 8 when unsaid. */
  readonly each?: number;
}

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;
type Shape = Record<string, unknown>;

const shapeOf = (schema: AnySchema, kind: string): Shape => ((schema.tryDefinition(kind) as { fields?: { shape?: Shape } } | undefined)?.fields?.shape ?? {});
const edgesOf = (schema: AnySchema, kind: string): Readonly<Record<string, { readonly to: readonly string[] | "*"; readonly description?: string; readonly inverse?: string }>> =>
  (schema.tryDefinition(kind) as { edges?: Record<string, { to: readonly string[] | "*"; description?: string; inverse?: string }> } | undefined)?.edges ?? {};
const hiddenFields = (schema: AnySchema, kind: string): ReadonlySet<string> => new Set((schema.tryDefinition(kind) as { display?: { hide?: readonly string[] } } | undefined)?.display?.hide ?? []);

/** A record's name, as every surface says it. */
const nameOf = (schema: AnySchema, node: Node): string => labelOf(schema.tryDefinition(node.kind), node as never);
const fieldSaid = (schema: AnySchema, kind: string, field: string): string => fieldWords(schema.tryDefinition(kind) as never, field) || humanizeField(field);
const valueSaid = (value: unknown): string => (typeof value === "boolean" ? (value ? "yes" : "no") : String(value));

/** The kinds a seat sees any record of: none a module it has off holds, none a policy keeps from it. */
function kindsSeen(store: Store<AnySchema>, principal: Principal): ReadonlySet<string> {
  const kept = store.kindsKeptFrom(principal);
  return new Set((store.schema.kinds as readonly string[]).filter((kind) => !kept.has(kind)));
}

/** Whether this seat may run the call: the policy, then a rehearsal of it as this seat — the act's own guard, its arguments, a field kept from the seat. */
function runs(whole: Store<AnySchema>, call: MutationCall, principal: Principal, rehearse: boolean): boolean {
  if (!whole.permits(call, principal).ok) return false;
  if (!rehearse) return true;
  try {
    return whole.previewAll([call], { author: principal }).ops.length > 0;
  } catch {
    // A call the store refuses as this seat — a guard, an argument it does not take — is no candidate.
    return false;
  }
}

/**
 * THE CANDIDATES FOR A TARGET, as this viewer may see and run them.
 *
 *  - acts: the derivation's (`acts`), else the acts whose subject is the
 *    target's record, each held to the policy; never one that destroys;
 *  - panels: per kind, a list, a list grouped by each choice, sorted by
 *    each number or date, a calendar of each date, columns of each choice;
 *  - places: the app's places that picture the target's kind (or every
 *    place, when the target is a place);
 *  - records: the records one link from the target's, by the relation
 *    that joins them, or a kind's own records;
 *  - fills: the values a field may take (a choice's options, yes or no)
 *    and the links a relation of the record may make, each as the call an
 *    act this viewer may run would make, rehearsed as them.
 *
 * Pure: the same store, target and viewer give the same catalog.
 */
export function catalogOf<S extends AnySchema>(given: Store<S>, target: AiTarget, options: CatalogOptions): AiCatalog {
  const store = given as unknown as Store<AnySchema>;
  const { principal } = options;
  const each = options.each ?? 8;
  const whole = seatOf(store)?.store ?? store;
  const seen = whole.seenBy(principal);
  const schema = whole.schema;
  const visible = kindsSeen(whole, principal);
  const nodeOf = (id: string): Node | undefined => {
    const node = seen.graph.getNode(id) as Node | undefined;
    return node && visible.has(node.kind) ? node : undefined;
  };
  const mutations = whole.allMutations() as readonly AnyMutationDefinition<AnySchema>[];
  const byName = new Map(mutations.map((mutation) => [mutation.name, mutation]));
  const candidates: AiCandidate[] = [];
  const taken = new Set<string>();
  const add = (candidate: AiCandidate) => {
    if (taken.has(candidate.id)) return;
    taken.add(candidate.id);
    candidates.push(candidate);
  };
  const capped = <T>(items: readonly T[]): readonly T[] => items.slice(0, each);

  // ── the target, read under sight ──
  const ids = recordsOfTarget(target).filter((id) => nodeOf(id) !== undefined);
  if (recordsOfTarget(target).length > 0 && ids.length === 0) return { target, candidates: [] };
  const record = ids.length === 1 ? nodeOf(ids[0]!) : undefined;
  const kind =
    record?.kind ??
    (target.on === "list" ? target.kind : target.on === "lens" ? (target.kind ?? options.places?.find((place) => place.as === target.place)?.kind) : undefined) ??
    (target.on === "selection" ? nodeOf(ids[0]!)?.kind : undefined);
  if (kind !== undefined && !visible.has(kind)) return { target, candidates: [] };

  // ── acts ──
  const actId = (mutation: string, args: Readonly<Record<string, unknown>>) => `act:${mutation}${Object.keys(args).length > 0 ? `:${Object.values(args).map((value) => String(value)).join(",")}` : ""}`;
  const offerAct = (mutation: AnyMutationDefinition<AnySchema>, args: Readonly<Record<string, unknown>>, label: string, asks: readonly string[], why?: string) => {
    if (mutation.destructive) return;
    // A call that names a record this viewer may not see is not theirs to be offered.
    if (Object.values(args).some((value) => typeof value === "string" && whole.graph.has(value) && nodeOf(value) === undefined)) return;
    // One that asks nothing more is rehearsed as the viewer: an act that would change nothing, or that its guard refuses, is not offered.
    if (!runs(whole, { name: mutation.name, args: { ...args } }, principal, asks.length === 0)) return;
    add({ type: "act", id: actId(mutation.name, args), label, description: why ?? mutation.description ?? label, mutation: mutation.name, args, asks });
  };
  if (target.on !== "place" || options.acts) {
    if (options.acts) {
      for (const act of options.acts) {
        const mutation = byName.get(act.mutation);
        if (!mutation || act.destructive) continue;
        if (target.on === "act" && act.mutation !== target.act) continue;
        offerAct(mutation, act.args, act.label, (act.open ?? []).filter((one) => !one.optional).map((one) => one.name), act.why);
      }
    } else {
      const subjects = record ? [record] : [];
      for (const mutation of mutations) {
        if (target.on === "act" && mutation.name !== target.act) continue;
        const shape = ((mutation.input as { shape?: Shape }).shape ?? {}) as Shape;
        const required = (exclude: string | undefined) =>
          Object.entries(shape)
            .filter(([name, field]) => name !== exclude && (field as { safeParse?: (value: unknown) => { success: boolean } }).safeParse?.(undefined).success === false)
            .map(([name]) => name);
        if (mutation.subject) {
          for (const subject of subjects) {
            if (!subjectKindsOf(schema, mutation).includes(subject.kind)) continue;
            offerAct(mutation, { [mutation.subject.arg]: subject.id }, `${mutation.title ?? humanizeField(mutation.name)}: ${nameOf(schema, subject)}`, required(mutation.subject.arg));
          }
        } else if (kind !== undefined && (mutation.creates ?? []).includes(kind as never)) {
          offerAct(mutation, {}, mutation.title ?? humanizeField(mutation.name), required(undefined));
        }
      }
    }
  }
  // Only what the target is about: an act from somewhere else is not what was pointed at.
  const acts = candidates.filter((candidate) => candidate.type === "act");
  candidates.splice(0, candidates.length, ...capped(acts));

  // ── fills ──
  const fillsFor = (node: Node, only?: string) => {
    const writers = fieldWriters(schema, mutations).get(node.kind);
    const shape = shapeOf(schema, node.kind);
    const hidden = hiddenFields(schema, node.kind);
    const fills: FillCandidate[] = [];
    for (const [field, zod] of Object.entries(shape)) {
      if (only !== undefined ? field !== only : hidden.has(field) || node[field] !== undefined) continue;
      const spec = fieldSpecOf(zod);
      const values: readonly unknown[] = spec?.type === "enum" ? (spec.options ?? []) : spec?.type === "boolean" ? [true, false] : [];
      if (values.length === 0) continue;
      const writer = (writers?.get(field) ?? []).map((name) => byName.get(name)).find((mutation) => mutation?.subject !== undefined && runs(whole, { name: mutation.name, args: { [mutation.subject.arg]: node.id, [field]: values.find((value) => value !== node[field]) ?? values[0] } }, principal, true));
      if (!writer?.subject) continue;
      for (const value of values) {
        if (node[field] === value) continue;
        fills.push({
          type: "fill",
          id: `fill:${node.id}:${field}:${valueSaid(value)}`,
          label: `${fieldSaid(schema, node.kind, field)}: ${valueSaid(value)}`,
          description: `Set ${fieldSaid(schema, node.kind, field).toLowerCase()} of ${nameOf(schema, node)} to ${valueSaid(value)}`,
          record: node.id,
          field,
          value,
          call: { name: writer.name, args: { [writer.subject.arg]: node.id, [field]: value } },
        });
      }
    }
    // A relation's link: an act that connects it, naming a record of the far kind this viewer sees.
    for (const [edge, declared] of Object.entries(edgesOf(schema, node.kind))) {
      if (only !== undefined && edge !== only) continue;
      const far = declared.to === "*" ? [...visible] : declared.to.filter((one) => visible.has(one));
      const linked = new Set(seen.graph.out(node.id, edge).map((one) => one.id));
      const connector = mutations.find((mutation) => (mutation.connects ?? []).includes(edge) && mutation.subject !== undefined && subjectKindsOf(schema, mutation).includes(node.kind));
      if (!connector?.subject) continue;
      const ref = nodeRefArgs(connector.input).find((arg) => arg.name !== connector.subject!.arg);
      if (!ref) continue;
      const options = far
        .flatMap((farKind) => (ref.kinds.length === 0 || ref.kinds.includes(farKind) ? (seen.graph.nodesOfKind(farKind as never) as unknown as Node[]) : []))
        .filter((other) => other.id !== node.id && !linked.has(other.id) && nodeOf(other.id) !== undefined);
      for (const other of capped(options)) {
        const call = { name: connector.name, args: { [connector.subject.arg]: node.id, [ref.name]: other.id } };
        if (!runs(whole, call, principal, true)) continue;
        fills.push({
          type: "fill",
          id: `fill:${node.id}:${edge}:${other.id}`,
          label: `${humanizeField(edge)}: ${nameOf(schema, other)}`,
          description: `Link ${nameOf(schema, node)} to ${nameOf(schema, other)}${declared.description ? ` as ${declared.description}` : ""}`,
          record: node.id,
          field: edge,
          value: other.id,
          call,
        });
      }
    }
    return fills;
  };
  if (target.on === "field" && record) for (const fill of fillsFor(record, target.field)) add(fill);
  else if (record && target.on === "record") for (const fill of capped(fillsFor(record))) add(fill);

  // ── panels ──
  const panelsFor = (of: string): PanelCandidate[] => {
    const plural = pluralOf(schema, of).toLowerCase();
    const panels: PanelCandidate[] = [{ type: "panel", id: `panel:${of}:list`, label: `A list of ${plural}`, description: `Every ${nounOf(schema.tryDefinition(of), of).toLowerCase()} this viewer may see, as a list`, panel: { lens: "blocks", kind: of } }];
    const hidden = hiddenFields(schema, of);
    for (const [field, zod] of Object.entries(shapeOf(schema, of))) {
      if (hidden.has(field)) continue;
      const spec = fieldSpecOf(zod);
      const words = fieldSaid(schema, of, field).toLowerCase();
      if (spec?.type === "enum") {
        panels.push({ type: "panel", id: `panel:${of}:group:${field}`, label: `${capitalized(plural)} by ${words}`, description: `A list of ${plural} grouped by ${words}`, panel: { lens: "blocks", kind: of, group: field } });
        panels.push({ type: "panel", id: `panel:${of}:columns:${field}`, label: `Columns of ${plural} by ${words}`, description: `${capitalized(plural)} in a column for each ${words}`, panel: { lens: "columns", kind: of, column: field } });
      } else if (spec?.type === "number" || spec?.type === "integer" || spec?.type === "date" || spec?.type === "datetime") {
        const dated = spec.type === "date" || spec.type === "datetime";
        panels.push({ type: "panel", id: `panel:${of}:sort:${field}`, label: `${capitalized(plural)} by ${words}`, description: `A list of ${plural}, the ${dated ? "latest" : "highest"} ${words} first`, panel: { lens: "blocks", kind: of, sort: { by: field, direction: "desc" } } });
        if (dated) panels.push({ type: "panel", id: `panel:${of}:calendar:${field}`, label: `A calendar of ${plural}`, description: `${capitalized(plural)} on a calendar by ${words}`, panel: { lens: "calendar", kind: of, start: field } });
      }
    }
    return panels;
  };
  const panelKinds = target.on === "place" ? [...visible] : kind !== undefined ? [kind] : [];
  for (const one of panelKinds) for (const panel of capped(panelsFor(one))) add(panel);

  // ── places ──
  for (const place of capped((options.places ?? []).filter((one) => (one.kind === undefined ? target.on === "place" : visible.has(one.kind) && (target.on === "place" || one.kind === kind))))) {
    if (target.on === "lens" && place.as === target.place) continue;
    add({ type: "place", id: `place:${place.as}`, label: place.title, description: `Go to ${place.title}`, place: place.as });
  }

  // ── records ──
  if (record) {
    const near: RecordCandidate[] = [];
    for (const [edge, declared] of Object.entries(edgesOf(schema, record.kind))) {
      for (const other of seen.graph.out(record.id, edge) as unknown as Node[]) {
        if (nodeOf(other.id)) near.push({ type: "record", id: `record:${other.id}`, label: nameOf(schema, other), description: `${capitalized(declared.description ?? humanizeField(edge))}: ${nameOf(schema, other)}`, record: other.id, relation: edge });
      }
    }
    for (const of of schema.kinds as readonly string[]) {
      for (const [edge, declared] of Object.entries(edgesOf(schema, of))) {
        if (declared.to !== "*" && !declared.to.includes(record.kind)) continue;
        for (const other of seen.graph.in(record.id, edge) as unknown as Node[]) {
          if (other.kind === of && nodeOf(other.id)) near.push({ type: "record", id: `record:${other.id}`, label: nameOf(schema, other), description: `${capitalized(declared.inverse ?? humanizeField(edge))}: ${nameOf(schema, other)}`, record: other.id, relation: edge });
        }
      }
    }
    for (const one of capped(near)) add(one);
  } else if (target.on === "list" || target.on === "lens") {
    for (const other of capped(kind !== undefined ? (seen.graph.nodesOfKind(kind as never) as unknown as Node[]) : [])) {
      if (nodeOf(other.id)) add({ type: "record", id: `record:${other.id}`, label: nameOf(schema, other), description: `Open ${nameOf(schema, other)}`, record: other.id });
    }
  } else if (target.on === "selection") {
    for (const id of ids) {
      const other = nodeOf(id)!;
      add({ type: "record", id: `record:${id}`, label: nameOf(schema, other), description: `Open ${nameOf(schema, other)}`, record: id });
    }
  }
  return { target, candidates };
}

const capitalized = (text: string): string => (text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text);

// ── a view the app already has ──────────────────────────────────────────────

/** An existing view that fits an ask: open it (`full`), or open it and adjust it (`partial`). */
export interface ExistingView {
  /** The place's slug, as `goTo.place` takes it. */
  readonly place: string;
  readonly title: string;
  readonly kind?: string;
  readonly fit: "full" | "partial";
}

export interface ExistingViewOptions {
  readonly principal: Principal;
  /** The app's places, each with what it is and what it reads where the registry knows (`views.places()`). */
  readonly places: readonly CatalogPlace[];
  /** The words asked, when there are any: "a searchable board". */
  readonly said?: string;
  /** The most offered. 3 when unsaid. */
  readonly most?: number;
}

/** The words that ask for each shipped lens; a view somebody wrote is asked for by its title. */
const LENS_WORDS: Readonly<Record<string, readonly string[]>> = {
  columns: ["board", "kanban", "column", "lane", "pipeline", "stage", "funnel"],
  board: ["board", "map", "floor", "layout", "seat", "slot"],
  calendar: ["calendar", "schedule", "date", "due", "month", "week", "agenda", "deadline", "day"],
  timeline: ["timeline", "gantt", "schedule", "roadmap", "span"],
  coverage: ["coverage", "matrix", "grid", "gap"],
  plan: ["plan", "floor", "map", "region", "area"],
  blocks: ["list", "table", "summary", "overview", "dashboard", "card"],
};
/** Words that say a view is wanted, not which one. */
const ASKING = new Set(["a", "an", "the", "of", "for", "my", "our", "me", "us", "to", "with", "and", "in", "on", "by", "that", "which", "i", "we", "want", "need", "show", "open", "go", "draw", "make", "new", "view", "views", "panel", "panels", "page", "lens", "please", "all", "every", "some", "see", "can", "could", "would", "like", "one", "what", "is", "are", "do", "does", "here", "there", "how", "it", "this", "these", "those"]);
const stem = (word: string): string => (word.length > 3 && word.endsWith("ies") ? `${word.slice(0, -3)}y` : word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);
const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * THE VIEWS THE APP ALREADY HAS THAT FIT AN ASK (Roadmap
 * f-menu-suggests-existing-views): where the menu would draw a view of the
 * target, the places it could open instead — a declared lens, a lens a
 * reader kept, a worker view a host registered with its manifest —
 * matched by what each is attached to (the target's kind, or the kinds
 * the words name), what it reads, its title and what it is (a board, a
 * calendar). A view of the kind whose words say all that was asked fits
 * whole and is opened; one that only reads the kind, or leaves a word
 * unsaid ("searchable"), fits in part and is opened to be adjusted.
 *
 * Quiet: at most three, best first; none on the home unless words were
 * asked; never the lens it was opened on, one kept off the lists, or a
 * kind the viewer may not see. Pure, and no model is asked: the places
 * and the declaration are all it reads.
 */
export function existingViewsOf<S extends AnySchema>(given: Store<S>, target: AiTarget, options: ExistingViewOptions): readonly ExistingView[] {
  const store = given as unknown as Store<AnySchema>;
  const whole = seatOf(store)?.store ?? store;
  const schema = whole.schema;
  const visible = kindsSeen(whole, options.principal);
  const seen = whole.seenBy(options.principal);
  const records = recordsOfTarget(target);
  const targetKinds = new Set<string>();
  for (const id of records) {
    const kind = (seen.graph.getNode(id) as Node | undefined)?.kind;
    if (kind !== undefined && visible.has(kind)) targetKinds.add(kind);
  }
  if (records.length > 0 && targetKinds.size === 0) return [];
  if (target.on === "list") targetKinds.add(target.kind);
  if (target.on === "lens") {
    const kind = target.kind ?? options.places.find((place) => place.as === target.place)?.kind;
    if (kind !== undefined) targetKinds.add(kind);
  }
  // The words that are not asking: the kinds they name, and the rest, each to be said by a view.
  const kindWords = new Map<string, string>();
  for (const kind of schema.kinds as readonly string[]) {
    if (!visible.has(kind)) continue;
    const definition = schema.tryDefinition(kind);
    for (const said of [kind, nounOf(definition, kind), pluralOf(schema, kind)]) for (const word of wordsOf(said)) kindWords.set(stem(word), kind);
  }
  const asked = wordsOf(options.said ?? "").filter((word) => !ASKING.has(word));
  const named = new Set<string>();
  const wanted: string[] = [];
  for (const word of asked) {
    const kind = kindWords.get(stem(word));
    if (kind !== undefined) named.add(kind);
    else wanted.push(stem(word));
  }
  const kinds = named.size > 0 ? named : targetKinds;
  // Words that only say a view is wanted ("show") name none; on the home with nothing asked, the home lists its places already.
  if ((options.said ?? "").trim() !== "" && asked.length === 0) return [];
  if (kinds.size === 0 && asked.length === 0) return [];
  // The places that could be what was asked for: attached to the kinds, or reading them.
  const eligible: { readonly place: CatalogPlace; readonly own: boolean; readonly reads: boolean; readonly at: number }[] = [];
  options.places.forEach((place, at) => {
    if (place.hidden || (target.on === "lens" && place.as === target.place)) return;
    const over = place.over ?? (place.kind !== undefined ? [place.kind] : []);
    if (over.length > 0 && !over.some((kind) => visible.has(kind))) return;
    const own = over.some((kind) => kinds.has(kind));
    const reads = !own && (place.reads ?? []).some((kind) => kinds.has(kind));
    if (kinds.size > 0 && !own && !reads) return;
    eligible.push({ place, own, reads, at });
  });
  const titleOf = (place: CatalogPlace): ReadonlySet<string> => new Set(wordsOf(place.title).map(stem));
  // A word a view's title says is asked of that view: one that is only a calendar's word ("week") does not reach the month.
  const titledByAny = new Set(wanted.filter((word) => eligible.some(({ place }) => titleOf(place).has(word))));
  const scored: { readonly view: ExistingView; readonly score: number; readonly at: number }[] = [];
  for (const { place, own, reads, at } of eligible) {
    const titled = titleOf(place);
    const shows = new Set((LENS_WORDS[place.lens ?? ""] ?? []).map(stem));
    const said = wanted.filter((word) => titled.has(word) || (shows.has(word) && !titledByAny.has(word))).length;
    const unsaid = wanted.length - said;
    // Words were asked and this view says none of them: it is not what was asked for.
    if (wanted.length > 0 && said === 0) continue;
    const fit = !reads && unsaid === 0 ? "full" : "partial";
    const score = (own ? 4 : reads ? 2 : 1) + said * 2 - unsaid + (fit === "full" ? 1 : 0);
    scored.push({ view: { place: place.as, title: place.title, ...(place.kind !== undefined ? { kind: place.kind } : {}), fit }, score, at });
  }
  // A picture over several kinds is a place on each: offered once.
  const once = scored.filter((one, at) => !scored.slice(0, at).some((held) => held.view.place === one.view.place && held.view.title === one.view.title));
  return once
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, options.most ?? 3)
    .map((one) => one.view);
}

// ── the state a model reads ─────────────────────────────────────────────────

/** A record as the state names it. */
export interface AiRecordBrief {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
}

/** A kind, as the digest says it: its fields by type (a choice with its options), and its relations by the kinds they reach. */
export interface SchemaDigestKind {
  readonly kind: string;
  readonly noun: string;
  readonly plural: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly relations: Readonly<Record<string, readonly string[]>>;
  /** Other words people use for one ("supplier" for a vendor), when the app declares them (Roadmap f-learned-suggestions). */
  readonly aliases?: readonly string[];
  /** Other words people use for a field it shows, by field. */
  readonly fieldAliases?: Readonly<Record<string, readonly string[]>>;
}

/** The declaration, as a model is told it: the kinds this viewer sees and the acts it may run. `version` changes when either does. */
export interface SchemaDigest {
  readonly version: string;
  readonly kinds: readonly SchemaDigestKind[];
  readonly acts: readonly { readonly name: string; readonly title: string; readonly on?: readonly string[] }[];
}

/** What the target is, as the state says it. */
export interface AiTargetState {
  readonly on: AiTarget["on"];
  readonly record?: AiRecordBrief & { readonly fields: Readonly<Record<string, unknown>> };
  readonly field?: string;
  readonly kind?: string;
  readonly place?: string;
  readonly act?: string;
}

/**
 * THE STATE A MODEL READS BESIDE THE CATALOG: compact JSON — where the
 * viewer is, the target, the selection, the records one link away, the
 * last few changes and a digest of the declaration — every part of it as
 * this viewer may see it. The shape a decision provider takes as its
 * `state` (Jev's), and the one a thinking model is handed as JSON.
 */
export interface AiContextState {
  readonly place?: string;
  readonly target: AiTargetState;
  readonly selection: readonly AiRecordBrief[];
  readonly neighbors: readonly (AiRecordBrief & { readonly relation: string; readonly direction: "out" | "in" })[];
  readonly recent: readonly { readonly intent: string; readonly at: string; readonly by: string }[];
  readonly schema: SchemaDigest;
  /**
   * Who the app is for and what this viewer comes to it to ask (Roadmap
   * f-app-jobs), when the caller hands the app's `purpose`: its `for`, and
   * each job whose roles include the viewer's and whose kind they may see.
   */
  readonly purpose?: AiPurposeState;
  /** What people looked for and could not do lately (`frictionDigest`), when the host handed `friction`. */
  readonly friction?: FrictionDigest;
}

/** The app's purpose as a model is told it: who it is for, and the questions this viewer brings to it. */
export interface AiPurposeState {
  readonly for?: string;
  readonly jobs: readonly { readonly name: string; readonly ask: string; readonly kind: string }[];
}

export interface AiContextOptions {
  readonly principal: Principal;
  /** The place the viewer is on (a lens's slug, "home"). */
  readonly place?: string;
  /** What else is selected. */
  readonly selection?: readonly string[];
  /** How many recent changes, newest first. 6 when unsaid. */
  readonly recent?: number;
  /** The app's purpose (`app.purpose`): said to the model as this viewer may hear it. Unsaid, the state says none. */
  readonly purpose?: AppPurpose;
  /**
   * THE FRICTION LOG, AS THE HOST KEEPS IT (Roadmap f-friction-log): the
   * events, read from wherever the host stores them. Said as a digest —
   * counted across people, no refusal's sentence — under `friction`.
   * Core reads no storage of its own: unsaid, there is none.
   */
  readonly friction?: readonly FrictionEvent[];
}

const DIGESTS = new WeakMap<object, Map<string, SchemaDigest>>();

/** A short, stable hash of a string (FNV-1a), for a digest's version. */
function hashOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * THE DECLARATION AS THIS VIEWER IS TOLD IT, cached per declaration and
 * per what the viewer may see and run: the same schema and seat are one
 * digest, made once.
 */
export function schemaDigestOf<S extends AnySchema>(given: Store<S>, principal: Principal): SchemaDigest {
  const store = given as unknown as Store<AnySchema>;
  const whole = seatOf(store)?.store ?? store;
  const schema = whole.schema;
  const visible = kindsSeen(whole, principal);
  const mutations = whole.allMutations() as readonly AnyMutationDefinition<AnySchema>[];
  const may = mutations.filter((mutation) => !mutation.destructive && whole.permits({ name: mutation.name, args: {} }, principal).ok !== false);
  const key = `${[...visible].join(",")}|${may.map((mutation) => mutation.name).join(",")}`;
  const cached = DIGESTS.get(schema)?.get(key);
  if (cached) return cached;
  const kinds: SchemaDigestKind[] = [...visible].map((kind) => {
    const hidden = hiddenFields(schema, kind);
    const fields: Record<string, string> = {};
    for (const [field, zod] of Object.entries(shapeOf(schema, kind))) {
      if (hidden.has(field)) continue;
      const spec = fieldSpecOf(zod);
      if (spec) fields[field] = spec.type === "enum" ? `enum:${(spec.options ?? []).join("|")}` : spec.type;
    }
    const relations: Record<string, readonly string[]> = {};
    for (const [edge, declared] of Object.entries(edgesOf(schema, kind))) relations[edge] = declared.to === "*" ? [...visible] : declared.to.filter((one) => visible.has(one));
    const definition = schema.tryDefinition(kind) as { aliases?: readonly string[]; fieldAliases?: Readonly<Record<string, readonly string[]>> } | undefined;
    const fieldAliases = Object.entries(definition?.fieldAliases ?? {}).filter(([field, words]) => field in fields && words.length > 0);
    return {
      kind,
      noun: nounOf(schema.tryDefinition(kind), kind),
      plural: pluralOf(schema, kind),
      fields,
      relations,
      ...(definition?.aliases && definition.aliases.length > 0 ? { aliases: definition.aliases } : {}),
      ...(fieldAliases.length > 0 ? { fieldAliases: Object.fromEntries(fieldAliases) } : {}),
    };
  });
  const acts = may.map((mutation) => ({ name: mutation.name, title: mutation.title ?? humanizeField(mutation.name), ...(mutation.subject ? { on: subjectKindsOf(schema, mutation).filter((one) => visible.has(one)) } : {}) }));
  const body = { kinds, acts };
  const digest: SchemaDigest = { version: hashOf(JSON.stringify(body)), ...body };
  const forSchema = DIGESTS.get(schema) ?? new Map<string, SchemaDigest>();
  forSchema.set(key, digest);
  DIGESTS.set(schema, forSchema);
  return digest;
}

/** Who made a change, in the state's words: their own name, else their id, else what they are. */
const byWords = (author: Author): string => author.name ?? author.id ?? author.kind;

/**
 * THE STATE FOR A TARGET, as this viewer may see it. A record it may not
 * see is no target: the state says only what the target was (`on`).
 */
export function aiContextOf<S extends AnySchema>(given: Store<S>, target: AiTarget, options: AiContextOptions): AiContextState {
  const store = given as unknown as Store<AnySchema>;
  const { principal } = options;
  const whole = seatOf(store)?.store ?? store;
  const seen = whole.seenBy(principal);
  const schema = whole.schema;
  const visible = kindsSeen(whole, principal);
  const nodeOf = (id: string): Node | undefined => {
    const node = seen.graph.getNode(id) as Node | undefined;
    return node && visible.has(node.kind) ? node : undefined;
  };
  const brief = (node: Node): AiRecordBrief => ({ id: node.id, kind: node.kind, label: nameOf(schema, node) });
  const ids = recordsOfTarget(target);
  const record = ids.length === 1 ? nodeOf(ids[0]!) : undefined;
  const fields = record
    ? Object.fromEntries(Object.keys(shapeOf(schema, record.kind)).filter((field) => !hiddenFields(schema, record.kind).has(field) && record[field] !== undefined && field !== "label").map((field) => [field, record[field]]))
    : {};
  const targetState: AiTargetState = {
    on: target.on,
    ...(record ? { record: { ...brief(record), fields } } : {}),
    ...(target.on === "field" && record ? { field: target.field } : {}),
    ...(target.on === "list" && visible.has(target.kind) ? { kind: target.kind } : {}),
    ...(target.on === "lens" ? { place: target.place, ...(target.kind && visible.has(target.kind) ? { kind: target.kind } : {}) } : {}),
    ...(target.on === "place" ? { place: target.place } : {}),
    ...(target.on === "act" ? { act: target.act } : {}),
  };
  const selection = [...new Set([...(target.on === "selection" ? target.ids : []), ...(options.selection ?? [])])].flatMap((id) => {
    const node = nodeOf(id);
    return node ? [brief(node)] : [];
  });
  const neighbors: (AiRecordBrief & { relation: string; direction: "out" | "in" })[] = [];
  if (record) {
    for (const edge of Object.keys(edgesOf(schema, record.kind))) for (const other of seen.graph.out(record.id, edge) as unknown as Node[]) if (nodeOf(other.id)) neighbors.push({ ...brief(other), relation: edge, direction: "out" });
    for (const of of schema.kinds as readonly string[]) {
      for (const edge of Object.keys(edgesOf(schema, of))) for (const other of seen.graph.in(record.id, edge) as unknown as Node[]) if (other.kind === of && nodeOf(other.id)) neighbors.push({ ...brief(other), relation: edge, direction: "in" });
    }
  }
  const recent = seen
    .batches()
    .filter((batch) => !batch.ops.every(isWithheld))
    .slice(-(options.recent ?? 6))
    .reverse()
    .map((batch) => ({ intent: batch.intent, at: batch.at, by: byWords(batch.author) }));
  const jobs = (options.purpose?.jobs ?? []).filter((job) => jobIsFor(job, principal.roles) && visible.has(job.kind)).map((job) => ({ name: job.name, ask: job.ask, kind: job.kind }));
  const purpose = options.purpose && (options.purpose.for !== undefined || jobs.length > 0) ? { ...(options.purpose.for !== undefined ? { for: options.purpose.for } : {}), jobs } : undefined;
  return {
    ...(options.place !== undefined ? { place: options.place } : {}),
    target: targetState,
    selection,
    neighbors: neighbors.slice(0, 24),
    recent,
    schema: schemaDigestOf(whole, principal),
    ...(purpose ? { purpose } : {}),
    ...(options.friction ? { friction: frictionDigest(options.friction, schema, { reader: principal }) } : {}),
  };
}

// ── what an interaction leaves behind ───────────────────────────────────────

/** Which model answered: a Fast one (a typed decision — Jev) or a Thinking one (a language model). */
export type AiTier = "fast" | "thinking";

/** What one call to a model used, as a host meters it. */
export interface AiUsage {
  readonly tier: AiTier;
  readonly model: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  /** What it cost, in US dollars, when the provider says. */
  readonly costUsd?: number;
}

/** What was asked: a suggestion for the target, fills for its fields, a record made, a panel, or words. */
export interface AiAsk {
  readonly kind: "suggest" | "fill" | "record" | "panel" | "ask";
  /** What the person asked, in their words or the menu row's. */
  readonly said: string;
}

/** One thing offered, as the entry keeps it. */
export interface AiOffered {
  readonly id: string;
  readonly type: AiCandidate["type"];
  readonly label: string;
  readonly confidence?: number;
}

/** A panel an interaction made: the recipe it is drawn from again, and its title. */
export interface AiPanel {
  readonly title: string;
  readonly recipe: PanelRecipe;
}

/**
 * AN AI INTERACTION, AS ACTIVITY DRAWS IT AND A HOST STORES IT: who asked,
 * when, about what, what was asked, what was offered and what became of
 * it, the batches it made (each undoable from the entry), a panel it drew,
 * and the models it used with what they cost. Plain JSON, so a host keeps
 * it as it is and hands it back (`HostAi.interactions`).
 */
export interface AiInteraction {
  readonly id: string;
  /** When it was asked, ISO. */
  readonly at: string;
  readonly by: Author;
  readonly target: AiTarget;
  /** The target in words, as it was called when asked. */
  readonly targetLabel: string;
  readonly ask: AiAsk;
  readonly offered: readonly AiOffered[];
  /**
   * What became of it: still waiting (`offered`), all of it taken
   * (`accepted`), some (`partly`), put away (`dismissed`), a panel drawn
   * (`drawn`), or the model failed (`failed`, said in `failed`).
   */
  readonly outcome: "offered" | "accepted" | "partly" | "dismissed" | "drawn" | "failed";
  /** The offered ids that were taken. */
  readonly accepted?: readonly string[];
  /** The batches it made, in order: each carries lineage `interaction: <id>`. */
  readonly batches?: readonly string[];
  readonly panel?: AiPanel;
  /** What a quick ask was answered, in words (`ask.kind` "ask"). */
  readonly answer?: string;
  readonly usage?: readonly AiUsage[];
  readonly failed?: string;
}

/** Whether an interaction concerns a record: its target names it, it offered it, or a batch it made touched it. */
export function interactionTouches(interaction: AiInteraction, record: string, written: (batch: string) => readonly string[] = () => []): boolean {
  return (
    recordsOfTarget(interaction.target).includes(record) ||
    interaction.offered.some((offer) => offer.id === `record:${record}` || offer.id.startsWith(`fill:${record}:`)) ||
    (interaction.batches ?? []).some((batch) => written(batch).includes(record))
  );
}

/** Whether a person asked it: their id, or for an agent, whom it acted for. */
export const interactionBy = (interaction: AiInteraction, person: string): boolean => interaction.by.id === person || interaction.by.onBehalfOf?.id === person;

/** Two lists of entries as one, newest first: a stored entry and this page's copy of it are one entry, the later-changed one kept. */
export function mergeInteractions(...lists: readonly (readonly AiInteraction[])[]): readonly AiInteraction[] {
  const byId = new Map<string, AiInteraction>();
  for (const list of lists) for (const entry of list) byId.set(entry.id, { ...byId.get(entry.id), ...entry });
  return [...byId.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** What the models an interaction used cost together, when any said. */
export function interactionCost(interaction: AiInteraction): number | undefined {
  const costs = (interaction.usage ?? []).flatMap((usage) => (usage.costUsd === undefined ? [] : [usage.costUsd]));
  return costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) : undefined;
}
