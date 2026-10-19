// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z, type AnySchema } from "@graview/core";
import type { ReactViewRegistry } from "@graview/react";
import { act, useLayoutEffect, useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DRAWN_ATTRIBUTE, mount, type EmbedHandle, type EmbedOptions, type EmbedWhere } from "../../src/index.js";

/**
 * THE PAGE SAYS WHEN A PLACE HAS DRAWN AND SETTLED (FR-188). Graview
 * Cloud pictures a place headless, and waited on a guess: its opening
 * frame gone, the network quiet, then 600 ms. Now the embed's root wears
 * `data-graview-drawn` — the place's path — once the place has drawn and
 * settled, and `onDrawn(place)` is told; a move takes it off in the same
 * commit and the next place puts it back. It waits for the face, the fonts
 * and every worker view, a failed one counting as settled with its plain
 * face. In a browser, against what a person sees: `pnpm verify drawn`.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }], edges: [] };

let handle: EmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
  host = undefined;
  delete (document as { fonts?: unknown }).fonts;
});

async function mounted(options: Partial<EmbedOptions>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, studio: false, face: "pages", ...options } as EmbedOptions);
  });
  return { root: () => host!.querySelector<HTMLElement>("[data-graview-embed]")!, handle: handle! };
}

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
async function until(check: () => boolean, ms = 4000): Promise<boolean> {
  for (let spent = 0; spent < ms; spent += 25) {
    if (check()) return true;
    await wait(25);
  }
  return check();
}

/* A worker view's place as the guest host draws one, its region drawn when the test says. */
const regions: HTMLElement[] = [];
function FakeWorkerHome() {
  const region = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => void (region.current && regions.push(region.current)), []);
  return (
    <div data-worker-view-place="front">
      <div ref={region} data-worker-view="front" />
    </div>
  );
}
const withWorkerHome = (_schema: AnySchema, registry: ReactViewRegistry<AnySchema>) => {
  registry.home?.(FakeWorkerHome as never);
  return registry;
};

describe("the page says when a place has drawn", () => {
  it("puts data-graview-drawn on the root once the place settles, and tells onDrawn the place", async () => {
    const told: EmbedWhere[] = [];
    const { root } = await mounted({ onDrawn: (place) => told.push(place) });
    expect(root().hasAttribute(DRAWN_ATTRIBUTE), "not before the face has drawn").toBe(false);
    expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE))).toBe(true);
    expect(root().getAttribute(DRAWN_ATTRIBUTE)).toBe("/");
    // What a person sees is there by then: the face, nothing on its way.
    expect(root().querySelector("[aria-busy=true]")).toBeNull();
    expect(root().textContent).toContain("Tasks");
    expect(told).toEqual([expect.objectContaining({ face: "pages", path: "/" })]);
  });

  it("takes it off in the commit that moves, and puts it back as the next place settles", async () => {
    const told: EmbedWhere[] = [];
    const { root, handle } = await mounted({ onDrawn: (place) => told.push(place) });
    expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE))).toBe(true);
    await act(async () => handle.setPath("/tasks"));
    expect(root().hasAttribute(DRAWN_ATTRIBUTE), "cleared on navigation").toBe(false);
    expect(await until(() => root().getAttribute(DRAWN_ATTRIBUTE) === "/tasks")).toBe(true);
    expect(told.map((place) => place.path)).toEqual(["/", "/tasks"]);
    // Another face is another place.
    await act(async () => handle.setFace("scene"));
    expect(root().hasAttribute(DRAWN_ATTRIBUTE)).toBe(false);
    expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE), 6000)).toBe(true);
    expect(told.at(-1)).toEqual(expect.objectContaining({ face: "scene", path: "/places/overview" }));
  });

  it("waits for the fonts", async () => {
    const fonts = { status: "loading", ready: Promise.resolve() };
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
    const { root } = await mounted({});
    await wait(800);
    expect(root().hasAttribute(DRAWN_ATTRIBUTE), "not while a font is loading").toBe(false);
    fonts.status = "loaded";
    expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE))).toBe(true);
  });

  it("waits for each worker view to draw, or to fail with its plain face", async () => {
    for (const ending of ["data-worker-view-drawn", "data-worker-view-failed"]) {
      regions.length = 0;
      const { root } = await mounted({ views: withWorkerHome as never });
      expect(await until(() => regions.length > 0)).toBe(true);
      await wait(800);
      expect(root().hasAttribute(DRAWN_ATTRIBUTE), `not before the view says ${ending}`).toBe(false);
      regions.at(-1)!.setAttribute(ending, ending === "data-worker-view-failed" ? "start" : "");
      expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE)), ending).toBe(true);
      await act(async () => handle?.unmount());
      host?.remove();
      handle = undefined;
    }
  });
});
