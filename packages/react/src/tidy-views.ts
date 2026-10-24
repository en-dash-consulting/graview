import { FIDELITIES, placeSlug, type AnySchema, type Fidelity, type HomeRegistration, type KeptViews, type KeptViewsState, type Place, type ViewCell, type ViewRegistration, type ViewRegistry } from "@graview/core";
import { hasLanded, markLanded } from "./context.js";
import "./provider.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * THE REGISTRY AS THE HOST'S TIDYING LEAVES IT (Roadmap f-place-menu-views),
 * fetched by `useTidiedViews` the first time a host lists something hidden
 * or deleted: a page whose host has tidied nothing never carries it.
 */

const fallbacks = (fidelity: Fidelity): readonly Fidelity[] => [fidelity, ...FIDELITIES.filter((one) => one !== fidelity)];

/**
 * A REGISTRY AS THE HOST'S TIDYING LEAVES IT: a script view it lists as
 * hidden is a place kept off the lists (`hidden: true`, reached by its
 * address and never its kind's default picture), and one it lists as
 * deleted is no place at all and never drawn — each falling back to what
 * the kind drew before. The registry itself is untouched, and is answered
 * as it is when nothing is tidied. Pure: every face reads the same answer.
 */
export function tidyViews<S extends AnySchema, V>(registry: ViewRegistry<S, V>, state: Pick<KeptViewsState, "hidden" | "removed">): ViewRegistry<S, V> {
  if (state.hidden.length === 0 && state.removed.length === 0) return registry;
  const gone = new Set(state.removed.filter((one) => !one.lens).map((one) => one.name));
  const hid = new Set(state.hidden);
  /*
   * EVERY REGISTRATION A HOST'S VIEW MADE IS TIDIED BY ITS NAME (FR-202),
   * titled or not: a deleted one is never drawn, whatever order the views
   * registered in. Hiding keeps a place off the lists; a view with no title
   * is on none, so only a titled one is kept from its kind's default by it.
   */
  const tidied = (registration: { readonly name?: string; readonly title?: string } | undefined): boolean =>
    registration?.name !== undefined && (gone.has(registration.name) || (registration.title !== undefined && hid.has(registration.name)));
  /* The home's body: the last home given that is not deleted (FR-202). */
  const homes = (): readonly HomeRegistration<V>[] => (registry.homes?.() ?? []).filter((one) => one.name === undefined || !gone.has(one.name));
  /* What a cell draws when nothing tidied may: the last registration that would have won it, as the registry decides. */
  const exact = (kind: string, cardinality: ViewCell["cardinality"], fidelity: Fidelity): ViewRegistration<V> | undefined =>
    [...registry.registrations()].reverse().find((one) => one.kind === kind && one.cardinality === cardinality && one.fidelity === fidelity && !one.beside && !one.hidden && !tidied(one));
  const cellOf = (kind: string, cell: ViewCell): ViewRegistration<V> | undefined => {
    for (const fidelity of fallbacks(cell.fidelity)) {
      const found = exact(kind, cell.cardinality, fidelity);
      if (found) return found;
    }
    if (cell.cardinality === "one") {
      for (const fidelity of fallbacks(cell.fidelity)) {
        const found = exact(kind, "many", fidelity);
        if (found) return found;
      }
    }
    return undefined;
  };
  const tidy: ViewRegistry<S, V> = {
    ...registry,
    register(kind, cell, view, meta) {
      registry.register(kind, cell, view, meta);
      return tidy;
    },
    ...(registry.home
      ? {
          home(view: V | undefined, meta?: { readonly name?: string }) {
            registry.home!(view, meta);
            return tidy;
          },
        }
      : {}),
    ...(registry.homes ? { homes, homeView: () => homes().at(-1)?.view } : {}),
    lookup(kind, cell) {
      return registry.lookup(kind, cell) === undefined ? undefined : exact(kind, cell.cardinality, cell.fidelity)?.view;
    },
    places: () =>
      registry
        .places()
        .filter((place) => !(place.name !== undefined && gone.has(place.name)))
        .map((place): Place => (place.name !== undefined && hid.has(place.name) && !place.hidden ? { ...place, hidden: true } : place)),
    resolve(kind, cell, as) {
      const found = registry.resolve(kind, cell, as);
      if (!found || !tidied(found)) return found;
      // A hidden view is still reached by its own name; a deleted one is not reached at all.
      if (as !== undefined && found.name !== undefined && !gone.has(found.name) && found.title !== undefined && placeSlug(found.title) === as) return found;
      return cellOf(kind, cell);
    },
    all: () => registry.all().filter((one) => !(one.name !== undefined && gone.has(one.name))),
  };
  // A visit that has landed (`pages.first` taken) has landed on the tidied registry too: a view hidden or deleted is not a new visit.
  if (hasLanded(registry)) markLanded(tidy);
  return tidy;
}

/**
 * THE REGISTRY TIDIED AS THE HOST'S VIEWS SAY, NOW AND AS THEY CHANGE:
 * `set` is handed it at once and again on each change; the answer stops
 * listening. What `useTidiedViews` runs, once it has fetched this.
 */
export function watchTidied<S extends AnySchema, V>(views: ViewRegistry<S, V>, keeper: KeptViews, set: (tidied: ViewRegistry<S, V>) => void): () => void {
  let last: KeptViewsState | undefined;
  const tell = () => {
    const now = keeper.current();
    if (last && now.hidden === last.hidden && now.removed === last.removed) return;
    last = now;
    set(tidyViews(views, now));
  };
  tell();
  return keeper.onChange?.(tell) ?? (() => undefined);
}
