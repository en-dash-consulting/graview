import { createSchema, defineNode } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BoardBindingError, buildBoard, createBoardLens } from "../../src/index.js";

/**
 * Deliberately not a football pitch. If a lens only works beside the app it
 * was written for it is a component, not a lens — so this fixture is a
 * seating plan, which is the same shape and nothing like the same domain.
 */
const seat = defineNode("seat", {
  fields: z.object({ label: z.string(), code: z.string(), x: z.number(), y: z.number() }),
  edges: { "taken-by": { to: ["guest"] } },
  plural: "Seats",
});
const guest = defineNode("guest", { fields: z.object({ label: z.string() }), plural: "Guests" });
const schema = createSchema([seat, guest]);

const nodes = [
  { id: "s1", kind: "seat", label: "Head of table", code: "1", x: 0.5, y: 0.1 },
  { id: "s2", kind: "seat", label: "Window side", code: "2", x: 0.2, y: 0.5 },
  { id: "s3", kind: "seat", label: "Door side", code: "3", x: 0.8, y: 0.5 },
  { id: "g-ada", kind: "guest", label: "Ada" },
  { id: "g-bram", kind: "guest", label: "Bram" },
  { id: "g-cleo", kind: "guest", label: "Cleo" },
] as never[];

const edges = [
  { kind: "taken-by", from: "s1", to: "g-ada" },
  { kind: "taken-by", from: "s3", to: "g-bram" },
];

const options = { slots: "seat", x: "x", y: "y", fill: "taken-by", slotCode: "code" } as const;

describe("the board lens", () => {
  it("declares the roles an app must bind", () => {
    expect(createBoardLens(options).requiredRoles).toEqual(["slots", "x", "y", "fill"]);
  });

  it("places each slot where the DOMAIN says, not where a layout decided", () => {
    const board = buildBoard(nodes, edges, options, schema);
    const head = board.slots.find((slot) => slot.id === "s1")!;
    expect([head.x, head.y]).toEqual([0.5, 0.1]);
  });

  it("names the empty slot — the reason the lens exists", () => {
    expect(buildBoard(nodes, edges, options, schema).empty).toEqual(["s2"]);
  });

  it("lists whoever is not placed, so the bench is not a mystery", () => {
    expect(buildBoard(nodes, edges, options, schema).spare.map((s) => s.id)).toEqual(["g-cleo"]);
  });

  it("reads top to bottom, so assistive technology gets a sane order", () => {
    // Not the order the graph happened to be in: an arrangement read aloud
    // in storage order is unusable.
    expect(buildBoard(nodes, edges, options, schema).slots.map((slot) => slot.id)).toEqual([
      "s1",
      "s2",
      "s3",
    ]);
  });

  it("clamps a coordinate outside the board rather than drawing off it", () => {
    const stray = [...nodes, { id: "s4", kind: "seat", label: "Stray", code: "4", x: 4, y: -2 }] as never[];
    const slot = buildBoard(stray, edges, options, schema).slots.find((s) => s.id === "s4")!;
    expect([slot.x, slot.y]).toEqual([1, 0]);
  });

  it("says which binding is wrong rather than drawing an empty board", () => {
    expect(() => buildBoard(nodes, edges, { ...options, slots: "nope" }, schema)).toThrow(
      BoardBindingError,
    );
  });
});
