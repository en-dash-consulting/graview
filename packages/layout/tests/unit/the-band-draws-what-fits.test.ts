import { createSchema, defineNode, Graph, isoDate, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { bandCaps, bandOf, chooseGrouping, EMPTY_VIEW, layout, packRuns, shares, toggleExpanded, type BandItem } from "../../src/index.js";

/**
 * THE BAND DRAWS WHAT A PERSON CAN READ (docs/scale.md). Below its budget
 * nothing changes; above it each relation stands whole, groups by its own
 * declaration, or keeps its most relevant and one door — in the relation's
 * own order, with true counts, opened by the `expanded` stop.
 */
const artist = defineNode("artist", { fields: z.object({ label: z.string() }), plural: "Artists" });
const album = defineNode("album", {
  fields: z.object({ label: z.string(), type: z.enum(["album", "ep", "single"]), released: isoDate.optional() }),
  edges: { "released-by": { to: ["artist"], description: "whose release it is", inverse: "their releases" } },
  plural: "Albums",
});
const song = defineNode("song", {
  fields: z.object({ label: z.string() }),
  edges: {
    by: { to: ["artist"], description: "whose song it is", inverse: "their songs" },
    features: { to: ["artist"], description: "who it features", inverse: "the songs they are on" },
  },
  plural: "Songs",
});
const schema = createSchema([artist, album, song]);
const types = ["album", "ep", "single"] as const;
const nodes = [
  { id: "hub", kind: "artist", label: "Hub" },
  { id: "guest", kind: "artist", label: "Guest" },
  ...Array.from({ length: 30 }, (_, i) => ({ id: `al-${String(i).padStart(2, "0")}`, kind: "album", label: `Album ${i}`, type: types[i % 3], released: `${2000 + i}-01-01` })),
  ...Array.from({ length: 60 }, (_, i) => ({ id: `s-${String(i).padStart(2, "0")}`, kind: "song", label: `Song ${i}` })),
];
const edges = [
  ...Array.from({ length: 30 }, (_, i) => ({ kind: "released-by", from: `al-${String(i).padStart(2, "0")}`, to: "hub" })),
  ...Array.from({ length: 60 }, (_, i) => ({ kind: "by", from: `s-${String(i).padStart(2, "0")}`, to: "hub" })),
  { kind: "features", from: "s-01", to: "guest" },
];
const graph = Graph.from(schema, { nodes, edges } as never);
const related = (kinds?: string[]) =>
  graph.allEdges()
    .filter((edge) => edge.to === "hub" && (!kinds || kinds.includes(edge.kind)))
    .map((edge) => ({ node: graph.getNode(edge.from)!, via: { edgeKind: edge.kind, direction: "in" as const } }));
const band = (budget: number, extra: Partial<Parameters<typeof bandOf>[1]> = {}) =>
  bandOf(related(), { schema, graph, budget, focusId: "hub", expanded: new Set(), plural: (kind) => schema.tryDefinition(kind)?.plural ?? kind, ...extra });
const ids = (items: readonly BandItem<{ id: string; kind: string }>[]) => items.map((item) => item.id);

describe("the band's budget", () => {
  it("draws every related node, as today, when they fit", () => {
    expect(band(100)).toHaveLength(90);
    expect(band(100).every((item) => !item.aggregate)).toBe(true);
  });

  it("gives a small relation all of itself and the big ones the rest", () => {
    expect(shares([3, 500, 40], 12)).toEqual([3, 5, 4]);
    expect(shares([1, 1], 1)).toEqual([1, 1]);
  });

  it("groups releases by what their declaration offers, never by the relation itself", () => {
    const albums = related(["released-by"]).map((entry) => entry.node);
    const grouping = chooseGrouping(albums, 6, { schema, graph, exclude: "released-by" });
    expect(grouping?.by).toBe("type");
    expect(grouping?.groups.map((group) => group.nodes.length)).toEqual([10, 10, 10]);
  });

  it("over budget: groups with true counts, and the rest behind one door filtered by the relation", () => {
    const drawn = band(8);
    expect(drawn.length).toBeLessThanOrEqual(8);
    const groups = drawn.filter((item) => item.aggregate?.opens?.in === "place");
    expect(groups.map((item) => item.aggregate!.label)).toEqual(["Album", "Ep", "Single"]);
    expect(groups.map((item) => item.aggregate!.memberIds.length)).toEqual([10, 10, 10]);
    const door = drawn.find((item) => item.aggregate?.opens?.in === "picture")!;
    expect(door.aggregate!.opens).toEqual({ in: "picture", focus: "aggregate:song", within: { filter: "by:hub" } });
    // Every related node is on the band or counted behind a card of it.
    const accounted = drawn.reduce((sum, item) => sum + (item.aggregate ? item.aggregate.memberIds.length : 1), 0);
    expect(accounted).toBe(90);
  });

  it("stands the relevant before the rest, in the relation's own order", () => {
    const drawn = band(8, { selection: ["s-40"], relevance: { hits: new Set(["s-07"]) } });
    const songs = drawn.filter((item) => !item.aggregate && item.kind === "song").map((item) => item.id);
    expect(songs).toContain("s-40");
    expect(songs).toContain("s-07");
    // Picked by relevance, drawn in order: s-07 before s-40.
    expect(songs.indexOf("s-07")).toBeLessThan(songs.indexOf("s-40"));
  });

  it("opens a group in place as the expanded stop, its members within the room", () => {
    const closed = band(8);
    const single = closed.find((item) => item.aggregate?.label === "Single")!;
    const open = band(8, { expanded: new Set([single.id]) });
    expect(ids(open)).not.toContain(single.id);
    const members = open.filter((item) => item.kind === "album" && !item.aggregate);
    expect(members.length).toBeGreaterThan(0);
    // Too many to stand: the rest are behind a door narrowed by the group too.
    const door = open.find((item) => item.aggregate?.opens?.in === "picture" && item.kind === "album");
    expect(door?.aggregate?.opens).toMatchObject({ within: { filter: "released-by:hub,type:single" } });
  });

  it("opens a card of one kind in place, where a relation holds several kinds", () => {
    const tag = defineNode("tag", { fields: z.object({ label: z.string() }), plural: "Tags" });
    const note = defineNode("note", { fields: z.object({ label: z.string() }), edges: { tagged: { to: ["tag"], description: "what it is tagged", inverse: "what is tagged it" } }, plural: "Notes" });
    const link = defineNode("link", { fields: z.object({ label: z.string() }), edges: { tagged: { to: ["tag"], description: "what it is tagged", inverse: "what is tagged it" } }, plural: "Links" });
    const mixed = createSchema([tag, note, link]);
    const many = Graph.from(mixed, {
      nodes: [
        { id: "t", kind: "tag", label: "T" },
        ...Array.from({ length: 20 }, (_, i) => ({ id: `n-${i}`, kind: "note", label: `Note ${i}` })),
        ...Array.from({ length: 20 }, (_, i) => ({ id: `l-${i}`, kind: "link", label: `Link ${i}` })),
      ],
      edges: [...Array.from({ length: 20 }, (_, i) => ({ kind: "tagged", from: `n-${i}`, to: "t" })), ...Array.from({ length: 20 }, (_, i) => ({ kind: "tagged", from: `l-${i}`, to: "t" }))],
    } as never);
    const run = many.allEdges().map((edge) => ({ node: many.getNode(edge.from)!, via: { edgeKind: edge.kind, direction: "in" as const } }));
    const options = { schema: mixed, graph: many, budget: 6, focusId: "t", plural: (kind: string) => mixed.tryDefinition(kind)?.plural ?? kind };
    const closed = bandOf(run, { ...options, expanded: new Set() });
    const notes = closed.find((item) => item.aggregate?.label === "Notes")!;
    expect(notes.aggregate?.opens).toEqual({ in: "place" });
    const open = bandOf(run, { ...options, expanded: new Set([notes.id]) });
    // Pressed, the card gives its place to its members — the stop changed, so must the band.
    expect(ids(open)).not.toContain(notes.id);
    expect(open.filter((item) => item.kind === "note" && !item.aggregate).length).toBeGreaterThan(0);
    expect(ids(open)).toContain(closed.find((item) => item.aggregate?.label === "Links")!.id);
  });

  it("never lets the band wrap past the rows a chip fits in a laid-out stop", () => {
    const stop = { ...EMPTY_VIEW, focusId: "hub" };
    const drawn = layout(graph, schema, stop, { width: 1200, height: 760 });
    const band1 = drawn.nodes.filter((node) => node.plane === 1);
    // Fewer cards than related nodes, none shorter than a chip, every node on a card or counted behind one.
    expect(band1.length).toBeLessThan(90);
    expect(band1.every((node) => node.height >= 26)).toBe(true);
    expect(band1.reduce((sum, node) => sum + (node.aggregate ? node.aggregate.memberIds.length : 1), 0)).toBe(90);
    const group = band1.find((node) => node.aggregate?.opens?.in === "place")!;
    const opened = layout(graph, schema, toggleExpanded(stop, group.id), { width: 1200, height: 760 });
    expect(opened.nodes.filter((node) => node.plane === 1).every((node) => node.height >= 26)).toBe(true);
  });
});

describe("a crowded band is laid out by relation", () => {
  it("starts a relation on its own row unless all of it fits the rest of the row", () => {
    expect(packRuns([5, 5, 5], 5)).toEqual([[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2]]);
    expect(packRuns([3, 2, 4], 5)).toEqual([[0, 0, 0, 1, 1], [2, 2, 2, 2]]);
    expect(packRuns([3, 3], 5)).toEqual([[0, 0, 0], [1, 1, 1]]);
  });

  it("gives each relation what the rows can hold, packed", () => {
    const caps = bandCaps([800, 330, 130, 3], 5, 3);
    expect(packRuns(caps, 5).length).toBeLessThanOrEqual(3);
    expect(caps.every((cap) => cap >= 1)).toBe(true);
    expect(caps[3]).toBe(3);
  });

  it("does not group a relation by what nearly all of it shares", () => {
    const lopsided = [...related(["by"]).map((entry) => entry.node)];
    // Every song is by the hub: a grouping by it would be one group of everything.
    expect(chooseGrouping(lopsided, 6, { schema, graph })?.by).not.toBe("by");
  });

  it("draws each relation's rows as tall as a group card, with a caption's gutter between them", () => {
    const stop = { ...EMPTY_VIEW, focusId: "hub" };
    const drawn = layout(graph, schema, stop, { width: 1200, height: 760 });
    const band1 = drawn.nodes.filter((node) => node.plane === 1);
    const rows = [...new Set(band1.map((node) => Math.round(node.y)))].sort((a, b) => a - b);
    expect(band1.every((node) => node.height >= 52)).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i]! - rows[i - 1]! - band1[0]!.height).toBeGreaterThanOrEqual(21);
    // No row holds the end of one relation and the start of another that does not fit whole.
    for (const y of rows) {
      const inRow = band1.filter((node) => Math.round(node.y) === y).sort((a, b) => a.x - b.x);
      const runs = inRow.map((node) => node.via?.edgeKind);
      expect(runs).toEqual([...runs].sort((a, b) => runs.indexOf(a) - runs.indexOf(b)));
    }
  });
});
