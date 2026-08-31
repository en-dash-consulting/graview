import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  aggregateId,
  kindCardId,
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
  edges: {
    "assigned-to": { to: ["duty"], description: "who does the run" },
    "rides-in": { to: ["duty"], description: "who is along for it" },
  },
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
      { kind: "rides-in", from: "cass", to: "morning" },
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
    expect(planeOf(result, kindCardId("duty"))).toBe(2);
  });

  it("follows an edge kind from the focus when there is one", () => {
    const result = layout(graph(), schema, view({ focusId: "ana", relation: "assigned-to" }));
    expect(planeOf(result, "morning")).toBe(1);
    // Bo's run is not Ana's, so it stays in context.
    expect(planeOf(result, "evening")).toBeNull();
    expect(planeOf(result, kindCardId("duty"))).toBe(2);
  });

  it("groups everything else into aggregates that name their members", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    const duties = result.nodes.find((n) => n.id === kindCardId("duty"));
    expect(duties?.aggregate).toEqual({
      kind: "duty",
      memberIds: ["evening", "morning"],
      label: "Runs",
    });
  });

  it("expands an aggregate into its members and collapses back", () => {
    const closed = view({ focusId: "week-1" });
    const open = toggleExpanded(closed, kindCardId("person"));

    const before = layout(graph(), schema, closed);
    expect(before.nodes.map((n) => n.id)).toContain(kindCardId("person"));
    expect(before.nodes.map((n) => n.id)).not.toContain("ana");

    const after = layout(graph(), schema, open);
    expect(after.nodes.map((n) => n.id)).not.toContain(kindCardId("person"));
    expect(after.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["ana", "bo", "cass"]));

    // Collapsing is the same operation the other way, not a second path.
    expect(layout(graph(), schema, toggleExpanded(open, kindCardId("person")))).toEqual(before);
  });

  it("points an edge at the group its other end is inside", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    // Ana's run is inside the Runs group, so her edge points at the group —
    // severing it would hide the relationship the scene exists to show.
    expect(result.connectors.map((c) => `${c.from}->${c.to}`)).toEqual([
      "ana->kind:duty",
      "bo->kind:duty",
      "cass->kind:duty",
    ]);

    const expanded = layout(
      graph(),
      schema,
      toggleExpanded(view({ focusId: "week-1", relation: "person" }), kindCardId("duty")),
    );
    expect(expanded.connectors.map((c) => c.id)).toEqual([
      "assigned-to:ana:morning",
      "assigned-to:bo:evening",
      "rides-in:cass:morning",
    ]);
    // Edge kind travels with the connector so stroke treatment can mean something.
    expect(expanded.connectors.map((c) => c.kind)).toEqual([
      "assigned-to",
      "assigned-to",
      "rides-in",
    ]);
  });
});

