import { createSchema, defineNode, Graph, toIso } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMPTY_VIEW, interpolate, kindCardId, layout, withWithin } from "../../src/index.js";

/**
 * A LENS IS A DRIVE-IN. From altitude a kind's named picture stands on
 * that kind's plot — a screen anchored to the plot's far edge, centred on
 * it — rather than floating in the middle bound to no kind; a picture
 * over two kinds stands on the road between them; and the screen's
 * address survives the tween.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People", edges: { does: { to: ["duty"], description: "what they do" } } });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Duties", edges: { in: { to: ["week"], description: "when" } } });
const week = defineNode("week", { fields: z.object({ label: z.string() }), plural: "Weeks" });
const schema = createSchema([person, duty, week]);
const graph = () =>
  Graph.from(schema, {
    nodes: [
      { id: "w1", kind: "week", label: "This week" },
      { id: "ana", kind: "person", label: "Ana" },
      { id: "m", kind: "duty", label: "Morning" },
    ] as never,
    edges: [{ kind: "does", from: "ana", to: "m" }],
  });
const focused = { ...EMPTY_VIEW, overview: true, focusId: "aggregate:duty" };
const screens = { duty: [{ as: "the-week", title: "The week" }, { as: "the-matrix", title: "The matrix", across: "person" }] };
const options = { width: 1280, height: 800, cityOrder: ["week", "duty", "person"], screens };

describe("the drive-in", () => {
  it("stands the focused picture on its kind's plot, anchored to the plot's far edge and centred on it", () => {
    const result = layout(graph(), schema, focused, options);
    const screen = result.nodes.find((node) => node.id === "aggregate:duty")!;
    const card = result.nodes.find((node) => node.id === kindCardId("duty"))!;
    expect(screen.screenOf).toBe("duty");
    expect(screen.natural).toBeDefined();
    const plot = card.plot!;
    const frame = result.city!;
    const top = { x: frame.originX + toIso(plot.col, plot.row, frame.cell).x, y: frame.originY + toIso(plot.col, plot.row, frame.cell).y };
    const centre = frame.originX + toIso(plot.col + plot.side / 2, plot.row + plot.side / 2, frame.cell).x;
    expect(screen.x + screen.width / 2).toBeCloseTo(centre, 3);
    /* Its foot is at the far edge of the plot, a little inside — and never on its own nameplate. */
    const foot = screen.y + screen.height;
    expect(foot).toBeLessThanOrEqual(top.y + frame.cell * 0.1 + 0.01);
    // Not above the card any more: the nameplate is a signpost at the front
    // corner, so the billboard's foot is on the back kerb, wherever the card's top is.
    expect(foot).toBeGreaterThan(card.y - card.height * 2);
    expect(screen.width).toBeGreaterThanOrEqual(300);
    /* And it covers no other district's nameplate. */
    for (const other of result.nodes.filter((node) => node.plane === 2 && node.id !== card.id)) {
      const over = other.x < screen.x + screen.width && screen.x < other.x + other.width && other.y < screen.y + screen.height && screen.y < other.y + other.height;
      expect(over, other.id).toBe(false);
    }
  });

  it("stands a picture over two kinds on the road between their plots", () => {
    const result = layout(graph(), schema, withWithin(focused, "view", "the-matrix"), options);
    const screen = result.nodes.find((node) => node.id === "aggregate:duty")!;
    const duties = result.nodes.find((node) => node.id === kindCardId("duty"))!;
    const people = result.nodes.find((node) => node.id === kindCardId("person"))!;
    const mid = (duties.x + duties.width / 2 + people.x + people.width / 2) / 2;
    expect(screen.screenOf).toBe("duty");
    expect(Math.abs(screen.x + screen.width / 2 - mid)).toBeLessThan(screen.width);
    const alone = layout(graph(), schema, focused, options).nodes.find((node) => node.id === "aggregate:duty")!;
    expect(alone.x).not.toBeCloseTo(screen.x, 0);
  });

  it("keeps the picture in the middle for a kind with no named place, and no screen is named", () => {
    const result = layout(graph(), schema, focused, { ...options, screens: {} });
    const stamp = result.nodes.find((node) => node.id === "aggregate:duty")!;
    expect(stamp.screenOf).toBeUndefined();
    expect(stamp.x + stamp.width / 2).toBeCloseTo(1280 / 2, 0);
  });

  it("carries screenOf through interpolate.mix mid-tween", () => {
    const below = layout(graph(), schema, { ...EMPTY_VIEW, focusId: "aggregate:duty" }, options);
    const above = layout(graph(), schema, focused, options);
    const half = interpolate(below, above, 0.5);
    expect(half.nodes.find((node) => node.id === "aggregate:duty")!.screenOf).toBe("duty");
  });

  it("no longer makes the city slide aside: every district stays on the canvas beside its own screen", () => {
    const result = layout(graph(), schema, focused, options);
    for (const card of result.nodes.filter((node) => node.plane === 2)) {
      expect(card.x, card.id).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width, card.id).toBeLessThanOrEqual(1280);
      expect(card.y + card.height, card.id).toBeLessThanOrEqual(800);
    }
  });
});
