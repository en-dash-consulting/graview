// @vitest-environment jsdom
import { createSchema, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OverviewButton, Places, registerDefaultViews } from "../../src/index.js";

/*
 * The tenth walk's callouts had two titled pictures, "The logbook" and "Who
 * went where". From the map the control said "Close the map, down to The
 * logbook", and pressing it drew "Who went where", which the bar then marked
 * as where you were: the district draws the LAST picture registered for its
 * kind, and the control named the first.
 */
const callout = defineNode("callout", { fields: z.object({ label: z.string() }), plural: "Callouts" });
const schema = createSchema([callout]);
const Logbook = (() => <div>the logbook</div>) as ViewComponent<typeof schema>;
const Grid = (() => <div>who went where</div>) as ViewComponent<typeof schema>;
const views = () =>
  registerDefaultViews(schema, createViews(schema))
    .register("callout", { cardinality: "many", fidelity: "full" }, Logbook, { title: "The logbook" })
    .register("callout", { cardinality: "many", fidelity: "full" }, Grid, { title: "Who went where" });

describe("down from the map", () => {
  it("says the picture the district draws, which the bar marks once you land", () => {
    const store = new Store({ schema, mutations: [], invariants: [] });
    const fromAbove = renderToStaticMarkup(
      <GraviewProvider store={store} views={views()} initialView={{ ...EMPTY_VIEW, overview: true, focusId: aggregateId("callout") }}>
        <OverviewButton />
      </GraviewProvider>,
    );
    const landed = renderToStaticMarkup(
      <GraviewProvider store={store} views={views()} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("callout") }}>
        <Places />
      </GraviewProvider>,
    );
    expect(fromAbove).toContain("Close the map, down to Who went where");
    expect(landed).toMatch(/who-went-where"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-testid="place-who-went-where"/);
  });
});
