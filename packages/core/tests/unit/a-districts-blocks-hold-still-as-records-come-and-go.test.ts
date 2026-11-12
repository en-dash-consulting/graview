import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode } from "../../src/index.js";
import { districtBlocks, districtLanes, districtState, sideFor, TIER_HEIGHT } from "../../src/scene.js";

/**
 * A DISTRICT'S BLOCKS HOLD STILL AS RECORDS COME AND GO.
 *
 * The scene stands a district's records in rows, one per value of its
 * kind's main choice and one for the records with none (`districtLanes`),
 * and lays the rows out as blocks (`districtBlocks`). A record coming or
 * going must move only what is after it in its own row:
 *
 * - A record with no value adds no row. Each one used to open a row of its
 *   own, so every such record cut the plot into one more row and moved
 *   every block on it.
 * - Adding or removing a record moves only the blocks after it in its row,
 *   each one place along, into the place the block beside it held — except
 *   where the district's own grid grows: its plot taking its third cell at
 *   five records, or its fullest row outgrowing its places.
 *
 * Measured in lattice cells over the district's own plot. Where the city
 * lays its districts out is `placeCity`'s and is not held here.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]).optional() }),
  plural: "Tasks",
});
const schema = createSchema([task]);
const state = districtState(schema, "task")!;

type Rec = { readonly id: string; readonly status?: string };
const pad = (i: number) => String(i).padStart(4, "0");
/** Every seventh record has no status; the rest take the three in turn. */
const recordsOf = (n: number): Rec[] => Array.from({ length: n }, (_, i) => ({ id: `task-${pad(i)}`, ...(i % 7 === 6 ? {} : { status: state.values[i % 3] }) }));

/** Each block's place on the plot, with its row and its place in the row, as the scene lays them. */
function blocksOf(records: readonly Rec[], chosen: readonly string[] = []) {
  const ids = records.map((r) => r.id).sort();
  const byId = new Map(records.map((r) => [r.id, r]));
  const { lanes, tiers } = districtLanes(state, ids, (id) => byId.get(id)?.status, chosen);
  const plot = { col: 0, row: 0, side: sideFor(records.length) };
  const { blocks } = districtBlocks(plot, lanes, tiers.map((tier) => TIER_HEIGHT[tier]));
  const at = new Map(blocks.map((b) => [b.id, { col: b.col, row: b.row, lane: b.lane, index: lanes[b.lane]!.indexOf(b.id) }]));
  return { at, lanes, grid: `${plot.side}|${lanes.length}|${blocks[0]?.footprint.toFixed(6) ?? "-"}` };
}

describe("a district's blocks hold still as records come and go", () => {
  it("stands every record with no value in one row, however many there are", () => {
    for (const n of [1, 7, 20, 70, 300]) {
      const { lanes } = blocksOf(recordsOf(n));
      expect(lanes.length, `${n} records`).toBeLessThanOrEqual(state.values.length + 1);
    }
  });

  it("adds no row for a record with no value, and moves no other block in its district", () => {
    for (const n of [12, 40, 120]) {
      const records = recordsOf(n);
      const before = blocksOf(records);
      const after = blocksOf([...records, { id: "task-zzzz" }]);
      expect(after.lanes.length).toBe(before.lanes.length);
      for (const [id, was] of before.at) expect(after.at.get(id), `${id} among ${n}`).toEqual(was);
    }
  });

  it("moves only the blocks after a record in its row, one place along, except where the district's grid grows", () => {
    let grown = 0;
    let stepped = 0;
    for (const n of [3, 6, 12, 25, 40, 64, 120]) {
      const records = recordsOf(n);
      const before = blocksOf(records);
      const changes: { name: string; records: Rec[]; id: string }[] = [
        { name: "add one first", id: "task-!", records: [...records, { id: "task-!", status: "doing" }] },
        { name: "add one in the middle", id: `task-${pad(Math.floor(n / 2))}a`, records: [...records, { id: `task-${pad(Math.floor(n / 2))}a`, status: "todo" }] },
        { name: "add one last", id: "task-zzzz", records: [...records, { id: "task-zzzz", status: "done" }] },
        { name: "remove the first", id: records[0]!.id, records: records.slice(1) },
        { name: "remove the middle", id: records[Math.floor(n / 2)]!.id, records: records.filter((_, i) => i !== Math.floor(n / 2)) },
        { name: "remove the last", id: records[n - 1]!.id, records: records.slice(0, -1) },
      ];
      for (const change of changes) {
        const after = blocksOf(change.records);
        if (after.grid !== before.grid) {
          grown++;
          continue;
        }
        const changed = after.at.get(change.id) ?? before.at.get(change.id);
        for (const [id, was] of before.at) {
          const now = after.at.get(id);
          if (!now || (now.col === was.col && now.row === was.row)) continue;
          // Only after the record, in its own row, one place along, into the place the block beside it held.
          const said = `${id} moved when we ${change.name} of ${n}`;
          expect(changed, said).toBeDefined();
          expect(was.lane, said).toBe(changed!.lane);
          expect(was.index, said).toBeGreaterThanOrEqual(changed!.index);
          expect(Math.abs(now.index - was.index), said).toBe(1);
          const beside = before.lanes[was.lane]![now.index];
          if (beside !== undefined) expect({ col: now.col, row: now.row }, said).toEqual({ col: before.at.get(beside)!.col, row: before.at.get(beside)!.row });
          stepped++;
        }
      }
    }
    expect(stepped).toBeGreaterThan(0);
    expect(grown).toBeGreaterThan(0);
  });

  it("stands a chosen record first in its row, in the order the district gives its members, and leaves out a chosen id that is not one of them", () => {
    const records = recordsOf(30);
    const ids = records.map((r) => r.id).sort();
    const byId = new Map(records.map((r) => [r.id, r]));
    const chosen = ["task-0021", "task-0003", "elsewhere-1"];
    const { lanes } = districtLanes(state, ids, (id) => byId.get(id)?.status, chosen);
    const flat = lanes.flat();
    expect(flat).not.toContain("elsewhere-1");
    expect(flat).toHaveLength(ids.length);
    for (const id of ["task-0021", "task-0003"]) {
      const row = lanes.find((lane) => lane.includes(id))!;
      const ahead = row.slice(0, row.indexOf(id));
      expect(ahead.every((other) => chosen.includes(other)), id).toBe(true);
    }
  });
});
