// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { askPlace } from "../../src/ask-place.js";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE SEAT STAYS IN ITS OWN BOX. graview.dev's chapters stood the routed
 * face's "Ask" at the foot of the window, over the hero's caption and over
 * every section scrolled past, wherever the embed it belonged to was. The
 * seat stands in the part of its embed's box that shows on the screen.
 */
const VIEW = { width: 1440, height: 900 };
const FIELD = { width: 160, height: 40 };

describe("the seat stays inside its embed", () => {
  it("stands in the box it belongs to, not the window", () => {
    const place = askPlace({ left: 646, top: 142, right: 1304, bottom: 802 }, VIEW, FIELD);
    expect(place).toEqual({ shown: true, left: 646, top: 142, width: 658, height: 660 });
  });

  it("stands at the window's foot while the box runs past it", () => {
    const place = askPlace({ left: 100, top: 300, right: 800, bottom: 1400 }, VIEW, FIELD);
    expect(place).toEqual({ shown: true, left: 100, top: 300, width: 700, height: 600 });
  });

  it("is put away when its box is scrolled out of the window, or too little of it shows", () => {
    expect(askPlace({ left: 100, top: -900, right: 800, bottom: -100 }, VIEW, FIELD).shown).toBe(false);
    expect(askPlace({ left: 100, top: 1000, right: 800, bottom: 1600 }, VIEW, FIELD).shown).toBe(false);
    expect(askPlace({ left: 100, top: 860, right: 800, bottom: 1600 }, VIEW, FIELD).shown).toBe(false);
  });

  it("is placed from its embed's box when the face is drawn inside one", async () => {
    const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
    const schema = createSchema([task]);
    const { defineMutation } = bindSchema(schema);
    const rename = defineMutation("rename", {
      title: "Rename",
      subject: { kinds: ["task"], arg: "taskId" },
      writes: ["label"],
      input: z.object({ taskId: nodeRef(["task"]), label: z.string() }),
      apply: (ctx, args) => ctx.patchNode(args.taskId, { label: args.label }),
    });
    const Board: ViewComponent<typeof schema> = ({ nodes }) => <div>{nodes?.length ?? 0} on the board</div>;
    const views = createViews(schema).register("task", { cardinality: "many", fidelity: "full" }, Board, { title: "The board" });
    const store = new Store({ schema, mutations: [rename], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay" }] as never, edges: [] } });
    const embed = document.createElement("div");
    embed.setAttribute("data-embed-content", "");
    embed.getBoundingClientRect = () => ({ left: 200, top: 2000, right: 900, bottom: 2600, x: 200, y: 2000, width: 700, height: 600, toJSON: () => ({}) });
    document.body.append(embed);
    const root = createRoot(embed);
    await act(async () => root.render(<PagesApp context={{ store, views, embedded: true } as PageContext<typeof schema>} initialPath="/" />));
    const box = embed.querySelector<HTMLElement>('[data-testid="page-seat"]');
    expect(box).not.toBeNull();
    expect(box!.querySelector('[data-testid="seat-field"]')).not.toBeNull();
    // The embed is below the window: its seat is not drawn over the page the reader is looking at.
    expect(box!.style.visibility).toBe("hidden");
    expect(box!.style.left).toBe("200px");
    await act(async () => root.unmount());
    embed.remove();
  });
});
