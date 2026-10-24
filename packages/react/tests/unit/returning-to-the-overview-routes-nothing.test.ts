import { createSchema, defineNode, z } from "@graview/core";
import { cityMap, toIso } from "@graview/core/scene";
import { describe, expect, it } from "vitest";
import { groundOf, routeBetweenFrames, routeOnTheGround, routesFor, routesRemembered, routesSeen, routingsSoFar, type Box, type PlotLike } from "../../src/ribbons.js";

/*
 * RETURNING TO THE OVERVIEW ROUTES NOTHING (Roadmap
 * request:gv-scene-ribbon-routing-blocks). An app of twenty-five kinds froze
 * for a second and a half each time it came back to the whole map: every
 * ribbon was routed again on the main thread, several times a transition,
 * and each step of each search asked every plot and every name card again.
 * A picture already routed is now answered from what it was given, and a
 * picture not yet routed is routed in a small part of what it took.
 */
const KINDS = 25;
const names = Array.from({ length: KINDS }, (_, i) => `k${String(i).padStart(2, "0")}`);
const schema = createSchema(
  names.map((name, i) =>
    defineNode(name, {
      fields: z.object({ name: z.string() }),
      plural: name,
      edges: Object.fromEntries([1, 3, 7].map((d) => [`to${d}`, { to: [names[(i + d) % KINDS]!], description: `to ${d}` }])),
    }),
  ) as never,
);
// The map as the city lays twenty-five districts out in a tall window, folded into bands, most of them full.
const plots: ReadonlyMap<string, PlotLike> = cityMap(schema as never, { upright: true, counts: Object.fromEntries(names.map((name, i) => [name, i % 3 === 0 ? 2 : 30])) });
const cell = 22;
const labels: Box[] = [...plots.values()].map((plot) => {
  const front = toIso(plot.col + plot.side, plot.row + plot.side, cell);
  return { x: front.x - 55, y: front.y + 2, width: 110, height: 26 };
});
const ribbons = names.flatMap((name, i) => [1, 3, 7].map((d) => ({ key: `${name}-${d}`, from: name, to: names[(i + d) % KINDS]!, width: 2 + (i % 7) })));

/*
 * HOW MUCH SLOWER THIS MACHINE IS than the one the budget was set on, by a
 * fixed piece of work timed the same way (the best of five): a CI runner is
 * held to the same claim, not to a laptop's milliseconds.
 */
// The reference is script work like the router's — numbers made, kept in an array and sorted by a comparator — so a busy machine slows both alike; a typed array's native sort did not slow with it.
const REFERENCE_MS = 28;
function machineFactor(): number {
  const began = performance.now();
  const values: number[] = [];
  let seed = 7;
  for (let i = 0; i < 100_000; i++) values.push((seed = (seed * 16807) % 2147483647));
  values.sort((a, b) => a - b);
  return Math.max(1, (performance.now() - began) / REFERENCE_MS);
}
const bestOf = (times: number, run: () => void) => {
  let best = Infinity;
  for (let round = 0; round < times; round++) {
    const began = performance.now();
    run();
    best = Math.min(best, performance.now() - began);
  }
  return best;
};

