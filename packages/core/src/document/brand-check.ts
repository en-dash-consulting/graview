import { TIME_ZONE_FIX, timeZoneProblem } from "../days.js";
import { accentProblem, documentSchemes } from "../theme/accent.js";
import { fontProblem } from "../theme/fonts.js";
import { emojiProblem, markProblem } from "../theme/marks.js";
import { error, warning, type Finding } from "./findings.js";
import type { BrandSpec } from "./schema.js";
import { logoParts } from "./logo.js";

/*
 * WHAT A DOCUMENT'S BRAND MAY HOLD (FR-124, FR-126), judged where a host
 * judges a document — `compileDocument`, `graview check`, an edit — and
 * not in a page that compiles what was already judged. A logo or an icon
 * that could act, or that lives on another origin, and a face from
 * anywhere but the list, are errors; an accent that does not read as
 * given says the pair, the ratio, and a shade that would.
 */
export interface BrandCheckOptions {
  /** Web fonts the host serves itself, beyond `DOCUMENT_FONTS`. */
  readonly fonts?: readonly string[];
  /** Where the brand sits in what is judged: "brand" in a document, "edits.3" in an edit. */
  readonly at?: string;
}

/** Said wherever a brand is judged: a fallback beside a dark logo is never drawn. */
export const LOGO_FALLBACK_UNUSED = "the dark logo is drawn in the dark scheme, so the light one is never inverted there";

/** How a page icon's emoji is refused, wherever it is judged: the document, an edit, a TypeScript brand. */
export function emojiSentence(emoji: unknown, problem: string): string {
  return `${typeof emoji === "string" && emoji.trim() !== "" ? JSON.stringify(emoji) : "that"} cannot be the app's icon, because ${problem}`;
}
/** Whether the home draws the line under the app's name, said the same by an edit and by the preview of a change. */
export function subtitleSentence(drawn: boolean): string {
  return drawn ? "The home draws the description as the line under the app's name." : "The home draws no line under the app's name; the description stays the app's, in its listings.";
}
/** What setting an emoji icon does, said the same by an edit and by the preview of a change. */
export function emojiIconSentence(emoji: string, hasLogo: boolean): string {
  return hasLogo ? `The app's page icon becomes ${emoji}.` : `The app's page icon and mark become ${emoji}.`;
}
export const EMOJI_FIX = 'say { "favicon": { "emoji": "🏡" } } with one standard emoji; a skin tone, a flag or a joined emoji like 👩🏽‍🌾 counts as one';

export function brandFindings(brand: Partial<BrandSpec> | undefined, options: BrandCheckOptions = {}): Finding[] {
  const out: Finding[] = [];
  if (!brand) return out;
  const at = options.at ?? "brand";
  const logo = logoParts(brand.logo);
  const marks: [string, string | undefined, string][] = [
    ["logo", logo?.light, typeof brand.logo === "string" ? "logo" : logo?.form === "src" ? "logo.src" : "logo.light"],
    ["dark scheme's logo", logo?.dark, "logo.dark"],
    ["page icon", typeof brand.favicon === "string" ? brand.favicon : undefined, "favicon"],
  ];
  for (const [what, mark, path] of marks) {
    const problem = mark === undefined ? null : markProblem(mark);
    if (problem) out.push(error("brand-mark", `${at}.${path}`, `the ${what} cannot be drawn as given, because ${problem}`, "Graview draws an image exactly as it is given, never rewritten: remove that and give it again, or give the path Graview Cloud's add_image answers with"));
  }
  if (logo?.dark !== undefined && logo.darkFallback !== undefined) out.push(warning("brand-logo", `${at}.logo.darkFallback`, LOGO_FALLBACK_UNUSED, 'remove "darkFallback", or remove "dark" to draw the light logo inverted in the dark scheme'));
  if (typeof brand.favicon === "object" && brand.favicon !== null) {
    const problem = emojiProblem(brand.favicon.emoji);
    if (problem) out.push(error("brand-emoji", `${at}.favicon.emoji`, emojiSentence(brand.favicon.emoji, problem), EMOJI_FIX));
  }
  for (const [role, value] of Object.entries(brand.typography ?? {})) {
    const problem = typeof value === "string" ? fontProblem(value, options.fonts) : null;
    if (problem) out.push(error("brand-font", `${at}.typography.${role}`, `the ${role} face cannot be used: ${problem}`, 'say "system-serif", "system-sans" or "system-mono", or a face on the list'));
  }
  // A zone its times could not be said on (Roadmap f-app-time-zone), refused by name.
  const unzoned = typeof brand.timeZone === "string" ? timeZoneProblem(brand.timeZone) : undefined;
  if (unzoned) out.push(error("brand-time-zone", `${at}.timeZone`, unzoned, TIME_ZONE_FIX));
  if (brand.accent) {
    const refused = accentProblem(brand.accent);
    if (refused) {
      const drawn = documentSchemes(brand.accent).ok ? "The app draws a shade it moved to read, not the color given." : "The app keeps Graview's colors.";
      out.push(warning("brand-accent", `${at}.accent`, `${refused.sentence} ${drawn}`, refused.suggestion ? `say { "accent": "${refused.suggestion}" }` : "pick another color"));
    }
  }
  return out;
}
