import { describe, expect, it } from "vitest";
import { drawTranscript } from "../../src/headless/draw.js";
import { sayRefusal } from "../../src/headless/judge.js";
import { sanitizeDeclarations, sanitizeStylesheet, tokenize } from "../../src/host/css.js";
import { REGION_CSS } from "../../src/host/open-draw.js";
import { NEVER_DRAWN } from "../../src/open-kit.js";

/*
 * A VIEW DRAWS MASKS, FILTERS, STROKES AND SCROLL-DRIVEN MOTION (Roadmap
 * request gv-view-css-modern-effects). The Eagles app wanted a carousel's
 * edges faded with `mask-image`, outlined numerals with
 * `-webkit-text-stroke`, reveals and parallax on the scroll
 * (`animation-timeline`), and grain, glow and duotone from SVG filters; the
 * view drawer skipped each in silence. Each is drawn now, because none
 * opens a way out: a mask takes a gradient and every url() in it is still
 * refused, a filter is made of the view's own pixels and reached by
 * `url(#id)`, a scroll timeline reads only a scroll. Motion is held still
 * where a person asks for less. Two stay out, and say why: `@property`
 * registers a property for the whole page, the app's own among them, and
 * SMIL sets an attribute after the host judged it and moves past a
 * person's reduced-motion setting.
 */
const fetches = (css: string) => tokenize(css).filter((token) => token.type === "url" || token.type === "bad-url").length + [...css.matchAll(/url\(\s*"(?!#)/g)].length;

describe("CSS a view may now write", () => {
  it("keeps a mask made of a gradient, prefixed and not", () => {
    const said = sanitizeStylesheet(`.reel { mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000); mask-size: 100% 100%; -webkit-mask-repeat: no-repeat }`);
    expect(said.refused).toEqual([]);
    expect(said.css).toContain("mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)");
    expect(said.css).toContain("-webkit-mask-image: linear-gradient(90deg, transparent, #000)");
  });

  it("keeps no url() in a mask, from anywhere, nor an image-set()", () => {
    for (const css of [`.x { mask-image: url(https://attacker.example/m.png) }`, `.x { -webkit-mask-image: url("https://attacker.example/m2.png") }`, `.x { mask-image: image-set("https://attacker.example/m3.png" 1x) }`, `.x { -webkit-mask: url(https://attacker.example/m4.svg) }`]) {
      const said = sanitizeStylesheet(css);
      expect(said.css, css).not.toContain("attacker");
      expect(fetches(said.css), css).toBe(0);
    }
  });

  it("keeps an outlined numeral's stroke", () => {
    const said = sanitizeStylesheet(`.big { -webkit-text-stroke: 2px var(--graview-accent); -webkit-text-fill-color: transparent } .thin { -webkit-text-stroke-width: 1px; -webkit-text-stroke-color: currentColor }`);
    expect(said.refused).toEqual([]);
    expect(said.css).toContain("-webkit-text-stroke: 2px var(--graview-accent)");
  });

  it("keeps a scroll-driven reveal and a parallax: animation-timeline, its range, and scroll() and view()", () => {
    const said = sanitizeStylesheet(`@keyframes rise { from { opacity: 0; translate: 0 2rem } to { opacity: 1; translate: 0 0 } }
.reveal { animation: rise linear both; animation-timeline: view(); animation-range: entry 0% cover 40% }
.back { animation: drift linear; animation-timeline: scroll(nearest block) }
.lane { scroll-timeline: --lane inline } .dot { animation-timeline: --lane; animation-range-start: 10%; animation-range-end: 90% }
.page { timeline-scope: --lane; view-timeline: --card block; view-timeline-inset: 10% }`);
    expect(said.refused).toEqual([]);
    expect(said.css).toContain("animation-timeline: view()");
    expect(said.css).toContain("animation-timeline: scroll(nearest block)");
    expect(said.css).toContain("animation-range: entry 0% cover 40%");
  });

  it("keeps a filter reached by url(#id), and no other url() in a filter", () => {
    expect(sanitizeStylesheet(`.grain { filter: url(#grain) contrast(1.1) }`).css).toBe('.grain { filter: url("#grain") contrast(1.1); }');
    const said = sanitizeStylesheet(`.x { filter: url(https://attacker.example/f.svg#f) }`);
    expect(said.css).not.toContain("attacker");
    expect(said.refused).toEqual([{ reason: "url", name: "filter" }]);
  });

  it("refuses @property, and says why: it would register the property for the whole page", () => {
    const said = sanitizeStylesheet(`@property --turn { syntax: "<angle>"; inherits: false; initial-value: 0deg } .dial { --turn: 0deg }`);
    expect(said.css).not.toMatch(/@property/);
    expect(said.refused).toContainEqual({ reason: "at-rule", name: "@property" });
    expect(sayRefusal({ reason: "css", name: "stylesheet", css: { reason: "at-rule", name: "@property" } }).says).toMatch(/registers a property for the whole page/);
  });

  it("says a motion property in a style attribute without !important, so a person's wish for less motion holds", () => {
    expect(sanitizeDeclarations("animation-duration: 10s !important; color: red !important").css).toBe("animation-duration: 10s; color: red !important");
  });
});

describe("motion, where a person asks for less", () => {
  it("is held still in the host's own layer: every animation once, at once, on no scroll, and every transition as short", () => {
    const rule = /@layer graview-motion \{ @media \(prefers-reduced-motion: reduce\) \{([^]*)\} \} \}/.exec(REGION_CSS)?.[1] ?? "";
    for (const said of ["animation-duration: 1ms !important", "animation-iteration-count: 1 !important", "animation-timeline: auto !important", "transition-duration: 1ms !important"]) expect(rule).toContain(said);
  });
});

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `f${(ids += 1)}`, type: 1, element: name, attributes, children });
const draw = (svgChildren: unknown[]) => drawTranscript([[[0, "~", element("svg", { viewBox: "0 0 10 10" }, svgChildren), 0]]], [], { maxNodes: 200 });

