// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { memoryViews, removedLensName, type AnySchema, type GraviewApp, type KeptViews, type KeptViewsMay, type LensTidyEdit } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { fetchDeclaredLenses, fetchInspector } from "@graview/primitives";
import type { ReactViewRegistry, ViewProps } from "@graview/react/provider";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A VIEW IS HIDDEN, SHOWN, DELETED AND RESTORED FROM THE PLACE MENU ALONE
 * (Roadmap f-place-menu-views). Right-clicking the place in the bar, or an
 * entry in its drop-down — or Shift+F10, or a resting finger — opens the
 * Pages menu with Hide and Delete for a view the host keeps (`keptViews`);
 * Hide takes it off the places for everyone, the drop-down's foot lists it
 * under Hidden with Show; Delete lists it under Recently deleted with
 * Restore. A declared lens is hidden by `set-lens-hidden` and deleted by
 * `remove-lens`, handed to the host as a change to the declaration, and
 * only for whoever may change it.
 */
const hall = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/every-lens.gdd.json"), "utf8"));
const compiled = compileDocument(hall, { today: () => "2026-09-01" });
if (!compiled.ok) throw new Error("every-lens did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = { nodes: [{ id: "seat-1", kind: "seat", label: "Front left", x: 0.2, y: 0.3 }, { id: "s1", kind: "shift", label: "Monday door", day: "mon", from: 540, until: 720, on: "2026-09-07" }], edges: [] };
const me = { kind: "human" as const, id: "nick", roles: ["keeper"] };

/** A view a chat drew, as the host registers it: its title, and the name the host keeps it by. */
function SeatChart(props: ViewProps<AnySchema>) {
  return <p data-testid="seat-chart">{props.nodes?.length ?? 0} seats charted</p>;
}
const views = (_schema: AnySchema, registry: ReactViewRegistry<AnySchema>) => registry.register("seat" as never, { cardinality: "many", fidelity: "full" }, SeatChart, { title: "Seat chart", name: "seat-chart" });

// The acts' pane is fetched once the place has first drawn and the page is idle (FR-194): here, before the first right-click.
beforeAll(() => Promise.all([preload(), fetchDeclaredLenses(), fetchInspector()]));
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

async function settle(ms = 30) {
  await act(async () => {
    await vi.dynamicImportSettled();
    await new Promise((done) => setTimeout(done, ms));
  });
}

const opened: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of opened.splice(0)) await done();
});

async function open(keptViews: KeptViews, path = "/places/seat-chart"): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, seed, face: "pages", path, fonts: false, principal: me, views, keptViews } as unknown as EmbedOptions);
  });
  opened.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  await settle();
  return host;
}

const menu = () => document.querySelector<HTMLElement>('[data-testid="context-menu"]');
const rows = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])].map((row) => row.getAttribute("data-menu-item"));
const press = async (element: Element | null | undefined) => {
  if (!element) throw new Error("nothing to press");
  await act(async () => void (element as HTMLElement).click());
  await settle();
};
async function rightClick(element: Element | null | undefined) {
  if (!element) throw new Error("nothing to right-click");
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 20 });
  await act(async () => void element.dispatchEvent(event));
  await settle();
  return event;
}
async function openPlaces(host: HTMLElement) {
  if (host.querySelector('[data-testid="app-places"]')?.hasAttribute("hidden") !== false) await press(host.querySelector('[data-testid="app-places-open"]'));
  return host.querySelector<HTMLElement>('[data-testid="app-places"]')!;
}
const pictures = (list: HTMLElement) => [...list.querySelectorAll('[data-place-group="pictures"] [data-testid^="app-place-place:"]')].map((entry) => entry.textContent?.trim());
const keeper = (may: KeptViewsMay = { views: true, lenses: true }, changes: LensTidyEdit[] = []) =>
  memoryViews({ may, declaration: { change: (edit) => void changes.push(edit), restore: () => undefined } });

