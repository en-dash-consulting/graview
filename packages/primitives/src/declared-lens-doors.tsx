import { declaredLenses, type AnySchema, type DrawnLens, type GraviewApp } from "@graview/core";
import type { ReactViewRegistry, ViewComponent, ViewProps } from "@graview/react/provider";
import { lazy, Suspense, useState, type ComponentType } from "react";

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
type Heavy = typeof import("./declared-lenses.js");
let heavy: Heavy | undefined;
let fetching: Promise<void> | undefined;

/** Fetch the shipped lenses' factories; resolved, every door draws in the commit it is first drawn in. */
export function fetchDeclaredLenses(): Promise<void> {
  return (fetching ??= import("./declared-lenses.js").then((lenses) => {
    heavy = lenses;
  }));
}

interface DoorProps {
  readonly lens: DrawnLens;
  readonly view: ViewProps<AnySchema>;
}

function Drawn({ lens, view }: DoorProps) {
  const View = heavy!.declaredLensView(lens);
  return <View {...view} />;
}

const Arriving = lazy(() => fetchDeclaredLenses().then(() => ({ default: Drawn as ComponentType<DoorProps> })));

/** The view a declared lens draws as, behind a door: the lens itself once its factory is here. */
function doorFor<S extends AnySchema>(lens: DrawnLens): ViewComponent<S> {
  const Door = (view: ViewProps<S>) => {
    // Which of the two this door is, it stays: a change of element would draw the lens again from nothing.
    const [here] = useState(() => heavy !== undefined);
    const props: DoorProps = { lens, view: view as unknown as ViewProps<AnySchema> };
    return here ? (
      <Drawn {...props} />
    ) : (
      <Suspense fallback={null}>
        <Arriving {...props} />
      </Suspense>
    );
  };
  return Door;
}

type HomeModule = typeof import("./home-view.js");
let home: HomeModule | undefined;
let fetchingHome: Promise<void> | undefined;

/** Fetch the home view's drawing: the blocks, and nothing of the lenses. */
export function fetchHomeView(): Promise<void> {
  return (fetchingHome ??= import("./home-view.js").then((module) => {
    home = module;
  }));
}

interface HomeDoorProps {
  readonly blocks: readonly unknown[];
  readonly view: ViewProps<AnySchema>;
}

function HomeDrawn({ blocks, view }: HomeDoorProps) {
  const View = home!.homeView(blocks);
  return <View {...view} />;
}

const HomeArriving = lazy(() => fetchHomeView().then(() => ({ default: HomeDrawn as ComponentType<HomeDoorProps> })));

/** The home view (FR-81) behind a door, fetched when the home first draws it. */
function homeDoor<S extends AnySchema>(blocks: readonly unknown[]): ViewComponent<S> {
  const door = (view: ViewProps<S>) => {
    const [here] = useState(() => home !== undefined);
    const props: HomeDoorProps = { blocks, view: view as unknown as ViewProps<AnySchema> };
    return here ? (
      <HomeDrawn {...props} />
    ) : (
      <Suspense fallback={null}>
        <HomeArriving {...props} />
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
  for (const lens of declaredLenses(app as GraviewApp<S>).drawn) {
    const Door = doorFor<S>(lens);
    const meta = { title: lens.title, ...(lens.across ? { across: lens.across } : {}) };
    for (const kind of lens.kinds) {
      registry.register(kind as never, { cardinality: "many", fidelity: "full" }, Door, meta);
      registry.register(kind as never, { cardinality: "many", fidelity: "summary" }, Door, meta);
    }
  }
  registry.arrange?.(app.pages);
  return registry;
}
