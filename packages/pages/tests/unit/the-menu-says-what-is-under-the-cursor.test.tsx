// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSchema, defineNode, Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE RIGHT-CLICK MENU, ABOUT WHAT IS UNDER THE CURSOR (Roadmap
 * request:add-copy-link-under-open-in-a-new-tab, request:right-click-context-menu-options-to-be-more-relevant-to-the-item-under-my-cursor):
 * "Copy link" directly under "Open in a new tab", the browser's own menu
 * with Option held, a selection copied rather than swallowed, and a column offering a record put in it and the place
 * narrowed to it.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean().default(false) }),
  plural: "Tasks",
  label: (node) => node.label,
});
const schema = createSchema([task]);

const MENU = '[data-testid="context-menu"]';
let cleanup: (() => Promise<void>) | undefined;
let written: string[] = [];
beforeEach(() => {
  written = [];
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (text: string) => (written.push(text), Promise.resolve()) } });
});
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  getSelection()?.removeAllRanges();
});

async function until(holds: () => boolean, what: string, within = 5000) {
  for (const end = Date.now() + within; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((done) => setTimeout(done, 10));
    });
    if (holds()) return;
    if (Date.now() > end) throw new Error(`waited ${within} ms for ${what}`);
  }
}
function steady(read: () => string | undefined): () => boolean {
  let last: string | undefined;
  return () => {
    const now = read();
    const same = now !== undefined && now === last;
    last = now;
    return same;
  };
}
const menu = () => document.querySelector<HTMLElement>(MENU);
const rows = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])].map((button) => button.getAttribute("data-menu-item"));
const drawn = (host: HTMLElement) => until(steady(() => (host.querySelector("main") ? host.innerHTML : undefined)), "the page to draw");
const opened = () => until(steady(() => (menu()?.querySelector("[data-menu-item], [data-affordance]") ? menu()!.innerHTML : undefined)), "the menu to open");

async function mounted(context: PageContext<AnySchema>, path: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath={path} />));
  await drawn(host);
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

async function tasks(path: string) {
  const store = new Store({ schema, snapshot: { nodes: [{ id: "deposit", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] } });
  return mounted({ store, views: createViews(schema) } as never, path);
}

async function rightClick(element: Element) {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 });
  await act(async () => void element.dispatchEvent(event));
  if (event.defaultPrevented) await opened();
  return event;
}

async function press(item: string) {
  await act(async () => menu()!.querySelector<HTMLButtonElement>(`[data-menu-item="${item}"]`)!.click());
  await until(() => true, "the press");
}

