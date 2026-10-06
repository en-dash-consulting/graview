import type { AnySchema } from "@graview/core";
import { toggleExpanded, toUrl, withFocus, withRelation, withZoom, withJackIn, type ViewState } from "@graview/layout/view";
import { editableFields, type EditableField } from "@graview/tools/frame";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useFound, useGraph, useGraview } from "./context.js";

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
 * picture evaluates when it mounts. On a catalogue of a thousand songs that
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

/** Ids implicated in some current violation, for marking them in place. */
export function useFlagged(): readonly string[] {
  const violations = useViolations();
  return useMemo(
    () => [...new Set(violations.flatMap((violation) => violation.nodeIds))],
    [violations],
  );
}

/**
 * Everything the selection reaches: the selected nodes, plus everything one
 * edge away from them.
 *
 * Selecting a person and having the week sit there unchanged is the same
 * failure as clicking an event and getting an empty plane — the graph knows
 * which five events that person is in, and the calendar is right there
 * drawing all eighteen of them. A view that receives this can say so in its
 * own idiom: a calendar lights up the spans, a roster rings the chips.
 *
 * Empty when nothing is selected, which every view must read as "no
 * emphasis" rather than "nothing is related".
 */
export function useImplicated(): readonly string[] {
  const reachedBySelection = useReached();
  const found = useFound();
  /*
   * AND WHAT THE WORDS FIND. A search lights its hits in whatever picture
   * is open, through the same set every view already dims by — so a lens
   * learns nothing new to take part. Words that find nothing dim it all:
   * the one id nothing is called keeps the set non-empty.
   */
  return useMemo(() => {
    if (!found) return reachedBySelection;
    // Every match, not the strip's capped index: a real hit is never drawn dimmed.
    const hits = found.matched;
    if (hits.length === 0 && reachedBySelection.length === 0) return [NOTHING_FOUND];
    return [...new Set([...reachedBySelection, ...hits])];
  }, [found, reachedBySelection]);
}

/**
 * What the SELECTION alone reaches — `useImplicated` without the search.
 * For the one reading that must not confuse the two: a district's "tied"
 * count is about what you picked, not what you typed.
 */
export function useReached(): readonly string[] {
  const { store, selection } = useGraview();
  const nodes = useGraph();
  return useMemo(() => {
    if (selection.length === 0) return [];
    const chosen = new Set(selection);
    const reached = new Set(chosen);
    for (const edge of store.graph.allEdges()) {
      if (chosen.has(edge.from)) reached.add(edge.to);
      if (chosen.has(edge.to)) reached.add(edge.from);
    }
    /*
     * What a selected thing JUDGES, as well as what it touches.
     *
     * A rule has no edges, so selecting one reached nothing and the screen
     * did not change — it read as broken. What a rule is about is derivable
     * from its violations, which name the nodes they implicate, so selecting
     * one now lights those wherever they are drawn.
     */
    for (const violation of store.violations()) {
      if (violation.subjectId !== undefined && chosen.has(violation.subjectId)) {
        for (const id of violation.nodeIds) reached.add(id);
      }
    }
    return [...reached];
  }, [store, selection, nodes]);
}

/** Stands in the implicated set when a search found nothing, so every view dims. */
export const NOTHING_FOUND = "search:nothing";

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
 * being serialisable — so back and forward are the BROWSER's, and this only
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

/**
 * The fields of a node that can be changed where they are shown, and the way
 * to change one.
 *
 * `commit` runs the mutation the framework found, with the author set to a
 * person — so an in-place edit lands in the op log, can be undone, and is
 * judged by the invariants exactly like an edit made from the actions strip.
 * There is no second write path.
 */
export function useEditableFields<S extends AnySchema>(
  id: string | null,
): {
  readonly fields: readonly EditableField[];
  commit: (field: EditableField, value: unknown, rest?: Record<string, unknown>) => void;
} {
  const { store, principal } = useGraview<S>();
  const nodes = useGraph<S>();
  const fields = useMemo(
    () => (id === null ? [] : editableFields(store, id)),
    [store, id, nodes],
  );
  const commit = useCallback(
    (field: EditableField, value: unknown, rest: Record<string, unknown> = {}) => {
      const call = field.call(value);
      store.apply(
        { name: call.name, args: { ...call.args, ...rest } },
        { author: principal },
      );
    },
    [store, principal],
  );
  return { fields, commit };
}
