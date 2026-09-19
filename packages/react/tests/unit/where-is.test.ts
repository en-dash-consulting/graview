import { describe, expect, it } from "vitest";
import { createPointerStore, latticePoints, whereIsIn } from "../../src/index.js";

/**
 * WHERE IS, AND WHO IS LISTENING.
 *
 * `whereIs` answers for a node, a kind, a group and a Place slug from the
 * frame being drawn, and a member not drawn itself answers as its nearest
 * drawn container. The pointer store runs a listener only while somebody
 * subscribes. And a road between two districts runs along the lattice's
 * own diagonals.
 */
const frame = {
  nodes: [
    { id: "kind:zone", kind: "zone", plane: 2, x: 100, y: 200, width: 200, height: 80, pinned: false, opacity: 1, aggregate: { kind: "zone", memberIds: ["lawn", "border"], label: "Zones" } },
    { id: "aggregate:zone", kind: "zone", plane: 0, x: 400, y: 100, width: 600, height: 300, pinned: false, opacity: 1, aggregate: { kind: "zone", memberIds: ["lawn", "border"], label: "Zones" } },
    { id: "lawn", kind: "zone", plane: 1, x: 10, y: 10, width: 50, height: 20, pinned: false, opacity: 1 },
  ],
} as never;
const views = { places: () => [{ kind: "zone", as: "the-grounds" }] };

describe("where is", () => {
  it("answers a drawn node with its box, scaled by its plane", () => {
    const box = whereIsIn(frame, null, "light", views, "lawn")!;
    expect(box.x).toBe(10);
    expect(box.width).toBeGreaterThan(0);
    expect(box.width).toBeLessThanOrEqual(50);
  });

  it("answers a kind, a group and a Place slug with the drawing that stands for them", () => {
    expect(whereIsIn(frame, null, "light", views, "kind:zone")!.x).toBe(100);
    expect(whereIsIn(frame, null, "light", views, "aggregate:zone")!.x).toBe(400);
    expect(whereIsIn(frame, null, "light", views, "the-grounds")!.x).toBe(400);
    /* A kind whose card is not in this frame answers as its group, and the other way round. */
    const cardOnly = { nodes: frame.nodes.filter((node: { id: string }) => node.id !== "aggregate:zone") } as never;
    expect(whereIsIn(cardOnly, null, "light", views, "aggregate:zone")!.x).toBe(100);
  });

  it("answers a member not drawn itself as its nearest drawn container", () => {
    /* The border is inside both the group (plane 0) and the district (plane 2): the nearer wins. */
    expect(whereIsIn(frame, null, "light", views, "border")!.x).toBe(400);
    expect(whereIsIn(frame, null, "light", views, "nobody")).toBeNull();
  });
});

describe("the audience strip", () => {
  it("answers screen:<kind> with the ground in front of the drive-in's screen, down to its nameplate", () => {
    const withScreen = {
      nodes: [
        ...(frame as { nodes: unknown[] }).nodes,
        { id: "aggregate:zone", kind: "zone", plane: 0, x: 120, y: 40, width: 300, height: 120, pinned: false, opacity: 1, screenOf: "zone", aggregate: { kind: "zone", memberIds: [], label: "Zones" } },
      ].filter((node: { id: string }) => node.id !== "aggregate:zone" || (node as { screenOf?: string }).screenOf === "zone"),
    } as never;
    const strip = whereIsIn(withScreen, null, "light", views, "screen:zone")!;
    expect(strip.x).toBe(120);
    expect(strip.width).toBeCloseTo(300, 0);
    expect(strip.y).toBeCloseTo(160, 0);
    /* Down to the nameplate at y 200. */
    expect(strip.height).toBeCloseTo(40, 0);
    expect(whereIsIn(frame, null, "light", views, "screen:zone")).toBeNull();
  });
});

describe("the pointer store", () => {
  it("is null until something subscribes, tells the scene on the first and last subscriber, and forgets the point when nobody listens", () => {
    const store = createPointerStore();
    const active: boolean[] = [];
    store.onActive((on) => active.push(on));
    expect(store.snapshot()).toBeNull();
    expect(store.listeners).toBe(0);
    let told = 0;
    const off1 = store.subscribe(() => (told += 1));
    const off2 = store.subscribe(() => (told += 1));
    expect(active).toEqual([true]);
    store.set({ x: 3, y: 4 });
    store.set({ x: 3, y: 4 });
    expect(told).toBe(2);
    expect(store.snapshot()).toEqual({ x: 3, y: 4 });
    off1();
    expect(active).toEqual([true]);
    off2();
    expect(active).toEqual([true, false]);
    expect(store.snapshot()).toBeNull();
  });
});

describe("a road along the lattice", () => {
  it("runs one leg on each diagonal and meets at an elbow, and needs none when the two are on one diagonal", () => {
    const [from, elbow, to] = latticePoints({ x: 0, y: 0 }, { x: 0, y: 40 });
    expect(from).toEqual({ x: 0, y: 0 });
    expect(to).toEqual({ x: 0, y: 40 });
    /* (0,0) → (40,20) along (2,1), then (40,20) → (0,40) along (−2,1). */
    expect(elbow).toEqual({ x: 40, y: 20 });
    expect(latticePoints({ x: 0, y: 0 }, { x: 40, y: 20 })).toHaveLength(2);
  });
});
