// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { BesideTheMap, createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MapPanel, Panel, registerDefaultViews } from "../../src/index.js";

/*
 * A LENS BESIDE THE MAP IS NAMED ONCE. The panel's head says the lens's
 * name, and a lens titles its own page-sized panel with the label it is
 * handed — so the todo app's "The lists" stood twice on one screen, a
 * hundred pixels apart, and the survey said so. The head keeps the name;
 * the lens's panel, drawn under it, does not say it again. The same lens on
 * its own place still names itself.
 */
const list = defineNode("list", { fields: z.object({ label: z.string() }), plural: "Lists", noun: "list" });
const schema = createSchema([list]);
const Lists: ViewComponent<typeof schema> = ({ nodes, label }) => (
  <Panel title={label ?? "Lists"} meta={`${(nodes ?? []).length} lists`}>
    {(nodes ?? []).map((node) => (
      <span key={node.id} data-graview-pick={node.id}>
        {String((node as { label?: string }).label)}
      </span>
    ))}
  </Panel>
);
const views = () => registerDefaultViews(schema, createViews(schema)).register("list", { cardinality: "many", fidelity: "full" }, Lists, { title: "The lists" });
const store = () => new Store({ schema, snapshot: { nodes: [{ id: "l1", kind: "list", label: "Today" }] as never, edges: [] } });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}) }) as DOMRect;

describe("a lens beside the map", () => {
  it("is named by the panel's head, and its own panel does not say the name again under it", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={views()} initialView={{ ...EMPTY_VIEW, overview: true, focusId: aggregateId("list"), within: { view: "the-lists" } }}>
          <BesideTheMap.Provider value={true}>
            <MapPanel />
          </BesideTheMap.Provider>
        </GraviewProvider>,
      ),
    );
    for (let tick = 0; tick < 50 && !host.querySelector('[data-testid="lens-panel"]'); tick += 1) {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    const panel = host.querySelector('[data-testid="lens-panel"]')!;
    expect(panel.querySelector('[data-testid="lens-panel-title"]')?.textContent).toBe("The lists");
    const named = [...panel.querySelectorAll("h1, h2, h3, h4, strong")].filter((el) => el.textContent?.trim() === "The lists");
    expect(named).toHaveLength(1);
    // The lens itself is still drawn under the head.
    expect(panel.querySelector('[data-graview-pick="l1"]')).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("still names itself where nothing above it does", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<Panel title="The lists" variant="page">nothing</Panel>));
    expect([...host.querySelectorAll("strong")].map((el) => el.textContent)).toEqual(["The lists"]);
    await act(async () => root.unmount());
  });
});
