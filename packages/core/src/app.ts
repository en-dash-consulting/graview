import type { InvariantDefinition } from "./invariants/types.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import type { AnySchema } from "./schema/schema.js";
import type { ViewRegistry } from "./views/types.js";

/**
 * Everything one application declares, in one object. `graview check` and
 * the docs generator both read exactly this — an app that can be checked is
 * an app whose whole surface is declared rather than assembled at runtime.
 */
/** A role bound to a node kind, or to an edge kind. */
export type EntityBinding =
  | { readonly kind: string; readonly [role: string]: string }
  | { readonly edge: string; readonly [role: string]: string };

export interface LensDeclaration {
  readonly name: string;
  readonly requiredRoles: readonly string[];
  /** Defaults to `fields`, which is what every lens did before there were two. */
  readonly binds?: "fields" | "entities";
  readonly bindings?:
    | Readonly<Record<string, Readonly<Record<string, string>>>>
    | Readonly<Record<string, EntityBinding>>;
}

export interface GraviewApp<S extends AnySchema = AnySchema> {
  readonly name: string;
  readonly schema: S;
  readonly mutations?: readonly AnyMutationDefinition<S>[];
  readonly invariants?: readonly InvariantDefinition<S>[];
  readonly views?: ViewRegistry<S, unknown>;
  /**
   * Roles a lens requires an app to bind, and what it binds them to.
   *
   * Two shapes, because there turned out to be two kinds of lens. A `fields`
   * lens maps a KIND's own field names onto its roles — the timeline asks an
   * app which of its fields are `start` and `end`. An `entities` lens maps
   * roles onto whole kinds and edges — the coverage matrix asks which kind is
   * the rows, which is the columns, and which edge fills a cell.
   *
   * The first shape was assumed to be the only one until a second lens
   * existed, which is the usual way that assumption gets found.
   */
  readonly lenses?: readonly LensDeclaration[];
}

export function defineApp<S extends AnySchema>(app: GraviewApp<S>): GraviewApp<S> {
  return app;
}
