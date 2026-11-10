// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, type Principal } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";
import { bestFit, nearestOnBox, roomBeside } from "../../src/city-fit.js";
import { pageBox, setBack, SET_BACK_SCALE } from "../../src/step-back-geometry.js";

/**
 * A PAGE STEPS BACK OVER THE CITY AND COMES IN AS IT WAS (Graview HQ
 * feature:f-page-zooms-out-to-the-city). The geometry, held as numbers; and
 * the control on the derived shell's bar, a toggle that takes the page out
 * and Escape brings back. The city and its lines are the browser's to
 * judge (`pnpm verify step-back`).
 */
describe("where the page stands stepped back", () => {
  it("is the same page at a little over half its size, up and to the left", () => {
    const back = setBack({ width: 1440, height: 850 });
    expect(back.scale).toBe(SET_BACK_SCALE);
    expect(back.scale).toBeGreaterThan(0.5);
    expect(back.scale).toBeLessThan(0.6);
    expect(back.x).toBeGreaterThanOrEqual(16);
    expect(back.y).toBeGreaterThanOrEqual(16);
    expect(pageBox({ width: 1440, height: 850 }, back)).toEqual({ x: back.x, y: back.y, width: 1440 * back.scale, height: 850 * back.scale });
  });

  it("leaves room for the city to its right and under it, clear of the page", () => {
    const region = { width: 1440, height: 850 };
    const page = pageBox(region);
    const { right, below } = roomBeside(region, page);
    expect(right.x).toBeGreaterThan(page.x + page.width);
    expect(below.y).toBeGreaterThan(page.y + page.height);
    expect(right.x + right.width).toBeLessThanOrEqual(region.width);
    expect(below.y + below.height).toBeLessThanOrEqual(region.height);
  });

  it("stands the city in whichever room draws it larger: beside the page at a desk, under it on a phone", () => {
    const wide = { width: 400, height: 200 };
    const tall = { width: 200, height: 400 };
    const desk = bestFit(roomBeside({ width: 1440, height: 850 }, pageBox({ width: 1440, height: 850 })), [wide, tall]);
    expect(desk?.box).toEqual(roomBeside({ width: 1440, height: 850 }, pageBox({ width: 1440, height: 850 })).right);
    const phone = bestFit(roomBeside({ width: 390, height: 760 }, pageBox({ width: 390, height: 760 })), [wide, tall]);
    expect(phone?.box).toEqual(roomBeside({ width: 390, height: 760 }, pageBox({ width: 390, height: 760 })).below);
    expect(bestFit(roomBeside({ width: 0, height: 0 }, pageBox({ width: 0, height: 0 })), [wide])).toBeNull();
  });

  it("leaves a part of the page from the side nearest the record it runs to", () => {
    const part = { x: 100, y: 100, width: 80, height: 20 };
    expect(nearestOnBox(part, { x: 600, y: 110 })).toEqual({ x: 180, y: 110 });
    expect(nearestOnBox(part, { x: 140, y: 500 })).toEqual({ x: 140, y: 120 });
    // From inside, by the nearest side: never from the middle of the words.
    expect(nearestOnBox(part, { x: 175, y: 110 })).toEqual({ x: 180, y: 110 });
  });
});

const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
const schema = createSchema([item]);
const nina: Principal = { kind: "human", id: "nina", roles: ["keeper"] };

let unmounts: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const unmount of unmounts) await unmount();
  unmounts = [];
  document.body.innerHTML = "";
});

async function face(embedded = false) {
  const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }] as never, edges: [] } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, principal: nina, ...(embedded ? { embedded: true } : {}) }} initialPath="/items/i1" />));
  unmounts.push(() => act(async () => root.unmount()));
  return host;
}

const frames = () => act(async () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => done())))));

describe("the step-back control on a routed page", () => {
  it("is a toggle in the bar: pressed, the page is out and the keyboard cannot reach into it; Escape brings it back in", async () => {
    const host = await face();
    const button = host.querySelector<HTMLButtonElement>('[data-testid="step-back"]')!;
    expect(button).not.toBeNull();
    expect(button.closest("[data-graview-step-back]")).toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Step back to the city");
    const sheet = host.querySelector<HTMLElement>("[data-graview-step-back]")!;
    expect(sheet.getAttribute("data-graview-step-back")).toBe("in");
    expect(sheet.style.display).toBe("contents");

    await act(async () => button.click());
    await frames();
    expect(sheet.getAttribute("data-graview-step-back")).toBe("out");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Back to the page");
    expect(sheet.style.position).toBe("fixed");
    expect(sheet.style.transform).toContain(`scale(${SET_BACK_SCALE})`);
    expect(sheet.firstElementChild!.hasAttribute("inert")).toBe(true);
    // The page is the same page: nothing in it was drawn again.
    expect(sheet.textContent).toContain("Pay the deposit");

    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await act(async () => new Promise((done) => setTimeout(done, 700)));
    expect(sheet.getAttribute("data-graview-step-back")).toBe("in");
    expect(sheet.style.display).toBe("contents");
    expect(sheet.firstElementChild!.hasAttribute("inert")).toBe(false);
  });

  it("is not offered on an embedded face, whose page is the host's", async () => {
    const host = await face(true);
    expect(host.querySelector('[data-testid="step-back"]')).toBeNull();
  });
});
