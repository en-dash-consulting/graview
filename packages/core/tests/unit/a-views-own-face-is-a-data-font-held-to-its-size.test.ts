import { describe, expect, it } from "vitest";
import { sanitizeStylesheet, sanitizeStylesheets, tokenize, VIEW_FACE_MOST_BYTES, VIEW_FACES_MOST_BYTES, viewFaceRefusedWords, type CssRefusal } from "../../src/css.js";

/**
 * A VIEW'S OWN FACE IS A `data:` FONT, HELD TO ITS SIZE (HQ
 * f-view-font-face-data). A view's stylesheet may declare `@font-face`
 * where every `src` is a `data:` URL of a font: nothing is fetched, the
 * bytes are counted as decoded, one face is at most 50 KB and a view's faces
 * 200 KB together, only a face's own descriptors are kept, and its family is
 * a plain name. The face is handed to the host apart from the stylesheet,
 * which the host loads into the page as a `FontFace` from the bytes: the
 * judged CSS itself still holds no `@font-face` and no `url()`.
 */
const font = (size: number, magic = "wOF2") => {
  const bytes = Buffer.alloc(size, 7);
  bytes.write(magic, 0, "latin1");
  return bytes.toString("base64");
};
const face = (body: string) => `@font-face { ${body} }`;
const data = (size: number, type = "font/woff2", magic = "wOF2") => `url(data:${type};base64,${font(size, magic)})`;
const views = { faces: true } as const;
const faceRefusals = (refused: readonly CssRefusal[]) => refused.filter((one) => one.reason === "font-face");

