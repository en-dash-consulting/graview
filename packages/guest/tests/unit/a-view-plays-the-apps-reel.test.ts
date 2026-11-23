// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { createSchema, defineNode, Store, z, type AnySchema, type AppVideo, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { createGuestMedia } from "../../src/host/media.js";
import { judgeAttribute } from "../../src/host/open-judge.js";
import { createGuestLogo, reelFacts, themeWithBrand } from "../../src/host/theme.js";
import type { GuestProps, GuestTheme } from "../../src/protocol.js";

/**
 * A VIEW PLAYS THE APP'S REEL (HQ f-view-names-app-video).
 *
 * A host keeps one video for the whole app — the reel its share preview
 * plays — and hands it as `reel`. A worker view places it with
 * `<graview-video data-app="reel">` and the host draws the player there;
 * the view reads the reel's facts in `props.theme.reel` and is never handed
 * its address. With no reel handed, the element draws nothing and the
 * host's problems say why.
 */
const reel: AppVideo = { href: "/graview/files/reel.mp4", poster: "/graview/files/reel.jpg", duration: 30, caption: "Our summer", width: 1280, height: 720, captions: "/graview/files/reel.vtt" };
const shown = { nodes: [] } as unknown as GuestProps;

function page(handed: AppVideo | undefined, pictures = false) {
  const dom = new JSDOM("<!doctype html><body><main></main></body>", { url: "https://app.example/a/summer/" });
  const window = dom.window as Window & typeof globalThis;
  const region = window.document.querySelector("main")!;
  const said: string[] = [];
  const codes: unknown[] = [];
  const media = createGuestMedia(window, { view: '"Home"', pictures, shown: () => shown, reel: () => handed, file: (href) => `/a/summer${href}`, onProblem: (line, problem) => (said.push(line), codes.push(problem)) });
  const place = (attributes: Record<string, string>) => {
    const element = window.document.createElement("graview-video");
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    region.appendChild(element);
    return element;
  };
  return { window, region, said, codes, media, place };
}

describe("<graview-video data-app=\"reel\">", () => {
  it("is a word the open kit lets a view say, and the address stays the host's", () => {
    expect(judgeAttribute("html", "graview-video", "data-app", "reel", { origin: "https://app.example" })).not.toHaveProperty("refused");
    expect(judgeAttribute("html", "graview-video", "src", "/graview/files/reel.mp4", { origin: "https://app.example" })).toHaveProperty("refused");
  });

  it("plays the reel the host handed: its poster first, its captions, sized, where the host serves files, for a view that asks for no pictures", () => {
    const { region, said, media, place } = page(reel);
    const element = place({ "data-app": "reel" });
    media.refresh(region);
    const video = element.shadowRoot!.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/a/summer/graview/files/reel.mp4");
    expect(video.getAttribute("poster")).toBe("/a/summer/graview/files/reel.jpg");
    expect(video.querySelector("track")?.getAttribute("src")).toBe("/a/summer/graview/files/reel.vtt");
    expect([video.hasAttribute("controls"), video.getAttribute("preload")]).toEqual([true, "metadata"]);
    expect([video.getAttribute("width"), video.getAttribute("height")]).toEqual(["1280", "720"]);
    expect(video.getAttribute("aria-label")).toBe("Our summer, a 30-second video");
    expect(said).toEqual([]);
  });

  it("plays as a background where the view says autoplay and cover, as a record's video does", () => {
    const { region, media, place } = page(reel);
    const element = place({ "data-app": "reel", autoplay: "", cover: "" });
    media.refresh(region);
    const video = element.shadowRoot!.querySelector("video")!;
    expect([video.hasAttribute("autoplay"), video.muted, video.hasAttribute("loop"), video.hasAttribute("controls"), video.hasAttribute("data-graview-video-cover")]).toEqual([true, true, true, false, true]);
  });

  it("plays a reel the host serves from an https address as the host gave it", () => {
    const { region, media, place } = page({ href: "https://media.example/reel.mp4", poster: "https://media.example/reel.jpg" });
    const element = place({ "data-app": "reel" });
    media.refresh(region);
    const video = element.shadowRoot!.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("https://media.example/reel.mp4");
    expect(video.getAttribute("poster")).toBe("https://media.example/reel.jpg");
  });

  it("draws nothing where the host handed no reel, and says why, naming the view and the host's word for it", () => {
    const { region, said, codes, media, place } = page(undefined);
    const element = place({ "data-app": "reel" });
    media.refresh(region);
    expect(element.shadowRoot!.querySelector("video")).toBeNull();
    expect(said).toEqual(['The video in the view "Home" was not drawn: it names the app\'s reel, which this host did not hand it: a host hands the app\'s reel as reel (mount, <Embed>, GraviewProvider, the Shell or the routed face).']);
    expect(codes).toEqual([{ code: "media-not-drawn" }]);
  });

  it("draws nothing for an app video that is not the reel, or a reel at an address that is not the web's", () => {
    const named = page(reel);
    const other = named.place({ "data-app": "intro" });
    named.media.refresh(named.region);
    expect(other.shadowRoot!.querySelector("video")).toBeNull();
    expect(named.said).toEqual(['The video in the view "Home" was not drawn: it names the app\'s "intro", which is no video of the app: the app\'s own video is data-app="reel".']);

    const odd = page({ href: "javascript:alert(1)" });
    const element = odd.place({ "data-app": "reel" });
    odd.media.refresh(odd.region);
    expect(element.shadowRoot!.querySelector("video")).toBeNull();
    expect(odd.said).toEqual(['The video in the view "Home" was not drawn: it names the app\'s reel, whose address this host does not serve on this page.']);
  });
});

