// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobsApp, jobsSeed, sam } from "../../../../scripts/fixtures/jobs-app.js";
import type { MountGuestViewOptions } from "../../src/host/frame.js";
import { guestView } from "../../src/host/react.js";

/**
 * A GUEST VIEW TELLS ITS HOST EACH HEIGHT, AND WHAT IT HELD (Roadmap
 * f-guest-growth-guard). `mountGuestView` took `onSize` and `guestView`
 * did not, so a host drawing a frame guest through the framework could not
 * size what holds it. `guestView({ onSize })` is now told each height once
 * the frame has taken it, and `onProblem` what the frame's host could not do
 * — a height held because the guest grew only with its own frame — which is
 * said in the console as well, whether or not the host listens.
 */
const mounted = vi.hoisted(() => ({ frames: [] as { options: MountGuestViewOptions<never>; iframe: HTMLIFrameElement }[] }));
vi.mock("../../src/host/frame.js", () => ({
  mountGuestView: (_element: HTMLElement, options: MountGuestViewOptions<never>) => {
    const iframe = document.createElement("iframe");
    mounted.frames.push({ options, iframe });
    return { iframe, update() {}, dispose() {} };
  },
}));
afterEach(() => {
  mounted.frames.length = 0;
  vi.restoreAllMocks();
});

async function draw(View: ViewComponent<AnySchema>) {
  const store = new Store({ schema: jobsApp.schema, mutations: [], policy: jobsApp.policy!, snapshot: structuredClone(jobsSeed) as never }) as unknown as Store<AnySchema>;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} principal={sam} views={createViews(store.schema)} initialView={EMPTY_VIEW}>
        <View nodes={store.graph.allNodes().filter((node) => node.kind === "job") as never} cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
      </GraviewProvider>,
    ),
  );
  for (let tries = 0; tries < 50 && mounted.frames.length === 0; tries++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  return async () => {
    await act(async () => root.unmount());
    host.remove();
  };
}

describe("a guest view in a frame", () => {
  it("is sized by each height the guest is given, and tells its host the height", async () => {
    const heights: number[] = [];
    const done = await draw(guestView({ url: "https://guest.example/view.html", name: "jobs", onSize: (height) => heights.push(height) }));
    const [{ options, iframe }] = mounted.frames as [(typeof mounted.frames)[number]];
    options.onSize!(640);
    expect(iframe.style.height).toBe("640px");
    expect(heights).toEqual([640]);
    await done();
  });

  it("takes each height itself where the host does not listen", async () => {
    const done = await draw(guestView({ url: "https://guest.example/view.html", name: "jobs" }));
    expect(mounted.frames[0]!.options.onSize).toBeUndefined();
    await done();
  });

  it("says what its host held to the host, and in the console whether or not the host listens", async () => {
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    const problems: string[] = [];
    const done = await draw(guestView({ url: "https://guest.example/view.html", name: "jobs", onProblem: (said) => problems.push(said) }));
    mounted.frames[0]!.options.onProblem!("The view \"jobs\" … is held at 224px.");
    expect(problems).toEqual(['The view "jobs" … is held at 224px.']);
    expect(warned).toHaveBeenCalledWith('jobs: The view "jobs" … is held at 224px.');
    await done();
  });
});
