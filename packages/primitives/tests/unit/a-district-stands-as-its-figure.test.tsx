// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, Scene } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews } from "../../src/index.js";

/**
 * FROM ALTITUDE, A DISTRICT STANDS AS THE KIND'S OWN DRAWING.
 *
 * Every kind stood as the same isometric box, and the figure it declared was
 * an eighteen-pixel chip on the nameplate — the emphasis exactly backwards,
 * because the box is what every kind looks like and the drawing is the only
 * thing on the screen that says which kind this is. A city of identical
 * boxes with the labels removed is a city you cannot read at all.
 *
 * A kind with no figure keeps its box: nothing about a figure is required,
 * and an app that declares none is drawn exactly as it always was.
 */
const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  figure: "person",
  label: (node: { label: string }) => node.label,
});
const reason = defineNode("reason", {
  fields: z.object({ label: z.string() }),
  plural: "Reasons",
  label: (node: { label: string }) => node.label,
});
const schema = createSchema([person, reason]);

const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
afterEach(async () => {
  await act(async () => root.render(null));
});

const city = async () => {
  const store = new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "p1", kind: "person", label: "Ana" },
        { id: "r1", kind: "reason", label: "Because" },
      ] as never,
      edges: [],
    },
  });
  await act(async () => {
    root.render(
      <GraviewProvider
        store={store}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, overview: true }}
      >
        <Scene renderer="dom" />
      </GraviewProvider>,
    );
  });
};

describe("a district that has a figure", () => {
  it("stands as the drawing, where a district without one stands as a box", async () => {
    await city();
    const people = host.querySelector('[data-graview-view="kind:person"] .graview-kind-card');
    const reasons = host.querySelector('[data-graview-view="kind:reason"] .graview-kind-card');
    expect(people, "the people district is drawn").not.toBeNull();
    expect(reasons, "the reasons district is drawn").not.toBeNull();

    // The drawing IS the building: one landmark, and no anonymous block
    // behind or beside it.
    expect(people!.querySelectorAll(".graview-kind-landmark")).toHaveLength(1);
    expect(people!.querySelector(".graview-kind-landmark svg")).not.toBeNull();
    expect(people!.querySelectorAll(".graview-iso-roof")).toHaveLength(0);

    // And a kind with nothing declared has no landmark and no anonymous
    // block either: its members stand as buildings on the plot the scene
    // draws under the card, so the card itself carries only the nameplate.
    expect(reasons!.querySelectorAll(".graview-kind-landmark")).toHaveLength(0);
    expect(reasons!.querySelectorAll(".graview-iso-roof")).toHaveLength(0);

    // The card says which of the two it is, so the stylesheet can lift the
    // nameplate clear of a drawing without lifting it off a roof.
    expect(people!.getAttribute("data-graview-landmark")).toBe("true");
    expect(reasons!.getAttribute("data-graview-landmark")).toBeNull();
  });
});
