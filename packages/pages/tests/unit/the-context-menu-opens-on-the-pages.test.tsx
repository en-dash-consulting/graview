// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type GraviewApp, type Policy, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses } from "@graview/primitives";
import { createViews, type MenuSectionSource } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE SCENE'S CONTEXT MENU, ON THE ROUTED FACE. A right-click on a record's
 * row, its page, one of its values, a picture's mark or the page's own
 * ground opens the one menu the scene opens — the acts `@graview/tools`
 * derives for what it landed on, narrowed by the seat — with what this face
 * adds: going there, a new tab, the scene, changing the value, Find. Shift+F10
 * and the context-menu key open it on what has the keyboard, a resting finger
 * opens it on a phone, Escape closes it and gives the keyboard back, and the
 * browser keeps its own menu in a text field and with Shift held.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), due: z.string().optional(), done: z.boolean().default(false) }),
  plural: "Tasks",
  label: (node) => node.label,
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false }),
});
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.taskId, { done: true }),
});
const remove = defineMutation("remove-task", {
  title: "Remove it",
  subject: { kinds: ["task"], arg: "taskId" },
  destructive: true,
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => void ctx.removeNode(args.taskId),
});
const policy: Policy = { grants: [{ roles: ["keeper"], mutations: "*" }, { roles: ["reader"], mutations: ["finish"], describe: "Only a keeper takes a task away." }] };

const MENU = '[data-testid="context-menu"]';
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function rendered(path: string, also: { principal?: Principal; menuSections?: readonly MenuSectionSource[] } = {}) {
  const store = new Store({
    schema,
    mutations: [add, finish, remove],
    ...(also.principal ? { policy } : {}),
    snapshot: {
      nodes: [
        { id: "deposit", kind: "task", label: "Pay the deposit", due: "2026-09-01", done: false },
        { id: "book", kind: "task", label: "Book the hall", done: false },
      ] as never,
      edges: [],
    },
  });
  const context: PageContext<typeof schema> = { store, views: createViews(schema), ...(also.principal ? { principal: also.principal } : {}), ...(also.menuSections ? { menuSections: also.menuSections } : {}) };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath={path} />));
  await drawn(host);
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, store };
}

/**
 * Waits for what a test is about to read, polling until it holds (bounded),
 * never a count of turns: the menu and its sections are lazily loaded, and a
 * loaded machine takes longer than three short turns to fetch them.
 */
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

/** True once `read` has said the same thing twice running: what was arriving has arrived. */
function steady(read: () => string | undefined): () => boolean {
  let last: string | undefined;
  return () => {
    const now = read();
    const same = now !== undefined && now === last;
    last = now;
    return same;
  };
}

/** The page drawn and still: its lazy parts have stopped arriving. */
const drawn = (host: HTMLElement) => until(steady(() => (host.querySelector("main") ? host.innerHTML : undefined)), "the page to draw");
/** The menu open with its rows, and its sections arrived. */
const opened = () => until(steady(() => (menu()?.querySelector("[data-menu-item], [data-affordance], [data-testid]") ? menu()!.innerHTML : undefined)), "the menu to open");
/** The menu gone. */
const closed = () => until(() => menu() === null, "the menu to close");

async function rightClick(element: Element, init: MouseEventInit = {}) {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60, ...init });
  await act(async () => void element.dispatchEvent(event));
  // A press the browser keeps opens no menu; there is nothing to wait for.
  if (event.defaultPrevented) await opened();
  return event;
}

const menu = () => document.querySelector<HTMLElement>(MENU);
const acts = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-affordance]:not([disabled])") ?? [])].map((button) => button.textContent!.replace(/ …$/, ""));
const rows = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])].map((button) => button.getAttribute("data-menu-item"));

