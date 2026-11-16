// @vitest-environment jsdom
import { createSchema, defineNode, imageField, Store, z, type AnySchema } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createGuestPictures, PICTURES_SETTLE_MS, standInPictures, type GuestPictures, type PictureLook, type ThumbCrop } from "../../src/host/pictures.js";
import { cropAround, THUMB_REFUSED, THUMB_SHAPE_REFUSED } from "../../src/host/picture-thumb.js";
import type { GuestFile, GuestProps } from "../../src/protocol.js";

/**
 * A VIEW'S THUMB IS CROPPED AROUND THE PICTURE'S FOCUS (Graview HQ
 * f-picture-thumb-around-focus, the fourth ask of f-view-picture-shape). A
 * grid of square tiles asked for `thumb: 240` and was handed each picture
 * made smaller and nothing more, so a tile cropped it at its middle and a
 * skull high in a tall drawing lost its jaw. `thumb: { width, aspect }`
 * hands a thumb cropped to that shape around the picture's `focus` — its
 * middle where the record says none — and the whole picture for a cutout,
 * which a view draws whole.
 */
const fossil = defineNode("fossil", { fields: z.object({ label: z.string(), photo: imageField().optional() }), plural: "Fossils", label: (node) => node.label });
const store = () => new Store({ schema: createSchema([fossil]), mutations: [] }) as unknown as Store<AnySchema>;
const grid = (pictures: GuestPictures): WorkerViewManifest => ({ name: "grid", attach: "home", cardinality: "many", reads: { kinds: ["fossil"] }, pictures });
const photo = (name: string, more: Record<string, unknown> = {}) => ({ href: `/graview/files/${name}.jpg`, name: `${name}.jpg`, type: "image/jpeg", bytes: 200_000, width: 2_000, height: 3_000, ...more });
const holding = (...photos: ReturnType<typeof photo>[]) =>
  ({ view: "grid", edges: [], acts: [], nodes: photos.map((one, index) => ({ id: `fossil:${index}`, kind: "fossil", label: one.name, photo: one })) }) as unknown as GuestProps;
const fileOf = (props: GuestProps, index: number) => (props.nodes ?? [])[index]!["photo"] as unknown as GuestFile;

describe("the part of a picture a thumb of a shape shows", () => {
  it("is as much as the shape holds, its middle at the focus", () => {
    // A tall drawing, 2 000 by 3 000, cropped square around a skull a fifth of the way down.
    expect(cropAround(2_000, 3_000, 1, { x: 0.5, y: 0.4 })).toEqual({ x: 0, y: 200, width: 2_000, height: 2_000 });
    // A wide photo, 4 000 by 3 000, cropped square around a face to the left.
    expect(cropAround(4_000, 3_000, 1, { x: 0.3, y: 0.5 })).toEqual({ x: 0, y: 0, width: 3_000, height: 3_000 });
    expect(cropAround(4_000, 3_000, 1, { x: 0.6, y: 0.5 })).toEqual({ x: 900, y: 0, width: 3_000, height: 3_000 });
  });

  it("stays within the picture where the focus is near its edge, and is its middle where none is said", () => {
    expect(cropAround(2_000, 3_000, 1, { x: 0.5, y: 0.05 })).toEqual({ x: 0, y: 0, width: 2_000, height: 2_000 });
    expect(cropAround(2_000, 3_000, 1, { x: 0.5, y: 0.98 })).toEqual({ x: 0, y: 1_000, width: 2_000, height: 2_000 });
    expect(cropAround(2_000, 3_000, 1)).toEqual({ x: 0, y: 500, width: 2_000, height: 2_000 });
    expect(cropAround(1_600, 900, 16 / 9)).toEqual({ x: 0, y: 0, width: 1_600, height: 900 });
  });
});

describe("the check of a thumb of a shape", () => {
  const said = (pictures: GuestPictures) => checkManifest(grid(pictures), store());
  it("passes a width narrower than the view's, with an aspect from 0.1 to 10 or none", () => {
    expect(said({ width: 800, thumb: { width: 240, aspect: 1 } })).toEqual([]);
    expect(said({ thumb: { width: 320, aspect: 16 / 9 } })).toEqual([]);
    expect(said({ thumb: { width: 320 } })).toEqual([]);
  });

  it("refuses one out of shape, in its own words (view-pictures-thumb)", () => {
    for (const thumb of [{ width: 240, aspect: 0 }, { width: 240, aspect: 12 }, { width: 240, aspect: "square" }, { width: 5_000, aspect: 1 }, { aspect: 1 }, { width: 240, aspect: 1, focus: "top" }]) {
      expect(said({ width: 1_200, thumb } as never), JSON.stringify(thumb)).toEqual([THUMB_SHAPE_REFUSED]);
    }
    expect(said({ thumb: 8 })).toEqual([THUMB_REFUSED]);
  });
});

