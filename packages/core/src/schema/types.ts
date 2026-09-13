import type { z } from "zod";
import type { Figure } from "./figures.js";

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
   * record, not a tie anyone severs. `graview check` warns about any edge
   * kind some mutation can make and none can break (`edge-without-severer`),
   * because a way in with no way out is usually an oversight; this is the
   * declaration that says it is not. The suppression is the documentation:
   * a reader of the schema learns the edge is append-only on purpose.
   */
  readonly appendOnly?: boolean;
}

export type EdgeMap = Readonly<Record<string, EdgeDeclaration>>;

/**
 * A kind that declares no edges. Deliberately `{}` rather than
 * `Record<string, never>`: the latter has `keyof` of `string`, which makes
 * the edge-target extraction below fall back to its constraint and silently
 * defeat the build-time check.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
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
    /** Overrides the humanised default for a field's label. */
    readonly labels?: Readonly<Record<string, string>>;
    /** Turns a stored value into the words for it. */
    readonly format?: Readonly<Record<string, (value: unknown) => string>>;
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
