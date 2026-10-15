// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Trail } from "../../src/index.js";

/*
 * A RAISED KIND IS A WAY INTO IT (the tenth walk, carried). From todo's
 * "The lists", pressing the Tasks district raises the tasks as a relation
 * of the lists — what a press there means — and then nothing on the screen
 * went into them, where their list is narrowed: only a double-click nobody
 * is told about. The raised chip's name goes in; its × lets it down.
 */
const list = defineNode("list", { fields: z.object({ label: z.string() }), plural: "Lists" });
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([list, task]);

async function raised() {
  const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "l1", kind: "list", label: "Today" }, { id: "t1", kind: "task", label: "Book the van" }] as never, edges: [] } });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let view: ViewState = { ...EMPTY_VIEW, focusId: "aggregate:list", relation: "task" };
  const draw = () =>
    act(() => {
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={view} view={view} onViewChange={(next) => { view = next; void draw(); }}>
          <Trail home="aggregate:list" onPicture />
        </GraviewProvider>,
      );
    });
  await draw();
  return { host, view: () => view, done: () => act(async () => root.unmount()) };
}

describe("a raised kind on the picture's trail", () => {
  it("goes into the kind by its name, where its list is arranged", async () => {
    const { host, view, done } = await raised();
    const into = host.querySelector<HTMLButtonElement>('[data-testid="raised-into"]');
    expect(into?.getAttribute("aria-label")).toBe("Go into the tasks");
    await act(async () => into!.click());
    expect(view()).toMatchObject({ focusId: "aggregate:task", relation: null, zoom: true });
    await done();
  });

  it("lets it down with its ×, where it was", async () => {
    const { host, view, done } = await raised();
    const down = host.querySelector<HTMLButtonElement>('[data-testid="raised"]');
    expect(down?.getAttribute("aria-label")).toBe("Stop showing tasks");
    await act(async () => down!.click());
    expect(view()).toMatchObject({ focusId: "aggregate:list", relation: null });
    await done();
  });
});
