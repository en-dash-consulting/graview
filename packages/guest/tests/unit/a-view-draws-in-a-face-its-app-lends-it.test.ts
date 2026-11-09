// @vitest-environment jsdom
import { createSchema, defineNode, Store, z, type AnySchema, type Principal } from "@graview/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadViewFonts, viewFontAddress } from "../../src/host/fonts.js";
import { mountWorkerView } from "../../src/host/view.js";
import { GUEST_PROTOCOL } from "../../src/protocol.js";

/**
 * A VIEW DRAWS IN A FACE ITS APP LENDS IT (Roadmap
 * f-view-authoring-friction-2026-11). A view's stylesheet loads nothing, so
 * no `@font-face`; the brand lends its views faces instead
 * (`brand.views.fonts`), and the view's host loads each into the page as a
 * `FontFace`, only from where it lets faces come from: a file the app
 * holds, where the host says those are served (`asset`), or an `https:`
 * address on an origin it lists for faces (`fonts.origins`, apart from
 * `images.origins`). Anything else is said and
 * not fetched. A face never takes a name the page already draws in, and goes
 * when the brand or the view does. That a browser draws the view in it is
 * guest-sandbox's brand claims.
 */
const SHA = "b".repeat(64);
const BALOO = { family: "Baloo 2", src: `/graview/assets/${SHA}.woff2`, weight: "400 800" };
const FREDOKA = { family: "Fredoka", src: "https://fonts.gstatic.com/s/fredoka.woff2" };
const asset = (path: string) => `https://app.example/base${path}`;

