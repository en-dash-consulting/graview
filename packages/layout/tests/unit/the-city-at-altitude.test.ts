import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cameraLimit, EMPTY_VIEW, interpolate, kindCardId, layout, panForZoom, placeCity, toggleExpanded } from "../../src/index.js";

/**
 * THE CITY AT ALTITUDE. The kinds stand on the declaration's own map, on
 * the 2:1 lattice, under ONE uniform scale and translate — so the city has
 * the same shape on a phone as on a monitor; nearer rows are drawn nearer;
 * every district carries its address; and the address survives the tween.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People", edges: { does: { to: ["duty"], description: "what they do" } } });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Duties", edges: { in: { to: ["week"], description: "when" } } });
const week = defineNode("week", { fields: z.object({ label: z.string() }), plural: "Weeks" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([person, duty, week, note]);
const graph = () =>
  Graph.from(schema, {
    nodes: [
      { id: "w1", kind: "week", label: "This week" },
      { id: "ana", kind: "person", label: "Ana" },
      { id: "bo", kind: "person", label: "Bo" },
      { id: "m", kind: "duty", label: "Morning" },
      { id: "n", kind: "note", label: "A note" },
    ] as never,
    edges: [{ kind: "does", from: "ana", to: "m" }],
  });
const overview = { ...EMPTY_VIEW, overview: true };
const districts = (width: number, height: number) =>
  layout(graph(), schema, overview, { width, height, cityOrder: ["week", "duty", "person", "note"] }).nodes.filter((node) => node.plane === 2);

describe("the city at altitude", () => {
  it("gives every district its address from the map, and the frame says which lattice it is on", () => {
    const result = layout(graph(), schema, overview, { width: 1280, height: 800, cityOrder: ["week", "duty", "person", "note"] });
    expect(result.city).toBeDefined();
    expect(result.city!.cell).toBeGreaterThan(0);
    const cards = result.nodes.filter((node) => node.plane === 2);
    expect(cards.every((card) => card.plot !== undefined)).toBe(true);
    expect(cards.find((card) => card.id === kindCardId("week"))!.plot).toEqual({ col: 0, row: 0, side: 1 });
    /* Two people: a side of two. */
    expect(cards.find((card) => card.id === kindCardId("person"))!.plot!.side).toBe(2);
  });

  it("has the same shape at 1280 and at 390: one scale, one translate", () => {
    const wide = districts(1280, 800);
    const phone = districts(390, 640);
    const center = (card: { x: number; y: number; width: number; height: number }) => ({ x: card.x + card.width / 2, y: card.y + card.height / 2 });
    const pairs = [
      [kindCardId("week"), kindCardId("duty")],
      [kindCardId("duty"), kindCardId("person")],
      [kindCardId("person"), kindCardId("note")],
    ] as const;
    const vectors = (cards: typeof wide) =>
      pairs.map(([a, b]) => {
        const ca = center(cards.find((card) => card.id === a)!);
        const cb = center(cards.find((card) => card.id === b)!);
        return { dx: cb.x - ca.x, dy: cb.y - ca.y };
      });
    const w = vectors(wide);
    const p = vectors(phone);
    /* Every vector between two districts is the same vector, scaled by one number. */
    const ratio = Math.hypot(p[0]!.dx, p[0]!.dy) / Math.hypot(w[0]!.dx, w[0]!.dy);
    for (let i = 0; i < pairs.length; i++) {
      expect(p[i]!.dx).toBeCloseTo(w[i]!.dx * ratio, 3);
      expect(p[i]!.dy).toBeCloseTo(w[i]!.dy * ratio, 3);
    }
    /* Not the ring's stretch: the aspect of the map is the lattice's. */
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(1);
  });

  it("draws the lower rows nearer, with the depth number every plane style reads", () => {
    const cards = districts(1280, 800);
    const lowest = [...cards].sort((a, b) => b.y - a.y)[0]!;
    const highest = [...cards].sort((a, b) => a.y - b.y)[0]!;
    expect(lowest.depth).toBeLessThan(highest.depth!);
    expect(lowest.depth).toBeCloseTo(1 - 1 * 0.65, 5);
    expect(highest.depth).toBeCloseTo(1, 5);
    expect(lowest.width).toBeGreaterThan(highest.width);
  });

  it("keeps the plot through interpolate.mix mid-tween", () => {
    const below = layout(graph(), schema, EMPTY_VIEW, { width: 1280, height: 800 });
    const above = layout(graph(), schema, overview, { width: 1280, height: 800 });
    const half = interpolate(below, above, 0.5);
    const card = half.nodes.find((node) => node.id === kindCardId("week"))!;
    expect(card.plot).toEqual(above.nodes.find((node) => node.id === kindCardId("week"))!.plot);
    expect(half.city).toEqual(above.city);
  });

  it("bounds the camera by the map rather than a fraction of the canvas when the city is bigger", () => {
    const fits = layout(graph(), schema, overview, { width: 1280, height: 800 });
    expect(cameraLimit(fits)).toEqual({ x: 1280 * 0.45, y: 800 * 0.45 });
    const opened = layout(graph(), schema, toggleExpanded(overview, kindCardId("person")), { width: 390, height: 300, unit: 24 });
    const limit = cameraLimit(opened);
    const extent = opened.city!.extent;
    expect(limit.x).toBeGreaterThanOrEqual(extent.x + extent.width - 390);
    expect(limit.x).toBeGreaterThanOrEqual(-extent.x);
    expect(cameraLimit({ width: 500, height: 300 })).toEqual({ x: 225, y: 135 });
  });

  it("is a pure placer: the same cards, the same schema, the same picture", () => {
    const cards = [
      { id: "kind:week", kind: "week", count: 1, opened: 0 },
      { id: "kind:duty", kind: "duty", count: 1, opened: 0 },
    ];
    const a = placeCity(cards, schema, { width: 200, height: 80 }, { width: 900, height: 600 });
    const b = placeCity(cards, schema, { width: 200, height: 80 }, { width: 900, height: 600 });
    expect(a).toEqual(b);
    expect(a.placed.map((card) => card.plot)).toEqual([...a.map.values()].filter((plot) => plot.col !== undefined).slice(0, 2).length === 2 ? a.placed.map((card) => a.map.get(card.id.slice(5))!) : []);
  });
});

