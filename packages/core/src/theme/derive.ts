import {
  checkContrast,
  colorsIn,
  composite,
  contrast,
  hsl,
  rgbToHsl,
  type Rgba,
} from "./contrast.js";
import type { Scheme, ThemeTokens } from "./types.js";

/**
 * A brand hands over one accent color. What can be made of it, and what
 * cannot.
 *
 * The two schemes here are not inversions of each other — dark loses
 * luminance, light loses contrast and gains haze — so "derive the other one"
 * is not a color operation. What an accent CAN determine is everything
 * keyed to it: its dim companion, its glow, the lit edge, the wash. What it
 * cannot determine is the ground family (warm paper or cool slate is a
 * decision, not a consequence), the ink that has to clear AA against that
 * ground, and the warning color, which must stay distinguishable from the
 * accent rather than derived from it.
 *
 * So this derives what it can from a neutral base and REFUSES, naming what
 * else is needed, when the accent cannot carry a role it is being asked to.
 * A brand that gets a coherent pair of schemes and one that gets a clear
 * refusal are both better served than one that gets a quietly unreadable
 * interface.
 */
export interface AccentBrandOptions {
  /** The one color a brand always has. Hex, rgb() or hsl(). */
  readonly accent: string;
  /**
   * Text drawn ON the accent — a filled button. Derived as black or white
   * when absent, which works for most accents and is checked either way.
   */
  readonly accentInk?: { readonly dark?: string; readonly light?: string };
  /** The neutral pair to build on. Supply the framework's own when absent. */
  readonly base: Readonly<Record<Scheme, ThemeTokens>>;
  /** Kept away from the accent on purpose; derived only if it stays distinct. */
  readonly warn?: { readonly dark?: string; readonly light?: string };
}

export interface DerivedBrand {
  readonly ok: true;
  readonly schemes: Readonly<Record<Scheme, ThemeTokens>>;
}

export interface RefusedBrand {
  readonly ok: false;
  /** What the brand has to supply, in the words of the thing that needs it. */
  readonly missing: readonly string[];
  readonly why: string;
}

const rgba = (color: Rgba, alpha: number) =>
  `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/**
 * Builds a coherent pair of schemes around one accent, or says what is
 * missing.
 */
export function brandFromAccent(options: AccentBrandOptions): DerivedBrand | RefusedBrand {
  const accent = colorsIn(options.accent)[0];
  if (!accent) {
    return {
      ok: false,
      missing: ["accent"],
      why: `"${options.accent}" is not a color this can read. Use a hex, rgb() or hsl() value.`,
    };
  }

  const schemes = {} as Record<Scheme, ThemeTokens>;
  const missing = new Set<string>();
  const reasons: string[] = [];
  const base = rgbToHsl(accent);

  for (const scheme of ["dark", "light"] as const) {
    const neutral = options.base[scheme];
    const ground = colorsIn(neutral.ground)[0] ?? (scheme === "dark" ? BLACK : WHITE);
    const panel = composite(colorsIn(neutral.panel)[0] ?? WHITE, ground);

    /*
     * The accent is used as TEXT, and no single color can be text in both
     * schemes.
     *
     * 4.5:1 on white needs a lightness under about 0.18; 4.5:1 on a dark
     * panel needs one over about 0.24. Those do not overlap, which is why
     * "the brand's accent" is one hue with two lightnesses rather than one
     * color — and why a framework that simply took the hex would have
     * shipped an unreadable label in one scheme or the other.
     *
     * So the hue and the saturation are the brand's; the lightness is moved
     * as little as it takes. If it has to move further than this, the color
     * has stopped being recognisably theirs and the honest answer is to ask.
     */
    // Text on the panel and, with no capsule under it, on the ground itself (FR-117): it has to clear both.
    const readable = nearestReadable(base, [panel, ground], scheme, 4.5);
    if (!readable) {
      missing.add(`accent (${scheme})`);
      reasons.push(
        `no lightness of this hue clears 4.5:1 as text on the ${scheme} panel, so ${scheme} needs an accent of its own`,
      );
    } else if (Math.abs(readable.l - base.l) > MAX_SHIFT) {
      missing.add(`accent (${scheme})`);
      reasons.push(
        `reaching 4.5:1 on the ${scheme} panel would move the accent's lightness by ${Math.round(
          Math.abs(readable.l - base.l) * 100,
        )} points, which is far enough that it stops being the same color — supply one for ${scheme}`,
      );
    }
    const tone = readable ?? base;
    const shown = hsl(tone.h, tone.s, tone.l);

    const chosenInk =
      options.accentInk?.[scheme] ??
      (contrast(WHITE, shown) >= contrast(BLACK, shown) ? "#ffffff" : "#000000");
    const inkOnAccent = contrast(colorsIn(chosenInk)[0] ?? WHITE, shown);
    if (inkOnAccent + 0.005 < 4.5) {
      missing.add(`accentInk (${scheme})`);
      reasons.push(
        `neither black nor white clears 4.5:1 on the accent (best ${inkOnAccent.toFixed(2)}:1), so text on a filled button has to be given`,
      );
    }

    schemes[scheme] = {
      ...neutral,
      accent: rgba(shown, 1),
      accentDim: rgba(shown, scheme === "dark" ? 0.35 : 0.22),
      accentInk: chosenInk,
      glow: rgba(shown, scheme === "dark" ? 0.28 : 0.1),
      /*
       * A lit edge is not text, and it still owes 3:1: a panel outline nobody
       * can see is a panel with no edge. The aesthetic alpha is a preference,
       * so it gives way to the alpha that can actually be seen.
       */
      edgeBright: rgba(shown, visibleAlpha(shown, panel, scheme === "dark" ? 0.55 : 0.42, 3)),
      // The wash is the base's, as it is (the shipped ones paint none): an
      // accent is not a reason to start glowing behind the scene.
      ...(options.warn?.[scheme] ? { warn: options.warn[scheme]! } : {}),
    };

    /*
     * A warning color must not be mistakable for the accent. Two roles that
     * look alike is a worse failure than an ugly pair, because one of them
     * means "something is broken".
     */
    const warn = colorsIn(schemes[scheme].warn)[0];
    if (warn && hueGap(rgbToHsl(warn).h, tone.h) < 25) {
      missing.add(`warn (${scheme})`);
      reasons.push(
        `the warning color shares the accent's hue in ${scheme}, so "something is broken" looks like "this is selected"`,
      );
    }
  }

  if (missing.size > 0) {
    return { ok: false, missing: [...missing].sort(), why: reasons.join("; ") };
  }
  return { ok: true, schemes };
}

