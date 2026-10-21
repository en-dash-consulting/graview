import type { AnySchema, KindOfSchema } from "../schema/schema.js";

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
  /** Every kind the one picture is over, when it is over several (`ViewMeta.over`). */
  readonly over?: readonly string[];
  /** A place kept off the lists (`ViewMeta.hidden`). */
  readonly hidden?: boolean;
  /** The name the host keeps this view by (`ViewMeta.name`). */
  readonly name?: string;
  /** A lens the declaration declares (`ViewMeta.declared`). */
  readonly declared?: boolean;
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
  /**
   * ONE PICTURE OVER SEVERAL KINDS: every kind it is registered on. A
   * timetable of talks and workshops is registered on both kinds, so either
   * district goes in to it; this says the registrations are one picture, so
   * every list of places names it once.
   */
  readonly over?: readonly string[];
  /**
   * A PLACE KEPT OFF THE LISTS: reached by its address, a link or
   * `graview.navigate`, but not offered by the bar's places, the page list
   * or the home's gallery — a link target of a custom home rather than a
   * way of looking a person picks. It never takes its kind's own cell
   * either: what a kind draws when an address names no picture is a place
   * a person can find.
   */
  readonly hidden?: boolean;
  /**
   * THE NAME THE HOST KEEPS THIS VIEW BY: a script view's manifest name
   * (`registerWorkerView` says it). What the place menu hands the host's
   * `keptViews` to hide, show, delete and restore it (Roadmap
   * f-place-menu-views); a view the app's own code registers says none,
   * and the place menu offers it neither.
   */
  readonly name?: string;
  /**
   * A LENS THE DECLARATION DECLARES (`app.lenses`), registered by
   * `registerDeclaredLenses`: hidden and deleted as a change to the
   * declaration (`set-lens-hidden`, `remove-lens`), by whoever may change it.
   */
  readonly declared?: boolean;
  /**
   * WHAT THE PICTURE IS, for whoever matches an ask to the places: a
   * shipped lens's name ("columns", "calendar"…), or "view" for a worker
   * view. The menu reads it to offer the board an app has before drawing
   * a second one.
   */
  readonly lens?: string;
  /** The other kinds the picture reads beyond its own: a worker view's manifest `reads.kinds`. */
  readonly reads?: readonly string[];
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
  /**
   * EVERY KIND THIS ONE PICTURE IS OVER, when it is over several: the
   * timetable of talks and workshops is a place on each kind — either
   * district goes in to it — and one place in every list (`onePerPicture`).
   */
  readonly over?: readonly string[];
  /** Kept off the lists (`ViewMeta.hidden`): reached by its address, a link or `navigate`, never offered. */
  readonly hidden?: boolean;
  /** The name the host keeps it by (`ViewMeta.name`): a script view's. */
  readonly name?: string;
  /** A lens the declaration declares (`ViewMeta.declared`). */
  readonly declared?: boolean;
  /** What the picture is (`ViewMeta.lens`): a shipped lens's name, or "view" for a worker view. */
  readonly lens?: string;
  /** The other kinds it reads beyond its own (`ViewMeta.reads`). */
  readonly reads?: readonly string[];
}

/**
 * A VIEW THE HOST KEEPS, AS THE DECLARATION'S ARRANGEMENT NAMES IT: a
 * script view's manifest (its `name`, `title`, `attach` and `cardinality`;
 * a `WorkerViewManifest` is one), and whether the host keeps it off the
 * lists. The declaration names one as `view:<its name>` in `pages.order`,
 * `pages.first` and `pages.primary`; a host hands its views to
 * `editDocument`, `compileDocument` and `placesOf` (`views`) so a title
 * resolves to that name and the places list it where it is ordered.
 */
export interface HostView {
  readonly name: string;
  readonly title?: string;
  /** The kind it is a picture of, or "home". */
  readonly attach: string;
  readonly cardinality?: "one" | "many";
  /** Kept off the lists by the host. */
  readonly hidden?: boolean;
}

