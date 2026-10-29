#!/usr/bin/env node
/**
 * AN APP FILLS THE PHONE AFTER IT TURNS (FR-165).
 *
 * On a phone turned to landscape and back, the app was drawn in the top
 * half of the screen and stayed so, on both faces: the embed took the
 * height it was mounted with once, the Shell was `100vh`, and the scene
 * passed over a box reported as nothing.
 * This mounts the embed on a page that is the app, the way Cloud's shell
 * does, on a phone, with each height a host may say — `"viewport"`,
 * `100dvh`, a `var()` whose fallback is one — on the scene and the pages;
 * then serves the todo example's whole-page Shell; turns each phone to
 * landscape and back, and asks, after each turn:
 *
 *   the embed's box is the screen's height, its content reaches the
 *   screen's foot, and the scene laid itself out for the box it has;
 *   the Shell is the screen's height and its scene follows its box;
 *   a scene whose box went to nothing while the phone turned lays itself
 *   out for the box it has once it comes back.
 *
 * AND AN IPAD IN SAFARI (WebKit, as iOS draws every browser): at each
 * iPad's width, upright and turned, the app bar fits — no page wider than
 * the screen, nothing on the bar past its edge, the places that do not fit
 * folded into More — on the todo example's Shell and on an app of ten
 * kinds; a tap on a district of the scene from altitude moves the city
 * once, the one way, and a district already in sight is chosen with
 * nothing moving; and the window growing by Safari's toolbar, its width
 * the same, moves nothing on the scene.
 *
 *   node scripts/verify-viewport.mjs [--engine=chromium|webkit]   (both by default)
 *
 * Writes docs/viewport.json.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { devices } from "playwright";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arriveWithoutWebfonts, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving, vacant } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
// A phone's engines: Chromium for Android, WebKit for every browser on iOS.
const engines = asked ? [asked] : ["chromium", "webkit"];
const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
/** An app the shape of a household's or a firm's: ten kinds, every one with records, so the bar has more places than an iPad's row holds. */
const RECON = resolve(repoRoot, "packages/core/tests/document/fixtures/recon.gdd.json");
const RECON_SEED = resolve(repoRoot, "packages/core/tests/document/fixtures/recon.seed.json");
/** The iPads, upright and turned: Playwright's own, touch and all. The Mini turned is 1024 wide, where the bar ran past the screen. */
const IPADS = ["iPad Pro 11", "iPad (gen 7)", "iPad Mini"].flatMap((name) => [name, `${name} landscape`]);
/** What Safari's toolbar gives back when it folds away. */
const TOOLBAR = 70;
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
        import recon from ${JSON.stringify(RECON)};
        import reconSeed from ${JSON.stringify(RECON_SEED)};
        const asked = new URLSearchParams(location.search);
        const many = asked.get("doc") === "recon";
        const compiled = compileDocumentWithoutCheck(many ? recon : tasks, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: many ? reconSeed : ${JSON.stringify(SEED)},
          principal: { kind: "human", id: many ? "person-0" : "p1", roles: ["owner"] },
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
  await vacant(portFor("viewport-host"));
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
    return {
      screen: innerHeight,
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      contentFoot: content ? Math.round(content.getBoundingClientRect().bottom) : null,
      scene: ground ? { laidOutFor: ground.getAttribute("data-graview-box"), has: `${Math.round(groundRect.width)}x${Math.round(groundRect.height)}` } : null,
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

/**
 * AN IPAD IN SAFARI. The bar at every iPad's width, both ways up, on the
 * todo example's Shell (the scene and the pages) and on an app of ten
 * kinds in the embed; then, on that app's scene from altitude, a run of
 * taps on its districts, followed frame by frame; then the window grown by
 * Safari's toolbar, its width the same.
 */
async function onAnIpad(browser, engine) {
  const open = async (device, url, ready) => {
    const context = await browser.newContext({ ...devices[device] });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${engine} ${device} ${url}: ${error.message}`));
    await arriveWithoutWebfonts(page, url);
    await page.waitForFunction(ready, null, { timeout: 120_000 });
    await page.waitForTimeout(SETTLE);
    return { context, page };
  };
  const todoReady = () => "__todoReady" in window;
  const embedReady = () => window.__ready === true;
  for (const device of IPADS) {
    for (const [app, url, ready] of [
      ["todo, the scene", `${at("todo")}/?today=2026-09-01`, todoReady],
      ["todo, the pages", `${at("todo")}/?today=2026-09-01&face=pages`, todoReady],
      ["ten kinds, the pages", `${at("viewport-host")}/?doc=recon&face=pages&height=viewport`, embedReady],
      ["ten kinds, the scene", `${at("viewport-host")}/?doc=recon&face=scene&height=viewport`, embedReady],
    ]) {
      const { context, page } = await open(device, url, ready);
      const bar = await barFits(page);
      seen.bar.push({ device, app, ...bar, ok: fitsTheScreen(bar) });
      await context.close();
    }
  }
  /*
   * THE TAPS: on the scene of ten kinds from altitude, upright and turned,
   * each district in its turn — the first opens the panel beside the map
   * and the city fits what is left; each after it is followed for as long
   * as a glide takes and twice that.
   */
  for (const device of ["iPad Pro 11", "iPad Pro 11 landscape"]) {
    const { context, page } = await open(device, `${at("viewport-host")}/?doc=recon&face=scene&height=viewport`, embedReady);
    const tapped = new Set();
    for (let tap = 0; tap < 6; tap++) {
      const { sight, edge } = await inSight(page);
      /*
       * The second tap is the district at the panel's edge, whose name runs
       * under it: the city brings it in, once. Every tap after is one
       * wholly in sight: chosen, nothing moves — where the city went back
       * to its middle each time, sliding under the finger.
       */
      const atTheEdge = tap === 1 && edge !== null && !tapped.has(edge.id);
      const next = atTheEdge ? edge : sight.find((one) => !tapped.has(one.id));
      if (!next) break;
      tapped.add(next.id);
      const following = followTheCity(page, 1600);
      await page.touchscreen.tap(next.x, next.y);
      const move = oneMove(await following);
      // The first tap opens the panel and the city fits what is left: one move.
      const still = tap > 0 && !atTheEdge;
      seen.taps.push({ device, tapped: next.id, ...move, inSight: still, ok: move.districts > 0 && move.turns === 0 && (!still || move.moved <= 1) });
    }
    // Safari's toolbar folds away: the window grows by it, the width the same.
    const size = page.viewportSize();
    for (const height of [size.height + TOOLBAR, size.height]) {
      const box = await page.evaluate(() => document.querySelector("[data-graview-box]")?.getAttribute("data-graview-box"));
      const following = followTheCity(page, 1600);
      await page.setViewportSize({ width: size.width, height });
      const move = oneMove(await following);
      const after = await page.evaluate(() => document.querySelector("[data-graview-box]")?.getAttribute("data-graview-box"));
      seen.toolbar.push({ device, app: "ten kinds, the scene", to: height, box, after, ...move, ok: move.districts > 0 && move.moved <= 1 && box === after });
    }
    await context.close();
  }
  // And the todo example's Shell, on the ground: the window grows by the toolbar and back.
  const { context, page } = await open("iPad Pro 11", `${at("todo")}/?today=2026-09-01`, todoReady);
  const size = page.viewportSize();
  for (const height of [size.height + TOOLBAR, size.height]) {
    const following = followTheCity(page, 1600);
    await page.setViewportSize({ width: size.width, height });
    const move = oneMove(await following);
    seen.toolbar.push({ device: "iPad Pro 11", app: "todo, the scene", to: height, ...move, ok: move.districts > 0 && move.moved <= 1 });
  }
  await context.close();
}

/** The bar as an iPad draws it: the page's width against the screen's, and whatever on the bar stands past either edge. */
function barFits(page) {
  return page.evaluate(() => {
    const bar = document.querySelector("[data-graview-app-bar]");
    if (!bar) return null;
    const past = [];
    for (const one of bar.querySelectorAll(".graview-bar-row *")) {
      if (one.closest(".graview-bar-ruler, .graview-bar-said")) continue;
      const box = one.getBoundingClientRect();
      if (box.width > 0 && (box.right > innerWidth + 0.5 || box.left < -0.5)) past.push(`${one.getAttribute("data-testid") ?? one.className ?? one.tagName} ${Math.round(box.left)}–${Math.round(box.right)}`);
    }
    return {
      screen: innerWidth,
      page: document.scrollingElement.scrollWidth,
      standing: bar.querySelectorAll(".graview-bar-places .graview-bar-at").length,
      past,
    };
  });
}
const fitsTheScreen = (m) => m !== null && m.page <= m.screen && m.past.length === 0;

/** Every district's box, a frame at a time, from now until `ms` have passed: where the city is on the way. */
function followTheCity(page, ms) {
  return page.evaluate(
    (ms) =>
      new Promise((done) => {
        const frames = [];
        const start = performance.now();
        const look = () => {
          const at = {};
          for (const card of document.querySelectorAll("[data-graview-view]")) {
            const box = card.getBoundingClientRect();
            at[card.getAttribute("data-graview-view")] = [box.left, box.top, box.width];
          }
          frames.push(at);
          if (performance.now() - start < ms) requestAnimationFrame(look);
          else done(frames);
        };
        requestAnimationFrame(look);
      }),
    ms,
  );
}

/**
 * ONE MOVE, THE ONE WAY: each district present throughout goes one way on
 * each axis, never back (a pixel's rounding allowed), and how far the whole
 * city went. A city that went somewhere and came back, or set out again,
 * turns on an axis.
 */
function oneMove(frames) {
  const ids = Object.keys(frames[0] ?? {}).filter((id) => frames.every((frame) => frame[id]));
  let turns = 0;
  let moved = 0;
  for (const id of ids) {
    for (const axis of [0, 1, 2]) {
      let way = 0;
      for (let i = 1; i < frames.length; i++) {
        const step = frames[i][id][axis] - frames[i - 1][id][axis];
        if (Math.abs(step) < 1) continue;
        const now = Math.sign(step);
        if (way !== 0 && now !== way) turns++;
        way = now;
      }
      moved = Math.max(moved, Math.abs(frames.at(-1)[id][axis] - frames[0][id][axis]));
    }
  }
  return { districts: ids.length, turns, moved: Math.round(moved) };
}

/** The districts wholly inside the part of the scene a panel beside it leaves, with what they are. */
function inSight(page) {
  return page.evaluate(() => {
    const scene = document.querySelector("[data-graview-box]")?.getBoundingClientRect();
    // The panel beside the map docks at the right (or stands as a sheet at the foot): what it covers is not in sight.
    const panel = [...document.querySelectorAll("[data-graview-map-panel]")].map((one) => one.getBoundingClientRect()).filter((box) => box.width > 0);
    const right = Math.min(scene?.right ?? innerWidth, ...panel.filter((box) => box.left > innerWidth / 3).map((box) => box.left));
    const foot = Math.min(scene?.bottom ?? innerHeight, ...panel.filter((box) => box.left < innerWidth / 3).map((box) => box.top));
    const cards = [...document.querySelectorAll("[data-graview-view]")].map((card) => [card, card.getBoundingClientRect()]);
    // The one at the panel's edge: pressable, its name running under the panel.
    const edge = cards
      .filter(([, box]) => box.left + box.width / 2 < right - 16 && box.left + box.width / 2 > 16 && box.right + 60 > right && box.top > (scene?.top ?? 0) && box.bottom < foot)
      .sort(([, a], [, b]) => b.right - a.right)[0];
    const sight = cards.flatMap(([card, box]) => {
      // Its name in sight too, opened: the plate under a chosen district is up to 184 px wide and two lines tall.
      const x = box.left + box.width / 2;
      const inside = x - Math.max(box.width / 2, 100) >= 8 && x + Math.max(box.width / 2, 100) <= right - 8 && box.top >= (scene?.top ?? 0) + 24 && box.bottom + 60 <= foot - 8;
      return inside ? [{ id: card.getAttribute("data-graview-view"), x: box.left + box.width / 2, y: box.top + box.height / 2 }] : [];
    });
    return { sight, edge: edge ? { id: edge[0].getAttribute("data-graview-view"), x: edge[1].left + edge[1].width / 2, y: edge[1].top + edge[1].height / 2 } : null };
  });
}

const report = { at: new Date().toISOString(), engines, portrait: PORTRAIT, landscape: LANDSCAPE, checks: {} };
const errors = [];
const seen = { embed: [], shell: [], zero: [], bar: [], taps: [], toolbar: [] };
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
        await arriveWithoutWebfonts(page, `${at("viewport-host")}/?face=${face}&height=${encodeURIComponent(height)}`);
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await page.waitForTimeout(SETTLE);
        const said = await turnAndMeasure(page, "embed");
        seen.embed.push({ engine, face, height, ...said, ok: Object.values(said).every(fills) });
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
    await arriveWithoutWebfonts(page, `${at("todo")}/?today=2026-09-01`);
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 120_000 });
    await page.waitForTimeout(SETTLE);
    const said = await turnAndMeasure(page, "shell");
    seen.shell.push({ engine, ...said, ok: Object.values(said).every(fills) });
    await context.close();
    if (engine === "webkit") await onAnIpad(browser, engine);
    await browser.close();
    browser = undefined;
  }

  const every = (list) => list.length > 0 && list.every((one) => one.ok);
  report.checks.theEmbedFillsThePhoneAfterEachTurnOnBothFaces = { held: seen.embed, ok: every(seen.embed) };
  report.checks.theShellFillsThePhoneAfterEachTurn = { held: seen.shell, ok: every(seen.shell) };
  report.checks.aSceneWhoseBoxWentToNothingFollowsItBack = { held: seen.zero, ok: every(seen.zero) };
  if (engines.includes("webkit")) {
    report.checks.theBarFitsAnIpadInBothOrientations = { held: seen.bar, ok: every(seen.bar) };
    // Every tap one move the one way; a district already in sight chosen with nothing moving.
    report.checks.aTapOnTheSceneMovesTheCameraOnce = { held: seen.taps, ok: every(seen.taps) && seen.taps.some((tap) => tap.inSight) };
    report.checks.theSceneHoldsStillWhenSafarisToolbarCollapses = { held: seen.toolbar, ok: every(seen.toolbar) };
  }
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
