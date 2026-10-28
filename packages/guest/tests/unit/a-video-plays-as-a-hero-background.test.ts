// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { createSchema, defineNode, Store, videoField, z, type AnySchema, type FileValue, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { describeVideo } from "../../src/headless/describe.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { createGuestMedia } from "../../src/host/media.js";
import { judgeAttribute } from "../../src/host/open-judge.js";
import type { GuestProps } from "../../src/protocol.js";

/**
 * A VIDEO PLAYS AS A HERO BACKGROUND (Roadmap f-video-hero).
 *
 * `<graview-video autoplay>` is a background: muted, looping, inline, with
 * no controls — autoplay without muted never plays, so the one word means
 * all of it. `cover` fills the box the view sized. Where the person asked
 * for less motion the background stands still at its poster, fetching no
 * more than its metadata, and is let go when they stop asking. A headless
 * run lists each video the view places with its source and whether it is
 * playable — a source every browser plays, with a poster — so an agent can
 * confirm a hero without opening a browser.
 */
const beach: FileValue = { href: "/graview/files/9c1e.mp4", name: "beach.mov", type: "video/mp4", bytes: 18_400_000, width: 1920, height: 1080, duration: 45, poster: "/graview/files/9c1e.jpg", caption: "The waves at dusk" };
const raw: FileValue = { href: "/graview/files/4410.mov", name: "IMG_4410.MOV", type: "video/quicktime", bytes: 2_000_000 };
const shown: GuestProps = { nodes: [{ id: "moment:dusk", kind: "moment", label: "Dusk", clip: beach } as never, { id: "moment:noon", kind: "moment", label: "Noon", clip: raw } as never] } as unknown as GuestProps;

