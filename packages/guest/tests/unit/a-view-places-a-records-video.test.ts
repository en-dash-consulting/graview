// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { createSchema, defineNode, Store, videoField, videoWords as coreVideoWords, z, type AnySchema, type FileValue, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { videoWords } from "../../src/headless/describe.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { createGuestMedia } from "../../src/host/media.js";
import { isEmptyElement, judgeAttribute, judgeElement } from "../../src/host/open-judge.js";
import { guestFileOf } from "../../src/host/pictures.js";
import { NEVER_DRAWN } from "../../src/open-kit.js";
import type { GuestProps } from "../../src/protocol.js";

/**
 * A VIEW PLACES A RECORD'S VIDEO, AND OPENS A FULL-SCREEN VIEWER (0.1.37).
 *
 * A worker view may not draw `<video>` and is never handed the host's path
 * to a file. It places `<graview-video data-record data-field>` and the
 * host draws the player in it — poster first, native controls,
 * `preload="metadata"`, captions, sized from the value, fetched where the
 * host serves files — from the records the view was shown, for a view
 * whose manifest asks for pictures. A `data-lightbox` element pressed by
 * the viewer opens the host's own full-screen viewer for a picture or a
 * video. Anything else draws nothing and says why, naming the view.
 */
const beach: FileValue = { href: "/graview/files/9c1e.mp4", name: "beach.mov", type: "video/mp4", bytes: 18_400_000, width: 1920, height: 1080, duration: 45, poster: "/graview/files/9c1e.jpg", captions: "/graview/files/9c1e.vtt", caption: "The waves at dusk" };
const porch: FileValue = { href: "/graview/files/3f9a.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 182_000, caption: "The porch" };
const shown: GuestProps = {
  nodes: [
    { id: "moment:dusk", kind: "moment", label: "Dusk", clip: beach, photo: porch } as never,
    { id: "moment:noon", kind: "moment", label: "Noon" } as never,
  ],
} as unknown as GuestProps;

function page() {
  const dom = new JSDOM("<!doctype html><body><main></main></body>", { url: "https://app.example/a/moments/" });
  const window = dom.window as Window & typeof globalThis;
  const region = window.document.querySelector("main")!;
  const said: string[] = [];
  const media = (pictures = true) =>
    createGuestMedia(window, { view: '"Moments"', pictures, shown: () => shown, file: (href) => `/a/moments${href}`, onProblem: (line) => said.push(line) });
  const place = (attributes: Record<string, string>) => {
    const element = window.document.createElement("graview-video");
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    region.appendChild(element);
    return element;
  };
  return { window, region, said, media, place };
}

describe("the open kit", () => {
  it("draws <graview-video>, which names a file and holds nothing, and still never <video>", () => {
    expect(judgeElement("graview-video", "html")).toEqual({ namespace: "html", name: "graview-video" });
    expect(isEmptyElement("html", "graview-video")).toBe(true);
    for (const name of ["data-record", "data-field", "data-index", "class", "aria-label", "autoplay", "cover"]) expect(judgeAttribute("html", "graview-video", name, "x", { origin: "https://app.example" })).not.toHaveProperty("refused");
    /* `autoplay` and `cover` are the view's two words for a hero background (f-video-hero); the source, the poster and the controls stay the host's. */
    for (const name of ["src", "poster", "controls", "loop", "muted"]) expect(judgeAttribute("html", "graview-video", name, "x", { origin: "https://app.example" })).toHaveProperty("refused");
    expect(judgeElement("video", "html")).toHaveProperty("refused");
    expect(NEVER_DRAWN.html).toContain("video");
  });
});

describe("a <graview-video> the view places", () => {
  it("is a player the host draws: poster first, native controls, metadata only, captions, sized, where the host serves files", () => {
    const { region, said, media, place } = page();
    const element = place({ "data-record": "moment:dusk", "data-field": "clip" });
    media().refresh(region);
    const video = element.shadowRoot!.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/a/moments/graview/files/9c1e.mp4");
    expect(video.getAttribute("poster")).toBe("/a/moments/graview/files/9c1e.jpg");
    expect([video.hasAttribute("controls"), video.getAttribute("preload"), video.hasAttribute("playsinline"), video.hasAttribute("autoplay")]).toEqual([true, "metadata", true, false]);
    expect([video.getAttribute("width"), video.getAttribute("height")]).toEqual(["1920", "1080"]);
    expect(video.getAttribute("aria-label")).toBe("The waves at dusk, a 45-second video");
    expect(video.querySelector("track")?.getAttribute("src")).toBe("/a/moments/graview/files/9c1e.vtt");
    expect(said).toEqual([]);
  });

  it("is drawn once for a file, and again only when the file it names moves", () => {
    const { region, media, place } = page();
    const element = place({ "data-record": "moment:dusk", "data-field": "clip" });
    const host = media();
    host.refresh(region);
    const first = element.shadowRoot!.querySelector("video");
    host.refresh(region);
    expect(element.shadowRoot!.querySelector("video")).toBe(first);
  });

  it("draws nothing for a record the view was not shown, a field with no video, or a picture, and says why naming the view", () => {
    const { region, said, media, place } = page();
    const unseen = place({ "data-record": "moment:secret", "data-field": "clip" });
    const empty = place({ "data-record": "moment:noon", "data-field": "clip" });
    const picture = place({ "data-record": "moment:dusk", "data-field": "photo" });
    media().refresh(region);
    for (const element of [unseen, empty, picture]) expect(element.shadowRoot!.querySelector("video")).toBeNull();
    expect(said).toEqual([
      'The video in the view "Moments" was not drawn: it names a record it was not shown ("moment:secret").',
      'The video in the view "Moments" was not drawn: it names "clip" on "Noon", which holds no file it was shown.',
      'The video in the view "Moments" was not drawn: it names "porch.jpg" on "Dusk", which is not a video.',
    ]);
  });

  it("draws nothing for a view whose manifest asks for no pictures", () => {
    const { region, said, media, place } = page();
    const element = place({ "data-record": "moment:dusk", "data-field": "clip" });
    media(false).refresh(region);
    expect(element.shadowRoot!.querySelector("video")).toBeNull();
    expect(said[0]).toContain('asks for no pictures: a view places a record\'s video where its manifest says "pictures": true');
  });

  it("is handed to the view as its facts, never an address", () => {
    expect(guestFileOf(beach)).toEqual({ name: "beach.mov", type: "video/mp4", bytes: 18_400_000, width: 1920, height: 1080, caption: "The waves at dusk", duration: 45, poster: true });
    expect(guestFileOf({ ...beach, poster: undefined })).not.toHaveProperty("poster");
  });
});

describe("the full-screen viewer a view opens", () => {
  it("is the host's dialog over the app, for a picture or a video, closed by its button with the keyboard back where it was", () => {
    const { window, region, media } = page();
    const host = media();
    const button = window.document.createElement("button");
    button.setAttribute("data-lightbox", "");
    button.setAttribute("data-record", "moment:dusk");
    button.setAttribute("data-field", "photo");
    region.appendChild(button);
    expect(host.open(button)).toBe(true);
    const box = window.document.body.querySelector("dialog[data-graview-lightbox]")!;
    expect(box.parentElement).toBe(window.document.body);
    expect(box.querySelector("img")?.getAttribute("src")).toBe("/a/moments/graview/files/3f9a.jpg");
    expect(box.querySelector("img")?.getAttribute("alt")).toBe("The porch");
    expect(window.document.activeElement?.textContent).toBe("Close");
    button.setAttribute("data-field", "clip");
    host.open(button);
    expect(window.document.body.querySelectorAll("dialog[data-graview-lightbox]")).toHaveLength(1);
    expect(window.document.body.querySelector("dialog video")?.getAttribute("src")).toBe("/a/moments/graview/files/9c1e.mp4");
    (window.document.body.querySelector("dialog button") as HTMLButtonElement).click();
    expect(window.document.body.querySelector("dialog")).toBeNull();
    expect(window.document.activeElement).toBe(button);
  });

  it("opens nothing for a record the view was not shown, and says why", () => {
    const { window, region, said, media } = page();
    const button = window.document.createElement("button");
    button.setAttribute("data-lightbox", "");
    button.setAttribute("data-record", "moment:secret");
    button.setAttribute("data-field", "photo");
    region.appendChild(button);
    expect(media().open(button)).toBe(false);
    expect(window.document.querySelector("dialog")).toBeNull();
    expect(said).toEqual(['The full-screen viewer in the view "Moments" was not drawn: it names a record it was not shown ("moment:secret").']);
  });
});

describe("a headless run", () => {
  it("says a placed video by what it shows and how long it is, as core says a video", async () => {
    for (const duration of [undefined, 1, 45, 59.6, 185, 4_000]) expect(videoWords({ ...(duration !== undefined ? { duration } : {}) })).toBe(coreVideoWords({ ...(duration !== undefined ? { duration } : {}) }));
    const moment = defineNode("moment", { fields: z.object({ name: z.string(), clip: videoField().optional() }), plural: "Moments" });
    const schema = createSchema([moment]);
    const store = new Store<AnySchema>({ schema: schema as AnySchema, mutations: [], snapshot: { nodes: [{ id: "moment:dusk", kind: "moment", name: "Dusk", clip: beach }], edges: [] } as never });
    const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
    const result = await runWorkerViewHeadless({
      store,
      principal: owner,
      run: nodeIsolate(),
      manifest: { name: "reel", title: "Reel", attach: "moment", cardinality: "many", pictures: true },
      source: `graview.onProps((props) => graview.render(graview.html\`\${props.nodes.map((node) => graview.html\`<article data-record="\${node.id}"><h3>\${node.label}</h3><graview-video data-record="\${node.id}" data-field="clip"></graview-video></article>\`)}\`));`,
    });
    expect(JSON.stringify(result)).toContain("The waves at dusk, a 45-second video");
    expect(JSON.stringify(result)).not.toContain("graview-video>");
    expect(JSON.stringify(result)).not.toContain("/graview/files/");
  });
});
