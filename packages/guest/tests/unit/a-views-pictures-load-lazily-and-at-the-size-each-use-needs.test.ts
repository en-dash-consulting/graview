// @vitest-environment jsdom
import { createSchema, defineNode, imageField, Store, z, type AnySchema, type Principal } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sayRefusal } from "../../src/headless/judge.js";
import { checkManifest, workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { judgeAttribute } from "../../src/host/open-judge.js";
import { createGuestPictures, PICTURES_SETTLE_MS, standInPictures, type GuestPictures } from "../../src/host/pictures.js";
import type { GuestFile, GuestProps } from "../../src/protocol.js";

/**
 * A VIEW'S PICTURES LOAD LAZILY AND AT THE SIZE EACH USE NEEDS (Roadmap
 * f-view-pictures-load-lazily-and-small). A home that draws sixty record
 * photos asked for each at the width of its hero, and every `<img>` loaded at
 * once: `loading` was refused. An `<img>` now takes `loading` ("lazy" or
 * "eager") and `fetchpriority` ("high", "low" or "auto"), and a manifest may
 * ask for a second, smaller size (`pictures.thumb`): each picture then comes
 * with `thumb` beside `src`, both reckoned against the view's budget.
 */
const moment = defineNode("moment", { fields: z.object({ label: z.string(), photo: imageField().optional() }), plural: "Moments", label: (node) => node.label });
const schema = createSchema([moment]);
/* Each photo as the record says it: 2 MB, 4 000 pixels across. */
const photo = (index: number, bytes = 2_000_000) => ({ href: `/graview/files/moment-${index}.jpg`, name: `moment-${index}.jpg`, type: "image/jpeg", bytes, width: 4_000, height: 3_000 });
const MOMENTS = 60;
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: Array.from({ length: MOMENTS }, (_, index) => ({ id: `moment:${index}`, kind: "moment", label: `Moment ${index}`, photo: photo(index) })), edges: [] } as never,
  }) as unknown as Store<AnySchema>;
const viewer: Principal = { kind: "human", id: "person:nick", roles: [] };
const home = (pictures: GuestPictures): WorkerViewManifest => ({ name: "home", attach: "home", cardinality: "many", reads: { kinds: ["moment"] }, pictures });
const propsOf = (manifest: WorkerViewManifest) => workerViewProps(store(), viewer, { manifest, input: {} });
const fileOf = (props: GuestProps, id: string) => (props.nodes ?? []).find((node) => node.id === id)!["photo"] as unknown as GuestFile;

describe("an <img> in a view", () => {
  const context = { origin: "http://localhost" };
  it('takes loading "lazy" or "eager", and fetchpriority "high", "low" or "auto"', () => {
    for (const value of ["lazy", "eager", "LAZY"]) expect(judgeAttribute("html", "img", "loading", value, context)).toEqual({ name: "loading", value: value.toLowerCase() });
    for (const value of ["high", "low", "auto"]) expect(judgeAttribute("html", "img", "fetchpriority", value, context)).toEqual({ name: "fetchpriority", value });
  });

  it("refuses any other value, saying the ones it takes", () => {
    const loading = judgeAttribute("html", "img", "loading", "soon", context);
    expect(loading).toEqual({ refused: { reason: "value", element: "img", name: "loading" } });
    expect(sayRefusal((loading as { refused: never }).refused).says).toBe('Not drawn: the value of loading is not one the open kit takes. An <img> loads "lazy" or "eager".');
    const priority = judgeAttribute("html", "img", "fetchpriority", "urgent", context);
    expect(sayRefusal((priority as { refused: never }).refused).says).toBe('Not drawn: the value of fetchpriority is not one the open kit takes. An <img> fetches at "high", "low" or "auto".');
  });

  it("is the only element that takes them", () => {
    expect(judgeAttribute("html", "div", "loading", "lazy", context)).toEqual({ refused: { reason: "attribute", element: "div", name: "loading" } });
  });
});

describe("the check of a view's two sizes", () => {
  const said = (pictures: GuestPictures) => checkManifest(home(pictures), store());
  it("passes a thumb narrower than the width, with or without the width said, beside fields, records and most", () => {
    expect(said({ width: 1_600, thumb: 240 })).toEqual([]);
    expect(said({ thumb: 320 })).toEqual([]);
    expect(said({ width: 1_200, thumb: 200, moment: "photo", records: { ids: ["moment:1"] }, most: 40 })).toEqual([]);
  });

  it("refuses a thumb that is not a whole number of pixels from 16 to 4096 narrower than the width (view-pictures-thumb)", () => {
    for (const thumb of [8, 240.5, 5_000, true, 1_200, 1_600]) {
      expect(said({ width: 1_200, thumb } as never), String(thumb)).toEqual(["The view's pictures thumb is a whole number of pixels from 16 to 4096, narrower than its width (1,200 by default): the size it draws a picture small at (view-pictures-thumb)."]);
    }
  });

  it("still reads a string under thumb as a kind called thumb and its field", () => {
    expect(said({ thumb: "photo" })).toEqual(['The view\'s pictures chooses "thumb", which is no kind of this app.']);
  });
});

