// @vitest-environment jsdom
import { Store, type AnySchema, type Principal } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ana, FILES, jobsApp, jobsSeed, sam } from "../../../../scripts/fixtures/jobs-app.js";
import { checkManifest, workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createGuestPictures, PICTURES_SETTLE_MS, type GuestPictureLimits } from "../../src/host/pictures.js";
import { createGuestHost } from "../../src/host/session.js";
import { mountGuestView } from "../../src/host/frame.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { GUEST_PROTOCOL, type GuestFile, type GuestProps, type HostMessage } from "../../src/protocol.js";

/**
 * A GUEST VIEW IS HANDED THE PICTURES IT MAY SHOW (FR-175, FR-162's
 * follow-up). A record keeps a file as a path on the host, which a frame or
 * a worker at an opaque origin cannot load with the reader's credentials.
 * A view whose manifest says `pictures` is handed each file as a
 * `GuestFile` instead: a picture with an address the host made from the
 * bytes it fetched as the reader, a document by its name, type and size —
 * only for records the reader may see, within the host's byte budgets. In
 * a real browser, drawn and made smaller, in Chromium, WebKit and Firefox:
 * `guest-sandbox --transport=pictures`.
 */
const store = () => new Store({ schema: jobsApp.schema, mutations: [], policy: jobsApp.policy!, snapshot: structuredClone(jobsSeed) as never }) as unknown as Store<AnySchema>;
const photos: WorkerViewManifest = { name: "job-photos", title: "Job photos", attach: "job", cardinality: "many", pictures: { width: 400 } };

/** What the host serves at each path: a PNG's first bytes and its type, as the reader's fetch is answered. */
const SERVED: Record<string, { readonly type: string; readonly bytes: number }> = {
  [FILES.porch]: { type: "image/png", bytes: 2_400 },
  [FILES.step]: { type: "image/png", bytes: 300 },
  [FILES.roof]: { type: "image/png", bytes: 300 },
  [FILES.plan]: { type: "image/svg+xml", bytes: 200 },
  [FILES.quote]: { type: "application/pdf", bytes: 1_800 },
};

let fetched: string[] = [];
let shrunk: { width: number; bytes: number; size: number }[] = [];
afterEach(() => vi.restoreAllMocks());

/** The page's fetch, answering from SERVED, and the canvas, shrinking a picture to a tenth of its bytes. */
function page(shrinkTo: (size: number) => number = (size) => Math.ceil(size / 10)) {
  fetched = [];
  shrunk = [];
  vi.spyOn(window, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    fetched.push(path);
    const served = SERVED[path];
    if (!served) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(served.bytes), { status: 200, headers: { "content-type": served.type } });
  });
  return async (blob: Blob, width: number, bytes: number) => {
    shrunk.push({ width, bytes, size: blob.size });
    return new Blob([new Uint8Array(shrinkTo(blob.size))], { type: blob.type });
  };
}

/** The view's host, pushing to a list: every props message it was sent, the last one first in `last()`. */
function host(principal: Principal, manifest: WorkerViewManifest, limits?: GuestPictureLimits, shrinkTo?: (size: number) => number) {
  const shrink = page(shrinkTo);
  const said: string[] = [];
  const sent: GuestProps[] = [];
  const live = store();
  let session: ReturnType<typeof createGuestHost> | undefined;
  const pictures = manifest.pictures ? createGuestPictures(window, { as: "data", view: `"${manifest.title ?? manifest.name}"`, pictures: manifest.pictures, ...(limits ? { limits } : {}), shrink, moved: () => session?.push(), onLeft: (one) => said.push(one) }) : undefined;
  session = createGuestHost({
    store: live,
    principal,
    view: manifest.name,
    nonce: "n",
    send: (message: HostMessage) => {
      if (message.type === "props") sent.push(message.props);
    },
    props: () => workerViewProps(live, principal, { manifest }),
    ...(pictures ? { hand: pictures.hand } : {}),
  });
  session.push();
  return { sent, said, last: () => sent[sent.length - 1]!, pictures };
}

/* Every fetch answered, and the push for the pictures that settled after the first, which waits out the span pushes go together in (FR-207). */
const settled = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
  await new Promise((done) => setTimeout(done, PICTURES_SETTLE_MS));
};
const job = (props: GuestProps, id: string) => (props.nodes ?? []).find((node) => node.id === id) as unknown as { photos: GuestFile[]; papers?: GuestFile[] } | undefined;

