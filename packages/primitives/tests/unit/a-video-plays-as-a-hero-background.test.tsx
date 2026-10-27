// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { FileValue, HostFiles } from "@graview/core";
import { HostFilesContext } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Files } from "../../src/index.js";

/**
 * A VIDEO PLAYS AS A HERO BACKGROUND ON THE FACE (Roadmap f-video-hero).
 *
 * The face's player, asked to `autoplay`, is a background: muted, looping,
 * inline, with no controls and nothing said under it; `cover` fills its
 * box. Where the person asked for less motion it stands still at its
 * poster, fetching only its metadata, and is let go when they stop asking.
 */
const beach: FileValue = { href: "/graview/files/9c1e.mp4", name: "beach.mov", type: "video/mp4", bytes: 18_400_000, width: 1920, height: 1080, duration: 45, poster: "/graview/files/9c1e.jpg", caption: "The waves at dusk" };
const underBase: HostFiles = { maxBytes: 50_000_000, kinds: ["image/*", "video/*"], upload: async () => beach, src: (href) => `/a/moments${href}` };

/* The person's motion setting, set by the test and changed while the page is open; jsdom plays nothing, so what is asked of the player is held. */
const listeners = new Set<() => void>();
const query = { matches: false, addEventListener: (_: string, on: () => void) => listeners.add(on), removeEventListener: (_: string, on: () => void) => listeners.delete(on) };
const asked: string[] = [];
beforeEach(() => {
  query.matches = false;
  listeners.clear();
  asked.length = 0;
  (window as { matchMedia?: unknown }).matchMedia = () => query;
  window.HTMLMediaElement.prototype.play = function () {
    asked.push("play");
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function () {
    asked.push("pause");
  };
});
const setLessMotion = async (less: boolean) => {
  query.matches = less;
  await act(async () => {
    for (const on of listeners) on();
  });
};

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function draw(node: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<HostFilesContext.Provider value={underBase}>{node}</HostFilesContext.Provider>));
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

async function arrives<T>(find: () => T | null | undefined): Promise<T> {
  for (let tries = 0; tries < 200; tries++) {
    const found = find();
    if (found) return found;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error("it never arrived");
}

describe("a video played as a background", () => {
  it("is muted, loops, plays inline with no controls and its poster, fills its box, and says nothing under it", async () => {
    const host = await draw(<Files as="field" read nodeId="dusk" field="clip" label="Clip" files={[beach]} autoplay cover />);
    const video = await arrives(() => host.querySelector<HTMLVideoElement>("video[data-graview-video]"));
    expect([video.autoplay, video.muted, video.loop, video.hasAttribute("playsinline"), video.controls]).toEqual([true, true, true, true, false]);
    expect(video.getAttribute("preload")).toBe("auto");
    expect(video.getAttribute("poster")).toBe("/a/moments/graview/files/9c1e.jpg");
    expect([video.style.objectFit, video.style.width, video.style.height]).toEqual(["cover", "100%", "100%"]);
    expect([video.hasAttribute("data-graview-video-autoplay"), video.hasAttribute("data-graview-video-cover"), video.hasAttribute("data-graview-video-still")]).toEqual([true, true, false]);
    expect(video.getAttribute("aria-label")).toBe("The waves at dusk, a 45-second video");
    expect(host.querySelector("[data-graview-video-said]")).toBeNull();
  });

  it("as an image block too, where a design asks for it", async () => {
    const host = await draw(<Files as="block" field="clip" files={[beach]} label="Clip" view="gallery" autoplay />);
    const video = await arrives(() => host.querySelector<HTMLVideoElement>("video[data-graview-video]"));
    expect([video.autoplay, video.muted, video.loop, video.controls, video.style.objectFit]).toEqual([true, true, true, false, ""]);
  });

  it("is the player with controls it was when nothing asks for a background", async () => {
    const host = await draw(<Files as="field" read nodeId="dusk" field="clip" label="Clip" files={[beach]} />);
    const video = await arrives(() => host.querySelector<HTMLVideoElement>("video[data-graview-video]"));
    expect([video.autoplay, video.muted, video.loop, video.controls, video.getAttribute("preload")]).toEqual([false, false, false, true, "metadata"]);
    expect(host.querySelector("[data-graview-video-said]")?.textContent).toBe("The waves at dusk · 0:45");
  });

  it("stands still at its poster where the person asked for less motion, and is let go when they stop", async () => {
    query.matches = true;
    const host = await draw(<Files as="field" read nodeId="dusk" field="clip" label="Clip" files={[beach]} autoplay />);
    const video = await arrives(() => host.querySelector<HTMLVideoElement>("video[data-graview-video]"));
    expect([video.autoplay, video.muted, video.loop, video.controls, video.getAttribute("preload"), video.hasAttribute("data-graview-video-still")]).toEqual([false, true, true, false, "metadata", true]);
    expect(video.getAttribute("poster")).toBe("/a/moments/graview/files/9c1e.jpg");
    expect(asked).toEqual(["pause"]);
    await setLessMotion(false);
    expect([video.autoplay, video.getAttribute("preload"), video.hasAttribute("data-graview-video-still")]).toEqual([true, "auto", false]);
    expect(asked).toEqual(["pause", "play"]);
    await setLessMotion(true);
    expect([video.autoplay, video.hasAttribute("data-graview-video-still")]).toEqual([false, true]);
    expect(asked).toEqual(["pause", "play", "pause"]);
  });
});
