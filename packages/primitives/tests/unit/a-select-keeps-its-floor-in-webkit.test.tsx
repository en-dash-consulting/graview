// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, isoDate, Store, z } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCalendarLens, Places } from "../../src/index.js";

/**
 * A SELECT KEEPS ITS FLOOR IN WEBKIT. WebKit draws a native select at its own
 * height and ignores min-height: the bar's compact Places picker (a select
 * until FR-117 made the places words) measured 175×22 and the diary's Range picker 79×21 on a phone in Safari — under the
 * 24 a target needs (the W-121 lesson, on two more selects). The native look
 * off is what holds the floor; jsdom draws nothing, so this holds that.
 */
const drive = defineNode("drive", { fields: z.object({ label: z.string(), on: isoDate }), plural: "Drives" });
const schema = createSchema([drive]);
const lens = createCalendarLens<typeof schema>({ bindings: { drive: { start: "on" } }, today: "2026-09-30", range: "week" });
const views = () => createViews(schema).register("drive", { cardinality: "many", fidelity: "full" }, lens.View, { title: "The diary" });
const store = () => new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "d1", kind: "drive", label: "Ada", on: "2026-09-30" }] as never, edges: [] } });

describe("the selects a phone gets", () => {
  it("the bar's places on a phone are no select at all: words that scroll, each a fingertip tall (FR-117)", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
        <Places compact />
      </GraviewProvider>,
    );
    expect(html).not.toContain("<select");
    expect(html).toMatch(/<button[^>]*data-testid="place-the-diary"[^>]*style="[^"]*min-height:32px/);
  });

  it("the calendar's Range picker, at a phone's width, has the native look off", async () => {
    const saved = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => ({ width: 320, height: 400, top: 0, left: 0, right: 320, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={views()} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("drive") }}>
          <lens.View nodes={store().graph.nodesOfKind("drive") as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
        </GraviewProvider>,
      ),
    );
    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Range"]');
    expect(select, "a phone gets the ranges as a select").not.toBeNull();
    expect(select!.style.appearance).toBe("none");
    await act(async () => root.unmount());
    host.remove();
    Element.prototype.getBoundingClientRect = rect;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved;
  });
});
