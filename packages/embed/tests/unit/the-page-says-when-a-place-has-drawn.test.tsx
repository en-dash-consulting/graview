// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z, type AnySchema } from "@graview/core";
import type { ReactViewRegistry } from "@graview/react";
import { lazyPart } from "@graview/react";
import { act, Suspense, useLayoutEffect, useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DRAWN_ATTRIBUTE, PAINTED_ATTRIBUTE, mount, type EmbedHandle, type EmbedOptions, type EmbedWhere } from "../../src/index.js";

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
    handle = mount(host!, { sceneUnderPages: false, app, seed, fonts: false, studio: false, face: "pages", ...options } as EmbedOptions);
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

  it("waits for each frame guest to draw, or to fail to say it is ready, and for its frame's host to arrive", async () => {
    for (const ending of ["data-guest-view-drawn", "data-guest-view-failed"]) {
      frames.length = 0;
      const { root } = await mounted({ views: withFrameHome as never });
      expect(await until(() => holders.length > 0)).toBe(true);
      await wait(600);
      expect(root().hasAttribute(DRAWN_ATTRIBUTE), "not while the frame's host is on its way").toBe(false);
      // The frame's host arrives and draws its frame, as guestView does.
      await act(async () => {
        const frame = document.createElement("iframe");
        frame.setAttribute("data-guest-view", "card");
        frame.setAttribute("aria-busy", "true");
        holders.at(-1)!.appendChild(frame);
        holders.at(-1)!.removeAttribute("aria-busy");
        frames.push(frame);
      });
      await wait(600);
      expect(root().hasAttribute(DRAWN_ATTRIBUTE), `not before the frame says ${ending}`).toBe(false);
      // As the frame's host says either: the frame no longer busy.
      frames.at(-1)!.setAttribute(ending, ending === "data-guest-view-failed" ? "silent" : "");
      frames.at(-1)!.removeAttribute("aria-busy");
      expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE)), ending).toBe(true);
      await act(async () => handle?.unmount());
      host?.remove();
      handle = undefined;
      holders.length = 0;
    }
  });
});

