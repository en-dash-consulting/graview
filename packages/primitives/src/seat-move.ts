import type { SeatMove } from "@graview/tools";
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
      return { view: withSelection(withPicture(state, move.kind, move.as), []) };
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
      return { view: withSelection(withFocus(withOverview(state, false), move.id), [move.id]) };
    case "problems":
      return { pane: "problems" };
  }
}
