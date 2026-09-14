import { coloursIn, contrast, hsl, type Rgba } from "./contrast.js";
import type { ThemeTokens } from "./types.js";

/*
 * THE KIT: everything the scene draws that is not a view, declared.
 *
 * Connectors, captions, the ground's grid and lattice, the kind tags, the
 * marks — each is a named entry with what a brand may set (colour,
 * visibility, weight) and, where a shape is a choice, a named strategy with
 * one implementation today and room for the next. A connector's route is
 * "curve" now; "straight" and "orthogonal" are cases in one file, not a
 * rework of the scene. A stroke's pattern is one of five dashes. Nothing
 * here is a literal in the scene: the scene asks the kit, the theme turns
 * the kit into custom properties, and the checker holds the kit's colours
 * to the same contrast the text is held to.
 */

/** How a connector travels between its two ends. */
export type ConnectorRoute = "curve" | "straight" | "orthogonal";
export type KitStrokePattern = "solid" | "dashed" | "dotted" | "double" | "tapered";
export type KitEndCap = "none" | "arrow" | "dot" | "bar";

export interface ConnectorKit {
  /** The path's shape. One strategy per name; adding one is one case. */
  readonly route: ConnectorRoute;
  /** Drawn at all. An edge kind a brand keeps quiet is still selectable from the inspector. */
  readonly visible: boolean;
  /** An explicit CSS colour; absent, the kind's own hue. */
  readonly colour?: string;
  readonly pattern?: KitStrokePattern;
  readonly width?: number;
  readonly cap?: KitEndCap;
  readonly opacity?: number;
}

export interface Kit {
  readonly connectors: {
    /** Every edge kind, unless `byEdge` says otherwise. */
    readonly all: ConnectorKit;
    /** Per edge kind: colour, visibility, pattern — whatever this kind wants differently. */
    readonly byEdge: Readonly<Record<string, Partial<ConnectorKit>>>;
  };
  /** The words over a neighbourhood: the edge's own reading. */
  readonly captions: { readonly visible: boolean };
  /** The fine square measure under the scene on the ground. */
  readonly grid: { readonly visible: boolean; readonly size: number };
  /** The isometric lattice the ground becomes from altitude. */
  readonly lattice: { readonly visible: boolean; readonly size: number };
  /** The kind's name astride a focused card. */
  readonly tags: { readonly visible: boolean };
  /** What an unlit line keeps of its opacity while another is lit: 0 vanishes, 1 does not recede. */
  readonly emphasis: { readonly dim: number };
  /** The glyph a broken rule leaves on what it names. */
  readonly marks: { readonly flag: string };
}

/** A brand's say: any part of the kit, the rest as shipped. */
export interface KitOverrides {
  readonly connectors?: {
    readonly all?: Partial<ConnectorKit>;
    readonly byEdge?: Readonly<Record<string, Partial<ConnectorKit>>>;
  };
  readonly captions?: Partial<Kit["captions"]>;
  readonly grid?: Partial<Kit["grid"]>;
  readonly lattice?: Partial<Kit["lattice"]>;
  readonly tags?: Partial<Kit["tags"]>;
  readonly emphasis?: Partial<Kit["emphasis"]>;
  readonly marks?: Partial<Kit["marks"]>;
}

export const DEFAULT_KIT: Kit = {
  connectors: { all: { route: "curve", visible: true }, byEdge: {} },
  captions: { visible: true },
  grid: { visible: true, size: 64 },
  lattice: { visible: true, size: 46 },
  tags: { visible: true },
  emphasis: { dim: 0.34 },
  marks: { flag: "⚠" },
};

/** The kit as this brand wants it, every entry present. */
export function resolveKit(overrides?: KitOverrides): Kit {
  if (!overrides) return DEFAULT_KIT;
  return {
    connectors: {
      all: { ...DEFAULT_KIT.connectors.all, ...(overrides.connectors?.all ?? {}) },
      byEdge: { ...DEFAULT_KIT.connectors.byEdge, ...(overrides.connectors?.byEdge ?? {}) },
    },
    captions: { ...DEFAULT_KIT.captions, ...(overrides.captions ?? {}) },
    grid: { ...DEFAULT_KIT.grid, ...(overrides.grid ?? {}) },
    lattice: { ...DEFAULT_KIT.lattice, ...(overrides.lattice ?? {}) },
    tags: { ...DEFAULT_KIT.tags, ...(overrides.tags ?? {}) },
    emphasis: { ...DEFAULT_KIT.emphasis, ...(overrides.emphasis ?? {}) },
    marks: { ...DEFAULT_KIT.marks, ...(overrides.marks ?? {}) },
  };
}

/** One edge kind's connector, `all` under `byEdge`. */
export function connectorKitFor(kit: Kit, edgeKind: string): ConnectorKit {
  return { ...kit.connectors.all, ...(kit.connectors.byEdge[edgeKind] ?? {}) };
}

/**
 * The kit as custom properties, so the theme's rules read it and a host can
 * override one entry without forking a component. Booleans become the CSS
 * that carries them — a display, a multiplier — so no rule needs a script.
 */
export function kitVariables(kit: Kit): string {
  return [
    `  --graview-kit-grid: ${kit.grid.visible ? 1 : 0};`,
    `  --graview-kit-grid-size: ${kit.grid.size}px;`,
    `  --graview-kit-lattice: ${kit.lattice.visible ? 1 : 0};`,
    `  --graview-kit-lattice-size: ${kit.lattice.size}px;`,
    `  --graview-kit-tags: ${kit.tags.visible ? "inline-flex" : "none"};`,
    `  --graview-kit-captions: ${kit.captions.visible ? "block" : "none"};`,
    `  --graview-kit-dim: ${kit.emphasis.dim};`,
    `  --graview-kit-flag: "${kit.marks.flag.replace(/"/g, "'")}";`,
  ].join("\n");
}

export interface KitContrastFinding {
  readonly edgeKind: string | "*";
  readonly colour: string;
  readonly ratio: number;
  readonly requires: number;
  readonly unreadable?: string;
}

/**
 * A connector's colour must be told from the ground it crosses: 3:1, the
 * floor for graphics, on both the ground and the deeper ground the
 * altitude view uses. Only explicit colours are judged — a kind's own hue
 * is the theme's to keep readable.
 */
export function checkKitContrast(kit: Kit, tokens: ThemeTokens): readonly KitContrastFinding[] {
  const findings: KitContrastFinding[] = [];
  const grounds = [tokens.ground, tokens.groundDeep]
    .map((value) => coloursIn(value)[0])
    .filter((c): c is Rgba => c !== undefined);
  const judge = (edgeKind: string | "*", colour: string | undefined) => {
    if (!colour) return;
    const ink = coloursIn(colour)[0];
    if (!ink) {
      findings.push({ edgeKind, colour, ratio: 0, requires: 3, unreadable: colour });
      return;
    }
    for (const ground of grounds) {
      const ratio = Math.round(contrast(ink, ground) * 100) / 100;
      if (ratio < 3) findings.push({ edgeKind, colour, ratio, requires: 3 });
    }
  };
  judge("*", kit.connectors.all.colour);
  for (const [edgeKind, connector] of Object.entries(kit.connectors.byEdge)) judge(edgeKind, connector.colour);
  return findings;
}

/** The kind's own hue (degrees) as the theme paints a connector, for callers that want the same colour elsewhere. */
export function connectorHueColour(hue: number): Rgba {
  return hsl(hue, 55, 62);
}