describe("a grid of square tiles that asks for a thumb of a shape", () => {
  afterEach(() => vi.restoreAllMocks());

  /** The pictures' host, run until what it fetched has settled, each thumb it was asked for written down. */
  async function settled(pictures: GuestPictures, props: GuestProps, bytes = (across: number) => across, look: () => Promise<PictureLook | undefined> = async () => undefined) {
    vi.spyOn(window, "fetch").mockImplementation(async () => new Response(new Uint8Array(1_000), { status: 200, headers: { "content-type": "image/jpeg" } }));
    const asked: { readonly across: number; readonly crop: ThumbCrop | undefined }[] = [];
    const host = createGuestPictures(window, {
      as: "data",
      view: '"grid"',
      pictures,
      moved: () => {},
      look,
      shrink: async (_blob, across, _most, crop) => {
        asked.push({ across, crop });
        return new Blob([new Uint8Array(bytes(across))], { type: "image/jpeg" });
      },
    });
    host.hand(props);
    for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
    await new Promise((done) => setTimeout(done, PICTURES_SETTLE_MS));
    return { host, asked, props: host.hand(props) };
  }

  it("is handed each thumb cropped to that shape around its focus, or its middle where the record says none", async () => {
    const pictures: GuestPictures = { width: 800, thumb: { width: 240, aspect: 1 } };
    const { host, asked, props } = await settled(pictures, holding(photo("skull", { focus: { x: 0.5, y: 0.2 } }), photo("shell")));
    expect(asked.filter((one) => one.across === 240).map((one) => one.crop)).toEqual([
      { aspect: 1, focus: { x: 0.5, y: 0.2 } },
      { aspect: 1, focus: { x: 0.5, y: 0.5 } },
    ]);
    expect(fileOf(props, 0).thumb).toBeDefined();
    expect(fileOf(props, 0).thumb).not.toBe(fileOf(props, 0).src);
    host.dispose();
  });

  it("is handed a cutout whole, made smaller and never cropped", async () => {
    const pictures: GuestPictures = { width: 800, thumb: { width: 240, aspect: 1 } };
    const { host, asked, props } = await settled(pictures, holding(photo("ammonite", { cutout: true, focus: { x: 0.5, y: 0.2 } })));
    expect(asked.filter((one) => one.across === 240)).toEqual([{ across: 240, crop: undefined }]);
    expect(fileOf(props, 0).thumb).toBeDefined();
    host.dispose();
  });

  it("is handed a cutout the host reads off its pixels whole too, where the record does not say it is one", async () => {
    const pictures: GuestPictures = { width: 800, thumb: { width: 240, aspect: 1 } };
    const drawing = { ...photo("trilobite"), width: undefined, height: undefined };
    const { host, asked } = await settled(pictures, holding(drawing as never), undefined, async () => ({ width: 2_000, height: 3_000, cutout: true }));
    expect(asked.filter((one) => one.across === 240)).toEqual([{ across: 240, crop: undefined }]);
    host.dispose();
  });

  it("is handed the crop of a picture no wider than the thumb, which is its own picture, not src again", async () => {
    const pictures: GuestPictures = { thumb: { width: 240, aspect: 1 } };
    const narrow = photo("tooth", { width: 200, height: 400, bytes: 20_000 });
    const { host, asked, props } = await settled(pictures, holding(narrow), () => 2_000);
    expect(asked.map((one) => one.crop)).toContainEqual({ aspect: 1, focus: { x: 0.5, y: 0.5 } });
    expect(fileOf(props, 0).thumb).toBeDefined();
    host.dispose();
  });

  it("is handed a thumb a width alone asks for as before: made smaller, never cropped", async () => {
    const { host, asked } = await settled({ width: 800, thumb: { width: 240 } }, holding(photo("skull", { focus: { x: 0.5, y: 0.2 } })));
    expect(asked.filter((one) => one.across === 240)).toEqual([{ across: 240, crop: undefined }]);
    host.dispose();
  });

  it("is handed a thumb in a headless run as the page hands one, a cutout no wider than the thumb reckoned once", () => {
    const pictures: GuestPictures = { thumb: { width: 240, aspect: 1 } };
    const run = standInPictures(holding(photo("skull"), photo("ammonite", { width: 200, height: 200, cutout: true })), { view: '"grid"', pictures, standIn: "data:image/gif;base64,AA==" }).props;
    expect(fileOf(run, 0).thumb).toBe("data:image/gif;base64,AA==");
    expect(fileOf(run, 1).thumb).toBeUndefined();
  });
});
