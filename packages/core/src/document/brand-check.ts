import { TIME_ZONE_FIX, timeZoneProblem } from "../days.js";
import { accentProblem, documentSchemes } from "../theme/accent.js";
import { darkPageFor, groundProblem } from "../theme/ground-check.js";
import type { Ground } from "../theme/ground.js";
import { fontProblem } from "../theme/fonts.js";
import { emojiProblem, markProblem } from "../theme/marks.js";
import { error, warning, type Finding } from "./findings.js";
import type { BrandSpec } from "./schema.js";
import { logoParts } from "./logo.js";
import { OPEN_MAX_STYLESHEET } from "../css/tables.js";
import { sanitizeStylesheet, type CssRefusal } from "../css/sanitize.js";

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
/** What setting a page background does, said the same by an edit and by the preview of a change. */
export function groundWords(ground: Ground): string {
  const given = typeof ground === "string" ? { light: ground } : ground;
  if (given.light && given.dark) return `The app's page background becomes ${given.light}, and ${given.dark} in the dark.`;
  return given.light ? `The app's page background becomes ${given.light}.` : `The app's page background in the dark becomes ${given.dark}.`;
}
export const EMOJI_FIX = 'say { "favicon": { "emoji": "🏡" } } with one standard emoji; a skin tone, a flag or a joined emoji like 👩🏽‍🌾 counts as one';

/** Whether every view is drawn with the app's own stylesheet first (Roadmap f-app-wide-view-theme), said the same by an edit and by the preview of a change. */
export function viewsCssSentence(given: boolean): string {
  return given ? "Every view is drawn with the app's own stylesheet before its own." : "Every view is drawn with its own stylesheet alone.";
}
/** Whether a view fades between records, said the same by an edit and by the preview of a change. */
export function viewsMotionSentence(motion: "none" | "fade" | undefined): string {
  return motion === "fade" ? "A view fades when the record it shows changes." : "A view changes records with no fade.";
}
/** What the open kit left out of a stylesheet, as its author wrote it: "url() in background", "@import", "position: fixed", "the selector :host". */
export function cssRefusalWords(refusal: CssRefusal): string {
  switch (refusal.reason) {
    case "url":
      return refusal.name ? `url() in ${refusal.name}` : "url()";
    case "function":
      return `${refusal.name}()`;
    case "property":
      return `the property ${refusal.name}`;
    case "at-rule":
      return refusal.name ?? "an at-rule";
    case "value":
      return `a value of ${refusal.name}`;
    case "selector":
      return refusal.name ? `the selector :${refusal.name}` : "a selector";
    case "unreadable":
      return refusal.name ? `${refusal.name} it cannot read` : "CSS it cannot read";
    case "size":
      return "its length";
  }
}
/** The refusals of one stylesheet, each said once, the first few. */
export function cssRefusalsSaid(refused: readonly CssRefusal[]): string {
  const said = [...new Set(refused.map(cssRefusalWords))];
  const shown = said.slice(0, 4);
  return said.length > shown.length ? `${shown.join(", ")} and ${said.length - shown.length} more` : shown.join(", ");
}
export const VIEWS_CSS_FIX = "a view's stylesheet loads nothing and stays in its own tree: no url() but url(#id) on a paint, no @import or @font-face, no :host; the app's own tokens (var(--graview-accent), --graview-panel, --graview-font-display, …) are there to draw with";

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
  /*
   * THE STYLESHEET EVERY VIEW GETS (Roadmap f-app-wide-view-theme), held to
   * the one sanitizer a page draws it through: what the open kit leaves out
   * is said here by name, and left out there too — a warning, since the
   * rest of the sheet is drawn, as a view's own is. One too long for a
   * stylesheet draws nothing, and that is an error.
   */
  if (typeof brand.views?.css === "string") {
    const judged = sanitizeStylesheet(brand.views.css);
    if (judged.refused.some((one) => one.reason === "size")) out.push(error("brand-views-css", `${at}.views.css`, `the stylesheet every view gets is longer than the ${OPEN_MAX_STYLESHEET.toLocaleString("en-US")} characters a stylesheet may be, so no view is drawn with it`, "keep to what every view shares, and leave a view's own rules to the view"));
    else if (judged.refused.length > 0) out.push(warning("brand-views-css", `${at}.views.css`, `the stylesheet every view gets has CSS the open kit leaves out (${cssRefusalsSaid(judged.refused)}), so every view is drawn without ${judged.refused.length === 1 ? "it" : "those parts"}`, VIEWS_CSS_FIX));
  }
  // A zone its times could not be said on (Roadmap f-app-time-zone), refused by name.
  const unzoned = typeof brand.timeZone === "string" ? timeZoneProblem(brand.timeZone) : undefined;
  if (unzoned) out.push(error("brand-time-zone", `${at}.timeZone`, unzoned, TIME_ZONE_FIX));
  /*
   * A page background (Roadmap f-brand-ground) is judged as an accent is:
   * the pair that would not read, its ratio, and a shade that would. A
   * ground refused leaves the accent judged on Graview's.
   */
  const ground = brand.ground ? groundProblem(brand.ground, brand.accent) : null;
  if (brand.ground && ground) {
    const fix = ground.suggestion ? `say { "ground": ${typeof brand.ground === "string" ? `"${ground.suggestion}"` : JSON.stringify({ ...brand.ground, [ground.scheme]: ground.suggestion }).replace(/,/g, ", ").replace(/:/g, ": ")} }` : "pick another color";
    out.push(warning("brand-ground", `${at}.ground`, `${ground.sentence} The app keeps Graview's page background.`, fix));
  }
  const on = brand.ground && !ground ? brand.ground : undefined;
  if (brand.accent) {
    const refused = accentProblem(brand.accent, on);
    if (refused) {
      const drawn = documentSchemes(brand.accent, on).ok ? "The app draws a shade it moved to read, not the color given." : "The app keeps Graview's colors.";
      // A bright accent that reads on a dark page is answered with that pair too (Roadmap f-dark-brand-accent).
      const page = darkPageFor(brand.accent, on);
      const onPage = page ? `keep ${brand.accent} on a dark page: say { "ground": { "light": "${page.light}", "dark": "${page.dark}" } }` : undefined;
      const shade = refused.suggestion ? `say { "accent": "${refused.suggestion}" }` : undefined;
      out.push(warning("brand-accent", `${at}.accent`, `${refused.sentence} ${drawn}`, shade && onPage ? `${shade}, or ${onPage}` : (shade ?? (onPage ? onPage.replace(/^k/, "K") : "pick another color"))));
    }
  }
  return out;
}
