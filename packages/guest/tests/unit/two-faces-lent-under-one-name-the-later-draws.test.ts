// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadViewFonts } from "../../src/host/fonts.js";

/**
 * TWO FACES LENT UNDER ONE NAME: THE LATER DRAWS (Roadmap
 * f-lent-faces-bounded). A lent face is the document's, so two brands on
 * one page that lend "Rock Face" from two files would both be in it, and
 * which one the engine drew was nobody's decision. Now the page holds one
 * file a name (family, weight and style): of those lent, the one lent last
 * — lending a file again makes it the last — draws in every view once it
 * has loaded; the others are set aside, and the next drawn again once it
 * goes. Once the one that will draw has loaded, each lender is told which.
 */
const A = { family: "Rock Face", src: `/graview/assets/${"a".repeat(64)}.woff2` };
const B = { family: "rock face", src: `/graview/assets/${"b".repeat(64)}.woff2` };
const options = { asset: (path: string) => `https://app.example${path}` };
const told = (family: string, file: typeof A, files = 2) => `The app's face "${family}" for its views is lent from ${files} files on this page, and the one drawn in every view is https://app.example${file.src}.`;

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
/* Each file's first byte says which it is; how long each takes to answer, and whether it is there at all, is the test's to set. */
let wait: Record<string, number>;
let gone: Set<string>;
beforeEach(() => {
  fonts = new Set();
  wait = {};
  gone = new Set();
  Object.assign(window, {
    FontFace: FakeFontFace,
    fetch: (url: string) => {
      const which = url.includes("aaaa") ? "a" : "b";
      const answer = () => (gone.has(which) ? new Response("gone", { status: 404 }) : new Response(new Uint8Array([which === "a" ? 0xa : 0xb, 0, 0]), { headers: { "content-type": "font/woff2" } }));
      return new Promise((resolve) => setTimeout(() => resolve(answer()), wait[which] ?? 0));
    },
  });
  Object.defineProperty(document, "fonts", { value: { add: (face: FakeFontFace) => fonts.add(face), delete: (face: FakeFontFace) => fonts.delete(face) }, configurable: true });
});
const backs: (() => void)[] = [];
afterEach(() => {
  for (const back of backs.splice(0)) back();
});
const lend = (font: typeof A & { weight?: number }, said: string[] = [], replacing?: () => void) => {
  const back = loadViewFonts(document, [font], options, (one) => said.push(one), replacing);
  backs.push(back);
  return back;
};
const settled = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
const drawn = () => [...fonts].map((face) => face.file.toString(16));

describe("two faces lent under one name in one document", () => {
  it("draw as one: the one lent later, though the earlier loaded last, and each lender is told which", async () => {
    wait = { a: 40, b: 0 };
    const saidA: string[] = [];
    const saidB: string[] = [];
    lend(A, saidA);
    lend(B, saidB);
    await settled();
    expect(drawn()).toEqual(["b"]);
    expect(saidA).toEqual([told("Rock Face", B)]);
    expect(saidB).toEqual([told("rock face", B)]);
  });

  it("say nothing of which draws until the one that will has loaded, and where the later fails, the earlier draws and only the later's lender is told", async () => {
    wait = { a: 0, b: 40 };
    gone.add("b");
    const saidA: string[] = [];
    const saidB: string[] = [];
    lend(A, saidA);
    lend(B, saidB);
    await settled(20);
    expect(drawn()).toEqual(["a"]);
    expect(saidA).toEqual([]);
    await settled();
    expect(drawn()).toEqual(["a"]);
    expect(saidA).toEqual([]);
    expect(saidB).toEqual([`The app's face "rock face" for its views could not be loaded from https://app.example${B.src}.`]);
  });

  it("tell every view holding a file that failed, and try it again when a view lends it after", async () => {
    gone.add("b");
    const first: string[] = [];
    const second: string[] = [];
    lend(B, first);
    lend(B, second);
    await settled();
    expect(first).toEqual([expect.stringContaining("could not be loaded")]);
    expect(second).toEqual([expect.stringContaining("could not be loaded")]);
    gone.clear();
    const third: string[] = [];
    lend(B, third);
    await settled();
    expect(drawn()).toEqual(["b"]);
    expect(third).toEqual([]);
  });

  it("tell a view once of a file that failed while it lent the file again over its last lending", async () => {
    wait = { a: 40 };
    gone.add("a");
    const said: string[] = [];
    const before = loadViewFonts(document, [A], options, (one) => said.push(one));
    backs.push(before);
    lend(A, said, before);
    await settled();
    expect(said).toEqual([`The app's face "Rock Face" for its views could not be loaded from https://app.example${A.src}.`]);
  });

  it("draw a file lent again as the last lent, and say so", async () => {
    const saidA: string[] = [];
    lend(A);
    lend(B);
    await settled();
    expect(drawn()).toEqual(["b"]);
    lend(A, saidA);
    await settled();
    expect(drawn()).toEqual(["a"]);
    expect(saidA).toEqual([told("Rock Face", A)]);
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
    lend(A);
    await settled(20);
    lend(B);
    await settled(20);
    expect(drawn()).toEqual(["a"]);
    await settled();
    expect(drawn()).toEqual(["b"]);
  });

  it("are never two where a brand changes one file for another: the old draws until the new has loaded, is given back then, and nothing is said", async () => {
    wait = { a: 0, b: 60 };
    const said: string[] = [];
    const before = loadViewFonts(document, [A], options, (one) => said.push(one));
    await settled(20);
    lend(B, said, before);
    await settled(20);
    expect(drawn()).toEqual(["a"]);
    await settled();
    expect(drawn()).toEqual(["b"]);
    expect(said).toEqual([]);
    before();
    expect(drawn()).toEqual(["b"]);
  });

  it("are one name where one says no weight and the other 400, which is what no weight is", async () => {
    lend(A);
    lend({ ...B, weight: 400 });
    await settled();
    expect(drawn()).toEqual(["b"]);
  });

  it("are each drawn where their weights differ, being two faces of one family and not one name", async () => {
    lend({ ...A, weight: 400 });
    lend({ ...B, weight: 700 });
    await settled();
    expect(drawn().sort()).toEqual(["a", "b"]);
  });
});
