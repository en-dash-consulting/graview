/**
 * The token contract, declared in core so it can be CHECKED.
 *
 * The palettes themselves live in `@graview/primitives`, which is where the
 * components that read them live. The contract lives here for the same reason
 * the schema does: `graview check` reads declarations, and a theme is a
 * declaration. A custom palette can be wrong in ways nobody notices — a
 * secondary text color that clears 4.5:1 on a dark ground and fails badly on
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
  /**
   * A STATUS THAT IS GOOD, AND ONE THAT IS BAD: booked, paid, passing;
   * overdue, refused, failing. The accent means "selected" and the warning
   * means "a rule is broken", and a badge that meant neither invented a
   * color of its own and checked it by hand, if at all. Text colors,
   * held to 4.5:1 on a panel and on the ground like every other ink.
   */
  readonly good: string;
  readonly bad: string;
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
 * handing over a logo without a color has not either.
 */
/** A brand's page icon: a mark (inline SVG or a path), or one standard emoji. */
export type FaviconSpec = string | { readonly emoji: string };

export interface Brand {
  /** The product name, shown where the framework shows a wordmark. */
  readonly name: string;
  /**
   * A logo, as an inline SVG string or a URL.
   *
   * Inline is preferred and is what `currentColor` support is for: a logo
   * that inherits the ink color works in both schemes without two files.
   */
  readonly logo?: string;
  /**
   * What the logo says to someone who cannot see it (FR-124): the app's
   * name when absent. Drawn beside the name, the logo is said only when
   * this says more than the name does.
   */
  readonly logoAlt?: string;
  /**
   * The page's icon (FR-124), in the same forms as the logo: inline SVG or
   * a same-origin path. Set only by a face that owns the whole page — the
   * Shell, the routed face on its own, an embed told `favicon: true` —
   * never by an embed on somebody else's page. `faviconHref` says it as an
   * address. `{ emoji: "🏡" }` — one standard emoji — is the page icon
   * and, where there is no logo, the app's mark (`emojiMark`).
   */
  readonly favicon?: FaviconSpec;
  /** A line under the name (FR-125): a document's `description`. */
  readonly subtitle?: string;
  /**
   * THE SCHEME THE APP PREFERS (FR-124), when the reader has not chosen:
   * "auto" (the default) follows the system's. A host's own `data-theme`
   * stamp, or a scheme the host asks for, is a choice and wins.
   */
  readonly scheme?: Scheme | "auto";
  readonly typography?: {
    /** Applied to everything. Include a real fallback stack. */
    readonly body?: string;
    /** Headings and the wordmark, when they differ from the body. */
    readonly display?: string;
    /** Code, ids, anything that must align in columns. */
    readonly mono?: string;
    /**
     * The three weights (100–900): headings, reading text and action
     * labels. Absent, the identity's 550, 450 and 600 on the framework's
     * own face, and 600, 400 and 600 on a face this brand names.
     */
    readonly weights?: { readonly display?: number; readonly body?: number; readonly label?: number };
  };
  /**
   * How square and how tight this product is.
   *
   * The third axis of an identity, and the one that was missing: with only a
   * palette and a wordmark, four apps built on this looked like the same
   * application four times in different colors. A bid desk is square and
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
   * here it reaches every surface that colors by kind (chips, districts,
   * calendars) through one lookup, and `graview check` refuses a key that
   * names no declared kind — a silent typo would just quietly hash instead.
   */
  readonly accents?: Readonly<Record<string, number>>;
  readonly schemes: Readonly<Record<Scheme, ThemeTokens>>;
  /**
   * The kit: what the scene draws that is not a view — connectors, captions,
   * grid, lattice, tags, marks — as this brand wants it. Any part; the rest
   * as shipped. See `resolveKit`.
   */
  readonly kit?: KitOverrides;
  /**
   * A FIGURE PER KIND, the way a brand already overrides a kind's hue.
   *
   * An installation that has its own drawing of a person, or of the thing
   * its domain calls a plot, says so here and the declaration stays the
   * domain's. Same rules as a declared figure, and `graview check` holds
   * both to them.
   */
  readonly figures?: Readonly<Record<string, string>>;
  /**
   * THE APP'S MONEY (FR-100): the currency a sum is said in wherever a
   * block names none — a figure or a field shown as money, and a
   * template's `{x | money}` — as its three-letter code ("USD", "EUR").
   * Absent, a sum is a number in figures with no symbol.
   */
  readonly currency?: string;
  /**
   * THE APP'S LOCALE (FR-178): what its days, times, numbers and money are
   * written for ("en-US", "en-GB", "de-DE") — "Sep 10, 2023", "3:30 PM",
   * "1,250" in en-US, the default. A reader's locale a host passes
   * (`locale` on the provider, the embed, the pages face) wins over it.
   * The framework's own words stay English.
   */
  readonly locale?: string;
  /**
   * THE APP'S TIME ZONE (Roadmap f-app-time-zone): the IANA zone its
   * instants are said in ("America/New_York") — a time kept as
   * `2026-10-16T14:47:00Z` reads "10:47 AM" on every list, record page,
   * act's sentence and view, whatever the reader's or the server's clock.
   * A person's zone a host passes (`timeZone` on the provider, the embed,
   * the pages face) wins over it. Absent, each reader's own clock.
   */
  readonly timeZone?: string;
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
  // Words with no capsule under them (FR-117): written on the ground itself, or on the bar.
  { ink: "ink", on: "ground", requires: 4.5, where: "a district's name, written on the ground" },
  { ink: "accent", on: "ground", requires: 4.5, where: "the showing a drive-in is on, and a link on a page" },
  { ink: "inkMuted", on: "bar", over: "ground", requires: 4.5, where: "a place on the bar you are not on" },
  { ink: "inkMuted", on: "ground", requires: 4.5, where: "a district's open control, and the other pictures on a place's page" },
  { ink: "accentInk", on: "accent", requires: 4.5, where: "text on a filled accent" },
  { ink: "warn", on: "panel", over: "ground", requires: 4.5, where: "a problem count" },
  { ink: "warn", on: "panelWarning", over: "ground", requires: 4.5, where: "a warning inside a flagged panel" },
  { ink: "warn", on: "float", over: "ground", requires: 4.5, where: "a failed agent call" },
  { ink: "good", on: "panel", over: "ground", requires: 4.5, where: "a good status on a card" },
  { ink: "good", on: "ground", requires: 4.5, where: "a good status on a page" },
  { ink: "bad", on: "panel", over: "ground", requires: 4.5, where: "a bad status on a card" },
  { ink: "bad", on: "ground", requires: 4.5, where: "a bad status on a page" },
  // An edge is not text, but a border that carries meaning owes 3:1 all the
  // same — a panel outline nobody can see is a panel with no edge.
  { ink: "edgeBright", on: "panel", over: "ground", requires: 3, where: "a lit edge" },
];

