// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A BOARD MOVES WITHOUT BUTTONS (Roadmap f-board-move-without-buttons), AND
 * TAKES SEARCH, FILTER AND COLUMN OPTIONS (Roadmap f-lens-search-filter).
 *
 * A Move… button under every card doubled the board's height. Now a card is
 * dragged, carried by the keyboard — Space picks it up, the arrows carry it,
 * Space drops it, Escape puts it back, each step said in a live region — or
 * moved from its menu's "Move to ›", the withheld columns struck through
 * with the reason. The board says what Find looks in, which fields stand as
 * chips, which columns open shut or are left off, and how many cards a
 * column keeps; narrowed, a card moves as before.
 */
const fixture = (name: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../../core/tests/document/fixtures/${name}`), "utf8"));
const tasks = fixture("tasks.gdd.json");
const vendors = fixture("vendor-steps.gdd.json");

const OWNER: Principal = { kind: "human", id: "p1", roles: ["owner"] };
const FOUR = [
  { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
  { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
  { id: "t3", kind: "task", label: "Order the chairs", status: "todo" },
  { id: "t4", kind: "task", label: "Send the invitations", status: "done" },
  { id: "p1", kind: "person", label: "Ada" },
];

beforeAll(() => fetchDeclaredLenses());
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function settle(turns = 3, ms = 20) {
  for (let turn = 0; turn < turns; turn += 1) await act(async () => new Promise((done) => setTimeout(done, ms)));
}

async function board(options: Record<string, unknown> | undefined, nodes: readonly Record<string, unknown>[] = FOUR, doc: Record<string, unknown> = tasks, principal: Principal = OWNER) {
  const lens: Record<string, unknown> = { ...(doc["lenses"] as Record<string, unknown>[])[0], ...(options ? { options } : {}) };
  const compiled = compileDocument({ ...doc, lenses: [lens] }, { today: () => "2026-10-06" });
  if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes, edges: [] } as never });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const path = `/places/${String(lens["title"]).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal }} initialPath={path} />));
  await settle();
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  const columns = () =>
    [...host.querySelectorAll<HTMLElement>("[data-graview-column]")].map((column) => [
      column.getAttribute("data-graview-column"),
      column.querySelector('[data-testid="columns-count"]')?.textContent,
      [...column.querySelectorAll("[data-graview-listed]")].map((card) => card.getAttribute("data-graview-listed")).sort(),
    ]);
  const link = (id: string) => host.querySelector<HTMLElement>(`[data-graview-listed="${id}"] .graview-spec-item-link`)!;
  const said = () => host.querySelector('[data-testid="columns-announce"]')?.textContent ?? "";
  return { host, store, columns, link, said };
}

async function press(target: Element, key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  await act(async () => void target.dispatchEvent(event));
  return event;
}

async function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle(2);
}

