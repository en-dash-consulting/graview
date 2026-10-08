import { TYPOGRAPHY } from "./look.js";

/*
 * THE FACES A DOCUMENT MAY NAME (FR-124).
 *
 * A document says how its words are set, and never where a font comes
 * from: a stack that names an address — `url(…)`, `https://…`, `@import` —
 * is refused, so nothing a chat writes makes a page fetch from a server of
 * its choosing. What it may name is three stacks of the system's own faces
 * (`system-serif`, `system-sans`, `system-mono`), a face every system has
 * (Georgia, Helvetica, Menlo…), and the web fonts on `DOCUMENT_FONTS`.
 * Loading those is the HOST's decision: the embed fetches them from Google
 * Fonts as it fetches a TypeScript brand's, unless the host passes
 * `fonts: false` and serves them itself; a host that serves others names
 * them to `compileDocument(…, { fonts })`.
 */

/** The three stacks a document names by keyword, made of the faces the reader's system already has. */
export const SYSTEM_STACKS: Readonly<Record<"system-sans" | "system-serif" | "system-mono", string>> = {
  /* The system's own sans, as `system-sans` has always meant: not `TYPOGRAPHY.body`, which names Montserrat first. */
  "system-sans": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  "system-serif": 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, Cambria, "Times New Roman", serif',
  "system-mono": TYPOGRAPHY.mono,
};
export type SystemStack = keyof typeof SYSTEM_STACKS;

/** CSS's generic families and the system's own aliases: never fetched. */
const GENERIC = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "math", "emoji", "-apple-system", "BlinkMacSystemFont"];

/** Faces an operating system installs: named in a stack, used where the reader has them, and never fetched. */
export const SYSTEM_FONTS: readonly string[] = [
  "Georgia", "Times New Roman", "Times", "Iowan Old Style", "Palatino", "Palatino Linotype", "Charter", "Cambria", "Baskerville", "Optima",
  "Helvetica", "Helvetica Neue", "Arial", "Verdana", "Segoe UI", "Roboto", "Avenir", "Avenir Next", "Gill Sans",
  "Menlo", "Monaco", "Consolas", "SF Mono", "SFMono-Regular", "Courier New",
];

/** The web fonts a document may name (FR-124). The host decides whether and from where they load. */
export const DOCUMENT_FONTS: readonly string[] = [
  "Inter", "Source Sans 3", "IBM Plex Sans", "DM Sans", "Work Sans", "Space Grotesk", "Manrope",
  "Source Serif 4", "IBM Plex Serif", "Fraunces", "Lora", "Merriweather", "Playfair Display", "EB Garamond", "Libre Baskerville", "Literata", "Crimson Pro",
  "IBM Plex Mono", "JetBrains Mono", "Source Code Pro", "Fira Code",
];

const lower = (names: readonly string[]) => new Set(names.map((name) => name.toLowerCase()));

/** The families a stack names, in order, unquoted. */
export function familiesIn(stack: string): readonly string[] {
  return stack
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, "").trim())
    .filter((family) => family.length > 0);
}

/** Whether a family is the reader's own — a generic family or a face the system installs — and so never fetched. */
export function isSystemFamily(family: string): boolean {
  return lower([...GENERIC, ...SYSTEM_FONTS]).has(family.toLowerCase()) || family.toLowerCase().startsWith("ui-");
}

/** A document's stack as CSS: a keyword's stack, or the stack as written. */
export function stackOf(value: string): string {
  return (SYSTEM_STACKS as Record<string, string>)[value] ?? value;
}

/**
 * Why a document may not name this stack, or null (FR-124). `served` is the
 * web fonts the host serves beyond `DOCUMENT_FONTS`.
 */
export function fontProblem(value: string, served: readonly string[] = []): string | null {
  if (value in SYSTEM_STACKS) return null;
  const origin = /(?:https?:)?\/\/([^/\s'"),;]+)/i.exec(value)?.[1];
  if (origin) return `it loads a font from ${origin}, and a document names a face, never where one comes from`;
  if (/url\(|@import|[;{}<>:\\]/i.test(value)) return "it is not a list of font names; a document names a face, never where one comes from";
  const allowed = lower([...DOCUMENT_FONTS, ...served]);
  const families = familiesIn(value);
  if (families.length === 0) return "it names no face";
  const unknown = families.find((family) => !isSystemFamily(family) && !allowed.has(family.toLowerCase()));
  if (unknown) return `"${unknown}" is not a face a document may name: say system-serif, system-sans or system-mono, a face every system has (Georgia, Helvetica, Menlo), or a web font from the list (${[...DOCUMENT_FONTS, ...served].join(", ")})`;
  return null;
}
