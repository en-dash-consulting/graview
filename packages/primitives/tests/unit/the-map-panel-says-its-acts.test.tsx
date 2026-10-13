// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, kindCardId, type ViewState } from "@graview/layout";
import { BesideTheMap, createViews, GraviewProvider, useGraview } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MapPanel, registerDefaultViews } from "../../src/index.js";

/*
 * THE MAP PANEL SAYS ITS ACTS (the ninth walk, W-195). On a phone the panel
 * about a chosen district or record is a sheet over the foot of the map,
 * standing on what it is about, and a finger has no right button: the
 * co-op's "Add a hive" was on no screen of a phone, and the journeys could
 * not make a hive there with the pointer. The panel's head opens the same
 * menu the right-click did, about the same thing.
 */
const hive = defineNode("hive", { fields: z.object({ label: z.string() }), plural: "Hives", noun: "hive" });
const schema = createSchema([hive]);
const store = () => new Store({ schema, snapshot: { nodes: [{ id: "h1", kind: "hive", label: "Meadow 01" }] as never, edges: [] } });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
/* A phone's width: the panel rises as a sheet. */
Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844, toJSON: () => ({}) }) as DOMRect;

function MenuSays() {
  const { menuAt } = useGraview();
  return <output data-testid="menu-at">{menuAt ? menuAt.on ?? "" : "none"}</output>;
}

async function mounted(view: ViewState, selection: readonly string[]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store()} views={registerDefaultViews(schema, createViews(schema))} initialView={view} initialSelection={selection}>
        <BesideTheMap.Provider value={true}>
          <MapPanel />
          <MenuSays />
        </BesideTheMap.Provider>
      </GraviewProvider>,
    ),
  );
  for (let tick = 0; tick < 50 && !host.querySelector("[data-graview-map-panel]"); tick += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  return { host, unmount: () => act(async () => root.unmount()) };
}

const aloft = { ...EMPTY_VIEW, overview: true };

describe("the map panel says its acts", () => {
  it("opens the district's menu from a sheet on a phone, where the district is under it", async () => {
    const { host, unmount } = await mounted(aloft, [kindCardId("hive")]);
    expect(host.querySelector('[data-graview-map-panel="sheet"]')).not.toBeNull();
    const acts = host.querySelector<HTMLButtonElement>('[data-testid="district-panel"] [data-testid="map-panel-acts"]');
    expect(acts?.getAttribute("aria-label")).toBe("What can be done with the hives");
    await act(async () => acts?.click());
    expect(host.querySelector('[data-testid="menu-at"]')?.textContent).toBe(kindCardId("hive"));
    await unmount();
  });

  it("opens a chosen record's menu the same way", async () => {
    const { host, unmount } = await mounted(aloft, ["h1"]);
    const acts = host.querySelector<HTMLButtonElement>('[data-testid="record-panel"] [data-testid="map-panel-acts"]');
    expect(acts?.getAttribute("aria-label")).toBe("What can be done with Meadow 01");
    await act(async () => acts?.click());
    expect(host.querySelector('[data-testid="menu-at"]')?.textContent).toBe("h1");
    await unmount();
  });
});
