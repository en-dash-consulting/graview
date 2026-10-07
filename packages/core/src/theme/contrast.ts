import { TEXT_PAIRS, type ThemeTokens } from "./types.js";

/** Straight sRGB, 0–255, with alpha 0–1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const HEX = /^#([0-9a-f]{3,8})$/i;
const FUNC = /(rgba?|hsla?)\(([^)]+)\)/gi;

function fromHex(hex: string): Rgba | null {
  const match = HEX.exec(hex.trim());
  if (!match) return null;
  let body = match[1]!;
  if (body.length === 3 || body.length === 4) {
    body = [...body].map((c) => c + c).join("");
  }
  if (body.length !== 6 && body.length !== 8) return null;
  const int = Number.parseInt(body.slice(0, 6), 16);
  const alpha = body.length === 8 ? Number.parseInt(body.slice(6, 8), 16) / 255 : 1;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a: alpha };
}

function fromFunction(text: string): Rgba | null {
  const name = text.slice(0, text.indexOf("(")).toLowerCase();
  const parts = text
    .slice(text.indexOf("(") + 1, text.lastIndexOf(")"))
    .split(/[,\s/]+/)
    .filter(Boolean);
  const numbers = parts.map((part) =>
    part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part),
  );
  if (numbers.some(Number.isNaN)) return null;

  if (name.startsWith("rgb")) {
    const [r, g, b, a] = numbers;
    if (r === undefined || g === undefined || b === undefined) return null;
    return { r, g, b, a: a ?? 1 };
  }
  const [h, s, l, a] = numbers;
  if (h === undefined || s === undefined || l === undefined) return null;
  return { ...hslToRgb(h, s > 1 ? s / 100 : s, l > 1 ? l / 100 : l), a: a ?? 1 };
}

/** sRGB back to HSL, so a color can be moved in lightness and stay itself. */
export function rgbToHsl(color: Rgba): { h: number; s: number; l: number } {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r
      ? 60 * (((g - b) / d) % 6)
      : max === g
        ? 60 * ((b - r) / d + 2)
        : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}

export function hsl(h: number, s: number, l: number): Rgba {
  return { ...hslToRgb(h, s, l), a: 1 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((r! + m) * 255),
    g: Math.round((g! + m) * 255),
    b: Math.round((b! + m) * 255),
  };
}

/**
 * Every color a token value mentions.
 *
 * A gradient is not one color and pretending otherwise is how a check passes
 * on a value it never looked at. `bar` and `float` are gradients in both
 * built-in schemes; a pair drawn on one owes its contrast against the WORST
 * stop, because that is where the text will be at some point along it.
 */
export function colorsIn(value: string): Rgba[] {
  const found: Rgba[] = [];
  for (const token of value.matchAll(FUNC)) {
    const parsed = fromFunction(token[0]!);
    if (parsed) found.push(parsed);
  }
  for (const token of value.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const parsed = fromHex(token[0]!);
    if (parsed) found.push(parsed);
  }
  return found;
}

/** One color laid over another, straight alpha. */
export function composite(over: Rgba, under: Rgba): Rgba {
  const a = over.a + under.a * (1 - over.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (x: number, y: number) => (x * over.a + y * under.a * (1 - over.a)) / a;
  return { r: mix(over.r, under.r), g: mix(over.g, under.g), b: mix(over.b, under.b), a };
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: Rgba): number {
  return (
    0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
  );
}

/** WCAG 2.1 contrast ratio, 1 to 21. */
export function contrast(a: Rgba, b: Rgba): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

export interface ContrastFinding {
  readonly ink: string;
  readonly on: string;
  readonly where: string;
  readonly ratio: number;
  readonly requires: number;
  /** Set when a value could not be read at all, rather than read and failed. */
  readonly unreadable?: string;
}

/**
 * Every text pair in a palette, measured.
 *
 * Returns the failures AND the unreadable values. A token this cannot parse
 * is reported rather than skipped: silently passing a value nobody looked at
 * is exactly the failure mode a contrast check exists to prevent.
 */
export function checkContrast(tokens: ThemeTokens): readonly ContrastFinding[] {
  const findings: ContrastFinding[] = [];
  for (const pair of TEXT_PAIRS) {
    const inkValue = String(tokens[pair.ink]);
    const onValue = String(tokens[pair.on]);
    const inks = colorsIn(inkValue);
    const grounds = colorsIn(onValue);
    if (inks.length === 0 || grounds.length === 0) {
      findings.push({
        ink: pair.ink,
        on: pair.on,
        where: pair.where,
        ratio: 0,
        requires: pair.requires,
        unreadable: inks.length === 0 ? inkValue : onValue,
      });
      continue;
    }
    const backdrop = pair.over ? colorsIn(String(tokens[pair.over]))[0] : undefined;
    const opaque = backdrop ?? { r: 255, g: 255, b: 255, a: 1 };

    // The worst stop of a gradient and the worst ink of a multi-stop value:
    // text has to be legible everywhere it lands, not on average.
    let worst = Number.POSITIVE_INFINITY;
    for (const ground of grounds) {
      const solidGround = composite(ground, opaque);
      for (const ink of inks) {
        worst = Math.min(worst, contrast(composite(ink, solidGround), solidGround));
      }
    }
    if (worst + 0.005 < pair.requires) {
      findings.push({
        ink: pair.ink,
        on: pair.on,
        where: pair.where,
        ratio: Math.round(worst * 100) / 100,
        requires: pair.requires,
      });
    }
  }
  return findings;
}
