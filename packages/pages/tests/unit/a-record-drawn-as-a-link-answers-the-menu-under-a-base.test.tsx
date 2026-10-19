// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A RECORD DRAWN AS A LINK ANSWERS THE MENU UNDER A BASE (FR-189).
 *
 * On a page mounted under a base (`/a/graview-roadmap-69`), a board's card
 * and a blocks lens's card were links to `/tasks/t1` — the base dropped —
 * so the menu read them as links somewhere else: "Open in a new tab" and
 * nothing more, no acts and no "Move to ›", and the new tab opened outside
 * the app. A card's link carries the base, the menu reads the record a card
 * is listed as, and a new tab keeps the base.
 */
const BASE = "/a/graview-roadmap-69";
const tasks = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/tasks.gdd.json"), "utf8"));
const doc = {
  ...tasks,
  lenses: [
    ...tasks.lenses,
    { name: "blocks", title: "By stage", on: "task", options: { blocks: [{ list: "all('task')", group: { by: "status" }, sort: "label", as: "card" }] } },
  ],
};
const OWNER: Principal = { kind: "human", id: "p1", roles: ["owner"] };
const NODES = [
  { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
  { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
  { id: "p1", kind: "person", label: "Ada" },
];

beforeAll(() => fetchDeclaredLenses());
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
});

async function settle(turns = 4, ms = 30) {
  for (let turn = 0; turn < turns; turn += 1) await act(async () => new Promise((done) => setTimeout(done, ms)));
}

async function at(place: string) {
  const compiled = compileDocument(doc, { today: () => "2026-10-19" });
  if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: NODES, edges: [] } as never });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: OWNER }} basename={BASE} initialPath={`/places/${place}`} />));
  await settle();
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  const card = (id: string) => host.querySelector<HTMLAnchorElement>(`[data-graview-listed="${id}"] .graview-spec-item-link`)!;
  return { host, store, card };
}

async function rightClick(element: Element) {
  await act(async () => void element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
  await settle();
}

const menu = () => document.querySelector<HTMLElement>('[data-testid="context-menu"]');
const rows = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])].map((row) => row.getAttribute("data-menu-item"));
const acts = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-affordance]:not([disabled])") ?? [])].map((button) => button.textContent!.replace(/ …$/, ""));

describe("a board's card under a base", () => {
  it("links to its record's address under the base", async () => {
    const { card } = await at("the-board");
    expect(card("t1").getAttribute("href")).toBe(`${BASE}/tasks/t1`);
  });

  it("opens the menu about its record: Open, its acts and Move to ›, which moves it", async () => {
    const { card, store } = await at("the-board");
    await rightClick(card("t1"));
    expect(menu()!.textContent).toContain("Write the brief");
    expect(rows()).toEqual(expect.arrayContaining(["open", "open-in-a-new-tab", "move-to"]));
    expect(acts()).toContain("Assign");
    await act(async () => menu()!.querySelector<HTMLButtonElement>('[data-menu-item="move-to"]')!.click());
    await act(async () => menu()!.querySelector<HTMLButtonElement>('[data-move-to="done"]')!.click());
    await settle();
    expect(store.graph.getNode("t1")?.["status"]).toBe("done");
  });

  it("opens the same menu under a finger resting on it, where a phone has no other way to move it", async () => {
    const { card } = await at("the-board");
    await act(async () => void card("t1").dispatchEvent(Object.assign(new MouseEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 30 }), { pointerType: "touch", isPrimary: true })));
    await act(async () => new Promise((done) => setTimeout(done, 650)));
    await settle();
    expect(menu()!.textContent).toContain("Write the brief");
    expect(rows()).toContain("move-to");
  });

  it("begins choosing several from that menu on a phone, where the finger no longer chooses", async () => {
    const coarse = (query: string) => ({ matches: query.includes("coarse"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList;
    const had = window.matchMedia;
    window.matchMedia = coarse;
    try {
      const { card, host } = await at("the-board");
      expect(host.querySelector('[data-graview-listed="t1"]')!.hasAttribute("data-graview-choose")).toBe(false);
      await rightClick(card("t1"));
      await act(async () => menu()!.querySelector<HTMLButtonElement>('[data-menu-item="choose-several"]')!.click());
      await settle();
      expect(host.querySelector<HTMLInputElement>('[data-graview-choose-box="t1"]')!.checked).toBe(true);
      // Choosing, a card is a row the long press and a tap choose.
      expect(host.querySelector('[data-graview-listed="t2"]')!.getAttribute("data-graview-choose")).toBe("t2");
    } finally {
      window.matchMedia = had;
    }
  });

  it("opens a new tab at the record's address under the base", async () => {
    const opened = vi.spyOn(window, "open").mockImplementation(() => null);
    const { card } = await at("the-board");
    await rightClick(card("t1"));
    await act(async () => menu()!.querySelector<HTMLButtonElement>('[data-menu-item="open-in-a-new-tab"]')!.click());
    expect(opened).toHaveBeenCalledWith(`${BASE}/tasks/t1`, "_blank", "noopener");
  });
});

describe("a blocks lens's card under a base", () => {
  it("links under the base and opens the menu with its record's acts", async () => {
    const opened = vi.spyOn(window, "open").mockImplementation(() => null);
    const { card } = await at("by-stage");
    expect(card("t2").getAttribute("href")).toBe(`${BASE}/tasks/t2`);
    await rightClick(card("t2"));
    expect(menu()!.textContent).toContain("Book the hall");
    expect(acts()).toEqual(expect.arrayContaining(["Set the status", "Assign"]));
    expect(rows()).toEqual(expect.arrayContaining(["open", "open-in-a-new-tab"]));
    await act(async () => menu()!.querySelector<HTMLButtonElement>('[data-menu-item="open-in-a-new-tab"]')!.click());
    expect(opened).toHaveBeenCalledWith(`${BASE}/tasks/t2`, "_blank", "noopener");
  });

  it("is read as its record from anywhere in its card, past the link", async () => {
    const { host } = await at("by-stage");
    const inside = host.querySelector('[data-graview-listed="t2"] .graview-spec, [data-graview-listed="t2"] .graview-spec-item-name') ?? host.querySelector('[data-graview-listed="t2"]')!;
    await rightClick(inside);
    expect(menu()!.textContent).toContain("Book the hall");
    expect(rows()).toContain("open");
  });
});
