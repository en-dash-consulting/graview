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
 * THE DISTRICT PANEL COUNTS WHAT ITS HEAD COUNTS, AND SAYS IT IN THE
 * LOCALE (the ninth walk, W-198). The co-op's Hives panel said "280 hives"
 * at its head and "299 hives → 14 apiaries" and "7347 inspections → 299
 * hives" under it: the relations counted the dead-outs past the horizon
 * that the head leaves out, and every figure was written as JavaScript
 * prints it.
 */
const apiary = defineNode("apiary", { fields: z.object({ label: z.string() }), plural: "Apiaries", noun: "apiary" });
const hive = defineNode("hive", {
  fields: z.object({ label: z.string(), status: z.enum(["alive", "dead"]) }),
  plural: "Hives",
  noun: "hive",
  lifecycle: { field: "status", retired: ["dead"] },
  edges: { "kept-at": { to: ["apiary"], description: "the yard it stands in", inverse: "the hives here" } },
});
const schema = createSchema([apiary, hive]);
const LIVING = 1201;
const store = () =>
  new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "a1", kind: "apiary", label: "Meadow" },
        ...Array.from({ length: LIVING }, (_, i) => ({ id: `h${i}`, kind: "hive", label: `Meadow ${i}`, status: "alive" })),
        { id: "dead", kind: "hive", label: "Meadow lost", status: "dead" },
      ] as never,
      edges: [...Array.from({ length: LIVING }, (_, i) => ({ kind: "kept-at", from: `h${i}`, to: "a1" })), { kind: "kept-at", from: "dead", to: "a1" }],
    },
  });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}) }) as DOMRect;

describe("the district panel", () => {
  it("counts its relations over the records its head counts, in the page's locale", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} initialSelection={[kindCardId("hive")]}>
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
    expect(panel.querySelector("header p")?.textContent).toMatch(/^1,201 hives/);
    const relation = panel.querySelector('[data-graview-relation-said="kept-at"]')!;
    expect(relation.textContent).toContain("1,201 hives → 1 apiary");
    expect(relation.textContent).not.toContain("1,202");
    await act(async () => root.unmount());
  });
});
