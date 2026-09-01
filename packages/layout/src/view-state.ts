/**
 * A view state is a stop. Every stop is a URL, so the back button returns to
 * exactly the view you left — no free orbit, nothing unnameable.
 */
export interface Pin {
  readonly x: number;
  readonly y: number;
}

export interface ViewState {
  /** The node at plane 0, live and editable. Null means the default view. */
  readonly focusId: string | null;
  /**
   * What plane 1 shows: an edge kind to follow from the focus, or a node kind
   * to raise. Null leaves plane 1 empty.
   */
  readonly relation: string | null;
  /** Aggregates the user has opened, by aggregate id. */
  readonly expanded: readonly string[];
  /** User positions that override the computed ones. */
  readonly pins: Readonly<Record<string, Pin>>;
  /**
   * Where the camera has been dragged, in canvas pixels.
   *
   * A stop, like everything else here: it goes in the URL, it interpolates,
   * and the same address gives the same picture. A pan held outside the view
   * state would be the one thing about the scene you could not share, link to
   * or go back to.
   */
  readonly pan?: Pin;
  /**
   * Looking at the whole graph from outside the plane stack.
   *
   * A view state rather than a mode, because it has to INTERPOLATE from
   * wherever you were: the kinds already on screen fly from their row into a
   * ring, and the thing you were looking at recedes into the middle. A
   * separate surface could only cut, and cutting loses the one thing an
   * overview is for.
   */
  readonly overview?: boolean;
  /**
   * Zoomed in close: the focus takes most of the scene — most, not all —
   * and the kinds shelf and any raised relation recede rather than vanish.
   *
   * A view state rather than a page, because jacking in used to JUMP: a
   * modal document over the scene, isolated from every relation the thing
   * has. A stop interpolates from wherever you were, so going deeper reads
   * as zooming in and leaving as zooming out, and the back button knows it.
   */
  readonly zoom?: boolean;
}

export const EMPTY_VIEW: ViewState = {
  focusId: null,
  relation: null,
  expanded: [],
  pins: {},
};

const num = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Serialises a view to a URL fragment. Keys are sorted and lists are sorted,
 * so the same view always produces the same string — which is what makes
 * "did the view change?" a string comparison and history entries stable.
 */
export function toUrl(state: ViewState): string {
  const params = new URLSearchParams();
  if (state.focusId) params.set("focus", state.focusId);
  if (state.relation) params.set("relation", state.relation);
  if (state.overview) params.set("overview", "1");
  if (state.zoom) params.set("zoom", "1");
  if (state.expanded.length > 0) {
    params.set("expand", [...state.expanded].sort().join(","));
  }
  for (const id of Object.keys(state.pins).sort()) {
    const pin = state.pins[id]!;
    params.set(`pin.${id}`, `${round(pin.x)},${round(pin.y)}`);
  }
  if (state.pan && (state.pan.x !== 0 || state.pan.y !== 0)) {
    params.set("pan", `${round(state.pan.x)},${round(state.pan.y)}`);
  }
  const query = params.toString();
  return query ? `#${query}` : "#";
}

/** Parses a fragment back. Unknown or malformed parts are dropped, not thrown. */
export function fromUrl(url: string): ViewState {
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url;
  const params = new URLSearchParams(hash);
  const pins: Record<string, Pin> = {};
  for (const [key, value] of params) {
    if (!key.startsWith("pin.")) continue;
    const [rawX, rawY] = value.split(",");
    const x = rawX === undefined ? null : num(rawX);
    const y = rawY === undefined ? null : num(rawY);
    if (x === null || y === null) continue;
    pins[key.slice(4)] = { x, y };
  }
  const rawPan = params.get("pan")?.split(",") ?? [];
  const panX = rawPan[0] === undefined ? null : num(rawPan[0]);
  const panY = rawPan[1] === undefined ? null : num(rawPan[1]);

  return {
    ...(params.get("overview") === "1" ? { overview: true } : {}),
    ...(params.get("zoom") === "1" ? { zoom: true } : {}),
    ...(panX !== null && panY !== null ? { pan: { x: panX, y: panY } } : {}),
    focusId: params.get("focus"),
    relation: params.get("relation"),
    expanded: (params.get("expand") ?? "")
      .split(",")
      .filter((id) => id.length > 0)
      .sort(),
    pins,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Two views are the same stop when they serialise the same. */
export function sameView(a: ViewState, b: ViewState): boolean {
  return toUrl(a) === toUrl(b);
}

export function withFocus(state: ViewState, focusId: string | null): ViewState {
  return { ...state, focusId };
}

export function withRelation(state: ViewState, relation: string | null): ViewState {
  return { ...state, relation };
}

export function withOverview(state: ViewState, overview: boolean): ViewState {
  return { ...state, overview };
}

/** Zoom the focus in close, or back out. */
export function withZoom(state: ViewState, zoom: boolean): ViewState {
  if (!zoom) {
    const { zoom: _drop, ...rest } = state;
    return rest;
  }
  return { ...state, zoom: true };
}

/**
 * Expanding an aggregate and collapsing it are the same operation in two
 * directions — one code path, so semantic zoom and grouping cannot drift
 * apart.
 */
export function toggleExpanded(state: ViewState, aggregateId: string): ViewState {
  const open = new Set(state.expanded);
  if (open.has(aggregateId)) open.delete(aggregateId);
  else open.add(aggregateId);
  return { ...state, expanded: [...open].sort() };
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

/** Put everything the user moved back where the layout wanted it. */
export function withoutMoves(state: ViewState): ViewState {
  const { pan: _drop, ...rest } = state;
  return { ...rest, pins: {} };
}

export function withPin(state: ViewState, id: string, pin: Pin | null): ViewState {
  const pins = { ...state.pins };
  if (pin === null) delete pins[id];
  else pins[id] = pin;
  return { ...state, pins };
}
