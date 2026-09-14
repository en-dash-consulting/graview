import { describe, expect, it } from "vitest";
import { hueFor } from "../../src/index.js";

/**
 * A HUE IS DEGREES — in CSS, in every design tool, and in `brand.accents`,
 * which `graview check` validates as "a number 0–360".
 *
 * `hueFor` returned a fraction of a turn, because every consumer in this
 * repository wanted one. Nothing said so but the arithmetic. An app author
 * read the name, wrote `hsl(${hueFor(kind)} 58% 50%)` — valid CSS, renders
 * fine — and got a hue between 0 and 1 for every kind, which is red: a map
 * of four surfaces in four shades of the same pink. tsc passed, the checker
 * passed, the tests passed. It was only wrong to look at.
 *
 * So the unit is part of the contract now, and this is where it is written
 * down. The consumers divide; a caller does not have to know they do.
 */
describe("the hue a kind is drawn in", () => {
  it("is degrees, not a fraction of a turn", () => {
    for (const kind of ["zone", "practice", "routine", "concern", "person", "plot"]) {
      const hue = hueFor(kind);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
      /* The whole bug in one assertion: six kinds cannot all be red. */
      expect(Number.isInteger(hue)).toBe(true);
    }
    /* Four kinds landing in the first degree of the wheel is the failure. */
    const spread = new Set(["zone", "practice", "routine", "concern"].map((k) => Math.round(hueFor(k) / 30)));
    expect(spread.size).toBeGreaterThan(1);
  });

  it("gives a brand's declared accent back in the unit it was declared in", () => {
    expect(hueFor("zone", { zone: 122 })).toBe(122);
    /* Wrapped, so a brand may say 400 or -30 and get an answer on the wheel. */
    expect(hueFor("zone", { zone: 400 })).toBe(40);
    expect(hueFor("zone", { zone: -30 })).toBe(330);
  });

  it("is stable per kind, which is what makes it a thread", () => {
    expect(hueFor("vehicle")).toBe(hueFor("vehicle"));
    expect(hueFor("vehicle")).not.toBe(hueFor("person"));
  });
});
