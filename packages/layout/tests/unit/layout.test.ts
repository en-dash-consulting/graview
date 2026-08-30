import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  aggregateId,
  easeInOut,
  EMPTY_VIEW,
  fromUrl,
  interpolate,
  layout,
  planeOf,
  sameView,
  toggleExpanded,
  toUrl,
  withFocus,
  withPin,
  withRelation,
  type ViewState,
} from "../../src/index.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: { "assigned-to": { to: ["duty"] } },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
const week = defineNode("week", { fields: z.object({ label: z.string() }) });
const schema = createSchema([person, duty, week]);

function graph() {
  return Graph.from(schema, {
    nodes: [
      { id: "week-1", kind: "week", label: "This week" },
      { id: "ana", kind: "person", label: "Ana" },
      { id: "bo", kind: "person", label: "Bo" },
      { id: "cass", kind: "person", label: "Cass" },
      { id: "morning", kind: "duty", label: "Morning run" },
      { id: "evening", kind: "duty", label: "Evening run" },
    ],
    edges: [
      { kind: "assigned-to", from: "ana", to: "morning" },
      { kind: "assigned-to", from: "bo", to: "evening" },
    ],
  });
}

const view = (partial: Partial<ViewState> = {}): ViewState => ({ ...EMPTY_VIEW, ...partial });

describe("layout as a pure function", () => {
  it("gives the same graph and view identical positions", () => {
    const state = view({ focusId: "week-1", relation: "person" });
    const a = layout(graph(), schema, state);
    const b = layout(graph(), schema, state);
    expect(a).toEqual(b);
  });

  it("puts the focus on plane 0, the relation on plane 1, the rest on plane 2", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    expect(planeOf(result, "week-1")).toBe(0);
    expect(planeOf(result, "ana")).toBe(1);
    expect(planeOf(result, "bo")).toBe(1);
    expect(planeOf(result, aggregateId("duty"))).toBe(2);
  });

  it("follows an edge kind from the focus when there is one", () => {
    const result = layout(graph(), schema, view({ focusId: "ana", relation: "assigned-to" }));
    expect(planeOf(result, "morning")).toBe(1);
    // Bo's run is not Ana's, so it stays in context.
    expect(planeOf(result, "evening")).toBeNull();
    expect(planeOf(result, aggregateId("duty"))).toBe(2);
  });

  it("groups everything else into aggregates that name their members", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    const duties = result.nodes.find((n) => n.id === aggregateId("duty"));
    expect(duties?.aggregate).toEqual({
      kind: "duty",
      memberIds: ["evening", "morning"],
      label: "Runs",
    });
  });

  it("expands an aggregate into its members and collapses back", () => {
    const closed = view({ focusId: "week-1" });
    const open = toggleExpanded(closed, aggregateId("person"));

    const before = layout(graph(), schema, closed);
    expect(before.nodes.map((n) => n.id)).toContain(aggregateId("person"));
    expect(before.nodes.map((n) => n.id)).not.toContain("ana");

    const after = layout(graph(), schema, open);
    expect(after.nodes.map((n) => n.id)).not.toContain(aggregateId("person"));
    expect(after.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["ana", "bo", "cass"]));

    // Collapsing is the same operation the other way, not a second path.
    expect(layout(graph(), schema, toggleExpanded(open, aggregateId("person")))).toEqual(before);
  });

  it("draws connectors only between nodes that are both on screen", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    // Ana and Bo are placed; their runs are inside an aggregate, so the
    // assigned-to edges have nowhere to land.
    expect(result.connectors).toEqual([]);

    const expanded = layout(
      graph(),
      schema,
      toggleExpanded(view({ focusId: "week-1", relation: "person" }), aggregateId("duty")),
    );
    expect(expanded.connectors.map((c) => c.id)).toEqual([
      "assigned-to:ana:morning",
      "assigned-to:bo:evening",
    ]);
    // Edge kind travels with the connector so stroke treatment can mean something.
    expect(expanded.connectors.every((c) => c.kind === "assigned-to")).toBe(true);
  });
});

