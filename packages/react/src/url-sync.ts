import { OVERVIEW_PATH } from "@graview/core";
import { aggregateId, EMPTY_VIEW, fromUrl, overviewFragment, overviewStop, sameView, toUrl, type ViewState } from "@graview/layout/view";
import { useCallback, useEffect, useRef } from "react";
import { useGraview } from "./context.js";
import { trail } from "./hooks.js";

/*
 * THE SCENE'S STOP IN THE ADDRESS BAR, in a file of its own: what only a
 * page whose address is the app's reaches — the whole-page Shell with
 * `syncUrl`, an embed handed the address bar (FR-106) — so a page that
 * imports the hooks for anything else does not carry it up front.
 */

/**
 * Keeps the view in the URL fragment and honors the back button.
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

/*
 * ON THE OVERVIEW'S ADDRESS THE ADDRESS ALONE IS THE OVERVIEW (FR-154): a
 * fragment that says nothing there is at altitude, and the overview at
 * altitude over nothing is written with no fragment, so the address that
 * comes back from a server — which never sees a fragment — still says it.
 */
const onTheOverview = (): boolean => window.location.pathname.endsWith(OVERVIEW_PATH);
const stopHere = (): ViewState => (onTheOverview() ? overviewStop : fromUrl)(window.location.hash);
const fragmentHere = (view: ViewState): string => (onTheOverview() ? overviewFragment : toUrl)(view);

export function useUrlSync(): void {
  const { view, setView, views, principal } = useGraview();
  /* Who the page is seated as, by what decides what it sees: a change of it resolves the stop rather than traveling. */
  const seat = JSON.stringify(principal);

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
   * fragment and the back button honored it, but opening a shared link
   * landed on the default view and silently overwrote the address bar. A
   * pasted link that does not go where it says is worse than no link.
   */
  /* The address's own stop, being adopted: the view this render holds is the one it replaces, not one to write. */
  const adopting = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = settled(stopHere());
    // Adopt ANY address that says something — overview, zoom, a selection —
    // not only the focus-shaped ones. A pasted link that does not go where
    // it says is worse than no link.
    if (!sameView(initial, EMPTY_VIEW) && !sameView(initial, view)) {
      adopting.current = true;
      setView(initial);
    }
    // Once, on mount: later changes are this hook's own writes.
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setView(settled(stopHere()));
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, [setView, settled]);

  const landed = useRef(false);
  const written = useRef<ViewState | null>(null);
  const seated = useRef(seat);
  useEffect(() => {
    if (typeof window === "undefined") return;
    /*
     * ARRIVING AT AN ADDRESS THAT SAYS SOMETHING writes nothing until the
     * view is the address's: written first, the view it replaces put `#`
     * in the address — on the overview's place, a fragment it never had —
     * and the adopted stop was then pushed, an entry nobody went to.
     */
    if (adopting.current) {
      adopting.current = false;
      return;
    }
    const reseated = seated.current !== seat;
    seated.current = seat;
    const fragment = fragmentHere(view);
    // No fragment is the bare address: its path and search, the fragment let go.
    const next = fragment || `${window.location.pathname}${window.location.search}`;
    // Only write when the view actually changed, or the back stack fills with
    // duplicates and the back button stops meaning anything. The baseline
    // still moves: after a popstate re-syncs the view, a stale baseline made
    // the next drag read as travel and push a phantom stop.
    if (window.location.hash === fragment) {
      // An address that already says the view is arrived at, as much as one tidied to say it.
      landed.current = true;
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
     * MOVING THE FURNITURE IS NOT TRAVELING.
     *
     * A drag writes the view state on every pointer move, because that is what
     * makes the connectors follow the card. Pushed, one drag would be sixty
     * history entries and Back would mean "one pixel ago". A change that
     * touches only the camera or where things were dragged is an adjustment of
     * the stop you are on, so it replaces: the address stays shareable and
     * Back still means the place you were before you started fiddling.
     */
    /*
     * CHANGING THE SEAT IS NOT TRAVELING. A seat that may not see the
     * focused record has its stop resolved to where the app opens, in the
     * render that changed the seat. Pushed, Back landed on the record's
     * address, which the seat cannot see, which fell back again — an entry
     * that went nowhere. The address is tidied to where the page now is.
     */
    if (reseated || adjustment(written.current, view)) {
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
  }, [view, seat]);
}

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
 * address changed, no entry was pushed, and the arrows stayed gray.
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
     * SHOWING A MODULE IS TRAVELING. "Show the installation" raises whole
     * districts into the scene — who is here, who has been invited — and
     * its own comment always said it was a stop Back knew the way out of.
     * It was not: `shown` was missing from this comparison, so the address
     * gained `show=installation` and the entry was REPLACED, the arrows
     * stayed gray, and one Back from the installation left the app.
     */
    (before.shown ?? []).join(",") === (after.shown ?? []).join(",") &&
    /*
     * A VIEW MOVING ALONG ITS OWN DIMENSION IS TRAVELING.
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
  return say(withoutWords(before)) === say(withoutWords(after));
}

/*
 * TYPING IS NOT TRAVELING. The words a row narrows by (`in.q`) change on
 * every keystroke, and each one pushed a history entry — five letters, five
 * Backs to leave a list. The scene's own `q` was never compared; the row's
 * words are the same act and read the same way.
 */
function withoutWords(held: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> | undefined {
  if (!held || !("q" in held)) return held;
  const { q: _words, ...rest } = held;
  return rest;
}
