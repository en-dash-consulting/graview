import { SCHEMES } from "../theme/palettes.js";
import { documentSchemes } from "../theme/accent.js";
import { stackOf } from "../theme/fonts.js";
import type { Brand } from "../theme/types.js";
import { warning, type Finding } from "./findings.js";
import type { GraviewDocument } from "./schema.js";

/*
 * THE DOCUMENT'S BRAND, AS THE FACES DRAW IT (FR-124, FR-125): each key
 * of `brand` onto the TypeScript `Brand` the theme machinery already reads
 * — `themeCss` for the faces and the shape, `hueFor` for the accents, the
 * wordmark for the logo — and the document's `name` and `description` as
 * the name and the line under it. Every document has one, so an app is
 * called what its document calls it on both faces. What the keys may hold
 * is judged by the checker (brand-check.ts), not here: this is what a page
 * compiles with.
 */
export function brandOf(document: GraviewDocument, findings: Finding[]): Brand {
  const spec = document.brand ?? {};
  const derived = spec.accent ? documentSchemes(spec.accent) : undefined;
  // A color that cannot be read is not a reason to refuse an app: it wears the default colors and says why.
  // The checker says which pair, its ratio and a shade that would pass (brand-check.ts, FR-126); a page says only this.
  if (derived && !derived.ok) findings.push(warning("brand", "brand.accent", `that accent cannot make a readable brand, so the app keeps Graview's colors: ${derived.why}`, "pick a color further from orange-red, or a darker one"));
  const logo = typeof spec.logo === "string" ? { src: spec.logo } : spec.logo;
  const name = spec.name ?? document.name;
  const typography = spec.typography
    ? Object.fromEntries(Object.entries(spec.typography).map(([role, value]) => [role, stackOf(value as string)]))
    : undefined;
  return {
    name,
    schemes: derived?.ok ? derived.schemes : (SCHEMES as Brand["schemes"]),
    ...(spec.currency ? { currency: spec.currency } : {}),
    ...(spec.locale ? { locale: spec.locale } : {}),
    ...(logo ? { logo: logo.src, logoAlt: logo.alt ?? name } : {}),
    ...(spec.favicon ? { favicon: spec.favicon } : {}),
    ...(document.description ? { subtitle: document.description } : {}),
    ...(typography ? { typography } : {}),
    ...(spec.shape ? { shape: spec.shape } : {}),
    ...(spec.accents ? { accents: spec.accents } : {}),
    ...(spec.scheme ? { scheme: spec.scheme } : {}),
  };
}

/** The app's money (FR-100): what `{x | money}` says, from the brand's currency and locale alone. */
export function moneyOf(document: GraviewDocument): { currency?: string; locale?: string } {
  const { currency, locale } = document.brand ?? {};
  return { ...(currency ? { currency } : {}), ...(locale ? { locale } : {}) };
}
