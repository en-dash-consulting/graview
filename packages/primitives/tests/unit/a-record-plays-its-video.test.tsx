// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, videoField, type FileValue, type HostFiles } from "@graview/core";
import { GraviewProvider, HostFilesContext, createViews } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Fields, Files } from "../../src/index.js";
import { kindsWords, prepare } from "../../src/files.js";

/**
 * A RECORD PLAYS ITS VIDEO (0.1.37, Roadmap f-video-framework).
 *
 * The face draws a video field as a player: its poster first, the browser's
 * own controls (keyboard and all), only what it needs to say its length
 * fetched before it is played (`preload="metadata"`), its captions where
 * the value carries them, and its size from the value — every address
 * where the host serves it (`HostFiles.src`). A card shows its poster with
 * a play glyph and how long it is. The editor sends a video as it was
 * picked, to a host that takes videos, and says so where it takes none.
 */
const beach: FileValue = { href: "/graview/files/9c1e.mp4", name: "beach.mov", type: "video/mp4", bytes: 18_400_000, width: 1920, height: 1080, duration: 45, poster: "/graview/files/9c1e.jpg", captions: "/graview/files/9c1e.vtt", caption: "The waves at dusk" };
const rain: FileValue = { href: "/graview/files/5d0a.webm", name: "rain.webm", type: "video/webm", bytes: 2_100 };

