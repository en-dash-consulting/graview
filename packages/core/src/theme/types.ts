/**
 * The token contract, declared in core so it can be CHECKED.
 *
 * The palettes themselves live in `@graview/primitives`, which is where the
 * components that read them live. The contract lives here for the same reason
 * the schema does: `graview check` reads declarations, and a theme is a
 * declaration. A custom palette can be wrong in ways nobody notices — a
 * secondary text colour that clears 4.5:1 on a dark ground and fails badly on
 * paper — and contrast is a property the framework can verify rather than
 * trust.
 */
export type Scheme = "light" | "dark";

export interface ThemeTokens {
  readonly ground: string;
  readonly groundDeep: string;
  /** The wash behind the scene: gradients over the ground. */
  readonly wash: string;
  readonly panel: string;
  readonly panelMuted: string;
  readonly panelWarning: string;
  readonly edge: string;
  readonly edgeBright: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly inkFaint: string;
  readonly accent: string;
  readonly accentDim: string;
  readonly accentInk: string;
  readonly warn: string;
  readonly glow: string;
  /** The command bar's ground. Chrome, not scene. */
  readonly bar: string;
  /** A surface floating over the scene — the inspector. */
  readonly float: string;
  /** Elevation for a panel sitting in the scene. */
  readonly liftLow: string;
  /** Elevation for something floating over it. */
  readonly liftHigh: string;
  /** How strongly a chip or span tint reads over the panel ground. */
  readonly tintAlpha: number;
  readonly tintLightness: number;
  readonly gridAlpha: number;
}

/**
 * Everything an installation puts its name on.
 *
 * Palette, wordmark and typography together, because they are one decision:
 * a brand handing over a hex code has not given you a theme, and a brand
 * handing over a logo without a colour has not either.
 */
export interface Brand {
  /** The product name, shown where the framework shows a wordmark. */
  readonly name: string;
  /**
   * A logo, as an inline SVG string or a URL.
   *
   * Inline is preferred and is what `currentColor` support is for: a logo
   * that inherits the ink colour works in both schemes without two files.
   */
  readonly logo?: string;
  readonly typography?: {
    /** Applied to everything. Include a real fallback stack. */
    readonly body?: string;
    /** Headings and the wordmark, when they differ from the body. */
    readonly display?: string;
    /** Code, ids, anything that must align in columns. */
    readonly mono?: string;
  };
  /**
   * How square and how tight this product is.
   *
   * The third axis of an identity, and the one that was missing: with only a
   * palette and a wordmark, four apps built on this looked like the same
   * application four times in different colours. A bid desk is square and
   * dense; a household planner is round and roomy. Neither is a component
   * change — both are one number.
   */
  readonly shape?: {
    /** Corner radius for a panel, in pixels. Smaller reads as more formal. */
    readonly radius?: number;
    /** Padding multiplier. 1 is the framework's own spacing. */
    readonly density?: number;
  };
  /**
   * A HUE PER KIND, in degrees (0–360).
   *
   * The default is a stable hash — fine for "each kind looks like itself",
   * useless for "our people are warm amber and our money is green". Declared
   * here it reaches every surface that colours by kind (chips, districts,
   * calendars) through one lookup, and `graview check` refuses a key that
   * names no declared kind — a silent typo would just quietly hash instead.
   */
  readonly accents?: Readonly<Record<string, number>>;
  readonly schemes: Readonly<Record<Scheme, ThemeTokens>>;
}

/**
 * One place text is drawn on a ground, and what contrast it owes there.
 *
 * Enumerated rather than discovered, because "which pairs carry text" is a
 * fact about the components and not about any particular palette — a brand
 * cannot introduce a new pairing without changing a component, and if it
 * does, this list is where that shows up.
 */
export interface TextPair {
  readonly ink: keyof ThemeTokens;
  readonly on: keyof ThemeTokens;
  /** What `on` composites over when it is translucent. */
  readonly over?: keyof ThemeTokens;
  /** WCAG AA: 4.5 for body text, 3 for large text and for meaningful edges. */
  readonly requires: number;
  /** Where this pairing actually happens, so a failure is findable. */
  readonly where: string;
}

export const TEXT_PAIRS: readonly TextPair[] = [
  { ink: "ink", on: "panel", over: "ground", requires: 4.5, where: "body text in a panel" },
  { ink: "ink", on: "panelMuted", over: "ground", requires: 4.5, where: "body text in a receded panel" },
  { ink: "ink", on: "panelWarning", over: "ground", requires: 4.5, where: "body text in a flagged panel" },
  { ink: "ink", on: "float", over: "ground", requires: 4.5, where: "the actions strip and the context menu" },
  { ink: "ink", on: "bar", over: "ground", requires: 4.5, where: "the command bar" },
  { ink: "inkMuted", on: "panel", over: "ground", requires: 4.5, where: "a subtitle" },
  { ink: "inkMuted", on: "panelMuted", over: "ground", requires: 4.5, where: "a subtitle in a receded panel" },
  { ink: "inkMuted", on: "float", over: "ground", requires: 4.5, where: "an observation in the strip" },
  { ink: "inkFaint", on: "panel", over: "ground", requires: 4.5, where: "a field name" },
  { ink: "inkFaint", on: "panelMuted", over: "ground", requires: 4.5, where: "a kind card's count" },
  { ink: "inkFaint", on: "float", over: "ground", requires: 4.5, where: "a hint in the strip" },
  { ink: "accent", on: "panel", over: "ground", requires: 4.5, where: "a selected label" },
  { ink: "accent", on: "float", over: "ground", requires: 4.5, where: "a pending action" },
  { ink: "accentInk", on: "accent", requires: 4.5, where: "text on a filled accent" },
  { ink: "warn", on: "panel", over: "ground", requires: 4.5, where: "a problem count" },
  { ink: "warn", on: "panelWarning", over: "ground", requires: 4.5, where: "a warning inside a flagged panel" },
  { ink: "warn", on: "float", over: "ground", requires: 4.5, where: "a failed agent call" },
  // An edge is not text, but a border that carries meaning owes 3:1 all the
  // same — a panel outline nobody can see is a panel with no edge.
  { ink: "edgeBright", on: "panel", over: "ground", requires: 3, where: "a lit edge" },
];