describe("a view tidied from the place menu", () => {
  it("is hidden and shown again from the place in the bar, the drop-down's Hidden listing it meanwhile", async () => {
    const kept = keeper();
    const host = await open(kept);
    expect(host.querySelector('[data-testid="app-place-current"]')?.textContent).toBe("Seat chart");
    const event = await rightClick(host.querySelector('[data-testid="app-place-current"]'));
    expect(event.defaultPrevented).toBe(true);
    expect(rows()).toEqual(expect.arrayContaining(["hide-view", "delete-view"]));
    await press(menu()!.querySelector('[data-menu-item="hide-view"]'));
    expect(kept.current().hidden).toEqual(["seat-chart"]);
    const list = await openPlaces(host);
    expect(pictures(list)).not.toContain("Seat chart");
    const hidden = list.querySelector('[data-place-group="hidden"]')!;
    expect(hidden.textContent).toContain("Seat chart");
    await press(hidden.querySelector('[data-testid="app-view-show"]'));
    expect(kept.current().hidden).toEqual([]);
    expect(pictures(await openPlaces(host))).toContain("Seat chart");
    // Only the rooms, which the hall's declaration keeps off the places, are under Hidden now.
    expect(host.querySelector('[data-place-group="hidden"] [data-testid="app-view-show"]')).toBeNull();
  });

  it("is deleted from a drop-down entry and restored from Recently deleted", async () => {
    const kept = keeper();
    const host = await open(kept, "/");
    const list = await openPlaces(host);
    await rightClick(list.querySelector('[data-testid="app-place-place:seat:seat-chart"]'));
    expect(rows()).toEqual(expect.arrayContaining(["hide-view", "delete-view"]));
    await press(menu()!.querySelector('[data-menu-item="delete-view"]'));
    expect(kept.current().removed.map((one) => [one.name, one.title, one.kind])).toEqual([["seat-chart", "Seat chart", "seat"]]);
    const after = await openPlaces(host);
    expect(pictures(after)).not.toContain("Seat chart");
    const removed = after.querySelector('[data-place-group="removed"]')!;
    expect(removed.textContent).toContain("Seat chart");
    expect(removed.textContent).toMatch(/until/);
    await press(removed.querySelector('[data-testid="app-view-restore"]'));
    expect(kept.current().removed).toEqual([]);
    expect(pictures(await openPlaces(host))).toContain("Seat chart");
  });

  it("goes to the kind's own place when the place you are on is deleted, rather than leaving you on what it falls back to", async () => {
    const kept = keeper();
    const host = await open(kept);
    await rightClick(host.querySelector('[data-testid="app-place-current"]'));
    await press(menu()!.querySelector('[data-menu-item="delete-view"]'));
    expect(kept.current().removed.map((one) => one.name)).toEqual(["seat-chart"]);
    // The seats' own place, the floor, is what the bar says and what the page draws.
    expect(host.querySelector('[data-testid="app-place-current"]')?.textContent).toBe("The floor");
    expect(host.querySelector('[data-testid="seat-chart"]')).toBeNull();
  });

  it("goes home when the place you are on is deleted and its kind has no other", async () => {
    const kept = keeper();
    const host = await open(kept, "/places/the-building");
    await rightClick(host.querySelector('[data-testid="app-place-current"]'));
    await press(menu()!.querySelector('[data-menu-item="delete-view"]'));
    expect(host.querySelector('[data-testid="app-home"]')?.getAttribute("aria-current")).toBe("page");
  });

  it("opens from the keyboard's Shift+F10 and from a resting finger on a drop-down entry", async () => {
    const host = await open(keeper(), "/");
    const list = await openPlaces(host);
    const entry = list.querySelector<HTMLElement>('[data-testid="app-place-place:seat:seat-chart"]')!;
    const key = new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true });
    await act(async () => void entry.dispatchEvent(key));
    await settle();
    expect(key.defaultPrevented).toBe(true);
    expect(rows()).toContain("hide-view");
    await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await settle();
    const again = (await openPlaces(host)).querySelector<HTMLElement>('[data-testid="app-place-place:seat:seat-chart"]')!;
    await act(async () => void again.dispatchEvent(Object.assign(new MouseEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 30 }), { pointerType: "touch", isPrimary: true })));
    await settle(650);
    expect(rows()).toContain("delete-view");
  });

  it("hides and deletes a declared lens as a change to the declaration, restored by the host's rollback", async () => {
    const changes: LensTidyEdit[] = [];
    const kept = keeper({ views: true, lenses: true }, changes);
    const host = await open(kept, "/");
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-place:shift:by-day"]'));
    await press(menu()!.querySelector('[data-menu-item="hide-view"]'));
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-place:shift:by-day"]'));
    await press(menu()!.querySelector('[data-menu-item="delete-view"]'));
    expect(changes).toEqual([
      { op: "set-lens-hidden", title: "By day", on: "shift", hidden: true },
      { op: "remove-lens", title: "By day", on: "shift" },
    ]);
    const removed = (await openPlaces(host)).querySelector('[data-place-group="removed"]')!;
    expect(removed.textContent).toContain("By day");
    await press(removed.querySelector('[data-testid="app-view-restore"]'));
    expect(kept.current().removed.map((one) => one.name)).not.toContain(removedLensName("By day"));
  });

  it("hides a kind's list from its drop-down entry as set-lens-hidden on the kind, and the foot's Hidden shows one kept off", async () => {
    const changes: LensTidyEdit[] = [];
    const host = await open(keeper({ views: true, lenses: true }, changes), "/");
    const list = await openPlaces(host);
    // The hall keeps its rooms off the places (`pages.hide`): not an entry, but under Hidden, with Show.
    expect(list.querySelector('[data-testid="app-place-kind:room"]')).toBeNull();
    const hidden = list.querySelector('[data-place-group="hidden"]')!;
    expect(hidden.textContent).toContain("Rooms");
    expect(hidden.querySelector('[data-testid="app-view-hidden-place"]')?.textContent).toBe("Rooms");
    await press(hidden.querySelector('[data-testid="app-list-show"]'));
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-kind:seat"]'));
    expect(rows()).toEqual(expect.arrayContaining(["hide-list"]));
    expect(rows()).not.toContain("delete-view");
    await press(menu()!.querySelector('[data-menu-item="hide-list"]'));
    expect(changes).toEqual([
      { op: "set-lens-hidden", title: "room", hidden: false },
      { op: "set-lens-hidden", title: "seat", hidden: true },
    ]);
  });

  it("offers an editor the views a chat drew but not the declaration's lenses, and a reader neither", async () => {
    const editor = await open(keeper({ views: true, lenses: false }), "/");
    await rightClick((await openPlaces(editor)).querySelector('[data-testid="app-place-place:shift:by-day"]'));
    expect(rows()).not.toContain("hide-view");
    await rightClick((await openPlaces(editor)).querySelector('[data-testid="app-place-kind:seat"]'));
    expect(rows()).not.toContain("hide-list");
    expect((await openPlaces(editor)).querySelector('[data-place-group="hidden"]')).toBeNull();
    await rightClick((await openPlaces(editor)).querySelector('[data-testid="app-place-place:seat:seat-chart"]'));
    expect(rows()).toContain("hide-view");
    for (const done of opened.splice(0)) await done();
    const reader = await open(keeper({ views: false, lenses: false }), "/");
    await rightClick((await openPlaces(reader)).querySelector('[data-testid="app-place-place:seat:seat-chart"]'));
    expect(rows()).not.toContain("hide-view");
    expect(rows()).not.toContain("delete-view");
  });
});
