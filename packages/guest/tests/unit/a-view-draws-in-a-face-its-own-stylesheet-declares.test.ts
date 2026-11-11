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
const familiesOnPage = () => [...fonts].map((one) => (one as FakeFontFace).family).sort();

describe("a face a view's stylesheet declares", () => {
  it("is loaded into the page from its own bytes, under the view's own name for it, with its descriptors, and nothing is fetched", async () => {
    const said: string[] = [];
    backs.push(loadViewFaces(document, facesOf(sheet("Shout Display")), { scope: "gv-a" }, (one) => said.push(one)));
    await settled();
    expect(fetched).toEqual([]);
    expect(said).toEqual([]);
    expect(familiesOnPage()).toEqual(["gv-a Shout Display"]);
    expect(made[0]!.source).toBeInstanceOf(ArrayBuffer);
    expect((made[0]!.source as ArrayBuffer).byteLength).toBe(2_000);
    expect(made[0]!.descriptors).toMatchObject({ weight: "700" });
  });

  it("named as a face the host page draws in (\"Lato\"), takes nothing from the page: the page's own Lato is never replaced", async () => {
    backs.push(loadViewFaces(document, facesOf(sheet("Lato")), { scope: "gv-a" }, () => {}));
    await settled();
    expect(familiesOnPage()).toEqual(["gv-a Lato"]);
    expect(familiesOnPage()).not.toContain("Lato");
  });

  it("declared by two views as \"Display\" from two files, is each view's own: both are on the page, each drawn in its view", async () => {
    const said: string[] = [];
    backs.push(loadViewFaces(document, facesOf(sheet("Display", 2_000, 1)), { scope: "gv-a" }, (one) => said.push(one)));
    backs.push(loadViewFaces(document, facesOf(sheet("Display", 2_000, 2)), { scope: "gv-b" }, (one) => said.push(one)));
    await settled();
    expect(familiesOnPage()).toEqual(["gv-a Display", "gv-b Display"]);
    const byFamily = new Map([...fonts].map((one) => [(one as FakeFontFace).family, new Uint8Array((one as FakeFontFace).source as ArrayBuffer)[5]]));
    expect([byFamily.get("gv-a Display"), byFamily.get("gv-b Display")]).toEqual([1, 2]);
    expect(said).toEqual([]);
  });

  it("is loaded once however often the view gives the same bytes again, a new file when they differ, and goes with the view", async () => {
    const one = loadViewFaces(document, facesOf(sheet("Shout")), { scope: "gv-a" }, () => {});
    const again = loadViewFaces(document, facesOf(sheet("Shout")), { scope: "gv-a" }, () => {}, one);
    await settled();
    expect(made).toHaveLength(1);
    const changed = loadViewFaces(document, facesOf(sheet("Shout", 2_000, 9)), { scope: "gv-a" }, () => {}, again);
    await settled();
    expect(made).toHaveLength(2);
    expect(fonts.size).toBe(1);
    changed();
    expect(fonts.size).toBe(0);
  });

  it("is apart from the faces the app lends: a lent face by another name is drawn beside it", async () => {
    Object.assign(window, { fetch: () => Promise.resolve(new Response(new Uint8Array(64), { headers: { "content-type": "font/woff2" } })) });
    backs.push(loadViewFonts(document, [{ family: "Rock Face", src: `/graview/assets/${"b".repeat(64)}.woff2` }], { asset: (path) => path }, () => {}));
    backs.push(loadViewFaces(document, facesOf(sheet("Shout")), { scope: "gv-a" }, () => {}));
    await settled();
    expect(familiesOnPage()).toEqual(["Rock Face", "gv-a Shout"]);
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

/** A view past its ready, whose runtime the test speaks for, dressed in `brand` where given. */
function mounted(brand?: () => { readonly name: string; readonly views?: { readonly fonts?: readonly { family: string; src: string }[] } }) {
  const problems: string[] = [];
  const view = mountWorkerView(document.body.appendChild(document.createElement("div")), {
    manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many" },
    worker: { script: "/* the view */" },
    store: store(),
    principal: lin,
    limits: { silentMs: 5_000 },
    ...(brand ? { brand, asset: (path: string) => path } : {}),
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
  const style = (sheets: readonly string[]) => port.postMessage({ type: "style", sheets, nonce: hello.nonce });
  const drawnCss = () => view.shadow.querySelector("[data-graview-view-style]")?.textContent ?? "";
  return { view, problems, style, drawnCss };
}

describe("a worker view on a page", () => {
  it("draws in the face its stylesheet declares, under its own name for it, says a face past its size once, and gives its face back when it goes", async () => {
    const { view, problems, style, drawnCss } = mounted();
    const sheets = [sheet("Shout"), sheet("Too Big", 60_000), ".title { font-family: Shout, serif }"];
    style(sheets);
    await until(() => fonts.size === 1 && problems.length > 0);
    const [family] = familiesOnPage();
    expect(family).toMatch(/^graview-view-[a-z0-9]+ Shout$/);
    expect(drawnCss()).toContain(`.title { font-family: "${family}", serif; }`);
    expect(fetched).toEqual([]);
    expect(problems).toEqual([expect.stringMatching(/"Too Big".*more than the 50 KB.*\(view-font-face-size\)\.$/)]);
    /* The view gives the same sheets again, and one more rule: the face is not loaded twice, nor the refusal said twice. */
    style([...sheets, ".x { color: red }"]);
    await wait(50);
    expect(made).toHaveLength(1);
    expect(problems).toHaveLength(1);
    view.dispose();
    expect(fonts.size).toBe(0);
  });

  it("two views that both declare \"Display\" from different bytes draw each its own, and neither names the family the page's own text is in", async () => {
    const first = mounted();
    const second = mounted();
    first.style([sheet("Display", 2_000, 1), ".t { font-family: Display }"]);
    second.style([sheet("Display", 2_000, 2), ".t { font-family: Display }"]);
    await until(() => fonts.size === 2);
    const families = familiesOnPage();
    expect(families).toHaveLength(2);
    expect(families.every((one) => / Display$/.test(one) && one !== "Display")).toBe(true);
    expect(first.drawnCss()).not.toBe(second.drawnCss());
    for (const one of [first, second]) expect(families.some((family) => one.drawnCss().includes(`"${family}"`))).toBe(true);
    first.view.dispose();
    second.view.dispose();
  });

  it("does not load a face named as one the app lends its views: the app's is drawn, the view's rule names it as written, and the host is told with its code", async () => {
    Object.assign(window, { fetch: () => Promise.resolve(new Response(new Uint8Array(64), { headers: { "content-type": "font/woff2" } })) });
    const { view, problems, style, drawnCss } = mounted(() => ({ name: "Offers", views: { fonts: [{ family: "Rock Face", src: `/graview/assets/${"b".repeat(64)}.woff2` }] } }));
    style([sheet("Rock Face"), `.t { font-family: "Rock Face", serif }`]);
    await until(() => problems.length > 0 && fonts.size > 0);
    expect(familiesOnPage()).toEqual(["Rock Face"]);
    expect(problems).toEqual([expect.stringMatching(/"Rock Face".*app's face is the one drawn.*\(view-font-face-lent\)\.$/)]);
    expect(drawnCss()).toContain(`.t { font-family: "Rock Face", serif; }`);
    view.dispose();
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
    const says = judged.ok ? judged.problems.filter((problem) => problem.at === "stylesheet @font-face").map((problem) => problem.says) : [];
    expect(says).toEqual([expect.stringMatching(/"Too Big".*\(view-font-face-size\)\.$/), expect.stringMatching(/"Rock Face".*\(view-font-face-lent\)\.$/)]);
    expect(judged.ok && judged.drawn.css).not.toMatch(/font-face|url/);
    expect(judged.ok && judged.drawn.faces.map((face) => face.family)).toEqual(["Shout"]);
  });
});
