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

/**
 * Registers every lens the declaration draws as a named place, and lays the
 * declaration's arrangement on the registry. Returns the registry.
 *
 * A TypeScript app calls it once over the registry it builds (or starts from
 * `declaredViews(app)`); the embed calls it for every app it mounts.
 * Registered last, a lens is what its kind draws when an address names no
 * picture, as any registration made last is.
 */
export function registerDeclaredLenses<S extends AnySchema>(registry: ReactViewRegistry<S>, app: Pick<GraviewApp<S>, "schema" | "lenses" | "pages">): ReactViewRegistry<S> {
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
