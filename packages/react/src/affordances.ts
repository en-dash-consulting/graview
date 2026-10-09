import type { AnySchema } from "@graview/core";
import { edgeOfSelection, kindsOf } from "@graview/layout/view";
import { applyAffordance, deriveAffordances, previewAffordance, type Affordance, type AffordanceSet, type DeriveOptions } from "@graview/tools";
import { useMemo } from "react";
import { useGraph, useGraview } from "./context.js";

/*
 * THE ACTS ON OFFER, as hooks. Apart from `./hooks.ts` because deriving
 * them carries every provider, and a page draws its frame — the strip, the
 * cards — without asking: the inspector, the seat's panel and the pages'
 * acts do, and they are fetched with their face (FR-57).
 */

/**
 * What can be done with the current selection, recomputed whenever the
 * selection or the graph changes.
 *
 * Derivation is cheap enough to run on every selection change — measured
 * under a millisecond on the household example's whole graph — so there is no cache to go
 * stale and no "refresh actions" button.
 */
export function useAffordances<S extends AnySchema>(
  options: DeriveOptions<S> & {
    /**
     * Derive for THESE ids rather than the selection. The seat's panel is
     * about a subject that may be nothing anybody clicked — the place you
     * are looking at — and the acts under its name have to be its own.
     */
    readonly about?: readonly string[];
  } = {},
): AffordanceSet {
  const { store, selection: chosen, principal, providers } = useGraview<S>();
  const { about, ...rest } = options;
  const selection = about ?? chosen;
  const nodes = useGraph<S>();
  return useMemo(() => {
    // A selected kind card or district denotes KINDS; the binding owns those
    // ids, so it translates here and providers only ever see the kinds.
    const kindSelection = [...new Set(selection.flatMap((id) => kindsOf(id)))];
    const edgeSelection = selection
      .map((id) => edgeOfSelection(id))
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);
    // Asked as WHOEVER IS HERE, so what the strip offers is what the store
    // would accept — and what it withholds is stated with a reason rather
    // than quietly missing. The installation's declared providers apply to
    // every surface that asks, unless a caller deliberately overrides.
    return deriveAffordances(store, selection, {
      principal,
      kindSelection,
      edgeSelection,
      ...(providers ? { providers } : {}),
      ...rest,
    });
  }, [store, selection, options, nodes, principal, providers]);
}

/** Runs an affordance, or shows what it would do first. */
export function useApplyAffordance<S extends AnySchema>() {
  const { store, principal } = useGraview<S>();
  return useMemo(
    () => ({
      preview: (affordance: Affordance, args?: Record<string, unknown>) =>
        previewAffordance(store, affordance, args ?? {}),
      apply: (affordance: Affordance, args?: Record<string, unknown>) =>
        applyAffordance(store, affordance, args ?? {}, {
          // The principal, not a bare "human": the store enforces against
          // this and the log attributes to it, and they must be one object.
          author: principal,
        }),
    }),
    [store, principal],
  );
}
