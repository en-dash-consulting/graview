// @vitest-environment jsdom
import { sanitizeDeclarations, sanitizeStylesheet, tokenize } from "@graview/core/css";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { LEAVING, ORDINARY, STAYING } from "../../../../scripts/fixtures/sheets-that-try-to-leave-their-layer.mjs";
import { dressedCss, inLayer } from "../../src/host/cascade.js";
import { createOpenDrawing, REGION_CSS } from "../../src/host/open-draw.js";

/**
 * A VIEW'S SHEET STAYS IN ITS LAYER. The host writes each sheet inside a
 * cascade layer of its own, and a `}` the sanitizer let through closed the
 * layer: the rest was CSS nobody judged, which fetched any address in
 * Chromium, WebKit and Firefox and could write a rule in the host's first
 * layer. The judges refuse it now (`a-judged-stylesheet-cannot-close-what-
 * holds-it`, core), and the wrapper trusts no judge: `inLayer` reads what it
 * is given, and draws nothing of a sheet that does not read as whole rules.
 */
const SHEETS = LEAVING as { name: string; css: string }[];

/** What the browser reads of the wrapped text: one block, closed by the text's last token, and no at-rule but the ones the kit keeps. */
function readsAsOneLayer(text: string, layer: string): boolean {
  const tokens = tokenize(text).filter((one) => one.type !== "whitespace");
  const [at, name, opens] = tokens;
  if (at?.type !== "at-keyword" || at.value !== "layer" || name?.type !== "ident" || name.value !== layer || opens?.type !== "{") return false;
  let depth = 0;
  for (const [index, token] of tokens.entries()) {
    if (index > 2 && token.type === "at-keyword" && !["media", "supports", "container", "keyframes"].includes(token.value)) return false;
    if (token.type === "url" || (token.type === "function" && ["url", "image-set", "-webkit-image-set", "src"].includes(token.value.toLowerCase()))) return false;
    if (token.type === "{") depth += 1;
    if (token.type === "}") {
      depth -= 1;
      if (depth < 0) return false;
      if (depth === 0 && index !== tokens.length - 1) return false;
    }
  }
  return depth === 0;
}

describe("the wrapper over a sanitized sheet", () => {
  for (const { name, css } of [...SHEETS, ...(STAYING as { name: string; css: string }[])]) {
    it(`holds it to one layer: ${name}`, () => {
      const kept = sanitizeStylesheet(css).css;
      const wrapped = inLayer("graview-view", kept);
      if (wrapped !== "") expect(readsAsOneLayer(wrapped, "graview-view"), wrapped).toBe(true);
    });
  }

  for (const css of ORDINARY as string[]) {
    it(`draws an ordinary sheet whole: ${css}`, () => {
      const kept = sanitizeStylesheet(css).css;
      expect(inLayer("graview-view", kept)).toBe(`@layer graview-view {\n${kept}\n}`);
    });
  }

  it("draws nothing of a string that does not read as whole rules, whatever judged it", () => {
    for (const given of ["}b{color:red}", "@media }div{background-image:url(https://evil.test/a)}", "a{color:red}}", "a{", "a{content:'", "<!-- a{}", "a{color:red}@layer graview-motion{b{}}", "@import 'x';", "a{background:url(https://evil.test/a)}", "a{color:(}", "a\\"]) {
      expect(inLayer("graview-view", given), given).toBe("");
      expect(inLayer("graview-theme", given), given).toBe("");
      expect(dressedCss(given, "a { color: red; }"), given).toBe(`@layer graview-motion, graview-region, graview-view, graview-theme;\n@layer graview-view {\na { color: red; }\n}`);
    }
  });

  it("keeps url(#id), which fetches nothing, and a } inside a string or an escape", () => {
    for (const kept of ['a { fill: url("#g"); }', 'a[b="}"] { color: red; }', "a\\}b { color: red; }", '@keyframes "x}" { from { opacity: 0; } }']) expect(inLayer("graview-view", kept), kept).toBe(`@layer graview-view {\n${kept}\n}`);
  });
});

describe("a view's sheet and the app's, drawn", () => {
  const drawn = () => {
    const shadow = document.body.appendChild(document.createElement("div")).attachShadow({ mode: "open" });
    return { shadow, drawing: createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} }) };
  };

  for (const { name, css } of SHEETS) {
    it(`say what was refused, and hold no address: ${name}`, () => {
      const { shadow, drawing } = drawn();
      drawing.style([css]);
      drawing.theme(css);
      expect(drawing.refused.length, name).toBeGreaterThan(0);
      for (const sheet of ["[data-graview-view-style]", "[data-graview-view-theme]"]) {
        const text = shadow.querySelector(sheet)!.textContent!;
        expect(text).not.toContain("evil.test");
        expect(text).not.toContain("graview-motion");
      }
      drawing.dispose();
    });
  }

  it("gets no rule of a view past the theme without !important: }b{color:rgb(9,9,9)} is not drawn at all", () => {
    const { shadow, drawing } = drawn();
    drawing.style(["}b{color:rgb(9,9,9)}"]);
    expect(shadow.querySelector("[data-graview-view-style]")!.textContent).toBe("");
    expect(drawing.refused).toEqual([{ reason: "css", name: "stylesheet", css: { reason: "unreadable", name: "selector" } }]);
    drawing.dispose();
  });
});

describe("what a view's plain rule cannot do to the host's own", () => {
  it("is change the root's box or its fade: both are !important, in the layer before the view's", () => {
    expect(REGION_CSS).toMatch(/\[data-graview-view-root\] \{ display: flow-root !important;/);
    expect(REGION_CSS).toContain("[data-graview-view-root][data-graview-fade] { opacity: 0 !important; }");
  });

  it("is hold the ring at its starting value by a transition: what takes the keyboard moves at once", () => {
    const rule = REGION_CSS.split("\n").find((line) => line.includes(":focus-visible"))!;
    expect(rule).toContain("transition: none !important");
  });

  it("is take the ring away from a style attribute, whose !important would beat every layer", () => {
    expect(sanitizeDeclarations("outline: none !important; outline-color: transparent !important; outline-offset: 0 !important; color: red !important").css).toBe("outline: none; outline-color: transparent; outline-offset: 0; color: red !important");
    expect(sanitizeDeclarations("all: unset !important").css).toBe("all: unset");
    expect(sanitizeStylesheet("a { outline: none !important }").css).toContain("!important");
  });

  it("is make the ring invisible by its color: the ring is drawn in the app's accent, and --graview-focus-color is not a view's to set", () => {
    expect(sanitizeStylesheet("button { --graview-focus-color: transparent; color: red }")).toEqual({ css: "button { color: red; }", refused: [{ reason: "property", name: "--graview-focus-color" }] });
    expect(sanitizeDeclarations("--graview-focus-color: transparent").refused).toEqual([{ reason: "property", name: "--graview-focus-color" }]);
    expect(sanitizeStylesheet("button { --graview-focus-width: 5px; --graview-focus-offset: 4px }").refused).toEqual([]);
  });
});
