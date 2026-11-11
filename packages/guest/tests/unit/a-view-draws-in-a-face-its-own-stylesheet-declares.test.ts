// @vitest-environment jsdom
import { Store } from "@graview/core";
import { sanitizeStylesheet } from "@graview/core/css";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { judgeTranscript } from "../../src/headless/judge.js";
import { loadViewFaces, loadViewFonts } from "../../src/host/fonts.js";
import { mountWorkerView } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/**
 * A VIEW DRAWS IN A FACE ITS OWN STYLESHEET DECLARES (HQ
 * f-view-font-face-data). An `@font-face` whose every `src` is a `data:`
 * font is judged by the open kit (`@graview/core/css`), and the host loads
 * the face into the page as a `FontFace` made from its bytes — never
 * fetched, so the page's own policy for fonts is not asked and nothing
 * reaches the network — and gives it back with the view. In the document a
 * face is the page's, so it is held to the names a lent face is: not one
 * the page already draws in, and not one the app lends its views
 * (`brand.views.fonts`) — there the app's face is drawn, as the app's
 * stylesheet for every view wins over the view's own. Two views declaring
 * one name from two files are one name on the page: the last lent is drawn,
 * as for lent faces, and that is said. A headless run says what the page
 * would. That a browser draws the view's text in it is guest-sandbox's
 * brand claims.
 */
const fontData = (size: number, fill = 7) => {
  const bytes = Buffer.alloc(size, fill);
  bytes.write("wOF2", 0, "latin1");
  return `url(data:font/woff2;base64,${bytes.toString("base64")})`;
};
const sheet = (family: string, size = 2_000, fill = 7, more = "") => `@font-face { font-family: "${family}"; src: ${fontData(size, fill)} format("woff2"); font-weight: 700${more} }`;
const facesOf = (css: string) => sanitizeStylesheet(css, undefined, { faces: true }).faces;

let made: { family: string; source: unknown; descriptors: Record<string, string> }[];
let fonts: Set<unknown>;
let fetched: string[];
class FakeFontFace {
  readonly status = "unloaded";
  constructor(readonly family: string, readonly source: unknown, readonly descriptors: Record<string, string>) {
    made.push({ family, source, descriptors });
  }
  load() {
    return Promise.resolve(this);
  }
}
beforeEach(() => {
  made = [];
  fonts = new Set();
  fetched = [];
  Object.assign(window, {
    FontFace: FakeFontFace,
    fetch: (url: string) => {
      fetched.push(String(url));
      return Promise.reject(new Error("nothing is fetched"));
    },
  });
  Object.defineProperty(document, "fonts", { value: { add: (face: unknown) => fonts.add(face), delete: (face: unknown) => fonts.delete(face) }, configurable: true });
});
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));
const backs: (() => void)[] = [];
afterEach(() => {
  for (const back of backs.splice(0)) back();
});

