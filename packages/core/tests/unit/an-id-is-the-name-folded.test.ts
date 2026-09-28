import { describe, expect, it } from "vitest";
import { slug } from "../../src/mutations/define-mutation.js";

/**
 * AN ID IS THE NAME, FOLDED. A discography's featured artist, "Zoë
 * Lamarré", was minted `artist:zo-lamarr`: every letter with an accent was
 * dropped rather than folded, so the address in the bar was nobody's name.
 */
describe("the id a name mints", () => {
  it("folds accents the way search does, rather than dropping the letter", () => {
    expect(slug("Zoë Lamarré")).toBe("zoe-lamarre");
    expect(slug("Beyoncé")).toBe("beyonce");
    expect(slug("Mötley Crüe")).toBe("motley-crue");
  });
  it("keeps a letter that has no Latin form, instead of calling it an item", () => {
    expect(slug("Сплин")).toBe("сплин");
    expect(slug("東京事変")).toBe("東京事変");
  });
  it("is unchanged for the plain names it always minted", () => {
    expect(slug("Salt & Static")).toBe("salt-static");
    expect(slug("Hometown (Again)")).toBe("hometown-again");
    expect(slug("  ")).toBe("item");
  });
});
