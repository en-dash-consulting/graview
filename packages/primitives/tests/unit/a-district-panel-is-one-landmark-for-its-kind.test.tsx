// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, kindCardId } from "@graview/layout";
import { BesideTheMap, createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MapPanel, registerDefaultViews } from "../../src/index.js";

/*
 * A DISTRICT PANEL IS ONE LANDMARK FOR ITS KIND. The panel a district opens
 * beside the map is a region named for the kind ("Plots"), and the list of
 * its members inside it was a second section with the same name: one
 * landmark said twice, which a screen reader lists as two places and axe
 * reports as landmark-unique on the garden's chapter seven. The list is a
 * named group inside the region, not another region.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots", noun: "plot" });
const schema = createSchema([plot]);
const store = () =>
  new Store({
    schema,
    snapshot: { nodes: [1, 2, 3].map((n) => ({ id: `plot-${n}`, kind: "plot", label: `Plot ${n}` })) as never, edges: [] },
  });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}) }) as DOMRect;

/** A landmark's name, as a section or a region carries it. */
const landmarks = (root: Element) =>
  [...root.querySelectorAll("section[aria-label], [role='region'][aria-label]")].map((el) => el.getAttribute("aria-label"));

describe("a district panel", () => {
  it("is the one landmark named for its kind, its members a group inside it", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} initialSelection={[kindCardId("plot")]}>
          <BesideTheMap.Provider value={true}>
            <MapPanel />
          </BesideTheMap.Provider>
        </GraviewProvider>,
      ),
    );
    for (let tick = 0; tick < 50 && !host.querySelector("[data-graview-map-panel]"); tick += 1) {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    const panel = host.querySelector('[data-testid="district-panel"]')!;
    expect(panel.getAttribute("aria-label")).toBe("Plots");
    const named = landmarks(host);
    expect(named.filter((name) => name === "Plots")).toHaveLength(1);
    expect(new Set(named).size).toBe(named.length);
    // The members are still named for the kind, as a group a screen reader enters.
    const group = panel.querySelector("[role='group'][aria-label='Plots']");
    expect(group?.querySelectorAll("li").length).toBe(3);
    await act(async () => root.unmount());
  });
});
