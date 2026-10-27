import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { diffDocuments, documentHash, editDocument, SPLASH_SHADERS, SPLASH_STYLES, toDocument, type Finding, type GraviewDocument } from "../../src/document/index.js";

/**
 * AN APP'S OPENING SCREEN IS IN ITS DECLARATION (Roadmap
 * f-splash-in-document). Graview Cloud kept the screen a page shows while
 * the app's code loads as a setting of its own, so an export, a remix into
 * a self-hosted app and an import all lost it. Now it is `brand.splash` —
 * a style from a closed list, an image as the logo takes one, a title, a
 * kicker and, for the shader style, the NAME of a shader the renderer
 * ships (never code: data is never code) — judged where the rest of the
 * brand is, set and cleared by `set-brand`, said by the diff, and carried
 * wherever the document goes because it is the document's.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const vendors = read("vendors.gdd.json") as GraviewDocument;
const ASSET = "/graview/assets/0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c.png";
const SPLASH = { style: "editorial", image: ASSET, title: "Our wedding", kicker: "Vendors, prices, who said yes" } as const;

const withSplash = (splash: unknown): GraviewDocument => ({ ...vendors, brand: { ...(vendors.brand ?? {}), splash } as GraviewDocument["brand"] });
const findings = (document: GraviewDocument): Finding[] => {
  const result = compileDocument(document, { today: () => "2026-10-27" });
  return (result.ok ? result.findings : result.findings).filter((f) => f.path.startsWith("brand.splash"));
};
const codes = (document: GraviewDocument) => findings(document).map((f) => `${f.severity} ${f.code} at ${f.path}`);

describe("an app's opening screen is in its document", () => {
  it("compiles with no finding for each style, with and without an image, and keeps it on the document", () => {
    for (const style of SPLASH_STYLES) {
      expect(codes(withSplash({ style }))).toEqual([]);
      expect(codes(withSplash({ ...SPLASH, style }))).toEqual([]);
    }
    for (const shader of SPLASH_SHADERS) expect(codes(withSplash({ style: "shader", shader }))).toEqual([]);
    const compiled = compileDocument(withSplash(SPLASH), { today: () => "2026-10-27" });
    expect(compiled.ok).toBe(true);
  });

  it("refuses an image that could act or lives on another origin, at brand.splash.image, as it refuses a logo", () => {
    expect(codes(withSplash({ style: "editorial", image: "https://elsewhere.example/hero.png" }))).toEqual(["error brand-splash-image at brand.splash.image"]);
    expect(codes(withSplash({ style: "ascii", image: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' }))).toEqual(["error brand-splash-image at brand.splash.image"]);
  });

  it("names a shader it does not ship, with the ones it does, and never takes code", () => {
    const refused = findings(withSplash({ style: "shader", shader: "my-own" }));
    expect(refused.map((f) => `${f.severity} ${f.code} at ${f.path}`)).toEqual(["error brand-splash-shader at brand.splash.shader"]);
    for (const name of SPLASH_SHADERS) expect(refused[0]!.fix).toContain(`"${name}"`);
    expect(refused[0]!.message).toContain("never carries one");
    // A fragment shader is not a name: refused the same way, never compiled.
    expect(codes(withSplash({ style: "shader", shader: "void main() { gl_FragColor = vec4(1.0); }" }))).toEqual(["error shape at brand.splash.shader"]);
  });

  it("says a shader named on a style that draws none is never drawn", () => {
    expect(codes(withSplash({ style: "plain", shader: "drift" }))).toEqual(["warning brand-splash-shader at brand.splash.shader"]);
  });

  it("refuses a style off the list, and a key it does not know, by path", () => {
    expect(codes(withSplash({ style: "custom", shader: "drift" })).some((code) => code.endsWith("at brand.splash.style"))).toBe(true);
    expect(codes(withSplash({ style: "plain", tint: "#c2410c" })).some((code) => code.includes("brand.splash"))).toBe(true);
  });
});

describe("set-brand takes the opening screen", () => {
  const edit = (document: GraviewDocument, edits: unknown[]) => editDocument(document, edits);

  it("sets it whole, says it, and the diff says the same; null clears it and says so", async () => {
    const set = edit(vendors, [{ op: "set-brand", splash: SPLASH }]);
    if (!set.ok) throw new Error(JSON.stringify(set.findings));
    expect(set.document.brand?.splash).toEqual(SPLASH);
    expect(set.said).toEqual(["The app opens on an editorial screen while it loads."]);
    expect(diffDocuments(vendors, set.document).sentences).toContain("The app opens on an editorial screen while it loads.");
    expect(await documentHash(set.document)).not.toBe(await documentHash(vendors));

    const shaded = edit(set.document, [{ op: "set-brand", splash: { style: "shader", shader: "ripple" } }]);
    if (!shaded.ok) throw new Error(JSON.stringify(shaded.findings));
    expect(shaded.said).toEqual(["The app opens on a shader screen (ripple) while it loads."]);

    const cleared = edit(set.document, [{ op: "set-brand", splash: null }]);
    if (!cleared.ok) throw new Error(JSON.stringify(cleared.findings));
    expect(cleared.document.brand?.splash).toBeUndefined();
    expect(cleared.said).toEqual(["The app opens on Graview's own screen."]);
    expect(await documentHash(cleared.document)).toBe(await documentHash(vendors));
    expect(diffDocuments(set.document, cleared.document).sentences).toContain("The app opens on Graview's own screen.");
  });

  it("refuses an image or a shader the compile would, at the edit's path, and applies nothing", () => {
    const image = edit(vendors, [{ op: "set-brand", splash: { style: "editorial", image: "https://elsewhere.example/hero.png" } }]);
    expect(image.ok).toBe(false);
    if (!image.ok) expect(image.findings.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-splash-image at edits.0.splash.image"]);
    const shader = edit(vendors, [{ op: "set-brand", splash: { style: "shader", shader: "mine" } }]);
    expect(shader.ok).toBe(false);
    if (!shader.ok) expect(shader.findings.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-splash-shader at edits.0.splash.shader"]);
    const style = edit(vendors, [{ op: "set-brand", splash: { style: "custom" } }]);
    expect(style.ok).toBe(false);
    if (!style.ok) expect(style.findings.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-splash-style at edits.0.splash.style"]);
  });
});

describe("the opening screen travels with the document", () => {
  it("survives an export and an import (the document as JSON) and a remix (the compiled app written back as its document)", async () => {
    const set = editDocument(vendors, [{ op: "set-brand", splash: SPLASH }]);
    if (!set.ok) throw new Error(JSON.stringify(set.findings));
    const exported = JSON.parse(JSON.stringify(set.document)) as GraviewDocument;
    expect(exported.brand?.splash).toEqual(SPLASH);
    const imported = compileDocument(exported, { today: () => "2026-10-27" });
    if (!imported.ok) throw new Error(JSON.stringify(imported.findings));
    const remixed = toDocument(imported.app);
    expect(remixed.document?.brand?.splash).toEqual(SPLASH);
    expect(await documentHash(remixed.document!)).toBe(await documentHash(set.document));
  });
});
