// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * THE SCENE FACE, MOUNTED AT ITS ROOT, OPENS ON THE OVERVIEW (from Graview
 * Cloud). `mount(stage, { face: "scene", routing: "memory" })` opened on
 * the scene descended on nothing — a near-empty floor, the kinds' tiles
 * along its foot — where `graview preview`, at `/places/overview`, opens on
 * the whole thing from above. A scene asked for with nowhere to be (no
 * stop, no path but the overview's, no place handed back, no first place
 * in the declaration) opens on the overview, as the overview's own address
 * does; under address routing the bare base is the same. A host that says
 * where — a stop, a page's path — is drawn what it asked for.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }], edges: [] };
/** The whole thing from above, on the scene's face: where "Up" rises to. */
const OVERVIEW = { face: "scene", path: "/places/overview", stop: "#overview=1" };

let handle: EmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
  host = undefined;
  window.history.replaceState(null, "", "/");
});

async function mounted(options: Partial<EmbedOptions>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, studio: false, ...options } as EmbedOptions);
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 200)));
  return { drawn: () => host!.querySelector<HTMLElement>("[data-graview-embed]")!.getAttribute("data-graview-embed"), handle: handle! };
}

describe("the scene face, mounted at its root", () => {
  it("opens on the overview under memory routing, as the overview's own address does", async () => {
    const { drawn, handle } = await mounted({ face: "scene", routing: "memory" });
    expect(handle.where()).toEqual(OVERVIEW);
    expect(drawn()).toBe("scene");
  });

  it("opens on the overview with no face named, and with the overview's path", async () => {
    expect((await mounted({})).handle.where()).toEqual(OVERVIEW);
    await act(async () => handle?.unmount());
    expect((await mounted({ face: "scene", path: "/places/overview" })).handle.where()).toEqual(OVERVIEW);
  });

  it("opens on the overview under address routing at a bare base, and the address is the overview's", async () => {
    window.history.replaceState(null, "", "/a/errands");
    const { handle } = await mounted({ face: "scene", routing: "address", basePath: "/a/errands" });
    expect(handle.where()).toEqual(OVERVIEW);
    expect(window.location.pathname + window.location.hash).toBe("/a/errands/places/overview");
  });

  it("is drawn where a host says: a stop is the scene there, and the Graview is still the Graview", async () => {
    expect((await mounted({ face: "scene", routing: "memory", stop: "#focus=t1" })).handle.where()).toEqual({ face: "scene", path: "/places/overview", stop: "#focus=t1", kind: "task" });
    await act(async () => handle?.unmount());
    expect((await mounted({ face: "graview", routing: "memory" })).handle.where()).toEqual({ ...OVERVIEW, face: "graview" });
  });

  it("goes down to a stop the host sets after it opened", async () => {
    const { handle } = await mounted({ face: "scene", routing: "memory" });
    await act(async () => handle.setStop("#focus=t1"));
    expect(handle.where()).toEqual({ face: "scene", path: "/places/overview", stop: "#focus=t1", kind: "task" });
  });

  it("opens a page's path on the pages, as before", async () => {
    expect((await mounted({ face: "pages", path: "/tasks" })).handle.where()).toMatchObject({ face: "pages", path: "/tasks" });
  });
});
