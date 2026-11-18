import { describe, expect, it } from "vitest";
import { inTheirPlaces } from "../../src/plots.js";

/*
 * A building going, while the history plays, sinks where it stood. Put
 * last among its village's blocks instead, React moved its element — took
 * it out of the page and put it back — and the sink under way on it was
 * lost: it went flat in a frame (one-face's `aRemovedRecordComesDown`).
 */
const blocks = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: readonly { readonly id: string }[]) => list.map((one) => one.id);

describe("a building going keeps its place among the others", () => {
  it("stands where it was last drawn, after the block it stood behind", () => {
    expect(ids(inTheirPlaces(blocks("a", "b", "d"), blocks("c"), ["a", "b", "c", "d"]))).toEqual(["a", "b", "c", "d"]);
  });

  it("stands first where it was drawn first", () => {
    expect(ids(inTheirPlaces(blocks("b", "c"), blocks("a"), ["a", "b", "c"]))).toEqual(["a", "b", "c"]);
  });

  it("keeps several going in the order they were drawn, beside one that has come", () => {
    expect(ids(inTheirPlaces(blocks("a", "new", "d"), blocks("c", "b"), ["a", "b", "c", "d"]))).toEqual(["a", "b", "c", "new", "d"]);
  });

  it("keeps the order of every block that stays, so none of them is moved either", () => {
    const drawn = ids(inTheirPlaces(blocks("a", "c", "e"), blocks("b", "d"), ["a", "b", "c", "d", "e"]));
    expect(drawn.filter((id) => ["a", "c", "e"].includes(id))).toEqual(["a", "c", "e"]);
  });

  it("puts one never drawn before last, and changes nothing where none is going", () => {
    expect(ids(inTheirPlaces(blocks("a"), blocks("z"), ["a"]))).toEqual(["a", "z"]);
    const standing = blocks("a", "b");
    expect(inTheirPlaces(standing, [], ["a", "b"])).toBe(standing);
  });
});
