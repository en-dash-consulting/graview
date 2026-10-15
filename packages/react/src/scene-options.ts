import { orderKinds } from "@graview/core";
import { beginning } from "@graview/core/seat";
import { touchWeights } from "@graview/core/search";
import type { AnySchema } from "@graview/core";
import type { LayoutOptions } from "@graview/layout";
import { useContext, useMemo } from "react";
import { BesideTheMap } from "./beside-the-map.js";
import { foundIds, useFound, useGraview } from "./context.js";
import { useViolations } from "./hooks.js";
import { railInset, SEAT_FOOT } from "./rails.js";
import { isDefaultView } from "./view-registry.js";

/** What no search found: the layout's relevance when nobody is typing. */
const NO_HITS: ReadonlySet<string> = new Set();

/**
 * WHAT THE SCENE ASKS THE LAYOUT FOR: the host's options, sized to the box
 * the scene actually has and told what this seat, this search and this
 * graph's rules make of it.
 *
 * The scene is laid out to the space it actually has. A fixed canvas leaves
 * dead ground on a wide screen and clips on a narrow one, and the plane
 * bands are proportions rather than pixels, so they follow.
 */
export function useLayoutOptions<S extends AnySchema>(
  options: LayoutOptions | undefined,
  size: { width: number; height: number } | null,
  unit: number,
  /** Whether an ask field stands at the picture's foot: the layout keeps that strip clear of cards. */
  seated: boolean,
  cityZoom: number,
  /** What a panel floating over the scene covers, in pixels (`useDock`): the city is fitted in what is left. */
  dock: { readonly right: number; readonly bottom: number },
  /** The graph's tick: the log only grows when the graph changes. */
  nodes: unknown,
  /** The room words over the ground's top corner take (`headroom`): the trail's, when it says something. */
  headroom = 0,
): LayoutOptions {
  const { store, views, hiddenKinds } = useGraview<S>();
  const found = useFound();
  // A picture opened from altitude stands beside the map, where a panel is drawn.
  const besideTheMap = useContext(BesideTheMap);
  // What each subject's violations name, so a rule's neighborhood is what it judges.
  const violations = useViolations<S>();
  const judged = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const violation of violations) {
      if (violation.subjectId === undefined) continue;
      const list = (map[violation.subjectId] ??= []);
      for (const id of violation.nodeIds) if (id !== violation.subjectId && !list.includes(id)) list.push(id);
    }
    return map;
  }, [violations]);
  /*
   * WHAT STANDS AS ITSELF when the band cannot hold a relation: the search's
   * hits, the flagged, the recently written — the selection the layout reads
   * from the stop. Each only changes with the graph or the words.
   */
  const standing = useMemo(
    () => ({
      flagged: new Set(violations.flatMap((violation) => violation.nodeIds)),
      touched: touchWeights(store.log.all()),
    }),
    // `nodes` is the graph's tick: the log only grows when the graph changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [violations, store, nodes],
  );
  // A keystroke changes the hits alone: the flagged and the log's weights are not worked out again for it.
  const relevance = useMemo(() => ({ hits: found ? foundIds(found) : NO_HITS, ...standing }), [found, standing]);
  return useMemo<LayoutOptions>(
    () => ({
      ...options,
      cityZoom,
      ...(besideTheMap ? { besideTheMap: true } : {}),
      // What is not drawn for this seat at this stop: a workspace's disabled
      // modules, and the administered ones this seat may not see or has not
      // asked to — one set, from the provider, so every surface agrees.
      ...(hiddenKinds.size > 0 ? { hiddenKinds: [...hiddenKinds].sort() } : {}),
      ...(Object.keys(judged).length > 0 ? { judged } : {}),
      // What stands as itself when a relation does not fit the band (docs/scale.md).
      relevance,
      /*
       * THE GUTTERS. The seat floats over the picture rather than taking a
       * rail of it, so the left keeps a gutter; the right keeps the corner
       * the altitude control and the key stand in, in proportion, so an
       * embed a paragraph wide does not give a third of itself to chrome.
       */
      /*
       * THE CORNER THE ALTITUDE CONTROL AND THE KEY STAND IN, and nothing of
       * the city opened under them: the districts and their names open
       * clear of the chrome; the zoom at the foot when no ask field keeps it.
       */
      inset: { ...railInset((size?.width ?? 1200) - dock.right), top: 8, bottom: seated ? 0 : 56 },
      // Up and the Key stand clear of a panel too, at the corner of what the reader sees.
      chrome: [{ x: (size?.width ?? 1200) - dock.right - 176, y: 0, width: 176, height: 100 }],
      ...(dock.right > 0 || dock.bottom > 0 ? { dock } : {}),
      ...(headroom > 0 ? { headroom } : {}),
      // The reader's own text size, which the cards are sized in: the city
      // grows with the words rather than holding them at a fixed 230×97.
      unit,
      // Groups the framework's own list shows: from altitude those are
      // districts, not scaled cards. A group with an app's view keeps its card.
      plainGroups: (store.schema.kinds as readonly string[]).filter((kind) =>
        isDefaultView(views.lookup(kind as never, { cardinality: "many", fidelity: "full" })),
      ),
      /*
       * THE ORDER THE CITY IS WALKED IN: the chain a blank installation fills
       * its kinds in, read from the store's own acts. The declaration's
       * order, so the map is the declaration's map.
       */
      cityOrder: orderKinds(
        beginning({
          name: "scene",
          schema: store.schema,
          mutations: store.allMutations().filter((mutation) => !mutation.derived),
        }).order.map((entry) => entry.kind),
        // Unless the declaration orders its kinds itself (FR-80): then the city walks them in that order.
        views.arrangement?.()?.order,
      ),
      /*
       * THE SHOWINGS, by kind: the named places the registry holds, so a
       * focused picture stands on its kind's plot as a screen from altitude.
       */
      screens: views.places().reduce<Record<string, { as: string; title: string; across?: string }[]>>((held, place) => {
        (held[place.kind] ??= []).push({ as: place.as, title: place.title, ...(place.across ? { across: place.across } : {}) });
        return held;
      }, {}),
      ...(size
        ? {
            width: size.width,
            /*
             * The scene lays out into its WHOLE box, but for the strip at its
             * foot the ask field stands in. The actions strip is a transient
             * elevated surface — it floats in front of the scene the way a
             * menu floats in front of a page, and reserving a band for it
             * squeezed every band for chrome that mostly is not there. The
             * ask field is always there, so its strip is kept: no district
             * stands under it, and opening it (over the picture) moves
             * nothing.
             */
            height: seated ? Math.max(0, size.height - SEAT_FOOT) : size.height,
          }
        : {}),
    }),
    [options, size, unit, store, views, hiddenKinds, judged, relevance, cityZoom, seated, besideTheMap, dock.right, dock.bottom, headroom],
  );
}
