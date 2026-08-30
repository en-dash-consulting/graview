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
export const DEFAULT_OPTIONS: Required<Omit<LayoutOptions, "plurals">> = {
  width: 1200,
  height: 760,
  focusSize: { width: 700, height: 400 },
  relationSize: { width: 200, height: 130 },
  contextSize: { width: 190, height: 120 },
  gap: 24,
};
