import type { z } from "zod";

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
  readonly description?: string;
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