/** A page whose `prefers-reduced-motion` the test sets, and changes. */
function page(lessMotion?: boolean) {
  const dom = new JSDOM("<!doctype html><body><main></main></body>", { url: "https://app.example/a/moments/" });
  const window = dom.window as Window & typeof globalThis;
  const listeners = new Set<() => void>();
  const query = { matches: lessMotion ?? false, addEventListener: (_: string, on: () => void) => listeners.add(on), removeEventListener: (_: string, on: () => void) => listeners.delete(on) };
  if (lessMotion !== undefined) (window as { matchMedia?: unknown }).matchMedia = () => query;
  const setLessMotion = (less: boolean) => {
    query.matches = less;
    for (const on of listeners) on();
  };
  /* jsdom plays nothing: what the host asks of the player is what is held. */
  const asked: string[] = [];
  window.HTMLMediaElement.prototype.play = function () {
    asked.push("play");
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function () {
    asked.push("pause");
  };
  const region = window.document.querySelector("main")!;
  const said: string[] = [];
  const media = createGuestMedia(window, { view: '"Moments"', pictures: true, shown: () => shown, file: (href) => `/a/moments${href}`, onProblem: (line) => said.push(line) });
  const place = (attributes: Record<string, string>) => {
    const element = window.document.createElement("graview-video");
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    region.appendChild(element);
    return element;
  };
  return { window, region, said, media, place, setLessMotion, asked };
}

describe("the open kit", () => {
  it("takes autoplay and cover on <graview-video>, and still no source, poster, controls, loop or muted of the view's own", () => {
    for (const name of ["autoplay", "cover"]) expect(judgeAttribute("html", "graview-video", name, "", { origin: "https://app.example" })).toEqual({ name, value: "" });
    for (const name of ["src", "poster", "controls", "loop", "muted", "preload"]) expect(judgeAttribute("html", "graview-video", name, "x", { origin: "https://app.example" })).toHaveProperty("refused");
  });
});

describe("a <graview-video autoplay cover> the view places", () => {
  it("is a background the host plays: muted, looping, inline, with no controls and its poster, filling its box", () => {
    const { region, said, media, place } = page();
    const element = place({ autoplay: "", cover: "", "data-record": "moment:dusk", "data-field": "clip" });
    media.refresh(region);
    const video = element.shadowRoot!.querySelector("video")!;
    expect([video.hasAttribute("autoplay"), video.hasAttribute("muted"), video.muted, video.hasAttribute("loop"), video.hasAttribute("playsinline"), video.hasAttribute("controls")]).toEqual([true, true, true, true, true, false]);
    expect(video.getAttribute("preload")).toBe("auto");
    expect(video.getAttribute("poster")).toBe("/a/moments/graview/files/9c1e.jpg");
    expect(video.style.objectFit).toBe("cover");
    expect([video.style.width, video.style.height]).toEqual(["100%", "100%"]);
    expect([video.hasAttribute("data-graview-video-autoplay"), video.hasAttribute("data-graview-video-cover"), video.hasAttribute("data-graview-video-still")]).toEqual([true, true, false]);
    expect(video.getAttribute("aria-label")).toBe("The waves at dusk, a 45-second video");
    expect(said).toEqual([]);
  });

  it("without cover keeps the player's own ratio, and without autoplay is the player with controls it was", () => {
    const { region, media, place } = page();
    const background = place({ autoplay: "", "data-record": "moment:dusk", "data-field": "clip" });
    const player = place({ cover: "", "data-record": "moment:dusk", "data-field": "clip" });
    media.refresh(region);
    const first = background.shadowRoot!.querySelector("video")!;
    expect([first.hasAttribute("controls"), first.style.objectFit, first.style.aspectRatio]).toEqual([false, "", "1920 / 1080"]);
    const second = player.shadowRoot!.querySelector("video")!;
    expect([second.hasAttribute("controls"), second.hasAttribute("autoplay"), second.muted, second.style.objectFit]).toEqual([true, false, false, "cover"]);
  });

  it("is drawn again when the way it is played changes, not only when its file does", () => {
    const { region, media, place } = page();
    const element = place({ "data-record": "moment:dusk", "data-field": "clip" });
    media.refresh(region);
    expect(element.shadowRoot!.querySelector("video")!.hasAttribute("controls")).toBe(true);
    element.setAttribute("autoplay", "");
    media.refresh(region);
    expect(element.shadowRoot!.querySelector("video")!.hasAttribute("controls")).toBe(false);
    expect(element.shadowRoot!.querySelector("video")!.hasAttribute("autoplay")).toBe(true);
  });

  it("stands still at its poster where the person asked for less motion, fetching only its metadata, and is let go when they stop", () => {
    const { region, media, place, setLessMotion, asked } = page(true);
    const element = place({ autoplay: "", "data-record": "moment:dusk", "data-field": "clip" });
    media.refresh(region);
    const video = element.shadowRoot!.querySelector("video")!;
    expect([video.hasAttribute("autoplay"), video.hasAttribute("data-graview-video-still"), video.getAttribute("preload"), video.getAttribute("poster")]).toEqual([false, true, "metadata", "/a/moments/graview/files/9c1e.jpg"]);
    expect([video.muted, video.hasAttribute("loop"), video.hasAttribute("controls")]).toEqual([true, true, false]);
    setLessMotion(false);
    expect([video.hasAttribute("autoplay"), video.hasAttribute("data-graview-video-still"), video.getAttribute("preload")]).toEqual([true, false, "auto"]);
    expect(asked).toEqual(["play"]);
    setLessMotion(true);
    expect([video.hasAttribute("autoplay"), video.hasAttribute("data-graview-video-still")]).toEqual([false, true]);
    expect(asked).toEqual(["play", "pause"]);
  });

  it("lets go of every background it held when the view is disposed", () => {
    const { region, media, place, setLessMotion, asked } = page(false);
    place({ autoplay: "", "data-record": "moment:dusk", "data-field": "clip" });
    media.refresh(region);
    media.dispose();
    setLessMotion(true);
    expect(asked).toEqual([]);
  });
});

describe("a placed video, as an agent confirms it", () => {
  it("is playable when its source is one every browser plays and it has a poster, and says what is missing when not", () => {
    expect(describeVideo(beach, { record: "moment:dusk", field: "clip", autoplay: true, cover: true })).toEqual({ record: "moment:dusk", field: "clip", text: "The waves at dusk", name: "beach.mov", source: "video/mp4", duration: 45, poster: true, autoplay: true, cover: true, playable: true });
    expect(describeVideo(raw, { record: "moment:noon", field: "clip", autoplay: false, cover: false })).toMatchObject({ playable: false, poster: false, why: "its source is video/quicktime, which not every browser plays, and it has no poster" });
    expect(describeVideo({ ...beach, poster: undefined }, { record: "moment:dusk", field: "clip", autoplay: true, cover: false })).toMatchObject({ playable: false, why: "it has no poster, so nothing stands before it plays or where a person asked for less motion" });
    expect(describeVideo({ ...raw, poster: "/graview/files/4410.jpg" }, { record: "moment:noon", field: "clip", autoplay: false, cover: false })).toMatchObject({ playable: false, poster: true, why: "its source is video/quicktime, which not every browser plays" });
  });

  it("is listed by a headless run with its source and whether it plays, and said as a background in the place's words", async () => {
    const moment = defineNode("moment", { fields: z.object({ name: z.string(), clip: videoField().optional() }), plural: "Moments" });
    const schema = createSchema([moment]);
    const store = new Store<AnySchema>({
      schema: schema as AnySchema,
      mutations: [],
      snapshot: { nodes: [{ id: "moment:dusk", kind: "moment", name: "Dusk", clip: beach }, { id: "moment:noon", kind: "moment", name: "Noon", clip: raw }], edges: [] } as never,
    });
    const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
    const result = await runWorkerViewHeadless({
      store,
      principal: owner,
      run: nodeIsolate(),
      manifest: { name: "reel", title: "Reel", attach: "moment", cardinality: "many", pictures: true },
      source: `graview.onProps((props) => graview.render(graview.html\`<graview-video class="hero" autoplay cover data-record="moment:dusk" data-field="clip"></graview-video>\${props.nodes.map((node) => graview.html\`<article data-record="\${node.id}"><h3>\${node.label}</h3><graview-video data-record="\${node.id}" data-field="clip"></graview-video></article>\`)}\`));`,
    });
    if (!result.ok) throw new Error(result.detail);
    expect(result.description.videos).toEqual([
      { record: "moment:dusk", field: "clip", text: "The waves at dusk", name: "beach.mov", source: "video/mp4", duration: 45, poster: true, autoplay: true, cover: true, playable: true },
      { record: "moment:dusk", field: "clip", text: "The waves at dusk", name: "beach.mov", source: "video/mp4", duration: 45, poster: true, autoplay: false, cover: false, playable: true },
      { record: "moment:noon", field: "clip", text: "IMG_4410.MOV", name: "IMG_4410.MOV", source: "video/quicktime", poster: false, autoplay: false, cover: false, playable: false, why: "its source is video/quicktime, which not every browser plays, and it has no poster" },
    ]);
    expect(result.description.text).toContain("The waves at dusk, a 45-second video, playing as a background, muted and looping, filling its box");
    expect(result.description.text).toContain("Videos:\n- The waves at dusk (clip of moment:dusk): video/mp4, 45 s, with a poster; plays as a background, muted and looping, with no controls, filling its box; playable.");
    expect(result.description.text).toContain("not playable: its source is video/quicktime");
    expect(JSON.stringify(result)).not.toContain("/graview/files/");
  });

  it("lists no videos for a view that places none", async () => {
    const moment = defineNode("moment", { fields: z.object({ name: z.string() }), plural: "Moments" });
    const store = new Store<AnySchema>({ schema: createSchema([moment]) as AnySchema, mutations: [], snapshot: { nodes: [{ id: "moment:dusk", kind: "moment", name: "Dusk" }], edges: [] } as never });
    const result = await runWorkerViewHeadless({
      store,
      principal: { kind: "human", id: "u:owner", roles: ["owner"] },
      run: nodeIsolate(),
      manifest: { name: "plain", title: "Plain", attach: "moment", cardinality: "many" },
      source: `graview.onProps((props) => graview.render(graview.html\`<ul>\${props.nodes.map((node) => graview.html\`<li data-record="\${node.id}">\${node.label}</li>\`)}</ul>\`));`,
    });
    if (!result.ok) throw new Error(result.detail);
    expect(result.description).not.toHaveProperty("videos");
    expect(result.description.text).not.toContain("Videos:");
  });
});