describe("returning to the overview routes nothing", () => {
  it("routes twenty-five districts' seventy-five ribbons within a few frames, where it took a quarter of a second", () => {
    /*
     * Measured on the machine the budget was set on (Apple M-series, Node 22):
     * 250–310 ms before, 35–40 ms after, the reference 28 ms. Held to
     * 100 ms, stretched by how much slower this machine is: the reference
     * and the routing timed turn about, and the best of five pairs kept,
     * so a busy machine slows both alike.
     */
    let best = { ms: Infinity, factor: 1 };
    for (let round = 0; round < 5; round++) {
      const factor = machineFactor();
      const ms = bestOf(1, () => routeOnTheGround({ ribbons, plots, cell, labels }));
      if (ms / factor < best.ms / best.factor) best = { ms, factor };
    }
    expect(best.ms, `routed in ${best.ms.toFixed(1)} ms on a machine ${best.factor.toFixed(2)}× the reference`).toBeLessThan(100 * best.factor);
    // Every ribbon still finds its way: faster is not fewer.
    expect(routeOnTheGround({ ribbons, plots, cell, labels }).size).toBe(ribbons.length);
  });

  it("answers a picture already routed with the routes it was given, after another picture between", () => {
    const before = routingsSoFar();
    const overview = routesFor({ ribbons, plots, cell, labels });
    expect(routingsSoFar()).toBe(before + 1);
    // Somewhere else: another place's map, at another size.
    routesFor({ ribbons: ribbons.slice(0, 10), plots, cell: 30, labels: [] });
    expect(routingsSoFar()).toBe(before + 2);
    // Back to the whole thing: nothing routed, the same routes.
    expect(routesFor({ ribbons, plots, cell, labels })).toBe(overview);
    expect(routingsSoFar()).toBe(before + 2);
    // Name cards measured a fraction of a pixel apart are the same cards.
    expect(routesFor({ ribbons, plots, cell, labels: labels.map((box) => ({ ...box, x: box.x + 0.2 })) })).toBe(overview);
    expect(routingsSoFar()).toBe(before + 2);
  });

  it("routes again for anything a route follows from: a wider ribbon, a moved plot, a card, the cell, the tilt", () => {
    const base = { ribbons: ribbons.slice(0, 6), plots, cell, labels };
    routesFor(base);
    const before = routingsSoFar();
    const moved = new Map(plots);
    moved.set(names[1]!, { ...plots.get(names[1]!)!, side: 2 });
    routesFor({ ...base, ribbons: base.ribbons.map((ribbon, i) => (i === 0 ? { ...ribbon, width: ribbon.width + 3 } : ribbon)) });
    routesFor({ ...base, plots: moved });
    routesFor({ ...base, labels: labels.slice(1) });
    routesFor({ ...base, cell: cell + 1 });
    routesFor({ ...base, tilt: 1 });
    expect(routingsSoFar()).toBe(before + 5);
  });

  it("routes a picture not seen before between frames, a slice at a time, to the routes it would have had at once", async () => {
    // Another size of the same map: not routed yet.
    const asked = { ribbons, plots, cell: 17, labels };
    expect(routesRemembered(asked)).toBeUndefined();
    const slices: number[] = [];
    const realTimeout = globalThis.setTimeout;
    let began = performance.now();
    const landed = await new Promise<ReadonlyMap<string, unknown>>((resolve) => {
      routeBetweenFrames(asked, resolve, 8);
      // Each slice runs as a task of its own: what passes between two is a frame's chance to draw.
      const watch = () => {
        slices.push(performance.now() - began);
        began = performance.now();
        realTimeout(watch, 0);
      };
      realTimeout(watch, 0);
    });
    expect(slices.length).toBeGreaterThan(1);
    expect([...landed]).toEqual([...routeOnTheGround(asked)]);
    // And then it is remembered: shown again, nothing is routed.
    expect(routesRemembered(asked)).toBe(landed);
  });

  it("stops routing a picture that changed before it landed", async () => {
    const asked = { ribbons, plots, cell: 19, labels };
    let told = false;
    const stop = routeBetweenFrames(asked, () => (told = true));
    stop();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(told).toBe(false);
    expect(routesRemembered(asked)).toBeUndefined();
  });

  it("draws the streets last routed for the same ground as the camera moves over them, and none for a ground never routed", () => {
    const asked = { ribbons: ribbons.slice(0, 8), plots, cell, labels };
    const runs = routesFor(asked);
    const ground = groundOf(asked);
    expect(routesSeen(ground, cell, 0.5)).toBe(runs);
    // Halfway in, at half the cell: the same streets, half the size — the ground under them scales the same way (`toIso`).
    const half = routesSeen(ground, cell / 2, 0.5)!;
    for (const [key, points] of runs) expect(half.get(key)).toEqual(points.map((p) => ({ x: p.x / 2, y: p.y / 2 })));
    // Seen from above, the ground is another shape: nothing until it is routed for it.
    expect(routesSeen(ground, cell, 1)).toBeUndefined();
    expect(routesSeen(groundOf({ ribbons: ribbons.slice(0, 3), plots }), cell, 0.5)).toBeUndefined();
  });
});
