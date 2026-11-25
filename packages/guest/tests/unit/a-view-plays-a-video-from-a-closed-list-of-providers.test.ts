import "@remote-dom/core/polyfill";
// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { createSchema, defineNode, Store, z, type AnySchema, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { EMBED_ORIGINS, EMBED_PROVIDERS, embedLink, embedSrc, namedEmbed, startOf, type EmbedHost } from "../../src/host/embeds.js";
import { createGuestMedia } from "../../src/host/media.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { judgeAttribute } from "../../src/host/open-judge.js";
import type { GuestProps } from "../../src/protocol.js";
import { createViewRuntime } from "../../src/worker/view-global.js";

/**
 * A VIEW PLAYS A VIDEO FROM A CLOSED LIST OF PROVIDERS (HQ f-view-video-embeds).
 *
 * The view names a YouTube or a Vimeo video; the host reads that down to a
 * checked id, draws a poster and a play button, and builds the one address
 * its player may have once a person presses it.
 */
const ID = "dQw4w9WgXcQ";
const named = (attributes: Record<string, string>) => namedEmbed((name) => attributes[name] ?? null);
const embedOf = (attributes: Record<string, string>) => {
  const read = named(attributes);
  if ("why" in read) throw new Error(read.why);
  return read.embed;
};
const watch = (address: string) => named({ "data-watch": address });