describe("an SVG filter a view draws", () => {
  it("draws grain, glow and duotone from its own pixels", () => {
    const drawn = draw([
      element("filter", { id: "grain", x: "0", y: "0", width: "100%", height: "100%" }, [
        element("feTurbulence", { type: "fractalNoise", baseFrequency: "0.8", numOctaves: "3", stitchTiles: "stitch", result: "noise" }),
        element("feColorMatrix", { in: "noise", type: "saturate", values: "0" }),
        element("feComponentTransfer", {}, [element("feFuncA", { type: "linear", slope: "0.2" })]),
        element("feBlend", { in: "SourceGraphic", in2: "noise", mode: "multiply" }),
      ]),
      element("filter", { id: "glow" }, [element("feGaussianBlur", { stdDeviation: "2", result: "blur" }), element("feFlood", { "flood-color": "var(--graview-accent)" }), element("feMerge", {}, [element("feMergeNode", { in: "blur" }), element("feMergeNode", { in: "SourceGraphic" })])]),
      element("circle", { cx: "5", cy: "5", r: "3", filter: "url(#glow)" }),
    ]);
    expect(drawn.refused).toEqual([]);
  });

  it("draws no <feImage>, and says it loads an image", () => {
    const drawn = draw([element("filter", { id: "f" }, [element("feImage", { href: "https://attacker.example/i.png" })])]);
    expect(drawn.refused).toEqual([{ reason: "element", element: "feImage" }]);
    expect(sayRefusal(drawn.refused[0]!).says).toMatch(/It loads an image/);
  });

  it("refuses SMIL, and says to animate with @keyframes, which is held to reduced motion", () => {
    expect(NEVER_DRAWN.svg as readonly string[]).toEqual(expect.arrayContaining(["animate", "animateTransform", "animateMotion", "set"]));
    const drawn = draw([element("circle", { r: "3" }, [element("animate", { attributeName: "r", values: "3;4;3", dur: "1s" })])]);
    expect(drawn.refused).toEqual([{ reason: "element", element: "animate" }]);
    expect(sayRefusal(drawn.refused[0]!).says).toMatch(/animate with CSS @keyframes/);
  });
});
