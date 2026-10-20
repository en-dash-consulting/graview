// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A STATUS BOARD SAYS HOW MANY RECORDS THE LIFECYCLE HIDES (W-244). A
 * review queue whose "False trigger" and "Duplicate" columns held about
 * 2,500 detections retired by the kind's lifecycle said "False trigger 0 ·
 * Nothing here.", and a card moved there left the board with nothing saying
 * where it went. A column with records behind the horizon says "+N past",
 * as a district and a list do, and one press shows them in it.
 */
const tasks = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/tasks.gdd.json"), "utf8"));
const retiring = { ...tasks, kinds: { ...tasks.kinds, task: { ...tasks.kinds.task, lifecycle: { field: "status", retired: ["done"] } } } };
const compiled = compileDocument(retiring, { today: () => "2026-10-06" });
if (!compiled.ok) throw new Error(`tasks with a lifecycle did not compile: ${JSON.stringify(compiled)}`);
const app = compiled.app as GraviewApp<AnySchema>;

const OWNER: Principal = { kind: "human", id: "p1", roles: ["owner"] };
const seed = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
    { id: "t3", kind: "task", label: "Order the chairs", status: "done" },
    { id: "t4", kind: "task", label: "Send the invitations", status: "done" },
    { id: "p1", kind: "person", label: "Ada" },
  ],
  edges: [],
};

beforeAll(() => fetchDeclaredLenses());

async function rendered() {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: seed as never });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: OWNER }} initialPath="/places/the-board" />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const column = (value: string) => host.querySelector<HTMLElement>(`[data-graview-column="${value}"]`)!;
  const cards = (value: string) => [...column(value).querySelectorAll("[data-graview-listed]")].map((card) => card.getAttribute("data-graview-listed")).sort();
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, store, column, cards, done };
}

describe("a status board says how many records the lifecycle hides", () => {
  it("says \"+2 past\" in a column whose records are all behind the horizon, not \"Nothing here.\"", async () => {
    const { column, cards, done } = await rendered();
    expect(cards("done")).toEqual([]);
    expect(column("done").textContent).not.toContain("Nothing here.");
    expect(column("done").querySelector('[data-testid="columns-past"]')?.textContent).toBe("+2 past");
    expect(column("done").getAttribute("aria-label")).toBe("The board · Done, 0, 2 past");
    // A column with nothing behind it says nothing of the past.
    expect(column("todo").querySelector('[data-testid="columns-past"]')).toBeNull();
    await done();
  });

  it("shows them in their column with one press, and says nothing more of the past", async () => {
    const { column, cards, done } = await rendered();
    await act(async () => column("done").querySelector<HTMLButtonElement>('[data-testid="columns-past"]')!.click());
    expect(cards("done")).toEqual(["t3", "t4"]);
    expect(column("done").querySelector('[data-testid="columns-past"]')).toBeNull();
    await done();
  });

  it("counts a card moved behind the horizon, so it does not leave the board unsaid", async () => {
    const { store, column, done } = await rendered();
    await act(async () => void store.apply({ name: "set-status", args: { id: "t1", status: "done" } }, { author: OWNER }));
    expect(column("done").querySelector('[data-testid="columns-past"]')?.textContent).toBe("+3 past");
    await done();
  });
});
