#!/usr/bin/env node
/**
 * THE SHARE IMAGE IS THE HOME'S OPENING.
 *
 * `docs/site/og.png` is what a link to graview.dev shows in a chat or a feed:
 * the home's first screen, the headline on its sheet over the app an agent
 * drew, the hole through it showing the map behind. Photographed from the
 * site as it is served (its own faces load only over HTTP), at the card's
 * 1200 by 630, with the hole put where it shows the map best. Run it after
 * the opening changes; it needs Playwright's Chromium.
 *
 *   node scripts/site-og.mjs
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(repoRoot, "docs/site");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".css": "text/css" };
const server = createServer((request, response) => {
  let file = normalize(join(root, decodeURIComponent(new URL(request.url ?? "/", "http://site").pathname)));
  if (!file.startsWith(root)) return void response.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
});
const port = portFor("site-preview");
await new Promise((ok) => server.listen(port, "127.0.0.1", ok));

const browser = await launchEngine("chromium", { headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("drawn"), null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  /* A picture, not a page: the controls a reader presses (the scenes' dots, the records) are left out of it. */
  await page.addStyleTag({ content: ".dots, .records { visibility: hidden !important; }" });
  /* The hole over the table, where the map behind it shows its blocks. */
  await page.evaluate(() => window.__home.at(0, 0.73, 0.6));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(root, "og.png") });
  process.stdout.write("photographed the home's opening into docs/site/og.png\n");
} finally {
  await browser.close();
  server.close();
}
