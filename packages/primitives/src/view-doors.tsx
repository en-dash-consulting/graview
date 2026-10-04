import type { AnySchema } from "@graview/core";
import type { ViewSpecsByKind } from "@graview/core/document";
import { createViews, markDefaultView, type Cardinality, type Fidelity, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { lazy, useState, type ComponentType } from "react";

/**
 * THE FRAMEWORK'S OWN VIEWS, REGISTERED BEFORE THEY ARE FETCHED (FR-57).
 *
 * An embed builds its registry in its frame — the provider holds it, and a
 * host's own views are laid over it (FR-36) — but nothing in the frame
 * draws a view: the faces do. `registerDefaultViews` and `registerViewSpecs`
 * carried every default card, row, page and district into a page's first
 * chunk all the same. This registers, for every cell the framework fills, a
 * door to the view it would have registered there — the same cells, the
 * same default marks (a cell a spec fills is not a default), the same
 * drawing once it is here — and the views themselves come with the face
 * (`fetchFrameworkViews`, which an embed's face asks for beside its own
 * chunk). A door drawn before they arrive waits for them.
 */
type Heavy = typeof import("./framework-views.js");
let heavy: Heavy | undefined;
let fetching: Promise<void> | undefined;

/** Fetch the framework's own views; resolved, every door draws in the commit it is first drawn in. */
export function fetchFrameworkViews(): Promise<void> {
  return (fetching ??= import("./framework-views.js").then((views) => {
    heavy = views;
  }));
}

const CELLS: readonly { readonly cardinality: Cardinality; readonly fidelity: Fidelity; readonly slot?: "page" | "card" | "row" }[] = [
  { cardinality: "one", fidelity: "full", slot: "page" },
  { cardinality: "one", fidelity: "summary", slot: "card" },
  { cardinality: "one", fidelity: "glyph", slot: "row" },
  { cardinality: "many", fidelity: "full" },
  { cardinality: "many", fidelity: "summary" },
  { cardinality: "many", fidelity: "glyph" },
];

interface DoorProps {
  readonly schema: AnySchema;
  readonly specs: ViewSpecsByKind | undefined;
  readonly kind: string;
  readonly view: ViewProps<AnySchema>;
}

/** The view the framework registered for this cell, drawn with the props the door was. */
function Drawn({ schema, specs, kind, view }: DoorProps) {
  const View = heavy!.frameworkViews(schema, specs).lookup(kind as never, { cardinality: view.cardinality, fidelity: view.fidelity }) as ViewComponent<AnySchema> | undefined;
  return View ? <View {...view} /> : null;
}

const Arriving = lazy(() => fetchFrameworkViews().then(() => ({ default: Drawn as ComponentType<DoorProps> })));

/** Registers a door for every cell the framework's own views fill: its defaults, and the declaration's specs over them. */
export function registerFrameworkViews<S extends AnySchema>(registry: ReactViewRegistry<S>, schema: S, specs: ViewSpecsByKind | undefined): ReactViewRegistry<S> {
  for (const kind of schema.kinds as readonly string[]) {
    const slots = specs?.[kind];
    for (const cell of CELLS) {
      const Door: ViewComponent<S> = (view: ViewProps<S>) => {
        // Which of the two this door is, it stays: a change of element would draw the view again from nothing.
        const [here] = useState(() => heavy !== undefined);
        const props: DoorProps = { schema, specs, kind, view: view as unknown as ViewProps<AnySchema> };
        return here ? <Drawn {...props} /> : <Arriving {...props} />;
      };
      const bySpec = cell.slot !== undefined && slots?.[cell.slot] !== undefined;
      registry.register(kind as never, { cardinality: cell.cardinality, fidelity: cell.fidelity }, bySpec ? Door : markDefaultView(Door));
    }
  }
  return registry;
}

/** The framework's own views behind doors, in a registry of their own: what an embed's frame starts from. */
export function frameworkViewDoors<S extends AnySchema>(schema: S, specs: ViewSpecsByKind | undefined): ReactViewRegistry<S> {
  return registerFrameworkViews(createViews(schema), schema, specs);
}
