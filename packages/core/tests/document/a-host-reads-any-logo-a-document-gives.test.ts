import { describe, expect, it } from "vitest";
import { capabilities } from "../../src/index.js";
import { logoOfDocument } from "../../src/document/index.js";

/**
 * A HOST READS ANY LOGO A DOCUMENT GIVES (FR-197). A document's
 * `brand.logo` is a string, `{ src, alt }`, or one for each scheme,
 * `{ light, dark?, alt?, darkFallback?: "invert" }`; `logoOf` reads only a
 * compiled brand, so a host that drew the logo from the document read the
 * three forms itself. `logoOfDocument` reads them all into the one shape.
 * And the third form is a seam a host stores only on a build that ships
 * it, so a rollback below it never leaves an app that cannot open.
 */
const LIGHT = "/graview/assets/0f3a.jpg";
const DARK = "/graview/assets/9b2c.png";

describe("logoOfDocument", () => {
  it("reads a string as the light one, and the dark one too", () => {
    expect(logoOfDocument(LIGHT)).toEqual({ light: LIGHT });
  });

  it("reads { src, alt } as the light one with its words", () => {
    expect(logoOfDocument({ src: LIGHT, alt: "Acme" })).toEqual({ light: LIGHT, alt: "Acme" });
    expect(logoOfDocument({ src: LIGHT })).toEqual({ light: LIGHT });
  });

  it("reads one for each scheme as it was given", () => {
    expect(logoOfDocument({ light: LIGHT, dark: DARK, alt: "Acme" })).toEqual({ light: LIGHT, dark: DARK, alt: "Acme" });
    expect(logoOfDocument({ light: LIGHT, darkFallback: "invert" })).toEqual({ light: LIGHT, darkFallback: "invert" });
  });

  it("reads no logo where there is none, or none it could draw", () => {
    for (const none of [undefined, null, "", {}, { alt: "Acme" }, { light: "" }, { src: "" }, 3]) expect(logoOfDocument(none)).toBeUndefined();
  });

  it("keeps only a fallback a logo can have", () => {
    expect(logoOfDocument({ light: LIGHT, darkFallback: "guess" })).toEqual({ light: LIGHT });
    expect(logoOfDocument({ light: LIGHT, dark: "" })).toEqual({ light: LIGHT });
  });
});

describe("the logo for each scheme is a seam a host reads", () => {
  it("is named in capabilities().shipped", () => {
    expect(capabilities().shipped).toContain("FR-197");
  });
});
