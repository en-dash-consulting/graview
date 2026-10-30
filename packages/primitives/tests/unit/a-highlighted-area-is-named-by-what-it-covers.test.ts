import { describe, expect, it } from "vitest";
import { nameParts, type PartRead } from "../../src/section-words.js";

/*
 * WHAT A HIGHLIGHTED AREA COVERS, IN WORDS (Roadmap
 * f-make-this-section-better): the card opens naming the parts a person
 * dragged over, the way they would say it.
 */
const part = (tag: string, classes: string[], text: string, left: number, top: number): PartRead => ({ tag, classes, text, box: { left, top, width: 100, height: 60 } });

describe("a highlighted area", () => {
  it("names parts side by side that share a class by what the class says: the three day columns", () => {
    expect(nameParts([part("div", ["hf-wk-day", "js-pick"], "Mon", 0, 10), part("div", ["hf-wk-day", "js-pick"], "Tue", 110, 10), part("div", ["hf-wk-day", "js-pick"], "Wed", 220, 10)])).toBe("the three day columns");
  });

  it("names parts one under another as rows, and like elements by what they are", () => {
    expect(nameParts([part("div", ["tg-task"], "a", 0, 0), part("div", ["tg-task"], "b", 0, 70)])).toBe("the two task rows");
    expect(nameParts([part("li", [], "a", 0, 0), part("li", [], "b", 40, 90)])).toBe("the two items");
  });

  it("names one part by its words", () => {
    expect(nameParts([part("h2", [], "This week", 0, 0)])).toBe("the heading “This week”");
    expect(nameParts([part("a", [], "Book the van", 0, 0)])).toBe("the link “Book the van”");
  });

  it("counts different things in the order first met", () => {
    expect(nameParts([part("a", [], "x", 0, 0), part("img", [], "", 20, 50), part("a", [], "y", 40, 90)])).toBe("two links and a picture");
  });
});
