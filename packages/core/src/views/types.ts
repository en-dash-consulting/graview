import type { AnySchema, KindOfSchema } from "../schema/schema.js";
import type { PagesArrangement } from "../places.js";
import { pluralOf } from "../schema/define-node.js";

/** One node, or a group of them standing in for a kind. */
export type Cardinality = "one" | "many";

/**
 * How much of a node is drawn. This is the axis that keeps receded text
 * legible: a calendar at depth switches to a denser summary view rather than
 * scaling down into mush.
 *
 * - `full`    live DOM, captured every frame it moves
 * - `summary` captured on change into a cached texture
 * - `glyph`   painted in the shader, never captured
 */
export type Fidelity = "full" | "summary" | "glyph";

export const FIDELITIES: readonly Fidelity[] = ["full", "summary", "glyph"];

/** Views form a matrix, not a list. This names one cell of it. */
export interface ViewCell {
  readonly cardinality: Cardinality;
  readonly fidelity: Fidelity;
}

export interface ViewRegistration<V = unknown> {
  readonly kind: string;
  readonly cardinality: Cardinality;
  readonly fidelity: Fidelity;
  readonly view: V;
  /** The place's name, when the registration gave it one. */
  readonly title?: string;
  /** The other kind of a picture over two, when the registration said so. */
  readonly across?: string;
  /** A place beside the kind's own pictures (`ViewMeta.beside`). */
  readonly beside?: boolean;
}

/**
 * What a registration may say about itself beyond the cell it fills.
 *
 * A `title` on a group view makes it a PLACE: a lens over the gardeners is
 * "Who tends what", and an interface can list it, press it, and say where
 * you are. Without a name a lens was only reachable by focusing the group
 * it happened to be registered on, and once you had clicked into a member
 * there was no way to know it existed, let alone get back to it.
 */
export interface ViewMeta {
  readonly title?: string;
  /**
   * For a picture over TWO kinds — a coverage matrix of practices against
   * concerns — the other kind. A drive-in for such a picture stands on the
   * road between the two plots rather than on one of them.
   */
  readonly across?: string;
  /**
   * A PLACE BESIDE THE KIND'S OWN PICTURES: reached by its name, never what
   * the kind draws when an address names no picture. A lens a reader kept
   * from the seat, or one kept into a declaration while the app is open,
   * joins the places without taking its kind's default picture from the
   * app's own registration.
   */
  readonly beside?: boolean;
}

/** A named group view: somewhere to go, by name. */
export interface Place {
  readonly kind: string;
  readonly title: string;
  /** The other kind, when the picture is over two. */
  readonly across?: string;
  /**
   * The short name this place answers to in a stop, from its title.
   *
   * A kind may have SEVERAL pictures — the week and the month are two
   * questions about one pile of tasks — and a stop that could only say
   * which GROUP you were looking at could not say which of them. So a place
   * is addressable: `focus=aggregate:task&in.view=the-month`.
   */
  readonly as: string;
}

/** A place's own name in an address: its title, lower-cased and hyphenated. */
export function placeSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** A kind's list on the routed face: `/<its plural, as a slug>`. */
export function kindPath(schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined }, kind: string): string {
  return `/${placeSlug(pluralOf(schema, kind))}`;
}

/** One record's page on the routed face: its kind's list, then its id, encoded. */
export function recordPath(schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined }, kind: string, id: string): string {
  return `${kindPath(schema, kind)}/${encodeURIComponent(id)}`;
}

/**
 * A named place on the routed face: `/places/<as>`, and `?of=<the kind's
 * plural>` when another kind has a place of the same name (`sharesItsName`).
 */
export function placePath(as: string, of?: string): string {
  return `/places/${encodeURIComponent(as)}${of ? `?of=${encodeURIComponent(of)}` : ""}`;
}

/** Whether another kind has a place of this one's name, so its address has to say which kind's. */
export function sharesItsName(place: { readonly as: string; readonly kind: string }, places: readonly { readonly as: string; readonly kind: string }[]): boolean {
  return places.some((other) => other.as === place.as && other.kind !== place.kind);
}

