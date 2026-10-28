import type { z } from "zod";
import type { Figure } from "./figures.js";
import type { DerivesDeclaration } from "../keep-linked.js";

/** What an automated author may do to a kind's records on its own: nothing (`never`), or everything but link and unlink them (`no-links`). */
export type KindTidying = "never" | "no-links";

/** How many edges of a kind may leave one node. */
export type EdgeCardinality = "one" | "many";

/**
 * An edge declared on the node kind it leaves. `to` names the kinds it may
 * point at; `"*"` opts out of target checking for genuinely universal edges
 * (the household example's `justifies` is the motivating case).
 */
export interface EdgeDeclaration<TargetKind extends string = string> {
  readonly to: readonly TargetKind[] | "*";
  readonly cardinality?: EdgeCardinality;
  /**
   * How the edge reads FROM THE KIND THAT DECLARES IT — "who does the run",
   * "the tasks in this list".
   */
  readonly description?: string;
  /**
   * How it reads from the OTHER END.
   *
   * An edge has one direction and two readings, and using the declaring side's
   * words for both is how a task's page ended up captioned "the tasks in this
   * list" — as though the task contained tasks. The list holds the task; the
   * task is on a list. Same edge, and neither sentence works in both places.
   *
   * Without one, an incoming edge is captioned with the edge kind in plain
   * words, which says less and is at least not wrong.
   */
  readonly inverse?: string;
  /**
   * Declares that this relation, once made, is never unmade — an entry in a
   * record, not a tie anyone severs. Every relation no act severs is given
   * a derived `disconnect-<kind>-<relation>`, because a way in with no way
   * out is usually an oversight; this is the declaration that says it is
   * not, and the relation is given no disconnect. A reader of the schema
   * learns the edge is append-only on purpose.
   */
  readonly appendOnly?: boolean;
  /**
   * `"never"`: NO AUTOMATED AUTHOR MAKES OR BREAKS THIS RELATION — the app's
   * own actor, tidying, may suggest such a link and a person may make it,
   * but nothing automated applies one (`@graview/core/tidying`). Absent,
   * the relation is tidied like any other.
   */
  readonly tidying?: "never";
  /**
   * `"none"`: NO ACT MAKES OR BREAKS THIS RELATION — it is read from what
   * was declared or imported, as the studio reads an act's `creates` from
   * the declaration it opened. Every other relation no act connects or
   * severs is given a derived `connect-<kind>-<relation>` and
   * `disconnect-<kind>-<relation>`; this one is given neither.
   */
  readonly acts?: "none";
}

export type EdgeMap = Readonly<Record<string, EdgeDeclaration>>;

/**
 * A kind that declares no edges. Deliberately `{}` rather than
 * `Record<string, never>`: the latter has `keyof` of `string`, which makes
 * the edge-target extraction below fall back to its constraint and silently
 * defeat the build-time check.
 */
export type EmptyEdgeMap = {};

/** A field role lets a lens ask for "the start time" without knowing the field name. */
export type FieldRoleMap = Readonly<Record<string, string>>;

export interface NodeDefinitionSpec<
  F extends z.ZodObject<z.ZodRawShape>,
  E extends EdgeMap,
