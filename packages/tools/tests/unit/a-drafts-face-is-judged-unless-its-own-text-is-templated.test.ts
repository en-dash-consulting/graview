import { describe, expect, it } from "vitest";
import { cssFindings } from "../../src/draft-check.js";

/**
 * A DRAFT'S FACE IS JUDGED UNLESS ITS OWN TEXT IS TEMPLATED (HQ
 * f-view-font-face-data). The draft check reads a script's stylesheets as
 * written, with "0" for each `${…}`. A face whose bytes come in a `${…}` is
 * not judged by what stands in for them; every other face in the same sheet
 * still is.
 */
describe("a drafted view's own faces", () => {
  it("are not said to be refused for a stand-in where the face's own text is templated", () => {
    expect(cssFindings("const FONT = 'AAAA'; graview.style(`@font-face { font-family: Shout; src: url(data:font/woff2;base64,${FONT}) }`);")).toEqual([]);
  });

  it("are still judged beside one that is templated: an address in another face of the sheet is said", () => {
    const found = cssFindings("graview.style(`@font-face { font-family: Shout; src: url(data:font/woff2;base64,${FONT}) } @font-face { font-family: Loud; src: url(https://fonts.example/loud.woff2) } .a { color: ${color} }`);");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/"Loud".*\(view-font-face-src\)/);
  });
});