export interface ViewRegistry<S extends AnySchema, V = unknown> {
  /**
   * Registering a view for a kind the schema never declared is a typecheck
   * failure — `K` is constrained to the schema's kinds, so the mistake
   * surfaces at build time rather than at render.
   */
  register<K extends KindOfSchema<S>>(
    kind: K,
    cell: ViewCell,
    view: V,
    meta?: ViewMeta,
  ): ViewRegistry<S, V>;
  /** The exact cell, with no fallback. */
  lookup(kind: string, cell: ViewCell): V | undefined;
  /** Every named group view, in registration order. */
  places(): readonly Place[];
  /**
   * The best available view for a cell: exact match, then a coarser fidelity,
   * then the primitive fallback the caller supplies.
   *
   * `as` asks for one PLACE in particular — the month rather than the week
   * over the same tasks. A name nothing was registered under falls through
   * to the cell's own view rather than drawing nothing, because an address
   * naming a place that has since been renamed should land you somewhere.
   */
  resolve(kind: string, cell: ViewCell, as?: string): ViewRegistration<V> | undefined;
  all(): readonly ViewRegistration<V>[];
  /**
   * Every registration in the order it was made, a replaced one included —
   * so one registry can be laid over another and land as it was written
   * (`layerViews`), where `all()` answers only what each cell holds now.
   */
  registrations(): readonly ViewRegistration<V>[];
  kindsWithViews(): readonly string[];
  /**
   * THE DECLARATION'S ARRANGEMENT OF ITS PLACES (FR-80), held where the
   * places are held: every face that reads the places reads this beside
   * them — the routed face's gallery and nav, the city's order, the view
   * an app opens on. `arrange` sets it (the last word wins); a registry
   * that was never arranged answers undefined, and every face keeps the
   * declaration's own order.
   */
  arrange?(arrangement: PagesArrangement | undefined): ViewRegistry<S, V>;
  arrangement?(): PagesArrangement | undefined;
  /**
   * THE HOME'S OWN VIEW (FR-81), which no kind owns: what both faces draw
   * as the home's body in place of the derived one, once there is
   * something to show. `home` sets it (the last word wins); a registry
   * that was never given one answers undefined and the home is derived.
   */
  home?(view: V | undefined): ViewRegistry<S, V>;
  homeView?(): V | undefined;
  /**
   * TAKES A PLACE AWAY: the named place `as` over `kind`, and the views it
   * answers to by that name. What the kind draws by default is untouched,
   * so a place registered `beside` leaves no trace. A lens kept from the
   * seat and then taken back goes this way.
   */
  forget?(kind: string, as: string): ViewRegistry<S, V>;
}

const key = (kind: string, cell: ViewCell, as = "") =>
  `${kind}|${cell.cardinality}|${cell.fidelity}|${as}`;

/** Fidelity fallback order, coarsest-first from a given starting point. */
function fallbacks(fidelity: Fidelity): Fidelity[] {
  switch (fidelity) {
    case "full":
      return ["full", "summary", "glyph"];
    case "summary":
      return ["summary", "full", "glyph"];
    case "glyph":
      return ["glyph", "summary", "full"];
  }
}

export function createViewRegistry<S extends AnySchema, V = unknown>(
  _schema: S,
): ViewRegistry<S, V> {
  const entries = new Map<string, ViewRegistration<V>>();
  /** Every named place, in the order it was registered. */
  const named: Place[] = [];
  /** Every registration, in the order it was made. */
  const order: ViewRegistration<V>[] = [];

  let arranged: PagesArrangement | undefined;
  let homeView: V | undefined;

  const registry: ViewRegistry<S, V> = {
    arrange(arrangement) {
      if (arrangement !== undefined) arranged = arrangement;
      return registry;
    },
    arrangement: () => arranged,
    home(view) {
      if (view !== undefined) homeView = view;
      return registry;
    },
    homeView: () => homeView,
    register(kind, cell, view, meta) {
      const registration: ViewRegistration<V> = {
        kind,
        cardinality: cell.cardinality,
        fidelity: cell.fidelity,
        view,
        ...(meta?.title ? { title: meta.title } : {}),
        ...(meta?.across ? { across: meta.across } : {}),
        ...(meta?.beside ? { beside: true } : {}),
      };
      /*
       * A titled registration fills its cell AND stands on its own.
       *
       * The cell is what a group draws by default and the last registration
       * wins it, as it always has — an app replacing the framework's own
       * view is the whole point of the registry. The named copy is what
       * makes a SECOND picture of one group reachable: the week and the
       * month are two questions about one pile of tasks, and before this a
       * kind could only ever have one answer.
       */
      order.push(registration);
      if (!meta?.beside) entries.set(key(kind, cell), registration);
      if (meta?.title) {
        const as = placeSlug(meta.title);
        entries.set(key(kind, cell, as), registration);
        if (cell.cardinality === "many" && !named.some((place) => place.kind === kind && place.as === as)) {
          named.push({ kind, title: meta.title, as, ...(meta.across ? { across: meta.across } : {}) });
        }
      }
      return registry;
    },
    places: () => named,
    forget(kind, as) {
      for (const fidelity of FIDELITIES) entries.delete(key(kind, { cardinality: "many", fidelity }, as));
      const at = named.findIndex((place) => place.kind === kind && place.as === as);
      if (at >= 0) named.splice(at, 1);
      return registry;
    },
    lookup(kind, cell) {
      return entries.get(key(kind, cell))?.view;
    },
    resolve(kind, cell, as) {
      if (as) {
        for (const fidelity of fallbacks(cell.fidelity)) {
          const found = entries.get(key(kind, { cardinality: cell.cardinality, fidelity }, as));
          if (found) return found;
        }
      }
      for (const fidelity of fallbacks(cell.fidelity)) {
        const found = entries.get(key(kind, { cardinality: cell.cardinality, fidelity }));
        if (found) return found;
      }
      // A `one` view standing in for `many` is wrong; a `many` view standing
      // in for `one` is merely dull. Only fall back in the safe direction.
      if (cell.cardinality === "one") {
        for (const fidelity of fallbacks(cell.fidelity)) {
          const found = entries.get(key(kind, { cardinality: "many", fidelity }));
          if (found) return found;
        }
      }
      return undefined;
    },
    registrations: () => order,
    all() {
      return [...entries.values()];
    },
    kindsWithViews() {
      return [...new Set([...entries.values()].map((e) => e.kind))];
    },
  };

  return registry;
}
