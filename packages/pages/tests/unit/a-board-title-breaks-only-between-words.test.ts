import { describe, expect, it } from "vitest";
import { titleThatFits } from "../../src/one-place-geometry.js";

/*
 * A board's title wraps between words on every system's type. On a Linux
 * runner, where system-ui is DejaVu and wider than the Mac's type, Deep
 * Time's "Researchers" and "Extinctions" were broken mid-word across the
 * title's two lines: the browser there has no hyphenation to fall back on.
 * The title's type is drawn smaller until its widest word fits, as far as
 * the face's smallest words; a word wider still is cut with an ellipsis.
 */
describe("a board's title breaks only between words", () => {
  // Ten pixels a letter: easy to reason about.
  const measure = (text: string) => [...text].length * 10;
  const words = (fit: ReturnType<typeof titleThatFits>) => fit.words.map((word) => (word.cut ? `[${word.text}]` : word.text)).join("");

  it("keeps its size where every word fits the line", () => {
    const fit = titleThatFits("Big Extinctions", 120, measure, 0.6);
    expect(fit.size).toBe(1);
    expect(words(fit)).toBe("Big Extinctions");
  });

  it("draws its type smaller until its widest word fits, so the word is read whole", () => {
    // "Researchers" is 110 wide; in 88 it fits at 0.8 of its size.
    const fit = titleThatFits("The Researchers", 88, measure, 0.6);
    expect(fit.size).toBeCloseTo(0.8);
    expect(words(fit)).toBe("The Researchers");
  });

  it("goes no smaller than the least it is given, and cuts only a word still too wide there", () => {
    // At 0.6 of its size "Researchers" is 66 wide: wider than 50, and cut; "The" is 18, and whole.
    const fit = titleThatFits("The Researchers", 50, measure, 0.6);
    expect(fit.size).toBe(0.6);
    expect(words(fit)).toBe("The [Researchers]");
  });

  it("keeps the spaces between words as they were, so lines still break at them", () => {
    expect(words(titleThatFits("Field  notes\tkept", 200, measure, 0.6))).toBe("Field  notes\tkept");
  });

  it("changes nothing where the line has no width to measure against yet", () => {
    const fit = titleThatFits("Researchers", 0, measure, 0.6);
    expect(fit.size).toBe(1);
    expect(words(fit)).toBe("Researchers");
  });
});
