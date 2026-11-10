// @vitest-environment jsdom
import { VIEW_FONT_MOST_BYTES } from "@graview/core/css";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadViewFonts } from "../../src/host/fonts.js";

/**
 * A LENT FACE PAST ITS SIZE IS NOT LOADED (Roadmap f-lent-faces-bounded).
 * A face the brand lends its views is loaded with the first view dressed in
 * that brand, so a file the app holds has a size it may not pass,
 * `VIEW_FONT_MOST_BYTES`, two million bytes. The host fetches such a file
 * itself and hands the bytes to `FontFace`, which has nothing to stop at a
 * size with: a file that says it is larger is not read, and one that says
 * nothing is read only until it passes the limit. Either way the face is not
 * loaded, and the view and the host are told in words. A face on an origin
 * the host lists for faces is loaded by its address, as before: what it may
 * be is that origin's to bound.
 */
const SHA = "c".repeat(64);
const HELD = { family: "Rock Face", src: `/graview/assets/${SHA}.woff2` };
const HELD_AT = `https://app.example/graview/assets/${SHA}.woff2`;
const FAR = { family: "Fredoka", src: "https://fonts.gstatic.com/s/fredoka.woff2" };
const options = { asset: (path: string) => `https://app.example${path}`, origins: ["https://fonts.gstatic.com"] };
const over = `The app's face "Rock Face" for its views is not loaded: its file, ${HELD_AT}, is more than 2 MB, the most a file the app holds may be as a face for its views.`;

let fonts: Set<unknown>;
let made: { family: string; source: number | string }[];
class FakeFontFace {
  status = "loading";
  constructor(readonly family: string, source: unknown) {
    made.push({ family, source: typeof source === "string" ? source : source instanceof ArrayBuffer ? source.byteLength : -1 });
  }
  load() {
    this.status = "loaded";
    return Promise.resolve(this);
  }
}
let asked: { url: string; init: RequestInit | undefined }[];
let pulled: number;
let canceled: boolean;
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
      canceled = true;
    },
  });
};
let answer: () => Promise<Response>;
beforeEach(() => {
  made = [];
  asked = [];
  pulled = 0;
  canceled = false;
  fonts = new Set();
  Object.assign(window, {
    FontFace: FakeFontFace,
    fetch: (url: string, init?: RequestInit) => {
      asked.push({ url, init });
      return answer();
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

describe("a file the app holds, lent as a face, has a size it may not pass", () => {
  it("is fetched by the host, never sent on elsewhere, and its bytes handed to the page's fonts, up to two million of them", async () => {
    answer = async () => new Response(body(2_000_000), { headers: { "content-type": "font/woff2" } });
    expect(await lend(HELD)).toEqual([]);
    expect(asked).toEqual([{ url: HELD_AT, init: expect.objectContaining({ redirect: "error" }) }]);
    expect(made).toEqual([{ family: "Rock Face", source: VIEW_FONT_MOST_BYTES }]);
    expect(fonts.size).toBe(1);
  });

  it("is not read at all, nor loaded, where the file says it is one byte more, and the view and the host are told", async () => {
    answer = async () => new Response(body(2_000_001), { headers: { "content-type": "font/woff2", "content-length": "2000001" } });
    const said = await lend(HELD);
    expect(fonts.size).toBe(0);
    expect(made).toEqual([]);
    expect(pulled).toBeLessThan(VIEW_FONT_MOST_BYTES);
    expect(said).toEqual([over]);
  });

  it("is read only until it passes the limit where the file says no size, and then not loaded, and said", async () => {
    answer = async () => new Response(body(VIEW_FONT_MOST_BYTES * 3), { headers: { "content-type": "font/woff2" } });
    const said = await lend(HELD);
    expect(fonts.size).toBe(0);
    expect(made).toEqual([]);
    expect(canceled).toBe(true);
    expect(pulled).toBeLessThan(VIEW_FONT_MOST_BYTES + 3 * 65_536);
    expect(said).toEqual([over]);
  });

  it("says where its file could not be fetched, or would have been sent on elsewhere, as a face that would not load is said", async () => {
    answer = async () => new Response("gone", { status: 404 });
    expect(await lend(HELD)).toEqual([`The app's face "Rock Face" for its views could not be loaded from ${HELD_AT}.`]);
    answer = () => Promise.reject(new TypeError("a redirect, refused"));
    expect(await lend(HELD)).toEqual([`The app's face "Rock Face" for its views could not be loaded from ${HELD_AT}.`]);
    expect(fonts.size).toBe(0);
  });
});

describe("a file the app holds that answers as something else", () => {
  it("is not read as a face, and the view and the host are told what it answered", async () => {
    answer = async () => new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } });
    expect(await lend(HELD)).toEqual([`The app's face "Rock Face" for its views is not loaded: ${HELD_AT} answered text/html, not a font.`]);
    expect(made).toEqual([]);
    expect(fonts.size).toBe(0);
  });

  it("is read as a face when it answers an older font type, or bytes, or no type at all", async () => {
    for (const type of ["application/font-woff2", "application/x-font-ttf", "application/octet-stream", "FONT/WOFF2; charset=binary", null]) {
      answer = async () => new Response(body(1), type ? { headers: { "content-type": type } } : {});
      expect(await lend(HELD)).toEqual([]);
    }
  });
});

describe("a face on an origin the host lists for faces", () => {
  it("is loaded by its address, as a page loads any face, and never fetched by the host", async () => {
    answer = async () => new Response(body(1));
    expect(await lend(FAR)).toEqual([]);
    expect(asked).toEqual([]);
    expect(made).toEqual([{ family: "Fredoka", source: `url(${JSON.stringify(FAR.src)})` }]);
    expect(fonts.size).toBe(1);
  });
});