describe("a face a view's stylesheet declares", () => {
  it("is loaded into the page from its own bytes, with its descriptors, and nothing is fetched", async () => {
    const said: string[] = [];
    backs.push(loadViewFaces(document, facesOf(sheet("Shout Display")), {}, (one) => said.push(one)));
    await settled();
    expect(fetched).toEqual([]);
    expect(said).toEqual([]);
    expect(fonts.size).toBe(1);
    expect(made[0]!.family).toBe("Shout Display");
    expect(made[0]!.source).toBeInstanceOf(ArrayBuffer);
    expect((made[0]!.source as ArrayBuffer).byteLength).toBe(2_000);
    expect(made[0]!.descriptors).toMatchObject({ weight: "700" });
  });

  it("is not loaded where the app lends its views a face by that name: the app's face is drawn, and that is said with a finding code", async () => {
    const said: string[] = [];
    backs.push(loadViewFaces(document, facesOf(sheet("rock face")), { lent: ["Rock Face"] }, (one) => said.push(one)));
    await settled();
    expect(fonts.size).toBe(0);
    expect(said).toEqual([expect.stringMatching(/"rock face".*the app lends its views a face by that name.*app's face is the one drawn.*\(view-font-face-lent\)\.$/)]);
  });

  it("never takes a name of the brand's own stacks", async () => {
    const said: string[] = [];
    backs.push(loadViewFaces(document, facesOf(sheet("Fraunces")), { typography: { display: "Fraunces, serif" } }, (one) => said.push(one)));
    await settled();
    expect(fonts.size).toBe(0);
    expect(said).toEqual([expect.stringMatching(/would replace.*\(view-font-face-family\)\.$/)]);
  });

  it("drawn by two views from two files under one name, is the last lent's on the page, and that is said", async () => {
    const said: string[] = [];
    backs.push(loadViewFaces(document, facesOf(sheet("Shout", 2_000, 1)), {}, (one) => said.push(`first: ${one}`)));
    await settled();
    backs.push(loadViewFaces(document, facesOf(sheet("Shout", 2_000, 2)), {}, (one) => said.push(`second: ${one}`)));
    await settled();
    expect(made).toHaveLength(2);
    expect(fonts.size).toBe(1);
    expect(new Uint8Array((([...fonts][0] as FakeFontFace).source as ArrayBuffer))[5]).toBe(2);
    expect(said.some((one) => /lent from 2 files/.test(one))).toBe(true);
  });

  it("is loaded once however often the view gives its stylesheets again, and goes with the view", async () => {
    const one = loadViewFaces(document, facesOf(sheet("Shout")), {}, () => {});
    const again = loadViewFaces(document, facesOf(sheet("Shout")), {}, () => {}, one);
    await settled();
    expect(made).toHaveLength(1);
    expect(fonts.size).toBe(1);
    again();
    expect(fonts.size).toBe(0);
  });

  it("is apart from the faces the app lends: a lent face by another name is drawn beside it", async () => {
    Object.assign(window, { fetch: () => Promise.resolve(new Response(new Uint8Array(64), { headers: { "content-type": "font/woff2" } })) });
    backs.push(loadViewFonts(document, [{ family: "Rock Face", src: `/graview/assets/${"b".repeat(64)}.woff2` }], { asset: (path) => path }, () => {}));
    backs.push(loadViewFaces(document, facesOf(sheet("Shout")), { lent: ["Rock Face"] }, () => {}));
    await settled();
    expect([...fonts].map((one) => (one as FakeFontFace).family).sort()).toEqual(["Rock Face", "Shout"]);
  });
});

class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: { message: unknown; transfer: unknown[] }[] = [];
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    this.posted.push({ message, transfer });
  }
  terminate() {}
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (test: () => boolean) => {
  for (let i = 0; i < 100 && !test(); i += 1) await wait(10);
};
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
afterEach(() => {
  FakeWorker.made = [];
  document.body.replaceChildren();
});

describe("a worker view on a page", () => {
  it("draws in the face its stylesheet declares, says a face past its size once, and gives its face back when it goes", async () => {
    const problems: string[] = [];
    const view = mountWorkerView(document.body.appendChild(document.createElement("div")), {
      manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many" },
      worker: { script: "/* the view */" },
      store: store(),
      principal: lin,
      limits: { silentMs: 5_000 },
      onProblem: (said) => problems.push(said),
    });
    const worker = FakeWorker.made.at(-1)!;
    worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
    const hello = worker.posted[0]!.message as HostHello;
    const port = worker.posted[0]!.transfer[0] as MessagePort;
    port.onmessage = (event) => {
      const data = event.data as { type?: string; beat?: number; push?: number };
      if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
      if (data.type === "props" && typeof data.push === "number") port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 3 });
    };
    const sheets = [sheet("Shout"), sheet("Too Big", 60_000), ".title { font-family: Shout, serif }"];
    port.postMessage({ type: "style", sheets, nonce: hello.nonce });
    await until(() => fonts.size === 1 && problems.length > 0);
    expect([...fonts].map((one) => (one as FakeFontFace).family)).toEqual(["Shout"]);
    expect(fetched).toEqual([]);
    expect(problems).toEqual([expect.stringMatching(/"Too Big".*more than the 50 KB.*\(view-font-face-size\)\.$/)]);
    /* The view gives the same sheets again, and one more rule: the face is not loaded twice, nor the refusal said twice. */
    port.postMessage({ type: "style", sheets: [...sheets, ".x { color: red }"], nonce: hello.nonce });
    await wait(50);
    expect(made).toHaveLength(1);
    expect(problems).toHaveLength(1);
    view.dispose();
    expect(fonts.size).toBe(0);
  });
});

describe("a headless run", () => {
  it("says what the page would of a view's faces: one past its size, and one the app lends by name", () => {
    const judged = judgeTranscript(
      { renders: [], asked: [], went: [], ms: 1, logs: [], messages: 2, sheets: [sheet("Shout"), sheet("Too Big", 60_000), sheet("Rock Face")] },
      { props: {} as never, acts: [], places: [], limits: { maxNodes: 100, messages: 100, pushMs: 1_000 } },
      { lent: ["Rock Face"] },
    );
    expect(judged.ok).toBe(true);
    const says = judged.ok ? judged.problems.map((problem) => problem.says) : [];
    expect(says).toEqual([expect.stringMatching(/"Too Big".*\(view-font-face-size\)\.$/), expect.stringMatching(/"Rock Face".*\(view-font-face-lent\)\.$/)]);
    expect(judged.ok && judged.drawn.css).not.toMatch(/font-face|url/);
  });
});
