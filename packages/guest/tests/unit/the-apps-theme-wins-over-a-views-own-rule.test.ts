// @vitest-environment jsdom
import { sanitizeStylesheet } from "@graview/core/css";
import { describe, expect, it } from "vitest";
import { dressedCss, inLayer, VIEW_LAYERS } from "../../src/host/cascade.js";
import { createOpenDrawing, REGION_CSS } from "../../src/host/open-draw.js";

/**
 * THE APP'S THEME WINS OVER A VIEW'S OWN RULE (Roadmap
 * f-view-authoring-friction-2026-11). The brand's `views.css` was drawn
 * before each view's own sheet, unlayered as it was, so any rule a view
 * wrote beat it and a design system could not hold. Every sheet in a
 * view's region is now in a cascade layer of the host's, the theme's last:
 * a later layer wins over an earlier one whatever the specificity, so the
 * theme's rule wins wherever both style the same element. The host's own
 * `!important` rules (the ring, less motion) are in the first layers, which
 * an important declaration's order reverses, so nothing a view writes takes
 * them away. That a browser draws it so is guest-sandbox's brand claims.
 */
describe("the layers of a view's region", () => {
  it("are declared first, in the order motion, region, view, theme: the theme's last, so it wins", () => {
    expect(VIEW_LAYERS).toBe("@layer graview-motion, graview-region, graview-view, graview-theme;");
    expect(REGION_CSS.trim().startsWith(VIEW_LAYERS)).toBe(true);
  });

  it("hold every rule of the host's own: none of it is left unlayered, where it would beat the view's and the theme's", () => {
    const outside = REGION_CSS.replace(VIEW_LAYERS, "").replace(/@layer graview-(region|motion) \{[\s\S]*?\n\}\n?/g, "").replace(/@layer graview-motion \{.*\} \} \}/, "").trim();
    expect(outside).toBe("");
  });

  it("put the theme in the layer that wins and the view's own sheets in the one before it, on the page and in a headless run alike", () => {
    const theme = sanitizeStylesheet("h2 { color: var(--graview-accent); font-family: var(--graview-font-display) }").css;
    const own = sanitizeStylesheet(".rock h2.title#name { color: hotpink }").css;
    const shadow = document.body.appendChild(document.createElement("div")).attachShadow({ mode: "open" });
    const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
    drawing.theme("h2 { color: var(--graview-accent); font-family: var(--graview-font-display) }");
    drawing.style([".rock h2.title#name { color: hotpink }"]);
    expect(shadow.querySelector("[data-graview-view-theme]")!.textContent).toBe(`@layer graview-theme {\n${theme}\n}`);
    expect(shadow.querySelector("[data-graview-view-style]")!.textContent).toBe(`@layer graview-view {\n${own}\n}`);
    /* What a revision is compared by stays the view's own sheet, unlayered. */
    expect(drawing.css).toBe(own);
    expect(dressedCss(theme, own)).toBe(`${VIEW_LAYERS}\n${inLayer("graview-theme", theme)}\n${inLayer("graview-view", own)}`);
    /* With no theme, the view's sheet is drawn as it was. */
    expect(dressedCss("", own)).toBe(own);
    drawing.dispose();
  });

  it("leave the view no @layer of its own to reorder them with", () => {
    expect(sanitizeStylesheet("@layer graview-theme, graview-view; h2 { color: red }").refused).toContainEqual(expect.objectContaining({ reason: "at-rule" }));
  });
});