const moment = defineNode("moment", { fields: z.object({ name: z.string(), clip: videoField().optional() }), plural: "Moments" });
const schema = createSchema([moment]);
const storeWith = (fields: Record<string, unknown> = {}) => new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "dusk", kind: "moment", name: "Dusk", ...fields }] as never, edges: [] } });
const underBase: HostFiles = { maxBytes: 50_000_000, kinds: ["image/*", "video/*"], upload: async () => beach, src: (href) => `/a/moments${href}` };

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function draw(node: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
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

const pick = async (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
};

describe("a record's video, played", () => {
  it("is a player: poster first, native controls, metadata only, captions, its size, all where the host serves them", async () => {
    const host = await draw(
      <HostFilesContext.Provider value={underBase}>
        <Files as="field" read nodeId="dusk" field="clip" label="Clip" files={[beach]} />
      </HostFilesContext.Provider>,
    );
    const video = await arrives(() => host.querySelector<HTMLVideoElement>("video[data-graview-video]"));
    expect(video.getAttribute("src")).toBe("/a/moments/graview/files/9c1e.mp4");
    expect(video.getAttribute("poster")).toBe("/a/moments/graview/files/9c1e.jpg");
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect([video.getAttribute("width"), video.getAttribute("height")]).toEqual(["1920", "1080"]);
    expect(video.getAttribute("aria-label")).toBe("The waves at dusk, a 45-second video");
    const track = video.querySelector("track");
    expect([track?.getAttribute("kind"), track?.getAttribute("src"), track?.getAttribute("srclang")]).toEqual(["captions", "/a/moments/graview/files/9c1e.vtt", "en"]);
    // Said under it: what it shows, and how long.
    expect(host.querySelector("[data-graview-video-said]")?.textContent).toBe("The waves at dusk · 0:45");
  });

  it("reads its length from what the player loads, where the value does not say it", async () => {
    const host = await draw(<Files as="field" read nodeId="dusk" field="clip" label="Clip" files={[rain]} />);
    const video = await arrives(() => host.querySelector<HTMLVideoElement>("video[data-graview-video]"));
    expect(video.hasAttribute("poster")).toBe(false);
    expect(video.querySelector("track")).toBeNull();
    expect(host.querySelector("[data-graview-video-said]")?.textContent).toBe("rain.webm");
    Object.defineProperty(video, "duration", { value: 12.4, configurable: true });
    Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
    Object.defineProperty(video, "videoHeight", { value: 360, configurable: true });
    await act(async () => video.dispatchEvent(new Event("loadedmetadata")));
    expect(host.querySelector("[data-graview-video-said]")?.textContent).toBe("rain.webm · 0:12");
    expect(video.getAttribute("aria-label")).toBe("rain.webm, a 12-second video");
  });

  it("on a card is its poster with a play glyph and how long it is, said as a video", async () => {
    const host = await draw(
      <HostFilesContext.Provider value={underBase}>
        <Files as="thumb" file={beach} size={64} />
      </HostFilesContext.Provider>,
    );
    const thumb = await arrives(() => host.querySelector<HTMLElement>("[data-graview-video-thumb]"));
    expect(thumb.getAttribute("role")).toBe("img");
    expect(thumb.getAttribute("aria-label")).toBe("The waves at dusk, a 45-second video");
    expect(thumb.querySelector("img")?.getAttribute("src")).toBe("/a/moments/graview/files/9c1e.jpg");
    expect(thumb.querySelector("[data-graview-play-glyph]")).not.toBeNull();
    expect(thumb.querySelector("[data-graview-video-clock]")?.textContent).toBe("0:45");
    // Nothing on a card plays or loads the video itself while it has a poster.
    expect(thumb.querySelector("video")).toBeNull();
  });

  it("on a card without a poster is its first frame, loading no more than it needs to say how long", async () => {
    const host = await draw(<Files as="thumb" file={rain} />);
    const thumb = await arrives(() => host.querySelector<HTMLElement>("[data-graview-video-thumb]"));
    const frame = thumb.querySelector("video")!;
    expect([frame.getAttribute("preload"), frame.hasAttribute("controls"), frame.getAttribute("aria-hidden"), frame.getAttribute("tabindex")]).toEqual(["metadata", false, "true", "-1"]);
    expect(frame.muted).toBe(true);
    expect(thumb.querySelector("[data-graview-video-clock]")).toBeNull();
    Object.defineProperty(frame, "duration", { value: 125, configurable: true });
    await act(async () => frame.dispatchEvent(new Event("loadedmetadata")));
    expect(thumb.querySelector("[data-graview-video-clock]")?.textContent).toBe("2:05");
  });
});

describe("a video field's editor", () => {
  it("asks for videos, sends one as it was picked, and sets the field by its act", async () => {
    const store = storeWith();
    const sent: string[] = [];
    const files: HostFiles = {
      maxBytes: 50_000_000,
      kinds: ["image/*", "video/*"],
      async upload(file, name) {
        sent.push(`${name} ${file.type}`);
        return { ...beach, name };
      },
    };
    const host = await draw(
      <GraviewProvider store={store} views={createViews(schema)} files={files}>
        <Fields id="dusk" />
      </GraviewProvider>,
    );
    const input = await arrives(() => host.querySelector<HTMLInputElement>('[data-graview-files="clip"] input[data-graview-file-input]'));
    expect(input.accept).toBe("video/*");
    expect(host.querySelector('[data-graview-files="clip"] [data-graview-file-choose]')?.textContent).toBe("Choose a video");
    expect(host.querySelector('[data-graview-files="clip"] [data-graview-photo-input]')).toBeNull();
    await pick(input, [new File(["mov"], "IMG_4410.MOV", { type: "video/quicktime" })]);
    await arrives(() => (store.graph.getNode("dusk") as { clip?: unknown } | undefined)?.clip);
    expect(sent).toEqual(["IMG_4410.MOV video/quicktime"]);
    expect((store.graph.getNode("dusk") as { clip: FileValue }).clip).toMatchObject({ name: "IMG_4410.MOV", poster: beach.poster, duration: 45 });
  });

  it("refuses a picture for a video, and an answer that is not a video, in words", async () => {
    const host = { maxBytes: 50_000_000, kinds: ["video/*"], upload: async () => beach } satisfies HostFiles;
    expect(await prepare(new File(["p"], "porch.png", { type: "image/png" }), host, { image: false, video: true })).toEqual({ refused: "“porch.png” isn’t a video." });
    expect(await prepare(new File(["m"], "IMG_1.MOV", { type: "" }), host, { image: false, video: true })).toMatchObject({ name: "IMG_1.MOV", type: "video/quicktime" });
    expect(kindsWords(["image/*", "video/*"])).toBe("pictures and videos");
  });

  it("says a host that takes no videos takes none, and offers no way to add one", async () => {
    const store = storeWith();
    const host = await draw(
      <GraviewProvider store={store} views={createViews(schema)} files={{ maxBytes: 1_000_000, kinds: ["image/*"], upload: async () => beach }}>
        <Fields id="dusk" />
      </GraviewProvider>,
    );
    const none = await arrives(() => host.querySelector('[data-graview-files="clip"] [data-graview-file-none]'));
    expect(none.textContent).toBe("This host doesn’t take videos, so none can be added here.");
    expect(host.querySelector('[data-graview-files="clip"] input[data-graview-file-input]')).toBeNull();
  });
});
