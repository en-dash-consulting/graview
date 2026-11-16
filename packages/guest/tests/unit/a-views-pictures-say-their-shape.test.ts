// @vitest-environment jsdom
import { isFileValue, type FileValue } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuestPictures, cutoutOf, standInPictures, type PictureLook } from "../../src/host/pictures.js";
import type { GuestFile, GuestProps } from "../../src/protocol.js";

/**
 * A VIEW'S PICTURES SAY THEIR SHAPE (HQ f-view-picture-shape). A view was
 * handed a picture as `{ name, type, bytes, src }`, and cropped a skull at
 * the jaw and a long drawing to a sliver. Now each picture comes with its
 * `width` and `height` — as the record says them, else as the host
 * measured the file it fetched — its `aspect`, whether it is a `cutout`
 * (transparent at its edges, or on one plain color: drawn whole on the
 * view's own ground), and where its subject is (`focus`, as the record
 * keeps it, for `object-position`). A headless run hands what the record
 * says of them, as the page does.
 */
const SIDE = 32;
/** A square of pixels, each as `paint(x, y)` says: [r, g, b, a]. */
const pixels = (paint: (x: number, y: number) => readonly [number, number, number, number]) => {
  const data = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let y = 0; y < SIDE; y += 1) for (let x = 0; x < SIDE; x += 1) data.set(paint(x, y), (y * SIDE + x) * 4);
  return data;
};
const inside = (x: number, y: number, margin: number) => x >= margin && y >= margin && x < SIDE - margin && y < SIDE - margin;

describe("whether a picture is a cutout", () => {
  it("is so for a drawing on transparency, and for one on a plain white ground", () => {
    expect(cutoutOf(pixels((x, y) => (inside(x, y, 6) ? [90, 60, 40, 255] : [0, 0, 0, 0])), SIDE)).toBe(true);
    expect(cutoutOf(pixels((x, y) => (inside(x, y, 3) ? [200, (x * 8) % 255, 30, 255] : [252, 252, 250, 255])), SIDE)).toBe(true);
    /* A product on white with its corners transparent: part clear, the rest plain. */
    expect(cutoutOf(pixels((x, y) => (Math.min(x, SIDE - 1 - x) + Math.min(y, SIDE - 1 - y) < 4 ? [0, 0, 0, 0] : inside(x, y, 3) ? [200, (x * 8) % 255, 30, 255] : [255, 255, 255, 255])), SIDE)).toBe(true);
  });

  it("is not so for a photograph, whose edge is sky above and ground below, nor for a picture opaque to its edge that varies along it", () => {
    expect(cutoutOf(pixels((_x, y) => (y < SIDE / 2 ? [120, 170, 230, 255] : [70, 110, 40, 255])), SIDE)).toBe(false);
    expect(cutoutOf(pixels((x, y) => [(x * 37 + y * 11) % 255, (x * 13) % 255, (y * 29) % 255, 255]), SIDE)).toBe(false);
  });

  it("is not so for a picture with only a corner or two of its edge soft", () => {
    expect(cutoutOf(pixels((x, y) => (x + y < 3 ? [0, 0, 0, 0] : [(x * 37 + y * 11) % 255, (x * 13) % 255, 60, 255])), SIDE)).toBe(false);
  });
});

describe("a record's file", () => {
  it("keeps a focus from 0 to 1 and whether it is a cutout, and refuses either out of shape", () => {
    const file: FileValue = { href: "/graview/files/a.png", name: "a.png", type: "image/png", bytes: 10 };
    expect(isFileValue({ ...file, focus: { x: 0.5, y: 0.2 }, cutout: true })).toBe(true);
    expect(isFileValue({ ...file, focus: { x: 1.5, y: 0.2 } })).toBe(false);
    expect(isFileValue({ ...file, focus: { x: 0.5 } })).toBe(false);
    expect(isFileValue({ ...file, focus: { x: 0.5, y: 0.5, z: 1 } })).toBe(false);
    expect(isFileValue({ ...file, cutout: "yes" })).toBe(false);
  });
});

/** A record with one picture in `photo`, as a view is handed it. */
const holding = (photo: FileValue): GuestProps => ({ view: "fossils", node: { id: "fossil:skull", kind: "fossil", label: "Skull", photo } as never, edges: [], acts: [] }) as unknown as GuestProps;
const photoOf = (props: GuestProps) => (props.node as unknown as { photo: GuestFile }).photo;
const SKULL: FileValue = { href: "/graview/files/skull.png", name: "skull.png", type: "image/png", bytes: 3_000 };

afterEach(() => vi.restoreAllMocks());

/** The pictures' host, its fetch answered with a PNG of `bytes`, and its pixels read as `look` says. */
function handing(look: (blob: Blob) => Promise<PictureLook | undefined>) {
  vi.spyOn(window, "fetch").mockImplementation(async () => new Response(new Uint8Array(3_000), { status: 200, headers: { "content-type": "image/png" } }));
  let moved = 0;
  const looked: Blob[] = [];
  const pictures = createGuestPictures(window, {
    as: "data",
    view: '"Fossils"',
    pictures: { width: 400 },
    shrink: async (blob) => blob,
    look: (blob) => (looked.push(blob), look(blob)),
    moved: () => (moved += 1),
  });
  const settled = async () => {
    for (let i = 0; i < 100 && moved === 0; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  };
  return { pictures, settled, looked };
}

describe("a picture handed to a view", () => {
  it("says the size the host measured, its aspect and that it is a cutout, where the record says none of them", async () => {
    const { pictures, settled } = handing(async () => ({ width: 1_200, height: 1_600, cutout: true }));
    pictures.hand(holding(SKULL));
    await settled();
    const photo = photoOf(pictures.hand(holding(SKULL)));
    expect(photo.src).toMatch(/^data:image\/png;base64,/);
    expect(photo).toMatchObject({ width: 1_200, height: 1_600, aspect: 0.75, cutout: true });
    expect(photo.focus).toBeUndefined();
    pictures.dispose();
  });

  it("says what the record says first — its size, whether it is a cutout and its focus — and reads no pixels where the record says them all", async () => {
    const { pictures, settled, looked } = handing(async () => ({ width: 1, height: 1, cutout: false }));
    const kept = { ...SKULL, width: 900, height: 300, cutout: true, focus: { x: 0.25, y: 0.6 } };
    pictures.hand(holding(kept));
    await settled();
    expect(photoOf(pictures.hand(holding(kept)))).toMatchObject({ width: 900, height: 300, aspect: 3, cutout: true, focus: { x: 0.25, y: 0.6 } });
    expect(looked).toEqual([]);
    pictures.dispose();
  });

  it("says no shape it does not know: a picture whose pixels could not be read keeps what the record says", async () => {
    const { pictures, settled } = handing(async () => undefined);
    pictures.hand(holding(SKULL));
    await settled();
    const photo = photoOf(pictures.hand(holding(SKULL)));
    expect(photo.src).toBeDefined();
    for (const key of ["width", "height", "aspect", "cutout", "focus"]) expect(photo, key).not.toHaveProperty(key);
    pictures.dispose();
  });

  it("is handed alike in a headless run, which reads no pixels: what the record says of its shape", () => {
    const kept = { ...SKULL, width: 900, height: 300, cutout: false, focus: { x: 0.5, y: 0.1 } };
    const run = photoOf(standInPictures(holding(kept), { view: '"Fossils"', pictures: { width: 400 }, standIn: "data:image/png;base64,AA==" }).props);
    expect(run).toMatchObject({ width: 900, height: 300, aspect: 3, cutout: false, focus: { x: 0.5, y: 0.1 } });
  });
});