/** Every address the host may ever make, whole. */
const SRC = /^(https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1&playsinline=1&rel=0(&start=[1-9][0-9]{0,4})?|https:\/\/player\.vimeo\.com\/video\/[1-9][0-9]{0,11}\?autoplay=1&dnt=1(&h=[0-9a-f]{6,20})?(#t=[1-9][0-9]{0,4}s)?)$/;
const LINK = /^(https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(&t=[1-9][0-9]{0,4}s)?|https:\/\/vimeo\.com\/[1-9][0-9]{0,11}(\/[0-9a-f]{6,20})?(#t=[1-9][0-9]{0,4}s)?)$/;

describe("the video a view names", () => {
  it("is read from a provider and an id, or from any of the provider's own watch addresses", () => {
    expect(embedOf({ "data-provider": "youtube", "data-video": ID })).toEqual({ provider: "youtube", id: ID, shape: "16:9" });
    for (const address of [`https://www.youtube.com/watch?v=${ID}`, `http://youtube.com/watch?v=${ID}&list=PLx&index=2`, `https://m.youtube.com/watch?app=desktop&v=${ID}`, `https://youtu.be/${ID}?si=abc`, `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/live/${ID}?feature=share`, `https://www.youtube-nocookie.com/embed/${ID}`, ` https://youtu.be/${ID} `])
      expect(embedOf({ "data-watch": address }), address).toEqual({ provider: "youtube", id: ID, shape: "16:9" });
    expect(embedOf({ "data-watch": `https://www.youtube.com/shorts/${ID}` }).shape).toBe("9:16");
    for (const address of ["https://vimeo.com/76979871", "https://www.vimeo.com/76979871/", "https://player.vimeo.com/video/76979871?title=0", "https://vimeo.com/channels/staffpicks/76979871"])
      expect(embedOf({ "data-watch": address }), address).toEqual({ provider: "vimeo", id: "76979871", shape: "16:9" });
    for (const said of [{ "data-watch": "https://vimeo.com/76979871/8272103f6e" }, { "data-watch": "https://player.vimeo.com/video/76979871?h=8272103f6e" }, { "data-provider": "vimeo", "data-video": "76979871/8272103f6e" }]) expect(embedOf(said as never)).toMatchObject({ id: "76979871", hash: "8272103f6e" });
  });

  it("starts where it says, in an address or beside it, and the player is told in whole seconds", () => {
    expect([startOf("90"), startOf("90s"), startOf("1m30s"), startOf("1h2m3s"), startOf("0")]).toEqual([90, 90, 90, 3723, 0]);
    for (const bad of ["", "-1", "1.5", "90 ", "1s1m", "abc", "9999999", "99999", "0x10", "1e3", null]) expect(startOf(bad), String(bad)).toBeUndefined();
    expect(embedSrc(embedOf({ "data-watch": `https://youtu.be/${ID}?t=1m30s` }))).toBe(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0&start=90`);
    expect(embedSrc(embedOf({ "data-watch": "https://vimeo.com/76979871/8272103f6e#t=90s" }))).toBe("https://player.vimeo.com/video/76979871?autoplay=1&dnt=1&h=8272103f6e#t=90s");
    expect(embedLink(embedOf({ "data-provider": "youtube", "data-video": ID, "data-start": "90" }))).toBe(`https://www.youtube.com/watch?v=${ID}&t=90s`);
    expect(embedOf({ "data-watch": `https://youtu.be/${ID}?t=10`, "data-start": "20" }).start).toBe(20);
  });

  it("is refused in words for a provider not on the list, an id that is none, a bad start or shape, or a video named twice", () => {
    const why = (attributes: Record<string, string>) => {
      const read = named(attributes);
      return "why" in read ? read.why : undefined;
    };
    expect(why({ "data-provider": "dailymotion", "data-video": "x8k3" })).toContain('names the provider "dailymotion", which is none a view plays from: YouTube (data-provider="youtube") and Vimeo');
    expect(why({ "data-provider": "YouTube", "data-video": ID })).toContain("names the provider");
    expect(why({ "data-provider": "youtube", "data-video": "short" })).toContain("is no id of a video: one is 11 letters");
    expect(why({ "data-provider": "vimeo", "data-video": "abc" })).toContain("which is no id of a video: one is digits");
    expect(why({ "data-video": ID })).toContain("and no provider");
    expect(why({ "data-watch": "https://example.com/watch?v=1" })).toContain("which is no watch address of a provider a view plays");
    expect(why({ "data-watch": `https://youtu.be/${ID}`, "data-provider": "youtube" })).toContain("names a video twice");
    expect(why({ "data-provider": "youtube", "data-video": ID, "data-start": "soon" })).toContain('starts at "soon"');
    expect(why({ "data-provider": "youtube", "data-video": ID, "data-shape": "3:2" })).toContain("a player is 16:9, 4:3, 1:1 or 9:16");
    expect(why({ "data-watch": `https://example.com/${"x".repeat(5_000)}` })!.length).toBeLessThan(500);
  });

  it("never comes of an address that only looks like one", () => {
    for (const address of [
      `https://www.youtube.com.example/watch?v=${ID}`, `https://example.com/https://www.youtube.com/watch?v=${ID}`, `https://example.com#https://youtu.be/${ID}`, `https://youtu.be@example.com/${ID}`,
      `https://user:pass@youtu.be/${ID}`, `https://youtu.be:8443/${ID}`, `https://youtu.be\\@example.com/${ID}`, `https:/youtu.be/${ID}`, `https:youtu.be/${ID}`, `//youtu.be/${ID}`, `youtu.be/${ID}`,
      `javascript:alert(1)//youtu.be/${ID}`, `data:text/html,${ID}`, `ftp://youtu.be/${ID}`, `https://youtu.be/../${ID}`, `https://youtu.be/%2e%2e/${ID}`, `https://youtu.be/${ID}/more`, `https://youtu.be/${ID}\n.example.com`,
      `https://you\ttu.be/${ID}`, `https://YOUTU.BE/${ID}`, `https://youtu.be./${ID}`, `https://yоutu.be/${ID}`, `https://youtu.be/${ID}"onload="x`, `https://youtu.be/${ID}'`, `https://youtu.be/${ID}<b>`, `https://www.youtube.com/watch?v=${ID}&v=aaaaaaaaaaa`,
      `https://www.youtube.com/redirect?q=https://example.com`, `https://www.youtube.com/embed/videoseries?list=PL1`, `https://www.youtube.com/embed/live_stream?channel=UC1`, `https://www.youtube.com/watch?v=${ID}%00`, "https://www.youtube.com/", "https://vimeo.com/0", "https://vimeo.com/-1",
      "https://vimeo.com/1234567890123", "https://vimeo.com/76979871/nothex", "https://player.vimeo.com/video/76979871?h=zz", "https://player.vimeo.com/76979871", "https://vimeo.com.example/1", "https://evil-vimeo.com/1", "https://attackervimeo.com/76979871",
    ]) expect(watch(address), JSON.stringify(address)).toHaveProperty("why");
  });

  it("makes, of anything hostile, only the host's own addresses or none (fuzz)", () => {
    let seed = 20261125;
    const next = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    const bits = ["https://", "http://", "//", "javascript:", "data:", "youtu.be", "www.youtube.com", "youtube-nocookie.com", "vimeo.com", "player.vimeo.com", "example.com", "/", "\\", "?", "#", "&", "=", "@", ":", ".", "..", "%2f", "%00", " ", "\n", "\t", "\u0000", "‮", "ｙ", '"', "'", "<", ">", "`", "v=", "t=", "h=", "start=", "watch", "embed/", "video/", "shorts/", ID, "76979871", "8272103f6e", "autoplay=0", "&src=https://example.com", "1m30s", "99", "-", "_", "\ud800"];
    const pile = () => Array.from({ length: 1 + next(9) }, () => bits[next(bits.length)]).join("");
    const swap = (good: string) => {
      const at = next(good.length + 1);
      return good.slice(0, at) + bits[next(bits.length)] + good.slice(at + next(3));
    };
    const good = [`https://www.youtube.com/watch?v=${ID}&t=90s`, `https://youtu.be/${ID}`, "https://vimeo.com/76979871/8272103f6e#t=9s", "https://player.vimeo.com/video/76979871?h=8272103f6e"];
    let read = 0;
    for (let i = 0; i < 40_000; i += 1) {
      const said: Record<string, string> = {};
      if (next(2)) said["data-watch"] = next(2) ? pile() : swap(good[next(good.length)]!);
      else {
        said["data-provider"] = next(3) ? EMBED_PROVIDERS[next(2)]! : pile();
        said["data-video"] = next(2) ? pile() : swap(next(2) ? ID : "76979871/8272103f6e");
      }
      if (next(4) === 0) said["data-start"] = next(2) ? pile() : "1m30s";
      if (next(4) === 0) said["data-shape"] = next(2) ? pile() : "4:3";
      const one = named(said);
      if ("why" in one) continue;
      read += 1;
      const src = embedSrc(one.embed);
      expect(src, JSON.stringify(said)).toMatch(SRC);
      expect(embedLink(one.embed), JSON.stringify(said)).toMatch(LINK);
      expect(new URL(src).origin).toBe(EMBED_ORIGINS[one.embed.provider]);
    }
    expect(read).toBeGreaterThan(200);
  });
});

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
});

function page(options: { embeds?: EmbedHost; preview?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><body><main ${options.preview ? 'data-graview-preview="films"' : ""}></main></body>`, { url: "https://app.example/a/films/" });
  const window = dom.window as Window & typeof globalThis;
  /* jsdom lays nothing out: a frame on the page has a box, one that is not has none. */
  let hidden = false;
  window.Element.prototype.getClientRects = function (this: Element) {
    return (this.isConnected && !hidden ? [{}] : []) as unknown as DOMRectList;
  };
  let resized: (() => void) | undefined;
  Object.assign(window, { ResizeObserver: class { constructor(heard: () => void) { resized = heard; } observe() {} disconnect() {} } });
  const region = window.document.querySelector("main")!;
  const problems: { said: string; code: string }[] = [];
  const media = createGuestMedia(window, { view: '"Films"', pictures: false, shown: () => ({ nodes: [] }) as unknown as GuestProps, ...(options.embeds ? { embeds: options.embeds } : {}), onProblem: (said, problem) => problems.push({ said, code: problem.code }) });
  live.push(media);
  const place = (attributes: Record<string, string>) => {
    const element = window.document.createElement("graview-video");
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    region.appendChild(element);
    media.refresh(region);
    return element;
  };
  const at = <E extends Element>(element: Element, selector: string) => element.shadowRoot!.querySelector(selector) as E | null;
  return { window, region, media, problems, place, at, hide: () => ((hidden = true), resized?.()) };
}
const film = { "data-provider": "youtube", "data-video": ID, title: "Night & day" };

describe("the player the host draws", () => {
  it("asks nothing of the provider before the press, and then frames the one address with the least it needs", () => {
    const { place, at, problems } = page();
    const element = place({ ...film, "data-start": "90" });
    expect(at(element, "iframe, img, link, script")).toBeNull();
    expect(element.shadowRoot!.innerHTML).not.toMatch(/nocookie|ytimg|preconnect/);
    const button = at<HTMLButtonElement>(element, "button")!;
    expect([button.type, button.getAttribute("aria-label")]).toEqual(["button", "Play: Night & day"]);
    button.click();
    const frame = at<HTMLIFrameElement>(element, "iframe")!;
    expect(Object.fromEntries([...frame.attributes].map((one) => [one.name, one.value]))).toEqual({
      "data-graview-embed": "youtube",
      title: "Night & day (YouTube player)",
      sandbox: "allow-scripts allow-same-origin",
      allow: "autoplay; encrypted-media; fullscreen; picture-in-picture",
      allowfullscreen: "",
      loading: "lazy",
      referrerpolicy: "strict-origin-when-cross-origin",
      src: `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0&start=90`,
    });
    expect(element.shadowRoot!.activeElement).toBe(frame);
    expect(at(element, "button")).toBeNull();
    expect(at<HTMLElement>(element, "[data-frame]")!.style.aspectRatio).toBe("16 / 9");
    expect(problems).toEqual([]);
  });

  it("keeps a link out throughout, opening a tab of its own with no hold on the page", () => {
    const { place, at } = page();
    const element = place(film);
    const link = at<HTMLAnchorElement>(element, "a")!;
    expect([link.href, link.target, link.rel, link.getAttribute("aria-label")]).toEqual([`https://www.youtube.com/watch?v=${ID}`, "_blank", "noopener noreferrer", "Watch on YouTube: Night & day (opens in a new tab)"]);
    at<HTMLButtonElement>(element, "button")!.click();
    expect(at(element, "a")).toBe(link);
  });

  it("stays as it is across a redraw that says the same video, a new title or another start", () => {
    const { region, media, place, at } = page();
    const element = place(film);
    at<HTMLButtonElement>(element, "button")!.click();
    const frame = at<HTMLIFrameElement>(element, "iframe")!;
    media.refresh(region);
    element.setAttribute("title", "Renamed");
    element.setAttribute("data-start", "30");
    media.refresh(region);
    expect(at(element, "iframe")).toBe(frame);
    expect([frame.title, frame.src.includes("start")]).toEqual(["Renamed (YouTube player)", false]);
    element.setAttribute("data-video", "aaaaaaaaaaa");
    media.refresh(region);
    expect(at(element, "iframe")).toBeNull();
    expect(at(element, "button")).not.toBeNull();
  });

  it("goes back to its poster when another is played, when it is hidden, and when it is taken off the page", () => {
    const { region, media, place, at, hide } = page();
    const one = place(film);
    const two = place({ "data-watch": "https://vimeo.com/76979871", title: "Two" });
    at<HTMLButtonElement>(one, "button")!.click();
    at<HTMLButtonElement>(two, "button")!.click();
    expect([at(one, "iframe"), at(two, "iframe")?.getAttribute("src")]).toEqual([null, "https://player.vimeo.com/video/76979871?autoplay=1&dnt=1"]);
    two.remove();
    media.refresh(region);
    expect(at(two, "iframe")).toBeNull();
    at<HTMLButtonElement>(one, "button")!.click();
    hide();
    expect([at(one, "iframe"), at(one, "button") !== null]).toEqual([null, true]);
    at<HTMLButtonElement>(one, "button")!.click();
    media.dispose();
    expect(at(one, "iframe")).toBeNull();
  });

  it("stands at the view's own picture where it gave one, judged as any image of its is", () => {
    const { place, at } = page();
    expect(judgeAttribute("html", "graview-video", "poster", "https://i.ytimg.com/vi/x/0.jpg", { origin: "https://app.example" })).toHaveProperty("refused");
    expect(judgeAttribute("html", "graview-video", "poster", "data:image/png;base64,AAAA", { origin: "https://app.example" })).toEqual({ name: "poster", value: "data:image/png;base64,AAAA" });
    expect(judgeAttribute("html", "graview-video", "src", "https://player.vimeo.com/video/1", { origin: "https://app.example" })).toHaveProperty("refused");
    const image = at<HTMLImageElement>(place({ ...film, poster: "data:image/png;base64,AAAA" }), "img")!;
    expect([image.getAttribute("src"), image.getAttribute("alt"), image.referrerPolicy]).toEqual(["data:image/png;base64,AAAA", "", "no-referrer"]);
  });

  it("draws the link alone for a provider its host turned off", () => {
    const { place, at, problems } = page({ embeds: { providers: ["vimeo"] } });
    const off = place(film);
    expect([at(off, "button"), at(off, "[data-frame]"), at(off, "iframe")]).toEqual([null, null, null]);
    expect(at(off, "a")!.textContent).toBe("Night & day: watch on YouTube ↗");
    expect(at(place({ "data-watch": "https://vimeo.com/76979871" }), "button")).not.toBeNull();
    const none = page({ embeds: { providers: [] } });
    expect(none.at(none.place({ "data-watch": "https://vimeo.com/76979871" }), "button")).toBeNull();
    expect(problems).toEqual([]);
  });

  it("is a poster and a link in the Scene's card, with nothing to press play on", () => {
    const { place, at } = page({ preview: true });
    const element = place(film);
    expect([at(element, "button"), at(element, "[data-words]")!.textContent, at(element, "a") !== null]).toEqual([null, "Night & day", true]);
  });

  it("says, and keeps its link, where the page's policy allows no frame from the provider", () => {
    const { window, place, at, problems } = page();
    const element = place(film);
    at<HTMLButtonElement>(element, "button")!.click();
    const violated = (blockedURI: string, effectiveDirective = "frame-src") => window.document.dispatchEvent(Object.assign(new window.Event("securitypolicyviolation"), { blockedURI, effectiveDirective, disposition: "enforce" }));
    violated("https://elsewhere.example/");
    violated("https://www.youtube-nocookie.com", "img-src");
    expect(at(element, "iframe")).not.toBeNull();
    violated("https://www.youtube-nocookie.com");
    expect([at(element, "iframe"), at(element, "button"), at(element, "[data-words]")!.textContent]).toEqual([null, null, "YouTube videos do not play on this page. The link below opens this one."]);
    expect(element.shadowRoot!.activeElement).toBe(at(element, "a"));
    expect(problems).toEqual([{ code: "embed-not-allowed", said: 'A video in the view "Films" was not played: it names a YouTube video, and the page\'s policy allows no frame from https://www.youtube-nocookie.com (frame-src): its link stands alone.' }]);
  });

  it("draws nothing it refused, and says why once, with a code", () => {
    const { region, media, place, problems } = page();
    const element = place({ "data-provider": "dailymotion", "data-video": "x8" });
    media.refresh(region);
    expect(element.shadowRoot!.childNodes.length).toBe(0);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ code: "embed-refused" });
    expect(problems[0]!.said).toContain('A video in the view "Films" was not drawn: it names the provider "dailymotion"');
  });
});

