import { useMemo } from "react";
import { useFound, useGraph, useGraview } from "./context.js";
import { useViolations } from "./hooks.js";

/*
 * WHAT A VIEW LIGHTS AND DIMS: the flagged, the reached and the implicated.
 * A file of its own, apart from the hooks the frame reads before anything is
 * drawn, so a page that has drawn no view yet carries none of it.
 */

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
