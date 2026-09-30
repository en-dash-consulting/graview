import {
  createViewRegistry,
  type AnySchema,
  type Cardinality,
  type Fidelity,
  type KindOfSchema,
  type NodeOfKind,
  type NodeOfSchema,
  type ViewCell,
  type ViewMeta,
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
  /**
   * THE MOST THIS PICTURE SHOULD DRAW (docs/scale.md). Set where the room is
   * small — a drive-in's thumbnail hands a lens its 24 most relevant members
   * and says so. A lens that reads the store for more than `nodes` (a
   * coverage's columns) holds itself to it; any lens handed fewer than
   * `total` says how many more there are. Absent: the picture is the
   * person's, and draws what it draws.
   */
  readonly budget?: number;
  /** How many members there are in all, when `nodes` is fewer. */
  readonly total?: number;
  readonly fidelity: Fidelity;
  readonly cardinality: Cardinality;
  /**
   * Captured into the scene, or lifted out as a full page. A view MUST render
   * correctly either way; jacking in is a familiarity affordance, not an
   * escape hatch from a scene that does not work.
   */
  readonly mode: ViewMode;
  readonly selected: boolean;
  /**
   * Ids the current selection reaches — itself plus everything one edge
   * away. Absent or empty means nothing is selected, which a view must read
   * as "no emphasis" rather than "nothing is related".
   */
  readonly implicated?: readonly string[];
  /**
   * Ids implicated in a current invariant violation, so a view can mark them
   * where they actually are. A problem you can only find through a list is a
   * problem you have to go looking for.
   */
  readonly flagged?: readonly string[];
  /** This group's members are currently raised onto the relation plane. */
  readonly raised?: boolean;
  /** This group is the kind currently in focus. */
  readonly focused?: boolean;
  /** The aggregate is opened in place, showing its members (the ring). */
  readonly opened?: boolean;
  /** The rows of members an opened district has room for (the layout's `openedRows`). */
  readonly openedRows?: number;
  /**
   * The district's address in the city, when it is drawn at altitude: its
   * corner in lattice cells and how many cells it takes on a side today —
   * which is how many buildings a row holds when it is opened.
   */
  readonly plot?: { readonly col: number; readonly row: number; readonly side: number };
  /** Members behind the horizon: retired, counted, one step away. */
  readonly retired?: number;
  /**
   * How near this kind is to the one in focus: `primary` is one declared edge
   * away, `secondary` is further. Absent when nothing is focused, and when
   * the focus touches nothing — a strip where every card is secondary says
   * no more than one where none is.
   *
   * A view is expected to read it as EMPHASIS, not as a filter: a secondary
   * card is still the same card, quieter.
   */
  readonly rank?: "primary" | "secondary";
  /** Drawn tucked behind another kind's card, because it is reachable only through it. */
  readonly nestedUnder?: string;
  /**
   * The app registered a view of its own for this kind, rather than leaving
   * it on the framework's generic one — so there is a picture to go into.
   *
   * Derived rather than declared: `registerDefaultViews` marks what it
   * registers, and an app's own registration replaces it. True the moment
   * someone writes a lens, false the moment they remove it.
   */
  readonly hasOwnView?: boolean;
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
   *
   * A view written over the whole schema — every lens is, and it is what
   * `graview-lens` tells an app to write — registers on any one kind
   * without a cast. React's `FunctionComponent<P>` is covariant in `P`
   * (its `propTypes`), so a `ViewComponent<S>` was not assignable to
   * `ViewComponent<S, "plot">` and every lens in the framework's own apps
   * carried `as ViewComponent<S>` to get past it; a project following the
   * skill verbatim did not typecheck.
   */
  register<K extends KindOfSchema<S>>(
    kind: K,
    cell: ViewCell,
    view: ViewComponent<S, K> | ViewComponent<S>,
    meta?: ViewMeta,
  ): ReactViewRegistry<S>;
}

export function createViews<S extends AnySchema>(schema: S): ReactViewRegistry<S> {
  return createViewRegistry<S, ViewComponent<S>>(schema) as ReactViewRegistry<S>;
}

export type { Cardinality, Fidelity, ViewCell };

/**
 * The mark a framework-supplied view carries, so a scene can tell a group
 * shown by the framework's own list from one an app gave a picture of its
 * own. From altitude the first is its district; the second keeps its card.
 */
export const DEFAULT_VIEW: unique symbol = Symbol.for("graview.default-view");

/** Marks a view as the framework's own. Returns the same component. */
export function markDefaultView<V extends object>(view: V): V {
  Object.defineProperty(view, DEFAULT_VIEW, { value: true, enumerable: false });
  return view;
}

/** Whether a view is the framework's own rather than the app's. */
export function isDefaultView(view: unknown): boolean {
  return typeof view === "function" && (view as { [DEFAULT_VIEW]?: boolean })[DEFAULT_VIEW] === true;
}