describe("the right-click menu on the routed face", () => {
  it("offers Copy link directly under Open in a new tab, copying the whole address and saying so", async () => {
    const host = await tasks("/tasks");
    await rightClick(host.querySelector('[data-graview-record="deposit"] a')!);
    const offered = rows();
    expect(offered.indexOf("copy-link")).toBe(offered.indexOf("open-in-a-new-tab") + 1);
    await press("copy-link");
    await until(() => written.length > 0, "the clipboard");
    expect(written[0]).toBe(new URL("/tasks/deposit", location.href).href);
    await until(() => host.querySelector('[data-testid="menu-said"]')?.textContent === "Link copied", "Link copied");
  });

  it("offers no Inspect: what the menu is for is what can be done (Inspect, shipped in 0.1.63, is gone)", async () => {
    const host = await tasks("/tasks");
    await rightClick(host.querySelector('[data-graview-record="deposit"] a')!);
    expect(rows()).not.toContain("inspect");
    expect(rows()).toContain("copy-link");
  });

  it("leaves a right-click with Option held to the browser's own menu, and opens ours on a Ctrl+click, a Mac trackpad's right-click", async () => {
    const host = await tasks("/tasks");
    const link = host.querySelector('[data-graview-record="deposit"] a')!;
    const withOption = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, altKey: true, clientX: 40, clientY: 60 });
    await act(async () => void link.dispatchEvent(withOption));
    expect(withOption.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
    const withCtrl = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 0, ctrlKey: true, clientX: 40, clientY: 60 });
    await act(async () => void link.dispatchEvent(withCtrl));
    expect(withCtrl.defaultPrevented).toBe(true);
    await opened();
    expect(rows()).toContain("copy-link");
  });

  it("copies a selection rather than swallowing it: Copy first elsewhere, the browser's own menu on the selected text", async () => {
    const host = await tasks("/tasks");
    const heading = host.querySelector<HTMLElement>("main h1, main h2")!;
    const range = document.createRange();
    range.selectNodeContents(heading);
    getSelection()!.addRange(range);
    const said = getSelection()!.toString();
    expect(said.trim()).not.toBe("");
    const onIt = await rightClick(heading.firstChild instanceof Element ? heading.firstChild : heading);
    expect(onIt.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
    await rightClick(host.querySelector('[data-graview-record="deposit"] a')!);
    expect(rows()[0]).toBe("copy-selection");
    await press("copy-selection");
    await until(() => written.length > 0, "the clipboard");
    expect(written[0]).toBe(said);
  });

  it("opens over a word the right-click itself selected, as Safari selects one, and puts the selection back", async () => {
    const host = await tasks("/tasks/deposit");
    const heading = host.querySelector<HTMLElement>('[data-testid="record-fields"] h2')!;
    // Nothing selected when the button goes down; WebKit selects the word under it before the menu event.
    await act(async () => void heading.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 })));
    const range = document.createRange();
    range.selectNodeContents(heading);
    getSelection()!.addRange(range);
    const event = await rightClick(heading);
    expect(event.defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
    expect(rows()).not.toContain("copy-selection");
    expect(getSelection()!.isCollapsed).toBe(true);
  });
});

/* A STATUS BOARD: the tasks document's board, a column of it under the cursor. */
const document_ = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/tasks.gdd.json"), "utf8"));
const compiled = compileDocument(document_, { today: () => "2026-09-01" });
if (!compiled.ok) throw new Error("tasks did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
beforeAll(() => fetchDeclaredLenses());

describe("a column under the cursor", () => {
  async function board() {
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: app.mutations ?? [],
      snapshot: { nodes: [{ id: "t1", kind: "task", label: "Write the brief", status: "todo" }, { id: "t2", kind: "task", label: "Book the hall", status: "doing" }] as never, edges: [] },
    });
    const views = declaredViews(app);
    const place = views.places().find((one) => one.title === "The board")!;
    const host = await mounted({ store, views } as never, `/places/${place.as}`);
    await until(() => host.querySelector('[data-column="status:doing"]') !== null, "the board's columns");
    return { host, store };
  }

  it("offers adding a task in it, the column's value given, and the form asks only the rest", async () => {
    const { host, store } = await board();
    const column = host.querySelector('[data-column="status:doing"]')!;
    expect(column.getAttribute("data-column-kind")).toBe("task");
    await rightClick(column);
    const add = menu()!.querySelector('[data-menu-item="add-in-column"]');
    expect(add?.textContent).toMatch(/^Add a task in Doing$/i);
    expect(rows()).toContain("show-only-column");
    await press("add-in-column");
    await until(() => menu()?.querySelector("form input") !== null && menu()?.querySelector("form input") !== undefined, "the add form");
    const field = menu()!.querySelector<HTMLInputElement>("form input")!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(field, "Hang the lights");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => void field.form!.requestSubmit());
    await until(() => store.graph.nodesOfKind("task").length === 3, "the task added");
    const added = store.graph.nodesOfKind("task").find((node) => (node as { label?: string }).label === "Hang the lights") as { status?: string } | undefined;
    expect(added?.status).toBe("doing");
  });

  it("shows only that column when asked, narrowing the place as its address would", async () => {
    const { host } = await board();
    await rightClick(host.querySelector('[data-column="status:doing"]')!);
    await press("show-only-column");
    await until(() => host.querySelector('[data-graview-listed="t1"]') === null, "the place narrowed");
    expect(host.querySelector('[data-graview-listed="t2"]')).not.toBeNull();
  });
});