describe("a view that draws again", () => {
  const view = () => {
    const dom = new JSDOM("<!doctype html><main></main>");
    const shadow = dom.window.document.querySelector("main")!.attachShadow({ mode: "open" });
    const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
    const moved: Node[] = [];
    const watching = new dom.window.MutationObserver((records: MutationRecord[]) => records.forEach((record) => moved.push(...record.removedNodes)));
    watching.observe(shadow, { childList: true, subtree: true });
    const made = createViewRuntime({ send: (request) => void (request.type === "render" && drawing.apply(structuredClone(request.records))), act: () => Promise.resolve({ type: "answer", id: 0, ok: false, reason: "refused", message: "" }), navigate: () => {}, microtask: (task) => queueMicrotask(task), now: () => 0, threw: (error) => { throw error; }, warn: () => {}, hardening: () => ({ removed: [], stuck: [], sealed: false }) });
    const draw = async (markup: string) => {
      moved.length = 0;
      made.view.render(markup);
      for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
      return moved.some((node) => node.nodeType === 1 && ((node as Element).localName === "graview-video" || (node as Element).querySelector("graview-video") !== null));
    };
    return { shadow, draw };
  };
  const video = `<graview-video data-provider="youtube" data-video="${ID}"></graview-video>`;

  it("never takes a video out of the page for what came, went or moved around it, whose frame would start over", async () => {
    const { shadow, draw } = view();
    await draw(`<p>One</p><p>Two</p>${video}`);
    const element = shadow.querySelector("graview-video");
    for (const markup of [`<p>One</p>${video}`, `${video}`, `<h2>New</h2>${video}<p>After</p>`, `${video}<h2>New</h2>`, `<p data-key="a">A</p><p data-key="b">B</p>${video}`, `<p data-key="b">B</p>${video}<p data-key="a">A</p>`, `${video}<p data-key="a">A</p><p data-key="b">B</p>`]) {
      expect(await draw(markup), markup).toBe(false);
      expect(shadow.querySelector("graview-video"), markup).toBe(element);
    }
  });

  it("keeps it in a part with no key of its own, whatever parts come and go before it", async () => {
    const { shadow, draw } = view();
    await draw(`<div><p>One</p></div><div>${video}</div><p>End</p>`);
    const element = shadow.querySelector("graview-video");
    for (const markup of [`<div>${video}</div><p>End</p>`, `<p id="extra">New</p><div><h3>Film</h3>${video}</div>`, `<div>First</div><section><p>x</p></section><div>${video}</div>`, `<div>${video}</div><div>First</div>`]) {
      expect(await draw(markup), markup).toBe(false);
      expect(shadow.querySelector("graview-video"), markup).toBe(element);
    }
    await draw("<p>Gone</p>");
    expect(shadow.innerHTML).not.toContain("graview-video data");
  });

  it("keeps what is moved past it in its order, each the element it was, and its start is no other video", async () => {
    const { shadow, draw } = view();
    const at = (t: string) => `<graview-video data-watch="https://youtu.be/${ID}${t}"></graview-video>`;
    await draw(`<input name="a"><input name="b">${at("")}`);
    const [a, b] = [...shadow.querySelectorAll("input")];
    const element = shadow.querySelector("graview-video");
    expect(await draw(`${at("?t=90")}<input name="a"><input name="b">`)).toBe(false);
    expect([...shadow.querySelectorAll("input")]).toEqual([a, b]);
    expect([a!.name, b!.name]).toEqual(["a", "b"]);
    expect(shadow.querySelector("graview-video")).toBe(element);
  });

  it("gives up no sibling to a video already placed, and costs a long list beside it nothing to speak of", async () => {
    const { shadow, draw } = view();
    await draw(`<div>${video}<input data-key="i"></div><div>${video}<input data-key="i"></div>`);
    const second = shadow.querySelectorAll("input")[1];
    await draw(`<div>${video}<input data-key="i"></div><div><input data-key="i"></div>`);
    expect(shadow.querySelectorAll("input")[1]).toBe(second);
    const rows = (n: number) => `<ul>${Array.from({ length: 800 }, (_, i) => `<li><b>${i}</b> <span>${n}</span></li>`).join("")}</ul>`;
    const timed = async (extra: string) => {
      await draw(extra + rows(0));
      const began = performance.now();
      for (let i = 1; i <= 3; i += 1) await draw(extra + rows(i));
      return performance.now() - began;
    };
    const without = await timed("<p></p>");
    expect(await timed(video)).toBeLessThan(without * 3 + 200);
  });

  it("keeps each card's video where the cards before it go, and gives another video an element of its own", async () => {
    const { shadow, draw } = view();
    const card = (key: string, id: string) => `<li data-key="${key}"><graview-video data-watch="https://youtu.be/${id}"></graview-video></li>`;
    const [a, b, c] = [card("a", "aaaaaaaaaaa"), card("b", "bbbbbbbbbbb"), card("c", "ccccccccccc")];
    await draw(`<ul>${a}${b}${c}</ul>`);
    const last = shadow.querySelector('[data-key="c"] graview-video');
    await draw(`<ul>${b}${c}</ul>`);
    expect(shadow.querySelector('[data-key="c"] graview-video')).toBe(last);
    expect([...shadow.querySelectorAll("li")].map((li) => li.getAttribute("data-key"))).toEqual(["b", "c"]);
    const before = shadow.querySelector('[data-key="b"] graview-video');
    await draw(`<ul>${card("b", "ddddddddddd")}${c}</ul>`);
    expect(shadow.querySelector('[data-key="b"] graview-video')).not.toBe(before);
  });
});