> {
  /** Zod object: the single source of runtime validation, TS types and JSON Schema. */
  readonly fields: F;
  readonly edges?: E;
  /** Human label for one node. Falls back to a `label` field, then the id. */
  readonly label?: (node: { id: string } & z.infer<F>) => string;
  /** Longer prose used for accessibility labels and agent tool descriptions. */
  readonly describe?: (node: { id: string } & z.infer<F>) => string;
  /** Plural noun for aggregates ("People"). Defaults to `kind + "s"`. */
  readonly plural?: string;
  /**
   * What ONE of them is called, in lower case, where the kind's id does not
   * say it: a kind called `staff` whose one member is "a staff member", a
   * kind called `equipment` whose one is "a piece of equipment". Defaults to
   * the id, spoken ("work-order" → "work order").
   */
  readonly noun?: string;
  /**
   * OTHER WORDS PEOPLE SAY FOR ONE, lower case: "supplier" for a vendor.
   * Search finds the kind by them, a model is told them and `graview
   * describe` says them; they are never shown as its name (Roadmap
   * f-learned-suggestions). A document's `aliases`.
   */
  readonly aliases?: readonly string[];
  /** Other words people say for a field, by field: `{ price: ["cost"] }`. A document field's `aliases`. */
  readonly fieldAliases?: Readonly<Record<string, readonly string[]>>;
  readonly description?: string;
  /**
   * Maps a node onto the invariant it requires. The engine uses this to detect
   * nodes whose rule was never registered, and to skip or throw per config.
   */
  readonly requiresInvariant?: (node: { id: string } & z.infer<F>) => string | null;
  /**
   * Names semantic roles the node's own fields fill, so lenses bind to roles
   * rather than field names (`{ start: "at", end: "endsAt" }`).
   */
  readonly fieldRoles?: FieldRoleMap;
  /**
   * How this kind's fields READ to a person.
   *
   * The framework renders a record from the declaration alone, which is most
   * of what makes a new kind usable before anyone writes a view — and it can
   * only get so far on its own. `540` is a truthful rendering of a number of
   * minutes and a useless one; `order: 0` is a truthful rendering of an
   * implementation detail nobody should ever be shown.
   *
   * Both are decisions only the declaration can make, so this is where they
   * are made — once, rather than in every view that renders the kind.
   */
  readonly display?: {
    /** Field names never shown to a person. Ordering keys, internal ids. */
    readonly hide?: readonly string[];
    /** Overrides the humanized default for a field's label. */
    readonly labels?: Readonly<Record<string, string>>;
    /** Turns a stored value into the words for it. */
    readonly format?: Readonly<Record<string, (value: unknown) => string>>;
    /**
     * What a glance at one says — a card, a row in a list, a hit in Find —
     * in order. Unsaid, the first fields the heading does not already say,
     * which for a car declared VIN-first was its VIN and never its price.
     */
    readonly glance?: readonly string[];
    /**
     * HOW A RECORD'S PAGE ORDERS AND GROUPS ITS FACTS (FR-148). Unsaid, a
     * record reads its fields in the order the kind declares them. `fields`
     * come first, in this order; each of `groups` follows under its title;
     * the fields neither names follow in declared order — under "Details"
     * when there are groups, else after `fields`.
     */
    readonly page?: PageFields;
  };
  /**
   * When a node of this kind stops being CURRENT.
   *
   * The graph accumulates; the interface must not. A kind that declares its
   * lifecycle lets every derived surface aggregate over the horizon by
   * default — counts, districts, rosters, violations — with the past one
   * deliberate step away rather than gone. Nothing here deletes: retiring
   * is an ordinary field write through an ordinary mutation, and widening
   * the horizon is ordinary view state.
   *
   * Two shapes, one field: `retired` lists the values that mean "past"
   * (a status enum), or is the string "date", which reads the field as an
   * ISO date after which the node has expired (effectivity's `until`).
   */
  readonly lifecycle?: LifecycleDeclaration;
  /**
   * Fields that NEVER change once set, and why.
   *
   * A field you could set at creation, you can change: every settable field
   * no declared mutation writes is covered by a derived edit act per kind
   * (`edit-<kind>`), so nothing is frozen by accident. Opting OUT is this
   * declaration — the field name, and the sentence that says why it is not
   * yours to change ("the client's words, as sent"). The reason is the
   * documentation: a reader of the schema learns the field is fixed on
   * purpose, and `graview check` stops asking who writes it.
   */
  readonly fixed?: Readonly<Record<string, string>>;
  /**
   * FIELDS ANOTHER SYSTEM KEEPS IN STEP: those a declared connection maps
   * (a Notion database's properties, a calendar event's parts). The other
   * system changes them freely, and its changes land through the derived
   * `edit-<kind>`, so that edit writes them even where another act does too
   * (a status a named step moves, a count an act adds to). A document's
   * kind is given this from its `connections`; a field declared `fixed`
   * stays fixed.
   */
  readonly keptInStep?: readonly string[];
  /**
   * A RECORD THAT FOLLOWS ANOTHER (Roadmap f-keep-linked): its fields
   * worked out from the record of another kind it is linked to, kept in
   * step by the store in the same change as either one's edit
   * (`keep-linked.ts`). A document's kind is given this from its `derives`.
   */
  readonly derives?: DerivesDeclaration;
  /**
   * A REQUIRED FIELD'S DEFAULT, declared beside the schema rather than in it.
   *
   * A zod `.default()` makes parsing invent the value, which is right for a
   * kind declared in TypeScript and wrong for one hydrated from storage,
   * where a missing value must stay missing. A kind compiled from a document
   * keeps its fields' `default`s here instead: they are applied when a record
   * is made, and a repair (`validateGraph`) sets a required field that no
   * longer fits to its default rather than removing the record.
   */
  readonly defaults?: Readonly<Record<string, unknown>>;
  /**
   * A DRAWING OF THE THING, wherever the kind is drawn.
   *
   * Inline SVG — one `viewBox`, `currentColor` strokes, no fill — or the
   * name of one from the shipped set (`FIGURES`). The kind card stands it
   * on its block at altitude, the district carries it beside the plural, a
   * chip draws it where it stays legible, the record and list pages carry
   * it, and the relation key uses it. All from here.
   *
   * A kind without one is drawn exactly as it was. Nothing about a figure
   * is required, and a figure is never decoration: it is line art of the
   * thing, at the isometric city's own angle, or it should not be there.
   */
  readonly figure?: Figure;
  /**
   * WHERE THIS KIND STANDS IN THE CITY, hand-laid, in lattice cells.
   *
   * The map is drawn from the declaration and needs no help; this is for
   * an installation that wants a kind on a particular corner. Used
   * verbatim — `graview check` reports two kinds laid on one block as
   * `plot-overlap`. The studio will write these back one day; a plot is
   * a fact about the declaration, so it belongs here rather than in a
   * person's storage.
   */
  readonly plot?: { readonly col: number; readonly row: number };
  /**
   * THIS KIND STANDS FOR THE PEOPLE (Roadmap f-people-kind): a record of it
   * whose id is a principal's id IS that person. A `self` grant, an `own`
   * sight, a sight `via` a relation, an `ownEnd` grant and a document act's
   * `$me` all read the principal's id as a record of this kind. At most one
   * kind says it (`graview check`: `people-ambiguous`); the installation's
   * `user` does.
   */
  readonly people?: boolean;
  /**
   * `false`: ITS RECORDS ARE NOT SET ASIDE (FR-173). The kind is given no
   * `archive-<kind>`, `unarchive-<kind>` or `merge-<kind>`: what it holds
   * is kept or removed, never archived — a declaration's own parts in the
   * studio, say, where a kind or a field is either in the app or not.
   * `remove-<kind>` is still given. Absent, the kind archives.
   */
  readonly archives?: false;
  /**
   * WHAT THE APP'S OWN ACTOR MAY DO HERE, ON ITS OWN (`@graview/core/tidying`):
   * `"never"`, no automated author changes a record of this kind or its
   * links — "never tidy this kind"; `"no-links"`, it may change their fields
   * but never link or unlink them — "never auto-link Vendors". A person
   * still may, and an actor may still suggest. Absent, the kind is tidied.
   */
  readonly tidying?: KindTidying;
  /**
   * VALUES WORKED OUT, NOT WRITTEN (FR-83): a name and an expression of the
   * rule language (`@graview/core/document`), read like a stored field by
   * every template, view spec, rule, sum and sort — `net: "sum(out('includes'),
   * list * units)"`. Never stored and never writable: no act or edit form
   * offers one. Evaluated on demand over the graph the reader holds, under
   * the reader's step budget, so a seat is served one worked out from what
   * it may see. `graview check` judges each, and a cycle among them.
   */
  readonly computed?: Readonly<Record<string, ComputedField>>;
}

