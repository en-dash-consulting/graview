import { brandFromAccent, checkBrandContrast, checkContrast, SCHEMES, TEXT_PAIRS, type ThemeTokens } from "@graview/core";
import { describe, expect, it } from "vitest";

/**
 * FR-38: a status says good or bad in the theme's own colors. The theme
 * had an accent and a warning and nothing for success or danger, so every
 * badge that meant "booked" or "overdue" invented a color and checked it
 * by hand, if at all.
 */
describe("the theme has good and bad tones", () => {
  it("exists in both schemes", () => {
    for (const scheme of ["light", "dark"] as const) {
      const tokens = SCHEMES[scheme] as ThemeTokens & { good?: string; bad?: string };
      expect(tokens.good, scheme).toMatch(/^#/);
      expect(tokens.bad, scheme).toMatch(/^#/);
      expect(tokens.good).not.toBe(tokens.bad);
    }
  });

  it("is held to 4.5:1 by the text pairs, where a badge is drawn: on a card and on a page", () => {
    for (const ink of ["good", "bad"]) {
      const pairs = TEXT_PAIRS.filter((pair) => pair.ink === ink);
      expect(pairs.map((pair) => pair.on).sort(), ink).toEqual(["ground", "panel"]);
      for (const pair of pairs) expect(pair.requires).toBe(4.5);
    }
  });

  it("passes those pairs in both shipped schemes", () => {
    const failures = checkBrandContrast(SCHEMES).filter((finding) => finding.ink === "good" || finding.ink === "bad");
    expect(failures).toEqual([]);
  });

  it("is measured, so a tone that cannot be read on the panel is said", () => {
    const pale = { ...SCHEMES.light, good: "#b8e6c4" } as ThemeTokens;
    expect(checkContrast(pale).some((finding) => finding.ink === "good" && finding.on === "panel")).toBe(true);
  });

  it("comes with a brand derived from one accent", () => {
    const derived = brandFromAccent({ accent: "#7a4bc2", base: SCHEMES });
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;
    for (const scheme of ["light", "dark"] as const) {
      const tokens = derived.schemes[scheme] as ThemeTokens & { good?: string; bad?: string };
      expect(tokens.good, scheme).toBeDefined();
      expect(tokens.bad, scheme).toBeDefined();
    }
  });
});
