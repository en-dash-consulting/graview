import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { servePreview, type Preview, type SplashRenderer } from "../../src/serve-preview.js";

/**
 * A PREVIEW OPENS ON THE DOCUMENT'S OWN SCREEN (Roadmap f-splash-in-document).
 * `graview preview` serves the page as built; given the opening screen's
 * renderer (the `graview` tool carries `@graview/pages/splash` beside the
 * page), a document whose brand has a `splash` is served with the screen's
 * style, markup and script inlined before the app's root — the first paint
 * — and a document without one, or a visitor's form, is served the page as
 * it was. The renderer is handed the brand and the app's name.
 */
const ORG = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/org.gdd.json", import.meta.url), "utf8")) as { name: string; brand?: Record<string, unknown> };
const ORG_SEED = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/org.seed.json", import.meta.url), "utf8"));
const PAGE = '<!doctype html><html><head><title>the page</title></head><body>\n<div id="graview-app"></div>\n<script type="module" src="/page.js"></script></body></html>';

const handed: unknown[] = [];
const splash: SplashRenderer = (brand, options) => {
  handed.push({ brand, options });
  const style = (brand["splash"] as { style: string }).style;
  return { html: `<div id="graview-splash" data-style="${style}"></div>`, css: "#graview-splash{position:fixed}", script: "/* the screen's script */" };
};

let page: string;
let plain: Preview;
let screened: Preview;
beforeAll(async () => {
  page = mkdtempSync(join(tmpdir(), "graview-splash-preview-"));
  writeFileSync(join(page, "index.html"), PAGE);
  plain = await servePreview({ document: ORG, seed: ORG_SEED, page, splash });
  screened = await servePreview({ document: { ...ORG, brand: { ...(ORG.brand ?? {}), splash: { style: "editorial", kicker: "Who does what" } } }, seed: ORG_SEED, page, splash });
});
afterAll(async () => {
  await plain.close();
  await screened.close();
  rmSync(page, { recursive: true, force: true });
});

const text = async (preview: Preview, path: string) => (await fetch(`${preview.url}${path}`)).text();

describe("a preview's first HTML", () => {
  it("carries the opening screen before the app's root when the document has one, and the renderer is handed the brand and the name", async () => {
    const html = await text(screened, "/");
    const screen = html.indexOf('<div id="graview-splash" data-style="editorial">');
    const root = html.indexOf('<div id="graview-app">');
    expect(screen).toBeGreaterThan(-1);
    expect(screen).toBeLessThan(root);
    expect(html).toContain("<style>#graview-splash{position:fixed}</style>");
    expect(html).toContain("<script>/* the screen's script */</script>");
    expect(handed).toContainEqual({ brand: { ...(ORG.brand ?? {}), splash: { style: "editorial", kicker: "Who does what" } }, options: { name: ORG.name } });
    // A place's address is the page too, with the screen in it.
    expect(await text(screened, "/people")).toContain('id="graview-splash"');
  });

  it("is the page as built when the document has no screen", async () => {
    const html = await text(plain, "/");
    expect(html).toBe(PAGE);
    expect(html).not.toContain("graview-splash");
  });
});