/**
 * The smallest alpha at which a color laid on a ground clears a ratio, or
 * the preferred one if that is already enough.
 *
 * Searched rather than solved because compositing then luminance is not
 * invertible in closed form, and a hundred steps is cheap for something that
 * runs once per theme.
 */
function visibleAlpha(color: Rgba, ground: Rgba, preferred: number, ratio: number): number {
  for (let step = Math.round(preferred * 100); step <= 100; step++) {
    const alpha = step / 100;
    if (contrast(composite({ ...color, a: alpha }, ground), ground) >= ratio) return alpha;
  }
  return 1;
}

/** How far apart two hues are on the wheel, 0–180. */
function hueGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/** As much lightness as a brand's color may be moved and still be theirs. */
const MAX_SHIFT = 0.3;

/**
 * The lightness nearest the brand's own that clears the ratio on every one of these grounds.
 *
 * Searched from the original outwards rather than from an end, so a color
 * that already works is left exactly alone and one that does not is moved the
 * smallest distance that helps. Dark schemes are searched upward first and
 * light ones downward, since that is the direction that will win.
 */
function nearestReadable(
  base: { h: number; s: number; l: number },
  grounds: readonly Rgba[],
  scheme: Scheme,
  ratio: number,
): { h: number; s: number; l: number } | null {
  const up = scheme === "dark";
  for (let step = 0; step <= 100; step++) {
    const first = up ? base.l + step / 100 : base.l - step / 100;
    const second = up ? base.l - step / 100 : base.l + step / 100;
    for (const l of [first, second]) {
      if (l < 0 || l > 1) continue;
      if (grounds.every((ground) => contrast(hsl(base.h, base.s, l), ground) >= ratio)) return { ...base, l };
    }
  }
  return null;
}

/** Every contrast failure in a pair of schemes, named by scheme. */
export function checkBrandContrast(
  schemes: Readonly<Record<Scheme, ThemeTokens>>,
): readonly (ReturnType<typeof checkContrast>[number] & { scheme: Scheme })[] {
  return (["dark", "light"] as const).flatMap((scheme) =>
    checkContrast(schemes[scheme]).map((finding) => ({ ...finding, scheme })),
  );
}


/**
 * Stable hue per kind — THE thread of kind identity across every surface:
 * chip dots, legend swatches, district roofs, the focus tag, a page's
 * kind mark. A brand that declares a kind's hue (`accents`) wins over the
 * hash. Lives beside the brand because the brand is what overrides it.
 *
 * IN DEGREES, 0–360, which is what a hue is in CSS, in every design tool,
 * and in `brand.accents` itself — the checker already validates an accent as
 * "a number 0–360". It used to divide by 360 on the way out, because every
 * consumer in this repository wanted a fraction, and the name said nothing
 * about that. So an app author read the name, wrote
 * `hsl(${hueFor(kind)} 58% 50%)`, which is valid CSS that renders, and got a
 * hue between 0 and 1 for every kind — which is red. A map with four
 * surfaces came out four shades of the same pink. Nothing failed: not tsc,
 * not graview check, not a test. It was only wrong to look at, and only if
 * you knew what it should have looked like.
 *
 * The consumers divide now, where dividing is a local detail rather than a
 * surprise in a public name.
 */
export function hueFor(kind: string, accents?: Readonly<Record<string, number>>): number {
  const declared = accents?.[kind];
  if (declared !== undefined) return ((declared % 360) + 360) % 360;
  let h = 2166136261;
  for (let i = 0; i < kind.length; i++) {
    h ^= kind.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}
