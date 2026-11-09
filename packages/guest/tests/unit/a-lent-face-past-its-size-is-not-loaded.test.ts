// @vitest-environment jsdom
import { VIEW_FONT_MOST_BYTES } from "@graview/core/css";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadViewFonts } from "../../src/host/fonts.js";

/**
 * A LENT FACE PAST ITS SIZE IS NOT LOADED (Roadmap f-lent-faces-bounded).
 * A face the brand lends its views is loaded with the first view dressed in
 * that brand, so it has a size it may not pass: `VIEW_FONT_MOST_BYTES`. The
 * host fetches the file itself and hands the bytes to `FontFace`, which has
 * nothing to stop at a size with: a file that says it is larger is not read,
 * and one that says nothing is read only until it passes the limit. Either
 * way the face is not loaded, and the view and the host are told in words —
 * a file the app holds and a file on an https: origin alike.
 */
const SHA = "c".repeat(64);
const HELD = { family: "Rock Face", src: `/graview/assets/${SHA}.woff2` };
const FAR = { family: "Fredoka", src: "https://fonts.gstatic.com/s/fredoka.woff2" };
const options = { asset: (path: string) => `https://app.example${path}`, origins: ["https://fonts.gstatic.com"] };

let fonts: Set<unknown>;
let made: { family: string; bytes: number }[];
class FakeFontFace {
  status = "loading";
  constructor(readonly family: string, source: unknown) {
    made.push({ family, bytes: source instanceof ArrayBuffer ? source.byteLength : ArrayBuffer.isView(source) ? source.byteLength : -1 });
  }
  load() {
    this.status = "loaded";
    return Promise.resolve(this);
  }
}
let asked: string[];
let pulled: number;
let cancelled: boolean;
/** A body of `size` bytes in chunks of 64 KiB, counting what was read of it. */
const body = (size: number) => {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= size) return controller.close();
      const chunk = new Uint8Array(Math.min(65_536, size - sent));
      sent += chunk.byteLength;
      pulled += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
};
let answer: (url: string) => Response;
beforeEach(() => {
  made = [];
  asked = [];
  pulled = 0;
  cancelled = false;
  fonts = new Set();
  Object.assign(window, {
    FontFace: FakeFontFace,
    fetch: (url: string) => {
      asked.push(url);
      return Promise.resolve(answer(url));
    },
  });
  Object.defineProperty(document, "fonts", { value: { add: (face: unknown) => fonts.add(face), delete: (face: unknown) => fonts.delete(face) }, configurable: true });
});
const backs: (() => void)[] = [];
afterEach(() => {
  for (const back of backs.splice(0)) back();
});
const settled = () => new Promise((resolve) => setTimeout(resolve, 30));
const lend = async (font: typeof HELD) => {
  const said: string[] = [];
  backs.push(loadViewFonts(document, [font], options, (one) => said.push(one)));
  await settled();
  return said;
};

describe("a face lent to a view has a size it may not pass", () => {
  it("is two million bytes, more than any one Latin face needs and less than a whole CJK family", () => {
    expect(VIEW_FONT_MOST_BYTES).toBe(2_000_000);
  });

  it("is fetched by the host, and its bytes handed to the page's fonts, where it is within it", async () => {
    answer = () => new Response(body(67_388), { headers: { "content-type": "font/woff2" } });
    expect(await lend(HELD)).toEqual([]);
    expect(asked).toEqual([`https://app.example/graview/assets/${SHA}.woff2`]);
    expect(made).toEqual([{ family: "Rock Face", bytes: 67_388 }]);
    expect(fonts.size).toBe(1);
  });

  it("is not read at all, nor loaded, where the file says it is larger, and the view and the host are told", async () => {
    answer = () => new Response(body(VIEW_FONT_MOST_BYTES + 1), { headers: { "content-type": "font/woff2", "content-length": String(VIEW_FONT_MOST_BYTES + 1) } });
    const said = await lend(FAR);
    expect(fonts.size).toBe(0);
    expect(made).toEqual([]);
    expect(pulled).toBeLessThan(VIEW_FONT_MOST_BYTES);
    expect(said).toEqual([`The app's face "Fredoka" for its views is not loaded: its file, ${FAR.src}, is more than 2 MB, the most a face lent to views may be.`]);
  });

  it("is read only until it passes the limit where the file says no size, and then not loaded, and said", async () => {
    answer = () => new Response(body(VIEW_FONT_MOST_BYTES * 3), { headers: { "content-type": "font/woff2" } });
    const said = await lend(HELD);
    expect(fonts.size).toBe(0);
    expect(made).toEqual([]);
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(VIEW_FONT_MOST_BYTES + 3 * 65_536);
    expect(said).toEqual([`The app's face "Rock Face" for its views is not loaded: its file, https://app.example/graview/assets/${SHA}.woff2, is more than 2 MB, the most a face lent to views may be.`]);
  });

  it("is loaded at exactly the limit", async () => {
    answer = () => new Response(body(VIEW_FONT_MOST_BYTES), { headers: { "content-length": String(VIEW_FONT_MOST_BYTES) } });
    expect(await lend(HELD)).toEqual([]);
    expect(made).toEqual([{ family: "Rock Face", bytes: VIEW_FONT_MOST_BYTES }]);
  });

  it("says where its file could not be fetched, as a face that would not load is said", async () => {
    answer = () => new Response("gone", { status: 404 });
    expect(await lend(FAR)).toEqual([`The app's face "Fredoka" for its views could not be loaded from ${FAR.src}.`]);
    expect(fonts.size).toBe(0);
  });

  it("is not loaded where its origin sent it on to one the host does not list for faces", async () => {
    answer = () => Object.defineProperties(new Response(body(1_000)), { redirected: { value: true }, url: { value: "https://elsewhere.example/fredoka.woff2" } });
    expect(await lend(FAR)).toEqual([expect.stringContaining("https://elsewhere.example is no origin this host lists for the faces its views are lent")]);
    expect(fonts.size).toBe(0);
  });
});
