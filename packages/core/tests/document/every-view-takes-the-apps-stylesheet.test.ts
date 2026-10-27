import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AnySchema, GraviewApp } from "../../src/index.js";
import { compileDocument } from "../../src/check.js";
import { OPEN_MAX_STYLESHEET, sanitizeStylesheet } from "../../src/css.js";
import { diffDocuments, editDocument, type GraviewDocument } from "../../src/document/index.js";

/**
 * EVERY VIEW TAKES THE APP'S STYLESHEET (Roadmap f-app-wide-view-theme).
 * Each custom view carried its own copy of the stylesheet, so a polished
 * home and the record pages drifted apart. A document's `brand.views` now
 * names what every worker view inherits: `css`, a stylesheet the host
 * draws before each view's own, and `motion: "fade"` between records. It
 * is held to the one sanitizer a page draws a view's stylesheet through —
 * `@graview/core/css`, the guest host's own — so `graview check` says
 * exactly what a page would leave out, at `brand.views.css`; `set-brand`
 * takes it and says what it did; and it reaches the `Brand` a page draws
 * from, so the host needs no second reading of the document.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const enDash = read("en-dash.gdd.json") as GraviewDocument;
const THEME = ".card { background: var(--graview-panel); border-radius: var(--graview-radius); padding: 12px }\nh2 { font-family: var(--graview-font-display); letter-spacing: 0.02em }";
const LEAKY = `${THEME}\n.card { background: url(https://attacker.example/paper.png) }\n@import url(https://attacker.example/theme.css);`;

const withViews = (views: Record<string, unknown> | undefined): GraviewDocument => ({ ...enDash, brand: { ...enDash.brand, ...(views ? { views } : {}) } as GraviewDocument["brand"] });
const compiled = (document: GraviewDocument) => compileDocument(document, { today: () => "2026-10-27" });
const findingsAt = (document: GraviewDocument, path: string) => compiled(document).findings.filter((f) => f.path === path);

describe("a document's brand.views", () => {
  it("compiles with no finding, and the Brand a page draws from carries the stylesheet and the fade", () => {
    const result = compiled(withViews({ css: THEME, motion: "fade" }));
    expect(result.ok).toBe(true);
    expect(result.findings.filter((f) => f.path.startsWith("brand.views"))).toEqual([]);
    const brand = (result.ok ? (result.app as GraviewApp<AnySchema>).brand : undefined)!;
    expect(brand.views).toEqual({ css: THEME, motion: "fade" });
  });

  it("is absent from the Brand when the document names none", () => {
    const result = compiled(enDash);
    expect(result.ok && (result.app as GraviewApp<AnySchema>).brand?.views).toBeUndefined();
  });

  it("is judged by the sanitizer a page draws it through: what the open kit leaves out is a warning at brand.views.css, said by name", () => {
    const [warned, ...rest] = findingsAt(withViews({ css: LEAKY }), "brand.views.css");
    expect(rest).toEqual([]);
    expect(warned).toMatchObject({ code: "brand-views-css", severity: "warning" });
    expect(warned!.message).toContain("url() in background");
    expect(warned!.message).toContain("@import");
    expect(warned!.message).toContain("every view is drawn without those parts");
    expect(warned!.fix).toContain("url(#id)");
    /* The same judge: what the finding names is exactly what the page's sanitizer refuses. */
    expect(sanitizeStylesheet(LEAKY).refused.map((one) => one.reason)).toEqual(["url", "at-rule"]);
  });

  it("refuses a stylesheet longer than a view's may be, at the same character limit the page holds a view's to", () => {
    const long = `.a { color: red }`.repeat(Math.ceil(OPEN_MAX_STYLESHEET / 17) + 1);
    expect(long.length).toBeGreaterThan(OPEN_MAX_STYLESHEET);
    const result = compiled(withViews({ css: long }));
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.path === "brand.views.css" && f.severity === "error")).toBe(true);
  });

  it("takes only none or fade as its motion", () => {
    const result = compiled(withViews({ motion: "slide" }));
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.path === "brand.views.motion")).toBe(true);
  });
});

describe("set-brand", () => {
  it("takes views: the stylesheet and the fade, each said in words, and the diff says the same", () => {
    const outcome = editDocument(enDash, [{ op: "set-brand", views: { css: THEME, motion: "fade" } }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.brand?.views).toEqual({ css: THEME, motion: "fade" });
    expect(outcome.said).toEqual(["Every view is drawn with the app's own stylesheet before its own.", "A view fades when the record it shows changes."]);
    expect(diffDocuments(enDash, outcome.document).sentences).toEqual(["Every view is drawn with the app's own stylesheet before its own.", "A view fades when the record it shows changes."]);
  });

  it("changes one part and keeps the other, and says only what changed", () => {
    const dressed = editDocument(enDash, [{ op: "set-brand", views: { css: THEME, motion: "fade" } }]);
    if (!dressed.ok) throw new Error(JSON.stringify(dressed.findings));
    const stilled = editDocument(dressed.document, [{ op: "set-brand", views: { motion: "none" } }]);
    if (!stilled.ok) throw new Error(JSON.stringify(stilled.findings));
    expect(stilled.document.brand?.views).toEqual({ css: THEME });
    expect(stilled.said).toEqual(["A view changes records with no fade."]);
    expect(diffDocuments(dressed.document, stilled.document).sentences).toEqual(["A view changes records with no fade."]);
    const other = editDocument(stilled.document, [{ op: "set-brand", views: { css: `${THEME}\n.card { padding: 16px }` } }]);
    if (!other.ok) throw new Error(JSON.stringify(other.findings));
    expect(diffDocuments(stilled.document, other.document).sentences).toEqual(["The stylesheet every view is drawn with changes."]);
  });

  it("clears the stylesheet with null, and all of views with null, leaving the rest of the brand as it was", () => {
    const dressed = editDocument(enDash, [{ op: "set-brand", views: { css: THEME, motion: "fade" } }]);
    if (!dressed.ok) throw new Error(JSON.stringify(dressed.findings));
    const bare = editDocument(dressed.document, [{ op: "set-brand", views: { css: null } }]);
    if (!bare.ok) throw new Error(JSON.stringify(bare.findings));
    expect(bare.document.brand?.views).toEqual({ motion: "fade" });
    expect(bare.said).toEqual(["Every view is drawn with its own stylesheet alone."]);
    const none = editDocument(dressed.document, [{ op: "set-brand", views: null }]);
    if (!none.ok) throw new Error(JSON.stringify(none.findings));
    expect(none.document.brand?.views).toBeUndefined();
    expect(none.document.brand?.accent).toBe(enDash.brand?.accent);
    expect(none.said).toEqual(["Every view is drawn with its own stylesheet alone.", "A view changes records with no fade."]);
  });

  it("refuses a stylesheet the page would draw only part of, naming the part, so an agent learns at once rather than from a view that drew without it", () => {
    const outcome = editDocument(enDash, [{ op: "set-brand", views: { css: LEAKY } }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings).toHaveLength(1);
    expect(outcome.findings[0]).toMatchObject({ code: "brand-views-css", path: "edits.0.views.css" });
    expect(outcome.findings[0]!.message).toContain("url() in background");
  });

  it("refuses views that name nothing", () => {
    const outcome = editDocument(enDash, [{ op: "set-brand", views: {} }]);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.findings[0]!.message).toContain("views names no part to set");
  });
});
