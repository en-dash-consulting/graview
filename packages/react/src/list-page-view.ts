import { placeSlug, type AnySchema, type ViewRegistration, type ViewRegistry } from "@graview/core";
import { replacesPage } from "./view-marks.js";

/**
 * WHICH VIEW A KIND'S LIST PAGE DRAWS (FR-238). A view of many whose
 * manifest says `replaces: "page"` is its kind's list page (FR-203), but the
 * page asked only the view that won the kind's default cell — the last
 * registered — so a second view of many on the kind, registered after it,
 * left the plain list at
 * `/<plural>`. Now the list page draws the last view of many over the kind
 * at full that says it replaces the page and is still held: not kept
 * beside the kind's pictures or off the lists, not replaced by a later
 * registration under its title or in its cell, and not taken away by the
 * host's tidying (deleted, or hidden). None, and the list is the app's own.
 * A host calls it to say which view a kind's list page draws.
 */
export function listPageViewOf<S extends AnySchema, V>(registry: ViewRegistry<S, V>, kind: string): ViewRegistration<V> | undefined {
  const held = (one: ViewRegistration<V>): boolean => {
    const cell = { cardinality: "many", fidelity: one.fidelity } as const;
    // A titled view is held at its own place; an untitled one only in the kind's cell, which a later registration takes.
    const now = one.title !== undefined ? registry.resolve(kind, cell, placeSlug(one.title))?.view : registry.lookup(kind, cell);
    return now === one.view;
  };
  return [...registry.registrations()]
    .reverse()
    .find((one) => one.kind === kind && one.cardinality === "many" && one.fidelity === "full" && !one.beside && !one.hidden && replacesPage(one.view) && registry.tidied?.(one) !== true && held(one));
}
