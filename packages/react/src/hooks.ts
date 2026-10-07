import type { AnySchema } from "@graview/core";
import { toggleExpanded, toUrl, withFocus, withRelation, withZoom, withJackIn, type ViewState } from "@graview/layout/view";
import { useCallback, useMemo, useSyncExternalStore } from "react";
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
 * Everything currently broken, recomputed whenever the graph changes.
 *
 * The invariant engine has always known this and the interface only ever
 * showed it to someone who happened to select an implicated node. An
 * agreement nobody can see the state of is not an agreement anyone is
 * keeping — "is anything wrong?" is the first question a person asks of a
 * week, and it should never require hunting for it.
 */
export function useViolations<S extends AnySchema>() {
  const { store } = useGraview<S>();
  const nodes = useGraph<S>();
  // `nodes` changes with the graph, so a re-render after an edit asks again.
  return useMemo(() => violationsOf(store as unknown as AnyStore) as ReturnType<typeof store.violations>, [store, nodes]);
}

/*
 * ONE evaluation per change, however many ask.
 *
 * Every caller — the scene, Find, the standing, and each picture on the
 * ground — evaluated every invariant over the whole graph for itself, and a
 * picture evaluates when it mounts. On a catalog of a thousand songs that
 * was tens of milliseconds for each card a stop brought in (docs/scale.md).
 * The store says when the graph changes; until it does, the answer holds.
 */
type AnyStore = ReturnType<typeof useGraview>["store"];
const evaluated = new WeakMap<AnyStore, { violations: ReturnType<AnyStore["violations"]> | null }>();
function violationsOf(store: AnyStore) {
  let entry = evaluated.get(store);
  if (!entry) {
    const fresh: { violations: ReturnType<AnyStore["violations"]> | null } = { violations: null };
    // Cleared inside the store's notify, before React renders anything that asks again.
    store.subscribe(() => {
      fresh.violations = null;
    });
    evaluated.set(store, fresh);
    entry = fresh;
  }
  entry.violations ??= store.violations();
  return entry.violations;
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
 * Where you are in your own history.
 *
 * The History API says nothing about whether there is anywhere to go forward
 * to, and an interface cannot offer a control it does not know the state of —
 * a forward arrow that is always enabled and usually does nothing is worse
 * than none. So the position is tracked here, from the pushes this hook makes
 * and the pops the browser reports.
 *
 * Module-level because there is one history per document, and because a hook
 * that re-created it per component would count each navigation once per
 * mounted consumer.
 */

/** Where you are in your own history: the pushes `useUrlSync` makes and the pops the browser reports. */
export const trail = {
  at: 0,
  depth: 0,
  listeners: new Set<() => void>(),
  tell() {
    for (const listener of this.listeners) listener();
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("popstate", (event) => {
    const state = event.state as { graview?: number } | null;
    // A stop this app pushed knows its own position. Anything else — a link
    // out and back, another app's entry — resets to the start rather than
    // guessing, since a wrong answer here offers a control that does nothing.
    trail.at = typeof state?.graview === "number" ? state.graview : 0;
    if (trail.at > trail.depth) trail.depth = trail.at;
    trail.tell();
  });
}

/**
 * Whether there is anywhere to go, and the way to go there.
 *
 * Every stop in a Graview app is a URL — that was the point of view state
 * being serializable — so back and forward are the BROWSER's, and this only
 * makes them visible. An interface whose navigation is the browser's should
 * not require the person using it to know that.
 */
export function useBacktrack(): {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  back: () => void;
  forward: () => void;
} {
  const subscribe = useCallback((listener: () => void) => {
    trail.listeners.add(listener);
    return () => trail.listeners.delete(listener);
  }, []);
  const at = useSyncExternalStore(
    subscribe,
    () => trail.at,
    () => 0,
  );
  const depth = useSyncExternalStore(
    subscribe,
    () => trail.depth,
    () => 0,
  );
  return useMemo(
    () => ({
      canGoBack: at > 0,
      canGoForward: at < depth,
      back: () => window.history.back(),
      forward: () => window.history.forward(),
    }),
    [at, depth],
  );
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
  const { view, setView } = useGraview();
  /*
   * Jacking in ZOOMS now — it does not jump. The gesture keeps its name and
   * this hook keeps its contract, but underneath it is ordinary view state:
   * focus the thing and zoom the scene in close, so entering tweens from
   * wherever you were and the back button backs out of it. The modal page
   * this used to open isolated the view from every relation it had.
   */
  const enter = useCallback((id: string) => setView((current) => withJackIn(current, id)), [setView]);
  const exit = useCallback(() => setView((current) => withZoom(current, false)), [setView]);
  const jackedIn = view.zoom ? view.focusId : null;
  return useMemo(
    () => ({ jackedIn, enter, exit, isJackedIn: view.zoom === true }),
    [jackedIn, enter, exit, view.zoom],
  );
}
