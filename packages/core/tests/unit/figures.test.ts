import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkApp, createSchema, DARK, defineApp, defineNode, figureFaults, FIGURES, figureSvg, LIGHT } from "../../src/index.js";

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
      // Never a badge: no text, no gradient, no literal colour anywhere.
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

  it("refuses a literal colour, which is invisible in one of the two schemes", () => {
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
