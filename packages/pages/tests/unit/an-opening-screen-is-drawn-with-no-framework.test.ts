import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { SPLASH_SHADERS as CORE_SHADERS, SPLASH_STYLES as CORE_STYLES } from "@graview/core/document";
import { SPLASH_ID, SPLASH_SHADERS, SPLASH_STYLES, splashHtml, type SplashBrand } from "../../src/splash.js";

/**
 * AN APP'S OPENING SCREEN IS DRAWN WITH NO FRAMEWORK (Roadmap
 * f-splash-in-document). What a page shows while the app's code loads
 * cannot wait on that code: `@graview/pages/splash` renders `brand.splash`
 * as HTML, CSS and one small script from the document alone — no React,
 * nothing of `@graview/*` — and the script takes the screen away once a
 * place says `data-graview-drawn`. The styles and the shader names are the
 * closed lists the checker holds, so a document the checker passed is one
 * this draws.
 */
const BRAND: SplashBrand = { name: "Harbor Catering", accent: "#0f6e5c", ground: { light: "#eef3f8", dark: "#101826" }, typography: { display: "system-serif" } };
const IMAGE = "/graview/assets/0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c.png";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

describe("the opening screen", () => {
  it("keeps the checker's lists of styles and shaders", () => {
    expect([...SPLASH_STYLES]).toEqual([...CORE_STYLES]);
    expect([...SPLASH_SHADERS]).toEqual([...CORE_SHADERS]);
  });

  it("answers nothing for a brand with no screen, and one element with its style, scheme and words for each style", () => {
    expect(splashHtml(BRAND)).toEqual({ html: "", css: "", script: "" });
    for (const style of SPLASH_STYLES) {
      const drawn = splashHtml({ ...BRAND, splash: { style, image: IMAGE, kicker: "Since 1998" } });
      expect(drawn.html).toContain(`id="${SPLASH_ID}"`);
      expect(drawn.html).toContain(`data-style="${style}"`);
      expect(drawn.html).toContain('data-scheme="auto"');
      expect(drawn.html).toContain("Since 1998");
      // The title is the app's name unless the screen says its own; the ascii screen types it on, so it starts empty.
      if (style === "ascii") expect(drawn.html).toContain('data-types="Harbor Catering"');
      else expect(drawn.html).toContain(">Harbor Catering</p>");
      expect(drawn.html).toContain(`src="${IMAGE}"`);
      expect(drawn.css).toContain(`#${SPLASH_ID}{--gs-ground:#eef3f8`);
      expect(drawn.css).toContain("--gs-ground:#101826");
      expect(drawn.css).toContain("Georgia");
      expect(drawn.script).toContain("data-graview-drawn");
      expect(drawn.script).toContain("prefers-reduced-motion");
      // The browser's top layer, above every rung of the ladder by the browser's say: no z-index of its own.
      expect(drawn.html).toContain('popover="manual"');
      expect(drawn.script).toContain("showPopover");
      expect(drawn.css).not.toMatch(/z-index/);
    }
    expect(splashHtml({ ...BRAND, splash: { style: "editorial", title: "Dinner, delivered" } }).html).toContain(">Dinner, delivered</p>");
    expect(splashHtml({ ...BRAND, scheme: "dark", splash: { style: "plain" } }).html).toContain('data-scheme="dark"');
    expect(splashHtml({ ...BRAND, splash: { style: "plain" } }, { scheme: "light" }).html).toContain('data-scheme="light"');
  });

  it("names the shader it will run, the first when unsaid or unknown, and ships every named one", () => {
    expect(splashHtml({ ...BRAND, splash: { style: "shader", shader: "ripple" } }).html).toContain('data-shader="ripple"');
    expect(splashHtml({ ...BRAND, splash: { style: "shader" } }).html).toContain(`data-shader="${SPLASH_SHADERS[0]}"`);
    expect(splashHtml({ ...BRAND, splash: { style: "shader", shader: "mine" } }).html).toContain(`data-shader="${SPLASH_SHADERS[0]}"`);
    const { script } = splashHtml({ ...BRAND, splash: { style: "shader" } });
    for (const name of SPLASH_SHADERS) expect(script).toContain(`${name}:"`);
    expect(script).toContain("u_progress");
  });

  it("escapes the words and the image, draws an inline SVG as a data URI, and draws no mark from another origin", () => {
    const drawn = splashHtml({ ...BRAND, splash: { style: "editorial", title: '<b>"Harbor" & co</b>', kicker: "<script>alert(1)</script>", image: SVG } });
    expect(drawn.html).not.toContain("<b>");
    expect(drawn.html).toContain("&lt;b&gt;&quot;Harbor&quot; &amp; co&lt;/b&gt;");
    expect(drawn.html).not.toContain("<script>alert");
    expect(drawn.html).toContain('src="data:image/svg+xml,');
    expect(splashHtml({ ...BRAND, splash: { style: "editorial", image: "https://elsewhere.example/a.png" } }).html).not.toContain("<img");
    expect(splashHtml({ ...BRAND, splash: { style: "editorial", image: 'javascript:alert(1)' } }).html).not.toContain("<img");
    // A face off the list, or one that could end the rule, falls back to the system's sans.
    expect(splashHtml({ ...BRAND, typography: { display: "x} body{display:none" }, splash: { style: "plain" } }).css).toContain("system-ui");
  });

  it("stands the app's own mark on the plain screen when it has no image, one for each scheme", () => {
    const one = splashHtml({ ...BRAND, logo: SVG, splash: { style: "plain" } });
    expect(one.html.match(/<img/g)?.length).toBe(1);
    const two = splashHtml({ ...BRAND, logo: { light: "/graview/assets/light.svg", dark: "/graview/assets/dark.svg" }, splash: { style: "plain" } });
    expect(two.html).toContain('data-scheme="light" src="/graview/assets/light.svg"');
    expect(two.html).toContain('data-scheme="dark" src="/graview/assets/dark.svg"');
    // An editorial screen with no image draws its words on the ground alone.
    expect(splashHtml({ ...BRAND, logo: SVG, splash: { style: "editorial" } }).html).not.toContain("<img");
  });
});

