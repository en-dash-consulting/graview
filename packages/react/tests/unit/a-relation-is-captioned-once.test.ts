import { describe, expect, it } from "vitest";
import { captionRuns, type CaptionEntry } from "../../src/captions.js";

/**
 * A RELATION IS CAPTIONED ONCE, over the row it starts in, and never over
 * another relation's caption or under the rail. The neighbourhood of an
 * artist who is featured on two songs and produced four, sorted by id the
 * way the frame is.
 */
const card = (key: string, text: string, left: number, top: number): CaptionEntry => ({ key, text, left, right: left + 190, top });
const featured = "features|in";
const produced = "produced-by|in";
const artist = [
  card(featured, "the songs they are featured on", 280, 485), // After Midnight
  card(produced, "the songs they produced", 716, 485), // Blue Hour
  card(produced, "the songs they produced", 934, 485), // Cobalt
  card(produced, "the songs they produced", 498, 610), // Kerosene, second row
  card(produced, "the songs they produced", 716, 610), // Money Talks
  card(featured, "the songs they are featured on", 498, 485), // Rent Is Due
];
const room = { left: 264, right: 1152 };

describe("the captions over a relation band", () => {
  it("gives each relation one caption, however its members are sorted", () => {
    const runs = captionRuns(artist, room);
    expect(runs.map((run) => run.text)).toEqual(["the songs they are featured on", "the songs they produced"]);
    expect(new Set(runs.map((run) => run.key)).size).toBe(runs.length);
  });

  it("spans the row the relation starts in", () => {
    const [on, produced] = captionRuns(artist, room);
    expect(on!.left).toBe(280);
    expect(on!.left + on!.width).toBe(688);
    expect(produced!.left).toBe(716);
    expect(produced!.left + produced!.width).toBe(1124);
  });

  it("lets a narrow caption borrow the gutter but never another caption's ground", () => {
    const runs = captionRuns(
      [card("a|out", "who it features", 300, 100), card("b|out", "who produced it", 510, 100), card("c|out", "what it is about", 720, 100)],
      room,
    );
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]!.left).toBeGreaterThanOrEqual(runs[i - 1]!.left + runs[i - 1]!.width);
    }
  });

  it("keeps a caption out from under the rail", () => {
    const [only] = captionRuns([card("a|out", "the artist whose song it is", 270, 100)], room);
    expect(only!.left).toBeGreaterThanOrEqual(room.left);
    expect(only!.width).toBeGreaterThanOrEqual(190);
  });
});
