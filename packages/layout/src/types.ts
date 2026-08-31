export type Plane = 0 | 1 | 2;

/**
 * An aggregate node is first-class, not a scale fallback. "People" is a
 * legitimate view of a kind, which is why grouping and semantic zoom are one
 * mechanism running in both directions.
 */
export interface Aggregate {
  readonly kind: string;
  readonly memberIds: readonly string[];
  /** Plural label from the kind's declaration, e.g. "People". */
  readonly label: string;
}

/**
 * Why a node is on plane 1 at all: the edge that reached it, in the schema's
 * own words.
 *
 * Every edge declaration already carries a description — "who does the run",
 * "a nap that must not be interrupted" — and until now nothing in the
 * interface ever showed it. Carrying it through the layout means a raised
 * node can say what its relationship to the focus IS, rather than merely
 * sitting near it and leaving the reader to guess.
 */
export interface Via {
  readonly edgeKind: string;
  readonly direction: "out" | "in";
  /** The edge declaration's own description, when it has one. */
  readonly description?: string;
}

export interface LayoutNode {
  /** A real node id, or `aggregate:<kind>` for a group. */
  readonly id: string;
  readonly kind: string;
  readonly plane: Plane;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Set when this node stands in for a group rather than one graph node. */
  readonly aggregate?: Aggregate;
  /** Set on plane 1 when this node was reached by following an edge. */
  readonly via?: Via;
  /**
   * A group whose members are currently raised onto plane 1.
   *
   * It stays where it was, emptied, so the eye can tie the relation plane
   * back to where it came from. Without it the only evidence of what is
   * raised is the breadcrumb, and a spatial interface should not need to be
   * read.
   */
  readonly raised?: boolean;
  /**
   * A group standing for the kind currently in focus.
   *
   * It stays on the kinds plane rather than being removed, so the strip is a
   * constant map and you can see that the picture above IS this kind.
   */
  readonly focused?: boolean;
  /** True when the user pinned this position rather than the layout choosing it. */
  readonly pinned: boolean;
}

export interface Connector {
  readonly id: string;
  /** The edge kind, so stroke treatment can carry meaning. */
  readonly kind: string;
  readonly from: string;
  readonly to: string;
  /** Endpoints in layout space, centre to centre. */
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface Layout {
  readonly nodes: readonly LayoutNode[];
  readonly connectors: readonly Connector[];
  readonly width: number;
  readonly height: number;
}

export interface LayoutOptions {
  readonly width?: number;
  readonly height?: number;
  /** Size of the focus view at plane 0. */
  readonly focusSize?: { width: number; height: number };
  readonly relationSize?: { width: number; height: number };
  readonly contextSize?: { width: number; height: number };
  readonly gap?: number;
  /** Plural labels by kind, from the schema. */
  readonly plurals?: Readonly<Record<string, string>>;
}

/**
 * Three bands, chosen so the planes never overlap at their own scales.
 *
 * Sizes are in layout units; the plane's scale shrinks the drawn box in
 * place, so a band's height is its size times that scale.
 */
/**
 * Sizes here are CAPS, not fixed boxes: a band fits its contents across the
 * canvas and never exceeds the cap. Heights come from the band proportions in
 * `layout()`, which is what keeps the composition together at any size.
 */
export const DEFAULT_OPTIONS: Required<Omit<LayoutOptions, "plurals">> = {
  width: 1200,
  height: 760,
  focusSize: { width: 1040, height: 420 },
  relationSize: { width: 240, height: 140 },
  contextSize: { width: 230, height: 130 },
  gap: 26,
};