let made: { family: string; source: ArrayBuffer; descriptors: Record<string, string> }[];
let fonts: Set<unknown>;
/* As Firefox has it: a family that is not one CSS identifier without its quotes is an error at once, and a face in error is never added. */
class FakeFontFace {
  readonly status: string;
  constructor(readonly family: string, source: ArrayBuffer, descriptors: Record<string, string>) {
    made.push({ family, source, descriptors });
    this.status = /^[^"].*\s\d/.test(family) ? "error" : "unloaded";
  }
  load() {
    return Promise.resolve(this);
  }
}
beforeEach(() => {
  made = [];
  fonts = new Set();
  /* The host fetches a face's file itself, to hold it to its size (a-lent-face-past-its-size-is-not-loaded). */
  Object.assign(window, { FontFace: FakeFontFace, fetch: () => Promise.resolve(new Response(new Uint8Array(64))) });
  Object.defineProperty(document, "fonts", { value: { add: (face: unknown) => fonts.add(face), delete: (face: unknown) => fonts.delete(face) }, configurable: true });
});

const settled = () => new Promise((resolve) => setTimeout(resolve, 20));
/* Given back after each test: what the page holds outlives a test's stand-in for its fonts. */
const backs: (() => void)[] = [];
const lend = (given: Parameters<typeof loadViewFonts>[1], options: Parameters<typeof loadViewFonts>[2], say: Parameters<typeof loadViewFonts>[3]) => {
  const back = loadViewFonts(document, given, options, say);
  backs.push(back);
  return back;
};
afterEach(() => {
  for (const back of backs.splice(0)) back();
});

describe("a face lent to a view", () => {
  it("is loaded from a file the app holds where the host serves them, and from an https: origin the host lists for faces", () => {
    expect(viewFontAddress(BALOO, { asset })).toEqual({ url: `https://app.example/base/graview/assets/${SHA}.woff2` });
    expect(viewFontAddress(FREDOKA, { origins: ["https://fonts.gstatic.com"] })).toEqual({ url: FREDOKA.src });
  });

  it("is held to the host's list for faces as an image is to its own: the origin as the URL parser says it, and a list entry that is no https: origin counts for nothing", () => {
    expect(viewFontAddress(FREDOKA, { origins: ["https://FONTS.gstatic.com:443/"] })).toEqual({ url: FREDOKA.src });
    expect(viewFontAddress(FREDOKA, { origins: ["fonts.gstatic.com", "http://fonts.gstatic.com"] })).toEqual({ refused: expect.stringContaining("no origin this host lists") });
  });

  it("is refused, and said, where the host serves no app files, lists no such origin, or the face breaks the brand's rule", () => {
    expect(viewFontAddress(BALOO, {})).toEqual({ refused: expect.stringContaining("this host says nowhere the app's own files are served (`asset`)") });
    expect(viewFontAddress(FREDOKA, { origins: ["https://upload.wikimedia.org"] })).toEqual({ refused: expect.stringContaining("https://fonts.gstatic.com is no origin this host lists for the faces its views are lent") });
    expect(viewFontAddress({ family: "Rock", src: "https://evil.example/steal.css" }, { origins: ["https://evil.example"] })).toEqual({ refused: expect.stringContaining("its src is a file the app holds") });
  });

  it("never takes a name the page already draws in: a system face, Graview's own, or a face of the brand's own stacks", () => {
    expect(viewFontAddress({ family: "Arial", src: BALOO.src }, { asset })).toEqual({ refused: expect.stringContaining("would replace") });
    expect(viewFontAddress({ family: "Montserrat", src: BALOO.src }, { asset })).toEqual({ refused: expect.stringContaining("would replace") });
    expect(viewFontAddress({ family: "Fraunces", src: BALOO.src }, { asset, typography: { display: "Fraunces, serif" } })).toEqual({ refused: expect.stringContaining("would replace") });
  });

  it("is added to the page's fonts once, however often the view is dressed, with its weight and style", async () => {
    const said: string[] = [];
    lend([FREDOKA], { origins: ["https://fonts.gstatic.com"] }, (one) => said.push(one));
    lend([FREDOKA], { origins: ["https://fonts.gstatic.com"] }, (one) => said.push(one));
    await settled();
    expect(made).toHaveLength(1);
    expect(fonts.size).toBe(1);
    expect(said).toEqual([]);
  });

  it("is built again with its family quoted where the engine takes it for no family at all, as Firefox does \"Baloo 2\"", async () => {
    lend([BALOO], { asset }, () => {});
    await settled();
    expect(made.map((one) => one.family)).toEqual(["Baloo 2", '"Baloo 2"']);
    expect([...fonts].map((one) => (one as FakeFontFace).family)).toEqual(['"Baloo 2"']);
    expect(made[1]!.descriptors).toEqual({ display: "swap", weight: "400 800" });
  });

  it("is loaded at most eight to a brand, and what was left out is said", async () => {
    const nine = Array.from({ length: 9 }, (_, at) => ({ family: `Rock${"abcdefghi"[at]}`, src: BALOO.src }));
    const said: string[] = [];
    lend(nine, { asset }, (one) => said.push(one));
    await settled();
    expect(fonts.size).toBe(8);
    expect(said).toEqual([expect.stringMatching(/at most 8.*Rocki/)]);
  });

  it("goes from the page once no view holds it", async () => {
    const first = lend([FREDOKA], { origins: ["https://fonts.gstatic.com"] }, () => {});
    const second = lend([FREDOKA], { origins: ["https://fonts.gstatic.com"] }, () => {});
    await settled();
    first();
    expect(fonts.size).toBe(1);
    second();
    second();
    expect(fonts.size).toBe(0);
  });
});

/* The worker's stand-in: the host's half runs for real. */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage() {}
  terminate() {}
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars", label: (node) => node.label });
const store = () => new Store<AnySchema>({ schema: createSchema([car]) as AnySchema, mutations: [], policy: { grants: [] }, snapshot: { nodes: [{ id: "car:golf", kind: "car", label: "Golf" }], edges: [] } as never });
const reader: Principal = { kind: "human", id: "u:reader" };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
afterEach(() => {
  FakeWorker.made = [];
  document.body.replaceChildren();
});

describe("a view on a page", () => {
  it("gives back the faces it was lent when it is taken off the page, and when the brand stops lending them", async () => {
    const until = async (test: () => boolean) => {
      for (let i = 0; i < 100 && !test(); i += 1) await wait(10);
    };
    const brand: { current: { name: string; views?: { fonts: readonly typeof FREDOKA[] } } } = { current: { name: "Cars", views: { fonts: [FREDOKA] } } };
    const mounted = () => {
      const view = mountWorkerView(document.body.appendChild(document.createElement("div")), { manifest: { name: "card", attach: "car", cardinality: "one" }, worker: { script: "/* the view */" }, store: store(), principal: reader, input: () => ({ node: { id: "car:golf" } }), fonts: { origins: ["https://fonts.gstatic.com"] }, brand: () => brand.current });
      FakeWorker.made.at(-1)!.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
      return view;
    };
    const taken = mounted();
    await until(() => fonts.size === 1);
    expect(fonts.size).toBe(1);
    taken.dispose();
    expect(fonts.size).toBe(0);
    const stays = mounted();
    await until(() => fonts.size === 1);
    expect(fonts.size).toBe(1);
    brand.current = { name: "Cars" };
    stays.update();
    await until(() => fonts.size === 0);
    expect(fonts.size).toBe(0);
    stays.dispose();
  });

  it("gives back a face once the brand's own stack takes its name, though the faces it lends did not change", async () => {
    const until = async (test: () => boolean) => {
      for (let i = 0; i < 100 && !test(); i += 1) await wait(10);
    };
    const said: string[] = [];
    const lends = { fonts: [FREDOKA] };
    const brand: { current: { name: string; views: typeof lends; typography?: { display: string } } } = { current: { name: "Cars", views: lends } };
    const view = mountWorkerView(document.body.appendChild(document.createElement("div")), { manifest: { name: "card", attach: "car", cardinality: "one" }, worker: { script: "/* the view */" }, store: store(), principal: reader, input: () => ({ node: { id: "car:golf" } }), fonts: { origins: ["https://fonts.gstatic.com"] }, brand: () => brand.current, onProblem: (one) => said.push(one) });
    FakeWorker.made.at(-1)!.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
    await until(() => fonts.size === 1);
    brand.current = { name: "Cars", views: lends, typography: { display: "Fredoka, serif" } };
    view.update();
    await until(() => fonts.size === 0);
    expect(fonts.size).toBe(0);
    expect(said.join(" ")).toContain("would replace");
    view.dispose();
  });

  it("says so where the app's stylesheet for its views draws nothing, once", async () => {
    const until = async (test: () => boolean) => {
      for (let i = 0; i < 100 && !test(); i += 1) await wait(10);
    };
    const said: string[] = [];
    const view = mountWorkerView(document.body.appendChild(document.createElement("div")), { manifest: { name: "card", attach: "car", cardinality: "one" }, worker: { script: "/* the view */" }, store: store(), principal: reader, input: () => ({ node: { id: "car:golf" } }), brand: () => ({ name: "Cars", views: { css: "@import 'x.css';" } }), onProblem: (one) => said.push(one) });
    FakeWorker.made.at(-1)!.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
    await until(() => said.length > 0);
    view.update();
    await wait(30);
    expect(said.filter((one) => one.includes("stylesheet"))).toEqual([expect.stringContaining("The app's stylesheet for its views draws nothing")]);
    view.dispose();
  });
});