describe("a view's own face", () => {
  it("is kept from a data: font, apart from the stylesheet, which still loads nothing", () => {
    const said = sanitizeStylesheet(`${face(`font-family: "Shout Display"; src: ${data(20_000)} format("woff2"); font-weight: 700; font-display: swap`)}\n.title { font-family: "Shout Display", serif }`, undefined, views);
    expect(said.refused).toEqual([]);
    expect(said.faces).toHaveLength(1);
    expect(said.faces[0]).toMatchObject({ family: "Shout Display", size: 20_000, weight: "700", display: "swap" });
    expect(said.faces[0]!.sources[0]!.bytes.byteLength).toBe(20_000);
    expect(said.css).toBe(`.title { font-family: "Shout Display", serif; }`);
    expect(tokenize(said.css).some((token) => token.type === "url" || token.type === "at-keyword")).toBe(false);
  });

  it("takes each type a font is served as, a quoted url, and the descriptors a face has", () => {
    for (const type of ["font/woff2", "font/woff", "font/ttf", "font/otf", "application/font-woff", "application/x-font-ttf", "application/octet-stream"]) {
      const said = sanitizeStylesheet(face(`font-family: Shout; src: url("data:${type};base64,${font(64)}")`), undefined, views);
      expect(said.faces, type).toHaveLength(1);
      expect(said.refused, type).toEqual([]);
    }
    const said = sanitizeStylesheet(face(`font-family: Shout; src: ${data(64)}; font-weight: 100 900; font-style: italic; font-stretch: 75% 125%; unicode-range: U+0000-00FF, U+0131, U+4??`), undefined, views);
    expect(said.refused).toEqual([]);
    expect(said.faces[0]).toMatchObject({ weight: "100 900", style: "italic", stretch: "75% 125%", unicodeRange: "U+0000-00FF, U+0131, U+4??" });
  });

  it("counts every face's decoded bytes, one face to 50 KB and a view's faces to 200 KB together, and says each past it with a finding code", () => {
    expect(VIEW_FACE_MOST_BYTES).toBe(50_000);
    expect(VIEW_FACES_MOST_BYTES).toBe(200_000);
    expect(sanitizeStylesheet(face(`font-family: Shout; src: ${data(50_000)}`), undefined, views).faces).toHaveLength(1);
    const over = sanitizeStylesheet(face(`font-family: Shout; src: ${data(50_001)}`), undefined, views);
    expect(over.faces).toEqual([]);
    expect(faceRefusals(over.refused)).toEqual([{ reason: "font-face", name: "size", family: "Shout", bytes: 50_001 }]);
    expect(viewFaceRefusedWords(faceRefusals(over.refused)[0]!)).toMatch(/50 KB.*\(view-font-face-size\)\.$/);
    /* Two sources in one face are one face's bytes. */
    expect(faceRefusals(sanitizeStylesheet(face(`font-family: Shout; src: ${data(30_000)}, ${data(30_000)}`), undefined, views).refused)).toEqual([{ reason: "font-face", name: "size", family: "Shout", bytes: 60_000 }]);
    /* Five faces of 45 KB are 225 KB: the fifth is refused, across sheets as within one. */
    const five = Array.from({ length: 5 }, (_, at) => face(`font-family: Shout${"ABCDE"[at]}; src: ${data(45_000)}`));
    for (const judged of [sanitizeStylesheet(five.join("\n"), undefined, views), sanitizeStylesheets(five, undefined, views)]) {
      expect(judged.faces.map((one) => one.family)).toEqual(["ShoutA", "ShoutB", "ShoutC", "ShoutD"]);
      expect(faceRefusals(judged.refused)).toEqual([{ reason: "font-face", name: "total", family: "ShoutE", bytes: 225_000 }]);
      expect(viewFaceRefusedWords(faceRefusals(judged.refused)[0]!)).toMatch(/200 KB.*\(view-font-faces-size\)\.$/);
    }
  });

  it("is counted by its bytes, not by what its URL says: padding and a stray character are no way past the size", () => {
    const base64 = font(50_000);
    const unpadded = sanitizeStylesheet(face(`font-family: Shout; src: url(data:font/woff2;base64,${font(50_002).replace(/=+$/, "")})`), undefined, views);
    expect(faceRefusals(unpadded.refused)).toEqual([{ reason: "font-face", name: "size", family: "Shout", bytes: 50_002 }]);
    const misplaced = sanitizeStylesheet(face(`font-family: Shout; src: url(data:font/woff2;base64,${base64}AAAA)`), undefined, views);
    expect(faceRefusals(misplaced.refused)).toEqual([{ reason: "font-face", name: "encoding", family: "Shout" }]);
    const stray = sanitizeStylesheet(face(`font-family: Shout; src: url("data:font/woff2;base64,${base64.slice(0, 40)}%${base64.slice(40)}")`), undefined, views);
    expect(faceRefusals(stray.refused)).toEqual([{ reason: "font-face", name: "encoding", family: "Shout" }]);
  });

  it("is refused where a src is an address, local(), a type that is no font, or bytes that are no font, each saying why", () => {
    const cases: [string, string, RegExp][] = [
      [`src: url(https://fonts.example/shout.woff2)`, "address", /loads nothing.*\(view-font-face-src\)\.$/],
      [`src: ${data(64)}, url(/shout.woff2) format("woff2")`, "address", /loads nothing/],
      [`src: local("Shout"), ${data(64)}`, "local", /installed.*\(view-font-face-src\)\.$/],
      [`src: url(data:image/png;base64,${font(64)})`, "type", /image\/png.*not a font.*\(view-font-face-type\)\.$/],
      [`src: url("data:text/css,${encodeURIComponent("@import url(https://x.example)")}")`, "type", /text\/css/],
      [`src: url(data:font/woff2,${"A".repeat(64)})`, "encoding", /base64.*\(view-font-face-type\)\.$/],
      [`src: ${data(64, "font/woff2", "<svg")}`, "bytes", /not a WOFF2, WOFF, TrueType or OpenType.*\(view-font-face-type\)\.$/],
      [`src: image-set(${data(64)})`, "src", /\(view-font-face-src\)\.$/],
      [``, "src", /no src/],
    ];
    for (const [src, name, words] of cases) {
      const said = sanitizeStylesheet(face(`font-family: Shout; ${src}`), undefined, views);
      expect(said.faces, src).toEqual([]);
      const refused = faceRefusals(said.refused);
      expect(refused, src).toEqual([expect.objectContaining({ reason: "font-face", name, family: "Shout" })]);
      expect(viewFaceRefusedWords(refused[0]!), src).toMatch(words);
    }
  });

  it("keeps only a face's own descriptors, and says each it left out", () => {
    const said = sanitizeStylesheet(face(`font-family: Shout; src: ${data(64)}; font-feature-settings: "liga"; size-adjust: 120%; ascent-override: 90%; --x: 1; font-weight: heavy`), undefined, views);
    expect(said.faces).toHaveLength(1);
    expect(said.faces[0]!.weight).toBeUndefined();
    expect(faceRefusals(said.refused).map((one) => [one.name, one.descriptor])).toEqual([
      ["descriptor", "font-feature-settings"],
      ["descriptor", "size-adjust"],
      ["descriptor", "ascent-override"],
      ["descriptor", "--x"],
      ["value", "font-weight"],
    ]);
    expect(viewFaceRefusedWords(faceRefusals(said.refused)[0]!)).toMatch(/font-family, src, font-weight, font-style, font-display, unicode-range and font-stretch.*\(view-font-face-descriptor\)\.$/);
  });

  it("is called by a plain name, so nothing in it breaks out of the rule or takes a face the page already draws in", () => {
    for (const family of [`"Shout\\"; } body { color: red"`, `"Shout</style>"`, `"a\\a b"`, `"${"x".repeat(61)}"`, `Shout, serif`, `var(--x)`, `""`]) {
      const said = sanitizeStylesheet(face(`font-family: ${family}; src: ${data(64)}`), undefined, views);
      expect(said.faces, family).toEqual([]);
      expect(faceRefusals(said.refused), family).toEqual([expect.objectContaining({ name: "family" })]);
      expect(viewFaceRefusedWords(faceRefusals(said.refused)[0]!)).toMatch(/\(view-font-face-family\)\.$/);
      expect(said.css).not.toMatch(/red|style/);
    }
    for (const family of ["Arial", "serif", "Montserrat", "ui-rounded", "inherit"]) {
      const said = sanitizeStylesheet(face(`font-family: ${family}; src: ${data(64)}`), undefined, views);
      expect(said.faces, family).toEqual([]);
      expect(faceRefusals(said.refused), family).toEqual([expect.objectContaining({ name: "family" })]);
    }
  });

  it("is declared at the top of a stylesheet, not inside a condition or a rule", () => {
    for (const css of [`@media (min-width: 1px) { ${face(`font-family: Shout; src: ${data(64)}`)} }`, `.x { ${face(`font-family: Shout; src: ${data(64)}`)} }`]) {
      const said = sanitizeStylesheet(css, undefined, views);
      expect(said.faces, css).toEqual([]);
      expect(faceRefusals(said.refused), css).toEqual([expect.objectContaining({ name: "where" })]);
    }
  });

  it("does not count toward the stylesheet's length, while what else the sheet says still does", () => {
    const rules = `.x { color: red }\n`.repeat(3_000);
    expect(rules.length).toBeLessThan(64_000);
    const said = sanitizeStylesheet(`${face(`font-family: Shout; src: ${data(48_000)}`)}\n${rules}`, undefined, views);
    expect(said.refused).toEqual([]);
    expect(said.faces).toHaveLength(1);
    expect(sanitizeStylesheet(`${face(`font-family: Shout; src: ${data(48_000)}`)}\n${rules}${rules}`, undefined, views).refused).toEqual([{ reason: "size" }]);
  });

  it("is still refused, as before, where faces are not asked for: the app's stylesheet for its views lends faces by brand.views.fonts", () => {
    const said = sanitizeStylesheet(face(`font-family: Shout; src: ${data(64)}`));
    expect(said.faces).toEqual([]);
    expect(said.refused).toEqual([{ reason: "at-rule", name: "@font-face" }]);
  });
});