describe("a view that asks for pictures", () => {
  it("is handed each picture as an address the host made from the bytes, never the host's path", async () => {
    const { last } = host(sam, photos);
    await settled();
    const porch = job(last(), "job:porch")!;
    expect(porch.photos.map((one) => one.name)).toEqual(["porch.png", "step.png", "plan.svg"]);
    expect(porch.photos[0]!.src).toMatch(/^data:image\/png;base64,/);
    expect(porch.photos[1]!.src).toMatch(/^data:image\/png;base64,/);
    expect(porch.photos[0]).toMatchObject({ name: "porch.png", type: "image/png", bytes: 2_400, width: 1_600, height: 1_000, caption: "The porch before" });
    expect(JSON.stringify(last())).not.toContain("/graview/files/");
    expect(JSON.stringify(last())).not.toContain("href");
  });

  it("is pushed again when a picture is ready: the first push has it without its address", async () => {
    const { sent } = host(sam, photos);
    expect(job(sent[0]!, "job:porch")!.photos[0]!.src).toBeUndefined();
    expect(job(sent[0]!, "job:porch")!.photos[0]!.left).toBeUndefined();
    await settled();
    expect(sent.length).toBeGreaterThan(1);
  });

  it("is handed a document, and an SVG, as its name, type and size alone, and never has it fetched", async () => {
    const { last } = host(sam, photos);
    await settled();
    const porch = job(last(), "job:porch")!;
    expect(porch.papers).toEqual([{ name: "quote.pdf", type: "application/pdf", bytes: 1_800 }]);
    expect(porch.photos[2]).toEqual({ name: "plan.svg", type: "image/svg+xml", bytes: 200 });
    expect(fetched).not.toContain(FILES.quote);
    expect(fetched).not.toContain(FILES.plan);
  });

  it("fetches only the files on records the reader may see: Ana's view never asks for the roof's photograph", async () => {
    const { last } = host(ana, photos);
    await settled();
    expect((last().nodes ?? []).map((node) => node.id)).toEqual(["job:porch"]);
    expect(fetched.sort()).toEqual([FILES.porch, FILES.step].sort());
    expect(JSON.stringify(last())).not.toContain("roof");
  });

  it("makes a picture wider than the view draws one smaller, to the view's width", async () => {
    const { last } = host(sam, photos);
    await settled();
    /* The porch is 1 600 pixels across and the view draws a picture at 400: made smaller. The step is 40 across and light: handed as it is. */
    expect(shrunk).toEqual([{ width: 400, bytes: 1_500_000, size: 2_400 }]);
    const porch = job(last(), "job:porch")!.photos[0]!;
    expect(atob(porch.src!.split(",")[1]!).length).toBe(240);
  });

  it("leaves out a picture heavier than one may be, saying why in the view's words", async () => {
    const { last, said } = host(sam, photos, { pictureBytes: 1_000 }, (size) => size);
    await settled();
    const porch = job(last(), "job:porch")!.photos[0]!;
    expect(porch.src).toBeUndefined();
    expect(porch.left).toBe('The picture "porch.png" on "Porch repair" is left out: made as small as the 400 pixels across the view "Job photos" draws a picture at, it is still more than the 1,000 bytes one picture is handed.');
    expect(said).toContain(porch.left);
    expect(job(last(), "job:porch")!.photos[1]!.src).toMatch(/^data:/);
  });

  it("leaves out what comes past the view's budget, without fetching it, saying why in the view's words", async () => {
    const { last, said } = host(sam, photos, { picturesBytes: 500 });
    await settled();
    const porch = job(last(), "job:porch")!.photos;
    const roof = job(last(), "job:roof")!.photos;
    /*
     * The porch is reckoned at 150 bytes drawn a quarter as wide, so it and
     * the step (300) are fetched; the roof, past 500 with them, never is.
     * Made, the porch is 240 bytes, and the step no longer fits beside it.
     */
    expect(fetched).not.toContain(FILES.roof);
    expect(porch[0]!.src).toMatch(/^data:/);
    expect(porch[1]!.src).toBeUndefined();
    expect(porch[1]!.left).toBe('The picture "step.png" on "Porch repair" is left out: the view "Job photos" is handed at most 500 bytes of pictures, and the pictures before it took them.');
    expect(roof[0]!.left).toMatch(/^The picture "roof.png" on "Roof survey" is left out: the view "Job photos" is handed at most 500 bytes/);
    expect(said.length).toBeGreaterThanOrEqual(2);
  });

  it("says a picture it could not load could not be loaded, naming the view", async () => {
    SERVED[FILES.step] = { type: "text/html", bytes: 10 };
    try {
      const { last, said } = host(sam, photos);
      await settled();
      const step = job(last(), "job:porch")!.photos[1]!;
      expect(step.src).toBeUndefined();
      expect(step.left).toBe('The picture "step.png" on "Porch repair" could not be loaded for the view "Job photos": the host answered text/html, not a picture. A host that serves the app under a base says where a record\'s files are (file, on the view\'s definition).');
      expect(said).toContain(step.left);
    } finally {
      SERVED[FILES.step] = { type: "image/png", bytes: 300 };
    }
  });

  it("hands a worker view a blob: URL of the page, and lets it go when no record handed holds the picture, or the view goes", async () => {
    const shrink = page();
    let made = 0;
    const revoked: string[] = [];
    /* jsdom has no object URLs: the page's are said here. */
    Object.assign(URL, { createObjectURL: () => `blob:http://localhost:3000/${(made += 1)}`, revokeObjectURL: (url: string) => void revoked.push(url) });
    /* The page's policy lets a `blob:` image load. */
    vi.spyOn(window, "Image").mockImplementation(function () {
      const image = { set src(_: string) { queueMicrotask(() => image.onload?.()); }, onload: undefined as undefined | (() => void), onerror: undefined };
      return image as never;
    } as never);
    const live = store();
    const pictures = createGuestPictures(window, { as: "blob", view: '"Job photos"', pictures: { width: 400 }, shrink, moved: () => {} });
    const all = workerViewProps(live, sam, { manifest: photos });
    pictures.hand(all);
    await settled();
    const handed = pictures.hand(all);
    const roof = job(handed, "job:roof")!.photos[0]!.src!;
    expect(roof).toMatch(/^blob:http:\/\/localhost:3000\//);
    pictures.hand({ ...all, nodes: (all.nodes ?? []).filter((node) => node.id !== "job:roof") });
    expect(revoked).toEqual([roof]);
    pictures.dispose();
    expect(revoked.length).toBe(3);
  });
});

describe("a frame whose host asks for pictures", () => {
  it("is answered once their host has arrived, and handed each picture as a data: image, never a path", async () => {
    page();
    const element = document.createElement("div");
    document.body.appendChild(element);
    const frame = mountGuestView(element, { url: "https://jobs.example/photos.html", view: "photos", title: "Job photos", store: store(), principal: ana, input: () => ({ nodes: [{ id: "job:porch" }, { id: "job:roof" }] }), pictures: { width: 400 } });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
    await vi.waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
    const port = (posted.mock.calls[0] as unknown as [unknown, string, MessagePort[]])[2][0]!;
    const heard: GuestProps[] = [];
    port.onmessage = (event) => {
      if ((event.data as HostMessage).type === "props") heard.push((event.data as { props: GuestProps }).props);
    };
    await vi.waitFor(() => expect(heard.some((props) => typeof job(props, "job:porch")?.photos[1]?.src === "string")).toBe(true));
    const last = heard[heard.length - 1]!;
    expect(job(last, "job:porch")!.photos[1]!.src).toMatch(/^data:image\/png;base64,/);
    expect(job(last, "job:roof")).toBeUndefined();
    for (const props of heard) expect(JSON.stringify(props)).not.toContain("/graview/files/");
    expect(fetched).not.toContain(FILES.roof);
    port.close();
    frame.dispose();
  });
});

describe("a view that does not ask", () => {
  it("is handed each file as the record keeps it, and nothing is fetched", async () => {
    const { last } = host(sam, { ...photos, pictures: undefined } as WorkerViewManifest);
    await settled();
    const porch = job(last(), "job:porch") as unknown as { photos: { href: string }[] };
    expect(porch.photos[0]!.href).toBe(FILES.porch);
    expect(fetched).toEqual([]);
  });

  it("speaks the same protocol: GUEST_PROTOCOL does not move", () => {
    expect(GUEST_PROTOCOL).toBe(1);
  });
});

describe("the manifest's pictures", () => {
  it("is true, or a width in pixels from 16 to 4096", () => {
    const live = store();
    expect(checkManifest(photos, live)).toEqual([]);
    expect(checkManifest({ ...photos, pictures: true }, live)).toEqual([]);
    expect(checkManifest({ ...photos, pictures: { width: 8 } }, live)).toEqual(["The view's pictures width is a whole number of pixels from 16 to 4096."]);
    expect(checkManifest({ ...photos, pictures: "yes" as never }, live)[0]).toMatch(/pictures is true, or/);
    expect(checkManifest({ ...photos, pictures: { width: 400, height: 300 } as never }, live)).toEqual(['The view\'s pictures says "height": only "width" is read.']);
  });

  it("headless, hands each file without the host's path", async () => {
    const result = await runWorkerViewHeadless({
      manifest: photos,
      source: `graview.onProps((props) => graview.render(graview.html\`<ul>\${props.nodes.map((job) => graview.html\`<li>\${job.label}: \${job.photos.map((one) => one.name + (one.href ? " at " + one.href : "")).join(", ")}</li>\`)}</ul>\`));`,
      store: store(),
      principal: ana,
      run: nodeIsolate(),
    });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.text).toContain("Porch repair: porch.png, step.png, plan.svg");
    expect(result.description.text).not.toContain("/graview/files/");
    expect(result.description.text).not.toContain("Roof");
  });
});
