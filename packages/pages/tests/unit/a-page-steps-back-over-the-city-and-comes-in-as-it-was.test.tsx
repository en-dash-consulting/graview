// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, type Principal } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createPageRegistry, PagesApp, type PageComponent } from "../../src/index.js";
import { bestFit, cityRooms, leavesFrom, roomBehind } from "../../src/city-fit.js";
import { pageBox, setBack, setBackOrigin, setBackTransform, SET_BACK_SCALE, SET_BACK_TURN, SET_BACK_TURN_NARROW } from "../../src/step-back-geometry.js";

/**
 * A PAGE STEPS BACK OVER THE CITY AND COMES IN AS IT WAS (Graview HQ
 * feature:f-page-zooms-out-to-the-city). The geometry, held as numbers; and
 * the control on the derived shell's bar, a toggle that takes the page out
 * and Escape brings back. The city and its lines are the browser's to
 * judge (`pnpm verify step-back`).
 */
describe("where the page stands stepped back", () => {
  it("is the same page at half its size, up and to the left, turned on its left edge in perspective", () => {
    const back = setBack({ width: 1440, height: 850 });
    expect(back.scale).toBe(SET_BACK_SCALE);
    expect(back.x).toBeGreaterThanOrEqual(16);
    expect(back.y).toBeGreaterThanOrEqual(16);
    expect(back.turn).toBe(SET_BACK_TURN);
    expect(back.turn).toBeGreaterThan(5);
    expect(back.turn).toBeLessThan(30);
    expect(pageBox({ width: 1440, height: 850 }, back)).toEqual({ x: back.x, y: back.y, width: 1440 * back.scale, height: 850 * back.scale });
    const transform = setBackTransform({ height: 850 }, back);
    expect(transform).toMatch(/^translate\(.+\) perspective\(\d+px\) rotateY\(20deg\) rotateX\(3deg\) scale\(0\.5\)$/);
    // About its left edge's middle, scaled by a half: its top stands at y once moved up by a quarter of the region.
    expect(transform).toContain(`translate(${back.x}px, ${(back.y - 850 / 4).toFixed(1)}px)`);
  });

  it("is mirrored in a page that reads right to left: up and to the right, turned on its right edge, the city down and to the left", () => {
    const region = { width: 1440, height: 850 };
    const back = setBack(region, true);
    expect(back.rtl).toBe(true);
    expect(setBackOrigin(back)).toBe("100% 50%");
    expect(setBackOrigin(setBack(region))).toBe("0 50%");
    expect(setBackTransform({ height: 850 }, back)).toContain(`translate(-${back.x}px,`);
    expect(setBackTransform({ height: 850 }, back)).toContain("rotateY(-20deg)");
    const page = pageBox(region, back);
    expect(page.x + page.width).toBe(region.width - back.x);
    const [behind] = cityRooms(region, page, "behind", true);
    expect(behind!.x + behind!.width).toBeLessThan(page.x + page.width);
    expect(behind!.x + behind!.width).toBeGreaterThan(page.x);
    expect(behind!.y).toBeGreaterThan(page.y);
  });

  it("turns less on a phone, and recedes less: its words are smaller to begin with", () => {
    const phone = setBack({ width: 390, height: 760 });
    expect(phone.turn).toBe(SET_BACK_TURN_NARROW);
    expect(phone.turn).toBeLessThan(SET_BACK_TURN);
    expect(phone.scale).toBeGreaterThan(SET_BACK_SCALE);
  });

  it("stands the city behind the page: the whole region but the page's corner, so most of it is not under the page", () => {
    const region = { width: 1440, height: 850 };
    const page = pageBox(region);
    const [behind] = cityRooms(region, page);
    expect(behind).toEqual(roomBehind(region, page));
    expect(behind!.x).toBeGreaterThan(page.x);
    expect(behind!.x).toBeLessThan(page.x + page.width);
    expect(behind!.y).toBeLessThan(page.y + page.height);
    expect(behind!.x + behind!.width).toBeLessThanOrEqual(region.width);
    expect(behind!.y + behind!.height).toBeLessThanOrEqual(region.height);
    // Beside it, still one switch away.
    expect(cityRooms(region, page, "beside")).toHaveLength(2);
  });

  it("fits the city to its room whichever way the map runs draws it larger", () => {
    const wide = { width: 400, height: 200 };
    const tall = { width: 200, height: 400 };
    const desk = bestFit([{ x: 0, y: 0, width: 1000, height: 600 }], [wide, tall]);
    expect(desk?.drawing).toBe(wide);
    const phone = bestFit([{ x: 0, y: 0, width: 300, height: 600 }], [wide, tall]);
    expect(phone?.drawing).toBe(tall);
    expect(bestFit([{ x: 0, y: 0, width: 0, height: 0 }], [wide])).toBeNull();
  });

  it("leaves a part of the page from a point of the part where the page's plane puts it, the one nearest its record", () => {
    const part = { x: 100, y: 100, width: 80, height: 20 };
    const flat = (point: { x: number; y: number }) => point;
    expect(leavesFrom(part, flat, { x: 600, y: 110 })).toEqual({ x: 180, y: 110 });
    expect(leavesFrom(part, flat, { x: 140, y: 500 })).toEqual({ x: 140, y: 120 });
    // Turned: the points are carried through the plane's own transform, and the line leaves from one of them.
    const halved = (point: { x: number; y: number }) => ({ x: point.x / 2 + 10, y: point.y / 2 + 5 });
    expect(leavesFrom(part, halved, { x: 600, y: 60 })).toEqual({ x: 100, y: 60 });
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

/* A home with a field on it, to type into before stepping back. */
const Home = (() => (
  <main>
    <h2 data-graview-page-title="">Home</h2>
    <input data-testid="typed" aria-label="Notes" />
  </main>
)) as PageComponent<typeof schema>;

async function face(embedded = false, path = "/items/i1") {
  const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }] as never, edges: [] } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const registry = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).surface("home", Home);
  await act(async () => root.render(<PagesApp context={{ store, principal: nina, ...(embedded ? { embedded: true } : {}) }} registry={registry} initialPath={path} />));
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

  it("draws nothing of the page again: the same elements, and a field half typed keeps its words, out and back in", async () => {
    const host = await face(false, "/");
    const field = host.querySelector<HTMLInputElement>('[data-testid="typed"]')!;
    const title = host.querySelector("[data-graview-page-title]")!;
    field.value = "Call the landlord";
    const button = host.querySelector<HTMLButtonElement>('[data-testid="step-back"]')!;
    const sheet = host.querySelector<HTMLElement>("[data-graview-step-back]")!;
    await act(async () => button.click());
    await frames();
    expect(sheet.getAttribute("data-graview-step-back")).toBe("out");
    expect(host.querySelector('[data-testid="typed"]')).toBe(field);
    expect(host.querySelector("[data-graview-page-title]")).toBe(title);
    await act(async () => button.click());
    await act(async () => new Promise((done) => setTimeout(done, 700)));
    expect(sheet.getAttribute("data-graview-step-back")).toBe("in");
    expect(host.querySelector('[data-testid="typed"]')).toBe(field);
    expect(field.isConnected).toBe(true);
    expect(field.value).toBe("Call the landlord");
  });

  it("pressed twice before it began to move, is in: the second press is never lost to the frame the first waits for", async () => {
    const host = await face();
    const button = host.querySelector<HTMLButtonElement>('[data-testid="step-back"]')!;
    const sheet = host.querySelector<HTMLElement>("[data-graview-step-back]")!;
    await act(async () => button.click());
    expect(sheet.getAttribute("data-graview-step-back")).toBe("leaving");
    // One frame in: the first frame it waits for has passed, the second is asked for.
    await act(async () => new Promise<void>((done) => requestAnimationFrame(() => done())));
    await act(async () => button.click());
    await frames();
    await act(async () => new Promise((done) => setTimeout(done, 700)));
    expect(sheet.getAttribute("data-graview-step-back")).toBe("in");
    expect(sheet.style.display).toBe("contents");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("is not offered on an embedded face, whose page is the host's", async () => {
    const host = await face(true);
    expect(host.querySelector('[data-testid="step-back"]')).toBeNull();
  });
});