describe("the page says when it is painted, what stands under it still to come", () => {
  /* A home with a worker view, and a part under the page that arrives when the test says. */
  const homeOver = () => {
    let arrive!: (module: { readonly default: () => ReactNode }) => void;
    const Under = lazyPart(() => new Promise<{ readonly default: () => ReactNode }>((resolve) => (arrive = resolve)), { under: true });
    function Home() {
      return (
        <>
          <FakeWorkerHome />
          <Suspense fallback={null}>
            <Under />
          </Suspense>
        </>
      );
    }
    const views = (_schema: AnySchema, registry: ReactViewRegistry<AnySchema>) => {
      registry.home?.(Home as never);
      return registry;
    };
    return { views, arrive: (draw: () => ReactNode) => act(async () => arrive({ default: draw })) };
  };

  it("says painted once its view has drawn, and drawn only once the part under it has come", async () => {
    regions.length = 0;
    const { views, arrive } = homeOver();
    const { root } = await mounted({ views: views as never });
    expect(await until(() => regions.length > 0)).toBe(true);
    await wait(800);
    expect(root().hasAttribute(PAINTED_ATTRIBUTE), "not before the view has drawn").toBe(false);
    regions.at(-1)!.setAttribute("data-worker-view-drawn", "");
    expect(await until(() => root().getAttribute(PAINTED_ATTRIBUTE) === "/")).toBe(true);
    await wait(800);
    expect(root().hasAttribute(DRAWN_ATTRIBUTE), "the part under it has not come").toBe(false);
    await arrive(() => <p>The city</p>);
    expect(await until(() => root().getAttribute(DRAWN_ATTRIBUTE) === "/")).toBe(true);
  });

  it("waits for the part under the page where the page is out of the window, over the city", async () => {
    const { views, arrive } = homeOver();
    regions.length = 0;
    const { root } = await mounted({ views: views as never });
    expect(await until(() => regions.length > 0)).toBe(true);
    regions.at(-1)!.parentElement!.setAttribute("data-graview-away", "");
    regions.at(-1)!.setAttribute("data-worker-view-drawn", "");
    await wait(800);
    expect(root().hasAttribute(PAINTED_ATTRIBUTE)).toBe(false);
    await arrive(() => <p>The city</p>);
    expect(await until(() => root().hasAttribute(PAINTED_ATTRIBUTE))).toBe(true);
  });

  /*
   * THE CITY IS SAID DRAWN WHEN IT HAS DRAWN (Graview HQ
   * feature:f-city-drawn-waits-its-cap): its frame loop writes its own
   * attributes every frame, most of them as they were, and the drawn mark
   * took each write for a move, so a place over the city was said drawn
   * only at the ten seconds. Painted and drawn alike take such a write for
   * no change.
   */
  it("takes an attribute written again as it was for no change, as a city's frame loop writes its own, painted and drawn alike", async () => {
    const { root } = await mounted({ views: withWorkerHome as never });
    expect(await until(() => regions.length > 0)).toBe(true);
    const region = regions.at(-1)!;
    const loop = setInterval(() => region.setAttribute("data-camera", "1.0000"), 16);
    try {
      await wait(300);
      const drew = performance.now();
      region.setAttribute("data-worker-view-drawn", "");
      expect(await until(() => root().hasAttribute(PAINTED_ATTRIBUTE), 2500)).toBe(true);
      expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE), 2500), "drawn while the loop still writes, well before the ten seconds").toBe(true);
      expect(performance.now() - drew).toBeLessThan(2500);
    } finally {
      clearInterval(loop);
    }
  });

  it("waits for an attribute that changes", async () => {
    const { root } = await mounted({ views: withWorkerHome as never });
    expect(await until(() => regions.length > 0)).toBe(true);
    const region = regions.at(-1)!;
    region.setAttribute("data-worker-view-drawn", "");
    let n = 0;
    const loop = setInterval(() => region.setAttribute("data-camera", `${n++}`), 16);
    await wait(1200);
    expect(root().hasAttribute(PAINTED_ATTRIBUTE)).toBe(false);
    clearInterval(loop);
    expect(await until(() => root().hasAttribute(PAINTED_ATTRIBUTE))).toBe(true);
  });

  it("takes both off in the commit that moves", async () => {
    const { root, handle } = await mounted({});
    expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE))).toBe(true);
    expect(root().getAttribute(PAINTED_ATTRIBUTE)).toBe("/");
    await act(async () => handle.setPath("/tasks"));
    expect(root().hasAttribute(PAINTED_ATTRIBUTE)).toBe(false);
    expect(await until(() => root().getAttribute(PAINTED_ATTRIBUTE) === "/tasks")).toBe(true);
  });

  it("never says painted for time alone", async () => {
    regions.length = 0;
    const { root } = await mounted({ views: withWorkerHome as never });
    expect(await until(() => regions.length > 0)).toBe(true);
    // A view that never draws: drawn is said after ten seconds all the same.
    expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE), 14_000)).toBe(true);
    expect(root().hasAttribute(PAINTED_ATTRIBUTE)).toBe(false);
  }, 20_000);
});

/* A frame guest's holder as guestView draws one: busy until the frame's host has drawn its frame in it, the frame busy until the guest has drawn. */
const holders: HTMLElement[] = [];
const frames: HTMLIFrameElement[] = [];
function FakeFrameHome() {
  const holder = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => void (holder.current && holders.push(holder.current)), []);
  return <div ref={holder} data-guest="card" aria-busy="true" />;
}
const withFrameHome = (_schema: AnySchema, registry: ReactViewRegistry<AnySchema>) => {
  registry.home?.(FakeFrameHome as never);
  return registry;
};
