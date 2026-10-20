// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A LONG LIST IS SKIPPED INTO.
 *
 * From the heading a list's first box was twenty-five Tabs away — every
 * related list, every chip, every way to arrange stood between — where the
 * pointer pressed it (walks XI and XII). The press after adding one is the
 * way into the records, and Enter on it puts the keyboard on the boxes' one
 * stop; the bar's first stop is the way to the content, which on a list is
 * the same records.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.patchNode(args.taskId, { done: true }),
});
const store = () =>
  new Store({
    schema,
    mutations: [finish],
    snapshot: { nodes: Array.from({ length: 30 }, (_, at) => ({ id: `t${at}`, kind: "task", label: `Task ${String(at).padStart(2, "0")}`, done: false })) as never, edges: [] },
  });

// jsdom lays nothing out; every element is drawn, as a browser would draw these.
const rects = HTMLElement.prototype.getClientRects;
beforeAll(() => {
  HTMLElement.prototype.getClientRects = function () {
    return [{ width: 1, height: 1 }] as unknown as DOMRectList;
  };
});
afterAll(() => {
  HTMLElement.prototype.getClientRects = rects;
});

async function open(path: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store() }} initialPath={path} />));
  await act(async () => new Promise<void>((done) => setTimeout(done, 50)));
  return { host, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}

describe("a long list", () => {
  it("offers the way into its records as the press after its heading's own, said with how many", async () => {
    const { host, unmount } = await open("/tasks");
    const skip = host.querySelector<HTMLButtonElement>('[data-graview-skip="records"]');
    expect(skip?.textContent).toBe("Skip to the 30 tasks");
    // Before it in the page's order: only the bar, the heading's line and its way to add one.
    const stops = [...host.querySelectorAll<HTMLElement>("main a[href], main button, main input")];
    expect(stops.indexOf(skip!)).toBeLessThanOrEqual(1);
    await unmount();
  });

  it("puts the keyboard on the boxes' one stop when it is pressed", async () => {
    const { host, unmount } = await open("/tasks");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-graview-skip="records"]')!.click());
    const at = document.activeElement as HTMLElement;
    expect(at.hasAttribute("data-graview-choose-box")).toBe(true);
    expect(at.tabIndex).toBe(0);
    await unmount();
  });

  it("is where the bar's first stop, the way to the content, takes the keyboard too", async () => {
    const { host, unmount } = await open("/tasks");
    const first = host.querySelector<HTMLElement>("a[href], button, input");
    expect(first?.getAttribute("data-graview-skip")).toBe("content");
    await act(async () => first!.click());
    expect((document.activeElement as HTMLElement).hasAttribute("data-graview-choose-box")).toBe(true);
    await unmount();
  });
});
