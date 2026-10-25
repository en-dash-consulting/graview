import { colorsIn, composite, contrast, hsl, rgbToHsl, type Rgba } from "./contrast.js";
import { visibleAlpha } from "./derive.js";
import { SCHEMES } from "./palettes.js";
import type { Scheme, ThemeTokens } from "./types.js";

/*
 * AN APP'S OWN PAGE BACKGROUND (Roadmap f-brand-ground).
 *
 * Every app stood on Graview's paper, so apps that chose their own accent
 * still looked alike. A brand's `ground` is the color the page stands on:
 * one color, the light scheme's, or one for each scheme. What sits on it
 * is drawn from it — the panel a card is, its muted fill, the edge round
 * it and a floating sheet — so a card still stands off its ground, and
 * the views read it through the tokens they always did. With only a light
 * ground the dark scheme takes the same hue taken down to a ground, never
 * the light color itself. A light scheme given a dark ground — a black
 * brand — is drawn as the dark page it is (Roadmap f-dark-brand-accent).
 * The inks stay the scheme's, so a ground that would leave one of them
 * below what it owes is refused with the pair, its ratio and the nearest
 * shade of the ground that would pass (ground-check.ts).
 */

/** A page background: the light scheme's color, or one for each scheme. */
export type Ground = string | { readonly light?: string; readonly dark?: string };

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

export const hex = (color: Rgba) => `#${[color.r, color.g, color.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const rgba = (color: Rgba, alpha: number) => `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
const mix = (a: Rgba, b: Rgba, t: number): Rgba => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 });

/** The two grounds a brand's `ground` says, as given; a scheme it leaves out is absent. */
export function givenGrounds(ground: Ground): { light?: string; dark?: string } {
  return typeof ground === "string" ? { light: ground } : { ...(ground.light ? { light: ground.light } : {}), ...(ground.dark ? { dark: ground.dark } : {}) };
}

/** The dark ground a light one implies: its hue, held to a ground's quiet saturation, taken down to the lightness of Graview's own. */
export function darkGroundFor(light: string): string | undefined {
  const color = colorsIn(light)[0];
  if (!color) return undefined;
  const { h, s } = rgbToHsl(color);
  return hex(hsl(h, Math.min(s, 0.45), 0.08));
}

/** Whether a color is a dark page: light words read on it better than dark ones (Roadmap f-dark-brand-accent). */
export function isDarkGround(color: Rgba): boolean {
  return contrast(WHITE, color) > contrast(BLACK, color);
}

/** The scheme's lit edge, its alpha raised until it clears 3:1 on the card it outlines: an outline nobody can see is a card with no edge. */
function litEdge(base: ThemeTokens, card: Rgba): string {
  const color = colorsIn(base.edgeBright)[0]!;
  return rgba(color, visibleAlpha({ ...color, a: 1 }, card, color.a, 3));
}

/** Daylight: a card is the ground most of the way to white, with an edge in the ground's own hue. */
function lightOn(base: ThemeTokens, ground: string, color: Rgba): ThemeTokens {
  const { h, s } = rgbToHsl(color);
  const panel = mix(color, WHITE, 0.8);
  return {
    ...base,
    ground,
    groundDeep: hex(mix(color, BLACK, 0.04)),
    panel: hex(panel),
    panelMuted: hex(mix(color, WHITE, 0.55)),
    edge: rgba(hsl(h, Math.min(s, 0.5), 0.14), 0.14),
    edgeBright: litEdge(base, panel),
    bar: rgba(panel, 0.96),
    float: hex(panel),
  };
}

/** A lit control surface: a card is the ground lit a little, with a lit edge in the ground's own hue. */
function darkOn(base: ThemeTokens, ground: string, color: Rgba): ThemeTokens {
  const { h, s, l } = rgbToHsl(color);
  const lit = (by: number) => hsl(h, s, Math.min(1, l + by));
  return {
    ...base,
    ground,
    groundDeep: hex(hsl(h, s, l * 0.6)),
    // Nearly opaque, as Graview's own: a captured subtree has nothing behind it.
    panel: rgba(lit(0.07), 0.96),
    panelMuted: rgba(lit(0.035), 0.94),
    edge: rgba(hsl(h, Math.min(s, 0.45), 0.75), 0.18),
    edgeBright: litEdge(base, composite({ ...lit(0.07), a: 0.96 }, color)),
    bar: rgba(color, 0.96),
    // No lighter than the panel: an accent derived to read on the panel reads here too.
    float: rgba(lit(0.05), 0.98),
  };
}

/**
 * The neutral pair an app stands on: Graview's own, with each scheme's
 * ground — and the panel, muted panel, edge, bar and floating sheet drawn
 * from it — the brand's where it gives one. A dark ground left unsaid
 * beside a light one is the light one's hue taken down to a ground. A
 * light scheme given a dark ground is drawn as a dark page, in the dark
 * scheme's inks, so the words and the accent on it are judged on the
 * ground they are actually drawn on (Roadmap f-dark-brand-accent).
 */
