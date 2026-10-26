// @vitest-environment jsdom
import { Store, type AnySchema, type FileValue } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ana, jobsApp, jobsSeed } from "../../../../scripts/fixtures/jobs-app.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { imageRefusedWords } from "../../src/host/open-judge.js";
import { createOpenRenderer } from "../../src/host/open-render.js";
import { createGuestPictures, PICTURE_FETCH_BYTES } from "../../src/host/pictures.js";
import { OPEN_MAX_IMAGE } from "../../src/open-kit.js";
import type { GuestFile, GuestProps } from "../../src/protocol.js";

/*
 * A PICTURES VIEW DRAWS A FULL-SIZE RECORD PHOTO (FR-192, Roadmap
 * f-view-picture-src-large). Maryland Family Weekend's `journey` home view
 * drew its moments while they held 9 KB webps; once they held the
 * phone's own JPEGs (187 KB to 1.5 MB, EXIF and all), the page fetched
 * every one and then refused to draw the very `data:` image it had handed
 * the view: a picture is handed at up to 1 500 000 bytes, and a view's
 * image was cut off at 512 000 characters of `data:` URL. A headless run
 * said nothing, since its stand-in `src` is one pixel.
 *
 * The host now draws whatever it handed a view for a record's picture,
 * at any size, by its own address for it; on a page that will not load
 * its own `blob:` images, the view is still handed a short `blob:` address
 * and the host draws the `data:` image behind it. The cap stays on a
 * `data:` image the view makes itself, and its refusal says so. A headless
 * run says what the page will leave out.
 */
const INSERT = 0;
let ids = 0;
const img = (src: string) => ({ id: `i${(ids += 1)}`, type: 1, element: "img", attributes: { src, alt: "" }, children: [] });

/** A JPEG as a phone writes one: JFIF, then an EXIF APP1 segment, then `size` bytes in all. Only the head is a real JPEG's; the rest is what a canvas would decode. */
function exifJpeg(size: number): Uint8Array<ArrayBuffer> {
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00];
  const head = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x00, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xe1, 0x00, exif.length + 2, ...exif];
  const bytes = new Uint8Array(size);
  bytes.set(head);
  for (let i = head.length; i < size - 2; i += 1) bytes[i] = (i * 31) & 0xff;
  bytes.set([0xff, 0xd9], size - 2);
  return bytes;
}

const MOMENT = "/graview/files/6d1f0c.jpg";
const SIZE = 1_400_000;
const moment = (bytes = SIZE): FileValue => ({ href: MOMENT, name: "IMG_4032.jpg", type: "image/jpeg", bytes, width: 4_032, height: 3_024, caption: "The harbor at dusk" });
const journey: WorkerViewManifest = { name: "journey", title: "Journey", attach: "job", cardinality: "many", pictures: true };
const store = (photo: FileValue = moment()) =>
  new Store({
    schema: jobsApp.schema,
    mutations: [],
    policy: jobsApp.policy!,
    snapshot: { ...structuredClone(jobsSeed), nodes: jobsSeed.nodes.map((node) => (node.id === "job:porch" ? { ...node, photos: [photo] } : node)) } as never,
  }) as unknown as Store<AnySchema>;

/** The host's files route, answering the full-size EXIF JPEG; the canvas cannot make it smaller than it is (a phone photo drawn 2 400 across stays heavy). */
function served() {
  vi.spyOn(window, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === MOMENT) return new Response(exifJpeg(SIZE), { status: 200, headers: { "content-type": "image/jpeg" } });
    return new Response(null, { status: 404 });
  });
}
afterEach(() => vi.restoreAllMocks());
const settled = async () => {
  for (let i = 0; i < 40; i += 1) await new Promise((done) => setTimeout(done, 0));
};
const photo = (props: GuestProps) => ((props.nodes ?? []).find((node) => node.id === "job:porch") as unknown as { photos: GuestFile[] }).photos[0]!;

function hand(as: "blob" | "data") {
  served();
  const live = store();
  const said: string[] = [];
  const pictures = createGuestPictures(window, { as, view: '"Journey"', pictures: true, shrink: async (blob) => blob, moved: () => {}, onLeft: (one) => said.push(one) });
  const all = workerViewProps(live, ana, { manifest: journey });
  pictures.hand(all);
  return { pictures, said, again: () => pictures.hand(all) };
}

function draw(srcs: readonly string[], picture?: (value: string) => string | undefined) {
  const into = document.createElement("div");
  const renderer = createOpenRenderer(into, { origin: "http://localhost:3000", ...(picture ? { picture } : {}) });
  renderer.apply(srcs.map((src, index) => [INSERT, "~", img(src), index]));
  return { srcs: [...into.querySelectorAll("img")].map((one) => one.getAttribute("src")), refused: renderer.refused };
}

