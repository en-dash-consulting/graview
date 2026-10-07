// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions, type EmbedReady } from "../../src/index.js";

/**
 * A FACE IS FETCHED AS IT IS DRAWN (FR-57). Every face was imported
 * outright, so a page that drew the pages carried the scene and one that
 * drew the scene carried the routed face: Graview Cloud's hosted page
 * loaded 1.1 MB before the app drew. The frame — the strip, the theme, the
 * provider — is on the page when `mount` returns; the face follows with its
 * chunk, `drawn()` says when, and `onReady` is told then, not before. A host
 * that knows its face starts it early with `preload`.
 *
 * This file never preloads before the first test: it is the only one that
 * sees a face arrive.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }], edges: [] };

async function mounted(options: Partial<EmbedOptions>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, seed, fonts: false, ...options } as EmbedOptions);
  });
  return { host, handle: handle!, done: async () => {
    await act(async () => handle!.unmount());
    host.remove();
  } };
}

/**
 * `drawn()` resolves on the commit that draws the face, and inside one
 * `act` that commit waits for the callback: so the face's chunk is let in
 * one turn at a time, each in its own `act`, until the face is drawn.
 */
async function untilDrawn(handle: EmbedHandle) {
  let drawn = false;
  void handle.drawn().then(() => (drawn = true));
  for (let turn = 0; !drawn && turn < 200; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  expect(drawn, "the face was drawn").toBe(true);
}

describe("a face fetched as it is drawn", () => {
  it("stands the frame first, then the face, and tells the host when the face is drawn", async () => {
    const ready: EmbedReady[] = [];
    const { host, handle, done } = await mounted({ face: "pages", onReady: (one) => ready.push(one) });
    // The frame is the embed's own: its region, its strip, its theme.
    expect(host.querySelector("[data-graview-embed=pages]")).not.toBeNull();
    expect(host.querySelector("[data-testid=app-bar]")).not.toBeNull();
    // And the face is on its way, not yet drawn: its chunk is fetched as it is first drawn.
    expect(host.querySelector("[aria-busy=true]")).not.toBeNull();
    expect(ready).toEqual([]);
    await untilDrawn(handle);
    expect(host.querySelector("[aria-busy=true]")).toBeNull();
    expect(host.textContent).toContain("Tasks");
    expect(ready.map((one) => one.face)).toEqual(["pages"]);
    await done();
  });

  it("fetches the scene when the reader switches to it, and draws() waits for it", async () => {
    const { host, handle, done } = await mounted({ face: "pages" });
    await untilDrawn(handle);
    await act(async () => handle.setFace("scene"));
    await untilDrawn(handle);
    expect(host.querySelector("[data-graview-embed=scene]")).not.toBeNull();
    expect(host.querySelector("[aria-busy=true]")).toBeNull();
    expect(host.querySelector("[data-graview-stage]")).not.toBeNull();
    await done();
  });

  it("draws a face that was preloaded in the commit mount makes, with nothing to wait for", async () => {
    await preload("pages");
    const host = document.createElement("div");
    document.body.appendChild(host);
    let handle: EmbedHandle | undefined;
    act(() => {
      handle = mount(host, { app, seed, fonts: false, face: "pages" } as EmbedOptions);
    });
    expect(host.querySelector("[aria-busy=true]")).toBeNull();
    expect(host.textContent).toContain("Tasks");
    await act(async () => handle!.unmount());
    host.remove();
  });
});
