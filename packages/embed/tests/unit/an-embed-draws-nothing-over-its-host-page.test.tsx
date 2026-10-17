// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle } from "../../src/pages.js";

beforeAll(() => preload());

/**
 * AN EMBED DRAWS NOTHING OVER ITS HOST'S PAGE. The scene's corner control
 * ("Close the map") carries a z-index of its own, and the embed's root made
 * no stacking context: on graview.dev's live demos at 768 wide, the docs'
 * sticky rail (z-index 10) scrolled over a demo and the demo's control
 * stood over the rail's links, so a press on "With a model" landed on the
 * demo. The root isolates, so every layer inside it is ordered inside it,
 * and the host's own stacking decides where the embed stands as a whole.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const app = defineApp({ name: "Field notes", schema: createSchema([note]), mutations: [] });

describe("an embed draws nothing over its host page", () => {
  it("the scene's root is its own stacking context", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, fonts: false, face: "scene" } as EmbedOptions);
    });
    expect(host.querySelector<HTMLElement>("section[data-graview-embed]")?.style.isolation).toBe("isolate");
    await act(async () => handle!.unmount());
    host.remove();
  });

  it("the pages' root is its own stacking context", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let handle: PagesEmbedHandle | undefined;
    await act(async () => {
      handle = mountPages(host, { app, fonts: false });
    });
    expect(host.querySelector<HTMLElement>("section[data-graview-embed]")?.style.isolation).toBe("isolate");
    await act(async () => handle!.unmount());
    host.remove();
  });
});