describe("a home of sixty photos that asks for two sizes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is handed each picture's thumb beside its src in a headless run, and no thumb where it asked for none", () => {
    const two = standInPictures(propsOf(home({ width: 1_200, thumb: 240 })), { view: '"home"', pictures: { width: 1_200, thumb: 240 }, standIn: "data:x" });
    expect(fileOf(two.props, "moment:0")).toMatchObject({ src: "data:x", thumb: "data:x" });
    const one = standInPictures(propsOf(home({ width: 1_200 })), { view: '"home"', pictures: { width: 1_200 }, standIn: "data:x" });
    expect(fileOf(one.props, "moment:0").thumb).toBeUndefined();
  });

  it("counts both sizes against the view's budget: the thumbs take room the hero sizes had", () => {
    const count = (pictures: GuestPictures) => {
      const { props } = standInPictures(propsOf(home(pictures)), { view: '"home"', pictures, standIn: "data:x", limits: { picturesBytes: 1_000_000 } });
      return (props.nodes ?? []).filter((node) => (node["photo"] as GuestFile).src).length;
    };
    /* At 400 across, drawn at two device pixels (800 of 4 000), a 2 MB photo is reckoned at 80 KB; its 200-pixel thumb at 5 KB more. */
    expect(count({ width: 400 })).toBe(12);
    expect(count({ width: 400, thumb: 100 })).toBe(11);
  });

  it("on the page, is handed two addresses, each made at its own size, each drawn as handed", async () => {
    vi.spyOn(window, "fetch").mockImplementation(async () => new Response(new Uint8Array(1_000), { status: 200, headers: { "content-type": "image/jpeg" } }));
    const widths: number[] = [];
    for (const as of ["data"] as const) {
      widths.length = 0;
      const pictures: GuestPictures = { width: 1_200, thumb: 240, records: { ids: ["moment:0"] } };
      const host = createGuestPictures(window, {
        as,
        view: '"home"',
        pictures,
        moved: () => {},
        shrink: async (_blob, across) => {
          widths.push(across);
          return new Blob([new Uint8Array(across)], { type: "image/jpeg" });
        },
      });
      const props = propsOf(home(pictures));
      host.hand(props);
      for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
      await new Promise((done) => setTimeout(done, PICTURES_SETTLE_MS));
      const file = fileOf(host.hand(props), "moment:0");
      expect(file.src, as).toBeDefined();
      expect(file.thumb, as).toBeDefined();
      expect(file.thumb).not.toBe(file.src);
      expect(host.drawn(file.src!)).toBeDefined();
      expect(host.drawn(file.thumb!)).toBeDefined();
      /* jsdom's device pixel ratio is 1: the full size at 1 200 across, the thumb at 240. */
      expect([...widths].sort((a, b) => a - b)).toEqual([240, 1_200]);
      expect(fileOf(host.hand(props), "moment:1").thumb).toBeUndefined();
      host.dispose();
    }
  });

  it("hands the src as the thumb where the picture is no wider than the thumb, and reckons it once", async () => {
    const small = { ...photo(0, 20_000), width: 200, height: 150 };
    const nodes = [{ id: "moment:0", kind: "moment", label: "Small", photo: small }];
    const props = { view: "home", edges: [], acts: [], nodes } as unknown as GuestProps;
    vi.spyOn(window, "fetch").mockImplementation(async () => new Response(new Uint8Array(1_000), { status: 200, headers: { "content-type": "image/jpeg" } }));
    const host = createGuestPictures(window, { as: "data", view: '"home"', pictures: { thumb: 240 }, moved: () => {}, shrink: async (blob) => blob });
    host.hand(props);
    for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
    await new Promise((done) => setTimeout(done, PICTURES_SETTLE_MS));
    const file = fileOf(host.hand(props), "moment:0");
    expect(file.thumb).toBe(file.src);
    host.dispose();
    /* Reckoned once: 20 KB fits a budget of 20 KB with its thumb, which is the same bytes. */
    const { props: headless } = standInPictures(props, { view: '"home"', pictures: { thumb: 240 }, standIn: "data:x", limits: { picturesBytes: 20_000 } });
    expect(fileOf(headless, "moment:0")).toMatchObject({ src: "data:x", thumb: "data:x" });
  });
});
