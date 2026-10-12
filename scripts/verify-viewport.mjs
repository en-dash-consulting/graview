#!/usr/bin/env node
/**
 * AN APP FILLS THE PHONE AFTER IT TURNS (FR-165).
 *
 * On a phone turned to landscape and back, the app was drawn in the top
 * half of the screen and stayed so, on both faces: the embed took the
 * height it was mounted with once, the Shell was `100vh`, the pages' seat
 * a fixed `100dvh`, and the scene passed over a box reported as nothing.
 * This mounts the embed on a page that is the app, the way Cloud's shell
 * does, on a phone, with each height a host may say — `"viewport"`,
 * `100dvh`, a `var()` whose fallback is one — on the scene and the pages;
 * then serves the todo example's whole-page Shell; turns each phone to
 * landscape and back, and asks, after each turn:
 *
 *   the embed's box is the screen's height, its content reaches the
 *   screen's foot, and the scene laid itself out for the box it has;
 *   the pages' seat stands in the screen's height, not the first one;
 *   the Shell is the screen's height and its scene follows its box;
 *   a scene whose box went to nothing while the phone turned lays itself
 *   out for the box it has once it comes back.
 *
 *   node scripts/verify-viewport.mjs [--engine=chromium|webkit]   (both by default)
 *
 * Writes docs/viewport.json.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
// A phone's engines: Chromium for Android, WebKit for every browser on iOS.
const engines = asked ? [asked] : ["chromium", "webkit"];
const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
    { id: "p1", kind: "person", label: "Ada" },
  ],
  edges: [],
};
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
/** The heights a host may say for a page that is the app. */
const HEIGHTS = ["viewport", "100dvh", "var(--host-viewport, 100dvh)"];
const FACES = ["scene", "pages"];
/** A turn is followed as it happens and a beat after; this waits past the beat. */
const SETTLE = 900;

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>A host's page</title>
<style>body{margin:0;background:#faf8f2}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-viewport-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import tasks from ${JSON.stringify(TASKS)};
        const compiled = compileDocumentWithoutCheck(tasks, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const asked = new URLSearchParams(location.search);
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: ${JSON.stringify(SEED)},
          principal: { kind: "human", id: "p1", roles: ["owner"] },
          face: asked.get("face"),
          bar: true,
          label: "The tasks",
          heading: 1,
          height: asked.get("height"),
          fonts: false,
          studio: false,
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
  await new Promise((ready) => host.listen(portFor("viewport-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** What fills the screen, read the one way: the box's height, its foot, the content's foot and the box the scene laid itself out for. */
function measure(page, root) {
  return page.evaluate((root) => {
    const box = root === "shell" ? document.querySelector("[data-graview-app-bar]")?.parentElement : document.querySelector("[data-graview-embed]");
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    const ground = box.querySelector("[data-graview-box]");
    // The embed's content box; the Shell's is its scene.
    const content = box.querySelector("[data-embed-content]") ?? ground;
    const groundRect = ground?.getBoundingClientRect();
    const seat = document.querySelector('[data-testid="page-seat"]');
    const seatRect = seat?.getBoundingClientRect();
    return {
      screen: innerHeight,
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      contentFoot: content ? Math.round(content.getBoundingClientRect().bottom) : null,
      scene: ground ? { laidOutFor: ground.getAttribute("data-graview-box"), has: `${Math.round(groundRect.width)}x${Math.round(groundRect.height)}` } : null,
      seatFoot: seatRect ? Math.round(seatRect.bottom) : null,
    };
  }, root);
}

/** Within a pixel and a half: a box rounds, a screen does not. */
const near = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= 1.5;
/** The scene laid itself out for the box it has, to the pixel each way. */
const sceneFollows = (scene) => {
  if (!scene) return true;
  const [w1, h1] = scene.laidOutFor?.split("x").map(Number) ?? [];
  const [w2, h2] = scene.has.split("x").map(Number);
  return near(w1, w2) && near(h1, h2);
};
const fills = (m) => m !== null && m.top === 0 && near(m.height, m.screen) && near(m.contentFoot, m.screen) && sceneFollows(m.scene);

async function turnAndMeasure(page, root) {
  const said = {};
  said.portrait = await measure(page, root);
  await page.setViewportSize(LANDSCAPE);
  await page.waitForTimeout(SETTLE);
  said.landscape = await measure(page, root);
  await page.setViewportSize(PORTRAIT);
  await page.waitForTimeout(SETTLE);
  said.back = await measure(page, root);
  return said;
}

const report = { at: new Date().toISOString(), engines, portrait: PORTRAIT, landscape: LANDSCAPE, checks: {} };
const errors = [];
const seen = { embed: [], seat: [], shell: [], zero: [] };
let browser;
const host = await buildHost();
const todo = await serving("todo", portFor("todo"), repoRoot);
try {
  for (const engine of engines) {
    browser = await launchEngine(engine);
    for (const face of FACES) {
      for (const height of HEIGHTS) {
        const context = await browser.newContext({ viewport: PORTRAIT, hasTouch: true });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${face} ${height}: ${error.message}`));
        await page.goto(`${at("viewport-host")}/?face=${face}&height=${encodeURIComponent(height)}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await page.waitForTimeout(SETTLE);
        const said = await turnAndMeasure(page, "embed");
        seen.embed.push({ engine, face, height, ...said, ok: Object.values(said).every(fills) });
        if (face === "pages") {
          seen.seat.push({ engine, height, feet: Object.fromEntries(Object.entries(said).map(([turn, m]) => [turn, m && { seatFoot: m.seatFoot, contentFoot: m.contentFoot }])), ok: Object.values(said).every((m) => m && near(m.seatFoot, m.contentFoot)) });
        }
        /*
         * A BOX THAT WENT TO NOTHING: the host hides the app, the phone turns,
         * the app comes back. The scene passed over the zero and must lay
         * itself out for the box it has now, not the one before.
         */
        if (face === "scene" && height === "viewport") {
          await page.evaluate(() => (document.getElementById("app").style.display = "none"));
          await page.setViewportSize(LANDSCAPE);
          await page.waitForTimeout(SETTLE);
          await page.evaluate(() => (document.getElementById("app").style.display = ""));
          await page.waitForTimeout(SETTLE);
          const back = await measure(page, "embed");
          seen.zero.push({ engine, back, ok: fills(back) });
        }
        await context.close();
      }
    }
    // The whole-page Shell: the todo example, as its own window.
    const context = await browser.newContext({ viewport: PORTRAIT, hasTouch: true });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${engine} shell: ${error.message}`));
    await page.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 120_000 });
    await page.waitForTimeout(SETTLE);
    const said = await turnAndMeasure(page, "shell");
    seen.shell.push({ engine, ...said, ok: Object.values(said).every(fills) });
    await context.close();
    await browser.close();
    browser = undefined;
  }

  const every = (list) => list.length > 0 && list.every((one) => one.ok);
  report.checks.theEmbedFillsThePhoneAfterEachTurnOnBothFaces = { held: seen.embed, ok: every(seen.embed) };
  report.checks.thePagesSeatStandsInTheScreensHeight = { held: seen.seat, ok: every(seen.seat) };
  report.checks.theShellFillsThePhoneAfterEachTurn = { held: seen.shell, ok: every(seen.shell) };
  report.checks.aSceneWhoseBoxWentToNothingFollowsItBack = { held: seen.zero, ok: every(seen.zero) };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  host.stop();
  todo.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/viewport.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/viewport.json\n");
process.exit(report.passed ? 0 : 1);
