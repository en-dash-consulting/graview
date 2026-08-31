import type { InvariantDefinition } from "./invariants/types.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import type { Policy } from "./permissions/types.js";
import type { Brand } from "./theme/types.js";
import type { AnySchema } from "./schema/schema.js";
import type { ViewRegistry } from "./views/types.js";

/**
 * Everything one application declares, in one object. `graview check` and
 * the docs generator both read exactly this — an app that can be checked is
 * an app whose whole surface is declared rather than assembled at runtime.
 */
/**
 * A role bound to a node kind, an edge kind, or a field of one of the kinds
 * another role already named.
 *
 * The third form arrived with the third lens. A board binds `slots` to a kind
 * and `fill` to an edge, but `x` and `y` are FIELDS of whatever `slots` turned
 * out to be — so the binding says which role supplies the kind, and the check
 * can then verify the field actually exists on it. That is a stronger check
 * than either of the first two shapes had.
 */
export type EntityBinding =
  | { readonly kind: string }
  | { readonly edge: string }
  | { readonly field: string; readonly on: string };

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
  /**
   * Who may run what. Declared on the app so `graview check` can read it —
   * a mutation no role can ever run and a role that may do nothing are both
   * mistakes in the declaration, findable before anyone meets a button they
   * cannot press.
   */
  readonly policy?: Policy;
  /**
   * The name, the palette and the typography this installation wears.
   *
   * Declared so `graview check` can verify it: a custom palette can be wrong
   * in ways nobody notices — a secondary colour that clears 4.5:1 on a dark
   * ground and fails badly on paper — and contrast is a property the
   * framework can measure rather than trust.
   */
  readonly brand?: Brand;
}

export function defineApp<S extends AnySchema>(app: GraviewApp<S>): GraviewApp<S> {
  return app;
}
