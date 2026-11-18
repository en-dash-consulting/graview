import { describe, expect, it } from "vitest";
import { sameFit, titleThatFits } from "../../src/one-place-geometry.js";

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

  it("keeps words joined by a no-break space one word, as the browser does", () => {
    // "New\u00a0York" is 80 wide and the browser keeps it on one line: measured whole, the type is drawn smaller for it.
    const fit = titleThatFits("New\u00a0York", 40, measure, 0.4);
    expect(fit.size).toBeCloseTo(0.5);
    expect(fit.words).toHaveLength(1);
  });

  it("measures a word apart where the browser breaks it, after its hyphen or a zero-width space", () => {
    // "Well-known" breaks after "Well-": its widest piece, "known", is 50 and fits in 60.
    expect(titleThatFits("Well-known", 60, measure, 0.6)).toEqual({ size: 1, words: [{ text: "Well-known", cut: false }] });
    expect(titleThatFits("Field\u200bnotes", 60, measure, 0.6).size).toBe(1);
  });

  it("leaves a title in a script written without spaces to the browser, which breaks it between characters", () => {
    // Ten characters, 100 wide in a line of 40: neither drawn smaller nor cut, but wrapped as the browser wraps it.
    for (const title of ["\u6050\u7adc\u306e\u6642\u4ee3\u3068\u305d\u306e\u7d42\u308f\u308a", "\u0e44\u0e14\u0e42\u0e19\u0e40\u0e2a\u0e32\u0e23\u0e4c"]) {
      const fit = titleThatFits(title, 40, measure, 0.6);
      expect(fit.size).toBe(1);
      expect(fit.words.some((word) => word.cut)).toBe(false);
    }
  });

  it("draws a title renamed anew, though its size and cuts are alike", () => {
    const one = titleThatFits("Supercalifragilisticexpialidocious", 50, measure, 0.6);
    const other = titleThatFits("Antidisestablishmentarianism", 50, measure, 0.6);
    expect(one.size).toBe(other.size);
    expect(sameFit(one, other)).toBe(false);
    expect(sameFit(one, titleThatFits("Supercalifragilisticexpialidocious", 50, measure, 0.6))).toBe(true);
    expect(sameFit(null, one)).toBe(false);
  });
});