describe("the marquee takes the room its names take", () => {
  it("is a line a showing, and more for a name too long for one (FR-118)", async () => {
    const { marqueeHeightFor } = await import("../../src/layout.js");
    // A name is a fingertip tall however short; one longer than the column wraps onto more lines rather than being cut.
    const one = marqueeHeightFor(["The week"], 132);
    const three = marqueeHeightFor(["The quarter", "The fortnight", "The week"], 132);
    const long = marqueeHeightFor(["What the slices of the founder's load call for"], 132);
    expect(one).toBe(10 + 24);
    expect(three).toBe(10 + 3 * 24 + 2 * 2);
    expect(long).toBe(10 + 3 * 16 + 6);
    expect(marqueeHeightFor([], 132)).toBe(0);
  });

  /*
   * A name sized for an average letter is a line short in a wide face: the
   * room under the signpost is sized from the names as they are drawn, when
   * the page can measure them, and never comes out under the estimate.
   */
  it("takes the lines a wide face wraps a name onto, measured, and never fewer than the estimate", async () => {
    const { marqueeHeightFor } = await import("../../src/layout.js");
    const name = "Where the work goes"; // 19 letters: one line at 7.1 px a letter
    const average = (text: string) => text.length * 7.1;
    const wide = (text: string) => text.length * 10; // a wide display face
    const narrow = (text: string) => text.length * 4;
    expect(marqueeHeightFor([name], 132)).toBe(10 + 24);
    expect(marqueeHeightFor([name], 132, average)).toBe(10 + 24);
    // "Where the work" is 140 px, past the 138 the column holds: two lines, at the marquee's 16.25 px line.
    expect(marqueeHeightFor([name], 132, wide)).toBe(10 + Math.ceil(2 * 16.25) + 6);
    expect(marqueeHeightFor([name, name, name], 132, wide)).toBe(10 + 3 * (Math.ceil(2 * 16.25) + 6) + 2 * 2);
    // Words break where the browser breaks them: three short words that each fit, but not together.
    expect(marqueeHeightFor(["aaaaaaaaaa bbbbbbbbbb"], 132, wide)).toBe(10 + Math.ceil(2 * 16.25) + 6);
    // A word wider than the column breaks anywhere, onto as many lines as it needs.
    expect(marqueeHeightFor(["x".repeat(30)], 132, wide)).toBe(10 + Math.ceil(3 * 16.25) + 6);
    // A narrow face never takes fewer lines than the estimate (the pixel is the measured line, 16.25 not 16).
    expect(marqueeHeightFor(["What the slices of the founder's load call for"], 132, narrow)).toBe(marqueeHeightFor(["What the slices of the founder's load call for"], 132) + 1);
  });
});

describe("zooming by hand", () => {
  it("keeps the point under the pointer still: the pan moves against the scaling about the center", () => {
    const center = { x: 800, y: 470 };
    const camera = { x: -120, y: 40 };
    const pan = { x: 30, y: -10 };
    const pointer = { x: 1100, y: 700 };
    const ratio = 1.5;
    const next = panForZoom(pan, camera, pointer, center, ratio);
    // The city point under the pointer, before and after, in the city's own (unscaled) frame.
    const before = { x: (pointer.x - pan.x - camera.x - center.x), y: (pointer.y - pan.y - camera.y - center.y) };
    const after = { x: (pointer.x - next.x - camera.x - center.x) / ratio, y: (pointer.y - next.y - camera.y - center.y) / ratio };
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    // Zooming about the center itself moves nothing.
    expect(panForZoom(pan, camera, { x: center.x + pan.x + camera.x, y: center.y + pan.y + camera.y }, center, 2)).toEqual(pan);
  });
});
