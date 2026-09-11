import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId, kindCardId } from "@graview/layout";
import { GraviewProvider, Scene, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createTimelineLens,
  hueFor,
  placeOnTimeline,
  registerDefaultViews,
  TimelineBindingError,
  TimelineView,
  TIMELINE_REQUIRED_ROLES,
} from "../../src/index.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string(), role: z.string() }),
  plural: "People",
  edges: { "assigned-to": { to: ["duty"], description: "who does the run" } },
});
const duty = defineNode("duty", {
  fields: z.object({
    label: z.string(),
    day: z.enum(["mon", "tue", "wed", "thu", "fri"]),
    leaveAt: z.number(),
    at: z.number(),
  }),
  plural: "Runs",
  fieldRoles: { start: "leaveAt", end: "at", day: "day" },
});
const block = defineNode("block", {
  fields: z.object({
    label: z.string(),
    days: z.array(z.enum(["mon", "tue", "wed", "thu", "fri"])),
    start: z.number(),
    end: z.number(),
  }),
  plural: "Blocks",
});
/** Declared but never given a view — the "new node kind" case. */
const vehicle = defineNode("vehicle", {
  fields: z.object({ label: z.string(), seats: z.number(), boosters: z.number() }),
  plural: "Vehicles",
});
const schema = createSchema([person, duty, block, vehicle]);

function store() {
  return new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana", role: "parent" },
        { id: "school", kind: "block", label: "School", days: ["mon", "tue"], start: 510, end: 900 },
        { id: "morning", kind: "duty", label: "Morning run", day: "mon", leaveAt: 490, at: 510 },
        { id: "pickup", kind: "duty", label: "Pickup", day: "tue", leaveAt: 880, at: 900 },
        { id: "estate", kind: "vehicle", label: "The estate", seats: 5, boosters: 2 },
      ],
      edges: [{ kind: "assigned-to", from: "ana", to: "morning" }],
    },
  });
}

const WEEK = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
];

const timeline = createTimelineLens<typeof schema>({
  // The app maps ITS OWN field names onto the lens's roles. The lens knows
  // nothing about duties, blocks, or minutes.
  bindings: {
    duty: { start: "leaveAt", end: "at", column: "day" },
    block: { start: "start", end: "end", columns: "days" },
  },
  columns: WEEK,
  extent: 1440,
  format: (at) => `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`,
});

function renderScene(view = EMPTY_VIEW) {
  return renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={view}
    >
      <Scene renderer="dom" />
    </GraviewProvider>,
  );
}

describe("a new node kind with no custom view", () => {
  it("renders at full fidelity from the declaration alone", () => {
    const html = renderScene({ ...EMPTY_VIEW, focusId: "estate" });
    expect(html).toContain("The estate");
    // Salient fields come straight off the declaration.
    expect(html).toContain("seats");
    expect(html).toContain("boosters");
  });

  it("renders at summary fidelity as a denser arrangement, not a smaller one", () => {
    const html = renderScene({ ...EMPTY_VIEW, focusId: "ana", relation: "vehicle" });
    // Plane 1 asks for summary: chips rather than a field list.
    expect(html).toContain('data-graview-primitive="chip"');
    expect(html).toContain("The estate");
  });

  it("renders at glyph fidelity as a single chip", () => {
    const html = renderScene({
      ...EMPTY_VIEW,
      focusId: "ana",
      expanded: [kindCardId("vehicle")],
    });
    expect(html).toContain("The estate");
    expect(html).toContain('data-graview-primitive="chip"');
  });

  it("renders as an aggregate when it is grouped", () => {
    const html = renderScene({ ...EMPTY_VIEW, focusId: "ana" });
    expect(html).toContain("Vehicles");
  });

  it("gives every kind a stable hue, so it looks the same everywhere", () => {
    expect(hueFor("vehicle")).toBe(hueFor("vehicle"));
    expect(hueFor("vehicle")).not.toBe(hueFor("person"));
  });
});