describe("stability", () => {
  it("collapses several edges onto one connector when they resolve to the same pair", () => {
    const mutated = graph();
    mutated.applyPrimitives([
      { op: "add-edge", edge: { kind: "assigned-to", from: "ana", to: "evening" } },
    ]);
    const result = layout(mutated, schema, view({ focusId: "week-1", relation: "person" }));
    // Ana now owns both runs, but both are in the same group: one line, not two.
    expect(result.connectors.filter((c) => c.from === "ana")).toHaveLength(1);
  });

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
  const expanded = layout(graph(), schema, toggleExpanded(focused, kindCardId("duty")));

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
    const group = collapsed.nodes.find((n) => n.id === kindCardId("duty"))!;
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

describe("a focused node surfaces its neighbourhood", () => {
  /*
   * The behaviour this file exists to pin down: clicking a thing shows what
   * it is caught up in. Plane 1 used to stay EMPTY until the reader guessed
   * an edge kind, which is why selecting an event read as "nothing
   * happened".
   */
  it("raises everything one edge away, with no relation named", () => {
    const result = layout(graph(), schema, view({ focusId: "morning" }));
    const raised = result.nodes.filter((node) => node.plane === 1);
    expect(raised.map((node) => node.id).sort()).toEqual(["ana", "cass"]);
  });

  it("says WHY each one is there, in the schema's own words", () => {
    const result = layout(graph(), schema, view({ focusId: "morning" }));
    const byId = new Map(result.nodes.map((node) => [node.id, node]));
    expect(byId.get("ana")?.via).toEqual({
      edgeKind: "assigned-to",
      direction: "in",
      description: "who does the run",
    });
    expect(byId.get("cass")?.via?.description).toBe("who is along for it");
  });

  it("groups the neighbourhood by edge kind, so a caption spans a run", () => {
    const result = layout(graph(), schema, view({ focusId: "morning" }));
    const kinds = result.nodes
      .filter((node) => node.plane === 1)
      .map((node) => node.via?.edgeKind);
    // Contiguous: no kind appears, disappears and returns.
    expect(kinds).toEqual([...kinds].sort());
  });

  it("narrows to one edge kind when a relation names one", () => {
    const result = layout(
      graph(),
      schema,
      view({ focusId: "morning", relation: "assigned-to" }),
    );
    expect(result.nodes.filter((node) => node.plane === 1).map((node) => node.id)).toEqual([
      "ana",
    ]);
  });

  it("still raises a whole KIND when the relation is not an edge from here", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    expect(result.nodes.filter((node) => node.plane === 1).map((node) => node.id)).toEqual([
      "ana",
      "bo",
      "cass",
    ]);
  });

  it("gives the focus the relation band as well when nothing is raised", () => {
    // A calendar with nothing beside it should fill the screen, not leave a
    // third of it empty above the context row.
    const alone = layout(graph(), schema, view({ focusId: "week-1" }));
    const beside = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    const heightOf = (result: ReturnType<typeof layout>) =>
      result.nodes.find((node) => node.plane === 0)!.height;
    expect(heightOf(alone)).toBeGreaterThan(heightOf(beside));
  });
});

describe("everything the layout places is reachable", () => {
  /*
   * A scene is sized to its container and nothing scrolls, so a band that
   * runs past the bottom is not content below the fold — it is content
   * nobody can ever see. The group set ran to 1.03 of the height for months,
   * quietly clipping the bottom of every context card in every app.
   */
  const states = [
    view({ focusId: "week-1" }),
    view({ focusId: "week-1", relation: "person" }),
    view({ focusId: "morning" }),
    view({ focusId: "morning", relation: "assigned-to" }),
    view({ focusId: "week-1", relation: "person", expanded: [kindCardId("duty")] }),
  ];

  it("keeps every node inside the canvas, in every arrangement", () => {
    for (const state of states) {
      const result = layout(graph(), schema, state, { width: 1200, height: 760 });
      for (const node of result.nodes) {
        expect(node.y).toBeGreaterThanOrEqual(0);
        // The drawn box is the node's box times its plane's scale, so the
        // untransformed bottom is the honest upper bound.
        expect(node.y + node.height).toBeLessThanOrEqual(760);
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x + node.width).toBeLessThanOrEqual(1200);
      }
    }
  });

  it("holds at a short viewport, where the overflow actually bit", () => {
    for (const state of states) {
      const result = layout(graph(), schema, state, { width: 1440, height: 600 });
      for (const node of result.nodes) {
        expect(node.y + node.height).toBeLessThanOrEqual(600);
      }
    }
  });
});

describe("the kinds plane is a constant map", () => {
  /*
   * It used to be "whatever is not on screen", so its membership changed as
   * you navigated: the kind you were looking at vanished from it and turned
   * up again when you looked elsewhere, which reads as a bug rather than as
   * the same card.
   */
  it("shows every declared kind, in every arrangement", () => {
    for (const state of [
      view({ focusId: "week-1" }),
      view({ focusId: "week-1", relation: "person" }),
      view({ focusId: "morning" }),
    ]) {
      const result = layout(graph(), schema, state);
      const kinds = result.nodes
        .filter((node) => node.plane === 2 && node.aggregate)
        .map((node) => node.kind)
        .sort();
      expect(kinds).toEqual(["duty", "person", "week"]);
    }
  });

  it("marks the kind in focus rather than removing it", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1" }));
    const card = result.nodes.find((node) => node.id === kindCardId("week"))!;
    expect(card.focused).toBe(true);
    expect(card.plane).toBe(2);
  });

  it("marks a raised kind, and keeps it where it was", () => {
    const resting = layout(graph(), schema, view({ focusId: "week-1" }));
    const raised = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    const before = resting.nodes.find((node) => node.id === kindCardId("person"))!;
    const after = raised.nodes.find((node) => node.id === kindCardId("person"))!;
    expect(after.raised).toBe(true);
    // Spatial memory: raising does not move the card.
    expect([after.x, after.y]).toEqual([before.x, before.y]);
  });
});

describe("the overview is the same cards, on a ring", () => {
  it("keeps every kind, and drops the focus panel", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", overview: true }));
    // No plane 0: up here the ring card for the focused kind carries it.
    expect(result.nodes.some((node) => node.plane === 0)).toBe(false);
    expect(result.nodes.filter((node) => node.aggregate)).toHaveLength(3);
    expect(result.nodes.find((node) => node.id === kindCardId("week"))?.focused).toBe(true);
  });

  it("places them on an ellipse rather than a row", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", overview: true }));
    const ys = result.nodes.filter((node) => node.aggregate).map((node) => Math.round(node.y));
    // A row shares one y; a ring does not.
    expect(new Set(ys).size).toBeGreaterThan(1);
  });

  it("is a stop, so the back button returns to it exactly", () => {
    const above = view({ focusId: "week-1", overview: true });
    expect(fromUrl(toUrl(above))).toMatchObject({ focusId: "week-1", overview: true });
    expect(sameView(fromUrl(toUrl(above)), above)).toBe(true);
  });

  it("still fits inside the canvas", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1", overview: true }), {
      width: 1200,
      height: 700,
    });
    for (const node of result.nodes) {
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y + node.height).toBeLessThanOrEqual(700);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(1200);
    }
  });
});
