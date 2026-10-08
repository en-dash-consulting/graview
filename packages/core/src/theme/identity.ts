/*
 * GRAVIEW'S OWN IDENTITY, AS DATA (the design kit, revision 03).
 *
 * Three layers make a Graview app look the way it does, and this file is
 * the first of them:
 *
 * 1. **The identity** (here): En Dash navy and turquoise, paper and ink,
 *    Montserrat and its three weights, and the shared-plane symbol. These
 *    are Graview's, and they reach an app only through the framework's own
 *    defaults (`LIGHT`, `DARK`, `TYPOGRAPHY`, `WEIGHTS`) — never into an
 *    app that declared its own brand, and never into a kind's district.
 * 2. **The semantic tokens** (`ThemeTokens`, written as `--graview-*`):
 *    ground, panel, ink, accent, warn, edge, the weights and the shape. Every
 *    component reads these and nothing else, so it never has to know whose
 *    product it is drawing.
 * 3. **The app's overrides** (`Brand`): its name, logo, favicon, palette,
 *    faces, weights, radius, density, a hue per kind and the kit.
 *
 * Nothing here touches a DOM, and nothing here is a font file: the faces are
 * NAMED, and a host or a page loads them (`@graview/primitives/montserrat.css`
 * is the framework's optional copy).
 */

/** The identity's colors, as the kit gives them. Not a palette: `LIGHT` and `DARK` are built from these. */
export const GRAVIEW_COLORS = Object.freeze({
  /** En Dash navy: the primary ink of the identity, and the light scheme's accent. */
  navy: "#001769",
  /**
   * En Dash turquoise: the symbol's point, and an accent FILL only. It is
   * never text on paper (1.5:1); text on it is navy. Nothing the framework
   * draws by default depends on it: a one-color mark is the whole mark.
   */
  turquoise: "#00e5b9",
  /** The warm surface the light scheme stands on. */
  paper: "#f7f7f2",
  /** Reading text. */
  ink: "#18213a",
  /** Secondary text: 5.8:1 on paper, 6.2:1 on white. */
  muted: "#586174",
});

/** The family the identity is set in. Named in `TYPOGRAPHY`; loaded by the host, or by `@graview/primitives/montserrat.css`. */
export const GRAVIEW_FACE = "Montserrat";

/**
 * The identity's three weights, for a variable face: large calm headlines,
 * comfortable reading, and short action labels. A face without the
 * in-between weights rounds them as CSS says (450 to 400, 550 to 600).
 */
export const WEIGHTS = Object.freeze({
  display: 550,
  body: 450,
  label: 600,
});

/**
 * The weights a brand that names its own faces gets when it names no
 * weights: the conventional ones, since 450 and 550 only mean something in
 * a variable face, and a static one would round them.
 */
export const PLAIN_WEIGHTS = Object.freeze({
  display: 600,
  body: 400,
  label: 600,
});

/** Display tracking: large headlines are set a little tight. */
export const DISPLAY_TRACKING = "-0.025em";

/**
 * How the symbol and the horizontal logo are used (the kit's handoff page).
 * A size is the symbol's displayed height in CSS pixels.
 */
export const LOGO_RULES = Object.freeze({
  /** The horizontal Graview logo is not drawn narrower than this. */
  minWidth: 140,
  /** Clear space on every side, as a share of the displayed symbol's height. */
  clearSpace: 0.5,
  /** At and under this, the optical micro symbol. */
  microMax: 24,
  /** At and over this, the regular symbol. */
  regularMin: 32,
  /**
   * Between the two, the one that reads more clearly. Measured at 25–31 px
   * at 1x and 2x: the micro's heavier strokes and wider gaps hold up to 27,
   * the regular's finer geometry reads from 28.
   */
  microBelow: 28,
});

/*
 * THE SYMBOL, as the kit's outlined masters draw it: two open isometric
 * planes joined by a point. These are the kit's own paths, unchanged, with
 * their fixed colors turned into `currentColor` so an inline copy inherits
 * the ink it stands in, and the point's fill left to `--graview-mark-point`
 * (currentColor when unset: the one-color mark, which is the whole mark).
 */
const REGULAR = {
  viewBox: "0 0 196 166",
  body:
    '<g fill="none" stroke="currentColor" stroke-width="8.4" stroke-linejoin="round">' +
    '<path d="M81 63 L15 49 L84 12 H181 L120 56"/>' +
    '<path d="M60 100 L15 127 L101 150 L179 107 L123 98"/>' +
    '<path d="M101 95 V125" stroke-linecap="round"/></g>' +
    '<circle cx="101" cy="74" r="11.7" fill="var(--graview-mark-point, currentColor)"/>',
};
const MICRO = {
  viewBox: "0 0 32 32",
  body:
    '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round">' +
    '<path d="M13 11 L3 8 L14 3 H29 L21 9"/>' +
    '<path d="M10 18 L3 23 L16.5 28 L29 21 L22 19"/>' +
    '<path d="M16.5 18.5 V23.5" stroke-linecap="round"/></g>' +
    '<circle cx="16.5" cy="13.5" r="2" fill="var(--graview-mark-point, currentColor)"/>',
};

/** Which drawing of the symbol a displayed height takes. */
export function symbolCut(size: number): "micro" | "regular" {
  return size < LOGO_RULES.microBelow ? "micro" : "regular";
}

/** What `graviewSymbol` draws. */
export interface SymbolOptions {
  /** The displayed height in CSS pixels. Picks the cut (`symbolCut`) and sets the height. */
  readonly size?: number;
  /**
   * The accessible name. Absent, the symbol is decorative (`aria-hidden`),
   * which is right beside a visible name. A link around it is named by its
   * destination ("Graview"), not by this.
   */
  readonly title?: string;
}

/**
 * The shared-plane symbol as an inline SVG string, in `currentColor`.
 *
 * Inline so it inherits the color it stands in (an `<img>` of an SVG file
 * does not). Named with `aria-label` rather than a `<title id>`, so drawing
 * it a hundred times on one page never repeats an id.
 */
export function graviewSymbol(options: SymbolOptions = {}): string {
  const size = options.size ?? 24;
  const cut = symbolCut(size) === "micro" ? MICRO : REGULAR;
  const [, , w, h] = cut.viewBox.split(" ").map(Number) as [number, number, number, number];
  const width = Math.round((size * w) / h * 100) / 100;
  const named = options.title
    ? `role="img" aria-label="${options.title.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}"`
    : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cut.viewBox}" width="${width}" height="${size}" ${named} focusable="false">${cut.body}</svg>`;
}
