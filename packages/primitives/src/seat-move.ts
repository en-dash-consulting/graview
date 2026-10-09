import { useGraview } from "@graview/react/provider";
import type { SeatMove } from "@graview/tools";
import { useCallback } from "react";
import { aggregateId, fromUrl, withFocus, withOverview, withPicture, withSelection, withWithin, withZoom, type ViewState } from "@graview/layout/view";

/**
 * A SEAT'S MOVE, AS THE SCENE MAKES IT.
 *
 * The seat answers "go to The week" with data (`SeatMove`); the routed face
 * navigates to its `address`, and the scene makes the same place a stop —
 * through the same steps the bar, Find and a host's `go.place` already
 * take, so a moved scene is one a person could have walked to and Back
 * walks out of. Pure: the caller sets the view (which pushes history) or
 * opens the pane.
 */
export type SceneMove =
  /** A stop to set. */
  | { readonly view: ViewState }
  /** A pane of the scene's own to open: the problems are the standing's list, not a stop. */
  | { readonly pane: "problems" };

export function sceneMove(state: ViewState, move: SeatMove): SceneMove {
  switch (move.to) {
    case "place":
      // The home and the scene itself are the scene's opening stop.
      return { view: fromUrl("#") };
    case "picture":
      // A narrowing an earlier ask left on the stop is not this picture's: it goes.
      return { view: withSelection(withPicture(withWithin(state, "filter", null), move.kind, move.as), []) };
    case "kind": {
      /*
       * Down into the kind's district, close, narrowed by the same words a
       * list page carries in `?filter=` — `in.filter` — with nothing chosen
       * inside it: a picture named before would draw the narrowing in its
       * own way, or not at all.
       */
      const down = withZoom(withOverview({ ...withFocus(state, aggregateId(move.kind)), relation: null }, false), true);
      return { view: withSelection(withWithin(withWithin(down, "view", null), "filter", move.filter ?? null), []) };
    }
    case "record":
      // On the ground at the record: the picture and the narrowing of the place it was found from go with it.
      return { view: withSelection(withFocus(withOverview(withWithin(withWithin(state, "view", null), "filter", null), false), move.id), [move.id]) };
    case "problems":
      return { pane: "problems" };
  }
}

/** The standing's problems, opened or put away as a press on it would. */
export function problemsShown(shown: boolean): void {
  const standing = typeof document === "undefined" ? null : document.querySelector<HTMLButtonElement>('[data-testid="standing"]');
  if (standing && (standing.getAttribute("aria-expanded") === "true") !== shown) standing.click();
}

/**
 * THE SCENE MAKES A SEAT'S MOVE: a stop set through the provider (so the
 * address follows it and Back walks out of it), or the problems opened at
 * the standing. A drawn view standing in front of the picture is put away
 * first: the reader asked to be somewhere else.
 */
export function useSceneGo(): (move: SeatMove) => void {
  const { setView, seatTalk } = useGraview();
  return useCallback(
    (move: SeatMove) => {
      if (seatTalk.get().draft) seatTalk.setDraft(null);
      // The standing is the scene's list of problems: opened as a press would open it, and put away when the seat goes elsewhere.
      problemsShown(move.to === "problems");
      if (move.to === "problems") return;
      setView((state) => {
        const made = sceneMove(state, move);
        return "view" in made ? made.view : state;
      });
    },
    [setView, seatTalk],
  );
}
