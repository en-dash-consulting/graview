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
 * A STATUS BOARD ON THE ROUTED FACE (FR-97), from a document and nothing
 * else: a task kind with a status, an act that sets it, and
 *
 *   { "name": "columns", "title": "The board", "bindings": { "task": { "column": "status" } } }
 *
 * The owner may run the act, and moves a card with the keyboard; the move
 * is the act, in the log under the owner's name, and undo takes it back. A
 * viewer may not, and is offered no move; they see only their own tasks,
 * and the counts are theirs.
 */
const tasks = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/tasks.gdd.json"), "utf8"));
const compiled = compileDocument(tasks, { today: () => "2026-10-06" });
if (!compiled.ok) throw new Error("tasks did not compile");
const app = compiled.app as GraviewApp<AnySchema>;

const OWNER: Principal = { kind: "human", id: "p1", roles: ["owner"] };
const VIEWER: Principal = { kind: "human", id: "p2", roles: ["viewer"] };
const seed = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
    { id: "t3", kind: "task", label: "Order the chairs", status: "todo" },
    { id: "t4", kind: "task", label: "Send the invitations", status: "done" },
    { id: "p1", kind: "person", label: "Ada" },
    { id: "p2", kind: "person", label: "Grace" },
  ],
  edges: [
    { id: "e1", kind: "assigned-to", from: "t1", to: "p2" },
    { id: "e2", kind: "assigned-to", from: "t2", to: "p2" },
  ],
};

beforeAll(() => fetchDeclaredLenses());

async function rendered(principal: Principal) {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: seed as never });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal }} initialPath="/places/the-board" />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const columns = () =>
    [...host.querySelectorAll<HTMLElement>("[data-graview-column]")].map((column) => [
      column.getAttribute("data-graview-column"),
      column.querySelector('[data-testid="columns-count"]')?.textContent,
      // In a column, the records come in the order the face hands them; which ones is the claim.
      [...column.querySelectorAll("[data-graview-listed]")].map((card) => card.getAttribute("data-graview-listed")).sort(),
    ]);
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, store, columns, done };
}

const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));

describe("a status board on the routed face", () => {
  it("draws the field's choices as columns in declared order, each record by its card", async () => {
    const { host, columns, done } = await rendered(OWNER);
    expect(host.querySelector("h1")?.textContent).toContain("The board");
    expect(columns()).toEqual([
      ["todo", "2", ["t1", "t3"]],
      ["doing", "1", ["t2"]],
      ["done", "1", ["t4"]],
    ]);
    // Each card is a link to its record's page.
    expect(host.querySelector('[data-graview-listed="t1"] a.graview-spec-item-link')?.getAttribute("href")).toContain("t1");
    await done();
  });

  it("moves a card with the keyboard by running the act as the viewer, and one undo puts it back", async () => {
    const { host, store, columns, done } = await rendered(OWNER);
    const button = host.querySelector<HTMLButtonElement>('[data-columns-move="t1"] > button')!;
    button.focus();
    await act(async () => button.click());
    const menu = host.querySelector<HTMLElement>('[data-columns-move="t1"] [role="menu"]')!;
    expect([...menu.querySelectorAll("[role=menuitem]")].map((item) => item.textContent)).toEqual(["Doing", "Done"]);
    expect(document.activeElement?.textContent).toBe("Doing");
    await act(async () => void key(menu, "ArrowDown"));
    expect(document.activeElement?.textContent).toBe("Done");
    await act(async () => void key(menu, "ArrowUp"));
    await act(async () => (document.activeElement as HTMLButtonElement).click());
    expect(columns()).toEqual([
      ["todo", "1", ["t3"]],
      ["doing", "2", ["t1", "t2"]],
      ["done", "1", ["t4"]],
    ]);
    const op = store.log.all().at(-1);
    expect(op?.author).toMatchObject({ id: "p1" });
    expect(op?.mutation).toEqual({ name: "set-status", args: { id: "t1", status: "doing" } });
    // The keyboard stays with the card it moved.
    expect(document.activeElement?.closest("[data-columns-move]")?.getAttribute("data-columns-move")).toBe("t1");
    expect(host.querySelector('[data-testid="columns-said"]')?.textContent).toContain("Moved “Write the brief” to Doing.");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="columns-undo"]')!.click());
    expect(columns()[0]).toEqual(["todo", "2", ["t1", "t3"]]);
    expect(store.graph.getNode("t1")?.["status"]).toBe("todo");
    await done();
  });

  it("offers a viewer whose policy has no such act no move, and shows them only what they see, counted", async () => {
    const { host, columns, done } = await rendered(VIEWER);
    expect(columns()).toEqual([
      ["todo", "1", ["t1"]],
      ["doing", "1", ["t2"]],
      ["done", "0", []],
    ]);
    expect(host.querySelectorAll('[data-testid="columns-move"]').length).toBe(0);
    expect(host.querySelector('[draggable="true"]')).toBeNull();
    await done();
  });
});