/*
 * THE KIT'S SHAPE: what `kit.ts` resolves and draws from, and what a brand
 * may say of it. Here with the theme's other types, so a brand's `kit`
 * names its type without the theme reaching back into the kit.
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
  /** An explicit CSS color; absent, the kind's own hue. */
  readonly color?: string;
  readonly pattern?: KitStrokePattern;
  readonly width?: number;
  readonly cap?: KitEndCap;
  readonly opacity?: number;
}

export interface Kit {
  readonly connectors: {
    /** Every edge kind, unless `byEdge` says otherwise. */
    readonly all: ConnectorKit;
    /** Per edge kind: color, visibility, pattern — whatever this kind wants differently. */
    readonly byEdge: Readonly<Record<string, Partial<ConnectorKit>>>;
  };
  /** The words over a neighborhood: the edge's own reading. */
  readonly captions: { readonly visible: boolean };
  /** The fine square measure under the scene on the ground. */
  readonly grid: { readonly visible: boolean; readonly size: number };
  /** The isometric lattice the ground becomes from altitude. */
  readonly lattice: { readonly visible: boolean; readonly size: number };
  /** The kind's name astride a focused card. */
  readonly tags: { readonly visible: boolean };
  /**
   * How loud a connector is when it is not the one being looked at.
   *
   * `rest` is what an unlit line keeps while NOTHING is lit — the quiet
   * weight every relation in the picture carries at once. `dim` is what it
   * keeps while something else IS lit: 0 vanishes, 1 does not recede. They
   * are two different questions, and one number could not answer both —
   * a resting opacity low enough to be calm made a selection's own lines
   * barely brighter than the crowd, and one high enough to show the crowd
   * left twenty lines shouting over the two a person had just chosen.
   */
  readonly emphasis: { readonly rest: number; readonly dim: number };
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
