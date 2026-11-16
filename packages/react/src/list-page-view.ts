import { placeSlug, type AnySchema, type ViewRegistration, type ViewRegistry } from "@graview/core";
import { replacesPage } from "./view-marks.js";

/**
 * WHICH VIEW A KIND'S LIST PAGE DRAWS (FR-238). A view of many whose
 * manifest says `replaces: "page"` is its kind's list page (FR-203), but the
 * page asked only the view that won the kind's default cell — the last
 * registered — so a second view of many on the kind, registered after it,
 * left the plain list at `/<plural>`. Now the list page draws the last view
 * of many over the kind at full that says it replaces the page and is still
 * registered, whatever won the cell: not kept beside the kind's pictures or
 * off the lists, not taken away by the host's tidying (deleted, or hidden),
 * and not replaced since — by a later registration under its name, under
 * its title where it has one, or, where it has none, by a later untitled
 * one in its cell. None, and the list is the app's own. A host calls it to
 * say which view a kind's list page draws.
 */
export function listPageViewOf<S extends AnySchema, V>(registry: ViewRegistry<S, V>, kind: string): ViewRegistration<V> | undefined {
  const every = registry.registrations();
  const kept = (one: ViewRegistration<V>): boolean => registry.tidied?.(one) !== true;
  const replaced = (one: ViewRegistration<V>, at: number): boolean => {
    const slug = one.title !== undefined ? placeSlug(one.title) : undefined;
    /*
     * A titled view whose place was taken away (`forget`) is no longer
     * registered. Its place may be listed under an earlier registration's
     * name the host deleted, so a place the registry still answers by the
     * title with this view is held too.
     */
    if (
      slug !== undefined &&
      !registry.places().some((place) => place.kind === kind && place.as === slug) &&
      registry.resolve(kind, { cardinality: "many", fidelity: one.fidelity }, slug)?.view !== one.view
    )
      return true;
    return every.slice(at + 1).some(
      (later) =>
        later.kind === kind &&
        later.cardinality === "many" &&
        ((one.name !== undefined && later.name === one.name) ||
          (later.fidelity === one.fidelity &&
            kept(later) &&
            (slug !== undefined ? later.title !== undefined && placeSlug(later.title) === slug : later.title === undefined && !later.beside && !later.hidden))),
    );
  };
  for (let at = every.length - 1; at >= 0; at--) {
    const one = every[at]!;
    if (one.kind === kind && one.cardinality === "many" && one.fidelity === "full" && !one.beside && !one.hidden && replacesPage(one.view) && kept(one) && !replaced(one, at)) return one;
  }
  return undefined;
}
