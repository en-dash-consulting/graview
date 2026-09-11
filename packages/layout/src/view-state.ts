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
   * The HORIZON widened: retired nodes shown alongside current ones.
   *
   * A stop like every other — a URL, a back-button entry, tweenable — so
   * "show me the retired agreements" is a place you go and come back from,
   * not a setting you forget you flipped.
   */
  readonly past?: boolean;
  /**
   * What is SELECTED, as part of the stop.
   *
   * Selection used to live only in component state, which broke the central
   * promise twice over: back/forward restored the view but stranded the
   * selection — the inspector kept talking about a thing from a stop you had
   * already left — and a shared link could name the place but not the thing.
   * If the pane on the left depends on it, it is part of where you are.
   */
  readonly selection?: readonly string[];
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
  if (state.past) params.set("past", "1");
  if (state.selection !== undefined && state.selection.length > 0) {
    params.set("sel", [...state.selection].sort().join(","));
  }
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
/**
 * A stop may name a group by its kind in short: `focus=agg:plot` is
 * `focus=aggregate:plot`. The long form is what the layout mints and what
 * `toUrl` writes; the short form is what a person or a page writes by hand.
 */
function unabbreviated(id: string | null): string | null {
  return id && id.startsWith("agg:") ? `aggregate:${id.slice(4)}` : id;
}

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

  const sel = (params.get("sel") ?? "")
    .split(",")
    .filter((id) => id.length > 0)
    .sort();

  /*
   * A district stays a district. `expand=kind:*` written from altitude
   * means "this district is open on the ring"; the same key inside the
   * stack dissolves the shelf card into loose members — a reading no
   * control offers, which history and bookmarks kept re-importing as a
   * chip soup across the bottom band. An in-stack address simply cannot
   * say it; carried back up to the ring, the overview stop still can.
   */
  const overview = params.get("overview") === "1";

  return {
    ...(sel.length > 0 ? { selection: sel } : {}),
    ...(overview ? { overview: true } : {}),
    ...(params.get("zoom") === "1" ? { zoom: true } : {}),
    ...(params.get("past") === "1" ? { past: true } : {}),
    ...(panX !== null && panY !== null ? { pan: { x: panX, y: panY } } : {}),
    focusId: unabbreviated(params.get("focus")),
    relation: params.get("relation"),
    expanded: (params.get("expand") ?? "")
      .split(",")
      .filter((id) => id.length > 0 && (overview || !id.startsWith("kind:")))
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

/**
 * A RELATION in the selection: `edge:<kind>:<from>:<to>`, each part escaped.
 *
 * Lines joined the selection model after nodes did, and for the same
 * reason the selection is in the URL at all — an inspector about a thing
 * you cannot name is an inspector you cannot share or return to.
 *
 * THE SEPARATOR CANNOT BE A CHARACTER AN ID MAY CONTAIN. This used to say
 * that node ids never hold a ":" and leave it there, and the framework's own
 * `ctx.freshId(label, kind)` mints "item:buy-milk" — so in every scaffolded
 * app the three-part split came back with five parts, `edgeOfSelection`
 * returned null, and a selected line fell through to the inspector's
 * "nothing can be done with this mix of kinds" while the strip's title was
 * the raw selection string. Escaping each part is the fix that does not
 * depend on what an app calls things.
 */
export const EDGE_SELECTION_PREFIX = "edge:";

export function edgeSelectionId(kind: string, from: string, to: string): string {
  const part = (value: string): string => encodeURIComponent(value);
  return `${EDGE_SELECTION_PREFIX}${part(kind)}:${part(from)}:${part(to)}`;
}

export interface EdgeRef {
  readonly kind: string;
  readonly from: string;
  readonly to: string;
}

/** The edge a selection entry names, or null when it names a node. */
export function edgeOfSelection(id: string): EdgeRef | null {
  if (!id.startsWith(EDGE_SELECTION_PREFIX)) return null;
  const parts = id.slice(EDGE_SELECTION_PREFIX.length).split(":");
  if (parts.length !== 3) return null;
  const [kind, from, to] = parts;
  if (!kind || !from || !to) return null;
  try {
    return { kind: decodeURIComponent(kind), from: decodeURIComponent(from), to: decodeURIComponent(to) };
  } catch {
    // A half-typed or truncated address is a selection of nothing, not a crash.
    return null;
  }
}

/*
 * A MOVE BELONGS TO THE STOP IT WAS MADE AT.
 *
 * A pin and a pan adjust the picture you are looking at: this card a little
 * to the left, the whole scene nudged up. They are stored by node id and in
 * canvas pixels, which say nothing once the picture is a different one — the
 * card you dragged as the focus is a neighbour at the next stop, and holding
 * it at the focus's old coordinates draws it over the new focus. So a new
 * stop starts where the layout puts things: changing the focus, rising or
 * descending, and zooming in or out all leave the moves behind. The old stop
 * keeps them in its own address, so Back returns to the picture you arranged.
 */
function leavingTheStop(state: ViewState): ViewState {
  const { pan: _drop, ...rest } = state;
  return { ...rest, pins: {} };
}

export function withFocus(state: ViewState, focusId: string | null): ViewState {
  if (focusId === state.focusId) return { ...state, focusId };
  return { ...leavingTheStop(state), focusId };
}

export function withRelation(state: ViewState, relation: string | null): ViewState {
  return { ...state, relation };
}

export function withOverview(state: ViewState, overview: boolean): ViewState {
  if (overview !== state.overview) state = leavingTheStop(state);
  if (!overview) {
    /*
     * OPEN DISTRICTS STAY AT ALTITUDE. Opening a kind card up on the ring
     * means "show this district's members in place"; the same expansion key
     * inside the stack means "dissolve the shelf card into loose members",
     * which nobody asked for on the way down — descending with districts
     * open scattered their whole rosters across the shelf as a chip soup.
     * The overview stop keeps the state, so going back up reopens them.
     */
    // "kind:" is KIND_PREFIX in layout.ts — written out here to keep this
    // module import-free (layout already type-imports from this file).
    const expanded = state.expanded.filter((id) => !id.startsWith("kind:"));
    return { ...state, overview: false, expanded };
  }
  return { ...state, overview };
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
 * Change what is selected. An empty selection leaves no key behind — the
 * default state serialises to the default URL.
 */
export function withSelection(state: ViewState, selection: readonly string[]): ViewState {
  if (selection.length === 0) {
    const { selection: _drop, ...rest } = state;
    return rest;
  }
  return { ...state, selection: [...selection] };
}

/** Zoom the focus in close, or back out. */
export function withZoom(state: ViewState, zoom: boolean): ViewState {
  if (zoom !== (state.zoom === true)) state = leavingTheStop(state);
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
  return leavingTheStop(state);
}

export function withPin(state: ViewState, id: string, pin: Pin | null): ViewState {
  const pins = { ...state.pins };
  if (pin === null) delete pins[id];
  else pins[id] = pin;
  return { ...state, pins };
}
