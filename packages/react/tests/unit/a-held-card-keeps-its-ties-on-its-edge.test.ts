import { describe, expect, it } from "vitest";
import { movedBy, type Strand } from "../../src/connectors.js";
import type { SceneNode } from "../../src/scene-node.js";

/*
 * A CARD HELD BY THE HAND keeps its ties on its drawn edge. The lines used
 * to fall back to the layout's slots while a card was held, and a slot is
 * taller than the card drawn in it: every tie started in open ground under
 * the card, and every tie the card had already said was drawn at once.
 * They stand on what was measured now, moved by as far as each card has.
 */
const node = (id: string, x: number, y: number) => ({ id, x, y, width: 100, height: 40, plane: 0 }) as unknown as SceneNode;
const card = { x: 300, y: 80, width: 700, height: 330 };
const chip = { x: 900, y: 476, width: 110, height: 26 };
const other = { x: 40, y: 476, width: 110, height: 26 };
const strand = {
  key: "by:song|artist",
  connector: { id: "by", kind: "by", from: "song", to: "artist", edges: [] },
  edges: [{ from: "song", to: "artist" }],
  fromBox: chip,
  toBox: card,
  fromAnchor: "song",
  toAnchor: "artist",
  obstacles: [],
  hosts: [],
  band: [chip, other],
  tie: { card, chip, cardIsTo: true, toward: "song", holds: ["song"] },
  said: ["song"],
} as unknown as Strand;

describe("a held card's ties", () => {
  it("move with the card by as far as the layout has moved it, and keep waiting where the card said them", () => {
    const [moved] = movedBy([strand], [node("artist", 0, 0), node("song", 0, 0)], [node("artist", 40, 30), node("song", 0, 0)]);
    expect(moved!.tie!.card).toEqual({ ...card, x: 340, y: 110 });
    expect(moved!.toBox).toEqual({ ...card, x: 340, y: 110 });
    expect(moved!.tie!.chip).toBe(chip);
    expect(moved!.said).toEqual(["song"]);
  });

  it("move a held chip of the band, in the band too, and leave the rest where they were measured", () => {
    const [moved] = movedBy([strand], [node("artist", 0, 0), node("song", 0, 0)], [node("artist", 0, 0), node("song", -20, 10)]);
    expect(moved!.tie!.chip).toEqual({ ...chip, x: 880, y: 486 });
    expect(moved!.band).toEqual([{ ...chip, x: 880, y: 486 }, other]);
    expect(moved!.tie!.card).toBe(card);
  });
});
