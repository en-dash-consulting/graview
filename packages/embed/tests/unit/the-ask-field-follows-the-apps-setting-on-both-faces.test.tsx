// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";

// Every face fetched before the first mount, so each draws in the commit `mount` makes (FR-57).
beforeAll(() => preload());

/**
 * THE ASK FIELD IS THE APP'S SETTING, ON EVERY FACE (Roadmap
 * bug-pages-view-ignores-the-app-s-ask-box-display-setting).
 *
 * A host that said `seat: "hidden"` had no field on the scene and one on
 * Pages anyway: the routed face drew its own without reading the setting.
 * Both faces now read the same one, and a host that changes it changes
 * both at once, without mounting again.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const app = defineApp({ name: "Errands", schema, mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Post the letter" }], edges: [] } as never;

let host: HTMLElement;
let handle: EmbedHandle | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  sessionStorage.clear();
});

const opened = async (options: Partial<EmbedOptions>) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host, { app, fonts: false, seed, label: "Errands", ...options } as unknown as EmbedOptions);
  });
  await act(async () => handle!.drawn());
  // The face settles: a page's own effects, the seat's measuring.
  for (let turn = 0; turn < 20; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
};
const hasField = () => host.querySelector('[data-testid="seat-field"]') !== null;
const settle = async () => {
  for (let turn = 0; turn < 20; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
};

describe("the ask field follows the app's setting on both faces", () => {
  for (const face of ["scene", "pages"] as const) {
    it(`draws no field on the ${face} face when the setting hides it, and one when it does not`, async () => {
      await opened({ face, seat: "hidden" });
      expect(hasField()).toBe(false);
      await act(async () => handle!.unmount());
      host.remove();
      handle = undefined;
      await opened({ face, seat: "field" });
      expect(hasField()).toBe(true);
    });
  }

  it("changes on the face that is open when the host changes the setting, with no new mount", async () => {
    await opened({ face: "pages", path: "/tasks/t1" });
    expect(hasField()).toBe(true);
    await act(async () => handle!.setAskField("hidden"));
    await settle();
    expect(hasField()).toBe(false);
    await act(async () => handle!.setFace("scene"));
    await act(async () => handle!.drawn());
    await settle();
    expect(hasField()).toBe(false);
    await act(async () => handle!.setAskField("field"));
    await settle();
    expect(hasField()).toBe(true);
    await act(async () => handle!.setFace("pages"));
    await act(async () => handle!.drawn());
    await settle();
    expect(hasField()).toBe(true);
  });
});