describe("the reel's facts in props.theme.reel", () => {
  it("are what it is, how long, whether it has a poster and whether it plays — never an address", () => {
    expect(reelFacts(reel)).toEqual({ name: "reel", caption: "Our summer", type: "video/mp4", duration: 30, poster: true, playable: true, width: 1280, height: 720, aspect: 1.7778 });
    expect(JSON.stringify(reelFacts(reel))).not.toContain("/graview/files/");
  });

  it("say it plays as the host judged it, else an MP4, WebM or Ogg with a poster", () => {
    expect(reelFacts({ href: "/r.mp4" })?.playable).toBe(false);
    expect(reelFacts({ href: "/r.mov", type: "video/quicktime", poster: "/r.jpg" })?.playable).toBe(false);
    expect(reelFacts({ href: "/r.mp4", playable: true })?.playable).toBe(true);
    expect(reelFacts({ href: "/r.mp4", poster: "/r.jpg", playable: false })?.playable).toBe(false);
    expect(reelFacts(undefined)).toBeUndefined();
    expect(reelFacts({ href: " " })).toBeUndefined();
  });

  it("ride in the theme a host pushes, beside the brand, and are absent where no reel was handed", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://app.example/" });
    const window = dom.window as Window & typeof globalThis;
    const look = { scheme: "light" } as GuestTheme;
    const logo = createGuestLogo(window, () => {}, "blob");
    expect(themeWithBrand(() => look, () => ({ name: "Summer" }), logo, () => reel)).toMatchObject({ name: "Summer", reel: { duration: 30, poster: true, playable: true } });
    expect(themeWithBrand(() => look, undefined, logo, () => undefined)).not.toHaveProperty("reel");
    expect(themeWithBrand(() => look, undefined, logo)).not.toHaveProperty("reel");
  });
});

describe("a headless run", () => {
  const home = defineNode("moment", { fields: z.object({ name: z.string() }), plural: "Moments" });
  const store = () => new Store<AnySchema>({ schema: createSchema([home]) as AnySchema, mutations: [], snapshot: { nodes: [{ id: "moment:dusk", kind: "moment", name: "Dusk" }], edges: [] } as never });
  const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
  const source = `graview.onProps((props) => graview.render(graview.html\`<section><h2>\${props.theme.reel ? "Watch: " + props.theme.reel.duration + " s" : "No reel"}</h2><graview-video data-app="reel" autoplay cover></graview-video></section>\`));`;

  it("hands the view the reel's facts, and lists the reel among the place's videos with whether it plays", async () => {
    const result = await runWorkerViewHeadless({ store: store(), principal: owner, run: nodeIsolate(), reel, manifest: { name: "hero", title: "Hero", attach: "moment", cardinality: "many" }, source });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const said = JSON.stringify(result);
    expect(said).toContain("Watch: 30 s");
    expect(said).toContain("Our summer, a 30-second video, playing as a background, muted and looping, filling its box");
    expect(said).not.toContain("/graview/files/");
    expect(result.description.videos).toEqual([{ app: "reel", text: "Our summer", name: "reel", source: "video/mp4", duration: 30, poster: true, autoplay: true, cover: true, playable: true }]);
    expect(result.description.text).toContain("- Our summer (the app's reel): video/mp4, 30 s, with a poster; plays as a background, muted and looping, with no controls, filling its box; playable.");
  });

  it("says among its problems that no reel was handed, and lists no video", async () => {
    const result = await runWorkerViewHeadless({ store: store(), principal: owner, run: nodeIsolate(), manifest: { name: "hero", title: "Hero", attach: "moment", cardinality: "many" }, source });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result)).toContain("No reel");
    expect(result.description.videos ?? []).toEqual([]);
    expect(result.description.problems.map((problem) => problem.says)).toContain("It names the app's reel, which this host did not hand: the host draws no player there. A host hands the app's reel as reel.");
  });
});
