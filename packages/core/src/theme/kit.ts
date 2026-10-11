import { colorsIn, contrast, hsl, type Rgba } from "./contrast.js";
import type { ConnectorKit, Kit, KitOverrides, ThemeTokens } from "./types.js";

/*
 * THE KIT: everything the scene draws that is not a view, declared.
 *
 * Connectors, captions, the ground's grid and lattice, the kind tags, the
 * marks — each is a named entry with what a brand may set (color,
 * visibility, weight) and, where a shape is a choice, a named strategy with
 * one implementation today and room for the next. A connector's route is
 * "curve" now; "straight" and "orthogonal" are cases in one file, not a
 * rework of the scene. A stroke's pattern is one of five dashes. Nothing
 * here is a literal in the scene: the scene asks the kit, the theme turns
 * the kit into custom properties, and the checker holds the kit's colors
 * to the same contrast the text is held to.
 */

export const DEFAULT_KIT: Kit = {
  connectors: { all: { route: "curve", visible: true }, byEdge: {} },
  captions: { visible: true },
  grid: { visible: true, size: 64 },
  lattice: { visible: true, size: 46 },
  tags: { visible: true },
  emphasis: { rest: 0.34, dim: 0.12 },
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
    `  --graview-kit-rest: ${kit.emphasis.rest};`,
    `  --graview-kit-dim: ${kit.emphasis.dim};`,
    `  --graview-kit-flag: "${kit.marks.flag.replace(/"/g, "'")}";`,
  ].join("\n");
}

export interface KitContrastFinding {
  readonly edgeKind: string | "*";
  readonly color: string;
  readonly ratio: number;
  readonly requires: number;
  readonly unreadable?: string;
  /** Which ground it failed on: the scene's own, or the deeper one under a district. */
  readonly ground?: "ground" | "deep ground";
}

/**
 * A connector's color must be told from the ground it crosses: 3:1, the
 * floor for graphics, on both the ground and the deeper ground the
 * altitude view uses. Only explicit colors are judged — a kind's own hue
 * is the theme's to keep readable.
 */
export function checkKitContrast(kit: Kit, tokens: ThemeTokens): readonly KitContrastFinding[] {
  const findings: KitContrastFinding[] = [];
  const grounds = ([["ground", tokens.ground], ["deep ground", tokens.groundDeep]] as const)
    .map(([name, value]) => ({ name, color: colorsIn(value)[0] }))
    .filter((one): one is { name: "ground" | "deep ground"; color: Rgba } => one.color !== undefined);
  const judge = (edgeKind: string | "*", color: string | undefined) => {
    if (!color) return;
    const ink = colorsIn(color)[0];
    if (!ink) {
      findings.push({ edgeKind, color, ratio: 0, requires: 3, unreadable: color });
      return;
    }
    for (const ground of grounds) {
      const ratio = Math.round(contrast(ink, ground.color) * 100) / 100;
      if (ratio < 3) findings.push({ edgeKind, color, ratio, requires: 3, ground: ground.name });
    }
  };
  judge("*", kit.connectors.all.color);
  for (const [edgeKind, connector] of Object.entries(kit.connectors.byEdge)) judge(edgeKind, connector.color);
  return findings;
}

/** The kind's own hue (degrees) as the theme paints a connector, for callers that want the same color elsewhere. */
export function connectorHueColor(hue: number): Rgba {
  return hsl(hue, 55, 62);
}