describe("the roster degrades honestly", () => {
  it("says how many more rather than truncating silently", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`,
      kind: "person",
      label: `P${i}`,
      role: "parent",
    }));
    const html = renderToStaticMarkup(
      <TimelineView
        nodes={many as never}
        label="Week"
        fidelity="summary"
        cardinality="many"
        mode="scene"
        selected={false}
        options={timeline.options}
      />,
    );
    expect(html).toContain("Week");
  });
});

describe("the timeline lens", () => {
  it("declares the roles an app must bind", () => {
    expect(TIMELINE_REQUIRED_ROLES).toEqual(["start", "end"]);
    expect(timeline.requiredRoles).toEqual(["start", "end"]);
  });

  it("reads spans through the app's own field names", () => {
    const s = store();
    const span = placeOnTimeline(s.graph.getNode("morning")!, timeline.bindings, schema)!;
    expect(span).toMatchObject({
      id: "morning",
      label: "Morning run",
      columnIds: ["mon"],
      start: 490,
      end: 510,
    });
  });

  it("places a node across several columns when the app binds a list", () => {
    const s = store();
    const span = placeOnTimeline(s.graph.getNode("school")!, timeline.bindings, schema)!;
    expect(span.columnIds).toEqual(["mon", "tue"]);
  });

  it("ignores a kind it was never told about", () => {
    const s = store();
    expect(placeOnTimeline(s.graph.getNode("ana")!, timeline.bindings, schema)).toBeNull();
  });

  it("says exactly which binding is missing, in the app's terms", () => {
    const s = store();
    expect(() =>
      placeOnTimeline(s.graph.getNode("morning")!, { duty: { start: "nope", end: "at" } }, schema),
    ).toThrow(TimelineBindingError);
    try {
      placeOnTimeline(s.graph.getNode("morning")!, { duty: { start: "nope", end: "at" } }, schema);
    } catch (error) {
      expect(String(error)).toContain('{ duty: { start: "<field name>" } }');
    }
  });

  it("draws a grid at full fidelity", () => {
    const s = store();
    const html = renderToStaticMarkup(
      <TimelineView
        nodes={s.graph.allNodes()}
        label="This week"
        fidelity="full"
        cardinality="many"
        mode="scene"
        selected={false}
        options={timeline.options}
        schema={schema}
      />,
    );
    // The axis is windowed to the data — everything here happens between
    // 08:10 and 15:00, so the grid does not spend two thirds of its height
    // on empty night.
    expect(html).toContain("07:25 – 15:45");
    expect(html).toContain("08:00");
    expect(html).toContain("15:00");
    expect(html).not.toContain("00:00");

    // A long block is a duration and gets the column.
    expect(html).toContain('data-graview-span="school"');
    // The block spans two columns, so it is placed twice.
    expect(html.match(/data-graview-span="school"/g)).toHaveLength(2);

    // A twenty-minute run is a MOMENT: a time-stamped marker in its own
    // strip, not a two-pixel sliver competing with the block for width.
    expect(html).toContain('data-graview-span="morning"');
    expect(html).toContain('data-graview-moment=""');
    expect(html).toContain("08:10");
  });

  it("switches to a denser summary rather than scaling down", () => {
    const s = store();
    const html = renderToStaticMarkup(
      <TimelineView
        nodes={s.graph.allNodes()}
        label="This week"
        fidelity="summary"
        cardinality="many"
        mode="scene"
        selected={false}
        options={timeline.options}
        schema={schema}
      />,
    );
    // No grid at all: one chip per day with its count, which stays legible
    // at a size where a scaled-down calendar would be mush.
    expect(html).not.toContain('data-graview-primitive="grid"');
    expect(html).toContain("Mon 2");
    expect(html).toContain("Wed 0");
  });

  it("collapses to a single chip at glyph fidelity", () => {
    const s = store();
    const html = renderToStaticMarkup(
      <TimelineView
        nodes={s.graph.allNodes()}
        label="This week"
        fidelity="glyph"
        cardinality="many"
        mode="scene"
        selected={false}
        options={timeline.options}
        schema={schema}
      />,
    );
    expect(html).toContain("This week · 3");
    expect(html).not.toContain('data-graview-primitive="panel"');
  });

  it("is built only from the primitives an app also has", async () => {
    // Not a stylistic point: a lens with private access would stop being a
    // worked example of the authoring API.
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../../src/lens/timeline.tsx", import.meta.url), "utf8"),
    );
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports.sort()).toEqual([
      "../default-views.js",
      "../primitives/index.js",
      "@graview/core",
      "@graview/react",
      "react",
    ]);
  });
});

describe("a node is never an island", () => {
  /*
   * Every edge declaration carries a description — "who does the run" — and
   * for a long time nothing read any of them. A detail view that lists
   * fields and says nothing about what the thing is connected to is a record
   * dump, not an interface onto a graph.
   */
  it("names each relationship with the schema's own description", () => {
    const html = renderScene({ ...EMPTY_VIEW, focusId: "ana" });
    expect(html).toContain("who does the run");
  });

  it("makes each neighbour a target, so reaching it is one click", () => {
    const html = renderScene({ ...EMPTY_VIEW, focusId: "ana" });
    expect(html).toContain('data-graview-pick="morning"');
  });

  it("says so plainly when a node really has no connections", () => {
    const html = renderScene({ ...EMPTY_VIEW, focusId: "estate" });
    expect(html).toContain("Nothing is connected to this vehicle yet.");
  });
});

describe("the timeline's spans are things, not decoration", () => {
  it("marks every span as the node it draws", () => {
    const html = renderToStaticMarkup(
      <TimelineView
        nodes={store().graph.allNodes()}
        label="This week"
        fidelity="full"
        cardinality="many"
        mode="scene"
        selected={false}
        options={timeline.options}
        schema={schema}
      />,
    );
    expect(html).toContain('data-graview-pick="school"');
    expect(html).toContain('data-graview-pick="morning"');
  });
});

/**
 * The other half of ranking: the layout draws a secondary kind smaller and
 * further back, and the CARD has to look like a quieter card rather than a
 * full-size one that shrank.
 */
/*
 * A district's count says "⚠ 1". Opening it to find out WHICH one is the
 * entire reason to open it — and every member chip came out unmarked, while
 * the same node drawn as a glyph elsewhere carried its warning.
 */
describe("an opened district says which member is in trouble", () => {
  const lowOnBoosters = {
    name: "enough-boosters",
    scope: { kind: "vehicle" } as const,
    repairs: [],
    evaluate: ({ subject }: { subject: never }) => {
      const node = subject as unknown as { id: string; label: string; boosters: number };
      return node.boosters >= 3
        ? []
        : [
            {
              invariant: "enough-boosters",
              subjectId: node.id,
              label: node.label,
              message: `${node.label} has ${node.boosters} boosters`,
              nodeIds: [node.id],
              repairs: [],
            },
          ];
    },
  };

  const opened = renderToStaticMarkup(
    <GraviewProvider
      store={
        new Store({
          schema,
          mutations: [],
          invariants: [lowOnBoosters],
          snapshot: {
            nodes: [
              { id: "ana", kind: "person", label: "Ana", role: "parent" },
              { id: "estate", kind: "vehicle", label: "The estate", seats: 5, boosters: 2 },
              { id: "van", kind: "vehicle", label: "The van", seats: 8, boosters: 4 },
            ],
            edges: [],
          },
        })
      }
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={{ ...EMPTY_VIEW, overview: true, expanded: [kindCardId("vehicle")] }}
    >
      <Scene renderer="dom" />
    </GraviewProvider>,
  );

  it("counts the trouble on the card", () => {
    expect(opened).toContain("⚠ 2");
  });

  it("marks the member that is in trouble, and only that one", () => {
    expect(opened).toContain("The estate ⚠");
    expect(opened).toContain("implicated in a problem");
    expect(opened).not.toContain("The van ⚠");
  });
});

describe("a kind card carries its rank", () => {
  const focusedOnAna = renderScene({ ...EMPTY_VIEW, focusId: "ana" });

  it("marks what the focus touches as primary and the rest as secondary", () => {
    // A person declares an edge to a duty; nothing declares one to a vehicle.
    expect(focusedOnAna).toContain('data-graview-rank="primary"');
    expect(focusedOnAna).toContain('data-graview-rank="secondary"');
  });

  it("says nothing about rank when nothing is focused", () => {
    expect(renderScene()).not.toContain("data-graview-rank");
  });

  it("still names a secondary kind, because it is somewhere you can go", () => {
    // Quieter, not hidden: the card keeps its name and its count.
    const card = focusedOnAna.slice(focusedOnAna.indexOf('data-graview-rank="secondary"'));
    // The style string grew when the card gained an opaque face; the label
    // still follows immediately after it.
    expect(card.slice(0, 1400)).toContain("Blocks");
    // And every kind is still on the plane, whatever its rank.
    for (const plural of ["People", "Runs", "Blocks", "Vehicles"]) {
      expect(focusedOnAna).toContain(plural);
    }
  });
});