describe("the context menu on the routed face", () => {
  it("opens on a list's row with the row's record's acts, and the way to it", async () => {
    const { host } = await rendered("/tasks");
    const row = [...host.querySelectorAll('[data-graview-record="book"]')][0]!;
    const event = await rightClick(row.querySelector(".graview-row-glance") ?? row);
    expect(event.defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
    expect(menu()!.textContent).toContain("Book the hall");
    expect(acts()).toContain("Mark it done");
    expect(acts()).not.toContain("Add a task");
    expect(rows()).toEqual(expect.arrayContaining(["open", "open-in-a-new-tab", "in-the-scene"]));
  });

  it("opens on a record's page about that record, without going to the page it is on", async () => {
    const { host } = await rendered("/tasks/deposit");
    await rightClick(host.querySelector("main")!);
    expect(acts()).toContain("Mark it done");
    expect(rows()).not.toContain("open");
    expect(rows()).toContain("in-the-scene");
  });

  it("opens on a value on a record's page with changing that value first, then the record's acts", async () => {
    const { host } = await rendered("/tasks/deposit");
    const value = host.querySelector<HTMLElement>('[data-testid="record-fields"] [data-graview-field="due"][data-graview-editable]')!;
    expect(value).not.toBeNull();
    await rightClick(value);
    const change = menu()!.querySelector<HTMLButtonElement>('[data-menu-item="change-field"]')!;
    expect(change.textContent).toBe("Change “Due”");
    expect(acts()).toContain("Mark it done");
    // First in the menu: before the acts.
    expect(change.compareDocumentPosition(menu()!.querySelector("[data-affordance]")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await act(async () => change.click());
    await closed();
    expect(menu()).toBeNull();
    expect(host.querySelector('[data-testid="record-fields"] input[data-graview-field="due"]')).not.toBeNull();
  });

  it("opens on a list's own ground with adding one of its kind, and Find", async () => {
    const { host } = await rendered("/tasks");
    await rightClick(host.querySelector("main h1, main h2")!);
    expect(menu()!.textContent).toContain("Tasks");
    expect(acts()).toEqual(["Add a task"]);
    expect(rows()).toContain("find");
    expect(rows()).not.toContain("open");
  });

  it("narrows the acts by the seat and says what is withheld, the way the scene says it", async () => {
    const { host } = await rendered("/tasks/deposit", { principal: { kind: "human", id: "r", roles: ["reader"] } });
    await rightClick(host.querySelector("main")!);
    expect(acts()).toContain("Mark it done");
    expect(acts()).not.toContain("Remove it");
    expect(menu()!.querySelector('[data-testid="withheld"]')?.textContent).toContain("Remove it");
  });

  it("opens from the keyboard with Shift+F10 and the context-menu key, on what has the keyboard", async () => {
    const { host } = await rendered("/tasks");
    const link = host.querySelector<HTMLAnchorElement>('[data-graview-record="deposit"] a')!;
    link.focus();
    for (const init of [{ key: "F10", shiftKey: true }, { key: "ContextMenu" }]) {
      const press = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
      await act(async () => void link.dispatchEvent(press));
      await opened();
      expect(press.defaultPrevented).toBe(true);
      expect(menu()!.textContent).toContain("Pay the deposit");
      expect(menu()!.contains(document.activeElement)).toBe(true);
      await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
      await closed();
    }
  });

  it("opens under a finger resting on the page, and the press that opened it follows no link", async () => {
    // On a record's page: a list that chooses keeps its own long press (resting on a row chooses it).
    const { host } = await rendered("/tasks/deposit");
    const link = host.querySelector<HTMLAnchorElement>('main a[href="/tasks"]')!;
    await act(async () => void link.dispatchEvent(Object.assign(new MouseEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 30 }), { pointerType: "touch", isPrimary: true })));
    await act(async () => new Promise((done) => setTimeout(done, 650)));
    await opened();
    expect(menu()!.textContent).toContain("Tasks");
    expect(acts()).toEqual(["Add a task"]);
    // The finger lifts: its click follows no link.
    const lift = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => void link.dispatchEvent(lift));
    expect(lift.defaultPrevented).toBe(true);
    expect(host.querySelector('[data-testid="record-fields"]')).not.toBeNull();
  });

  it("closes on Escape and gives the keyboard back to where it was opened", async () => {
    const { host } = await rendered("/tasks");
    const link = host.querySelector<HTMLAnchorElement>('[data-graview-record="book"] a')!;
    await rightClick(link);
    expect(menu()!.contains(document.activeElement)).toBe(true);
    await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await closed();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(link);
  });

  it("keeps the browser's own menu in a text field, and with Shift held", async () => {
    const { host } = await rendered("/tasks");
    const find = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(find).not.toBeNull();
    // Beside it, the page's own ground opens the menu: the rule is where, not whether.
    expect((await rightClick(find.closest("form")!.parentElement!)).defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
    await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await closed();
    const inField = await rightClick(find);
    expect(inField.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
    const shifted = await rightClick(host.querySelector('[data-graview-record="book"] a')!, { shiftKey: true });
    expect(shifted.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });

  it("draws a host's section beside the acts, told what the menu was opened on", async () => {
    const told: string[] = [];
    const ask: MenuSectionSource = (target) => {
      told.push(`${target.face}:${target.on ?? "-"}`);
      return { id: "ask", heading: "Ask", items: [{ id: "ask-about", label: "Ask about this", run: () => undefined }] };
    };
    const { host } = await rendered("/tasks", { menuSections: [ask] });
    await rightClick(host.querySelector('[data-graview-record="book"] a')!);
    expect(menu()!.querySelector('[data-menu-section="ask"] [data-menu-item="ask-about"]')?.textContent).toBe("Ask about this");
    expect(told).toContain("pages:book");
  });
});

/* A PICTURE'S MARKS AND ITS GROUND: the every-lens hall, each lens a page of its own. */
const hall = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/every-lens.gdd.json"), "utf8"));
const compiled = compileDocument(hall, { today: () => "2026-09-01" });
if (!compiled.ok) throw new Error("every-lens did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = {
  nodes: [
    { id: "s1", kind: "shift", label: "Monday door", day: "mon", from: 540, until: 720, on: "2026-09-07" },
    { id: "s2", kind: "shift", label: "Friday bar", day: "fri", from: 1080, until: 1320, on: "2026-09-11" },
    { id: "v1", kind: "volunteer", label: "Ada" },
    { id: "seat-1", kind: "seat", label: "Front left", x: 0.2, y: 0.3 },
    { id: "r1", kind: "room", label: "The cellar" },
    { id: "m1", kind: "member", label: "Nora" },
  ],
  edges: [
    { id: "e1", kind: "covered-by", from: "s1", to: "v1" },
    { id: "e2", kind: "taken-by", from: "seat-1", to: "v1" },
  ],
};
beforeAll(() => fetchDeclaredLenses());

async function aPlace(as: string) {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: seed as never });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: { kind: "human", id: "m1", roles: ["keeper"] } }} initialPath={`/places/${as}`} />));
  await drawn(host);
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

describe("the context menu on a picture's page", () => {
  it("opens on a lens block's mark about the record it draws", async () => {
    const place = declaredViews(app).places().find((one) => one.kind === "shift")!;
    const host = await aPlace(place.as);
    const mark = host.querySelector('[data-testid="place-lens"] [data-graview-pick="s1"]')!;
    expect(mark).not.toBeNull();
    await rightClick(mark);
    expect(menu()!.textContent).toContain("Monday door");
    expect(rows()).toEqual(expect.arrayContaining(["open", "in-the-scene"]));
  });

  it("opens on the lens's own ground about its place: its title, and what its kind offers", async () => {
    const place = declaredViews(app).places().find((one) => one.kind === "shift")!;
    const host = await aPlace(place.as);
    await rightClick(host.querySelector('[data-testid="place-lens"]')!);
    expect(menu()!.textContent).toContain(place.title);
    expect(rows()).toEqual(expect.arrayContaining(["in-the-scene", "find"]));
    expect(rows()).not.toContain("open");
  });
});
