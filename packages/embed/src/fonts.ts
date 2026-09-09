import type { Brand } from "@graview/core";

/**
 * The families a brand names, in the order it names them — the first family
 * of each stack, which is the one that has to be fetched. `ui-sans-serif`
 * and friends are the browser's own and are left out.
 */
export function familiesOf(brand: Brand | undefined): readonly string[] {
  const stacks = [brand?.typography?.body, brand?.typography?.display, brand?.typography?.mono];
  const out: string[] = [];
  for (const stack of stacks) {
    const first = stack?.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
    if (!first || first.startsWith("ui-") || first === "system-ui" || first.startsWith("-apple")) continue;
    if (!out.includes(first)) out.push(first);
  }
  return out;
}

/** A Google Fonts stylesheet URL for those families, or null when there is nothing to fetch. */
export function fontsLink(brand: Brand | undefined): string | null {
  const families = familiesOf(brand);
  if (families.length === 0) return null;
  const query = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
