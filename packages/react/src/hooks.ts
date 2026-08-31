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
  editableFields,
  previewAffordance,
  type Affordance,
  type AffordanceSet,
  type DeriveOptions,
  type EditableField,
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
    const initial = fromUrl(window.location.hash);
    if (initial.focusId || initial.relation || initial.expanded.length > 0) {
      setView(initial);
    }
    // Once, on mount: later changes are this hook's own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const { store } = useGraview<S>();
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
        { author: { kind: "human" } },
      );
    },
    [store],
  );
  return { fields, commit };
}
