import { describe, expect, it } from "vitest";
import { compareViewRevision, selectorsOfStylesheet, stringsOfSource } from "../../src/revisions.js";

/*
 * A REVISED VIEW IS COMPARED WITH WHAT IT REPLACES (Roadmap
 * f-revisions-say-what-broke): classes it still draws that lost every rule
 * styling them, rules taken out from under markup still drawn, sections
 * gone, and the page's height — never a class that was never styled. A run
 * of each side is in @graview/guest's
 * a-revised-view-says-what-it-stopped-styling.test.ts; here, the reading.
 */
const before = `
const CSS = \`
  .card { padding: 8px; }
  .card .meta, .card .when { color: var(--graview-ink-muted); }
  @media (max-width: 640px) { .grid { display: block; } }
  @keyframes pulse { from { opacity: 0 } to { opacity: 1 } }
\`;
graview.style(CSS);
const tidy = (s) => s.replace(/"/g, "'"); // a regular expression with a quote in it
graview.onProps((props) => graview.render(graview.html\`<div class="grid js-hook">
  <h2>Upcoming</h2>
  \${props.nodes.map((n) => graview.html\`<article class="card is-\${n.kind}"><p class="meta">\${n.label}</p><p class="when">soon</p></article>\`)}
  <nav aria-label="Pages"><a data-place="home">Home</a></nav>
</div>\`));
`;

describe("a view's source read for what it styles and draws", () => {
  it("reads every quoted string and template, an interpolation left as a hole, and passes over a regular expression with a quote in it", () => {
    const strings = stringsOfSource(before);
    expect(strings.some((one) => one.includes(".card { padding: 8px; }"))).toBe(true);
    expect(strings).toContain("'");
    expect(strings.some((one) => one.includes('<article class="card is-\u0000">'))).toBe(true);
  });

  it("reads a stylesheet's selectors through @media, never a keyframe's steps", () => {
    expect(selectorsOfStylesheet(".a, .b > .c { x: 1 } @media (min-width: 1px) { .d:hover { y: 2 } } @keyframes k { from { o: 0 } } /* .e { } */")).toEqual([".a", ".b>.c", ".d:hover"]);
  });
});

describe("a revision compared with what it replaces", () => {
  it("says a class still drawn whose rules went, and a rule taken out while its markup is still drawn", () => {
    const after = before.replace(".card .meta, .card .when { color: var(--graview-ink-muted); }", ".card .meta { color: var(--graview-ink-muted); } .when { font-size: 12px; }").replace("@media (max-width: 640px) { .grid { display: block; } }", "");
    const revision = compareViewRevision({ source: before }, { source: after });
    expect(revision.unstyled).toEqual([{ class: "grid", styledBy: [".grid"] }]);
    expect(revision.selectorsRemoved).toEqual([
      { selector: ".card .when", names: [".card", ".when"] },
      { selector: ".grid", names: [".grid"] },
    ]);
    expect(revision.said).toEqual([
      "A class it still draws lost every rule that styled it before: .grid. Put back the rules for it, or stop drawing it.",
      'A rule was taken out while the markup it styled is still drawn: ".card .when".',
    ]);
  });

  it("never says a class that no rule styled before: a hook, a utility, a class made from data", () => {
    const after = before.replace(".card { padding: 8px; }", ".card { padding: 12px; }");
    const revision = compareViewRevision({ source: before }, { source: after });
    expect(revision.regressed).toBe(false);
    expect(revision.unstyled).toEqual([]);
    expect(revision.text).toBe("Nothing it drew before lost its style, and no section it drew is gone.");
  });

  it("does not say a class the revision stopped drawing along with its rule", () => {
    const after = before.replace(' class="grid js-hook"', ' class="js-hook"').replace("@media (max-width: 640px) { .grid { display: block; } }", "");
    expect(compareViewRevision({ source: before }, { source: after }).unstyled).toEqual([]);
  });

  it("says a section drawn before and gone now, by its heading or its name", () => {
    const after = before.replace('<nav aria-label="Pages"><a data-place="home">Home</a></nav>', "").replace("<h2>Upcoming</h2>", "");
    const revision = compareViewRevision({ source: before }, { source: after });
    expect(revision.sectionsMissing).toEqual([
      { name: "Pages", as: "nav" },
      { name: "Upcoming", as: "heading" },
    ]);
    expect(revision.said).toContain('2 sections drawn before are not drawn now: "Pages", "Upcoming".');
  });

  it("says the page's height when it moved by a tenth or more, and gives the change whatever it was", () => {
    expect(compareViewRevision({ source: before, height: 3_000 }, { source: before, height: 1_200 }).said).toEqual(["The page is 1,200px tall, down from 3,000px (−60%)."]);
    const little = compareViewRevision({ source: before, height: 3_000 }, { source: before, height: 3_100 });
    expect(little.height).toEqual({ before: 3_000, after: 3_100, change: 100, ratio: 0.033 });
    expect(little.said).toEqual([]);
  });

  it("reads a host's class list and stylesheet over the source where it has them", () => {
    const revision = compareViewRevision({ source: "", css: ".x { a: 1 } .y { b: 2 }", classes: ["x", "y"] }, { source: "", css: ".x { a: 1 }", classes: ["x", "y", "z"] });
    expect(revision.read).toEqual({ before: "drawing", after: "drawing" });
    expect(revision.unstyled.map((one) => one.class)).toEqual(["y"]);
  });
});
