/*
 * THE FACES AN APP LENDS ITS VIEWS (Roadmap f-view-authoring-friction-2026-11).
 *
 * A view's stylesheet loads nothing — no `url()`, no `@font-face` — so a
 * children's app could draw its views in the system's faces and the web
 * fonts its brand names, and never in the rounded face its brand is set in.
 * Now the brand may declare faces for its views (`brand.views.fonts`), each
 * a family and one file, and the HOST loads them into the page, where a
 * view and the app's stylesheet for views name them as they name any face.
 * A face is loaded only from where the host already lets a view's image
 * come from: a file the app holds by its content address
 * (`/graview/assets/<sha256>.woff2`, what Graview Cloud's add_file answers),
 * where the host says where those live, or an `https:` address on an origin
 * the host lists for a view's images. The view never names a file itself,
 * so nothing it reads can ride out in a font's address.
 *
 * No runtime imports: the checker and the page's host judge a face alike.
 */
import type { BrandViewFont } from "../theme/types.js";

/** The most faces a brand lends its views. */
export const VIEW_FONTS_MOST = 8;

/** A face the brand lends its views (`BrandViewFont`). */
export type ViewFont = BrandViewFont;

const ASSET = /^\/graview\/assets\/[0-9a-f]{64}\.(?:woff2|woff|ttf|otf)$/;
const HTTPS = /^https:\/\/([a-z0-9.-]+(?::\d+)?)\/[A-Za-z0-9._~!$&*+,;=:@%/-]*\.(?:woff2|woff|ttf|otf)(?:\?[A-Za-z0-9._~!$&*+,;=:@%/?-]*)?$/i;
const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "math", "emoji", "fangsong", "inherit", "initial", "unset", "revert", "default"]);

/** Where a face's file is: the app's own file by its path, or an address on an origin. Undefined where it is neither. */
export function viewFontSource(src: string): { readonly asset: string } | { readonly https: string; readonly origin: string } | undefined {
  if (ASSET.test(src)) return { asset: src };
  const at = HTTPS.exec(src);
  return at ? { https: src, origin: `https://${at[1]!.toLowerCase()}` } : undefined;
}

const weightOk = (weight: unknown) => {
  const one = (value: number) => Number.isInteger(value) && value >= 1 && value <= 1_000;
  if (typeof weight === "number") return one(weight);
  if (typeof weight !== "string") return false;
  const parts = weight.trim().split(/\s+/).map(Number);
  return parts.length >= 1 && parts.length <= 2 && parts.every(one) && (parts.length === 1 || parts[0]! <= parts[1]!);
};

/** Why a brand may not lend its views this face, or null. */
export function viewFontProblem(font: unknown): string | null {
  if (typeof font !== "object" || font === null || Array.isArray(font)) return 'a face is { "family": <its name>, "src": <its file> }';
  const { family, src, weight, style } = font as Record<string, unknown>;
  if (typeof family !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/.test(family)) return "its family is a name of letters, digits, spaces and hyphens, at most 60 characters";
  if (GENERIC.has(family.toLowerCase()) || family.toLowerCase().startsWith("ui-")) return `"${family}" is a name CSS keeps for itself`;
  if (typeof src !== "string" || !viewFontSource(src)) return `its src is a file the app holds (/graview/assets/<sha256>.woff2) or an https: address of a WOFF2, WOFF, TTF or OTF file, not ${JSON.stringify(src)}`;
  if (weight !== undefined && !weightOk(weight)) return "its weight is a whole number from 1 to 1000, or a range of two (\"300 700\")";
  if (style !== undefined && style !== "normal" && style !== "italic") return 'its style is "normal" or "italic"';
  return null;
}