describe("the entry", () => {
  it("imports nothing at all", () => {
    const source = readFileSync(new URL("../../src/splash.ts", import.meta.url), "utf8");
    expect([...source.matchAll(/^import .*$/gm)].map((match) => match[0])).toEqual([]);
  });

  it("bundles to a few kilobytes with no React and nothing of the framework, and renders in a bare context with no window or document", async () => {
    const { build } = await import("esbuild");
    // @ts-expect-error — a plain .mjs module, without types.
    const { graviewSources } = await import("../../../../scripts/lib/graview-sources.mjs");
    const repo = fileURLToPath(new URL("../../../../", import.meta.url));
    const entry = `
      import { splashHtml } from "@graview/pages/splash";
      globalThis.rendered = splashHtml({ name: "Shelf", accent: "#0f6e5c", splash: { style: "ascii", kicker: "A catalog" } });
    `;
    const bundled = await build({ stdin: { contents: entry, resolveDir: repo, loader: "ts" }, bundle: true, write: false, format: "iife", platform: "neutral", minify: true, mainFields: ["module", "main"], plugins: [graviewSources(repo)], metafile: true, logLevel: "silent" });
    const inputs = Object.keys(bundled.metafile.inputs);
    expect(inputs.filter((path) => /node_modules\//.test(path))).toEqual([]);
    expect(inputs.filter((path) => /packages\/(core|react|primitives|tools|layout|render|embed|guest)\//.test(path))).toEqual([]);
    const bytes = bundled.outputFiles[0]!.contents.byteLength;
    // The whole renderer, its four shaders among it, minified: a host inlines it in its first HTML.
    expect(bytes).toBeLessThan(14 * 1024);
    const context = createContext({});
    runInContext(bundled.outputFiles[0]!.text, context);
    const rendered = (context as { rendered: { html: string; css: string; script: string } }).rendered;
    expect(rendered.html).toContain('data-style="ascii"');
    expect(rendered.html).toContain("A catalog");
    expect(rendered.script.length).toBeGreaterThan(1000);
  }, 60_000);

  it("writes a script that parses as plain, synchronous JavaScript", () => {
    const { script } = splashHtml({ ...BRAND, splash: { style: "shader" } });
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toContain("import ");
    expect(script).not.toContain("await ");
  });
});
