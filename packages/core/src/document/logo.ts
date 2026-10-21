/*
 * A DOCUMENT'S LOGO AS ITS PARTS, whichever form it is in — a string, a
 * `{ src, alt }`, or one for each scheme, `{ light, dark?, alt?,
 * darkFallback? }` — read alike by the compile (brand.ts), the checker
 * (brand-check.ts), an edit and the preview of a change. A string and
 * `src` are the light one, and the dark one too.
 */
export interface LogoParts {
  /** The form it was given in, so a finding names the key the author wrote. */
  readonly form: "string" | "src" | "light";
  readonly light: string;
  readonly dark?: string;
  readonly alt?: string;
  readonly darkFallback?: string;
}

export function logoParts(logo: unknown): LogoParts | undefined {
  if (typeof logo === "string") return { form: "string", light: logo };
  if (typeof logo !== "object" || logo === null) return undefined;
  const given = logo as Record<string, unknown>;
  const text = (key: string) => (typeof given[key] === "string" ? (given[key] as string) : undefined);
  const light = text("light") ?? text("src");
  if (light === undefined) return undefined;
  const [dark, alt, darkFallback] = [text("dark"), text("alt"), text("darkFallback")];
  return {
    form: text("light") !== undefined ? "light" : "src",
    light,
    ...(dark !== undefined ? { dark } : {}),
    ...(alt !== undefined ? { alt } : {}),
    ...(darkFallback !== undefined ? { darkFallback } : {}),
  };
}

/** A document's logo as a host draws it: the light one, the dark one, its words and the dark scheme's fallback. */
export interface DocumentLogo {
  readonly light: string;
  readonly dark?: string;
  readonly alt?: string;
  readonly darkFallback?: "invert";
}

/**
 * ANY LOGO A DOCUMENT GIVES, READ AS ONE (FR-197): a string, `{ src, alt }`
 * or `{ light, dark?, alt?, darkFallback? }` becomes `{ light, dark?, alt?,
 * darkFallback? }`, or undefined where there is no mark to draw. `logoOf`
 * reads the compiled brand; this reads the document before it compiles, and
 * keeps only what the compile would (an empty mark, or a fallback other than
 * `"invert"`, is left out).
 */
export function logoOfDocument(logo: unknown): DocumentLogo | undefined {
  const parts = logoParts(logo);
  if (!parts || parts.light === "") return undefined;
  return {
    light: parts.light,
    ...(parts.dark ? { dark: parts.dark } : {}),
    ...(parts.alt ? { alt: parts.alt } : {}),
    ...(parts.darkFallback === "invert" ? { darkFallback: "invert" as const } : {}),
  };
}

/** What a change to the logo's dark scheme says, by an edit and by the preview of a change alike; nothing when that part did not change. */
export function darkLogoSentence(was: unknown, now: unknown): string | undefined {
  const before = logoParts(was);
  const after = logoParts(now);
  if (!after) return undefined;
  const dark = (parts: LogoParts | undefined) => parts?.dark ?? (parts?.darkFallback === "invert" ? "invert" : undefined);
  const [a, b] = [dark(before), dark(after)];
  if (a === b) return undefined;
  if (b === undefined) return "The logo is the same in both schemes.";
  if (b === "invert") return "The logo is drawn inverted in the dark scheme.";
  return a === undefined || a === "invert" ? "The logo gets one of its own for the dark scheme." : "The dark scheme's logo changes.";
}
