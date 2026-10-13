import { describe, expect, it } from "vitest";
import { createSchema, defineNode, diffSnapshots, Graph, z, type Primitive } from "../../src/index.js";

/**
 * A CHANGE COSTS WHAT IT TOUCHES, NOT WHAT THE GRAPH HOLDS (the ninth walk,
 * W-197). Every change diffed the whole graph before and after, reading
 * every field of every record through JSON: some 30 milliseconds an act on
 * a beekeeping co-op of 8,500 records and 16,000 links, so a sheet of 200
 * inspections took ten seconds to keep and the seed four minutes to make.
 * The diff is of what the primitives name, and says exactly what the whole
 * comparison said.
 */
const hive = defineNode("hive", { fields: z.object({ label: z.string(), boxes: z.number().optional() }) });
const inspection = defineNode("inspection", {
  fields: z.object({ label: z.string() }),
  edges: { of: { to: ["hive"], description: "the hive looked into", inverse: "its inspections" } },
});
const schema = createSchema([hive, inspection]);

const yard = (count: number) => ({
  nodes: [
    ...Array.from({ length: count }, (_, i) => ({ id: `hive:${i}`, kind: "hive", label: `Hive ${i}`, boxes: i % 5 })),
    ...Array.from({ length: count }, (_, i) => ({ id: `inspection:${i}`, kind: "inspection", label: `Look ${i}` })),
  ],
  edges: Array.from({ length: count }, (_, i) => ({ kind: "of", from: `inspection:${i}`, to: `hive:${i}` })),
});

describe("a change costs what it touches", () => {
  it("reads no field of a record it does not touch", () => {
    const snapshot = yard(50);
    let read = 0;
    const watched = snapshot.nodes[7]!;
    const label = watched.label;
    Object.defineProperty(watched, "label", { enumerable: true, get: () => ((read += 1), label) });
    const graph = Graph.from(schema, snapshot as never, { validate: false });
    read = 0;
    graph.applyPrimitives([{ op: "add-node", node: { id: "hive:new", kind: "hive", label: "New" } } as Primitive]);
    graph.applyPrimitives([{ op: "patch-node", id: "hive:3", before: { boxes: 3 }, after: { boxes: 4 } } as Primitive]);
    expect(read).toBe(0);
  });

  it("says what comparing the whole graph says, for adds, patches, removals and the links a removal takes", () => {
    const batches: Primitive[][] = [
      [{ op: "add-node", node: { id: "hive:x", kind: "hive", label: "X" } } as Primitive, { op: "add-edge", edge: { kind: "of", from: "inspection:1", to: "hive:x" } } as Primitive],
      [{ op: "patch-node", id: "hive:2", before: { boxes: 2 }, after: { boxes: 9, label: "Two" } } as Primitive],
      [{ op: "remove-node", node: { id: "hive:4", kind: "hive", label: "Hive 4", boxes: 4 } } as Primitive],
      [{ op: "remove-edge", edge: { kind: "of", from: "inspection:6", to: "hive:6" } } as Primitive, { op: "patch-node", id: "hive:6", before: { boxes: 1 }, after: { boxes: 2 } } as Primitive],
      [{ op: "add-node", node: { id: "hive:y", kind: "hive", label: "Y" } } as Primitive, { op: "add-edge", edge: { kind: "of", from: "inspection:8", to: "hive:y" } } as Primitive, { op: "remove-node", node: { id: "hive:y", kind: "hive", label: "Y" } } as Primitive],
      [{ op: "patch-node", id: "hive:9", before: { boxes: 4 }, after: { boxes: 4 } } as Primitive],
    ];
    for (const batch of batches) {
      const graph = Graph.from(schema, yard(12) as never, { validate: false });
      const before = graph.snapshot();
      const diff = graph.applyPrimitives(batch);
      expect(diff).toEqual(diffSnapshots(before, graph.snapshot()));
    }
  });
});
