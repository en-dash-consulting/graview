import type { AnySchema } from "@graview/core";
import {
  aggregateId,
  edgeOfSelection,
  fromUrl,
  kindsOf,
  toggleExpanded,
  toUrl,
  withFocus,
  withRelation,
  withZoom,
  type ViewState,
  sameView,
  EMPTY_VIEW,
  withJackIn,
} from "@graview/layout";
import {
  applyAffordance,
  deriveAffordances,
  editableFields,
  previewAffordance,
  type Affordance,
  type AffordanceSet,
  type DeriveOptions,
  type EditableField,
} from "@graview/tools";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
  return useMemo(
    () => store.violations(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, nodes],
  );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, selection, nodes]);
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
  const { store, selection, principal, providers } = useGraview<S>();
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
      ...options,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
/**
 * `useUrlSync` as a component, for shells that make syncing conditional —
 * a hook inside `if (syncUrl)` is a Rules-of-Hooks trap the moment the
 * flag ever changes; a conditionally RENDERED component is not.
 */
export function UrlSync(): null {
  useUrlSync();
  return null;
}

export function useUrlSync(): void {
  const { view, setView, views } = useGraview();

  /*
   * A STOP THAT NAMES A PLACE AND NOT ITS GROUP STILL GOES THERE.
   *
   * `#view=grounds-map` is the link a page can actually write: the page knows
   * the picture it is talking about, not how the layout spells the aggregate
   * id of the kind behind it. The registry does know — a named place carries
   * its kind — so the place is looked up here and the group it is a picture
   * of becomes the focus. Without this the short form lands on the default
   * view, which is the pasted-link problem one level up.
   */
  const settled = useCallback(
    (state: ViewState): ViewState => {
      const asked = state.within?.["view"];
      if (asked === undefined || state.focusId) return state;
      const place = views.places().find((candidate) => candidate.as === asked);
      return place ? { ...state, focusId: aggregateId(place.kind) } : state;
    },
    [views],
  );

  /*
   * Adopt the fragment on FIRST load, not only on navigation.
   *
   * "Every stop is a URL" was only half true: the view was written to the
   * fragment and the back button honoured it, but opening a shared link
   * landed on the default view and silently overwrote the address bar. A
   * pasted link that does not go where it says is worse than no link.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = settled(fromUrl(window.location.hash));
    // Adopt ANY address that says something — overview, zoom, a selection —
    // not only the focus-shaped ones. A pasted link that does not go where
    // it says is worse than no link.
    if (!sameView(initial, EMPTY_VIEW)) {
      setView(initial);
    }
    // Once, on mount: later changes are this hook's own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setView(settled(fromUrl(window.location.hash)));
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, [setView, settled]);

  const landed = useRef(false);
  const written = useRef<ViewState | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = toUrl(view);
    // Only write when the view actually changed, or the back stack fills with
    // duplicates and the back button stops meaning anything. The baseline
    // still moves: after a popstate re-syncs the view, a stale baseline made
    // the next drag read as travel and push a phantom stop.
    if (window.location.hash === next) {
      written.current = view;
      return;
    }
    /*
     * ARRIVING is not a navigation.
     *
     * The first write is the app adopting its own default view, and pushing it
     * put a stop in the history that nobody went to — so the back control was
     * offered the moment the page loaded, and pressing it went to the blank
     * URL the app had just left. Replacing is what a page does when it tidies
     * its own address.
     */
    if (!landed.current) {
      landed.current = true;
      written.current = view;
      window.history.replaceState({ graview: trail.at }, "", next);
      return;
    }
    /*
     * MOVING THE FURNITURE IS NOT TRAVELLING.
     *
     * A drag writes the view state on every pointer move, because that is what
     * makes the connectors follow the card. Pushed, one drag would be sixty
     * history entries and Back would mean "one pixel ago". A change that
     * touches only the camera or where things were dragged is an adjustment of
     * the stop you are on, so it replaces: the address stays shareable and
     * Back still means the place you were before you started fiddling.
     */
    if (adjustment(written.current, view)) {
      window.history.replaceState({ graview: trail.at }, "", next);
      written.current = view;
      return;
    }
    written.current = view;
    window.history.pushState({ graview: ++trail.at }, "", next);
    // A new stop discards anything that was ahead of it, exactly as the
    // browser does.
    trail.depth = trail.at;
    trail.tell();
  }, [view]);
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
/**
 * Whether one view differs from another only in what the user MOVED.
 *
 * Where you are is the focus, the relation, what is expanded and whether you
 * have risen above the stack. Where you dragged things to is not a different
 * place; it is the same place, rearranged.
 */
/**
 * WHETHER A CHANGE IS A STOP OR JUST A NUDGE OF THE ONE YOU ARE ON.
 *
 * Exported so it can be read and held to: what belongs in here is the
 * difference between the back button meaning something and meaning "one
 * pixel ago", and the two things that went wrong went wrong silently — the
 * address changed, no entry was pushed, and the arrows stayed grey.
 */
export function adjustment(before: ViewState | null, after: ViewState): boolean {
  if (!before) return false;
  return (
    before.focusId === after.focusId &&
    before.relation === after.relation &&
    (before.overview ?? false) === (after.overview ?? false) &&
    (before.zoom ?? false) === (after.zoom ?? false) &&
    (before.past ?? false) === (after.past ?? false) &&
    before.expanded.join(",") === after.expanded.join(",") &&
    /*
     * SHOWING A MODULE IS TRAVELLING. "Show the installation" raises whole
     * districts into the scene — who is here, who has been invited — and
     * its own comment always said it was a stop Back knew the way out of.
     * It was not: `shown` was missing from this comparison, so the address
     * gained `show=installation` and the entry was REPLACED, the arrows
     * stayed grey, and one Back from the installation left the app.
     */
    (before.shown ?? []).join(",") === (after.shown ?? []).join(",") &&
    /*
     * A VIEW MOVING ALONG ITS OWN DIMENSION IS TRAVELLING.
     *
     * Turning the calendar to October is going somewhere: a URL to send
     * somebody, a place to come back to, a Back that means "the month I was
     * looking at". Left out of this comparison it read as an adjustment of
     * the stop — the address updated, no entry was pushed, and one Back
     * from October landed past the calendar entirely, at the place before
     * anyone opened it. That is the exact failure `within` exists to fix.
     */
    sameWithin(before.within, after.within)
  );
}

function sameWithin(
  before: Readonly<Record<string, string>> | undefined,
  after: Readonly<Record<string, string>> | undefined,
): boolean {
  const say = (held: Readonly<Record<string, string>> | undefined): string =>
    Object.entries(held ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
  return say(before) === say(after);
}

const trail = {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