/** A computed field: its expression, or the expression with the words it is shown by. */
export type ComputedField =
  | string
  | {
      readonly expr: string;
      /** What it is called on screen, where its name does not say it. */
      readonly label?: string;
      readonly description?: string;
      /**
       * What it works out, where that is not a plain number: `"duration"`, a
       * whole number of minutes said "1 h 30 min". A document's sum of
       * duration fields says it without being told.
       */
      readonly as?: "duration";
      /**
       * How its number is said, as a stored number field's is (FR-217):
       * money, a fraction as a percent ("82%"), or a whole number of minutes
       * as a duration — and a `unit`, a currency like "EUR" or a measure like
       * "kg". A page, a card and a list's CSV say it so.
       */
      readonly format?: "money" | "percent" | "duration";
      readonly unit?: string;
      /**
       * Kept off what a record says of itself — its page, its card, a row of
       * its list's CSV — while it is still worked out for whatever reads it:
       * a list or a lens sorted by it, a rule, a view, a template (FR-217).
       * A helper like a share used to rank seasons.
       */
      readonly hidden?: boolean;
      /** The currency and locale a document's brand says money in, written by the compile beside `format`; a declaration in code leaves it out. */
      readonly amount?: { readonly format?: "money" | "percent"; readonly unit?: string; readonly currency?: string; readonly locale?: string };
    };

