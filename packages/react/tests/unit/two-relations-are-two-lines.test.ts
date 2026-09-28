import { describe, expect, it } from "vitest";
import { parallelOffsets } from "../../src/parallel.js";

/**
 * TWO RELATIONS BETWEEN THE SAME TWO THINGS ARE TWO LINES. "Gold Tooth" is
 * by Mara Vey and produced by Mara Vey; both lines were drawn on one curve,
 * so the first could be neither seen nor picked.
 */
describe("lines that share both ends", () => {
  it("fan out about the curve one line would take, whichever way each runs", () => {
    const offsets = parallelOffsets([
      { key: "by", a: "song:gold-tooth", b: "artist:mara-vey" },
      { key: "produced-by", a: "song:gold-tooth", b: "artist:mara-vey" },
      { key: "released-by", a: "artist:mara-vey", b: "album:paper-money" },
    ]);
    expect(offsets.get("by")).toBe(-8);
    expect(offsets.get("produced-by")).toBe(8);
    expect(offsets.get("released-by")).toBe(0);
  });

  it("gives three between one pair three different curves, the middle one where a single line would be", () => {
    const offsets = parallelOffsets([
      { key: "one", a: "x", b: "y" },
      { key: "two", a: "y", b: "x" },
      { key: "three", a: "x", b: "y" },
    ]);
    expect([offsets.get("one"), offsets.get("two"), offsets.get("three")]).toEqual([-16, 0, 16]);
  });
});
