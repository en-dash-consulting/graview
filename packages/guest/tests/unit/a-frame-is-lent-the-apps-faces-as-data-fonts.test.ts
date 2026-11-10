// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectGuest } from "../../src/guest.js";
import { frameFonts } from "../../src/host/fonts.js";
import { mountGuestView, type GuestFrame } from "../../src/host/frame.js";
import { GUEST_PROTOCOL, type GuestFont, type HostHello, type HostMessage } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A FRAME IS LENT THE APP'S FACES AS DATA FONTS (Roadmap
 * f-faces-lent-to-frames). Since 0.1.71 the faces an app lends its views
 * (`brand.views.fonts`) reached worker views alone; a `guestView` frame got
 * none, and its text fell back to a generic stack. The frame's host now reads
 * each face where a worker view's would be loaded from — a file the app holds
 * where `asset` serves it, an `https:` address on an origin `fonts.origins`
 * lists — held to the same 2 MB, the last lent winning a shared name, and
 * hands it over the port as a `data:` font; the client puts it in the frame's
 * document, whose policy allows `font-src data:` and is asked for nothing
 * more. In a browser, text drawn in the face: `pnpm verify guest`
 * (--transport=client).
 */
const SHA = (letter: string) => letter.repeat(64);
const ROCK = { family: "Rock Face", src: `/graview/assets/${SHA("a")}.woff2` };
const ROCK_AGAIN = { family: "Rock Face", src: `/graview/assets/${SHA("b")}.woff2` };
const BIG = { family: "Big Face", src: `/graview/assets/${SHA("c")}.woff2` };
const FAR = { family: "Fredoka", src: "https://fonts.gstatic.com/s/fredoka.woff2" };
const ELSEWHERE = { family: "Elsewhere", src: "https://fonts.example/elsewhere.woff2" };
const at = (path: string) => `https://app.example${path}`;

/** What each address answers: bytes of one value, so which file was handed can be read off its data. */
const files = new Map<string, () => Response>([
  [at(ROCK.src), () => new Response(new Uint8Array(300).fill(1))],
  [at(ROCK_AGAIN.src), () => new Response(new Uint8Array(200).fill(2))],
  [at(BIG.src), () => new Response(new Uint8Array(2_000_001), { headers: { "content-length": "2000001" } })],
  [FAR.src, () => new Response(new Uint8Array(100).fill(3))],
]);
let asked: { url: string; credentials: RequestCredentials | undefined }[];
const fetcher = (async (url: string, init?: RequestInit) => {
  asked.push({ url, credentials: init?.credentials });
  return files.get(url)?.() ?? new Response("gone", { status: 404 });
}) as unknown as typeof fetch;
beforeEach(() => {
  asked = [];
});

const bytesOf = (font: GuestFont) => [...atob(font.src.split(",")[1]!)].map((one) => one.charCodeAt(0));

describe("the host reads the faces an app lends a frame", () => {
  it("hands each as a data: font of its own file, a file the app holds read with the page's session and one on a listed origin with none", async () => {
    const said: string[] = [];
    const fonts = await frameFonts([ROCK, FAR], { asset: at, origins: ["https://fonts.gstatic.com"], fetch: fetcher }, (one) => said.push(one));
    expect(said).toEqual([]);
    expect(fonts.map((font) => font.family)).toEqual(["Rock Face", "Fredoka"]);
    expect(fonts.every((font) => font.src.startsWith("data:font/woff2;base64,"))).toBe(true);
    expect(bytesOf(fonts[0]!)).toEqual(new Array(300).fill(1));
    expect(asked).toEqual([
      { url: at(ROCK.src), credentials: "same-origin" },
      { url: FAR.src, credentials: "omit" },
    ]);
  });

  it("hands the file lent last under a shared name, and says which", async () => {
    const said: string[] = [];
    const fonts = await frameFonts([ROCK, ROCK_AGAIN], { asset: at, fetch: fetcher }, (one) => said.push(one));
    expect(fonts).toHaveLength(1);
    expect(bytesOf(fonts[0]!)).toEqual(new Array(200).fill(2));
    expect(said).toEqual([`The app's face "Rock Face" for its views is lent from 2 files, and the one drawn in the frame is ${at(ROCK_AGAIN.src)}.`]);
  });

  it("holds every face to 2 MB, says one past it, and hands the one lent before it under the name", async () => {
    const said: string[] = [];
    const big = await frameFonts([BIG], { asset: at, fetch: fetcher }, (one) => said.push(one));
    expect(big).toEqual([]);
    expect(said).toEqual([`The app's face "Big Face" for its views is not loaded: its file, ${at(BIG.src)}, is more than 2 MB, the most a file may be as a face for the app's views.`]);
    const fallback = await frameFonts([ROCK, { ...BIG, family: "Rock Face" }], { asset: at, fetch: fetcher }, () => {});
    expect(fallback.map(bytesOf)).toEqual([new Array(300).fill(1)]);
  });

  it("reads nothing from an origin the host does not list, nor a held file where it says no asset, and says each", async () => {
    const said: string[] = [];
    expect(await frameFonts([ELSEWHERE, ROCK], { fetch: fetcher }, (one) => said.push(one))).toEqual([]);
    expect(asked).toEqual([]);
    expect(said).toHaveLength(2);
    expect(said[0]).toContain("is no origin this host lists for the faces its views are lent");
    expect(said[1]).toContain("this host says nowhere the app's own files are served");
  });
});

