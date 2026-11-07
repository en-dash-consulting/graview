// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { loadViewFonts, viewFontAddress } from "../../src/host/fonts.js";

/**
 * A VIEW DRAWS IN A FACE ITS APP LENDS IT (Roadmap
 * f-view-authoring-friction-2026-11). A view's stylesheet loads nothing, so
 * no `@font-face`; the brand lends its views faces instead
 * (`brand.views.fonts`), and the view's host loads each into the page as a
 * `FontFace` — only from where it lets a view's images come from: a file the
 * app holds, where the host says those are served (`asset`), or an `https:`
 * address on an origin it lists (`images.origins`). Anything else is said
 * and not fetched. That a browser draws the view in it is guest-sandbox's
 * brand claims.
 */
const SHA = "b".repeat(64);
const BALOO = { family: "Baloo 2", src: `/graview/assets/${SHA}.woff2`, weight: "400 800" };
const FREDOKA = { family: "Fredoka", src: "https://fonts.gstatic.com/s/fredoka.woff2" };
const asset = (path: string) => `https://app.example/base${path}`;

describe("a face lent to a view", () => {
  it("is loaded from a file the app holds where the host serves them, and from an https: origin the host lists for images", () => {
    expect(viewFontAddress(BALOO, { asset })).toEqual({ url: `https://app.example/base/graview/assets/${SHA}.woff2` });
    expect(viewFontAddress(FREDOKA, { origins: ["https://fonts.gstatic.com"] })).toEqual({ url: FREDOKA.src });
  });

  it("is refused, and said, where the host serves no app files, lists no such origin, or the face breaks the brand's rule", () => {
    expect(viewFontAddress(BALOO, {})).toEqual({ refused: expect.stringContaining("this host says nowhere the app's own files are served (`asset`)") });
    expect(viewFontAddress(FREDOKA, { origins: ["https://upload.wikimedia.org"] })).toEqual({ refused: expect.stringContaining("https://fonts.gstatic.com is no origin this host lists for a view's images") });
    expect(viewFontAddress({ family: "Rock", src: "https://evil.example/steal.css" }, { origins: ["https://evil.example"] })).toEqual({ refused: expect.stringContaining("its src is a file the app holds") });
  });

  it("is added to the page's fonts once, however often the view is dressed, with its weight and style", () => {
    const made: { family: string; source: string; descriptors: Record<string, string> }[] = [];
    class FakeFontFace {
      constructor(readonly family: string, source: string, descriptors: Record<string, string>) {
        made.push({ family, source, descriptors });
      }
      load() {
        return Promise.resolve(this);
      }
    }
    const fonts = new Set<unknown>();
    Object.assign(window, { FontFace: FakeFontFace });
    Object.defineProperty(document, "fonts", { value: { add: (face: unknown) => fonts.add(face) }, configurable: true });
    const said: string[] = [];
    loadViewFonts(document, [BALOO, FREDOKA], { asset }, (one) => said.push(one));
    loadViewFonts(document, [BALOO], { asset }, (one) => said.push(one));
    expect(made).toEqual([{ family: "Baloo 2", source: `url("https://app.example/base/graview/assets/${SHA}.woff2")`, descriptors: { display: "swap", weight: "400 800" } }]);
    expect(fonts.size).toBe(1);
    expect(said).toEqual([expect.stringContaining('The app\'s face "Fredoka" for its views is not loaded: https://fonts.gstatic.com is no origin')]);
  });
});
