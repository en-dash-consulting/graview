import { labelOf, onePerPicture, OVERVIEW_PATH, placeLabel, pluralLabel, samePicture, type Place } from "@graview/core";
import { aggregateId, EMPTY_VIEW, kindsOfAggregate, overviewFragment, withFocus, withOverview, withPicture, withWithin, type ViewState } from "@graview/layout/view";
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
 * control: what is in view, "Everything" or the picture showing, and
 * every picture the scene has, grouped as on Pages. Choosing one moves the
 * scene's `in.view` exactly as every other way to a picture does (a place's
 * tab, Find, a link): the kind's district in focus, on the ground, showing
 * that picture — and the address follows the view, as it always has.
 */

export { WHOLE_KEY };
/*
 * WHAT THE SCENE'S FIRST PLACE IS CALLED: "Everything" — every district,
 * from above, which is what pressing it shows. It was "The whole thing",
 * which read as a riddle in the bar, and stood there while the reader was
 * inside one district. Not "Home": that is the routed face's front page,
 * and an app's scene may open on a district of its own (Things opens on
 * its lists), so the overview is not where home is.
 */
export const WHOLE_LABEL = "Everything";
/** A district gone into that no picture draws: its key, named in the bar as where you are and offered nowhere. */
const DISTRICT_PREFIX = "scene:district:";

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
 * Each one's path is the scene's address for it (`/places/overview#…`; the
 * whole thing's is `/places/overview` alone, FR-154), what a harness finds
 * it by (`data-place-path`).
 */
export function scenePlacesOf(input: {
  readonly places: readonly Place[];
  readonly hidden: ReadonlySet<string>;
  readonly view: ViewState;
  /** The schema, to say whose a picture is when a different one shares its name ("The timetable · talks"). */
  readonly schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined };
  /** A record's name, for the bar to say where you are when the focus is a record (`Pay the deposit`). */
  readonly nameOf?: (id: string) => string | undefined;
}): ScenePlaces {
  const { view } = input;
  const all = input.places.filter((place) => !input.hidden.has(place.kind));
  // Each picture once: one over several kinds is one tab, under the first of them, and either district is in it.
  const pictures = onePerPicture(all);
  const to = (key: string, from: ViewState): ViewState | null => {
    // The whole thing is the scene from above, as "Up" rises to it: no picture in view.
    if (key === WHOLE_KEY) return withWithin(withOverview(from, true), "view", null);
    if (key.startsWith(DISTRICT_PREFIX)) return withFocus(withWithin(withOverview(from, false), "view", null), key.slice(DISTRICT_PREFIX.length));
    const place = pictures.find((one) => keyOf(one) === key);
    if (!place) return null;
    // A picture over several kinds is drawn on the district in focus when it is one of them, else on the first.
    return withPicture(from, place.over?.find((one) => from.focusId === aggregateId(one)) ?? place.kind, place.as);
  };
  // Which picture a district draws when the view names none: the last registered for its kind, as the registry resolves it.
  const showing = view.within?.["view"];
  const drawnBy = (place: Place): boolean => view.focusId === aggregateId(place.kind) && (showing === undefined ? all.filter((one) => one.kind === place.kind).at(-1) === place : showing === place.as);
  const on = all.find((place) => drawnBy(place) && (showing !== undefined || !view.overview));
  const here = on ? pictures.find((place) => samePicture(place, on)) : undefined;
  /*
   * One kept off the lists (`hidden`) — a lens a custom home links to, a
   * view somebody hid from the place menu — is here only while it is the one
   * shown, and marked: the bar names it as where you are and offers it
   * nowhere (`offeredPlaces`, Roadmap f-hidden-view-leaves-the-bar).
   */
  const listed = pictures.filter((place) => !place.hidden || place === here);
  /*
   * INSIDE A DISTRICT NO PICTURE DRAWS — the rules, the reasons — or on a
   * record, the bar names where you are ("Rules", "Pay the deposit"), not
   * "Everything": a reader inside one district read the whole app's name
   * over it and could not tell where they were (Nick, on a phone). Said
   * as where you are and offered nowhere, as a hidden picture is: the way
   * to it is the scene's own, and Up is the way back.
   */
  const inside = here || view.overview || !view.focusId ? undefined : districtHere(view.focusId, input);
  const places: BarPlace[] = [
    { key: WHOLE_KEY, label: WHOLE_LABEL, path: `${OVERVIEW_PATH}${overviewFragment(to(WHOLE_KEY, EMPTY_VIEW)!)}`, group: "home" },
    ...listed.map((place) => ({ key: keyOf(place), label: placeLabel(place, all, input.schema), path: `${OVERVIEW_PATH}${overviewFragment(to(keyOf(place), EMPTY_VIEW)!)}`, group: "pictures" as const, kind: place.kind, hidden: place.hidden })),
    ...(inside ? [{ ...inside, path: `${OVERVIEW_PATH}${overviewFragment(to(inside.key, EMPTY_VIEW)!)}` }] : []),
  ];
  return { places, current: here ? keyOf(here) : (inside?.key ?? WHOLE_KEY), to };
}

/** The district or record the focus names, as a place kept off the lists: its plural, or the record's name. */
function districtHere(focusId: string, input: { readonly hidden: ReadonlySet<string>; readonly schema: { tryDefinition(kind: string): { readonly plural?: string } | undefined }; readonly nameOf?: (id: string) => string | undefined }): Omit<BarPlace, "path"> | undefined {
  const kinds = kindsOfAggregate(focusId);
  if (kinds.length > 0) {
    if (kinds.some((kind) => input.hidden.has(kind))) return undefined;
    return { key: `${DISTRICT_PREFIX}${focusId}`, label: kinds.map((kind) => pluralLabel(input.schema, kind)).join(" and "), group: "lists", kind: kinds[0]!, hidden: true };
  }
  const name = input.nameOf?.(focusId);
  return name ? { key: `${DISTRICT_PREFIX}${focusId}`, label: name, group: "lists", hidden: true } : undefined;
}

/**
 * The scene's places as the bar is handed them, from the view the provider
 * holds: a press goes there, a step Back undoes it (the view is the address).
 */
export function useScenePlaces(): { readonly places: readonly BarPlace[]; readonly current: string; readonly reach: BarGo } {
  const { store, views, hiddenKinds, principal } = useGraview();
  const { view, go } = useNavigation();
  const registered = views.places();
  const kept = useMemo(() => store.kindsKeptFrom(principal), [store, principal]);
  const nameOf = useMemo(
    () => (id: string) => {
      const node = store.graph.getNode(id);
      if (!node || hiddenKinds.has(node.kind as string) || kept.has(node.kind as string)) return undefined;
      return labelOf(store.schema.tryDefinition(node.kind as string), node as never);
    },
    [store, hiddenKinds, kept],
  );
  const scene = useMemo(() => scenePlacesOf({ places: registered, hidden: hiddenKinds, view, schema: store.schema, nameOf }), [registered, hiddenKinds, view, store.schema, nameOf]);
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
