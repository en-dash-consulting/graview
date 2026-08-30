import {
  createViewRegistry,
  type AnySchema,
  type Cardinality,
  type Fidelity,
  type KindOfSchema,
  type NodeOfKind,
  type NodeOfSchema,
  type ViewCell,
  type ViewRegistry,
} from "@graview/core";
import type { ComponentType } from "react";
import type { ViewMode } from "./context.js";

/**
 * What a view receives. Deliberately small: a node (or a group of them), how
 * it is being drawn, and whether it is selected.
 *
 * Everything else a view needs it gets from ordinary hooks, because views are
 * ordinary React components. That is the entire reason the capture approach
 * is worth its cost — authors write normal components, not a scene DSL.
 */
export interface ViewProps<S extends AnySchema, K extends KindOfSchema<S> = KindOfSchema<S>> {
  /** The node, for a `one` view. */
  readonly node?: NodeOfKind<S, K>;
  /** The members, for a `many` view standing in for a kind. */
  readonly nodes?: readonly NodeOfSchema<S>[];
  /** Plural label for an aggregate, from the kind's declaration. */
  readonly label?: string;
  readonly fidelity: Fidelity;
  readonly cardinality: Cardinality;
  /**
   * Captured into the scene, or lifted out as a full page. A view MUST render
   * correctly either way; jacking in is a familiarity affordance, not an
   * escape hatch from a scene that does not work.
   */
  readonly mode: ViewMode;
  readonly selected: boolean;
}

export type ViewComponent<
  S extends AnySchema,
  K extends KindOfSchema<S> = KindOfSchema<S>,
> = ComponentType<ViewProps<S, K>>;

export interface ReactViewRegistry<S extends AnySchema>
  extends ViewRegistry<S, ViewComponent<S>> {
  /**
   * Registering a view for a kind the schema never declared is a TYPECHECK
   * failure — `K` is constrained to the schema's kinds, so the mistake
   * surfaces at build time rather than at render.
   */
  register<K extends KindOfSchema<S>>(
    kind: K,
    cell: ViewCell,
    view: ViewComponent<S, K>,
  ): ReactViewRegistry<S>;
}

export function createViews<S extends AnySchema>(schema: S): ReactViewRegistry<S> {
  return createViewRegistry<S, ViewComponent<S>>(schema) as ReactViewRegistry<S>;
}

export type { Cardinality, Fidelity, ViewCell };
