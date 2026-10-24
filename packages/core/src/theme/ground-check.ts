import { documentSchemes } from "./accent.js";
import { colorsIn, hsl, rgbToHsl } from "./contrast.js";
import { givenGrounds, groundFailure, groundSchemes, groundWith, hex, type Ground, type GroundFailure } from "./ground.js";
import type { Scheme } from "./types.js";

/*
 * WHETHER AN APP CAN STAND ON ITS GROUND (Roadmap f-brand-ground), judged
 * as an accent is (FR-126): ink, muted ink and the accent, as the page
 * draws them, on the ground and on a card drawn from it, in both schemes.
 * When one drops below 4.5:1 the refusal names the pair, its ratio, what
 * is needed and the nearest shade of that ground that would pass.
 */

const AA = 4.5;

/** A ratio as said: rounded down, so a near miss is never said as a pass. */
const said = (ratio: number) => `${Math.floor(ratio * 10) / 10}:1`;

export interface GroundRefusal {
  /** One sentence: what does not read on which ground, its ratio, what is needed, and a shade that would pass. */
  readonly sentence: string;
  /** The scheme the pair fails in. */
  readonly scheme: Scheme;
  /** The text and what it was on, as colors. */
  readonly pair: { readonly text: string; readonly on: string };
  readonly ratio: number;
  readonly requires: number;
  /** The nearest shade of that scheme's ground, same hue and saturation, that passes, as hex — when there is one. */
  readonly suggestion?: string;
}

/** The first pair that drops below AA on these grounds, with this accent, or null when every one reads. */
function failureOn(ground: Ground, accent: string | undefined): GroundFailure | null {
  const derived = accent ? documentSchemes(accent, ground) : undefined;
  // The dark scheme's accent as derived where it can be; where it cannot, the accent's own refusal says so.
  return groundFailure(derived?.ok ? derived.schemes : groundSchemes(ground), accent);
}

/** Whether every pair reads on this ground, with this accent: what a page compiles with, which says no more. */
export function groundReads(ground: Ground, accent?: string): boolean {
  return givenColors(ground) === null && failureOn(ground, accent) === null;
}

/** The first value of a ground that is not a color, or null when each is one. */
function givenColors(ground: Ground): string | null {
  const given = givenGrounds(ground);
  if (given.light === undefined && given.dark === undefined) return "";
  for (const value of [given.light, given.dark]) if (value !== undefined && !/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return null;
}

/**
 * Why an app may not stand on this ground, in one sentence with a fix, or
 * null when it may: `"Muted ink #586174 on the ground #9a9a94 is 2.5:1;
 * 4.5:1 is needed — #d8d8d5 would pass."` Judged with the app's accent
 * where it has one, as the page draws it.
 */
export function groundProblem(ground: Ground, accent?: string): GroundRefusal | null {
  const notAColor = givenColors(ground);
  if (notAColor !== null) {
    return { sentence: `${notAColor === "" ? "That" : `"${notAColor}"`} is not a page background; a ground is a color like "#eef3f8", or { "light": "#eef3f8", "dark": "#101826" }.`, scheme: "light", pair: { text: "", on: notAColor }, ratio: 0, requires: AA };
  }
  const failure = failureOn(ground, accent);
  if (!failure) return null;
  const given = givenGrounds(ground);
  const own = given[failure.scheme];
  // A dark ground drawn from the light one moves with neither: the light one's hue is what to change.
  const suggestion = own ? nearestPassing(ground, failure.scheme, accent) : undefined;
  const groundSaid = own ?? `${hex(failure.ground)}, drawn from ${given.light}`;
  const on = failure.card ? `a card (${hex(failure.card)}) on the ground ${groundSaid}` : `the ground ${groundSaid}`;
  const fix = suggestion ? ` — ${suggestion} would pass.` : own ? "; no shade of this color does, so pick another." : `; give the dark scheme a ground of its own.`;
  const sentence = `${failure.scheme === "dark" ? "In the dark scheme, " : ""}${failure.what} ${hex(failure.text)} on ${on} is ${said(failure.ratio)}; ${AA}:1 is needed${fix}`;
  return {
    sentence: sentence.replace(/^./, (first) => first.toUpperCase()),
    scheme: failure.scheme,
    pair: { text: hex(failure.text), on: hex(failure.card ?? failure.ground) },
    ratio: failure.ratio,
    requires: AA,
    ...(suggestion ? { suggestion } : {}),
  };
}

/** The nearest shade of one scheme's ground, same hue and saturation, by lightness alone, for which every pair reads; undefined when none does. */
function nearestPassing(ground: Ground, scheme: Scheme, accent: string | undefined): string | undefined {
  const color = colorsIn(givenGrounds(ground)[scheme]!)[0]!;
  const base = rgbToHsl(color);
  for (let step = 1; step <= 200; step++) {
    for (const l of [base.l - step / 200, base.l + step / 200]) {
      if (l < 0 || l > 1) continue;
      // Said as hex, so judged as hex: the color a chat sends back is this one, rounded.
      const shade = hex(hsl(base.h, base.s, l));
      if (failureOn(groundWith(ground, scheme, shade), accent) === null) return shade;
    }
  }
  return undefined;
}
