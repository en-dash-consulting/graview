// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews, useGraview } from "@graview/react";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, registerDefaultViews } from "../../src/index.js";

beforeAll(() => fetchInspector());

/*
 * The tenth walk's rescue team keeps "kit", and one of it is a "piece of
 * kit" (`noun`). The menu over a rope said "Rope 9 · 50 m" and under it
 * "kit" — the kind's key — and the watch read it out on every repair the
 * journeys took from the scene.
 */
const kit = defineNode("kit", { fields: z.object({ label: z.string() }), noun: "piece of kit", plural: "Kit" });
const schema = createSchema([kit]);

/** The pointer's menu, opened over the record as a right-click opens it. */
function Pointed() {
  const { setMenuAt } = useGraview();
  useEffect(() => setMenuAt({ x: 40, y: 40, on: "k1" }), [setMenuAt]);
  return null;
}

describe("the menu over a record", () => {
  it("says what one of its kind is called, never the kind's key", async () => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "k1", kind: "kit", label: "Rope 9" }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} initialSelection={["k1"]}>
          <Pointed />
          <Inspector />
        </GraviewProvider>,
      );
    });
    const menu = host.querySelector('[data-testid="context-menu"]');
    expect(menu, "the pointer's menu is open").not.toBeNull();
    const said = [...menu!.querySelectorAll("span")].map((span) => span.textContent?.trim());
    expect(said).toContain("piece of kit");
    expect(said).not.toContain("kit");
    await act(async () => root.unmount());
  });
});
