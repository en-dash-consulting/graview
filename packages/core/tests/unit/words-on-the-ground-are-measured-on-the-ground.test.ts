import { brandFromAccent, checkBrandContrast, checkContrast, SCHEMES, TEXT_PAIRS, type ThemeTokens } from "@graview/core";
import { describe, expect, it } from "vitest";

/**
 * WORDS TAKEN OUT OF THEIR CAPSULES ARE MEASURED WHERE THEY NOW STAND
 * (FR-117). The design pass took the district's name, a drive-in's showings
 * and the places on the bar out of their pills: the words now stand on the
 * ground (and the bar), not on a panel. The showing a drive-in is on is
 * drawn in the accent there, and the accent `brandFromAccent` derives was
 * only ever tuned to clear 4.5:1 on the panel — white in the light scheme,
 * a shade lighter than the warm paper of the ground. A green, a teal, a
 * blue or a gray accent landed at 4.1–4.3:1 on the ground, under AA, and
 * `graview check` said nothing, because the pair was not on its list.
 */
const ACCENTS = ["#e11d48", "#16a34a", "#7c3aed", "#0ea5e9", "#888888", "#2a9d8f", "#0c6e78"];

describe("words on the ground are measured on the ground", () => {
  it("lists the pairs the quiet faces draw: the accent, the ink and the muted ink where there is no panel under them", () => {
    const has = (ink: string, on: string) => TEXT_PAIRS.some((pair) => pair.ink === ink && pair.on === on && pair.requires === 4.5);
    expect(has("accent", "ground")).toBe(true);
    expect(has("ink", "ground")).toBe(true);
    expect(has("inkMuted", "bar")).toBe(true);
    expect(has("inkMuted", "ground")).toBe(true);
  });

  it("derives an accent that reads on the ground as well as on the panel, in both schemes", () => {
    for (const accent of ACCENTS) {
      const derived = brandFromAccent({ accent, base: SCHEMES });
      if (!derived.ok) throw new Error(`${accent}: ${derived.why}`);
      expect(checkBrandContrast(derived.schemes), accent).toEqual([]);
    }
  });

  it("says an accent that cannot be read on the ground", () => {
    const faint = { ...SCHEMES.light, accent: "#1f8a5c" } as ThemeTokens;
    expect(checkContrast(faint).some((finding) => finding.ink === "accent" && finding.on === "ground")).toBe(true);
  });

  it("passes in both shipped schemes", () => {
    expect(checkBrandContrast(SCHEMES)).toEqual([]);
  });
});