describe("a card on a status board", () => {
  it("has no Move button under it unless the board asks for one", async () => {
    const plain = await board(undefined);
    expect(plain.host.querySelectorAll('[data-testid="columns-move"]').length).toBe(0);
    expect(plain.host.querySelectorAll('[draggable="true"]').length).toBe(4);
    await cleanup?.();
    const asked = await board({ move: true });
    expect(asked.host.querySelectorAll('[data-testid="columns-move"]').length).toBe(4);
  });

  it("stays one stop for Tab, and says how it moves", async () => {
    const { host, link } = await board(undefined);
    const card = host.querySelector('[data-graview-listed="t1"]')!;
    // The boxes that choose several cards are one stop for the whole board, the arrows going from it to the rest (`choosing.ts`): not the card's.
    const stops = [...card.querySelectorAll<HTMLElement>("a[href], button, input, [tabindex]")].filter((element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled && !element.hasAttribute("data-graview-choose-box"));
    expect(stops).toEqual([link("t1")]);
    const how = document.getElementById(link("t1").getAttribute("aria-describedby") ?? "");
    expect(how?.textContent).toContain("Space picks it up");
  });

  it("is carried by the keyboard: Space picks it up, the arrows carry it, Space drops it as the act, each step said", async () => {
    const { store, columns, link, said, host } = await board(undefined);
    link("t1").focus();
    expect((await press(link("t1"), " ")).defaultPrevented).toBe(true);
    expect(said()).toContain("Write the brief, picked up. Todo, 1 of 2.");
    await press(link("t1"), "ArrowRight");
    expect(said()).toBe("Doing, 1 of 2.");
    expect(host.querySelector('[data-graview-column="doing"] [data-testid="columns-slot"]')).not.toBeNull();
    await press(link("t1"), "ArrowDown");
    expect(said()).toBe("Doing, 2 of 2.");
    await press(link("t1"), "ArrowRight");
    expect(said()).toBe("Done, 2 of 2.");
    await press(link("t1"), "ArrowLeft");
    await press(link("t1"), " ");
    await settle(1);
    expect(said()).toBe("Write the brief, dropped in Doing.");
    expect(columns()).toEqual([
      ["todo", "1", ["t3"]],
      ["doing", "2", ["t1", "t2"]],
      ["done", "1", ["t4"]],
    ]);
    expect(store.log.all().at(-1)?.mutation).toEqual({ name: "set-status", args: { id: "t1", status: "doing" } });
    expect(store.log.all().at(-1)?.author).toMatchObject({ id: "p1" });
    // The keyboard stays with the card, in its new column, and the board says what it did with the undo beside it.
    expect(document.activeElement).toBe(link("t1"));
    expect(host.querySelector('[data-testid="columns-said"]')?.textContent).toContain("Moved “Write the brief” to Doing.");
  });

  it("is put back by Escape, and nothing is run", async () => {
    const { store, columns, link, said } = await board(undefined);
    const before = store.log.all().length;
    link("t1").focus();
    await press(link("t1"), " ");
    await press(link("t1"), "ArrowRight");
    await press(link("t1"), "Escape");
    expect(said()).toBe("Write the brief, put back in Todo.");
    expect(store.log.all().length).toBe(before);
    expect(columns()[0]).toEqual(["todo", "2", ["t1", "t3"]]);
  });

  it("is moved from its menu's Move to ›, which lists the columns it may go to", async () => {
    const { store, link, host } = await board(undefined);
    await act(async () => void link("t3").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
    await settle(4, 30);
    const menu = document.querySelector<HTMLElement>('[data-testid="context-menu"]')!;
    const row = menu.querySelector<HTMLButtonElement>('[data-menu-item="move-to"]')!;
    expect(row.textContent).toContain("Move to");
    await act(async () => row.click());
    const offered = [...menu.querySelectorAll<HTMLButtonElement>("[data-move-to]")];
    expect(offered.map((button) => [button.getAttribute("data-move-to"), button.disabled])).toEqual([
      ["doing", false],
      ["done", false],
    ]);
    await act(async () => offered[1]!.click());
    await settle();
    expect(store.graph.getNode("t3")?.["status"]).toBe("done");
    expect(host.querySelector('[data-testid="columns-said"]')?.textContent).toContain("Moved “Order the chairs” to Done.");
  });

  it("strikes through a column it may not go to in that menu, with the reason", async () => {
    const owner: Principal = { kind: "human", id: "o1", roles: ["owner"] };
    const { link } = await board(undefined, [{ id: "v-in", kind: "vendor", name: "Sugar & Spoon", status: "contacted" }], vendors, owner);
    await act(async () => void link("v-in").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
    await settle(4, 30);
    const menu = document.querySelector<HTMLElement>('[data-testid="context-menu"]')!;
    await act(async () => menu.querySelector<HTMLButtonElement>('[data-menu-item="move-to"]')!.click());
    // Nothing the shortlist declares sets a vendor back to researching: struck, and said.
    const researching = menu.querySelector<HTMLButtonElement>('[data-move-to="researching"]')!;
    expect(researching.disabled).toBe(true);
    expect(researching.querySelector("s")?.textContent).toBe("Researching");
    expect(researching.closest("li")?.textContent).toContain("Nothing in this app moves a vendor to Researching.");
    expect(menu.querySelector<HTMLButtonElement>('[data-move-to="booked"]')?.disabled).toBe(false);
  });
});

describe("a board's options", () => {
  it("looks in the fields search names, and a narrowed card still moves by the keyboard", async () => {
    const { host, link, store } = await board({ search: ["label"] });
    const find = host.querySelector<HTMLInputElement>('[data-testid="arrange-query"]')!;
    expect(find).not.toBeNull();
    await type(find, "brief");
    expect([...host.querySelectorAll("[data-graview-listed]")].map((card) => card.getAttribute("data-graview-listed"))).toEqual(["t1"]);
    link("t1").focus();
    await press(link("t1"), " ");
    await press(link("t1"), "ArrowRight");
    await press(link("t1"), " ");
    expect(store.graph.getNode("t1")?.["status"]).toBe("doing");
  });

  it("shows Find unasked on a board of more than twenty cards, and not on a small one", async () => {
    const small = await board(undefined);
    expect(small.host.querySelector('[data-testid="arrange-query"]')).toBeNull();
    await cleanup?.();
    const many = Array.from({ length: 21 }, (_, at) => ({ id: `m${at}`, kind: "task", label: `Task ${at}`, status: "todo" }));
    const large = await board(undefined, many);
    expect(large.host.querySelector('[data-testid="arrange-query"]')).not.toBeNull();
  });

  it("stands its filters as chips", async () => {
    const { host } = await board({ filters: ["status"] });
    expect(host.querySelector('[data-testid="arrange-chips"], [data-testid="arrange-chip"]')).not.toBeNull();
  });

  it("opens a collapsed column shut, leaves a hidden one off, and keeps a capped column to its newest", async () => {
    const { host, columns } = await board({ collapsed: ["done"], hidden: ["doing"], cap: 1 });
    expect(columns()).toEqual([
      ["todo", "2", ["t3"]],
      ["done", "1", []],
    ]);
    const toggle = host.querySelector<HTMLButtonElement>('[data-graview-column="done"] [data-testid="columns-toggle"]')!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => toggle.click());
    expect(columns()[1]).toEqual(["done", "1", ["t4"]]);
    const rest = host.querySelector<HTMLButtonElement>('[data-graview-column="todo"] [data-testid="columns-rest"]')!;
    expect(rest.textContent).toBe("Show 1 more");
    await act(async () => rest.click());
    expect(columns()[0]).toEqual(["todo", "2", ["t1", "t3"]]);
  });
});
