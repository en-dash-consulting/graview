import { aggregateId, EMPTY_VIEW, fromUrl, sameView, toUrl, type ViewState } from "@graview/layout/view";
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
  return say(withoutWords(before)) === say(withoutWords(after));
}

/*
 * TYPING IS NOT TRAVELLING. The words a row narrows by (`in.q`) change on
 * every keystroke, and each one pushed a history entry — five letters, five
 * Backs to leave a list. The scene's own `q` was never compared; the row's
 * words are the same act and read the same way.
 */
function withoutWords(held: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> | undefined {
  if (!held || !("q" in held)) return held;
  const { q: _words, ...rest } = held;
  return rest;
}
