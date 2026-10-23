import { describe, expect, it } from "vitest";
import { applyToSnapshot } from "../../src/index.js";

/**
 * A MIGRATION'S FOLD OF A STORED GRAPH takes the `splice-text` primitive
 * (op format 3) as the graph does: the text with the splice made, and a
 * splice whose text is not there refused rather than folded into a graph
 * that differs from the log's.
 */
describe("a stored graph takes a splice", () => {
  const stored = { nodes: [{ id: "t1", kind: "task", label: "Water the beds" }], edges: [] };

  it("makes the splice in the field's text", () => {
    const after = applyToSnapshot(stored, [{ op: "splice-text", id: "t1", field: "label", at: 6, removed: "the", inserted: "all the" }]);
    expect(after.nodes[0]!["label"]).toBe("Water all the beds");
    expect(stored.nodes[0]!.label).toBe("Water the beds");
  });

  it("refuses a splice whose text is not there", () => {
    expect(() => applyToSnapshot(stored, [{ op: "splice-text", id: "t1", field: "label", at: 6, removed: "a", inserted: "b" }])).toThrow(/does not hold/);
    expect(() => applyToSnapshot(stored, [{ op: "splice-text", id: "t1", field: "note", at: 0, removed: "", inserted: "b" }])).toThrow(/holds no text/);
  });
});
