import type { Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { actsForSeveral } from "../../src/index.js";
import { createTodoStore } from "../../../../apps/todo/src/domain/app.js";

/**
 * THE SEVERAL BAR WEIGHS TWO THOUSAND CHOSEN QUICKLY. What the bar offers
 * is worked out on every change to the store while the choice stands, so
 * which records each act applies to is judged without a rehearsal: whether
 * the seat may run it there and whether it would change anything, compiled
 * and never applied to a copy of the graph. Pressing it rehearses the batch
 * (`actOnSeveral`). Measured on a machine at the reference's speed (the
 * reference below, 27 ms): two thousand chosen tasks took 3.4 s when each
 * act was rehearsed and take about 70 ms now, 25 of them the derivation's
 * own. Held to 100 ms, stretched by how much slower this machine is, the
 * median of five; asked again with nothing changed, the answer is the one
 * already worked out.
 */
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const MOST_MS = 100;

// The reference: script work like the judging — numbers made, kept and sorted by a comparator — so a busy machine slows both alike.
const REFERENCE_MS = 28;
function machineFactor(): number {
  const began = performance.now();
  const values: number[] = [];
  let seed = 7;
  for (let i = 0; i < 100_000; i++) values.push((seed = (seed * 16807) % 2147483647));
  values.sort((a, b) => a - b);
  return Math.max(1, (performance.now() - began) / REFERENCE_MS);
}

const tasks = (count: number) => {
  const nodes: Record<string, unknown>[] = [{ id: "today", kind: "list", label: "Today", order: 0 }];
  const edges: Record<string, unknown>[] = [];
  for (let at = 0; at < count; at += 1) {
    nodes.push({ id: `t-${at}`, kind: "task", label: `Task ${at}`, done: at % 3 === 0, due: "2026-08-28" });
    edges.push({ kind: "holds", from: "today", to: `t-${at}` });
  }
  return createTodoStore({ snapshot: { nodes, edges } as never });
};

describe("the several bar over two thousand chosen tasks", () => {
  it(`works out what it offers, and what each act applies to, in under ${MOST_MS} ms on the reference machine`, () => {
    actsForSeveral(tasks(50), ["t-1", "t-2"], { principal: keeper });
    const took: number[] = [];
    const factors: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      factors.push(machineFactor());
      const store = tasks(2000);
      const ids = store.graph.nodesOfKind("task").map((task) => task.id);
      const started = performance.now();
      const { acts } = actsForSeveral(store, ids, { principal: keeper });
      took.push(performance.now() - started);
      expect(acts.length).toBeGreaterThan(0);
      expect(acts.every((act) => act.applies.length > 0 && act.applies.length <= ids.length)).toBe(true);
    }
    const median = [...took].sort((a, b) => a - b)[2]!;
    const factor = [...factors].sort((a, b) => a - b)[2]!;
    expect(median, `${median.toFixed(1)} ms, runs ${took.map((one) => one.toFixed(0)).join(", ")}, this machine ${factor.toFixed(2)}x the reference`).toBeLessThan(MOST_MS * factor);
  });

  it("answers again from what it worked out while nothing changed, and afresh once something does", () => {
    const store = tasks(200);
    const ids = store.graph.nodesOfKind("task").map((task) => task.id);
    const first = actsForSeveral(store, ids, { principal: keeper });
    expect(actsForSeveral(store, ids, { principal: keeper })).toBe(first);
    store.apply({ name: "finish", args: { taskId: "t-1" } }, { author: keeper });
    expect(actsForSeveral(store, ids, { principal: keeper })).not.toBe(first);
  });
});
