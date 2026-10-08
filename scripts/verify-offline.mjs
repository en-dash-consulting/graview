#!/usr/bin/env node
/**
 * A PART OF THE PAGE MISSED WHILE OFFLINE LOADS WHEN THE NETWORK IS BACK
 * (FR-139).
 *
 * Graview Cloud's realtime harness takes a person's browser offline for a
 * moment. Where the person's menu had not fetched its part yet, the page
 * fetched that chunk while offline, the import failed, and the browser kept
 * the failure: from then on the menu opened with only "Keeping this app",
 * each open threw "Failed to fetch dynamically imported module" inside the
 * embed, and only a reload brought it back. About half of Cloud's runs on
 * 0.1.17 failed on it.
 *
 * This mounts the embed the way a host mounts it (esbuild, split, from the
 * workspace's sources, as `verify-chrome` does), over the todo app with a
 * host's own actions, in Chromium, WebKit and Firefox. The browser goes
 * offline as soon as the app has drawn, and the menu's chunk is refused
 * from the start, so a fetch of it made while the page is idle fails as it
 * would offline rather than winning the race. Then:
 *
 *   offline, the person's menu says in one line that its part did not
 *   arrive, with a "Try again" button, and nothing throws;
 *   pressed while it still cannot arrive, the line stays and so does the
 *   keyboard;
 *   back online, the next open shows the whole menu — the same controls as
 *   a page that was never offline, the host's "Report this app" among
 *   them — with no reload;
 *   and, on a second page, "Try again" brings it in place, with the
 *   keyboard on the menu's first control rather than on <body>.
 *
 *   node scripts/verify-offline.mjs [--engine=chromium|webkit|firefox]   (all three by default)
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ENGINES;
const report = { at: new Date().toISOString(), engines, checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Things, on a train</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}#app{position:relative;height:100vh}</style></head>
<body><main><h1 style="position:absolute;left:-9999px">Things, on a train</h1><div id="app"></div></main>
<script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the embed over the todo app, built as a product's bundler builds it, chunk by chunk. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-offline-host-"));
  const todo = resolve(repoRoot, "apps/todo/src/index.ts");
  const seed = resolve(repoRoot, "apps/todo/src/data/example.json");
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { todoApp } from ${JSON.stringify(todo)};
        import seed from ${JSON.stringify(seed)};
        window.__handle = mount(document.getElementById("app"), {
          app: todoApp,
          seed,
          face: "graview",
          principal: { kind: "human", id: "user-nora", roles: ["keeper"] },
          label: "Things",
          heading: false,
          height: "100%",
          fonts: false,
          studio: false,
          hostActions: [
            { label: "Change the app", href: "/apps/things/change" },
            { label: "Your apps", href: "/apps" },
            { label: "Report this app", href: "/report?app=things" },
          ],
        });
        window.__handle.drawn().then(() => { window.__ready = true; });`,
      resolveDir: resolve(repoRoot, "packages/embed"),
      loader: "js",
    },
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    outdir: out,
    entryNames: "entry",
    chunkNames: "[name]-[hash]",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = join(out, path);
    if (!file.startsWith(out) || !existsSync(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html", "cache-control": "no-store" });
    response.end(readFileSync(file));
  });
  await new Promise((ready) => host.listen(portFor("offline-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** What the person's menu holds when it is open: its line, its controls, the host's actions. */
function theMenu(page) {
  return page.evaluate(() => {
    const pane = document.querySelector('[data-testid="profile"]');
    if (!pane || pane.hidden) return null;
    const visible = (element) => element.getBoundingClientRect().height > 0;
    const line = pane.querySelector('[data-testid="lazy-part-missing"]');
    return {
      line: line && visible(line) ? line.textContent.replace(/\s+/g, " ").trim() : null,
      retry: pane.querySelector('[data-testid="lazy-part-retry"]') !== null,
      hostActions: [...pane.querySelectorAll('[data-testid="host-action"]')].filter(visible).map((one) => one.textContent.trim()),
      controls: [...pane.querySelectorAll("button, a[href], input, select")].filter(visible).length,
      keyboard: document.activeElement === document.body ? "body" : (document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName.toLowerCase() ?? null),
    };
  });
}