describe("a pictures: true view handed a full-size EXIF JPEG", () => {
  it("is handed it, a data: image of the JPEG, JFIF and EXIF APP1 and all", async () => {
    const { again, said } = hand("data");
    await settled();
    const src = photo(again()).src!;
    expect(said).toEqual([]);
    expect(src.startsWith("data:image/jpeg;base64,/9j/4AAQSkZJRg")).toBe(true);
    const head = Buffer.from(src.slice("data:image/jpeg;base64,".length, 80), "base64");
    expect([...head.subarray(20, 22)]).toEqual([0xff, 0xe1]);
    expect(head.subarray(24, 28).toString("latin1")).toBe("Exif");
    expect(src.length).toBeGreaterThan(OPEN_MAX_IMAGE);
  });

  it("has the page draw the src it was handed, however long, as the host made it", async () => {
    const { again, pictures } = hand("data");
    await settled();
    const src = photo(again()).src!;
    const { srcs, refused } = draw([src], pictures.drawn);
    expect(refused).toEqual([]);
    expect(srcs).toEqual([src]);
  });

  it("on a page that will not load its own blob: images, is handed a short blob: address, and the page draws the data: image behind it", async () => {
    let made = 0;
    Object.assign(URL, { createObjectURL: () => `blob:http://localhost:3000/${(made += 1)}`, revokeObjectURL: () => {} });
    /* The page's policy refuses `blob:` images, as Graview Cloud's does. */
    vi.spyOn(window, "Image").mockImplementation(function () {
      const image = { set src(_: string) { queueMicrotask(() => image.onerror?.()); }, onload: undefined, onerror: undefined as undefined | (() => void) };
      return image as never;
    } as never);
    const { again, pictures } = hand("blob");
    await settled();
    const src = photo(again()).src!;
    expect(src).toMatch(/^blob:http:\/\/localhost:3000\/\d+$/);
    const { srcs, refused } = draw([src], pictures.drawn);
    expect(refused).toEqual([]);
    expect(srcs[0]!.startsWith("data:image/jpeg;base64,/9j/")).toBe(true);
    /* Let go, it is drawn no more. */
    pictures.dispose();
    expect(pictures.drawn(src)).toBeUndefined();
  });

  it("is drawn only as handed: a src it changed is judged as any image a view makes", async () => {
    const { again, pictures } = hand("data");
    await settled();
    const src = photo(again()).src!;
    const { srcs, refused } = draw([`${src}AAAA`], pictures.drawn);
    expect(srcs).toEqual([null]);
    expect(refused).toContainEqual(expect.objectContaining({ reason: "url", element: "img", name: "src" }));
  });
});

describe("a data: image a view makes itself", () => {
  const big = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAgEASABIAAD/4QDK${"A".repeat(OPEN_MAX_IMAGE)}`;

  it("is drawn under the cap, an EXIF JPEG as any other", () => {
    const small = `data:image/jpeg;base64,${Buffer.from(exifJpeg(4_000)).toString("base64")}`;
    expect(draw([small]).srcs).toEqual([small]);
  });

  it("is refused past the cap, and the refusal says the cap and the way past it", () => {
    const { refused } = draw([big]);
    const one = refused.find((r) => r.reason === "url")!;
    expect(one.length).toBe(big.length);
    const said = imageRefusedWords(one.address!, {}, one.length);
    expect(said).toContain(`It is a data: image of ${big.length.toLocaleString("en-US")} characters, more than the 512,000 a view's own data: image may be.`);
    expect(said).toContain("A picture on a record is drawn at any size by the src the host hands the view");
  });
});

describe("a headless run of a pictures: true view", () => {
  const source = `graview.onProps((props) => graview.render(graview.html\`\${props.nodes.map((job) => graview.html\`<section><h3>\${job.label}</h3>\${job.photos.map((one) => one.src ? graview.html\`<img src="\${one.src}" alt="\${one.caption || one.name}">\` : graview.html\`<p>\${one.name} \${one.left || ""}</p>\`)}</section>\`)}\`));`;

  it("draws a full-size EXIF JPEG's picture with no problem, as the page now does", async () => {
    const result = await runWorkerViewHeadless({ manifest: journey, source, store: store(), principal: ana, run: nodeIsolate() });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.problems).toEqual([]);
    expect(result.description.text).toContain("The harbor at dusk");
  });

  it("says what the page would leave out: a picture heavier than the host fetches for a view", async () => {
    const result = await runWorkerViewHeadless({ manifest: journey, source, store: store(moment(PICTURE_FETCH_BYTES + 1)), principal: ana, run: nodeIsolate() });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.problems).toContainEqual({ at: "pictures", says: `The picture "IMG_4032.jpg" on "Porch repair" is left out: at ${(PICTURE_FETCH_BYTES + 1).toLocaleString("en-US")} bytes it is more than the host fetches for a view.` });
    expect(photo(result.props).src).toBeUndefined();
    expect(photo(result.props).left).toMatch(/is left out/);
  });

  it("says what the page would leave out past the view's budget for pictures together", async () => {
    const result = await runWorkerViewHeadless({ manifest: journey, source, store: store(), principal: ana, run: nodeIsolate(), limits: { picturesBytes: 100_000 } });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.problems).toContainEqual({ at: "pictures", says: 'The picture "IMG_4032.jpg" on "Porch repair" is left out: the view "Journey" is handed at most 100,000 bytes of pictures, and the pictures before it, in the order its records are handed, took them. A view that draws only some kinds\' pictures says which ("pictures": ["<kind>"]).' });
  });
});
