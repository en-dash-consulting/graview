// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { fetchDeclaredLenses } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { Embed, preload } from "../../src/index.js";

/**
 * A STATUS BOARD ON THE GRAVIEW FACE (FR-97): the embed handed a document
 * whose first place is a `columns` lens opens on it in the scene — the
 * columns in the field's order, each record a card — and offers a move only
 * to a seat whose policy runs the act that sets the field.
 */
const tasks = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/tasks.gdd.json"), "utf8"));
const compiled = compileDocument(tasks, { today: () => "2026-10-06" });
if (!compiled.ok) throw new Error("tasks did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
    { id: "t3", kind: "task", label: "Order the chairs", status: "done" },
    { id: "p2", kind: "person", label: "Grace" },
  ],
  edges: [{ id: "e1", kind: "assigned-to", from: "t1", to: "p2" }],
};

beforeAll(() => Promise.all([preload(), fetchDeclaredLenses()]));

async function scene(principal: Principal) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<Embed app={app} seed={seed as never} face="scene" principal={principal} fonts={false} />));
  await act(async () => new Promise((done) => setTimeout(done, 30)));
  const board = host.querySelector('[data-testid="columns-lens"]');
  const columns = [...(board?.querySelectorAll("[data-graview-column]") ?? [])].map((column) => [column.getAttribute("data-graview-column"), column.querySelector('[data-testid="columns-count"]')?.textContent]);
  const moves = board?.querySelectorAll('[data-testid="columns-move"]').length ?? 0;
  await act(async () => root.unmount());
  host.remove();
  return { columns, moves };
}

describe("a status board in the embed's scene", () => {
  it("opens on the board, its columns in the field's order, with a move on every card for a seat that may run the act", async () => {
    const owner = await scene({ kind: "human", id: "p1", roles: ["owner"] });
    expect(owner.columns).toEqual([["todo", "1"], ["doing", "1"], ["done", "1"]]);
    expect(owner.moves).toBe(3);
  });

  it("offers a seat without the act no move, and counts only what that seat sees", async () => {
    const viewer = await scene({ kind: "human", id: "p2", roles: ["viewer"] });
    expect(viewer.columns).toEqual([["todo", "1"], ["doing", "0"], ["done", "0"]]);
    expect(viewer.moves).toBe(0);
  });
});
