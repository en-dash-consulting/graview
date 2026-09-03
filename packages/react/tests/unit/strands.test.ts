import { describe, expect, it } from "vitest";
import { clipQuadratic, connectorStrands, type SceneNode } from "../../src/index.js";

/**
 * How a connector becomes the lines actually drawn — the part that has no
 * DOM to measure, which is every headless render and the fallback for every
 * browser one. The member anchoring itself needs a browser and is held by
 * the apps' harnesses; what is held here is that without one, nothing is
 * unpicked, nothing is lost, and the geometry is exact.
 */

const node = (id: string, x: number, y: number, plane: 0 | 1 | 2, extra: Partial<SceneNode> = {}): SceneNode =>
  ({ id, kind: "k", plane, x, y, width: 100, height: 60, pinned: false, opacity: 1, ...extra }) as SceneNode;

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe("connectorStrands", () => {
  const nodes = [
    node("week", 0, 0, 0, { aggregate: { kind: "s", memberIds: ["tue", "thu"], label: "Sessions" } }),
    node("d-a", 0, 300, 1),
    node("d-b", 200, 300, 1),
  ];
  const connector = (id: string, to: string, edges: { from: string; to: string }[]) => ({
    id,
    kind: "includes",
    from: "week",
    to,
    edges,
    ...(edges.length === 1 ? { single: edges[0] } : {}),
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  });

  it("keeps a bundle together when nothing draws its members", () => {
    const strands = connectorStrands(
      nodes,
      [connector("includes:week:d-a", "d-a", [{ from: "tue", to: "d-a" }, { from: "thu", to: "d-a" }])],
      null,
      false,
      "light",
    );
    expect(strands).toHaveLength(1);
    expect(strands[0]!.edges).toHaveLength(2);
    expect(strands[0]!.fromAnchor).toBe("week");
    expect(strands[0]!.toAnchor).toBe("d-a");
    // Every other drawn box is something the line must dive under.
    expect(strands[0]!.obstacles).toHaveLength(1);
  });

  it("drops a line whose end is not drawn, and a line into a receded group", () => {
    const strands = connectorStrands(
      [...nodes, node("kind:x", 400, 400, 2, { aggregate: { kind: "x", memberIds: ["q"], label: "X" } })],
      [
        connector("includes:week:nowhere", "nowhere", [{ from: "tue", to: "nowhere" }]),
        connector("includes:week:kind:x", "kind:x", [{ from: "tue", to: "q" }]),
      ],
      null,
      false,
      "light",
    );
    expect(strands).toEqual([]);
  });

  it("never unpicks from altitude", () => {
    const strands = connectorStrands(
      nodes,
      [connector("includes:week:d-a", "d-a", [{ from: "tue", to: "d-a" }, { from: "thu", to: "d-a" }])],
      null,
      true,
      "light",
    );
    expect(strands).toHaveLength(1);
    expect(strands[0]!.key).toBe("includes:week:d-a");
  });
});

describe("clipQuadratic", () => {
  const straight = { p0: { x: 0, y: 50 }, c: { x: 200, y: 50 }, p1: { x: 400, y: 50 } };

  it("cuts the run out of the box it starts in and into the box it ends in", () => {
    const [run, ...rest] = clipQuadratic(straight, [box(-50, 0, 100, 100), box(350, 0, 100, 100)]);
    expect(rest).toEqual([]);
    expect(run!.p0.x).toBeCloseTo(50, 0);
    expect(run!.p1.x).toBeCloseTo(350, 0);
    expect(run!.p0.y).toBeCloseTo(50, 5);
  });

  it("splits around a card the line merely crosses", () => {
    const runs = clipQuadratic(straight, [box(150, 0, 100, 100)]);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.p0.x).toBe(0);
    expect(runs[0]!.p1.x).toBeCloseTo(150, 0);
    expect(runs[1]!.p0.x).toBeCloseTo(250, 0);
    expect(runs[1]!.p1.x).toBe(400);
  });

  it("is the same curve, in pieces", () => {
    const bowed = { p0: { x: 0, y: 0 }, c: { x: 200, y: 300 }, p1: { x: 400, y: 0 } };
    const [run] = clipQuadratic(bowed, [box(-20, -20, 60, 60)]);
    // The piece's midpoint lies on the original curve: evaluate both.
    const at = (q: typeof bowed, t: number) => ({
      x: (1 - t) ** 2 * q.p0.x + 2 * (1 - t) * t * q.c.x + t * t * q.p1.x,
      y: (1 - t) ** 2 * q.p0.y + 2 * (1 - t) * t * q.c.y + t * t * q.p1.y,
    });
    const mid = at(run!, 0.5);
    // Find the parameter on the original nearest that point.
    let best = Infinity;
    for (let t = 0; t <= 1; t += 0.0005) {
      const p = at(bowed, t);
      best = Math.min(best, Math.hypot(p.x - mid.x, p.y - mid.y));
    }
    expect(best).toBeLessThan(0.5);
  });

  it("has nothing to show for a line entirely inside a box", () => {
    expect(clipQuadratic(straight, [box(-10, 0, 500, 100)])).toEqual([]);
  });
});
