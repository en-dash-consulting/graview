// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, kindCardId } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider } from "../../src/index.js";
import { Plots } from "../../src/plots.js";

/**
 * A TILE IS ITS DISTRICT: pressing the ground focuses the district that
 * stands on it, and the click a pan produces on its way up is not a press.
 */
const thing = defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things" });
const schema = createSchema([thing]);
const store = () => new Store({ schema, snapshot: { nodes: [{ id: "a", kind: "thing", label: "A" }] as never, edges: [] } });
const frame = {
  nodes: [{ id: kindCardId("thing"), kind: "thing", plane: 2, x: 0, y: 0, width: 100, height: 60, plot: { col: 0, row: 0, side: 1 }, aggregate: { memberIds: ["a"] } }],
  connectors: [],
  width: 800,
  height: 500,
  t: 1,
  city: { cell: 40, originX: 200, originY: 120 },
} as never;

describe("a tile is its district", () => {
  it("reports the district it stands under, and not for the click a pan produces", async () => {
    const focused: string[] = [];
    const swallowed = { current: false };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={createViews(schema)} initialView={EMPTY_VIEW}>
          <Plots frame={frame} width={800} height={500} pan={{ x: 0, y: 0 }} swallowed={swallowed} onFocus={(id) => focused.push(id)} />
        </GraviewProvider>,
      ),
    );
    const tile = host.querySelector<SVGPolygonElement>(".graview-plot-tile")!;
    expect(tile).not.toBeNull();
    // The village stands on it too.
    expect(host.querySelectorAll(".graview-building")).toHaveLength(1);
    await act(async () => tile.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(focused).toEqual([kindCardId("thing")]);
    swallowed.current = true;
    await act(async () => tile.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(focused).toHaveLength(1);
    await act(async () => root.unmount());
    host.remove();
  });
});
