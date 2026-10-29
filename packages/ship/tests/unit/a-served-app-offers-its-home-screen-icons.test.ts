import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCHEMES, type Brand } from "@graview/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { homeScreenAnswer } from "../../src/home-screen.js";
import { servePreview, type Preview } from "../../src/serve-preview.js";

/**
 * A SERVED APP OFFERS ITS HOME-SCREEN ICONS (Roadmap f-app-icons-home-screen).
 * `graview preview` writes the head `homeScreenOf` says into the page it
 * serves — the icon typed by what it is, the manifest, a theme-color — and
 * answers the manifest and an SVG mark at their paths; `graview serve`
 * answers the same files. A PNG made from the brand's own PNG is the
 * brand's PNG, sent to; nothing else is answered.
 */
const ORG = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/org.gdd.json", import.meta.url), "utf8")) as { name: string; brand?: Record<string, unknown> };
const ORG_SEED = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/org.seed.json", import.meta.url), "utf8"));
const PAGE = '<!doctype html><html><head><title>the page</title></head><body>\n<div id="graview-app"></div>\n<script type="module" src="/page.js"></script></body></html>';

let page: string;
let preview: Preview;
beforeAll(async () => {
  page = mkdtempSync(join(tmpdir(), "graview-home-screen-"));
  writeFileSync(join(page, "index.html"), PAGE);
  preview = await servePreview({ document: { ...ORG, brand: { ...(ORG.brand ?? {}), favicon: { emoji: "🏡" }, scheme: "dark" } }, seed: ORG_SEED, page });
});
afterAll(async () => {
  await preview.close();
  rmSync(page, { recursive: true, force: true });
});

describe("a preview's head and its files", () => {
  it("writes the icon, the manifest and the app's one color into the page's head", async () => {
    const html = await (await fetch(`${preview.url}/`)).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain('<link rel="icon" type="image/svg+xml" href="/icon.svg">');
    expect(head).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    expect(head.match(/<meta name="theme-color" content="#[0-9a-f]{6}">/g)).toHaveLength(1);
    // An emoji is no PNG without a rasterizer: no apple-touch-icon is promised.
    expect(head).not.toContain("apple-touch-icon");
  });

  it("answers the manifest and the SVG mark at their paths", async () => {
    const manifest = await fetch(`${preview.url}/manifest.webmanifest`);
    expect(manifest.headers.get("content-type")).toBe("application/manifest+json");
    const said = (await manifest.json()) as { name: string; display: string; start_url: string; icons: { src: string; type: string; sizes: string }[] };
    expect(said).toMatchObject({ name: ORG.name, display: "standalone", start_url: "/" });
    expect(said.icons).toEqual([{ src: "/icon.svg", type: "image/svg+xml", sizes: "any" }]);
    const icon = await fetch(`${preview.url}/icon.svg`);
    expect(icon.headers.get("content-type")).toBe("image/svg+xml");
    expect(await icon.text()).toContain("🏡");
  });
});

describe("what a server answers of an app on a home screen", () => {
  const brand: Brand = { name: "Discography", schemes: SCHEMES, favicon: "/graview/assets/787c.png" };
  const { answer, screen } = homeScreenAnswer(brand);
  it("sends a PNG's sizes to the brand's own PNG, and answers nothing it does not name", () => {
    expect(screen.files.map((file) => file.path)).toEqual(["/manifest.webmanifest", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"]);
    const sent = answer(new Request("http://localhost/apple-touch-icon.png"));
    expect(sent?.status).toBe(307);
    expect(sent?.headers.get("location")).toBe("/graview/assets/787c.png");
    expect(answer(new Request("http://localhost/icon.svg"))).toBeUndefined();
    expect(answer(new Request("http://localhost/graview/state"))).toBeUndefined();
    expect(answer(new Request("http://localhost/manifest.webmanifest", { method: "POST", body: "{}" }))).toBeUndefined();
  });
});
