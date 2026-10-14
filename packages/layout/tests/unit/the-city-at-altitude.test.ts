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
    expect(cards.find((card) => card.id === kindCardId("week"))!.plot).toEqual({ col: 0, row: 0, side: 2 });
    /* Two people: still the least side, two. */
    expect(cards.find((card) => card.id === kindCardId("person"))!.plot!.side).toBe(2);
  });

  it("has the same shape at 1280 and at 640: one scale, one translate", () => {
    const wide = districts(1280, 800);
    const phone = districts(640, 420);
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
  });

  it("reads upstream to downstream along the ground's axis, up and to the right in a wide window, and in order in a tall one", () => {
    const at = (cards: ReturnType<typeof districts>, kind: string) => {
      const card = cards.find((one) => one.id === kindCardId(kind))!;
      return { x: card.x + card.width / 2, y: card.y + card.height / 2 };
    };
    // A person does a duty, a duty is in a week: week, duty, person.
    const wide = districts(1280, 800);
    expect(at(wide, "week").x).toBeLessThan(at(wide, "duty").x);
    expect(at(wide, "duty").x).toBeLessThan(at(wide, "person").x);
    expect(at(wide, "week").y).toBeGreaterThan(at(wide, "duty").y);
    expect(at(wide, "duty").y).toBeGreaterThan(at(wide, "person").y);
    // In a tall window, whichever way stands the city larger — down, or still up and to the right — in order along it.
    const tall = districts(390, 640);
    const step = (a: string, b: string) => ({ x: at(tall, b).x - at(tall, a).x, y: at(tall, b).y - at(tall, a).y });
    const first = step("week", "duty");
    const second = step("duty", "person");
    expect(first.x * second.x + first.y * second.y).toBeGreaterThan(0);
    // The note is tied to nothing: in the margin, under the rest.
    for (const kind of ["week", "duty", "person"]) expect(at(wide, "note").y, kind).toBeGreaterThan(at(wide, kind).y);
  });

  it("opens with every district and its name inside the window, clear of the chrome in its corner", () => {
    const chrome = { x: 1280 - 176, y: 0, width: 176, height: 100 };
    for (const [width, height] of [[1280, 800], [390, 640]] as const) {
      const result = layout(graph(), schema, overview, { width, height, cityOrder: ["week", "duty", "person", "note"], chrome: [{ ...chrome, x: width - 176 }] });
      for (const card of result.nodes.filter((node) => node.plot)) {
        expect(card.x, `${width}: ${card.id}`).toBeGreaterThanOrEqual(0);
        expect(card.y, `${width}: ${card.id}`).toBeGreaterThanOrEqual(0);
        expect(card.x + card.width, `${width}: ${card.id}`).toBeLessThanOrEqual(width);
        expect(card.y + card.height, `${width}: ${card.id}`).toBeLessThanOrEqual(height);
        const inCorner = card.x + card.width > width - 176 && card.y < 100;
        expect(inCorner, `${width}: ${card.id} under the corner's chrome`).toBe(false);
      }
      const extent = result.city!.extent;
      expect(extent.x).toBeGreaterThanOrEqual(0);
      expect(extent.x + extent.width).toBeLessThanOrEqual(width);
    }
  });

  it("fits the city in what a floating panel leaves, while the scene stays the whole box", () => {
    const whole = layout(graph(), schema, overview, { width: 1280, height: 800, cityOrder: ["week", "duty", "person", "note"] });
    const docked = layout(graph(), schema, overview, { width: 1280, height: 800, cityOrder: ["week", "duty", "person", "note"], dock: { right: 500 } });
    // The painted scene is the whole width; what the reader sees is what the panel leaves.
    expect(docked.width).toBe(1280);
    expect(docked.visible).toEqual({ width: 780, height: 800 });
    expect(whole.visible).toBeUndefined();
    for (const card of docked.nodes.filter((node) => node.plot)) expect(card.x + card.width, card.id).toBeLessThanOrEqual(780);
    // The camera's bounds and the edge signs are for the visible part.
    expect(cameraLimit(docked).x).toBeLessThan(cameraLimit(whole).x);
    // A phone's sheet takes from the foot.
    const sheet = layout(graph(), schema, overview, { width: 390, height: 844, cityOrder: ["week", "duty", "person", "note"], dock: { bottom: 380 } });
    expect(sheet.height).toBe(844);
    expect(sheet.visible).toEqual({ width: 390, height: 464 });
    for (const card of sheet.nodes.filter((node) => node.plot)) expect(card.y + card.height, card.id).toBeLessThanOrEqual(464);
    // And no dock means no dock, off altitude too.
    expect(layout(graph(), schema, { ...overview, overview: false }, { width: 1280, height: 800, dock: { right: 500 } }).visible).toBeUndefined();
  });

  it("caps a plot's side, so a kind of hundreds stands on three cells as a kind of five does", () => {
    const many = Graph.from(schema, {
      nodes: [
        ...Array.from({ length: 300 }, (_, i) => ({ id: `p${i}`, kind: "person", label: `P${i}` })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, kind: "duty", label: `D${i}` })),
      ] as never,
      edges: [],
    });
    const cards = layout(many, schema, overview, { width: 1280, height: 800 }).nodes.filter((node) => node.plot);
    const side = (kind: string) => cards.find((card) => card.id === kindCardId(kind))!.plot!.side;
    expect(side("person")).toBe(3);
    expect(side("duty")).toBe(3);
    expect(side("week")).toBe(2);
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

  it("starts closer where its names cannot all be said in the window, says every one under its own district, and keeps the chosen one in sight", () => {
    const wide = { width: 180, height: 22, short: { width: 180, height: 22 } };
    const cards = ["week", "duty", "person", "note"].map((kind) => ({ id: kindCardId(kind), kind, count: 3, opened: 0, nameplate: wide }));
    const phone = { width: 200, height: 400 };
    const whole = placeCity(cards, schema, phone);
    const said = whole.placed.filter((card) => card.nameplate !== "none");
    expect(said).toHaveLength(cards.length);
    expect(said.every((card) => card.nameplate === "full" || card.nameplate === "short")).toBe(true);
    // Past the window somewhere: the camera came closer rather than leave a district unnamed.
    const past = (card: (typeof whole.placed)[number]) => card.x < 0 || card.y < 0 || card.x + card.width > phone.width || card.y + card.height > phone.height;
    const outside = whole.placed.filter(past);
    expect(outside.length).toBeGreaterThan(0);
    const chosen = outside[0]!;
    const kept = placeCity(cards, schema, phone, {}, { keep: [chosen.id.slice(5)] }).placed.find((card) => card.id === chosen.id)!;
    expect(past(kept)).toBe(false);
  });

  it("is a pure placer: the same cards, the same schema, the same picture", () => {
    const cards = [
      { id: "kind:week", kind: "week", count: 1, opened: 0 },
      { id: "kind:duty", kind: "duty", count: 1, opened: 0 },
    ];
    const a = placeCity(cards, schema, { width: 900, height: 600 });
    const b = placeCity(cards, schema, { width: 900, height: 600 });
    expect(a).toEqual(b);
    expect(a.placed.map((card) => card.plot)).toEqual([...a.map.values()].filter((plot) => plot.col !== undefined).slice(0, 2).length === 2 ? a.placed.map((card) => a.map.get(card.id.slice(5))!) : []);
  });
});

describe("the marquee takes the room its names take", () => {
  it("is a line a showing, and more for a name too long for one (FR-118)", async () => {
    const { marqueeHeightFor } = await import("../../src/layout.js");
    // A name is a fingertip tall as drawn (27 at its plane's 0.9 is 24) however short; one longer than the column wraps onto more lines rather than being cut.
    const one = marqueeHeightFor(["The week"], 132);
    const three = marqueeHeightFor(["The quarter", "The fortnight", "The week"], 132);
    const long = marqueeHeightFor(["What the slices of the founder's load call for"], 132);
    expect(one).toBe(10 + 27);
    expect(three).toBe(10 + 3 * 27 + 2 * 2);
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
    expect(marqueeHeightFor([name], 132)).toBe(10 + 27);
    expect(marqueeHeightFor([name], 132, average)).toBe(10 + 27);
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
