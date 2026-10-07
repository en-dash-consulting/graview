import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aggregateId, EMPTY_VIEW, layout, panLayout } from "../../src/index.js";

/**
 * THE PAN IS A TRANSLATION AND NOTHING ELSE.
 *
 * It is applied at the very end of `layout`, after every real decision has
 * been made — so laying the world out again for a pointer move is paying
 * for communities, plots, band packing and the drive-in's sizing loop to
 * reach an answer that differs from the last one by a subtraction. A drag
 * did exactly that, sixty times a second: rota's city dropped 169 of 467
 * frames and blocked the main thread for ten seconds in a two-second drag.
 *
 * `panLayout` is the subtraction on its own, and this is the assertion that
 * lets the scene trust it: laying out WITH a pan and translating a layout
 * made WITHOUT one must give the same picture, down to the last coordinate.
 * If some future placement rule starts reading the pan for anything other
 * than that final offset, this fails and says so.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People", edges: { does: { to: ["duty"], description: "what they do" } } });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Duties" });
const week = defineNode("week", { fields: z.object({ label: z.string() }), plural: "Weeks" });
const schema = createSchema([person, duty, week]);
const graph = () =>
  Graph.from(schema, {
    nodes: [
      { id: "w1", kind: "week", label: "This week" },
      { id: "ana", kind: "person", label: "Ana" },
      { id: "bo", kind: "person", label: "Bo" },
      { id: "m", kind: "duty", label: "Morning" },
      { id: "e", kind: "duty", label: "Evening" },
    ] as never,
    edges: [
      { kind: "does", from: "ana", to: "m" },
      { kind: "does", from: "bo", to: "e" },
    ],
  });

const pan = { x: -137, y: 64 };
const size = { width: 1280, height: 800 };

/*
 * A PICOMETER IS NOT A DIFFERENCE IN THE PICTURE.
 *
 * Cards land on exactly the same coordinates either way. The lines between
 * them do not, by one unit in the last place: `layout` builds an endpoint as
 * (x + pan) + width / 2 and this builds it as (x + width / 2) + pan, and
 * floating-point addition is not associative — 472.6307692307692 against
 * 472.63076923076926. Rounded where a browser would stop caring, so the
 * assertion is about the layout and not about IEEE 754.
 */
const asDrawn = (value: unknown): unknown =>
  typeof value === "number"
    ? Number(value.toFixed(6))
    : Array.isArray(value)
      ? value.map(asDrawn)
      : value !== null && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([key, held]) => [key, asDrawn(held)]))
        : value;

/** Every state worth asking about: the stack, a focus, and the city. */
const states = {
  "the stack": { ...EMPTY_VIEW, focusId: aggregateId("duty") },
  "a single thing in focus": { ...EMPTY_VIEW, focusId: "ana" },
  "the city at altitude": { ...EMPTY_VIEW, overview: true },
};

describe("the pan is a translation", () => {
  for (const [where, state] of Object.entries(states)) {
    it(`gives the same picture panned or translated — ${where}`, () => {
      const panned = layout(graph(), schema, { ...state, pan }, size);
      const translated = panLayout(layout(graph(), schema, state, size), pan);
      // The cards land on exactly the same coordinates, with nothing forgiven.
      expect(translated.nodes).toEqual(panned.nodes);
      expect(asDrawn(translated.connectors)).toEqual(asDrawn(panned.connectors));
      expect(translated.city).toEqual(panned.city);
      expect(translated.width).toBe(panned.width);
      expect(translated.height).toBe(panned.height);
    });
  }

  it("moves the cards and the lines between them by exactly the pan", () => {
    const rest = layout(graph(), schema, states["the stack"], size);
    const moved = panLayout(rest, pan);
    for (const [at, node] of moved.nodes.entries()) {
      expect(node.x - rest.nodes[at]!.x).toBe(pan.x);
      expect(node.y - rest.nodes[at]!.y).toBe(pan.y);
    }
    for (const [at, line] of moved.connectors.entries()) {
      expect(line.x1 - rest.connectors[at]!.x1).toBe(pan.x);
      expect(line.y2 - rest.connectors[at]!.y2).toBe(pan.y);
    }
  });

  it("leaves the city's own ground unpanned, and records the pan on it", () => {
    // The lattice and the plots ride `city.pan` so they can tween with the
    // cards; the origin and the extent are unpanned by definition.
    const rest = layout(graph(), schema, states["the city at altitude"], size);
    const moved = panLayout(rest, pan);
    expect(moved.city!.originX).toBe(rest.city!.originX);
    expect(moved.city!.extent).toEqual(rest.city!.extent);
    expect(moved.city!.pan).toEqual(pan);
  });

  it("hands back the very same layout when nothing has been panned", () => {
    // A scene at rest must not pay for a copy of every node on every render.
    const rest = layout(graph(), schema, states["the stack"], size);
    expect(panLayout(rest, { x: 0, y: 0 })).toBe(rest);
  });
});
