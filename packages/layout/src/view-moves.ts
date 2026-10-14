import { EDGE_SELECTION_PREFIX, withWithin, type Pin, type ViewState } from "./view-state.js";

/**
 * `@graview/layout/view-moves` — WHAT A FACE DOES TO WHERE THE READER IS,
 * once it is drawn: show an administered module, search and stop searching,
 * widen the horizon to the past, pan, pin a card, and name a selected line.
 *
 * Apart from `@graview/layout/view` because a bundler places a whole file in
 * a page's first chunk when the first chunk can reach it and any chunk uses
 * it (the headroom after 0.1.29): the bar and the frame a page draws first
 * read where the reader is and go there, and only the scene, the Find box
 * and the inspector — each fetched as it is first drawn — make these moves.
 */

export function edgeSelectionId(kind: string, from: string, to: string): string {
  const part = (value: string): string => encodeURIComponent(value);
  return `${EDGE_SELECTION_PREFIX}${part(kind)}:${part(from)}:${part(to)}`;
}

/** Show or hide a module drawn only for those who administer it. */
export function withShown(state: ViewState, module: string, shown: boolean): ViewState {
  const held = new Set(state.shown ?? []);
  if (shown) held.add(module);
  else held.delete(module);
  if (held.size === 0) {
    const { shown: _drop, ...rest } = state;
    return rest;
  }
  return { ...state, shown: [...held].sort() };
}

/** Look for words across the picture, or stop looking. Blank is no search. */
export function withQuery(state: ViewState, q: string | null): ViewState {
  if (q === null || q.trim().length === 0) {
    const { q: _drop, ...rest } = state;
    return rest;
  }
  return { ...state, q };
}

/**
 * Stop looking: the search, and the words it carried into the district it
 * lit. A row's own words — typed there, different from the search — stay.
 */
export function withoutSearch(state: ViewState): ViewState {
  const carried = state.q !== undefined && state.within?.["q"] === state.q;
  return withQuery(carried ? withWithin(state, "q", null) : state, null);
}

/** Widen the horizon to include the past, or narrow it back to now. */
export function withPast(state: ViewState, past: boolean): ViewState {
  if (!past) {
    const { past: _drop, ...rest } = state;
    return rest;
  }
  return { ...state, past: true };
}

/**
 * Move the camera. `null` puts it back.
 *
 * Panning is an ADJUSTMENT of the stop you are on rather than a new stop —
 * the same reason a pin is. `useUrlSync` replaces rather than pushes for both,
 * so one drag is one history entry rather than sixty, and Back still means
 * "the place I was before", not "one pixel ago".
 */
export function withPan(state: ViewState, pan: Pin | null): ViewState {
  if (pan === null || (pan.x === 0 && pan.y === 0)) {
    const { pan: _drop, ...rest } = state;
    return rest;
  }
  return { ...state, pan };
}

export function withPin(state: ViewState, id: string, pin: Pin | null): ViewState {
  const pins = { ...state.pins };
  if (pin === null) delete pins[id];
  else pins[id] = pin;
  return { ...state, pins };
}
