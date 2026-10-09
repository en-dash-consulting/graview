import { retryingImport } from "@graview/core/retry";
import { declaredLenses, type AnySchema, type DrawnLens, type GraviewApp } from "@graview/core";
import { lazyModule, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { Suspense } from "react";

/**
 * A DECLARED LENS DRAWS (FR-79), REGISTERED BEFORE IT IS FETCHED.
 *
 * Every lens an app declares with a title is a place: a pill on the bar, a
 * drive-in from altitude, a page at `/places/<as>` — drawn from the
 * declaration alone, so a document a chat wrote and a TypeScript app that
 * never registered a view both get their pictures. `declaredLenses` (in
 * `@graview/core`) decides which lenses draw and with what options, the
 * same list `graview check` and `graview describe` read; this registers a
 * door for each over every kind it stands on, at both cells a place fills
 * (many × full, many × summary).
 *
 * The factories themselves — the timeline, the calendar, the coverage
 * grid, the board, the plan, the reach — are fetched when a door is first
 * drawn (`./declared-lenses.tsx`), as the framework's own views are
 * (FR-57): a page that never draws a lens never carries one.
 *
 * And the declaration's arrangement (FR-80) goes on the registry beside the
 * places, so every face that reads the places reads where they go.
 */
const heavy = lazyModule(retryingImport(() => import("./declared-lenses.js")));

/** Fetch the shipped lenses' factories; resolved, every door draws in the commit it is first drawn in. Rejected when they did not arrive, and asked for again on the next call (FR-139). */
export function fetchDeclaredLenses(): Promise<void> {
  return heavy.load().then(() => undefined);
}

interface DoorProps {
  readonly lens: DrawnLens;
  readonly view: ViewProps<AnySchema>;
}

function Drawn({ lens, view }: DoorProps) {
  const View = heavy.current!.declaredLensView(lens);
  return <View {...view} />;
}

/* Drawn once the factories are here; until then the line, and they are asked for again (FR-139). */
const Arriving = heavy.part((_, props: DoorProps) => <Drawn {...props} />, { what: "This picture" });

/** The view a declared lens draws as, behind a door: the lens itself once its factory is here. */
function doorFor<S extends AnySchema>(lens: DrawnLens): ViewComponent<S> {
  const Door = (view: ViewProps<S>) => {
    // Drawn at once when the factories are here, and the same element either way (`lazyModule`).
    return (
      <Suspense fallback={null}>
        <Arriving lens={lens} view={view as unknown as ViewProps<AnySchema>} />
      </Suspense>
    );
  };
  return Door;
}

const home = lazyModule(retryingImport(() => import("./home-view.js")));

/** Fetch the home view's drawing: the blocks, and nothing of the lenses. Asked for again after it failed (FR-139). */
export function fetchHomeView(): Promise<void> {
  return home.load().then(() => undefined);
}

interface HomeDoorProps {
  readonly blocks: readonly unknown[];
  readonly view: ViewProps<AnySchema>;
}

function HomeDrawn({ blocks, view }: HomeDoorProps) {
  const View = home.current!.homeView(blocks);
  return <View {...view} />;
}

const HomeArriving = home.part((_, props: HomeDoorProps) => <HomeDrawn {...props} />, { what: "The home" });

/** The home view (FR-81) behind a door, fetched when the home first draws it. */
function homeDoor<S extends AnySchema>(blocks: readonly unknown[]): ViewComponent<S> {
  const door = (view: ViewProps<S>) => {
    return (
      <Suspense fallback={null}>
        <HomeArriving blocks={blocks} view={view as unknown as ViewProps<AnySchema>} />
      </Suspense>
    );
  };
  /*
   * A home written as blocks says the app's line itself, under its own
   * headline (`HomeLine`, FR-131). The mark is read by `Symbol.for`, so the
   * routed face's home asks without importing anything of this.
   */
  Object.defineProperty(door, Symbol.for("graview.home-blocks"), { value: true });
  return door;
}

/**
 * Registers every lens the declaration draws as a named place, lays the
 * declaration's arrangement on the registry, and gives it the home's own
 * view when the declaration writes one. Returns the registry.
 *
 * A TypeScript app calls it once over the registry it builds (or starts from
 * `declaredViews(app)`); the embed calls it for every app it mounts.
 * Registered last, a lens is what its kind draws when an address names no
 * picture, as any registration made last is.
 */
export function registerDeclaredLenses<S extends AnySchema>(registry: ReactViewRegistry<S>, app: Pick<GraviewApp<S>, "schema" | "lenses" | "pages" | "home">): ReactViewRegistry<S> {
  // The home's own view, when the declaration writes one (FR-81): both faces draw it in place of the derived home's body.
  if (app.home && app.home.length > 0) registry.home?.(homeDoor<S>(app.home));
  doors(registry, app);
  registry.arrange?.(app.pages);
  return registry;
}

/** Each lens that draws, a door over every kind it stands on; `beside`, a place that takes no kind's default picture and no name a place has. */
function doors<S extends AnySchema>(registry: ReactViewRegistry<S>, app: Pick<GraviewApp<S>, "schema" | "lenses">, beside?: true): void {
  for (const lens of declaredLenses(app as GraviewApp<S>).drawn) {
    if (beside && registry.places().some((place) => place.title === lens.title)) continue;
    const Door = doorFor<S>(lens);
    const meta = { title: lens.title, ...(lens.across ? { across: lens.across } : {}), ...(beside ? { beside } : {}) };
    for (const kind of lens.kinds) {
      registry.register(kind as never, { cardinality: "many", fidelity: "full" }, Door, meta);
      registry.register(kind as never, { cardinality: "many", fidelity: "summary" }, Door, meta);
    }
  }
}

/** A lens as an `add-lens` edit says it: what a reader keeps, and what the seat hands its host. */
export interface KeptLens {
  readonly title: string;
  readonly lens: string;
  readonly on: string;
  readonly bindings?: Readonly<Record<string, unknown>>;
  readonly options?: Readonly<Record<string, unknown>>;
}

/**
 * LENSES JOINING THE PLACES WHILE THE APP IS OPEN — a lens a reader kept
 * from the seat, or one just kept into the declaration — registered beside
 * the app's own: each a door under its name, reached by it, and never what
 * its kind draws when an address names no picture. A lens whose name a
 * place already has, or that does not draw, is passed over.
 */
export function registerLensPlaces<S extends AnySchema>(registry: ReactViewRegistry<S>, schema: S, kept: readonly KeptLens[]): void {
  if (kept.length > 0) doors(registry, { schema, lenses: kept.map(({ lens, ...rest }) => ({ ...rest, name: lens })) as never }, true);
}
