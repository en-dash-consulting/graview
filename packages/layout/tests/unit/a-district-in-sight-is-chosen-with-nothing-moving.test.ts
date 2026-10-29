import { createSchema, defineNode } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { kindCardId, placeCity } from "../../src/index.js";

/**
 * A DISTRICT IN SIGHT IS CHOSEN WITH NOTHING MOVING.
 *
 * A city drawn past the window keeps the chosen district in sight by the
 * least move — measured from the city's middle every time. On an iPad with
 * the panel beside the map, choosing a district at the edge slid the city
 * one way, and choosing one in plain sight slid it all the way back: the
 * map shot about under each tap. The move is made from where the city
 * stood now (`stood`, handed back on the frame), at the same cell.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People", edges: { does: { to: ["duty"], description: "what they do" } } });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Duties", edges: { in: { to: ["week"], description: "when" } } });
const week = defineNode("week", { fields: z.object({ label: z.string() }), plural: "Weeks" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([person, duty, week, note]);
const kinds = ["week", "duty", "person", "note"];
const wide = { width: 180, height: 22, short: { width: 180, height: 22 } };
const cards = kinds.map((kind) => ({ id: kindCardId(kind), kind, count: 3, opened: 0, nameplate: wide }));
/** Narrow enough that the city comes closer and runs past the window: People's name runs past its edge. */
const phone = { width: 280, height: 400 };
type Placed = ReturnType<typeof placeCity>["placed"][number];
const xy = (placed: readonly Placed[]) => placed.map((card) => ({ id: card.id, x: card.x, y: card.y }));

describe("a district in sight is chosen with nothing moving", () => {
  it("brings People in, says how far the city moved, and from there chooses Duties, already in sight, without moving the city", () => {
    const first = placeCity(cards, schema, phone, {}, { keep: ["person"] });
    expect(first.frame.stood).toBeDefined();
    expect(first.frame.stood!.cell).toBe(first.frame.cell);
    expect(Math.abs(first.frame.stood!.x) + Math.abs(first.frame.stood!.y)).toBeGreaterThan(0);
    const next = placeCity(cards, schema, phone, {}, { keep: ["duty"], stood: first.frame.stood! });
    expect(xy(next.placed)).toEqual(xy(first.placed));
    expect(next.frame.stood).toEqual(first.frame.stood);
  });

  it("set out from the middle, the same choice slides the city back — what each tap used to do", () => {
    const first = placeCity(cards, schema, phone, {}, { keep: ["person"] });
    const fromTheMiddle = placeCity(cards, schema, phone, {}, { keep: ["duty"] });
    expect(fromTheMiddle.frame.originX).not.toBe(first.frame.originX);
  });

  it("does not take where the city stood at another cell: a window of another size sets out from its middle", () => {
    const first = placeCity(cards, schema, phone, {}, { keep: ["person"] });
    const elsewhere = { ...first.frame.stood!, cell: first.frame.stood!.cell * 2 };
    expect(placeCity(cards, schema, phone, {}, { keep: ["person"], stood: elsewhere }).frame).toEqual(first.frame);
  });
});
