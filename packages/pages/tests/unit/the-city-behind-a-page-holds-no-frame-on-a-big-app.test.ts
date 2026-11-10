// @vitest-environment jsdom
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { routeBetweenFrames, routingsSoFar } from "@graview/react/ground";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { drawCity, type Seen } from "../../src/city-behind.js";
import { roomBeside } from "../../src/city-fit.js";
import { pageBox } from "../../src/step-back-geometry.js";

/**
 * THE CITY BEHIND A PAGE HOLDS NO FRAME ON A BIG APP (Graview HQ
 * feature:f-page-zooms-out-to-the-city). Stepping back drew the city and
 * routed its streets twice — the map run wide and run upright — on the main
 * thread, again on every change of the store, and again on every step back:
 * on twenty-five districts that held the page for a third of a second each
 * time, the freeze the scene was cured of when its streets came to be routed
 * between frames. Now the way the map runs is chosen from its plots alone,
 * no street is routed while the city is drawn, the one map drawn is routed
 * between frames and remembered, and the rest is kept for the store's
 * version: a step back draws in a few milliseconds, and a second one routes
 * nothing.
 */
const KINDS = 25;
const kinds = Array.from({ length: KINDS }, (_, i) =>
  defineNode(`k${i}`, {
    fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]) }),
    plural: `Kind ${i}s`,
    ...(i > 0 ? { edges: { after: { to: [`k${i - 1}`] } } } : {}),
  }),
);
const schema = createSchema(kinds as never);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename",
  input: z.object({ id: nodeRef(kinds.map((_, i) => `k${i}`) as never), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label } as never);
  },
} as never);

function big(each: number) {
  const nodes: Record<string, unknown>[] = [];
  const edges: Record<string, unknown>[] = [];
  for (let k = 0; k < KINDS; k++) {
    for (let n = 0; n < each; n++) {
      nodes.push({ id: `k${k}-${n}`, kind: `k${k}`, label: `Record ${n} of kind ${k}`, status: (["todo", "doing", "done"] as const)[n % 3] });
      if (k > 0) edges.push({ id: `e${k}-${n}`, kind: "after", from: `k${k}-${n}`, to: `k${k - 1}-${n}` });
    }
  }
  return new Store({ schema, mutations: [rename] as never, invariants: [], snapshot: { nodes, edges } as never });
}

const seen: Seen = {
  kinds: kinds.map((_, i) => `k${i}`),
  plurals: Object.fromEntries(kinds.map((_, i) => [`k${i}`, `Kind ${i}s`])),
  recordAt: () => null,
};
const region = { x: 0, y: 56, width: 1440, height: 844 };
const rooms = roomBeside(region, pageBox(region));

const timed = <T>(run: () => T): { readonly value: T; readonly ms: number } => {
  const began = performance.now();
  const value = run();
  return { value, ms: performance.now() - began };
};

describe("the city behind a page, on twenty-five districts", () => {
  for (const each of [32, 200]) {
    it(`draws at once and routes no street while it draws, ${each} records a district`, async () => {
      const store = big(each);
      const routedBefore = routingsSoFar();
      const first = timed(() => drawCity({ store }, seen, new Set(["k3-1", "k7-2"]), rooms));
      expect(first.value).not.toBeNull();
      expect(first.value!.ground.plots).toHaveLength(KINDS);
      expect(first.value!.buildings.length).toBeGreaterThan(KINDS);
      // Drawn without routing: the streets are not routed while the city draws.
      expect(routingsSoFar()).toBe(routedBefore);
      expect(first.ms, `${first.ms.toFixed(0)} ms to draw the city`).toBeLessThan(120);

      // Drawn again for the same store and the same records: kept, not drawn again.
      const again = timed(() => drawCity({ store }, seen, new Set(["k3-1", "k7-2"]), rooms));
      expect(again.value!.buildings).toBe(first.value!.buildings);
      expect(again.ms, `${again.ms.toFixed(0)} ms to draw it again`).toBeLessThan(10);

      // The one map drawn is routed between frames, and once: a second step back is answered at once.
      const input = { ribbons: first.value!.ribbons, plots: first.value!.ground.map, cell: 40, tilt: 0.5 };
      const runs = await new Promise<ReadonlyMap<string, unknown>>((done) => routeBetweenFrames(input, done));
      expect(runs.size).toBeGreaterThan(0);
      const routed = routingsSoFar();
      expect(routed - routedBefore).toBeLessThanOrEqual(1);
      let answered = false;
      routeBetweenFrames(input, () => (answered = true));
      expect(answered).toBe(true);
      expect(routingsSoFar()).toBe(routed);

      // A change that moves no plot: read again, drawn quickly, its streets still remembered.
      const version = store.version;
      store.apply({ name: "rename", args: { id: "k4-0", label: "Renamed" } });
      expect(store.version).toBeGreaterThan(version);
      const ticked = timed(() => drawCity({ store }, seen, new Set(["k3-1", "k7-2"]), rooms));
      expect(ticked.ms, `${ticked.ms.toFixed(0)} ms on a change of the store`).toBeLessThan(120);
      let still = false;
      routeBetweenFrames({ ribbons: ticked.value!.ribbons, plots: ticked.value!.ground.map, cell: 40, tilt: 0.5 }, () => (still = true));
      expect(still).toBe(true);
    });
  }
});
