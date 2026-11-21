import { describe, expect, it } from "vitest";
import { boardsInTheirPlaces } from "../../src/one-place-geometry.js";

/*
 * A view going, while the history plays, sinks where it stands. Drawn
 * after every board that stays instead, React moved its element — took it
 * out of the page and put it back — and the sink under way on it was lost:
 * it went flat in a frame, as a building did before (one-face's
 * `aRemovedRecordComesDown`).
 */
const boards = (...keys: string[]) => keys.map((key) => ({ key }));
const keys = (list: readonly { readonly key: string }[]) => list.map((one) => one.key);

describe("a board going keeps its place among the others", () => {
  it("stands where it was last drawn, after the board it stood behind", () => {
    expect(keys(boardsInTheirPlaces(boards("a", "b", "d"), boards("c"), ["a", "b", "c", "d"]))).toEqual(["a", "b", "c", "d"]);
  });

  it("stands first where it was drawn first", () => {
    expect(keys(boardsInTheirPlaces(boards("b", "c"), boards("a"), ["a", "b", "c"]))).toEqual(["a", "b", "c"]);
  });

  it("keeps several going in the order they were drawn, beside one that has come", () => {
    expect(keys(boardsInTheirPlaces(boards("a", "new", "d"), boards("c", "b"), ["a", "b", "c", "d"]))).toEqual(["a", "b", "c", "new", "d"]);
  });

  it("keeps the order of every board that stays, so none of them is moved either", () => {
    const drawn = keys(boardsInTheirPlaces(boards("a", "c", "e"), boards("b", "d"), ["a", "b", "c", "d", "e"]));
    expect(drawn.filter((key) => ["a", "c", "e"].includes(key))).toEqual(["a", "c", "e"]);
  });

  it("puts one never drawn before last, and changes nothing where none is going", () => {
    expect(keys(boardsInTheirPlaces(boards("a"), boards("z"), ["a"]))).toEqual(["a", "z"]);
    const standing = boards("a", "b");
    expect(boardsInTheirPlaces(standing, [], ["a", "b"])).toBe(standing);
  });
});