/**
 * How a record's page orders and groups its facts (FR-148): `fields` first,
 * in this order, then each group under its title; what neither names
 * follows in declared order, under "Details" when there are groups.
 */
export interface PageFields {
  readonly fields?: readonly string[];
  readonly groups?: readonly { readonly title: string; readonly fields: readonly string[] }[];
}

export interface LifecycleDeclaration {
  /** The field that carries the node's currency. */
  readonly field: string;
  /** Values meaning "past", or "date" to expire after the field's ISO date. */
  readonly retired: readonly unknown[] | "date";
}

export interface NodeDefinition<
  K extends string = string,
  F extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  E extends EdgeMap = EdgeMap,
> extends NodeDefinitionSpec<F, E> {
  readonly kind: K;
  readonly edges: E;
}

export type AnyNodeDefinition = NodeDefinition<
  string,
  z.ZodObject<z.ZodRawShape>,
  EdgeMap
>;

/**
 * The runtime shape of a node of one declared kind. Distributive on purpose:
 * given a union of declarations this yields a union of node types, not one
 * node with every field intersected.
 */
export type NodeOf<D extends AnyNodeDefinition> = D extends AnyNodeDefinition
  ? { readonly id: string; readonly kind: D["kind"] } & z.infer<D["fields"]>
  : never;

/**
 * Every edge target named across a set of declarations. A `"*"` target is
 * not an array, so it drops out here — a wildcard edge opts out of target
 * checking by construction rather than by a special case.
 */
export type DeclaredEdgeTargets<Defs extends readonly AnyNodeDefinition[]> = {
  [I in keyof Defs]: {
    [N in keyof Defs[I]["edges"]]: Defs[I]["edges"][N]["to"] extends readonly (infer T extends
      string)[]
      ? T
      : never;
  }[keyof Defs[I]["edges"]];
}[number];

/**
 * Build-time guard: an edge pointing at a kind nobody declared makes the
 * whole schema unassignable, so `tsc` fails at the declaration rather than
 * the render.
 */
export type ValidateEdgeTargets<Defs extends readonly AnyNodeDefinition[]> = [
  Exclude<DeclaredEdgeTargets<Defs>, Defs[number]["kind"]>,
] extends [never]
  ? Defs
  : {
      readonly __graviewError: "Edge declared to an undeclared node kind";
      readonly undeclaredKinds: Exclude<
        DeclaredEdgeTargets<Defs>,
        Defs[number]["kind"]
      >;
    };
