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
  if (state.expanded.length > 0) {
    params.set("expand", [...state.expanded].sort().join(","));
  }
  for (const id of Object.keys(state.pins).sort()) {
    const pin = state.pins[id]!;
    params.set(`pin.${id}`, `${round(pin.x)},${round(pin.y)}`);
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
  return {
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

export function withPin(state: ViewState, id: string, pin: Pin | null): ViewState {
  const pins = { ...state.pins };
  if (pin === null) delete pins[id];
  else pins[id] = pin;
  return { ...state, pins };
}
