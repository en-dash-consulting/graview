import { createSchema, defineNode, isoDate, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCalendarLens } from "../../src/index.js";
import { declaredLensView } from "../../src/declared-lenses.js";

/**
 * A CALENDAR THAT NAMES NO DAY OPENS ON THE STORE'S.
 *
 * A calendar kept from the ask field ("show tasks as a calendar") and one
 * declared without a `today` opened on the reader's clock, so an app pinned
 * to the day its example is written around — the day its rules call
 * "late" and the ask field calls "this week" — opened its calendars on an
 * empty month somewhere else. The store says what day it is
 * (`Store.today()`); a calendar that names none opens there.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), due: isoDate.optional() }), plural: "Tasks" });
const schema = createSchema([task]);
const nodes = [{ id: "t1", kind: "task", label: "Pay the deposit", due: "2026-09-01" }];
const store = (today?: string) =>
  new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges: [] } as never, ...(today ? { invariantOptions: { context: { today } } } : {}) });

const draw = (View: (props: never) => unknown, today?: string) =>
  renderToStaticMarkup(
    <GraviewProvider store={store(today)} views={createViews(schema)} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("task") }}>
      {/* @ts-expect-error a lens's view, drawn bare */}
      <View nodes={nodes as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
    </GraviewProvider>,
  );

const month = (html: string) => /(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/i.exec(html)?.[0]?.toLowerCase();

describe("a calendar that names no day", () => {
  it("opens on the store's own day", () => {
    const lens = createCalendarLens<typeof schema>({ bindings: { task: { start: "due" } }, range: "month" });
    expect(month(draw(lens.View as never, "2026-09-01"))).toBe("september 2026");
    expect(draw(lens.View as never, "2026-09-01")).toContain('data-graview-pick="t1"');
  });

  it("opens on the store's day when it is declared without one, as a kept lens is", () => {
    const View = declaredLensView({ index: 0, lens: "calendar", title: "Tasks by month", as: "tasks-by-month", kinds: ["task"], options: { bindings: { task: { start: "due" } }, range: "month" } });
    expect(month(draw(View as never, "2031-02-11"))).toBe("february 2031");
  });

  it("keeps a day the app names over the store's", () => {
    const lens = createCalendarLens<typeof schema>({ bindings: { task: { start: "due" } }, range: "month", today: "2027-05-10" });
    expect(month(draw(lens.View as never, "2026-09-01"))).toBe("may 2027");
  });
});
