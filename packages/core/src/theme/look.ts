import { GRAVIEW_FACE, PLAIN_WEIGHTS, WEIGHTS } from "./identity.js";
import type { Brand, Scheme } from "./types.js";

/*
 * THE LOOK, AS DATA (FR-73).
 *
 * The palettes were already here; the rest of what makes a page look like
 * Graview — how round a panel is, how much room it gives, which faces the
 * words are set in, how a block's three faces are lit — lived only as
 * numbers inside `themeCss`, in the UI package. A host that dresses its own
 * pages as a Graview app (a hosting service's dashboard, a docs site) had
 * to copy them and lint the copy. They are declarations, and declarations
 * live here: `themeCss` reads these, so there is one source, and a host
 * reads the same values without importing React or a stylesheet.
 *
 * Every value is frozen plain data. Nothing here touches a DOM.
 */

/**
 * The framework's own shape: the values a brand's `shape` overrides.
 *
 * `radius` and `density` are what a brand may set (`Brand.shape`); the rest
 * are the spacing a density of 1 means, in pixels, and the ratio a small
 * radius keeps to the large one. A brand cannot override those directly —
 * it moves them all at once with `density`, which is the point: one number
 * for how tight a product is, not five.
 */
export const SHAPE = Object.freeze({
  /**
   * A panel's corner, in pixels. Modest, as the identity asks (the design
   * kit, revision 03): a panel is a sheet with corners, not a capsule.
   */
  radius: 8,
  /** Padding multiplier. 1 is the framework's own spacing. */
  density: 1,
  /** A small corner (a chip, a field) as a share of the panel's, never under `radiusSmallFloor`. */
  radiusSmall: 0.72,
  radiusSmallFloor: 2,
  /** A panel's padding at density 1, in pixels. */
  pad: 15,
  /** A tight padding (a row, a chip) at density 1. */
  padSmall: 10,
  /** The gap between siblings at density 1. */
  gap: 7,
});

/**
 * The framework's own type: the stacks a brand's `typography` overrides.
 * The display face is the body face unless a brand names one — a brand with
 * one font is not asked to name it twice.
 *
 * The body names Montserrat, the identity's face, and then the system's.
 * The framework never fetches a font: where the host has not loaded
 * Montserrat (`@graview/primitives/montserrat.css`, or its own copy), the
 * words are set in the reader's system sans, as they always were.
 */
