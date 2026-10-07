import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, DARK, defineApp, defineNode, LIGHT } from "../../src/index.js";
import { figureBrief, figureFaults, FIGURES, figureSvg } from "../../src/figures.js";
import { checkApp } from "../../src/check.js";

/**
 * A FIGURE THAT CANNOT BE DRAWN IS A BLANK NOBODY EXPLAINS.
 *
 * Every fault here looks fine in the file and fails on a screen — which is
 * exactly the class of thing a checker is for.
 */

const withFigure = (figure: string) =>
  defineApp({
    name: "drawn",
    schema: createSchema([
      defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things", figure }),
    ]),
  });
const codes = (figure: string) => checkApp(withFigure(figure)).findings.map((f) => f.code);

describe("the shipped figures", () => {
  it("are all drawable by the rules the checker holds a figure to", () => {
    for (const [name, art] of Object.entries(FIGURES)) {
      expect(figureFaults(art), name).toEqual([]);
      expect(codes(name), name).toEqual([]);
    }
  });

  it("are line art: one viewBox, currentColor, and no fill but none", () => {
    for (const [name, art] of Object.entries(FIGURES)) {
      expect(art, name).toContain('viewBox="0 0 24 24"');
      expect(art, name).toContain('stroke="currentColor"');
      expect(art, name).toContain('fill="none"');
      // Never a badge: no text, no gradient, no literal color anywhere.
      expect(art, name).not.toMatch(/<text|<image|gradient|#[0-9a-f]{3,6}/i);
    }
  });
});

describe("what a figure has to be", () => {
  it("takes inline SVG or a shipped name, and nothing else", () => {
    expect(figureSvg("person")).toBe(FIGURES["person"]);
    expect(figureSvg('<svg viewBox="0 0 24 24"><path stroke="currentColor" d="M0 0"/></svg>')).toContain("<svg");
    expect(figureSvg("a-drawing-of-a-horse")).toBeUndefined();
    expect(figureSvg(undefined)).toBeUndefined();
  });

  it("refuses a name nothing ships", () => {
    expect(codes("a-drawing-of-a-horse")).toContain("figure-undrawable");
  });

  it("refuses art with no viewBox, because nothing can size it", () => {
    expect(codes('<svg><path stroke="currentColor" d="M0 0"/></svg>')).toContain("figure-undrawable");
  });

  it("refuses a literal color, which is invisible in one of the two schemes", () => {
    const faults = figureFaults('<svg viewBox="0 0 24 24"><path stroke="#333" d="M0 0"/></svg>');
    expect(faults.join(" ")).toContain("#333");
    expect(faults.join(" ")).toContain("currentColor");
  });

  it("refuses art that strokes with nothing, because it will not take the kind's ink", () => {
    expect(figureFaults('<svg viewBox="0 0 24 24"><rect fill="none" width="4" height="4"/></svg>').length)
      .toBeGreaterThan(0);
  });

  it("refuses a brand drawing a figure for a kind the app does not declare", () => {
    const app = defineApp({
      name: "drawn",
      schema: createSchema([defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things" })]),
      // A real palette, because the checker measures one — a stub would be
      // testing the contrast rules rather than the figure rules.
      brand: { name: "b", schemes: { dark: DARK, light: LIGHT }, figures: { nobody: "person" } },
    });
    expect(checkApp(app).findings.map((f) => f.code)).toContain("figure-unknown-kind");
  });

  it("says nothing at all about a kind with no figure", () => {
    const app = defineApp({
      name: "plain",
      schema: createSchema([defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things" })]),
    });
    expect(checkApp(app).findings.filter((f) => f.code.startsWith("figure-"))).toEqual([]);
  });
});

/**
 * NINE FIGURES IS A VOCABULARY TO START FROM, NOT ONE TO FINISH IN.
 *
 * The shipped set is deliberately generic — the things almost every domain
 * turns out to have — and any domain that is not an abstract tracker runs
 * out of it at once: an outdoors product needed eleven figures and had to
 * draw ten. Growing the set moves that wall rather than removing it, so the
 * answer is the authoring loop, through the door every app has: a brief to
 * copy, an answer to paste, and the same judging `graview check` does.
 */
describe("the brief a figure is drawn from", () => {
  const brief = figureBrief("gutter", "a gutter along a roof edge");

  it("says what the thing is, and what a figure is not", () => {
    expect(brief).toContain('a node kind called "gutter": a gutter along a roof edge');
    expect(brief).toContain("line art of the THING");
    expect(brief).toContain("never a badge");
    expect(brief).toContain("three-quarter isometric angle");
  });

  it("names every rule the checker will hold the answer to", () => {
    /* Each of these is a fault figureFaults reports, said before the fact. */
    expect(brief).toContain('viewBox="0 0 24 24"');
    expect(brief).toContain("currentColor");
    expect(brief).toContain("no literal color anywhere");
    expect(brief).toContain("READ AT TWENTY PIXELS");
  });

  it("hands over a shipped figure as the style rather than describing it", () => {
    expect(brief).toContain(FIGURES["person"]!);
  });

  it("ends by saying how to bring the answer back", () => {
    expect(brief).toContain("--judge");
  });
});
