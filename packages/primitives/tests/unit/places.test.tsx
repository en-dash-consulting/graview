// @vitest-environment jsdom
import { createSchema, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Places, registerDefaultViews, Shell } from "../../src/index.js";

const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
const schema = createSchema([person, duty]);
const store = () => new Store({ schema, mutations: [], invariants: [] });
const Grid = (() => <div>a grid</div>) as ViewComponent<typeof schema>;

const views = (titled: boolean) => {
  const base = registerDefaultViews(schema, createViews(schema));
  return titled
    ? base.register("person", { cardinality: "many", fidelity: "full" }, Grid, { title: "Who does what" })
    : base;
};

const render = (titled: boolean, view = EMPTY_VIEW) =>
  renderToStaticMarkup(
    <GraviewProvider store={store()} views={views(titled)} initialView={view}>
      <Places />
    </GraviewProvider>,
  );

describe("the named places", () => {
  /*
   * A lens registered over a group was only reachable by focusing that
   * group: click into one member and the picture was gone, with nothing on
   * screen to say it existed. A titled group view is a place — listed by
   * name, pressable from anywhere, pressed while you are there.
   */
  it("lists a titled group view by name, and nothing for an app without one", () => {
    expect(render(false)).toBe("");
    const html = render(true);
    expect(html).toContain('aria-label="Places"');
    expect(html).toContain("Who does what");
    expect(html).toContain('data-testid="place-who-does-what"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("is pressed while the group is the focus on the ground, not from altitude", () => {
    expect(render(true, { ...EMPTY_VIEW, focusId: aggregateId("person") })).toContain('aria-pressed="true"');
    expect(render(true, { ...EMPTY_VIEW, focusId: aggregateId("person"), overview: true })).toContain('aria-pressed="false"');
  });

  it("sits in the shell's bar", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={store()} views={views(true)} initialView={{ ...EMPTY_VIEW, overview: true }}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
      </GraviewProvider>,
    );
    expect(html).toContain('data-testid="place-who-does-what"');
  });
});
