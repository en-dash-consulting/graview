// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { onTheOneFace, PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE ONE FACE IS WHAT A ROUTED FACE DRAWS UNLESS TOLD OTHERWISE (Graview HQ
 * feature:f-one-face-by-default). A `PagesApp` that owns its page and was
 * handed `views` is the page over the Scene's own city — Page, Nearby, Map
 * — with no option given. `sceneUnderPages: false` is a host's way to keep
 * the routed face alone; an embedded face (somebody else's page around it)
 * is the one face too, held to its box, unless its host says `false`.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const store = () => new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the van" }] as never, edges: [] } });
const views = () => registerDefaultViews(schema, createViews(schema));

async function drawn(extra: Partial<PageContext<typeof schema>>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: views(), ...extra } as PageContext<typeof schema>} initialPath="/tasks" />));
  for (let turn = 0; turn < 200 && extra.sceneUnderPages !== false && !host.querySelector("[data-graview-one-place]"); turn++) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  const oneFace = host.querySelector("[data-graview-one-place]") !== null;
  const switchToScene = [...host.querySelectorAll("button, a")].some((element) => /scene/i.test(element.textContent ?? ""));
  await act(async () => root.unmount());
  host.remove();
  return { oneFace, switchToScene };
}

describe("the one face is what a routed face draws unless told otherwise", () => {
  it("draws the page over the city when no option is given", async () => {
    const { oneFace, switchToScene } = await drawn({});
    expect(oneFace).toBe(true);
    expect(switchToScene).toBe(false);
  });

  it("draws the routed face alone when the host says sceneUnderPages: false", async () => {
    const { oneFace } = await drawn({ sceneUnderPages: false });
    expect(oneFace).toBe(false);
  });

  it("draws the one face in an embed's box too, unless the embed says sceneUnderPages: false", async () => {
    expect(onTheOneFace({ views: views(), embedded: true } as never)).toBe(true);
    expect(onTheOneFace({ views: views(), embedded: true, sceneUnderPages: false } as never)).toBe(false);
  });

  it("needs the views the city is drawn with", () => {
    expect(onTheOneFace({})).toBe(false);
    expect(onTheOneFace({ views: views() })).toBe(true);
    expect(onTheOneFace({ views: views(), sceneUnderPages: false })).toBe(false);
  });
});
