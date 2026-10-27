import { createSchema, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCalendarLens, daysCovered, placeOnCalendar } from "../../src/index.js";

/**
 * A CALENDAR DRAWS A MONTH ALONE ACROSS ITS MONTH, AND SAYS WHAT KNOWS
 * ONLY ITS YEAR (Roadmap f-partial-dates-arithmetic). A date may be
 * `2016-05` or `2006` (0.1.56), and the calendar read neither — both fell
 * off the grid without a word. A month alone is now an all-month bar, first
 * day to last; a year alone is still not placed, since a bar across a whole
 * year says nothing a grid can place and a day picked for it would be a
 * false exact date, and the lens says once how many it left off.
 */
const event = defineNode("event", { fields: z.object({ label: z.string(), on: z.string().optional(), until: z.string().optional() }), plural: "Events" });
const schema = createSchema([event]);
const bindings = { event: { start: "on", end: "until" } };
const nodes = [
  { id: "e-month", kind: "event", label: "Known to the month", on: "2016-05" },
  { id: "e-span", kind: "event", label: "Spring", on: "2016-03", until: "2016-05" },
  { id: "e-day", kind: "event", label: "Known to the day", on: "2016-05-04" },
  { id: "e-year", kind: "event", label: "Known to the year", on: "2016" },
  { id: "e-year-too", kind: "event", label: "Also to the year", on: "2006" },
];

describe("the days a value covers on the calendar", () => {
  it("is one day for a day, the whole month for a month alone, and nothing for a year alone", () => {
    expect(daysCovered("2016-05-04")).toEqual({ from: "2016-05-04", to: "2016-05-04" });
    expect(daysCovered("2016-05-04T09:30")).toEqual({ from: "2016-05-04", to: "2016-05-04" });
    expect(daysCovered("2016-05")).toEqual({ from: "2016-05-01", to: "2016-05-31" });
    expect(daysCovered("2016")).toBeNull();
    expect(daysCovered(undefined)).toBeNull();
  });
});

describe("a month alone, placed", () => {
  it("is an all-day entry from the first of its month to the last", () => {
    const placed = placeOnCalendar(nodes[0] as never, bindings, schema);
    expect(placed).toMatchObject({ id: "e-month", from: "2016-05-01", to: "2016-05-31", allDay: true, at: null });
  });

  it("runs to the last day of a month it ends in", () => {
    expect(placeOnCalendar(nodes[1] as never, bindings, schema)).toMatchObject({ from: "2016-03-01", to: "2016-05-31" });
  });

  it("leaves a year alone off", () => {
    expect(placeOnCalendar(nodes[3] as never, bindings, schema)).toBeNull();
  });
});

describe("the calendar lens over such dates", () => {
  const lens = createCalendarLens<typeof schema>({ bindings, today: "2016-05-10", range: "month" });
  const html = renderToStaticMarkup(
    <GraviewProvider
      store={new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges: [] } as never })}
      views={createViews(schema)}
      initialView={{ ...EMPTY_VIEW, focusId: aggregateId("event") }}
    >
      <lens.View nodes={nodes as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
    </GraviewProvider>,
  );
  const picks = [...html.matchAll(/data-graview-pick="([^"]+)"/g)].map((match) => match[1]);

  it("draws the month alone and the day, and not the years", () => {
    expect(picks).toContain("e-month");
    expect(picks).toContain("e-day");
    expect(picks).not.toContain("e-year");
    expect(picks).not.toContain("e-year-too");
  });

  it("says once how many know only their year", () => {
    expect(html).toContain('data-testid="calendar-year-only"');
    expect(html).toContain("2 know only their year, so they are not placed.");
  });

  it("says nothing of it when every date is placed", () => {
    const placed = renderToStaticMarkup(
      <GraviewProvider
        store={new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: nodes.slice(0, 3), edges: [] } as never })}
        views={createViews(schema)}
        initialView={{ ...EMPTY_VIEW, focusId: aggregateId("event") }}
      >
        <lens.View nodes={nodes.slice(0, 3) as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    expect(placed).not.toContain("calendar-year-only");
  });
});
