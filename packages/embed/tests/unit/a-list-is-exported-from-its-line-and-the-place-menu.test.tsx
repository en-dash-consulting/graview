// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { memoryViews, type AnySchema, type GraviewApp, type KeptViews, type KeptViewsMay, type LensTidyEdit } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { parseCsv } from "@graview/core/import";
import { fetchDeclaredLenses, fetchInspector } from "@graview/primitives";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A LIST IS EXPORTED FROM ITS LINE AND FROM THE PLACE MENU (Roadmap
 * f-view-export-csv). A kind's list and a lens that lists records end
 * their arranging line with a quiet "Export CSV", and the place menu
 * offers it too; either writes the records shown, in their order, and
 * hands them to the host's `onExport` (else the browser downloads them).
 * Whoever may change the declaration is offered "Turn off export" — a
 * change to the declaration, `set-lens-export` — and where it is off
 * nobody is offered Export, and the owner is offered "Turn on export".
 */
const hall = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/every-lens.gdd.json"), "utf8"));
const compile = (document: unknown) => {
  const compiled = compileDocument(document as never, { today: () => "2026-09-01" });
  if (!compiled.ok) throw new Error("every-lens did not compile");
  return compiled.app as GraviewApp<AnySchema>;
};
const app = compile(hall);
const unexported = compile({ ...hall, pages: { ...hall.pages, lists: { shift: { export: false } } }, lenses: hall.lenses.map((lens: { title?: string }) => (lens.title === "By day" ? { ...lens, export: false } : lens)) });
const seed = {
  nodes: [
    { id: "s1", kind: "shift", label: "Monday door", day: "mon", from: 540, until: 720, on: "2026-09-07" },
    { id: "s2", kind: "shift", label: "Tuesday bar, late", day: "tue", from: 1080, until: 1320, on: "2026-09-08" },
    { id: "s3", kind: "shift", label: "Another Monday", day: "mon", from: 600, until: 660, on: "2026-09-14" },
  ],
  edges: [],
};
const me = { kind: "human" as const, id: "nick", roles: ["keeper"] };

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

interface Saved {
  readonly csv: string;
  readonly name: string;
}

async function open(path: string, options: { readonly keptViews?: KeptViews; readonly app?: GraviewApp<AnySchema> } = {}): Promise<{ host: HTMLElement; saved: Saved[] }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const saved: Saved[] = [];
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app: options.app ?? app, seed, face: "pages", path, fonts: false, principal: me, ...(options.keptViews ? { keptViews: options.keptViews } : {}), onExport: (csv: string, name: string) => void saved.push({ csv, name }) } as unknown as EmbedOptions);
  });
  opened.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  await settle();
  return { host, saved };
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
  await act(async () => void element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 20 })));
  await settle();
}
async function openPlaces(host: HTMLElement) {
  if (host.querySelector('[data-testid="app-places"]')?.hasAttribute("hidden") !== false) await press(host.querySelector('[data-testid="app-places-open"]'));
  return host.querySelector<HTMLElement>('[data-testid="app-places"]')!;
}
const keeper = (may: KeptViewsMay, changes: LensTidyEdit[] = []) => memoryViews({ may, declaration: { change: (edit) => void changes.push(edit), restore: () => undefined } });
const names = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>(".graview-row-title")].map((link) => link.textContent!.trim());

describe("a list exported from its line and the place menu", () => {
  it("ends a kind's arranging line with a quiet Export CSV, a button by name, which writes the rows in the order the page draws them", async () => {
    const { host, saved } = await open("/shifts?sort=label");
    const button = host.querySelector<HTMLButtonElement>('[data-testid="arrange-export"]');
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.getAttribute("aria-label")).toBe("Export CSV");
    await press(button);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toMatch(/^Shifts — \d{4}-\d{2}-\d{2}\.csv$/);
    const [header, ...body] = parseCsv(saved[0]!.csv, { delimiter: "," });
    expect(header![0]).toBe("Name");
    expect(body.map((row) => row[0])).toEqual(names(host));
    expect(body.map((row) => row[0])).toEqual(["Another Monday", "Monday door", "Tuesday bar, late"]);
  });

  it("writes a Group column first when the list is grouped", async () => {
    const { host, saved } = await open("/shifts?group=day&sort=label");
    await press(host.querySelector('[data-testid="arrange-export"]'));
    const [header, ...body] = parseCsv(saved[0]!.csv, { delimiter: "," });
    expect(header!.slice(0, 2)).toEqual(["Group", "Name"]);
    expect(body.map((row) => row[1])).toEqual(names(host));
  });

  it("offers Export CSV in the place menu, and Turn off export to whoever may change the declaration, as set-lens-export on the kind", async () => {
    const changes: LensTidyEdit[] = [];
    const { host, saved } = await open("/shifts", { keptViews: keeper({ views: true, lenses: true }, changes) });
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-kind:shift"]'));
    expect(rows()).toEqual(expect.arrayContaining(["export-csv", "export-off"]));
    await press(menu()!.querySelector('[data-menu-item="export-csv"]'));
    expect(saved).toHaveLength(1);
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-kind:shift"]'));
    await press(menu()!.querySelector('[data-menu-item="export-off"]'));
    expect(changes).toEqual([{ op: "set-lens-export", title: "shift", export: false }]);
  });

  it("offers a reader who may not change the declaration Export CSV, and no switch", async () => {
    const { host } = await open("/shifts", { keptViews: keeper({ views: false, lenses: false }) });
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-kind:shift"]'));
    expect(rows()).toContain("export-csv");
    expect(rows()).not.toContain("export-off");
  });

  it("offers nobody Export where the declaration switched it off, and the owner Turn on export", async () => {
    const changes: LensTidyEdit[] = [];
    const { host } = await open("/shifts", { app: unexported, keptViews: keeper({ views: true, lenses: true }, changes) });
    expect(host.querySelector('[data-testid="arrange-export"]')).toBeNull();
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-kind:shift"]'));
    expect(rows()).not.toContain("export-csv");
    await press(menu()!.querySelector('[data-menu-item="export-on"]'));
    expect(changes).toEqual([{ op: "set-lens-export", title: "shift", export: true }]);
  });

  it("exports a lens that lists records from its line and its place menu, and switches it as set-lens-export on the lens", async () => {
    const changes: LensTidyEdit[] = [];
    const { host, saved } = await open("/places/by-day", { keptViews: keeper({ views: true, lenses: true }, changes) });
    await press(host.querySelector('[data-testid="arrange-export"]'));
    expect(saved[0]?.name).toMatch(/^By day — /);
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-place:shift:by-day"]'));
    expect(rows()).toEqual(expect.arrayContaining(["export-csv", "export-off"]));
    await press(menu()!.querySelector('[data-menu-item="export-off"]'));
    expect(changes).toEqual([{ op: "set-lens-export", title: "By day", on: "shift", export: false }]);
  });

  it("offers nobody Export on a lens its declaration switched off", async () => {
    const { host } = await open("/places/by-day", { app: unexported, keptViews: keeper({ views: false, lenses: false }) });
    expect(host.querySelector('[data-testid="arrange-export"]')).toBeNull();
    await rightClick((await openPlaces(host)).querySelector('[data-testid="app-place-place:shift:by-day"]'));
    expect(rows() ?? []).not.toContain("export-csv");
  });
});
