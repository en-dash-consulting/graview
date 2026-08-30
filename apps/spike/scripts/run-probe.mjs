#!/usr/bin/env node
/**
 * Drives the platform probe in a real Chromium with the HTML-in-Canvas flag
 * enabled, and writes the answers where the layout and renderer work will
 * see them.
 *
 * The flag has changed spelling more than once during the origin trial, so
 * every known spelling is passed; a build that does not recognise one ignores
 * it. If the API still is not there, the report says so — an absent answer is
 * recorded as absent rather than assumed.
 *
 *   node apps/spike/scripts/run-probe.mjs [--browser <path>] [--headed]
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

const CANDIDATE_BROWSERS = [
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

/** Every spelling the flag has had during the origin trial. */
const FLAGS = [
  "--enable-blink-features=CanvasDrawElement",
  "--enable-features=CanvasDrawElement,CanvasDrawElementAPI",
  "--enable-unsafe-webgpu",
  "--enable-features=Vulkan",
];

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function startVite() {
  const child = spawn(
    "npx",
    ["vite", "--port", "5187", "--strictPort"],
    { cwd: resolve(repoRoot, "apps/spike"), stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error("vite did not start in 30s")), 30_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("5187")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      rejectReady(new Error(`vite exited with ${code}`));
    });
  });
  return child;
}

const executablePath = arg("--browser") ?? CANDIDATE_BROWSERS.find(Boolean);
const vite = await startVite();
let report;
let browser;

try {
  browser = await chromium.launch({
    executablePath,
    headless: !process.argv.includes("--headed"),
    args: FLAGS,
  });
  const page = await browser.newPage();
  const consoleLines = [];
  page.on("console", (message) => consoleLines.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => consoleLines.push(`pageerror: ${error.message}`));

  await page.goto("http://localhost:5187/", { waitUntil: "load" });
  await page.waitForFunction(() => "__graviewReport" in window, undefined, { timeout: 120_000 });
  report = await page.evaluate(() => window.__graviewReport);
  report = { ...report, browser: executablePath, flags: FLAGS, console: consoleLines };
} catch (error) {
  report = { error: String(error), browser: executablePath, flags: FLAGS };
} finally {
  await browser?.close();
  vite.kill();
}

const out = resolve(repoRoot, "docs/platform-findings.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n\nwrote ${out}\n`);
