import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  aggregateId,
  edgeOfSelection,
  edgeSelectionId,
  kindCardId,
  withSelection,
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
  withJackIn,
  withPan,
  withPin,
  withOverview,
  withRelation,
  withZoom,
  type ViewState,
} from "../../src/index.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: {
    // Read from the person: the runs they do. Read from the run: who does it.
    "assigned-to": { to: ["duty"], description: "the runs they do", inverse: "who does the run" },
    "rides-in": { to: ["duty"], description: "the runs they ride in", inverse: "who is along for it" },
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

  it("carries the selection: the pane you had open is part of the stop", () => {
    const chosen = withSelection(withFocus(EMPTY_VIEW, "week-1"), ["bo", "ana"]);
    const back = fromUrl(toUrl(chosen));
    expect(back.selection).toEqual(["ana", "bo"]);
    expect(sameView(chosen, back)).toBe(true);
    // Clearing leaves no key behind — the default state is the default URL.
    expect(toUrl(withSelection(chosen, []))).toBe(toUrl(withFocus(EMPTY_VIEW, "week-1")));
    expect(fromUrl(toUrl(withSelection(chosen, []))).selection).toBeUndefined();
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

describe("a rail reserved for chrome, at altitude", () => {
  it("keeps every district clear of the reserved left rail, and centres within the rest", () => {
    const rail = 264;
    const result = layout(graph(), schema, view({ overview: true }), { width: 1280, height: 800, inset: { left: rail } });
    const cards = result.nodes.filter((node) => node.aggregate);
    expect(cards.length).toBeGreaterThan(2);
    for (const card of cards) expect(card.x, card.id).toBeGreaterThanOrEqual(rail);
    const centre = cards.reduce((sum, card) => sum + card.x + card.width / 2, 0) / cards.length;
    expect(Math.abs(centre - (rail + (1280 - rail) / 2))).toBeLessThan(40);
  });

  it("keeps the nearest district whole in a short canvas", () => {
    const result = layout(graph(), schema, view({ overview: true }), { width: 820, height: 420 });
    for (const card of result.nodes.filter((node) => node.aggregate)) {
      expect(card.y + card.height, card.id).toBeLessThanOrEqual(420);
    }
  });

  /*
   * TWO DISTRICTS NEVER SIT ON EACH OTHER, HOWEVER SHORT THE SCENE.
   *
   * The ring is an ellipse with the near card at the bottom and the far one
   * at the top, and its vertical radius shrinks with the canvas while the
   * cards keep a minimum size. Below about 480 of scene the two ends met:
   * at 390x476 the seedbed drew `kind:plot` across `kind:gardener` by 52% of
   * its area, and the district you pressed was whichever happened to be on
   * top. An embed the height of a paragraph is a short scene on the widest
   * monitor there is, so this is not only a phone.
   */
  it("never lays one district on top of another, at any height a scene can have", () => {
    /*
     * An EVEN number of kinds is the case that broke: at four, two districts
     * sit directly opposite on the ellipse, same column, and the ring's
     * vertical radius is the only thing keeping them apart. The three-kind
     * fixture above never puts two cards in one column, which is why this
     * survived every layout test there was.
     */
    const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
    const four = createSchema([person, duty, week, note]);
    const fourGraph = () =>
      Graph.from(four, {
        nodes: [
          { id: "week-1", kind: "week", label: "This week" },
          { id: "ana", kind: "person", label: "Ana" },
          { id: "morning", kind: "duty", label: "Morning run" },
          { id: "n-1", kind: "note", label: "A note" },
        ],
        edges: [],
      });
    const overlaps = [];
    // Shut, and with one district opened in place — an opened district asks
    // the ring for 96 more pixels under the near card, which is the state
    // the seedbed was in when two of them landed on each other.
    const states = [
      view({ overview: true }),
      toggleExpanded(view({ overview: true }), kindCardId("person")),
    ];
    for (const height of [900, 800, 700, 620, 560, 500, 476, 440, 400, 360, 320, 280, 240]) {
      for (const width of [1280, 820, 390]) {
        for (const state of states) {
        const cards = layout(fourGraph(), four, state, { width, height }).nodes.filter(
          (node) => node.aggregate,
        );
        for (let i = 0; i < cards.length; i += 1) {
          for (let j = i + 1; j < cards.length; j += 1) {
            const a = cards[i]!;
            const b = cards[j]!;
            const over =
              Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
              Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
            if (over > 1) {
              overlaps.push(`${width}x${height} ${a.id}/${b.id} by ${Math.round(over)}`);
            }
          }
        }
        }
      }
    }
    expect(overlaps).toEqual([]);
  });

  it("keeps the focused card and the shelf clear of the rail in focus mode too", () => {
    const rail = 264;
    const result = layout(graph(), schema, view({ focusId: "week-1" }), { width: 1280, height: 800, inset: { left: rail } });
    for (const node of result.nodes) expect(node.x, node.id).toBeGreaterThanOrEqual(rail - 1);
    const focus = result.nodes.find((node) => node.plane === 0)!;
    expect(Math.abs(focus.x + focus.width / 2 - (rail + (1280 - rail) / 2))).toBeLessThan(2);
  });
});

describe("a focused group, from altitude", () => {
  it("is its district, opened, when its picture is only the framework's list", () => {
    const result = layout(graph(), schema, view({ focusId: aggregateId("duty"), overview: true }), { plainGroups: ["duty"] });
    expect(result.nodes.some((node) => node.plane === 0)).toBe(false);
    const district = result.nodes.find((node) => node.id === kindCardId("duty"))!;
    expect(district.opened).toBe(true);
  });

  it("keeps its scaled card when it has a view of its own, and its district stays shut", () => {
    const result = layout(graph(), schema, view({ focusId: aggregateId("duty"), overview: true, expanded: [kindCardId("duty")] }));
    const card = result.nodes.find((node) => node.plane === 0)!;
    expect(card.id).toBe(aggregateId("duty"));
    expect(card.natural).toBeDefined();
    expect(result.nodes.find((node) => node.id === kindCardId("duty"))!.opened).toBeFalsy();
  });
});

/**
 * THE CITY GROWS WITH THE READER, UNTIL THE RING IS FULL.
 *
 * A district card holds a name and a count, both sized in `rem`, and the
 * card was sized in pixels off the stage — so a reader on Largest doubled
 * every name in the city inside cards that had not moved at all. The cards
 * take the reader's unit now, and give ground back rather than standing in
 * each other when there is no more room.
 */
describe("a card is the size of the words in it", () => {
  const cards = (unit?: number) =>
    layout(graph(), schema, view({ overview: true }), {
      width: 1600,
      height: 900,
      ...(unit === undefined ? {} : { unit }),
    }).nodes.filter((node) => node.aggregate);

  it("lays out exactly as it always did when nothing says otherwise", () => {
    const said = cards(16).map((node) => [node.id, Math.round(node.width), Math.round(node.height)]);
    const silent = cards().map((node) => [node.id, Math.round(node.width), Math.round(node.height)]);
    expect(silent).toEqual(said);
  });

  it("grows the cards when the reader asks for bigger words", () => {
    const before = cards(16);
    const after = cards(32);
    expect(after).toHaveLength(before.length);
    for (const [index, card] of after.entries()) {
      expect(card.width, card.id).toBeGreaterThan(before[index]!.width);
      expect(card.height, card.id).toBeGreaterThan(before[index]!.height);
    }
  });

  it("keeps the ring a ring: no district ever stands in another", () => {
    for (const unit of [16, 20, 32, 64]) {
      const placed = cards(unit);
      for (const [index, one] of placed.entries()) {
        for (const other of placed.slice(index + 1)) {
          const apart =
            one.x + one.width <= other.x ||
            other.x + other.width <= one.x ||
            one.y + one.height <= other.y ||
            other.y + other.height <= one.y;
          expect(apart, `${unit}: ${one.id} and ${other.id}`).toBe(true);
        }
      }
    }
  });

  it("gives ground back rather than growing past the room it has", () => {
    /*
     * Sixty-four pixels to the rem is four times the browser's own — far
     * more than the ring can honour with this many districts — so the cards
     * take what is left and stop. Bigger than they were, and never so big
     * that the picture stops being a picture.
     */
    const asked = cards(64);
    const base = cards(16);
    for (const [index, card] of asked.entries()) {
      expect(card.width).toBeGreaterThanOrEqual(base[index]!.width);
      expect(card.width).toBeLessThan(base[index]!.width * 4);
    }
  });
});

describe("the overview is the same cards, on a ring", () => {
  it("keeps your interface, live and shrunk, in the middle of the ring", () => {
    /*
     * Not a card standing in for it: the same view, at plane 0, at full
     * fidelity. Rising is for seeing what you are working on IN RELATION to
     * everything else, and a diagram of the schema with your work removed
     * answers a different question.
     */
    const above = layout(graph(), schema, view({ focusId: "week-1", overview: true }), {
      width: 1200,
      height: 760,
    });
    const inside = layout(graph(), schema, view({ focusId: "week-1" }), {
      width: 1200,
      height: 760,
    });
    const shrunk = above.nodes.find((node) => node.id === "week-1")!;
    const full = inside.nodes.find((node) => node.id === "week-1")!;
    expect(shrunk.plane).toBe(0);
    expect(shrunk.width).toBeLessThan(full.width);
    // And every kind is still there, with its own card.
    expect(above.nodes.filter((node) => node.aggregate)).toHaveLength(3);
    expect(above.nodes.find((node) => node.id === kindCardId("week"))?.focused).toBe(true);
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

describe("the kinds sit on a flat shelf, and rise into a city on the ring", () => {
  /*
   * The shelf is a map, and a map lies flat: one baseline, one depth. The
   * arc it used to bow into carried no meaning — the curvature existed to
   * negotiate room with chrome, which is not a reason a reader can see.
   */
  const cards = (state: ViewState) =>
    layout(graph(), schema, state)
      .nodes.filter((node) => node.plane === 2 && node.aggregate)
      .sort((a, b) => a.x - b.x);

  it("lays the shelf flat: one baseline, one depth", () => {
    const placed = cards(view({ focusId: "week-1" }));
    const primaries = placed.filter((card) => card.rank !== "secondary" && !card.nestedUnder);
    const bottoms = new Set(primaries.map((card) => card.y + card.height));
    expect(bottoms.size).toBe(1);
    expect(new Set(primaries.map((card) => card.depth)).size).toBe(1);
  });

  it("keeps every depth inside its plane", () => {
    for (const card of cards(view({ focusId: "week-1" }))) {
      expect(card.depth!).toBeGreaterThan(0);
      expect(card.depth!).toBeLessThanOrEqual(1);
    }
  });

  it("brings the near side of the ring toward the viewer", () => {
    /*
     * From altitude the ring is a city: what is nearest the viewer — the
     * bottom of the ellipse — is drawn larger and pulled forward; the far
     * side sits smaller and further back. Same affine vocabulary as the
     * planes themselves.
     */
    const ringed = layout(graph(), schema, view({ focusId: "week-1", overview: true }))
      .nodes.filter((node) => node.plane === 2 && node.aggregate);
    const nearest = ringed.reduce((a, b) => (a.y + a.height > b.y + b.height ? a : b));
    const furthest = ringed.reduce((a, b) => (a.y < b.y ? a : b));
    expect(nearest.depth!).toBeLessThan(furthest.depth!);
    expect(nearest.width).toBeGreaterThan(furthest.width);
  });

  it("keeps the raised plane clear of the shelf", () => {
    const result = layout(graph(), schema, view({ focusId: aggregateId("duty"), relation: "person" }), {
      width: 1280,
      height: 720,
    });
    const raised = result.nodes.filter((node) => node.plane === 1);
    const shelfTop = Math.min(
      ...result.nodes.filter((node) => node.plane === 2).map((node) => node.y),
    );
    expect(raised.length).toBeGreaterThan(0);
    for (const card of raised) {
      // At least twelve pixels of clear ground between the bands, at the
      // smallest height the surveys cover — measured on the layout boxes,
      // which are larger than the rendered ones.
      expect(card.y + card.height).toBeLessThanOrEqual(shelfTop - 12);
    }
  });
});

/**
 * Nine kinds as nine identical thumbnails says nothing about which of them
 * matter. What is directly related to what you are looking at is the first
 * thing the plane should say, and it is derivable — the schema already
 * declares which kinds touch which.
 */
describe("the kinds plane ranks relations rather than listing them flat", () => {
  const household = defineNode("household", {
    fields: z.object({ label: z.string() }),
    edges: { holds: { to: ["member"], description: "who lives here" } },
  });
  const member = defineNode("member", {
    fields: z.object({ label: z.string() }),
    edges: { does: { to: ["chore"], description: "what they are on" } },
  });
  const chore = defineNode("chore", {
    fields: z.object({ label: z.string() }),
    edges: { needs: { to: ["tool"], description: "what it takes" } },
  });
  const tool = defineNode("tool", { fields: z.object({ label: z.string() }) });
  const weather = defineNode("weather", { fields: z.object({ label: z.string() }) });
  const nested = createSchema([household, member, chore, tool, weather]);

  const nestedGraph = () =>
    Graph.from(nested, {
      nodes: [
        { id: "home", kind: "household", label: "Home" },
        { id: "ana", kind: "member", label: "Ana" },
        { id: "dishes", kind: "chore", label: "Dishes" },
        { id: "brush", kind: "tool", label: "Brush" },
        { id: "tue", kind: "weather", label: "Tuesday" },
      ],
      edges: [
        { kind: "holds", from: "home", to: "ana" },
        { kind: "does", from: "ana", to: "dishes" },
        { kind: "needs", from: "dishes", to: "brush" },
      ],
    });

  const cards = (state: ViewState) => {
    const placed = layout(nestedGraph(), nested, state, { width: 1400, height: 900 });
    return new Map(
      placed.nodes.filter((node) => node.id.startsWith("kind:")).map((node) => [node.id, node]),
    );
  };

  it("marks what the focus actually touches as primary, and the rest as secondary", () => {
    const placed = cards(view({ focusId: "ana" }));
    // The kind you are IN is neither: it is the thing itself.
    expect(placed.get(kindCardId("member"))?.rank).toBeUndefined();
    expect(placed.get(kindCardId("member"))?.focused).toBe(true);
    // One declared edge away, in either direction.
    expect(placed.get(kindCardId("household"))?.rank).toBe("primary");
    expect(placed.get(kindCardId("chore"))?.rank).toBe("primary");
    // Further away, or not connected at all.
    expect(placed.get(kindCardId("tool"))?.rank).toBe("secondary");
    expect(placed.get(kindCardId("weather"))?.rank).toBe("secondary");
  });

  it("draws a secondary kind smaller than a primary one", () => {
    const placed = cards(view({ focusId: "ana" }));
    expect(placed.get(kindCardId("tool"))!.width).toBeLessThan(
      placed.get(kindCardId("chore"))!.width,
    );
  });

  it("nests a kind reached THROUGH another rather than beside it", () => {
    const placed = cards(view({ focusId: "ana" }));
    const brush = placed.get(kindCardId("tool"))!;
    // A tool is only reachable via a chore, so it hangs off the chore.
    expect(brush.nestedUnder).toBe(kindCardId("chore"));
    // Nothing reaches weather, so it hangs off nothing and keeps its own slot.
    expect(placed.get(kindCardId("weather"))!.nestedUnder).toBeUndefined();
  });

  it("puts a nested card behind the one it hangs off, peeking over its top", () => {
    const placed = cards(view({ focusId: "ana" }));
    const brush = placed.get(kindCardId("tool"))!;
    const chores = placed.get(kindCardId("chore"))!;
    // Behind means further, and further means higher on screen: the tuck
    // stands behind its parent with its bottom edge tucked behind the
    // parent's top, and its own label clear above it.
    expect(brush.x).toBeGreaterThan(chores.x);
    expect(brush.x).toBeLessThan(chores.x + chores.width);
    expect(brush.y).toBeLessThan(chores.y);
    expect(brush.y + brush.height).toBeGreaterThan(chores.y);
    expect(brush.y + brush.height).toBeLessThan(chores.y + chores.height);
    // Smaller, and further back within the plane.
    expect(brush.width).toBeLessThan(chores.width);
    expect(brush.depth!).toBeGreaterThan(chores.depth!);
  });

  it("ranks from the SCHEMA, so an unrelated edit never reshuffles the plane", () => {
    /*
     * Spatial memory is the whole claim of a constant strip. If ranking came
     * from the instances, adding one node could promote a kind and move
     * every card after it — the picture you remember would stop being the
     * picture you get.
     */
    const before = cards(view({ focusId: "ana" }));
    const busier = Graph.from(nested, {
      nodes: [
        { id: "home", kind: "household", label: "Home" },
        { id: "ana", kind: "member", label: "Ana" },
        { id: "bo", kind: "member", label: "Bo" },
        { id: "dishes", kind: "chore", label: "Dishes" },
        { id: "bins", kind: "chore", label: "Bins" },
        { id: "brush", kind: "tool", label: "Brush" },
        { id: "tue", kind: "weather", label: "Tuesday" },
      ],
      edges: [
        { kind: "holds", from: "home", to: "ana" },
        { kind: "does", from: "ana", to: "dishes" },
        { kind: "does", from: "bo", to: "bins" },
        { kind: "needs", from: "dishes", to: "brush" },
      ],
    });
    const after = new Map(
      layout(busier, nested, view({ focusId: "ana" }), { width: 1400, height: 900 })
        .nodes.filter((node) => node.id.startsWith("kind:"))
        .map((node) => [node.id, node]),
    );
    for (const [id, card] of before) {
      expect([id, after.get(id)!.rank, after.get(id)!.x, after.get(id)!.y]).toEqual([
        id,
        card.rank,
        card.x,
        card.y,
      ]);
    }
  });

  it("ranks nothing when nothing is focused, because there is no 'related to'", () => {
    const placed = cards(view({}));
    for (const card of placed.values()) expect(card.rank).toBeUndefined();
  });

  it("keeps every card inside the canvas, nested ones included", () => {
    const placed = layout(nestedGraph(), nested, view({ focusId: "ana" }), {
      width: 1400,
      height: 900,
    });
    for (const node of placed.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(1400);
      expect(node.y + node.height).toBeLessThanOrEqual(900);
    }
  });
});

/**
 * The HORIZON. A kind that declares a lifecycle aggregates over "now" by
 * default: retired members leave the counts but never the graph, the count
 * advertises them ("+N past"), and widening the horizon is view state — a
 * stop, not a setting.
 */
describe("derivations aggregate over the horizon", () => {
  const pact = defineNode("pact", {
    fields: z.object({ label: z.string(), status: z.enum(["live", "lapsed"]) }),
    plural: "Pacts",
    edges: { binds: { to: ["person"], description: "who it binds" } },
    lifecycle: { field: "status", retired: ["lapsed"] },
  });
  const horizonSchema = createSchema([person, duty, pact]);

  const horizonGraph = () =>
    Graph.from(horizonSchema, {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "quiet", kind: "pact", label: "Quiet hours", status: "live" },
        { id: "screens", kind: "pact", label: "Screen truce", status: "lapsed" },
        { id: "summer", kind: "pact", label: "Summer split", status: "lapsed" },
      ],
      edges: [
        { kind: "binds", from: "quiet", to: "ana" },
        { kind: "binds", from: "screens", to: "ana" },
      ],
    });

  const pactCard = (state: ViewState) =>
    layout(horizonGraph(), horizonSchema, state).nodes.find(
      (node) => node.id === kindCardId("pact"),
    );

  it("counts only current members on the kind card, and advertises the rest", () => {
    const card = pactCard(view({}));
    expect(card?.aggregate?.memberIds).toEqual(["quiet"]);
    expect(card?.aggregate?.retired).toBe(2);
  });

  it("widens when the view says past — and the advert goes quiet", () => {
    const card = pactCard(view({ past: true }));
    expect(card?.aggregate?.memberIds?.length).toBe(3);
    expect(card?.aggregate?.retired).toBeUndefined();
  });

  it("keeps retired nodes off the raised plane", () => {
    const raised = (state: ViewState) =>
      layout(horizonGraph(), horizonSchema, state)
        .nodes.filter((node) => node.plane === 1 && !node.aggregate)
        .map((node) => node.id)
        .sort();
    expect(raised(view({ focusId: "ana", relation: "pact" }))).toEqual(["quiet"]);
    expect(raised(view({ focusId: "ana", relation: "pact", past: true }))).toEqual([
      "quiet",
      "screens",
      "summer",
    ]);
  });

  it("survives a crowd: three hundred retired nodes cost a count, not cards", () => {
    const nodes: Parameters<typeof Graph.from>[1]["nodes"] = [
      { id: "ana", kind: "person", label: "Ana" },
    ];
    for (let i = 0; i < 320; i++) {
      nodes.push({
        id: `p${i}`,
        kind: "pact",
        label: `Pact ${i}`,
        status: i < 20 ? "live" : "lapsed",
      });
    }
    const big = Graph.from(horizonSchema, { nodes, edges: [] });
    const card = layout(big, horizonSchema, view({})).nodes.find(
      (node) => node.id === kindCardId("pact"),
    );
    expect(card?.aggregate?.memberIds?.length).toBe(20);
    expect(card?.aggregate?.retired).toBe(300);
  });

  it("is a stop: past survives the URL round trip", () => {
    const state = view({ focusId: "ana", past: true });
    expect(fromUrl(toUrl(state)).past).toBe(true);
    expect(sameView(state, fromUrl(toUrl(state)))).toBe(true);
    expect(fromUrl(toUrl(view({ focusId: "ana" }))).past).toBeUndefined();
  });
});

/**
 * MODULES OFF are not drawn at all — no card, no members, no raised plane,
 * and unlike the horizon, no advert: a workspace that turned a module off
 * scoped its interface, it did not archive anything.
 */
describe("hidden kinds leave the picture entirely", () => {
  const opts = { hiddenKinds: ["duty"] };

  it("draws no kind card for a hidden kind", () => {
    const result = layout(graph(), schema, view({ focusId: "week-1" }), opts);
    expect(result.nodes.find((node) => node.id === kindCardId("duty"))).toBeUndefined();
    expect(result.nodes.find((node) => node.id === kindCardId("person"))).toBeDefined();
  });

  it("keeps hidden nodes off the raised plane and out of connectors", () => {
    const result = layout(graph(), schema, view({ focusId: "ana", relation: "assigned-to" }), opts);
    expect(result.nodes.find((node) => node.id === "morning")).toBeUndefined();
    expect(result.connectors.filter((c) => c.to === "morning" || c.to === kindCardId("duty"))).toEqual([]);
  });

  it("lands a hidden focus on the default view rather than a void", () => {
    const hiddenFocus = layout(graph(), schema, view({ focusId: "morning" }), opts);
    const plain = layout(graph(), schema, view({}), opts);
    expect(hiddenFocus.nodes.map((n) => n.id).sort()).toEqual(plain.nodes.map((n) => n.id).sort());
  });
});

/**
 * A LINE IS A THING — when it stands for exactly one edge. A connector
 * whose drawn endpoints are the real nodes carries the edge it stands for;
 * a line into a group bundles many and stays scenery.
 */
describe("a line that stands for one edge says so", () => {
  it("marks any line that stands for one edge — even one drawn to a group", () => {
    const expanded = layout(
      graph(),
      schema,
      toggleExpanded(view({ focusId: "week-1", relation: "person" }), kindCardId("duty")),
    );
    const direct = expanded.connectors.find((c) => c.id === "assigned-to:ana:morning");
    expect(direct?.single).toEqual({ from: "ana", to: "morning" });

    // Ana's line into the Runs group carries her ONE run: that line IS that
    // edge, and it takes a click even though the drawn end is a card.
    const bundled = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    const ofOne = bundled.connectors.find(
      (c) => c.from === "ana" && c.to === kindCardId("duty"),
    );
    expect(ofOne?.single).toEqual({ from: "ana", to: "morning" });

    // A second real edge arriving on the same line withdraws the claim —
    // "some of these" is not an honest thing to act on.
    const mutated = graph();
    mutated.applyPrimitives([
      { op: "add-edge", edge: { kind: "assigned-to", from: "ana", to: "evening" } },
    ]);
    const many = layout(mutated, schema, view({ focusId: "week-1", relation: "person" }));
    const withdrawn = many.connectors.find(
      (c) => c.from === "ana" && c.to === kindCardId("duty") && c.kind === "assigned-to",
    );
    expect(withdrawn).toBeDefined();
    expect(withdrawn?.single).toBeUndefined();
  });

  it("carries EVERY edge a line stands for, so a renderer can unpick the bundle", () => {
    /*
     * A line into a group used to know only that it was a bundle. The week
     * draws each of its sessions as a span, and a line to a drill should
     * start at the session's span rather than at the panel's centre — which
     * needs the real ends of each edge, not just the drawn ends of the line.
     */
    const mutated = graph();
    mutated.applyPrimitives([
      { op: "add-edge", edge: { kind: "assigned-to", from: "ana", to: "evening" } },
    ]);
    const many = layout(mutated, schema, view({ focusId: "week-1", relation: "person" }));
    const bundle = many.connectors.find(
      (c) => c.from === "ana" && c.to === kindCardId("duty") && c.kind === "assigned-to",
    );
    expect(bundle?.edges).toEqual([
      { from: "ana", to: "morning" },
      { from: "ana", to: "evening" },
    ]);
    // The one-edge case is the same list, one long — and says so twice.
    const one = layout(graph(), schema, view({ focusId: "week-1", relation: "person" }));
    const ofOne = one.connectors.find((c) => c.from === "ana" && c.to === kindCardId("duty"));
    expect(ofOne?.edges).toEqual([{ from: "ana", to: "morning" }]);
    expect(ofOne?.single).toEqual(ofOne?.edges[0]);
  });

  it("round-trips an edge selection through the URL like everything else", () => {
    const id = edgeSelectionId("assigned-to", "ana", "morning");
    expect(edgeOfSelection(id)).toEqual({ kind: "assigned-to", from: "ana", to: "morning" });
    expect(edgeOfSelection("ana")).toBeNull();
    const state = withSelection(withFocus(EMPTY_VIEW, "week-1"), [id]);
    expect(fromUrl(toUrl(state)).selection).toEqual([id]);
  });

  /*
   * `ctx.freshId(label, kind)` mints "item:buy-milk" — so every scaffolded
   * app's node ids carry the separator this id is built out of. Split three
   * ways they came back as five, the selection was not recognised as an edge
   * at all, and a clicked line opened a pane titled with the raw address
   * saying nothing could be done with it.
   */
  it("round-trips ends whose ids carry the separator", () => {
    const id = edgeSelectionId("assigned-to", "item:buy-milk", "owner:ana");
    expect(edgeOfSelection(id)).toEqual({
      kind: "assigned-to",
      from: "item:buy-milk",
      to: "owner:ana",
    });
    const state = withSelection(EMPTY_VIEW, [id]);
    expect(fromUrl(toUrl(state)).selection).toEqual([id]);
    expect(edgeOfSelection(fromUrl(toUrl(state)).selection[0]!)).toEqual({
      kind: "assigned-to",
      from: "item:buy-milk",
      to: "owner:ana",
    });
  });
});

describe("open districts stay at altitude", () => {
  it("an in-stack address cannot carry a district expansion", () => {
    // History and bookmarks recorded before the fix keep offering these.
    const carried = fromUrl("#focus=week-1&expand=kind:duty,aggregate:person");
    expect(carried.expanded).toEqual(["aggregate:person"]);
    const upstairs = fromUrl("#overview=1&expand=kind:duty");
    expect(upstairs.expanded).toEqual(["kind:duty"]);
  });


  it("descending drops kind-card expansions and keeps the rest", () => {
    const up = toggleExpanded(
      toggleExpanded(view({ focusId: "week-1", overview: true }), kindCardId("duty")),
      "aggregate:person",
    );
    const down = withOverview(up, false);
    expect(down.expanded).toEqual(["aggregate:person"]);
    // The overview stop itself is untouched: back up, the district reopens.
    expect(up.expanded).toContain(kindCardId("duty"));
  });
});

describe("going deeper into a card", () => {
  /*
   * Double-clicking a group card once landed on `focus=kind:person&zoom=1`:
   * a kind card's own id, which no layout resolves, so the scene emptied
   * out with the card's name in the URL. Deeper into a kind card means the
   * GROUP: zoomed as a place on the ground, opened as a district up high.
   */
  it("zooms a record, and the same gesture zooms it back out", () => {
    const zoomed = withJackIn({ ...EMPTY_VIEW, relation: "duty" }, "ana");
    expect(zoomed.focusId).toBe("ana");
    expect(zoomed.zoom).toBe(true);
    expect(zoomed.relation).toBeNull();
    expect(withJackIn(zoomed, "ana").zoom).toBeUndefined();
  });

  it("zooms into a kind card's group on the ground, never the card itself", () => {
    const zoomed = withJackIn({ ...EMPTY_VIEW, focusId: aggregateId("duty") }, kindCardId("person"));
    expect(zoomed.focusId).toBe(aggregateId("person"));
    expect(zoomed.zoom).toBe(true);
    // The zoomed place is drawn: a plane-0 group, not an empty scene.
    const drawn = layout(graph(), schema, zoomed, { width: 1280, height: 800 });
    expect(drawn.nodes.find((node) => node.id === aggregateId("person"))?.plane).toBe(0);
    // Again on the zoomed place zooms back out and stays on the group.
    const out = withJackIn(zoomed, aggregateId("person"));
    expect(out.zoom).toBeUndefined();
    expect(out.focusId).toBe(aggregateId("person"));
  });

  it("opens a district from altitude, and closes it again", () => {
    const up = withOverview(EMPTY_VIEW, true);
    const opened = withJackIn(up, kindCardId("person"));
    expect(opened.expanded).toContain(kindCardId("person"));
    expect(opened.focusId).toBeNull();
    expect(opened.zoom).toBeUndefined();
    expect(layout(graph(), schema, opened, { width: 1280, height: 800 }).nodes.find((node) => node.id === kindCardId("person"))?.opened).toBe(true);
    expect(withJackIn(opened, kindCardId("person")).expanded).not.toContain(kindCardId("person"));
  });

  /*
   * A district explodes into a ring of chips because a bag of names is the
   * best a generic card can do with its members. A kind with a lens over it
   * has something better — and the card already draws a ◆ to say so — yet
   * going deeper burst it into chips anyway, trading the designed picture
   * for the fallback it exists to improve on.
   */
  /*
   * A place you are offered must be a place you can go. A lens registered
   * over a kind is listed by name in the bar from the first paint — and
   * pressing it on an empty graph changed the address and drew nothing at
   * all, because every branch that places a focused group required the group
   * to have members. The empty picture is exactly the one a blank app needs.
   */
  it("draws a group you have gone to even when nobody is in it", () => {
    const bare = new Graph([], []);
    const at = { ...EMPTY_VIEW, focusId: aggregateId("person"), zoom: true };
    const placed = layout(bare as never, schema, at, { width: 1280, height: 800 });
    const card = placed.nodes.find((node) => node.id === aggregateId("person"));
    expect(card).toBeDefined();
    expect(card?.plane).toBe(0);
    expect(card?.aggregate?.memberIds).toEqual([]);
    expect(card?.aggregate?.label).toBe("People");
  });

  it("still refuses an address whose kind nobody declared", () => {
    const at = { ...EMPTY_VIEW, focusId: aggregateId("unicorn"), zoom: true };
    const placed = layout(graph(), schema, at, { width: 1280, height: 800 });
    expect(placed.nodes.some((node) => node.plane === 0)).toBe(false);
    expect(placed.nodes.some((node) => node.id === aggregateId("unicorn"))).toBe(false);
  });

  it("goes INTO the picture a kind has of its own, leaving the district shut", () => {
    const up = withOverview(EMPTY_VIEW, true);
    const gone = withJackIn(up, kindCardId("person"), { ownPicture: true });
    expect(gone.expanded ?? []).not.toContain(kindCardId("person"));
    expect(gone.focusId).toBe(aggregateId("person"));
    expect(gone.zoom).toBe(true);
    // And a kind without one still opens in place, from the same gesture.
    expect(withJackIn(up, kindCardId("person"), { ownPicture: false }).expanded).toContain(
      kindCardId("person"),
    );
  });
});

describe("a move belongs to the stop it was made at", () => {
  /*
   * A pin is stored by node id in canvas pixels, which mean nothing once
   * the picture is a different one: the card dragged as the focus was held
   * at the focus's old coordinates as a neighbour of the next stop, drawn
   * straight over the new focus. A new stop starts where the layout puts
   * things; the old stop's address still carries the arrangement.
   */
  const arranged = withPan(withPin(view({ focusId: "week-1" }), "bo", { x: 12, y: 34 }), { x: 40, y: 0 });

  it("stays while the stop stays", () => {
    expect(withFocus(arranged, "week-1").pins).toEqual({ bo: { x: 12, y: 34 } });
    expect(withRelation(arranged, "person").pins).toEqual({ bo: { x: 12, y: 34 } });
    expect(toggleExpanded(arranged, "aggregate:duty").pan).toEqual({ x: 40, y: 0 });
  });

  it("is left behind by a new focus", () => {
    const next = withFocus(arranged, "ana");
    expect(next.pins).toEqual({});
    expect(next.pan).toBeUndefined();
    expect(layout(graph(), schema, next).nodes.some((n) => n.pinned)).toBe(false);
  });

  it("is left behind by rising, descending, and zooming", () => {
    const up = withOverview(arranged, true);
    expect(up.pins).toEqual({});
    const rearranged = withPin(up, kindCardId("person"), { x: 5, y: 6 });
    expect(withOverview(rearranged, false).pins).toEqual({});
    expect(withZoom(arranged, true).pins).toEqual({});
    expect(withZoom(withZoom(withPin(arranged, "bo", { x: 1, y: 2 }), true), false).pins).toEqual({});
    // Already zoomed: zooming "in" again is the same stop.
    const zoomed = withPin(withZoom(arranged, true), "bo", { x: 1, y: 2 });
    expect(withZoom(zoomed, true).pins).toEqual({ bo: { x: 1, y: 2 } });
  });

  it("is left behind by going deeper", () => {
    expect(withJackIn(arranged, "ana").pins).toEqual({});
  });
});

describe("a relation is captioned from the focus", () => {
  it("reads the declaring side's words along an outgoing edge", () => {
    // From Ana, the morning run is one of the runs she does.
    const result = layout(graph(), schema, view({ focusId: "ana" }));
    expect(result.nodes.find((n) => n.id === "morning")?.via).toEqual({
      edgeKind: "assigned-to",
      direction: "out",
      description: "the runs they do",
    });
  });

  it("reads the inverse along an incoming edge, never the far end's words", () => {
    // From the run, Ana is who does it — not "the runs they do" hung over
    // her as though she were a run, which is what the person's words
    // said there before the inverse was read.
    const result = layout(graph(), schema, view({ focusId: "morning" }));
    expect(result.nodes.find((n) => n.id === "ana")?.via).toEqual({
      edgeKind: "assigned-to",
      direction: "in",
      description: "who does the run",
    });
  });
});

/*
 * WHAT A NODE JUDGES, and a CROWD in the band. A rule has no edges; its
 * violations name what it is about, and those are its neighbourhood. And a
 * band never squeezes a slot below a chip's width: past that it wraps.
 */
describe("the relation band", () => {
  const crowd = () =>
    Graph.from(schema, {
      nodes: [
        { id: "week-1", kind: "week", label: "This week" },
        ...Array.from({ length: 12 }, (_, i) => ({ id: `person-${i}`, kind: "person", label: `Person ${i}` })),
      ],
      edges: [],
    });

  it("wraps a crowd into rows rather than squeezing every slot under a chip", () => {
    const result = layout(crowd(), schema, view({ focusId: "week-1", relation: "person" }), { width: 1200, height: 800 });
    const band = result.nodes.filter((node) => node.plane === 1);
    expect(band).toHaveLength(12);
    for (const slot of band) expect(slot.width).toBeGreaterThanOrEqual(150);
    expect(new Set(band.map((slot) => Math.round(slot.y))).size).toBeGreaterThan(1);
    for (const a of band) for (const b of band) {
      if (a === b) continue;
      const overlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      expect(overlap, `${a.id} over ${b.id}`).toBe(0);
    }
  });

  it("raises what the focus judges as its neighbourhood, captioned, and a named kind filters it", () => {
    const g = Graph.from(schema, {
      nodes: [
        { id: "rule-1", kind: "week", label: "A rule" },
        { id: "ana", kind: "person", label: "Ana" },
        { id: "bo", kind: "person", label: "Bo" },
        { id: "cass", kind: "person", label: "Cass" },
        { id: "morning", kind: "duty", label: "Morning run" },
      ],
      edges: [],
    });
    const judged = { "rule-1": ["ana", "morning", "rule-1"] };
    const all = layout(g, schema, view({ focusId: "rule-1" }), { judged });
    const band = all.nodes.filter((node) => node.plane === 1);
    expect(band.map((node) => node.id).sort()).toEqual(["ana", "morning"]);
    expect(band[0]?.via).toMatchObject({ edgeKind: "judges", description: "what it finds wrong" });
    // A named kind filters what it judges: Ana, not every person.
    const people = layout(g, schema, view({ focusId: "rule-1", relation: "person" }), { judged });
    expect(people.nodes.filter((node) => node.plane === 1).map((node) => node.id)).toEqual(["ana"]);
    // Nothing judged and no edge of that kind: the kind is still raised wholesale.
    const wholesale = layout(g, schema, view({ focusId: "rule-1", relation: "person" }));
    expect(wholesale.nodes.filter((node) => node.plane === 1).map((node) => node.id).sort()).toEqual(["ana", "bo", "cass"]);
  });
});

/**
 * A DISTRICT IS READ, NOT GLANCED AT — so the row never squeezes a name
 * below a word.
 *
 * `fit` divided the span by the count with no floor. Measured in a browser:
 * a district card holds a seven- or eight-letter plural on one line down to
 * about 132px at a 16px root and breaks between 132 and 98. Four kinds at
 * 390px gave 46px cards and five lines of "Lists"; thirteen kinds in a 700px
 * host gave 72px and three lines of "Rules". The chips already shed the
 * count and the disclosure before the label; the missing step was shedding
 * the ROW.
 */
describe("a row of districts that cannot hold them all", () => {
  const many = Array.from({ length: 12 }, (_, index) =>
    defineNode(`kind${index}`, { fields: z.object({ label: z.string() }), plural: `Kind${index}s` }),
  );
  const wide = createSchema(many as never);
  const populated = () =>
    Graph.from(wide as never, {
      nodes: many.map((kind, index) => ({ id: `n${index}`, kind: kind.kind, label: "A" })) as never,
      edges: [],
    });
  const districts = (width: number) =>
    layout(populated(), wide as never, EMPTY_VIEW, { width, height: 800 }).nodes.filter(
      (node) => node.plane === 2,
    );

  it("gives every card it draws a width its name can be read at", () => {
    for (const width of [390, 700, 1000, 1560]) {
      for (const card of districts(width)) {
        expect(card.width, `${width}px`).toBeGreaterThanOrEqual(132);
      }
    }
  });

  it("keeps every card inside the canvas, which is what forces the shedding", () => {
    for (const width of [390, 700, 1000]) {
      for (const card of districts(width)) {
        expect(card.x, `${width}px`).toBeGreaterThanOrEqual(0);
        expect(card.x + card.width, `${width}px`).toBeLessThanOrEqual(width);
      }
    }
  });

  it("names the ones it left out on one card, rather than dropping them", () => {
    const row = districts(700);
    const beyond = row.find((card) => card.beyond !== undefined)!;
    expect(beyond).toBeDefined();
    const shown = row.filter((card) => card.beyond === undefined).map((card) => card.kind);
    /* Every kind is either drawn or named: the map is still complete. */
    expect([...shown, ...beyond.beyond!].sort()).toEqual(many.map((kind) => kind.kind).sort());
  });

  it("sheds nothing when the row can hold them all", () => {
    const row = districts(2400);
    expect(row.some((card) => card.beyond !== undefined)).toBe(false);
    expect(row).toHaveLength(12);
  });

  it("does not shed at altitude, where the ring has the room", () => {
    const row = layout(populated(), wide as never, { ...EMPTY_VIEW, overview: true }, {
      width: 700,
      height: 800,
    }).nodes.filter((node) => node.plane === 2);
    expect(row.some((card) => card.beyond !== undefined)).toBe(false);
    expect(row).toHaveLength(12);
  });
});
