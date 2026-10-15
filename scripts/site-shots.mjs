#!/usr/bin/env node
/**
 * THE LANDING PAGE, PHOTOGRAPHED FOR A REVIEW.
 *
 * A pull request that changes how graview.dev looks says so with pictures:
 * the first screen and the whole page, at a laptop's width and a phone's,
 * in both schemes, with the live app in the hero mounted before the
 * picture is taken. Off the committed files, as a stranger's browser opens
 * them; nothing is served.
 *
 *   node scripts/site-shots.mjs [<out dir>] [--page=index.html]
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchEngine } from "./lib/engine.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? resolve(repoRoot, "out/site-shots"));
const file = (process.argv.find((a) => a.startsWith("--page=")) ?? "--page=index.html").slice(7);
mkdirSync(out, { recursive: true });

const browser = await launchEngine("chromium", { headless: true });
try {
  for (const width of [1440, 390]) {
    for (const scheme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width, height: width > 600 ? 900 : 844 }, colorScheme: scheme, deviceScaleFactor: width > 600 ? 1 : 2 });
      await page.goto(pathToFileURL(resolve(repoRoot, "docs/site", file)).href, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector(".hero-live [data-graview-view]") !== null, null, { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const name = `${file.replace(/\W+/g, "-").replace(/-html$/, "")}-${width}-${scheme}`;
      await page.screenshot({ path: resolve(out, `${name}-first-screen.png`) });
      await page.screenshot({ path: resolve(out, `${name}-full.png`), fullPage: true });
      process.stdout.write(`${name}\n`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
