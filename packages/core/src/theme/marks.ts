/*
 * A BRAND'S MARKS — its logo and its page icon (FR-124) — as a document
 * holds them: an SVG written inline, or a path on the app's own host
 * (`/graview/assets/<sha256>.svg`, where Graview Cloud keeps what a chat
 * hands it). Drawn as given and never redrawn, so an SVG that could act —
 * run a script, answer an event, embed a page, load anything — is refused
 * with the reason rather than quietly rewritten. The rules are Graview
 * Cloud's `add_image` rules word for word, so an image Cloud took is one
 * the framework draws, and one it refused is one `graview check` refuses.
 */

/** The most an inline SVG mark may be, in characters. */
export const MAX_INLINE_SVG = 64 * 1024;

/** Whether a mark is an SVG written inline, rather than a path to one. */
export function isInlineSvg(mark: string): boolean {
  return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(mark);
}

/** Why an SVG may not be drawn as it is: anything that could run, or reach outside the image. Null when it may. */
export function svgProblem(text: string): string | null {
  if (/<script[\s>]/i.test(text)) return "it has a script in it";
  if (/\son[a-z]+\s*=/i.test(text)) return "it has an event handler (an on… attribute)";
  if (/<foreignObject[\s>]/i.test(text)) return "it embeds HTML (foreignObject)";
  if (/<(iframe|embed|object|audio|video)[\s>]/i.test(text)) return "it embeds a page or media";
  if (/(?:href|src)\s*=\s*["']\s*(?!#|data:image\/)[^"']/i.test(text)) return "it loads or links to something outside itself";
  if (/url\(\s*["']?\s*(?!#|data:image\/)/i.test(text)) return "its style loads something outside itself";
  if (/@import/i.test(text)) return "its style imports a stylesheet";
  if (/<!ENTITY/i.test(text)) return "it declares XML entities";
  return null;
}

/**
 * Why a mark may not be drawn, or null: an inline SVG under the rules
 * above, or a path on the app's own host — under `/graview/assets/`, or
 * relative to the page — and never another origin.
 */
export function markProblem(mark: string): string | null {
  if (isInlineSvg(mark)) {
    if (mark.length > MAX_INLINE_SVG) return `it is over ${MAX_INLINE_SVG / 1024} KB, the most an inline SVG may be`;
    return svgProblem(mark);
  }
  if (/^\s*</.test(mark)) return "it is markup, and not an SVG";
  if (/^[a-z][a-z0-9+.-]*:/i.test(mark) || mark.startsWith("//")) return "it names another origin; a mark is inline SVG or a path on the app's own host, like /graview/assets/<sha256>.svg";
  if (!/^[A-Za-z0-9._~/-]+$/.test(mark)) return "a path is letters, digits and . _ ~ / - only";
  if (mark.startsWith("/") && !mark.startsWith("/graview/assets/")) return "a path on the app's own host is under /graview/assets/, or relative to the page";
  return null;
}

/**
 * A mark as an address an `<img>` or a `<link rel="icon">` can take: an
 * inline SVG as a `data:` URI, anything else as given. Undefined for an
 * inline SVG that could act. Where a mark may point is the checker's to
 * judge (a document's only on its own host); a face draws what it is given.
 */
export function markHref(mark: string | undefined): string | undefined {
  if (!mark) return undefined;
  if (!isInlineSvg(mark)) return /^\s*</.test(mark) ? undefined : mark;
  return svgProblem(mark) === null ? `data:image/svg+xml,${encodeURIComponent(mark.trim())}` : undefined;
}

/** The page icon a brand asks for, as an address (FR-124), or undefined. */
export function faviconHref(brand: { readonly favicon?: string } | undefined): string | undefined {
  return markHref(brand?.favicon);
}
