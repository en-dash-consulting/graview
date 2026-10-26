import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { figureFaults, FIGURES, figureSvg } from "../../src/figures.js";

/**
 * A FIGURE IS JUDGED AS THE PAGE READS IT. The HTML parser takes a `/` as
 * the space between two attributes, so `<path d="…"/onclick="…"/>` is a
 * path with a click handler; a judge that looks for a space before each
 * attribute's name saw a path. The figure is judged now by the reader the
 * logo is judged by (svgProblem), which reads attributes as the parser does,
 * and what draws a figure asks again before it hands the art to innerHTML.
 */
const SLASHED = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0h24v24H0z"/onclick="window.__planted=1"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"/style="position:fixed;inset:0"/onmouseover="window.__planted=1"><path d="M2 2h20v20H2z"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0"/style="x"/></svg>',
];

const documentWith = (figure: string): Parameters<typeof compileDocument>[0] =>
  ({
    name: "Boxes",
    kinds: { box: { figure, fields: { name: { type: "string", required: true } } } },
    acts: { "add-box": { title: "Add a box", creates: "box" } },
  }) as unknown as Parameters<typeof compileDocument>[0];

describe("a figure is judged as the page reads it", () => {
  for (const art of SLASHED) {
    it(`refuses an attribute written after a slash: ${art.slice(60, 110)}…`, () => {
      expect(figureFaults(art).length).toBeGreaterThan(0);
      expect(figureSvg(art)).toBeUndefined();
      const compiled = compileDocument(documentWith(art));
      expect(compiled.ok).toBe(false);
    });
  }

  it("still refuses the handler written after a space, and draws nothing for it", () => {
    const spaced = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0" onclick="x()"/></svg>';
    expect(figureFaults(spaced).join(" ")).toMatch(/onclick|event handler/);
    expect(figureSvg(spaced)).toBeUndefined();
  });

  it("draws every shipped figure, by name and as art", () => {
    for (const [name, art] of Object.entries(FIGURES)) {
      expect(figureSvg(name), name).toBe(art);
      expect(figureSvg(art), name).toBe(art);
    }
  });

  it("draws good art that a style rule alone faults, since a literal color is no danger", () => {
    const tinted = '<svg viewBox="0 0 24 24" fill="none" stroke="#333"><path d="M0 0h24"/></svg>';
    expect(figureFaults(tinted).length).toBeGreaterThan(0);
    expect(figureSvg(tinted)).toBe(tinted);
  });
});