export const TYPOGRAPHY = Object.freeze({
  body: `"${GRAVIEW_FACE}", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
});

/** A brand's shape, every pixel resolved: what `themeCss` writes as `--graview-radius`, `--graview-pad` and the rest. */
export interface ResolvedShape {
  readonly radius: number;
  readonly radiusSmall: number;
  readonly pad: number;
  readonly padSmall: number;
  readonly gap: number;
}

/**
 * The shape a brand draws with, in pixels: its own `radius` and `density`
 * where it declared them, the framework's where it did not.
 */
export function shapeOf(brand?: Pick<Brand, "shape">): ResolvedShape {
  const radius = brand?.shape?.radius ?? SHAPE.radius;
  const density = brand?.shape?.density ?? SHAPE.density;
  return Object.freeze({
    radius,
    radiusSmall: Math.max(SHAPE.radiusSmallFloor, Math.round(radius * SHAPE.radiusSmall)),
    pad: Math.round(SHAPE.pad * density),
    padSmall: Math.round(SHAPE.padSmall * density),
    gap: Math.round(SHAPE.gap * density),
  });
}

/** A brand's type, every stack resolved: what `themeCss` writes as `--graview-font-body`, `-display` and `-mono`. */
export interface ResolvedTypography {
  readonly body: string;
  readonly display: string;
  readonly mono: string;
  /** What `themeCss` writes as `--graview-weight-display`, `-body` and `-label`. */
  readonly weights: { readonly display: number; readonly body: number; readonly label: number };
}

/**
 * The faces a brand sets its words in: its own where it named them, the
 * framework's where it did not. The weights are the brand's where it named
 * them; otherwise the identity's (550, 450, 600) on the framework's own
 * face, and the plain ones (600, 400, 600) on a face the brand chose, since
 * the in-between weights only mean something in a variable face.
 */
export function typographyOf(brand?: Pick<Brand, "typography">): ResolvedTypography {
  const body = brand?.typography?.body ?? TYPOGRAPHY.body;
  const display = brand?.typography?.display ?? body;
  const own = body === TYPOGRAPHY.body && display === TYPOGRAPHY.body;
  const base = own ? WEIGHTS : PLAIN_WEIGHTS;
  const asked = brand?.typography?.weights;
  return Object.freeze({
    body,
    display,
    mono: brand?.typography?.mono ?? TYPOGRAPHY.mono,
    weights: Object.freeze({
      display: asked?.display ?? base.display,
      body: asked?.body ?? base.body,
      label: asked?.label ?? base.label,
    }),
  });
}

/** One face of a block, as HSL without its hue: the kind supplies the hue. */
export interface IsoFace {
  /** Percent, 0–100. */
  readonly saturation: number;
  /** Percent, 0–100. */
  readonly lightness: number;
}

/** A translucent face — a district's plot under its blocks — as HSL without its hue, with its opacity. */
export interface IsoWash extends IsoFace {
  /** 0–1. */
  readonly alpha: number;
}

/** How the scene lights a kind's block and the plot it stands on, in one scheme. */
export interface IsoShade {
  /** The face toward the sky: lightest. */
  readonly roof: IsoFace;
  /** The wall toward the light. */
  readonly right: IsoFace;
  /** The wall away from it: darkest. */
  readonly left: IsoFace;
  /** The roof's lit edge, as a CSS color. */
  readonly roofEdge: string;
  /** The district's plot: the ground the blocks stand on. */
  readonly plot: IsoWash;
  /** The plot's curb. */
  readonly plotEdge: IsoWash;
}

/*
 * The two lightings. Not one lighting inverted: in daylight a block is pale
 * with a white lit edge, and depth is the walls getting darker; at night the
 * roof is the brightest thing on a dark ground and the walls fall away.
 */
const SHADES: Readonly<Record<Scheme, IsoShade>> = Object.freeze({
  light: Object.freeze({
    roof: Object.freeze({ saturation: 48, lightness: 82 }),
    right: Object.freeze({ saturation: 40, lightness: 66 }),
    left: Object.freeze({ saturation: 34, lightness: 55 }),
    roofEdge: "rgba(255,255,255,0.75)",
    plot: Object.freeze({ saturation: 45, lightness: 58, alpha: 0.12 }),
    plotEdge: Object.freeze({ saturation: 40, lightness: 48, alpha: 0.55 }),
  }),
  dark: Object.freeze({
    roof: Object.freeze({ saturation: 42, lightness: 32 }),
    right: Object.freeze({ saturation: 40, lightness: 21 }),
    left: Object.freeze({ saturation: 38, lightness: 13 }),
    roofEdge: "rgba(255,255,255,0.14)",
    plot: Object.freeze({ saturation: 45, lightness: 48, alpha: 0.2 }),
    plotEdge: Object.freeze({ saturation: 40, lightness: 62, alpha: 0.55 }),
  }),
});

/**
 * How the scene shades a kind's block in a scheme: three faces and the plot
 * under them, each as saturation and lightness WITHOUT a hue.
 *
 * The hue is the kind's — `hueFor(kind, brand.accents)` — so a brand
 * composes with this through its accents and nowhere else: a declared
 * accent turns every face of that kind's block, and the lighting stays the
 * scene's. The lighting is not a brand's to set, because it is what makes
 * a block read as a block on the shipped grounds in both schemes.
 *
 * `hsl(${hue} ${face.saturation}% ${face.lightness}%)` is a face's color.
 */
export function isoShade(scheme: Scheme): IsoShade {
  return SHADES[scheme];
}
