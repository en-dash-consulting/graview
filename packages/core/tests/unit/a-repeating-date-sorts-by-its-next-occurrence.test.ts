import { describe, expect, it } from "vitest";
import { createSchema, defineNode, isoDate, repeatField, z } from "../../src/index.js";
import { arrange } from "../../src/arrange.js";

/*
 * A LIST ORDERED BY A DATE THAT REPEATS orders it by its next occurrence on
 * the day it is read, and a filter or a date group reads the same day.
 */
const bill = defineNode("bill", { fields: z.object({ label: z.string(), due: isoDate, dueRepeat: repeatField() }) });
const schema = createSchema([bill]);
const nodes = [
  { id: "rent", kind: "bill", label: "Rent", due: "2026-01-01", dueRepeat: { every: "month" } },
  { id: "tax", kind: "bill", label: "Tax", due: "2026-10-20" },
  { id: "phone", kind: "bill", label: "Phone", due: "2026-03-25", dueRepeat: { every: "month" } },
];
const graph = { out: () => [], in: () => [] };

describe("a repeating date in a list", () => {
  it("sorts, filters and groups by its next occurrence", () => {
    const ctx = { schema, graph, today: "2026-10-21" } as never;
    expect(arrange(nodes as never, { sort: { by: "due", direction: "asc" } }, ctx).nodes.map((node: { id: string }) => node.id)).toEqual(["tax", "phone", "rent"]);
    expect(arrange(nodes as never, { filter: [{ key: "due", value: "after:2026-10-21" }] }, ctx).nodes.map((node: { id: string }) => node.id).sort()).toEqual(["phone", "rent"]);
    const grouped = arrange(nodes as never, { group: { by: "due", bucket: "month" } }, ctx);
    expect(grouped.groups.map((group: { key: string; nodes: readonly { id: string }[] }) => [group.key, group.nodes.map((node) => node.id)])).toEqual([
      ["2026-10-01", ["tax", "phone"]],
      ["2026-11-01", ["rent"]],
    ]);
  });
});
