import type { AnySchema } from "@graview/core";
import {
  fromUrl,
  toggleExpanded,
  toUrl,
  withFocus,
  withRelation,
  type ViewState,
} from "@graview/layout";
import {
  applyAffordance,
  deriveAffordances,
  previewAffordance,
  type Affordance,
  type AffordanceSet,
  type DeriveOptions,
} from "@graview/tools";
import { useCallback, useEffect, useMemo } from "react";
import { useGraph, useGraview } from "./context.js";

/** The current selection, and the ways an interface changes it. */
export function useSelection() {
  const { selection, setSelection } = useGraview();
  return useMemo(
    () => ({
      selection,
      set: (ids: readonly string[]) => setSelection(ids),
      clear: () => setSelection([]),
      toggle: (id: string) =>
        setSelection((current) =>
          current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
        ),
      isSelected: (id: string) => selection.includes(id),
    }),
    [selection, setSelection],
  );
}

/**
 * What can be done with the current selection, recomputed whenever the
 * selection or the graph changes.
 *
 * Derivation is cheap enough to run on every selection change — measured
 * under a millisecond on the household example's whole graph — so there is no cache to go
 * stale and no "refresh actions" button.
 */
export function useAffordances<S extends AnySchema>(
  options: DeriveOptions<S> = {},
): AffordanceSet {
  const { store, selection } = useGraview<S>();
  const nodes = useGraph<S>();
  return useMemo(
    () => deriveAffordances(store, selection, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, selection, options, nodes],
  );
}

/** Runs an affordance, or shows what it would do first. */
export function useApplyAffordance<S extends AnySchema>() {
  const { store } = useGraview<S>();
  return useMemo(
    () => ({
      preview: (affordance: Affordance, args?: Record<string, unknown>) =>
        previewAffordance(store, affordance, args ?? {}),
      apply: (affordance: Affordance, args?: Record<string, unknown>) =>
        applyAffordance(store, affordance, args ?? {}, {
          author: { kind: "human" },
        }),
    }),
    [store],
  );
}

/** Navigation: every stop is a view, and every view is a URL. */
export function useNavigation() {
  const { view, setView } = useGraview();
  return useMemo(
    () => ({
      view,
      url: toUrl(view),
      focus: (id: string | null) => setView((current) => withFocus(current, id)),
      show: (relation: string | null) => setView((current) => withRelation(current, relation)),
      toggle: (aggregateId: string) =>
        setView((current) => toggleExpanded(current, aggregateId)),
      go: (next: ViewState) => setView(next),
    }),
    [view, setView],
  );
}

/**
 * Keeps the view in the URL fragment and honours the back button.
 *
 * The back button returning to the exact prior view is not a nicety here: it
 * is the thing that makes a spatial interface navigable at all, because it
 * means no arrangement is ever unreachable once you have left it.
 */
export function useUrlSync(): void {
  const { view, setView } = useGraview();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setView(fromUrl(window.location.hash));
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, [setView]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = toUrl(view);
    // Only push when the view actually changed, or the back stack fills with
    // duplicates and the back button stops meaning anything.
    if (window.location.hash === next) return;
    window.history.pushState(null, "", next);
  }, [view]);
}

/**
 * "Jack in": lift one view out of the scene into a conventional full page.
 *
 * A FAMILIARITY affordance, not an interactivity escape hatch. Because
 * pointer routing keeps the in-scene view fully interactive, jacking in is a
 * comfort for a novel interface rather than a requirement to get work done —
 * and every view has to render correctly both ways.
 */
export function useJackIn() {
  const { jackedIn, setJackedIn } = useGraview();
  const enter = useCallback((id: string) => setJackedIn(id), [setJackedIn]);
  const exit = useCallback(() => setJackedIn(null), [setJackedIn]);
  return useMemo(
    () => ({ jackedIn, enter, exit, isJackedIn: jackedIn !== null }),
    [jackedIn, enter, exit],
  );
}
