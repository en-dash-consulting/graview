import { OVERVIEW_PATH, type Place } from "@graview/core";
import { aggregateId, EMPTY_VIEW, toUrl, withOverview, withPicture, withWithin, type ViewState } from "@graview/layout/view";
import { useGraview, useNavigation } from "@graview/react/provider";
import { useMemo } from "react";
import { WHOLE_KEY, type BarGo, type BarPlace } from "./app-bar.js";

/*
 * THE SCENE'S PLACES IN THE BAR (FR-144).
 *
 * On Pages the bar names the place you are on and lists every other; on the
 * scene it said nothing after the switch, and the scene's pictures — its
 * lenses — were chosen on the district's own marquee or from a panel that
 * folds to a rail. The scene has its places in the bar now, the same
 * control: what is in view, "The whole thing" or the picture showing, and
 * every picture the scene has, grouped as on Pages. Choosing one moves the
 * scene's `in.view` exactly as every other way to a picture does (a place's
 * tab, Find, a link): the kind's district in focus, on the ground, showing
 * that picture — and the address follows the view, as it always has.
 */

export { WHOLE_KEY };
/** What the scene's first place is called. */
export const WHOLE_LABEL = "The whole thing";

/** The scene's places, the one in view, and the view each one goes to. */
export interface ScenePlaces {
  readonly places: readonly BarPlace[];
  readonly current: string;
  /** The view a place goes to from here, or null for a key that is not the scene's. */
  readonly to: (key: string, from: ViewState) => ViewState | null;
}

/** A picture's key on the scene: its kind and its name, as on Pages but the scene's. */
const keyOf = (place: Place): string => `scene:${place.kind}:${place.as}`;

/**
 * THE SCENE'S PLACES (FR-144): the whole thing, then each picture the seat
 * may see, in the order they were registered; which is in view — the
 * picture the view names on its kind's district, or the one that district
 * draws when it names none on the ground, else the whole thing — the scene
 * from above, where "Up" rises to; and the view each goes to.
 * Each one's path is the scene's address for it (`/places/overview#…`), what
 * a harness finds it by (`data-place-path`).
 */
export function scenePlacesOf(input: { readonly places: readonly Place[]; readonly hidden: ReadonlySet<string>; readonly view: ViewState }): ScenePlaces {
  const { view } = input;
  const seen = new Set<string>();
  const pictures = input.places.filter((place) => {
    if (input.hidden.has(place.kind) || seen.has(keyOf(place))) return false;
    seen.add(keyOf(place));
    return true;
  });
  const to = (key: string, from: ViewState): ViewState | null => {
    // The whole thing is the scene from above, as "Up" rises to it: no picture in view.
    if (key === WHOLE_KEY) return withWithin(withOverview(from, true), "view", null);
    const place = pictures.find((one) => keyOf(one) === key);
    return place ? withPicture(from, place.kind, place.as) : null;
  };
  const places: BarPlace[] = [
    { key: WHOLE_KEY, label: WHOLE_LABEL, path: `${OVERVIEW_PATH}${toUrl(to(WHOLE_KEY, EMPTY_VIEW)!)}`, group: "home" },
    ...pictures.map((place) => ({ key: keyOf(place), label: place.title, path: `${OVERVIEW_PATH}${toUrl(to(keyOf(place), EMPTY_VIEW)!)}`, group: "pictures" as const, kind: place.kind })),
  ];
  // Which picture a district draws when the view names none: the last registered for its kind, as the registry resolves it.
  const showing = view.within?.["view"];
  const drawnBy = (place: Place): boolean => view.focusId === aggregateId(place.kind) && (showing === undefined ? pictures.filter((one) => one.kind === place.kind).at(-1) === place : showing === place.as);
  const here = pictures.find((place) => drawnBy(place) && (showing !== undefined || !view.overview));
  return { places, current: here ? keyOf(here) : WHOLE_KEY, to };
}

/**
 * The scene's places as the bar is handed them, from the view the provider
 * holds: a press goes there, a step Back undoes it (the view is the address).
 */
export function useScenePlaces(): { readonly places: readonly BarPlace[]; readonly current: string; readonly reach: BarGo } {
  const { views, hiddenKinds } = useGraview();
  const { view, go } = useNavigation();
  const registered = views.places();
  const scene = useMemo(() => scenePlacesOf({ places: registered, hidden: hiddenKinds, view }), [registered, hiddenKinds, view]);
  const reach = useMemo<BarGo>(
    () => ({
      go: (place) => {
        const next = scene.to(place.key, view);
        if (next) go(next);
      },
    }),
    [scene, view, go],
  );
  return { places: scene.places, current: scene.current, reach };
}
