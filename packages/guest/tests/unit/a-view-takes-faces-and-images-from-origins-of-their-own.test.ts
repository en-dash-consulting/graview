// @vitest-environment jsdom
import { createSchema, defineNode, Store, z, type AnySchema, type Principal } from "@graview/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountWorkerView, type MountWorkerViewOptions } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/*
 * A VIEW TAKES FACES AND IMAGES FROM ORIGINS OF THEIR OWN (Graview HQ
 * f-view-font-origins-apart-from-images). A face the app lends its views
 * (`brand.views.fonts`) at an `https:` address loads from an origin the host
 * lists in `fonts.origins`; a view's `<img>` from one it lists in
 * `images.origins`. Each list says one thing: an origin listed for faces
 * admits no image, and one listed for images admits no face.
 */
const GSTATIC = ["https://fonts.gstatic.com"];
const FREDOKA = { family: "Fredoka", src: "https://fonts.gstatic.com/s/fredoka.woff2" };
const PICTURE = "https://fonts.gstatic.com/s/picture.png";

let fonts: Set<unknown>;
class FakeFontFace {
  readonly status = "unloaded";
  constructor(readonly family: string) {}
  load() {
    return Promise.resolve(this);
  }
}
beforeEach(() => {
  fonts = new Set();
  /* The host fetches a face's file itself, to hold it to its size (a-lent-face-past-its-size-is-not-loaded). */
  Object.assign(window, { FontFace: FakeFontFace, fetch: () => Promise.resolve(new Response(new Uint8Array(64))) });
  Object.defineProperty(document, "fonts", { value: { add: (face: unknown) => fonts.add(face), delete: (face: unknown) => fonts.delete(face) }, configurable: true });
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

const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars", label: (node) => node.label });
const store = () => new Store<AnySchema>({ schema: createSchema([car]) as AnySchema, mutations: [], policy: { grants: [] }, snapshot: { nodes: [{ id: "car:golf", kind: "car", label: "Golf" }], edges: [] } as never });
const reader: Principal = { kind: "human", id: "u:reader" };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

/** The view on a page, dressed in a brand lending Fredoka from fonts.gstatic.com, drawing one image from that origin. */
async function onThePage(extra: Partial<MountWorkerViewOptions<AnySchema>>) {
  const problems: string[] = [];
  const view = mountWorkerView(document.body.appendChild(document.createElement("div")), {
    manifest: { name: "card", attach: "car", cardinality: "one" },
    worker: { script: "/* the view */" },
    store: store(),
    principal: reader,
    input: () => ({ node: { id: "car:golf" } }),
    brand: () => ({ name: "Cars", views: { fonts: [FREDOKA] } }),
    onProblem: (said) => problems.push(said),
    ...extra,
  });
  live.push(view);
  const worker = FakeWorker.made.at(-1)!;
  worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
  const hello = worker.posted[0]!.message as HostHello;
  const port = worker.posted[0]!.transfer[0] as MessagePort;
  let pushed = false;
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number; push?: number };
    if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
    if (data.type === "props" && typeof data.push === "number") {
      pushed = true;
      port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 1 });
    }
  };
  for (let i = 0; i < 50 && !pushed; i += 1) await wait(10);
  port.postMessage({ type: "render", nonce: hello.nonce, records: [[0, "~", { id: "x1", type: 1, element: "img", attributes: { id: "picture", src: PICTURE, alt: "" }, children: [] }, 0]] });
  for (let i = 0; i < 50 && !view.shadow.querySelector("#picture"); i += 1) await wait(10);
  for (let i = 0; i < 20 && fonts.size === 0 && !problems.some((said) => said.includes("Fredoka")); i += 1) await wait(10);
  await wait(20);
  return { src: view.shadow.querySelector("#picture")?.getAttribute("src") ?? null, problems };
}

describe("a face lent to a view and a view's image", () => {
  it("a face loads from an origin the host lists in fonts.origins", async () => {
    const { problems } = await onThePage({ fonts: { origins: GSTATIC } });
    expect(fonts.size).toBe(1);
    expect(problems.some((said) => said.includes("Fredoka"))).toBe(false);
  });

  it("an origin listed only in images.origins admits no face, and the refusal names fonts.origins", async () => {
    const { problems } = await onThePage({ images: { origins: GSTATIC } });
    expect(fonts.size).toBe(0);
    expect(problems).toContainEqual(expect.stringContaining("is no origin this host lists for the faces its views are lent (`fonts.origins`)"));
  });

  it("an origin listed only in fonts.origins admits no <img> from it", async () => {
    const { src, problems } = await onThePage({ fonts: { origins: GSTATIC } });
    expect(src).toBeNull();
    expect(problems).toContainEqual(expect.stringContaining(`"${PICTURE}" was not drawn`));
  });

  it("an origin in both lists admits a face and an image", async () => {
    const { src } = await onThePage({ fonts: { origins: GSTATIC }, images: { origins: GSTATIC } });
    expect(fonts.size).toBe(1);
    expect(src).toBe(PICTURE);
  });
});
