import { createSchema, defineNode } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { kindCardId, placeCity } from "../../src/index.js";

/**
 * A SHEET A CHOICE OPENS LEAVES THE CITY WHERE IT STOOD.
 *
 * On a phone a district chosen from altitude opens its sheet over the foot
 * of the screen, and the city was fitted again to what the sheet left: one
 * tap drew it half again as big and somewhere else, under the finger. Fitted
 * to the whole canvas with `seen` naming what the sheet leaves, the city
 * keeps its size, and moves as one only so far as lifts the choice above the
 * sheet.
 */
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs", edges: { on: { to: ["album"], description: "the album" } } });
const album = defineNode("album", { fields: z.object({ label: z.string() }), plural: "Albums", edges: { by: { to: ["artist"], description: "the artist" } } });
const artist = defineNode("artist", { fields: z.object({ label: z.string() }), plural: "Artists" });
const era = defineNode("era", { fields: z.object({ label: z.string() }), plural: "Eras" });
const schema = createSchema([song, album, artist, era]);
const kinds = ["era", "artist", "album", "song"];
const plate = { width: 120, height: 22, short: { width: 90, height: 20 } };
const cards = kinds.map((kind) => ({ id: kindCardId(kind), kind, count: 12, opened: 0, nameplate: plate }));
/** A phone, and the part of it a sheet over its foot leaves seen. */
const phone = { width: 400, height: 680 };
const seen = { width: 400, height: 300 };
type Placed = ReturnType<typeof placeCity>["placed"][number];
const byId = (placed: readonly Placed[]) => new Map(placed.map((card) => [card.id, card]));

describe("a sheet a choice opens leaves the city where it stood", () => {
  it("keeps every district's size, and lifts the city as one so a district the sheet would cover stands above it", () => {
    const unchosen = placeCity(cards, schema, phone);
    const lowest = [...unchosen.placed].sort((a, b) => b.y - a.y)[0]!;
    const chosen = placeCity(cards, schema, phone, {}, { keep: [lowest.id.slice("kind:".length)], seen });
    expect(chosen.frame.cell).toBe(unchosen.frame.cell);
    const lifted = byId(chosen.placed).get(lowest.id)!;
    expect(lifted.y + lifted.height).toBeLessThanOrEqual(seen.height);
    const moves = unchosen.placed.map((card) => {
      const now = byId(chosen.placed).get(card.id)!;
      expect(now.width).toBeCloseTo(card.width, 6);
      return { dx: now.x - card.x, dy: now.y - card.y };
    });
    for (const move of moves) {
      expect(move.dx).toBeCloseTo(moves[0]!.dx, 6);
      expect(move.dy).toBeCloseTo(moves[0]!.dy, 6);
    }
  });

  it("chooses a district already above the sheet with nothing moving", () => {
    const unchosen = placeCity(cards, schema, phone);
    const highest = [...unchosen.placed].sort((a, b) => a.y - b.y)[0]!;
    const chosen = placeCity(cards, schema, phone, {}, { keep: [highest.id.slice("kind:".length)], seen });
    expect(chosen.placed.map((card) => [card.id, card.x, card.y])).toEqual(unchosen.placed.map((card) => [card.id, card.x, card.y]));
  });

  it("fitted to what the sheet left, as it was, the city is drawn at another size — what each tap used to do", () => {
    const unchosen = placeCity(cards, schema, phone);
    const refit = placeCity(cards, schema, { width: phone.width, height: seen.height }, {}, { keep: ["song"] });
    expect(refit.frame.cell).not.toBe(unchosen.frame.cell);
  });
});