describe("stability", () => {
  it("keeps positions when an unrelated part of the graph changes", () => {
    const state = view({ focusId: "week-1", relation: "person" });
    const before = layout(graph(), schema, state);

    const mutated = graph();
    mutated.applyPrimitives([
      { op: "add-node", node: { id: "zed", kind: "duty", label: "Late run" } },
    ]);
    const after = layout(mutated, schema, state);

    for (const id of ["week-1", "ana", "bo", "cass"]) {
      const a = before.nodes.find((n) => n.id === id);
      const b = after.nodes.find((n) => n.id === id);
      expect([b?.x, b?.y]).toEqual([a?.x, a?.y]);
    }
  });

  it("ranks by stable key, so an edge change cannot reshuffle a plane", () => {
    const state = view({ focusId: "week-1", relation: "person" });
    const before = layout(graph(), schema, state);

    const mutated = graph();
    // Give Cass every run — a count-based ordering would move her to the front.
    mutated.applyPrimitives([
      { op: "remove-edge", edge: { kind: "assigned-to", from: "ana", to: "morning" } },
      { op: "add-edge", edge: { kind: "assigned-to", from: "cass", to: "morning" } },
      { op: "add-edge", edge: { kind: "assigned-to", from: "cass", to: "evening" } },
    ]);
    const after = layout(mutated, schema, state);

    const order = (result: typeof before) =>
      result.nodes.filter((n) => n.plane === 1).map((n) => n.id);
    expect(order(after)).toEqual(order(before));
  });

  it("lets a pin override the computed position and survive graph changes", () => {
    const pinned = withPin(view({ focusId: "week-1", relation: "person" }), "bo", {
      x: 12,
      y: 34,
    });
    const before = layout(graph(), schema, pinned);
    const bo = before.nodes.find((n) => n.id === "bo");
    expect([bo?.x, bo?.y, bo?.pinned]).toEqual([12, 34, true]);

    const mutated = graph();
    mutated.applyPrimitives([
      { op: "add-node", node: { id: "dee", kind: "person", label: "Dee" } },
    ]);
    const after = layout(mutated, schema, pinned);
    const boAfter = after.nodes.find((n) => n.id === "bo");
    expect([boAfter?.x, boAfter?.y]).toEqual([12, 34]);
    // The unpinned neighbours did move — the pin is an override, not a freeze.
    expect(after.nodes.find((n) => n.id === "ana")?.x).not.toBe(
      before.nodes.find((n) => n.id === "ana")?.x,
    );
  });
});

describe("every stop is a URL", () => {
  it("round-trips a view exactly", () => {
    const state = withPin(
      toggleExpanded(withRelation(withFocus(EMPTY_VIEW, "week-1"), "person"), "aggregate:duty"),
      "bo",
      { x: 10.5, y: 20.25 },
    );
    expect(fromUrl(toUrl(state))).toEqual(state);
  });

  it("serialises the same view to the same string, whatever the order", () => {
    const a = toggleExpanded(toggleExpanded(EMPTY_VIEW, "b"), "a");
    const b = toggleExpanded(toggleExpanded(EMPTY_VIEW, "a"), "b");
    expect(toUrl(a)).toBe(toUrl(b));
    expect(sameView(a, b)).toBe(true);
  });

  it("ignores malformed parts rather than throwing", () => {
    expect(fromUrl("#focus=week-1&pin.bo=nonsense&expand=")).toEqual({
      focusId: "week-1",
      relation: null,
      expanded: [],
      pins: {},
    });
    expect(fromUrl("")).toEqual(EMPTY_VIEW);
  });
});

describe("interpolation", () => {
  const focused = view({ focusId: "week-1", relation: "person" });
  const collapsed = layout(graph(), schema, focused);
  const expanded = layout(graph(), schema, toggleExpanded(focused, aggregateId("duty")));

  it("returns each end exactly at t=0 and t=1", () => {
    const start = interpolate(collapsed, expanded, 0);
    const end = interpolate(collapsed, expanded, 1);
    for (const node of collapsed.nodes) {
      const found = start.nodes.find((n) => n.id === node.id);
      expect([found?.x, found?.y]).toEqual([node.x, node.y]);
    }
    for (const node of expanded.nodes) {
      const found = end.nodes.find((n) => n.id === node.id);
      expect([found?.x, found?.y]).toEqual([node.x, node.y]);
    }
  });

  it("grows members out of the aggregate they were inside", () => {
    const group = collapsed.nodes.find((n) => n.id === aggregateId("duty"))!;
    const mid = interpolate(collapsed, expanded, 0.001);
    const morning = mid.nodes.find((n) => n.id === "morning")!;
    // At the very start of the transition a member sits on its old group.
    expect(morning.x).toBeCloseTo(group.x + group.width / 2 - morning.width / 2, 0);
    expect(morning.opacity).toBeLessThan(0.01);
  });

  it("collapses members back into the group, the same path reversed", () => {
    const forward = interpolate(collapsed, expanded, 0.5);
    const backward = interpolate(expanded, collapsed, 0.5);
    const morningForward = forward.nodes.find((n) => n.id === "morning")!;
    const morningBackward = backward.nodes.find((n) => n.id === "morning")!;
    expect(morningBackward.x).toBeCloseTo(morningForward.x, 5);
    expect(morningBackward.y).toBeCloseTo(morningForward.y, 5);
  });

  it("mixes planes fractionally so the renderer can blend two depths", () => {
    const a = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    const b = layout(graph(), schema, view({ focusId: "ana", relation: "assigned-to" }));
    const mid = interpolate(a, b, 0.5);
    const ana = mid.nodes.find((n) => n.id === "ana")!;
    // Ana travels from plane 1 to plane 0 and is halfway between.
    expect(ana.plane).toBeCloseTo(0.5);
  });

  it("eases without overshooting either end", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    for (const t of [-1, 0.25, 0.75, 2]) {
      expect(easeInOut(t)).toBeGreaterThanOrEqual(0);
      expect(easeInOut(t)).toBeLessThanOrEqual(1);
    }
  });
});
