/*
 * THE FACES AN APP LENDS ITS VIEWS (Roadmap f-view-authoring-friction-2026-11).
 *
 * A view's stylesheet loads nothing — no `url()`, no `@font-face` — so a
 * children's app could draw its views in the system's faces and the web
 * fonts its brand names, and never in the rounded face its brand is set in.
 * Now the brand may declare faces for its views (`brand.views.fonts`), each
 * a family and one file, and the HOST loads them into the page, where a
 * view and the app's stylesheet for views name them as they name any face.
 * A face is loaded only from where the host lets a face come from: a file
 * the app holds by its content address (`/graview/assets/<sha256>.woff2`,
 * what Graview Cloud's add_file answers), where the host says where those
 * live, or an `https:` address on an origin the host lists for faces
 * (`fonts.origins`, apart from a view's images). The view never names a
 * file itself, so nothing it reads can ride out in a font's address.
 *
 * In the document a face is the page's, so it never takes a name the page
 * already draws in: `new FontFace("Arial", …)` replaces Arial in the app's
 * own text. The checker and the page's host judge a face alike.
 *
 * Its own table of those names, as the sanitizer has of `CSS_DRAWN_AS`: reading
 * `isSystemFamily` here would bring it to the first load of every page, since
 * the main entry that exports it is what a page loads first. A test holds this
 * table to that one (`a-brand-lends-its-views-faces-it-declares`, core).
 */
import type { BrandViewFont } from "../theme/types.js";

/** The most faces a brand lends its views. */
export const VIEW_FONTS_MOST = 8;

/** A face the brand lends its views (`BrandViewFont`). */
export type ViewFont = BrandViewFont;

/** What a lent face may not be called: the identity's face, and the families `isSystemFamily` reads as the reader's own. */
export const VIEW_FONTS_NOT_NAMED: readonly string[] = [
  "montserrat", "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "math", "emoji", "-apple-system", "blinkmacsystemfont",
  "georgia", "times new roman", "times", "iowan old style", "palatino", "palatino linotype", "charter", "cambria", "baskerville", "optima",
  "helvetica", "helvetica neue", "arial", "verdana", "segoe ui", "roboto", "avenir", "avenir next", "gill sans",
  "menlo", "monaco", "consolas", "sf mono", "sfmono-regular", "courier new",
];

const ASSET = /^\/graview\/assets\/[0-9a-f]{64}\.(?:woff2|woff|ttf|otf)$/;
const HTTPS = /^https:\/\/([a-z0-9.-]+(?::\d+)?)\/[A-Za-z0-9._~!$&*+,;=:@%/-]*\.(?:woff2|woff|ttf|otf)(?:\?[A-Za-z0-9._~!$&*+,;=:@%/?-]*)?$/i;
const CSS_WIDE = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "math", "emoji", "fangsong", "inherit", "initial", "unset", "revert", "default"]);

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

/** The families a brand's own stacks name: what a face lent to its views may not be called. */
export function brandFamilies(typography: { readonly body?: unknown; readonly display?: unknown; readonly mono?: unknown } | undefined): readonly string[] {
  return [typography?.body, typography?.display, typography?.mono].flatMap((stack) => (typeof stack === "string" ? stack.split(",").map((family) => family.trim().replace(/^["']|["']$/g, "").trim().replace(/\s+/g, " ")).filter((family) => family !== "") : []));
}

/** Why a brand may not lend its views this face, or null. `taken`: the families the brand's own stacks name. */
export function viewFontProblem(font: unknown, taken: readonly string[] = []): string | null {
  if (typeof font !== "object" || font === null || Array.isArray(font)) return 'a face is { "family": <its name>, "src": <its file> }';
  const { family, src, weight, style } = font as Record<string, unknown>;
  /* Single spaces between words alone: Firefox reads "Arial " as Arial, so any other whitespace would get a name past what follows. */
  if (typeof family !== "string" || family.length > 60 || !/^[A-Za-z0-9][A-Za-z0-9-]*(?: [A-Za-z0-9-]+)*$/.test(family)) return "its family is words of letters, digits and hyphens with single spaces between them, at most 60 characters";
  if (CSS_WIDE.has(family.toLowerCase())) return `"${family}" is a name CSS keeps for itself`;
  const name = family.toLowerCase();
  if (VIEW_FONTS_NOT_NAMED.includes(name) || name.startsWith("ui-") || taken.some((one) => one.toLowerCase() === name)) return `"${family}" would replace a face the page already draws in: call it something of its own`;
  if (typeof src !== "string" || !viewFontSource(src)) return `its src is a file the app holds (/graview/assets/<sha256>.woff2) or an https: address of a WOFF2, WOFF, TTF or OTF file, not ${JSON.stringify(src)}`;
  if (weight !== undefined && !weightOk(weight)) return "its weight is a whole number from 1 to 1000, or a range of two (\"300 700\")";
  if (style !== undefined && style !== "normal" && style !== "italic") return 'its style is "normal" or "italic"';
  return null;
}
