/**
 * Connector styling. Edge kind determines stroke treatment, because the line
 * between two nodes carries meaning: `protects` must never look like
 * `assigned-to`, or the picture is lying about the graph.
 */

export type StrokePattern = "solid" | "dashed" | "dotted" | "double" | "tapered";
export type EndCap = "none" | "arrow" | "dot" | "bar";

export interface ConnectorStyle {
  readonly pattern: StrokePattern;
  readonly width: number;
  readonly cap: EndCap;
  /** 0..1 around the colour wheel; the renderer maps it into its own palette. */
  readonly hue: number;
  readonly opacity: number;
}

/**
 * The treatments a derived style may take. Deliberately distinguishable by
 * shape as well as by hue: colour alone is not a way to tell two relationships
 * apart.
 */
const PATTERNS: readonly StrokePattern[] = ["solid", "dashed", "dotted", "double", "tapered"];
const CAPS: readonly EndCap[] = ["arrow", "none", "dot", "bar"];

/** Stable string hash — the same edge kind always gets the same treatment. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A distinct treatment for an edge kind, derived rather than authored.
 *
 * A new edge kind gets a stroke nobody had to choose — which is the same
 * promise the rest of the framework makes: declare the kind, and the visual
 * language follows. Apps override anything they care about.
 */
export function connectorStyle(
  kind: string,
  overrides: Readonly<Record<string, Partial<ConnectorStyle>>> = {},
): ConnectorStyle {
  const h = hash(kind);
  const derived: ConnectorStyle = {
    pattern: PATTERNS[h % PATTERNS.length]!,
    width: 1.5 + ((h >>> 3) % 3) * 0.75,
    cap: CAPS[(h >>> 7) % CAPS.length]!,
    hue: ((h >>> 11) % 360) / 360,
    opacity: 0.85,
  };
  return { ...derived, ...overrides[kind] };
}

/**
 * Checks that a set of edge kinds are actually distinguishable from one
 * another. Two relationships that render identically are a bug in the visual
 * language, not a cosmetic issue — so this is worth asserting in a test
 * rather than noticing in a screenshot.
 */
export function distinguishable(
  kinds: readonly string[],
  overrides?: Readonly<Record<string, Partial<ConnectorStyle>>>,
): { ok: boolean; collisions: readonly [string, string][] } {
  const styles = kinds.map((kind) => [kind, connectorStyle(kind, overrides)] as const);
  const collisions: [string, string][] = [];
  for (let i = 0; i < styles.length; i++) {
    for (let j = i + 1; j < styles.length; j++) {
      const [aKind, a] = styles[i]!;
      const [bKind, b] = styles[j]!;
      const sameShape = a.pattern === b.pattern && a.cap === b.cap && a.width === b.width;
      const sameHue = Math.abs(a.hue - b.hue) < 0.04;
      if (sameShape && sameHue) collisions.push([aKind, bKind]);
    }
  }
  return { ok: collisions.length === 0, collisions };
}

/**
 * The dash array for a stroke pattern, in one place.
 *
 * Exported because the scene is not the only thing that draws a connector: a
 * legend has to draw the SAME line, and a legend whose swatch is an
 * approximation is a legend you cannot trust. Copying this map was the exact
 * failure the legend's own docstring promised against.
 */
export const CONNECTOR_DASH: Readonly<Record<StrokePattern, string | undefined>> = {
  solid: undefined,
  dashed: "7 5",
  dotted: "1 5",
  double: "12 3",
  tapered: "10 3 3 3",
};

/** The colour a connector of this kind is stroked in, on either surface. */
export function connectorStroke(style: ConnectorStyle): string {
  return `hsl(${Math.round(style.hue * 360)} 55% 62%)`;
}

/**
 * How thick, given where it is drawn.
 *
 * Inside the scene a connector is an aside and stays thin; above the stack the
 * lines are the content and earn their weight.
 */
export function connectorWidth(style: ConnectorStyle, overview: boolean): number {
  return overview ? Math.max(1.6, style.width) : Math.min(1.4, style.width);
}
