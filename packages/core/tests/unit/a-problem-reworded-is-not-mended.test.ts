import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, isoDate, problemsMoved, Store, z } from "../../src/index.js";

/**
 * A PROBLEM REWORDED IS NOT MENDED (the ninth walk, W-191).
 *
 * A rule that is a function says its count in its message: "Meadow 07 has
 * not been opened for 22 days". The day turns and it says 60 days. On the
 * co-op's 299 hives `store.tick` answered that 34 problems had cleared and
 * 280 appeared, when 246 had appeared and none had cleared: every reworded
 * problem was said twice, once mended and once made — and so was it by any
 * act that left it broken and changed its count, in the activity's "broke".
 */
const hive = defineNode("hive", { fields: z.object({ label: z.string(), opened: isoDate }), label: (node) => node.label });
const schema = createSchema([hive]);
const { defineInvariant } = bindSchema(schema);
const daysSince = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const opened = defineInvariant("opened-lately", {
  scope: { kind: "hive" },
  readsTheClock: true,
  evaluate: ({ subject, today }) => {
    const gap = daysSince(subject.opened, today ?? "2026-10-13");
    return gap <= 21 ? [] : [{ invariant: "opened-lately", subjectId: subject.id, label: subject.label, message: `${subject.label} has not been opened for ${gap} days`, nodeIds: [subject.id], repairs: [] }];
  },
});

const yard = () =>
  new Store({
    schema,
    invariants: [opened],
    snapshot: {
      nodes: [
        { id: "hive:meadow-07", kind: "hive", label: "Meadow 07", opened: "2026-09-21" },
        { id: "hive:meadow-08", kind: "hive", label: "Meadow 08", opened: "2026-10-10" },
      ],
      edges: [],
    } as never,
  });

describe("a problem reworded is not mended", () => {
  it("is neither made nor mended when the day turning only changes its count", () => {
    const store = yard();
    store.tick("2026-10-13");
    expect(store.violations().map((v) => v.message)).toEqual(["Meadow 07 has not been opened for 22 days"]);
    const turned = store.tick("2026-11-20");
    expect(turned.cleared).toEqual([]);
    expect(turned.appeared.map((v) => v.message)).toEqual(["Meadow 08 has not been opened for 41 days"]);
  });

  it("still says a problem made and one mended on the same record under two rules, or two records", () => {
    const one = { invariant: "a", subjectId: "x", label: "X", message: "one", nodeIds: [], repairs: [] };
    const other = { invariant: "b", subjectId: "x", label: "X", message: "two", nodeIds: [], repairs: [] };
    expect(problemsMoved([], [one], [other])).toEqual({ introduces: [other], resolves: [one] });
    const y = { ...one, subjectId: "y", label: "Y", message: "three" };
    expect(problemsMoved([], [one], [y])).toEqual({ introduces: [y], resolves: [one] });
    // Two broken, one mended and the other reworded: one mended, nothing made.
    const twice = [{ ...one, message: "first" }, { ...one, message: "second" }];
    const moved = problemsMoved([], twice, [{ ...one, message: "second, again" }]);
    expect(moved.introduces).toEqual([]);
    expect(moved.resolves).toHaveLength(1);
  });
});