describe("a headless run, which a checker and a proposal read", () => {
  const home = defineNode("film", { fields: z.object({ name: z.string() }), plural: "Films" });
  const run = (markup: string, embeds?: EmbedHost) =>
    runWorkerViewHeadless({ store: new Store<AnySchema>({ schema: createSchema([home]) as AnySchema, mutations: [], snapshot: { nodes: [{ id: "film:one", kind: "film", name: "One" }], edges: [] } as never }), principal: { kind: "human", id: "u:owner", roles: ["owner"] } as Principal, run: nodeIsolate(), ...(embeds ? { embeds } : {}), manifest: { name: "films", title: "Films", attach: "film", cardinality: "many" }, source: `graview.onProps(() => graview.render(${JSON.stringify(markup)}));` });

  it("lists the video with its provider and link, and says it as a place is said", async () => {
    const result = await run(`<section><h2>Watch</h2><graview-video data-watch="https://youtu.be/${ID}?t=90" title="The keynote"></graview-video></section>`);
    if (!result.ok) throw new Error(result.detail);
    expect(result.description.problems).toEqual([]);
    expect(result.description.videos).toEqual([{ provider: "youtube", link: `https://www.youtube.com/watch?v=${ID}&t=90s`, text: "The keynote", name: ID, source: "YouTube", poster: false, autoplay: false, cover: false, playable: true }]);
    expect(result.description.text).toContain(`- The keynote (YouTube, https://www.youtube.com/watch?v=${ID}&t=90s): no poster; plays in place once a person presses it, with its link beside it; playable.`);
  });

  it("refuses an address outside the list among its problems, in words and with the code", async () => {
    const result = await run('<section><graview-video data-watch="https://example.com/watch?v=1"></graview-video><graview-video data-provider="youtube" data-video="nope"></graview-video></section>');
    if (!result.ok) throw new Error(result.detail);
    expect(result.description.problems.map((one) => one.code)).toEqual(["embed-refused", "embed-refused"]);
    expect(result.description.problems[0]!.says).toContain('Not drawn: it names the address "https://example.com/watch?v=1"');
    expect(result.description.videos).toBeUndefined();
  });

  it("says a provider its host turned off is drawn as its link", async () => {
    const result = await run(`<section><graview-video data-provider="youtube" data-video="${ID}" title="The keynote"></graview-video></section>`, { providers: [] });
    if (!result.ok) throw new Error(result.detail);
    expect(result.description.videos![0]).toMatchObject({ playable: false, why: "this host plays no YouTube video in a view: its link is drawn alone" });
    expect(result.description.text).toContain("The keynote: watch on YouTube");
  });
});
