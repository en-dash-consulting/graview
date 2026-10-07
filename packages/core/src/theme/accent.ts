import { coloursIn, composite, contrast, hsl, rgbToHsl, type Rgba } from "./contrast.js";
import { brandFromAccent, type DerivedBrand, type RefusedBrand } from "./derive.js";
import { SCHEMES } from "./palettes.js";

/*
 * A DOCUMENT'S ACCENT, AS GIVEN (FR-126).
 *
 * A document's accent is drawn as it is written in the light scheme — as
 * text on the panel and on the ground, and as the fill a button's words
 * sit on — so it has to read there as it is: a colour moved to make it
 * read would be a colour the author did not choose, and a chat that chose
 * it could not tell. The dark scheme takes the shade of the same hue that
 * reads on its own grounds. When it does not read, the refusal names the
 * pair, the ratio and the ratio needed, and a shade that would pass: the
 * nearest of the same hue and saturation, by lightness alone.
 */

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const AA = 4.5;

export interface AccentRefusal {
  /** One sentence: the pair, its ratio, what is needed, and a shade that would pass. */
  readonly sentence: string;
  /** The text and what it was on, as colours. */
  readonly pair: { readonly text: string; readonly on: string };
  readonly ratio: number;
  readonly requires: number;
  /** The nearest shade of the same hue that passes, as a hex colour, when there is one. */
  readonly suggestion?: string;
}

const hex = (colour: Rgba) => `#${[colour.r, colour.g, colour.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** A ratio as said: rounded down, so a near miss is never said as a pass. */
const said = (ratio: number) => `${Math.floor(ratio * 10) / 10}:1`;

/**
 * The schemes a document's accent derives (FR-124): `brandFromAccent` over
 * Graview's own, and — where the only trouble is that the warning colour
 * shares the accent's hue — with the warning drawn in the bad status's red,
 * since a document cannot name a warning colour of its own.
 */
export function documentSchemes(accent: string): DerivedBrand | RefusedBrand {
  const derived = brandFromAccent({ accent, base: SCHEMES as never });
  if (derived.ok || !derived.missing.every((part) => part.startsWith("warn"))) return derived;
  return brandFromAccent({ accent, base: SCHEMES as never, warn: { light: SCHEMES.light.bad, dark: SCHEMES.dark.bad } });
}

/** The first pair this colour fails as given in the light scheme, or null when it reads. */
function lightFailure(colour: Rgba): Omit<AccentRefusal, "sentence" | "suggestion"> | null {
  const ground = coloursIn(SCHEMES.light.ground)[0]!;
  const panel = composite(coloursIn(SCHEMES.light.panel)[0]!, ground);
  const onPanel = contrast(colour, panel);
  const onGround = contrast(colour, ground);
  if (Math.min(onPanel, onGround) < AA) {
    const [ratio, on] = onPanel <= onGround ? [onPanel, panel] : [onGround, ground];
    return { pair: { text: hex(colour), on: hex(on) }, ratio, requires: AA };
  }
  const white = contrast(WHITE, colour);
  const black = contrast(BLACK, colour);
  if (Math.max(white, black) < AA) return { pair: { text: white >= black ? "#ffffff" : "#000000", on: hex(colour) }, ratio: Math.max(white, black), requires: AA };
  return null;
}

function passes(colour: Rgba): boolean {
  return lightFailure(colour) === null && documentSchemes(hex(colour)).ok;
}

/**
 * Why a document may not take this accent, in one sentence with a fix, or
 * null when it may (FR-126): `"#e6c200 text on #ffffff is 1.7:1; 4.5:1 is
 * needed — #8a7400 would pass."`
 */
export function accentProblem(accent: string): AccentRefusal | null {
  const colour = coloursIn(accent)[0];
  if (!colour) return { sentence: `"${accent}" is not a colour; an accent is one like "#c2577a".`, pair: { text: accent, on: "" }, ratio: 0, requires: AA };
  const failure = lightFailure(colour);
  const derived = failure ? undefined : documentSchemes(accent);
  if (!failure && derived?.ok) return null;
  const suggestion = nearestPassing(colour);
  const fix = suggestion ? ` — ${suggestion} would pass.` : "; no shade of this hue does, so pick another colour.";
  if (failure) {
    const text = failure.pair.text === hex(colour) ? accent : `${failure.pair.text === "#ffffff" ? "white" : "black"} text`;
    const on = failure.pair.on === hex(colour) ? accent : failure.pair.on;
    const pair = failure.pair.text === hex(colour) ? `${text} text on ${on}` : `${text} on ${on}`;
    return { ...failure, sentence: `${pair} is ${said(failure.ratio)}; ${failure.requires}:1 is needed${fix}`, ...(suggestion ? { suggestion } : {}) };
  }
  const why = (derived as RefusedBrand).why;
  return { sentence: `${accent} reads in the light scheme, but not in the dark: ${why}${fix}`, pair: { text: accent, on: SCHEMES.dark.panel }, ratio: 0, requires: AA, ...(suggestion ? { suggestion } : {}) };
}

/** The nearest shade of the same hue and saturation that passes, by lightness alone, as hex; undefined when none does. */
function nearestPassing(colour: Rgba): string | undefined {
  const base = rgbToHsl(colour);
  for (let step = 1; step <= 200; step++) {
    for (const l of [base.l - step / 200, base.l + step / 200]) {
      if (l < 0 || l > 1) continue;
      const shade = hsl(base.h, base.s, l);
      // Said as hex, so judged as hex: the colour a chat sends back is this one, rounded.
      const rounded = coloursIn(hex(shade))[0]!;
      if (passes(rounded)) return hex(rounded);
    }
  }
  return undefined;
}

/**
 * The nearest shade of `ink`'s hue that clears `requires` on `on` (laid
 * over `over`, for a translucent ground), by lightness alone, as hex — the
 * fix a contrast finding says (FR-126). Undefined when none does.
 */
export function passingShade(ink: string, on: string, requires: number, over?: string): string | undefined {
  const colour = coloursIn(ink)[0];
  const ground = coloursIn(on)[0];
  if (!colour || !ground) return undefined;
  const solid = composite(ground, (over ? coloursIn(over)[0] : undefined) ?? WHITE);
  const base = rgbToHsl(colour);
  for (let step = 0; step <= 200; step++) {
    for (const l of [base.l - step / 200, base.l + step / 200]) {
      if (l < 0 || l > 1) continue;
      const shade = coloursIn(hex(hsl(base.h, base.s, l)))[0]!;
      if (contrast(shade, solid) >= requires) return hex(shade);
    }
  }
  return undefined;
}

/** A ratio as a contrast sentence says it: rounded down, so a near miss is never said as a pass. */
export const ratioWords = said;
