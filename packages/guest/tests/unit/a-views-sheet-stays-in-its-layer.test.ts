// @vitest-environment jsdom
import { sanitizeDeclarations, sanitizeStylesheet, tokenize } from "@graview/core/css";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { LEAVING, ORDINARY, STAYING } from "../../../../scripts/fixtures/sheets-that-try-to-leave-their-layer.mjs";
import { dressedCss, inLayer } from "../../src/host/cascade.js";
import { createOpenDrawing, REGION_CSS } from "../../src/host/open-draw.js";

/**
 * A VIEW'S SHEET STAYS IN ITS LAYER. The host writes each sheet inside a
 * cascade layer of its own. The judges keep only what reads the same there
 * (`a-judged-stylesheet-cannot-close-what-holds-it`, core), and the wrapper
 * asks for itself: `inLayer` reads what it is given, and draws nothing of a
 * sheet that does not read as whole rules.
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

  it("is take the ring's color through the accent: the ring reads a color settled on the region, which a view cannot write", () => {
    expect(REGION_CSS).toMatch(/:host \{[^}]*--graview-ring-color: var\(--graview-accent, Highlight\)/);
    const rule = REGION_CSS.split("\n").find((line) => line.includes(":focus-visible"))!;
    expect(rule).toContain("outline-color: var(--graview-focus-color, var(--graview-ring-color, Highlight)) !important");
    expect(rule).not.toContain("var(--graview-accent");
    expect(sanitizeStylesheet("button { --graview-ring-color: transparent; --graview-accent: transparent }")).toEqual({ css: "button { --graview-accent: transparent; }", refused: [{ reason: "property", name: "--graview-ring-color" }] });
    expect(sanitizeDeclarations("--graview-ring-color: red").refused).toEqual([{ reason: "property", name: "--graview-ring-color" }]);
  });

  it("is hide the ring or flood the region by its width and offset: both are held, and each longhand stands alone, so a value that is no length takes only its own", () => {
    const rule = REGION_CSS.split("\n").find((line) => line.includes(":focus-visible"))!;
    expect(rule).toContain("outline-style: solid !important");
    expect(rule).toContain("outline-width: clamp(2px, var(--graview-focus-width, 2px), 8px) !important");
    expect(rule).toContain("outline-offset: clamp(-2px, var(--graview-focus-offset, 2px), 8px) !important");
    expect(rule).not.toMatch(/outline: /);
  });

  for (const color of ["#0a7", "#00aa77", "tomato", "Highlight"]) {
    it(`takes a plain color for the ring: ${color}`, () => {
      expect(sanitizeStylesheet(`button { --graview-focus-color: ${color} }`).refused).toEqual([]);
    });
  }
  for (const color of ["transparent", "TRANSPARENT", "transp\\61rent", "currentcolor", "#0000", "#00aa7700", "rgb(0 0 0 / 0)", "color-mix(in srgb, red, transparent)", "var(--anything)", "red blue"]) {
    it(`refuses what could take the ring's color away, here or by a var(): ${color}`, () => {
      expect(sanitizeStylesheet(`button { --graview-focus-color: ${color} }`).refused).toEqual([{ reason: "value", name: "--graview-focus-color" }]);
      expect(sanitizeDeclarations(`--graview-focus-color: ${color}`).refused).toEqual([{ reason: "value", name: "--graview-focus-color" }]);
    });
  }

  it("is reach the root's type: it inherits from the region, whatever a view's div or * says", () => {
    expect(REGION_CSS).toMatch(/:host \{[^}]*color: var\(--graview-ink, CanvasText\);[^}]*font-family: var\(--graview-font-body, system-ui, sans-serif\);[^}]*line-height: 1\.45;/);
    expect(REGION_CSS).toMatch(/\[data-graview-view-root\] \{[^}]*color: inherit !important; font-family: inherit !important; line-height: inherit !important;/);
  });

  it("is make the fade a jump: its transition is !important too", () => {
    expect(REGION_CSS).toMatch(/\[data-graview-motion="fade"\] \{ transition: opacity \d+ms ease !important; \}/);
  });
});

describe("one selector", () => {
  it("does not take a whole sheet with it: what the sanitizer keeps, the wrapper keeps, so a function that loads is refused in a selector", () => {
    for (const [given, name] of [['src("y")', "src"], ['url("y")', "url"], ['image-set("y" 1x)', "image-set"], ['-webkit-image-set("y" 1x)', "-webkit-image-set"], ['URL("y")', "url"], [':is(src("y"))', "src"]] as const) {
      const judged = sanitizeStylesheet(`.x { color: red } ${given} { color: blue }`);
      expect(judged.refused, given).toEqual([{ reason: "url", name }]);
      expect(judged.css, given).toBe(".x { color: red; }");
      expect(inLayer("graview-view", judged.css), given).not.toBe("");
    }
  });

  it("is said where the app's stylesheet draws nothing at all: theme() answers whether it drew", () => {
    const shadow = document.body.appendChild(document.createElement("div")).attachShadow({ mode: "open" });
    const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
    expect(drawing.theme(".x { color: red }")).toBe(true);
    expect(drawing.theme(undefined)).toBe(true);
    expect(drawing.theme("@import 'x.css';")).toBe(false);
    expect(shadow.querySelector("[data-graview-view-theme]")!.textContent).toBe("");
    drawing.dispose();
  });
});
