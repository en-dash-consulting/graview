import { describe, expect, it } from "vitest";
import { assetSrc } from "../../src/index.js";

/**
 * A MARK UNDER AN APP'S BASE IS DRAWN THERE (Roadmap f-brand-marks-under-app-base).
 * A document names the app's own images at the host's root
 * (`/graview/assets/<sha>.<ext>`); a host serving each app under a base
 * says where (`assetsAt`), and only those paths move. Inline SVG, a `data:`
 * picture, a page-relative path and another origin are drawn as given.
 */
const under = (path: string) => `/a/tech-n9ne-discography${path}`;

describe("an app's own image under its base", () => {
  it("is drawn where the host serves it", () => {
    expect(assetSrc(under, "/graview/assets/8edab0.png")).toBe("/a/tech-n9ne-discography/graview/assets/8edab0.png");
  });
  it("leaves every other address as given, and every address with no assetsAt", () => {
    for (const href of ["data:image/svg+xml,%3Csvg%3E", "logo.svg", "https://example.com/graview/assets/x.png", "/graview/files/x.png"]) expect(assetSrc(under, href)).toBe(href);
    expect(assetSrc(undefined, "/graview/assets/8edab0.png")).toBe("/graview/assets/8edab0.png");
    expect(assetSrc(under, undefined)).toBeUndefined();
  });
});