async function openTheMenu(page) {
  await page.locator('[data-testid="profile-button"]:visible').first().click();
  await page.waitForSelector('[data-testid="profile"]:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(400);
  return theMenu(page);
}

async function closeTheMenu(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

/**
 * A page whose menu chunk is refused while `blocked.now` — every request
 * for it fails as it would offline — and which goes offline the moment the
 * app has drawn.
 */
async function aPageOnATrain(browser, errors, engine) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const blocked = { now: true, refused: 0 };
  await context.route(/\/bar-panes-[^/]*\.js(\?.*)?$/, (route) => {
    if (blocked.now) {
      blocked.refused += 1;
      return route.abort("internetdisconnected");
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${engine}: ${error.message}`));
  await page.goto(`${at("offline-host")}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
  await context.setOffline(true);
  await page.waitForTimeout(300);
  return { context, page, blocked };
}

let browser;
const host = await buildHost();
const errors = [];
const engineSaid = {};
try {
  for (const engine of engines) {
    browser = await launchEngine(engine);
    const said = {};
    try {
      /* What the menu holds on a page that never went offline: the whole menu, to compare with. */
      {
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} (never offline): ${error.message}`));
        await page.goto(`${at("offline-host")}/`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        said.whole = await openTheMenu(page);
        await context.close();
      }

      /* Offline, then back online: the next open is the whole menu. */
      {
        const before = errors.length;
        const { context, page, blocked } = await aPageOnATrain(browser, errors, engine);
        said.offline = await openTheMenu(page);
        said.offlineErrors = errors.slice(before);
        await closeTheMenu(page);
        blocked.now = false;
        await context.setOffline(false);
        await page.waitForTimeout(1200);
        said.backOnline = await openTheMenu(page);
        said.refused = blocked.refused;
        said.reloaded = await page.evaluate(() => performance.getEntriesByType("navigation").length !== 1);
        await context.close();
      }

      /* "Try again", pressed from the keyboard: refused while it cannot arrive, in place when it can, the keyboard kept. */
      {
        const { context, page, blocked } = await aPageOnATrain(browser, errors, engine);
        await context.setOffline(false);
        const first = await openTheMenu(page);
        await page.locator('[data-testid="profile"] [data-testid="lazy-part-retry"]').focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(600);
        const stillAway = await theMenu(page);
        blocked.now = false;
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1200);
        const arrived = await theMenu(page);
        said.tryAgain = { first, stillAway, arrived };
        await context.close();
      }
    } catch (error) {
      said.error = String(error?.stack ?? error);
    }
    engineSaid[engine] = said;
    await browser.close();
    browser = undefined;
  }

  const each = (test) => Object.fromEntries(Object.entries(engineSaid).map(([engine, said]) => [engine, !said.error && test(said)]));
  const all = (results) => Object.keys(results).length === engines.length && Object.values(results).every(Boolean);

  const whole = each((said) => said.whole !== null && said.whole.line === null && said.whole.hostActions.includes("Report this app"));
  report.checks.aMenuNeverOfflineIsWhole = { engines: Object.fromEntries(Object.entries(engineSaid).map(([engine, said]) => [engine, said.whole ?? said.error])), held: whole, ok: all(whole) };

  const line = each((said) => said.refused > 0 && said.offline !== null && said.offline.line !== null && said.offline.retry && said.offlineErrors.length === 0);
  report.checks.offlineTheMenuSaysSoInOneLine = {
    engines: Object.fromEntries(Object.entries(engineSaid).map(([engine, said]) => [engine, said.error ?? { menu: said.offline, refused: said.refused, errors: said.offlineErrors }])),
    held: line,
    ok: all(line),
  };

  const back = each((said) => said.backOnline !== null && said.backOnline.line === null && said.backOnline.hostActions.includes("Report this app") && said.backOnline.controls === said.whole?.controls && !said.reloaded);
  report.checks.backOnlineTheNextOpenIsTheWholeMenu = {
    engines: Object.fromEntries(Object.entries(engineSaid).map(([engine, said]) => [engine, said.error ?? { menu: said.backOnline, whole: said.whole?.controls, reloaded: said.reloaded }])),
    held: back,
    ok: all(back),
  };

  const again = each(({ tryAgain }) => tryAgain.first?.line !== null && tryAgain.stillAway?.line !== null && tryAgain.stillAway?.keyboard === "lazy-part-retry" && tryAgain.arrived?.line === null && tryAgain.arrived?.hostActions.includes("Report this app") && tryAgain.arrived?.keyboard !== "body");
  report.checks.tryAgainBringsItInPlaceAndKeepsTheKeyboard = {
    engines: Object.fromEntries(Object.entries(engineSaid).map(([engine, said]) => [engine, said.error ?? said.tryAgain])),
    held: again,
    ok: all(again),
  };

  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  host.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/offline.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/offline.json\n");
process.exit(report.passed ? 0 : 1);
