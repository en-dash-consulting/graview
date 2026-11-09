// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadViewFonts } from "../../src/host/fonts.js";

/**
 * TWO FACES LENT UNDER ONE NAME: THE LATER DRAWS (Roadmap
 * f-lent-faces-bounded). A lent face is the document's, so two brands on
 * one page that lend "Rock Face" from two files would both be in it, and
 * which one the engine drew was nobody's decision. Now the page holds one
 * file a name (family, weight and style): of those lent, the one lent
 * later draws, in every view on the page, once it has loaded; the earlier
 * is set aside, and drawn again once the later goes. Each lender is told.
 */
const A = { family: "Rock Face", src: `/graview/assets/${"a".repeat(64)}.woff2` };
const B = { family: "rock face", src: `/graview/assets/${"b".repeat(64)}.woff2` };
const options = { asset: (path: string) => `https://app.example${path}` };

let fonts: Set<FakeFontFace>;
class FakeFontFace {
  status = "loading";
  readonly file: number;
  constructor(readonly family: string, source: ArrayBuffer) {
    this.file = new Uint8Array(source)[0]!;
  }
  load() {
    this.status = "loaded";
    return Promise.resolve(this);
  }
}
/* Each file's first byte says which it is, and how long each takes to answer is set by the test. */
let wait: Record<string, number>;
beforeEach(() => {
  fonts = new Set();
  wait = {};
  Object.assign(window, {
    FontFace: FakeFontFace,
    fetch: (url: string) => {
      const which = url.includes("aaaa") ? "a" : "b";
      return new Promise((resolve) => setTimeout(() => resolve(new Response(new Uint8Array([which === "a" ? 0xa : 0xb, 0, 0]))), wait[which] ?? 0));
    },
  });
  Object.defineProperty(document, "fonts", { value: { add: (face: FakeFontFace) => fonts.add(face), delete: (face: FakeFontFace) => fonts.delete(face) }, configurable: true });
});
const backs: (() => void)[] = [];
afterEach(() => {
  for (const back of backs.splice(0)) back();
});
const settled = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
const drawn = () => [...fonts].map((face) => face.file.toString(16));

describe("two faces lent under one name in one document", () => {
  it("draw as one: the one lent later, though the earlier loaded last, and each lender is told which", async () => {
    wait = { a: 40, b: 0 };
    const saidA: string[] = [];
    const saidB: string[] = [];
    backs.push(loadViewFonts(document, [A], options, (one) => saidA.push(one)));
    backs.push(loadViewFonts(document, [B], options, (one) => saidB.push(one)));
    await settled();
    expect(drawn()).toEqual(["b"]);
    const told = `The app's face "Rock Face" for its views is lent from 2 files on this page, and the one lent last, https://app.example${B.src}, is drawn in every view.`;
    expect(saidA).toEqual([told]);
    expect(saidB).toEqual([told.replace('"Rock Face"', '"rock face"')]);
  });

  it("draw the earlier again once the later goes, and nothing once both have", async () => {
    const giveA = loadViewFonts(document, [A], options, () => {});
    const giveB = loadViewFonts(document, [B], options, () => {});
    await settled();
    expect(drawn()).toEqual(["b"]);
    giveB();
    expect(drawn()).toEqual(["a"]);
    giveA();
    expect(drawn()).toEqual([]);
  });

  it("keep the earlier drawn until the later has loaded, so the page is not left drawing neither", async () => {
    wait = { a: 0, b: 60 };
    backs.push(loadViewFonts(document, [A], options, () => {}));
    await settled(20);
    backs.push(loadViewFonts(document, [B], options, () => {}));
    await settled(20);
    expect(drawn()).toEqual(["a"]);
    await settled();
    expect(drawn()).toEqual(["b"]);
  });

  it("are never two where a brand changes one file for another: the old is given back as the new is lent, and nothing is said", async () => {
    const said: string[] = [];
    const before = loadViewFonts(document, [A], options, (one) => said.push(one));
    await settled();
    backs.push(loadViewFonts(document, [B], options, (one) => said.push(one), before));
    await settled();
    expect(drawn()).toEqual(["b"]);
    expect(said).toEqual([]);
  });

  it("are each drawn where their weights differ, being two faces of one family and not one name", async () => {
    backs.push(loadViewFonts(document, [{ ...A, weight: 400 }], options, () => {}));
    backs.push(loadViewFonts(document, [{ ...B, weight: 700 }], options, () => {}));
    await settled();
    expect(drawn().sort()).toEqual(["a", "b"]);
  });
});
