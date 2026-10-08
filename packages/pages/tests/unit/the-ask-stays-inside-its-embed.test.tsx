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
 * THE ASK STAYS IN ITS OWN BOX. graview.dev's chapters stood the routed
 * face's "Ask" at the foot of the window, over the hero's caption and over
 * every section scrolled past, wherever the embed it belonged to was.
 */
const VIEW = { width: 1440, height: 900 };
const ASK = { width: 70, height: 40 };

describe("the Ask stays inside its embed", () => {
  it("stands at the foot's left of the box it belongs to, not the window's", () => {
    const place = askPlace({ left: 646, top: 142, right: 1304, bottom: 802 }, VIEW, ASK);
    expect(place.shown).toBe(true);
    expect(place.button).toEqual({ left: 662, bottom: 900 - 802 + 16 });
    expect(place.drawer).toEqual({ left: 646, top: 142, height: 660, width: 320 });
  });

  it("stands at the window's foot while the box runs past it", () => {
    const place = askPlace({ left: 100, top: 300, right: 800, bottom: 1400 }, VIEW, ASK);
    expect(place.shown).toBe(true);
    expect(place.button.bottom).toBe(16);
    expect(place.drawer).toEqual({ left: 100, top: 300, height: 600, width: 320 });
  });

  it("is put away when its box is scrolled out of the window, or too little of it shows", () => {
    expect(askPlace({ left: 100, top: -900, right: 800, bottom: -100 }, VIEW, ASK).shown).toBe(false);
    expect(askPlace({ left: 100, top: 1000, right: 800, bottom: 1600 }, VIEW, ASK).shown).toBe(false);
    expect(askPlace({ left: 100, top: 860, right: 800, bottom: 1600 }, VIEW, ASK).shown).toBe(false);
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
    const ask = embed.querySelector<HTMLElement>('[data-testid="page-ask"]');
    expect(ask).not.toBeNull();
    // The embed is below the window: its Ask is not drawn over the page the reader is looking at.
    expect(ask!.style.visibility).toBe("hidden");
    expect(ask!.style.left).toBe("216px");
    await act(async () => root.unmount());
    embed.remove();
  });
});
