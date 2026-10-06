// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * THE SCENE'S RULES COME WITH THE SCENE (FR-104). The frame's sheet is
 * every face's; the scene's own rules — the plots, the village, the
 * districts from altitude — are drawn by the scene face, after the frame's
 * sheet and inside the embed's box, so a page that opens on the pages face
 * carries none of them and one that opens on the scene has them in the
 * commit that draws it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }], edges: [] };

async function drawn(face: EmbedOptions["face"]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, seed, fonts: false, face } as EmbedOptions);
  });
  let done = false;
  void handle!.drawn().then(() => (done = true));
  for (let turn = 0; !done && turn < 200; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  expect(done, "the face was drawn").toBe(true);
  const sheets = [...host.querySelectorAll("style")].map((style) => style.textContent ?? "");
  const unmount = async () => {
    await act(async () => handle!.unmount());
    host.remove();
  };
  return { host, sheets, unmount };
}

describe("the scene's rules come with the scene", () => {
  it("are drawn by the scene face, after the frame's sheet and inside the embed's box", async () => {
    const { host, sheets, unmount } = await drawn("graview");
    const scope = host.querySelector("section")!.className;
    const frame = sheets.findIndex((css) => css.includes("--graview-font-body"));
    const scene = sheets.findIndex((css) => css.includes(".graview-plot-tile"));
    expect(frame).toBeGreaterThanOrEqual(0);
    expect(scene).toBeGreaterThan(frame);
    expect(sheets[frame]).not.toContain(".graview-plot-tile");
    expect(sheets[scene]).toContain(`:where(.${scope}) .graview-plot-tile`);
    await unmount();
  });

  it("are not on a page that draws the pages face", async () => {
    const { sheets, unmount } = await drawn("pages");
    expect(sheets.some((css) => css.includes("--graview-font-body"))).toBe(true);
    expect(sheets.some((css) => css.includes(".graview-plot-tile"))).toBe(false);
    await unmount();
  });
});
