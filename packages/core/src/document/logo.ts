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