export function groundSchemes(ground: Ground | undefined): Readonly<Record<Scheme, ThemeTokens>> {
  if (ground === undefined) return SCHEMES;
  const given = givenGrounds(ground);
  const dark = given.dark ?? (given.light ? darkGroundFor(given.light) : undefined);
  const light = given.light ? colorsIn(given.light)[0] : undefined;
  const night = dark ? colorsIn(dark)[0] : undefined;
  return {
    light: light ? (isDarkGround(light) ? darkOn(SCHEMES.dark, given.light!, light) : lightOn(SCHEMES.light, given.light!, light)) : SCHEMES.light,
    dark: night ? darkOn(SCHEMES.dark, dark!, night) : SCHEMES.dark,
  };
}

/** The ground with one scheme's color replaced, in the form it was given. */
export function groundWith(ground: Ground, scheme: Scheme, color: string): Ground {
  if (typeof ground === "string") return scheme === "light" ? color : { light: ground, dark: color };
  return { ...ground, [scheme]: color };
}

/** A pair that does not read on a ground: which, in which scheme, and how far short. */
export interface GroundFailure {
  readonly scheme: Scheme;
  /** What is drawn, as said: "ink", "faint ink", "the accent", "the lit edge". */
  readonly what: string;
  readonly text: Rgba;
  readonly ground: Rgba;
  /** The surface's color, when the pair fails on one drawn from the ground (a card, a floating sheet) rather than on the ground itself. */
  readonly card?: Rgba;
  /** That surface, as said: "a card", "a receded card", "a floating sheet". */
  readonly surface?: string;
  readonly ratio: number;
  readonly requires: number;
}

/**
 * What each ink is called and what it is drawn on, ground first, in the
 * order a refusal names them: the pairs of `TEXT_PAIRS` a ground's tokens
 * enter, written out here so a page does not carry the check's table
 * (a core test holds the two the same).
 */
export const GROUND_PAIRS: readonly (readonly [keyof ThemeTokens, string, readonly (keyof ThemeTokens)[], number])[] = [
  ["ink", "ink", ["ground", "panel", "panelMuted", "panelWarning", "float", "bar"], 4.5],
  ["inkMuted", "muted ink", ["ground", "panel", "panelMuted", "float", "bar"], 4.5],
  ["inkFaint", "faint ink", ["panel", "panelMuted", "float"], 4.5],
  ["accent", "the accent", ["ground", "panel", "float"], 4.5],
  ["warn", "the warning color", ["panel", "panelWarning", "float"], 4.5],
  ["good", "the good status", ["ground", "panel"], 4.5],
  ["bad", "the bad status", ["ground", "panel"], 4.5],
  ["edgeBright", "the lit edge", ["panel"], 3],
];
/** The surfaces drawn from a ground, as said. */
const SURFACES: Readonly<Partial<Record<keyof ThemeTokens, string>>> = {
  panel: "a card",
  panelMuted: "a receded card",
  panelWarning: "a flagged card",
  float: "a floating sheet",
  bar: "the bar",
};

/**
 * The first pair that drops below what it owes on a pair of schemes'
 * grounds or on a surface drawn from them, or null when each reads. It is
 * every pair `checkBrandContrast` holds a compiled palette to — ink, muted
 * and faint ink, the accent, the status colors and the lit edge, on the
 * ground, the cards, the floating sheet and the bar — so a ground passed
 * here is a palette the check passes (Roadmap f-ground-suggestion-passes).
 * Text on a filled accent is the accent's to answer, not the ground's. In
 * the light scheme an app's accent is drawn as given (FR-126), so it is
 * judged as given.
 */
export function groundFailure(schemes: Readonly<Record<Scheme, ThemeTokens>>, accent?: string): GroundFailure | null {
  for (const scheme of ["light", "dark"] as const) {
    const tokens: ThemeTokens = { ...schemes[scheme], ...(scheme === "light" && accent ? { accent } : {}) };
    const solid = colorsIn(tokens.ground)[0]!;
    for (const [ink, what, surfaces, requires] of GROUND_PAIRS) {
      for (const on of surfaces) {
        // Every stop of a surface drawn as a gradient, as the check judges the worst of them.
        const stops = on === "ground" ? [solid] : colorsIn(String(tokens[on])).map((color) => composite(color, solid));
        for (const stop of stops) {
          const text = composite(colorsIn(String(tokens[ink]))[0]!, stop);
          const ratio = contrast(text, stop);
          if (ratio < requires) return { scheme, what, text, ground: solid, ...(on === "ground" ? {} : { card: stop, surface: SURFACES[on]! }), ratio, requires };
        }
      }
    }
  }
  return null;
}