describe("a frame whose app lends faces", () => {
  let frame: GuestFrame | undefined;
  afterEach(() => {
    frame?.dispose();
    frame = undefined;
    vi.restoreAllMocks();
  });

  it("is handed them over its port once it is ready, and again, emptied, when the brand lends none", async () => {
    vi.spyOn(window, "fetch").mockImplementation(fetcher as never);
    let brand: { name: string; views?: { fonts: readonly (typeof ROCK)[] } } = { name: "Quarry", views: { fonts: [ROCK] } };
    const element = document.createElement("div");
    document.body.appendChild(element);
    frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, brand: () => brand, asset: at });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
    const [, , [port]] = posted.mock.calls.at(-1) as unknown as [HostHello, string, MessagePort[]];
    const heard: HostMessage[] = [];
    port!.onmessage = (event) => heard.push(event.data);
    const lent = () => heard.filter((one): one is Extract<HostMessage, { type: "fonts" }> => one.type === "fonts");
    await vi.waitFor(() => expect(lent()).toHaveLength(1));
    expect(lent()[0]!.fonts.map((font) => [font.family, font.src.slice(0, 23)])).toEqual([["Rock Face", "data:font/woff2;base64,"]]);
    brand = { name: "Quarry" };
    frame.update();
    await vi.waitFor(() => expect(lent()).toHaveLength(2));
    expect(lent()[1]!.fonts).toEqual([]);
  });
});

describe("the client in the frame", () => {
  it("puts each data: font in the frame's document, in place of those lent before, and takes nothing that is not one", async () => {
    const faces = new Set<{ family: string; source: string }>();
    class FakeFontFace {
      status = "unloaded";
      constructor(
        readonly family: string,
        readonly source: string,
      ) {}
      load() {
        this.status = "loaded";
        return Promise.resolve(this);
      }
    }
    vi.stubGlobal("FontFace", FakeFontFace);
    Object.defineProperty(document, "fonts", { value: { add: (face: never) => faces.add(face), delete: (face: never) => faces.delete(face) }, configurable: true });
    const channel = new MessageChannel();
    let heard: ((event: MessageEvent) => void) | undefined;
    const parent = { postMessage: () => {} };
    const guest = connectGuest({ window: { parent, addEventListener: (_type, one) => (heard = one), removeEventListener: () => {} } });
    heard!({ data: { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce: "n", view: "card" }, ports: [channel.port2], source: parent, origin: "https://app.example" } as unknown as MessageEvent);
    const send = (fonts: readonly unknown[]) => channel.port1.postMessage({ type: "fonts", fonts });
    const ROCK_DATA = "data:font/woff2;base64,AQEB";
    send([{ family: "Rock Face", src: ROCK_DATA }, { family: "Fetched", src: "https://fonts.example/f.woff2" }, { family: "Script", src: "data:text/javascript;base64,AQEB" }]);
    await vi.waitFor(() => expect([...faces].map((face) => [face.family, face.source])).toEqual([["Rock Face", `url("${ROCK_DATA}")`]]));
    send([{ family: "Baloo 2", src: "data:font/ttf;base64,AgIC", weight: "700" }]);
    await vi.waitFor(() => expect([...faces].map((face) => face.family)).toEqual(["Baloo 2"]));
    guest.close();
    vi.unstubAllGlobals();
  });
});
