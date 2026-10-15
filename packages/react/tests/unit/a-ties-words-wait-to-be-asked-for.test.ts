import { describe, expect, it } from "vitest";
import { placeTieLabels, tiesReached } from "../../src/tie-labels.js";

/*
 * A TIE'S WORDS WAIT TO BE ASKED FOR (Nick, 2026-10-15). Every tie on the
 * ground said its relation at its far end, all the time, so a few ties
 * were a row of floating labels over the cards — "the findings in it: 7
 * findings" over a district's name, another over the Low severity card's
 * title. Now the words show while the tie or a card at its end is reached,
 * stand beside the far end clear of every card's title, and are said once.
 * The page itself is `verify-drawn-once`'s
 * `aTiesWordsWaitUntilItIsReachedAndStandOnNoTitle`.
 */
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("a tie's words", () => {
  const district = box(600, 700, 220, 56);
  const neighbor = box(860, 700, 220, 56);
  const cards = [district, neighbor].map((card) => ({ box: card, title: { ...card, height: 24 } }));

  it("stand beside the far end on no card's title", () => {
    const [label] = placeTieLabels([{ key: "a", said: "the findings in it: 7 findings", end: { x: 820, y: 720 }, far: district }], cards, { width: 1440, height: 900 });
    expect(label).toBeDefined();
    for (const card of cards) expect(overlaps(label!, card.title)).toBe(false);
  });

  it("are said once where two ties say the same words", () => {
    const labels = placeTieLabels(
      [
        { key: "a", said: "the findings in it: 2 findings", end: { x: 700, y: 700 }, far: district },
        { key: "b", said: "the findings in it: 2 findings", end: { x: 760, y: 700 }, far: district },
        { key: "c", said: "who made it: The Beatles", end: { x: 900, y: 700 }, far: neighbor },
      ],
      cards,
      { width: 1440, height: 900 },
    );
    expect(labels.map((label) => label.said)).toEqual(["the findings in it: 2 findings", "who made it: The Beatles"]);
    expect(labels[0]!.keys).toEqual(["a", "b"]);
    expect(overlaps(labels[0]!, labels[1]!)).toBe(false);
  });

  it("show for the tie under the pointer, a card at its end, or the record holding the keyboard, and for nothing else", () => {
    const ties = [
      { key: "a", fromBox: box(100, 100, 200, 100), toBox: district, ids: ["module:a", "finding:1"], edgeId: "edge:a" },
      { key: "b", fromBox: box(400, 100, 200, 100), toBox: neighbor, ids: ["module:b", "finding:2"], edgeId: "edge:b" },
    ];
    expect([...tiesReached(ties, { point: { x: 10, y: 10 } })]).toEqual([]);
    expect([...tiesReached(ties, { point: { x: 650, y: 720 } })]).toEqual(["a"]);
    expect([...tiesReached(ties, { point: { x: 450, y: 150 } })]).toEqual(["b"]);
    expect([...tiesReached(ties, { edgeId: "edge:b" })]).toEqual(["b"]);
    expect([...tiesReached(ties, { ids: ["module:a"] })]).toEqual(["a"]);
  });
});