/** How the arrangement names a host's view: `view:<its manifest name>`. */
export const VIEW_REFERENCE = "view:";

/** A place as the lists compare it: its name, its kind, and every kind when it is one picture over several. */
type Pictured = { readonly as: string; readonly kind: string; readonly over?: readonly string[] };

/** Whether two places are one picture: one name, and one picture over both kinds. */
export const samePicture = (a: Pictured, b: Pictured): boolean => a.as === b.as && (a.over ?? [a.kind]).includes(b.kind);

/**
 * EACH PICTURE ONCE: a picture over several kinds is a place on each, and
 * listed under the first of them that is here. What every list of places
 * reads — the bars, the pages, Find, the seat's places.
 */
export const onePerPicture = <P extends Pictured>(places: readonly P[]): P[] => places.filter((place, at) => !places.slice(0, at).some((held) => samePicture(held, place)));

/** A place's own name in an address: its title, lower-cased and hyphenated. */
export function placeSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * A kind's list on the routed face: `/<its plural, as a slug>` — the
 * declared plural, else the kind's name as written and an "s", so a route
 * does not move when the words a kind is said in do.
 */
export function kindPath(schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined }, kind: string): string {
  return `/${placeSlug(schema.tryDefinition(kind)?.plural ?? `${kind}s`)}`;
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

/** Whether another kind has a DIFFERENT picture of this one's name, so its address has to say which kind's. */
export function sharesItsName(place: Pictured, places: readonly Pictured[]): boolean {
  return places.some((other) => other.as === place.as && !samePicture(place, other));
}

/**
 * WHAT A PLACE IS CALLED IN A LIST: its title, and — when another kind has
 * a different picture of the same name — whose, "The timetable · talks",
 * so two entries never read alike.
 */
export function placeLabel(place: Pictured & { readonly title: string }, places: readonly Pictured[], schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined }): string {
  return sharesItsName(place, places) ? `${place.title} · ${(schema.tryDefinition(place.kind)?.plural ?? `${place.kind}s`).toLowerCase()}` : place.title;
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
      // One picture over several kinds says so on each registration and each place it makes; one kept off the lists, likewise.
      const over = { ...(meta?.over?.[1] ? { over: meta.over } : {}), ...(meta?.hidden ? { hidden: true } : {}), ...(meta?.name ? { name: meta.name } : {}), ...(meta?.declared ? { declared: true } : {}) };
      const registration: ViewRegistration<V> = {
        kind,
        cardinality: cell.cardinality,
        fidelity: cell.fidelity,
        view,
        ...(meta?.title ? { title: meta.title } : {}),
        ...(meta?.across ? { across: meta.across } : {}),
        ...(meta?.beside ? { beside: true } : {}),
        ...over,
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
      // A place beside the kind's pictures, or one kept off the lists, is reached by its name alone.
      if (!meta?.beside && !over.hidden) entries.set(key(kind, cell), registration);
      if (meta?.title) {
        const as = placeSlug(meta.title);
        entries.set(key(kind, cell, as), registration);
        if (cell.cardinality === "many" && !named.some((place) => place.kind === kind && place.as === as)) {
          named.push({ kind, title: meta.title, as, ...(meta.across ? { across: meta.across } : {}), ...over, ...(meta.lens ? { lens: meta.lens } : {}), ...(meta.reads?.length ? { reads: meta.reads } : {}) });
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

/**
 * WHERE THE HOME PUTS THINGS AND WHERE THE APP OPENS (FR-80).
 *
 *   pages: { order: ["offer", "package", "signal"], hide: ["party"], first: "The offers" }
 *
 * `order` is the kinds in the order the home, the routed face's nav and the
 * city at altitude walk them; kinds it does not name follow in the order
 * they were declared. `hide` takes kinds off the home — their cards and
 * counts — and nowhere else: a hidden kind keeps its list, its records,
 * its links and its search results. `first` is where the app opens: a
 * place by its title or address word, a kind by its name or plural, or
 * `"home"`. `scene` and `pages` are what the bar's switch calls the two
 * faces (FR-137).
 */
export interface PagesArrangement {
  /**
   * WHAT COMES FIRST IN THE PLACES: kinds by name, and the host's views
   * as `view:<its manifest name>` — a view named here is listed among the
   * kinds' lists where it is named, not with the other pictures. A view
   * not registered here yet is passed over until it is.
   *
   *   pages: { order: ["view:to-do", "task", "project"] }
   */
  readonly order?: readonly string[];
  /**
   * KINDS KEPT OFF THE BAR'S PLACES AND THE FRONT PAGE: each still at its
   * address, in Find, and reached from wherever it is linked; the bar
   * lists one only while it is the place you are on.
   */
  readonly hide?: readonly string[];
  /** Where a new visit lands: a place's title, a kind, `view:<name>` for a host's view, or "home". */
  readonly first?: string;
  /**
   * WHAT THE BAR'S SWITCH CALLS THE SCENE (FR-137): "Scene" when the
   * declaration says none. Its address stays `/places/overview` whatever
   * it is called (FR-132).
   */
  readonly scene?: string;
  /** WHAT THE SWITCH CALLS THE ROUTED FACE (FR-137): "Pages" when the declaration says none. */
  readonly pages?: string;
  /**
   * THE PLACES THAT STAND ON THE BAR (FR-145, ranked): kinds by name or
   * plural and pictures by title or address word, each of which stands on
   * the bar's row beside Home when there is room; every other place folds
   * into "More". Unsaid, the bar derives it (`supportingKinds`): the main
   * kinds and their pictures stand, the machinery folds. At most
   * `MOST_STANDING` stand however many are named.
   *
   *   pages: { primary: ["task", "list", "The week"] }
   */
  readonly primary?: readonly string[];
  /**
   * WHAT EACH KIND'S LIST OFFERS TO FILTER BY, by kind: its `filters`, in
   * order — a field, a relation, `is`, or `<relation>.<field>` for a choice
   * on the record at a relation's far end. The choice fields among them
   * stand over the list as chips with counts; the rest are under Filter.
   * Unsaid, the list offers every way but a relation to a kind with many
   * records, and its first two choice fields as chips.
   *
   *   pages: { lists: { request: { filters: ["status", "area", "became.stage"] } } }
   */
  readonly lists?: Readonly<Record<string, KindList>>;
}

/**
 * ONE KIND'S LIST, AS THE DECLARATION OPENS IT: what it offers to filter
 * by, the order it opens in, and how it opens grouped. The order and the
 * grouping are where the list starts, not a rule: a person sorts or groups
 * it another way, and the address says so.
 *
 *   lists: { request: {
 *     filters: ["status", "area"],
 *     sort: { by: "votes", direction: "desc", then: "label" },
 *     group: { by: "status", order: ["new", "planned", "done", "declined"], closed: ["done", "declined"] },
 *   } }
 */
export interface KindList {
  readonly filters?: readonly string[];
  /** A field, a computed field or `label`, lowest first — or with a direction and a tiebreak. */
  readonly sort?: string | KindListSort;
  /** A choice or yes-or-no field — or with the groups' order and which are closed. */
  readonly group?: string | KindListGroup;
}

export interface KindListSort {
  /** `label`, a field, or a computed field (a rank worked out from the record). */
  readonly by: string;
  /** `asc` (lowest, earliest, A to Z first) when unsaid. */
  readonly direction?: "asc" | "desc";
  /** What orders records that tie: a key, ascending, or `{ by, direction }`. */
  readonly then?: string | { readonly by: string; readonly direction?: "asc" | "desc" };
}

export interface KindListGroup {
  /** A choice field, or a yes-or-no field (its values `"true"` and `"false"`). */
  readonly by: string;
  /** The groups in this order; the values it leaves out follow in their declared order. */
  readonly order?: readonly string[];
  /** The groups drawn last and closed, each said with its count ("done · 12"): what is finished with. */
  readonly closed?: readonly string[];
}
