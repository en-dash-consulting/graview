import type { AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import type { ViewSpecsByKind } from "@graview/core/document";
import { createViews, lazyModule, markDefaultView, type Cardinality, type Fidelity, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";

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
const heavy = lazyModule(retryingImport(() => import("./framework-views.js")));

/**
 * Fetch the framework's own views; resolved, every door draws in the commit
 * it is first drawn in. Rejected when they did not arrive, and asked for
 * again on the next call (FR-139).
 */
export function fetchFrameworkViews(): Promise<void> {
  return heavy.load().then(() => undefined);
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
  const View = heavy.current!.frameworkViews(schema, specs).lookup(kind as never, { cardinality: view.cardinality, fidelity: view.fidelity }) as ViewComponent<AnySchema> | undefined;
  return View ? <View {...view} /> : null;
}

/* Drawn once they are here; until then the line, and they are asked for again (FR-139). */
const Arriving = heavy.part((_, props: DoorProps) => <Drawn {...props} />, { what: "This view" });

/** Registers a door for every cell the framework's own views fill: its defaults, and the declaration's specs over them. */
export function registerFrameworkViews<S extends AnySchema>(registry: ReactViewRegistry<S>, schema: S, specs: ViewSpecsByKind | undefined): ReactViewRegistry<S> {
  for (const kind of schema.kinds as readonly string[]) {
    const slots = specs?.[kind];
    for (const cell of CELLS) {
      const Door: ViewComponent<S> = (view: ViewProps<S>) => {
        // Drawn at once when the views are here, and the same element either way (`lazyModule`).
        return <Arriving schema={schema} specs={specs} kind={kind} view={view as unknown as ViewProps<AnySchema>} />;
      };
      const bySpec = cell.slot !== undefined && slots?.[cell.slot] !== undefined;
      // What a declared page or row says (`pageSays`), asked through the door of the view it opens onto once that has arrived.
      if (bySpec) {
        (Door as { says?: unknown }).says = (node: unknown, graph: unknown) => {
          const View = heavy.current?.frameworkViews(schema, specs).lookup(kind as never, { cardinality: cell.cardinality, fidelity: cell.fidelity }) as { says?: (node: unknown, graph: unknown) => unknown } | undefined;
          return View?.says?.(node, graph);
        };
      }
      registry.register(kind as never, { cardinality: cell.cardinality, fidelity: cell.fidelity }, bySpec ? Door : markDefaultView(Door));
    }
  }
  return registry;
}

/** The framework's own views behind doors, in a registry of their own: what an embed's frame starts from. */
export function frameworkViewDoors<S extends AnySchema>(schema: S, specs: ViewSpecsByKind | undefined): ReactViewRegistry<S> {
  return registerFrameworkViews(createViews(schema), schema, specs);
}
