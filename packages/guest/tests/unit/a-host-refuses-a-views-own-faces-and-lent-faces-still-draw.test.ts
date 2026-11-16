// @vitest-environment jsdom
import { Store } from "@graview/core";
import { sanitizeStylesheets, viewFaceRefusedWords } from "@graview/core/css";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { judgeTranscript } from "../../src/headless/judge.js";
import { mountWorkerView } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/**
 * A HOST REFUSES A VIEW'S OWN FACES, AND THE FACES THE APP LENDS STILL DRAW
 * (HQ f-host-turns-off-view-faces). A host that lends its views only the web
 * fonts it lists (Graview Cloud, 2026-11-11) says `ownFaces: false`: each
 * `@font-face` a view's own stylesheet declares as a `data:` font is
 * refused, said to the view's author by its family and what
 * a view is drawn in instead, and none is loaded; the rest of the sheet is
 * drawn as it would be, and the faces the app lends (`brand.views.fonts`)
 * are loaded as before. Without it, a view's own faces draw as they did.
 */
const fontData = (size: number, fill = 7) => {
  const bytes = Buffer.alloc(size, fill);
  bytes.write("wOF2", 0, "latin1");
  return `url(data:font/woff2;base64,${bytes.toString("base64")})`;
};
const sheet = (family: string, size = 2_000) => `@font-face { font-family: "${family}"; src: ${fontData(size)} format("woff2"); font-weight: 700 }`;

let fonts: Set<unknown>;
class FakeFontFace {
  readonly status = "unloaded";
  constructor(readonly family: string, readonly source: unknown, readonly descriptors: Record<string, string>) {}
  load() {
    return Promise.resolve(this);
  }
}
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
beforeEach(() => {
  fonts = new Set();
  Object.assign(window, { FontFace: FakeFontFace, fetch: () => Promise.resolve(new Response(new Uint8Array(64), { headers: { "content-type": "font/woff2" } })) });
  Object.defineProperty(document, "fonts", { value: { add: (face: unknown) => fonts.add(face), delete: (face: unknown) => fonts.delete(face) }, configurable: true });
});
afterEach(() => {
  FakeWorker.made = [];
  document.body.replaceChildren();
});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (test: () => boolean) => {
  for (let i = 0; i < 100 && !test(); i += 1) await wait(10);
};
const familiesOnPage = () => [...fonts].map((one) => (one as FakeFontFace).family).sort();
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const LENDS = () => ({ name: "Offers", views: { fonts: [{ family: "Rock Face", src: `/graview/assets/${"b".repeat(64)}.woff2` }] } });

/** A view past its ready, dressed in a brand that lends "Rock Face", its own faces drawn or not as `ownFaces` says. */
function mounted(ownFaces?: boolean) {
  const problems: string[] = [];
  const codes: string[] = [];
  const view = mountWorkerView(document.body.appendChild(document.createElement("div")), {
    manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many" },
    worker: { script: "/* the view */" },
    store: store(),
    principal: lin,
    limits: { silentMs: 5_000 },
    brand: LENDS,
    asset: (path: string) => path,
    ...(ownFaces !== undefined ? { ownFaces } : {}),
    onProblem: (said, problem) => {
      problems.push(said);
      codes.push(problem.code);
    },
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
  return { view, problems, codes, style, drawnCss };
}

describe("a view's own faces, where its host refuses them", () => {
  it("are refused by the open kit, each by its family, none kept, and the rest of the sheet judged as it would be, a large face not making it too long", () => {
    const sheets = [`${sheet("Shout")}\n${sheet("Large", 45_000)}\n.title { font-family: Shout, serif; color: red }`];
    const judged = sanitizeStylesheets(sheets, undefined, { faces: { scope: "gv-a", refused: true } });
    expect(judged.faces).toEqual([]);
    expect(judged.refused.filter((one) => one.reason === "font-face")).toEqual([
      { reason: "font-face", name: "host", family: "Shout" },
      { reason: "font-face", name: "host", family: "Large" },
    ]);
    expect(judged.refused.some((one) => one.reason === "size")).toBe(false);
    expect(judged.css).toContain(".title { font-family: Shout, serif; color: red; }");
    expect(judged.css).not.toMatch(/font-face|data:/);
    expect(viewFaceRefusedWords(judged.refused[0]!)).toBe(
      'Not loaded: the @font-face "Shout". This host draws no face a view\'s own stylesheet declares: a view is drawn in the faces the app lends its views (brand.views.fonts), or in a system stack (view-font-face-host).',
    );
  });

  it("are not loaded into the page and are said to the host once each, while the face the app lends is loaded and drawn", async () => {
    const { view, problems, codes, style, drawnCss } = mounted(false);
    style([sheet("Shout"), `.title { font-family: Shout, serif }\n.lent { font-family: "Rock Face", serif }`]);
    await until(() => problems.length > 0 && fonts.size > 0);
    await wait(30);
    expect(familiesOnPage()).toEqual(["Rock Face"]);
    expect(problems).toEqual([expect.stringMatching(/^Not loaded: the @font-face "Shout"\. This host draws no face.*\(view-font-face-host\)\.$/)]);
    expect(codes).toEqual(["own-face-refused"]);
    expect(drawnCss()).toContain(".title { font-family: Shout, serif; }");
    expect(drawnCss()).toContain('.lent { font-family: "Rock Face", serif; }');
    /* The same sheets again: said once. */
    style([sheet("Shout"), `.title { font-family: Shout, serif }`]);
    await wait(50);
    expect(problems).toHaveLength(1);
    view.dispose();
  });

  it("draw as before where the host says nothing, or says true", async () => {
    for (const ownFaces of [undefined, true]) {
      fonts.clear();
      const { view, problems, style, drawnCss } = mounted(ownFaces);
      style([sheet("Shout"), ".title { font-family: Shout, serif }"]);
      await until(() => fonts.size === 2);
      const families = familiesOnPage();
      expect(families[0]).toBe("Rock Face");
      expect(families[1]).toMatch(/^graview-view-[a-z0-9]+ Shout$/);
      expect(drawnCss()).toContain(`.title { font-family: "${families[1]}", serif; }`);
      expect(problems).toEqual([]);
      view.dispose();
    }
  });

  it("are refused in a headless run as on the page, where the run says the host refuses them", () => {
    const run = (ownFaces?: boolean) =>
      judgeTranscript(
        { renders: [], asked: [], went: [], ms: 1, logs: [], messages: 1, sheets: [sheet("Shout")] },
        { props: {} as never, acts: [], places: [], limits: { maxNodes: 100, messages: 100, pushMs: 1_000 } },
        ownFaces === undefined ? {} : { ownFaces },
      );
    const refused = run(false);
    expect(refused.ok && refused.drawn.faces).toEqual([]);
    expect(refused.ok && refused.problems.filter((problem) => problem.at === "stylesheet @font-face").map((problem) => problem.says)).toEqual([expect.stringMatching(/\(view-font-face-host\)\.$/)]);
    const drawn = run();
    expect(drawn.ok && drawn.drawn.faces.map((face) => face.family)).toEqual(["Shout"]);
  });
});
