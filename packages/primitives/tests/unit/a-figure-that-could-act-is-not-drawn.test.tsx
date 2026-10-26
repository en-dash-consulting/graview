import { DARK, LIGHT, type Brand } from "@graview/core";
import { FIGURES } from "@graview/core/figures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KindFigure } from "../../src/figure.js";

/*
 * WHAT DRAWS A FIGURE JUDGES IT. A kind's figure is put into the page as
 * markup, and the page may be handed art nothing judged: a brand's own
 * drawing, a document compiled without the check. Art with an attribute
 * written after a `/` — which the parser reads as a separate attribute —
 * draws the dot a kind without a figure has, never the handler.
 */
const schemaWith = (figure: string) => ({ tryDefinition: (kind: string) => (kind === "box" ? { figure } : undefined) });

describe("a figure that could act is not drawn", () => {
  it("draws no handler from a kind's figure or a brand's", () => {
    const art = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0h24v24H0z"/onclick="window.__planted=1"/></svg>';
    const declared = renderToStaticMarkup(<KindFigure kind="box" schema={schemaWith(art) as never} size={24} />);
    expect(declared).not.toContain("onclick");
    expect(declared).not.toContain("<svg");
    const brand: Brand = { name: "Boxes", schemes: { dark: DARK, light: LIGHT }, figures: { box: art } };
    const branded = renderToStaticMarkup(<KindFigure kind="box" brand={brand} size={24} />);
    expect(branded).not.toContain("onclick");
  });

  it("still draws a shipped figure", () => {
    const drawn = renderToStaticMarkup(<KindFigure kind="box" schema={schemaWith("box") as never} size={24} />);
    expect(drawn).toContain(FIGURES["box"]!.slice(0, 40));
  });
});
