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

/**
 * How a view is being drawn right now.
 *
 * Every view must render correctly in BOTH modes — captured into the scene,
 * and live as a full page. That two-mode contract is the central constraint
 * on the view authoring API, and this is how a view finds out which it is in.
 */
export type ViewMode = "scene" | "fullscreen";

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

/**
 * ONE REGISTRY LAID OVER ANOTHER (FR-36): every registration `over` made,
 * replayed in the order it was made onto `base`, which keeps every cell
 * `over` did not touch. A host that registers one card for one kind gets
 * that card and every default beside it, rather than that card and nothing
 * else. Returns `base`.
 */
export function layerViews<S extends AnySchema>(base: ReactViewRegistry<S>, over: ReactViewRegistry<S>): ReactViewRegistry<S> {
  if (over === base) return base;
  for (const registration of over.registrations()) {
    const meta = {
      ...(registration.title ? { title: registration.title } : {}),
      ...(registration.across ? { across: registration.across } : {}),
      ...(registration.beside ? { beside: true } : {}),
    };
    base.register(registration.kind as KindOfSchema<S>, { cardinality: registration.cardinality, fidelity: registration.fidelity }, registration.view, meta);
  }
  // The arrangement travels with the places it arranges (FR-80).
  const arranged = over.arrangement?.();
  if (arranged) base.arrange?.(arranged);
  // And the home's own view (FR-81).
  const home = over.homeView?.();
  if (home) base.home?.(home);
  return base;
}

export type { Cardinality, Fidelity, ViewCell };

export { DEFAULT_VIEW, isDefaultView, markDefaultView, markReplacesPage, REPLACES_PAGE, replacesPage } from "./view-marks.js";
