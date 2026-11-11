#!/usr/bin/env node
/**
 * A PLACE ON AN E-INK SCREEN, AS A HOST PHOTOGRAPHS IT (Roadmap
 * f-eink-display-profile, f-render-tap-map, f-device-nav-bar).
 *
 * A host draws a device's picture by handing `renderScreen`'s HTML to a
 * browser of its own at the device's viewport and taking a screenshot; when
 * somebody taps the glass, it finds the region under the point in `taps`
 * without a browser. Both are only right if the browser draws every region
 * exactly where the framework said it would, the picture is the same
 * however soon it is taken, and nothing on it is a color a grayscale screen
 * cannot show. This renders the home, a list and a record — every page of
 * each — of todo, rota and seedbed in Node, loads each into Chromium at
 * 758 × 1024 (a Kindle Paperwhite 3 held upright) and asks:
 *
 *   it fits the viewport, with nothing to scroll, and what does not fit is
 *   on pages that say which of how many;
 *   every pixel drawn is gray (red, green and blue equal), and every color
 *   the page computes is one of the profile's sixteen;
 *   each region of the tap map is its element's box, to within a pixel, and
 *   every press is at least 64 px each way;
 *   the picture taken the moment the page is written is the picture taken
 *   after its fonts are ready and a second has passed;
 *   the page asks the network for nothing.
 *
 * Nothing is served: each page is written into the browser whole, so this
 * harness holds no port (`scripts/lib/ports.mjs` has none to give it) and
 * runs beside any other.
 *
 *   node scripts/verify-device.mjs
 *
 * Writes docs/device.json.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VIEWPORT = { width: 758, height: 1024 };
const LEAST = 64;
/** How long "after waiting" waits, past the fonts being ready. */
const WAIT = 1000;

/** The screens, rendered in Node from the workspace's own sources, as a host's Worker renders them. */
async function renderScreens() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-device-"));
  const file = join(out, "screens.mjs");
  const at = (path) => JSON.stringify(resolve(repoRoot, path));
  await esbuild.build({
    stdin: {
      contents: `
        import { renderScreen } from "@graview/pages/device";
        import { createTodoStore, todoApp } from ${at("apps/todo/src/domain/app.ts")};
        import { createRotaStore, rotaApp } from ${at("apps/rota/src/domain/app.ts")};
        import { createSeedbedStore, seedbedApp } from ${at("apps/seedbed/src/domain/app.ts")};
        import { EXAMPLE_GARDEN } from ${at("apps/seedbed/src/domain/example.ts")};
        import todoExample from ${at("apps/todo/src/data/example.json")};
        import rotaExample from ${at("apps/rota/src/data/example.json")};
        const apps = [
          { name: "todo", store: createTodoStore({ snapshot: todoExample }), app: todoApp, viewer: { kind: "human", id: "user-nora", roles: ["keeper"] }, list: "/tasks", kind: "task" },
          { name: "rota", store: createRotaStore({ snapshot: rotaExample }), app: rotaApp, viewer: { kind: "human", id: "user-ada", roles: ["coordinator"] }, list: "/shifts", kind: "shift" },
          { name: "seedbed", store: createSeedbedStore({ snapshot: EXAMPLE_GARDEN }), app: seedbedApp, viewer: { kind: "human", id: "june", roles: [] }, list: "/plantings", kind: "planting" },
        ];
        export const screens = [];
        for (const one of apps) {
          const record = one.store.graph.nodesOfKind(one.kind)[0];
          for (const [what, place] of [["home", "home"], ["list", one.list], ["record", record.id]]) {
            const first = renderScreen(one.store, one.app, place, { profile: "eink", viewport: ${JSON.stringify(VIEWPORT)}, viewer: one.viewer });
            for (let page = 0; page < first.page.count; page++) {
              const screen = page === 0 ? first : renderScreen(one.store, one.app, place, { profile: "eink", viewport: ${JSON.stringify(VIEWPORT)}, viewer: one.viewer, page });
              screens.push({ app: one.name, what, place, page: screen.page, found: screen.found, html: screen.html, taps: screen.taps, renderId: screen.renderId });
            }
          }
        }
      `,
      resolveDir: repoRoot,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: file,
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
    loader: { ".json": "json" },
  });
  try {
    return (await import(pathToFileURL(file).href)).screens;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/** Every pixel of a PNG, read in the page itself: how many are not gray, and the widest channel spread. */
async function pixelsOf(page, png) {
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data: rgba } = context.getImageData(0, 0, canvas.width, canvas.height);
    let colored = 0;
    let spread = 0;
    const levels = new Set();
    for (let i = 0; i < rgba.length; i += 4) {
      const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
      const most = Math.max(r, g, b) - Math.min(r, g, b);
      if (most > 0) colored++;
      spread = Math.max(spread, most);
      levels.add(r);
    }
    return { width: canvas.width, height: canvas.height, colored, spread, levels: levels.size };
  }, png.toString("base64"));
}

const report = { at: new Date().toISOString(), viewport: VIEWPORT, checks: {} };
let browser;
try {
  const screens = await renderScreens();
  browser = await launchEngine("chromium");
  const seen = { fits: [], gray: [], ramp: [], regions: [], targets: [], settled: [], fetched: [], paged: [] };
  const errors = [];
  /*
   * WHAT A PAGE COMPUTES, against the ramp: every color, background and
   * border of every element is one of the sixteen grays.
   */
  const RAMP = Array.from({ length: 16 }, (_, at) => `rgb(${at * 17}, ${at * 17}, ${at * 17})`);
  for (const screen of screens) {
    const name = `${screen.app} ${screen.what} (${screen.place}) page ${screen.page.index + 1} of ${screen.page.count}`;
    // At once: the picture the moment the page is written, as a host that does not wait takes it.
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "no-preference" });
    const asked = [];
    context.on("request", (request) => {
      if (!/^(data|about|blob):/.test(request.url())) asked.push(request.url());
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
    await page.setContent(screen.html, { waitUntil: "commit" });
    const atOnce = await page.screenshot({ type: "png" });
    // After waiting: the fonts ready, a second gone.
    await page.waitForLoadState("load");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(WAIT);
    const waited = await page.screenshot({ type: "png" });
    seen.settled.push({ screen: name, ok: atOnce.equals(waited) });

    const measured = await page.evaluate((ramp) => {
      const root = document.documentElement;
      window.scrollTo(0, 400);
      const scrolled = window.scrollY;
      const boxes = [...document.querySelectorAll(".gv-at")].map((element) => element.getBoundingClientRect());
      const taps = [...document.querySelectorAll("[data-tap]")].map((element) => {
        const box = element.getBoundingClientRect();
        return { index: Number(element.getAttribute("data-tap")), x: box.x, y: box.y, width: box.width, height: box.height };
      });
      const off = [];
      for (const element of document.querySelectorAll("*")) {
        const style = getComputedStyle(element);
        for (const property of ["color", "background-color", "border-top-color", "border-bottom-color", "border-left-color", "border-right-color"]) {
          const value = style.getPropertyValue(property);
          if (value === "rgba(0, 0, 0, 0)") continue;
          if (!ramp.includes(value)) off.push(`${element.tagName.toLowerCase()}.${element.className} ${property}: ${value}`);
        }
      }
      return {
        scrollWidth: root.scrollWidth,
        scrollHeight: root.scrollHeight,
        scrolled,
        outside: boxes.filter((box) => box.right > window.innerWidth + 0.5 || box.bottom > window.innerHeight + 0.5).length,
        taps,
        off: [...new Set(off)].slice(0, 10),
      };
    }, RAMP);
    seen.fits.push({ screen: name, scrollWidth: measured.scrollWidth, scrollHeight: measured.scrollHeight, scrolled: measured.scrolled, outside: measured.outside, ok: measured.scrollWidth <= VIEWPORT.width && measured.scrollHeight <= VIEWPORT.height && measured.scrolled === 0 && measured.outside === 0 });
    seen.ramp.push({ screen: name, off: measured.off, ok: measured.off.length === 0 });

    const wrong = [];
    for (const [index, tap] of screen.taps.entries()) {
      const drawn = measured.taps.find((one) => one.index === index);
      const apart = drawn ? Math.max(Math.abs(drawn.x - tap.x), Math.abs(drawn.y - tap.y), Math.abs(drawn.width - tap.width), Math.abs(drawn.height - tap.height)) : Infinity;
      if (!(apart <= 1)) wrong.push({ label: tap.label, said: { x: tap.x, y: tap.y, width: tap.width, height: tap.height }, drawn: drawn ?? null });
    }
    seen.regions.push({ screen: name, regions: screen.taps.length, elements: measured.taps.length, wrong, ok: screen.taps.length > 0 && measured.taps.length === screen.taps.length && wrong.length === 0 });
    const small = screen.taps.filter((tap) => tap.width < LEAST || tap.height < LEAST).map((tap) => tap.label);
    seen.targets.push({ screen: name, small, ok: small.length === 0 });

    const pixels = await pixelsOf(page, waited);
    seen.gray.push({ screen: name, ...pixels, ok: pixels.colored === 0 && pixels.width === VIEWPORT.width && pixels.height === VIEWPORT.height });
    seen.fetched.push({ screen: name, asked, ok: asked.length === 0 });
    seen.paged.push({ screen: name, page: screen.page, found: screen.found, says: screen.page.count > 1 ? screen.html.includes(`Page ${screen.page.index + 1} of ${screen.page.count}`) : true });
    await context.close();
  }

  const every = (list) => list.length > 0 && list.every((one) => one.ok);
  report.screens = screens.length;
  // Each place found, and a place of more than one page saying which page it is on every page.
  const pagedOk = seen.paged.every((one) => one.found && one.says) && seen.paged.some((one) => one.page.count > 1);
  report.checks.everyScreenFitsTheViewportWithNothingToScroll = { held: seen.fits, ok: every(seen.fits) };
  report.checks.whatDoesNotFitGoesOntoPagesThatSayWhichOfHowMany = { held: seen.paged, ok: pagedOk };
  report.checks.everyPixelDrawnIsGray = { held: seen.gray, ok: every(seen.gray) };
  report.checks.everyColorThePageComputesIsOneOfTheSixteenGrays = { held: seen.ramp, ok: every(seen.ramp) };
  report.checks.eachTapRegionIsItsElementsBoxWithinAPixel = { held: seen.regions, ok: every(seen.regions) };
  report.checks.everyPressIsAtLeast64PxEachWay = { held: seen.targets, ok: every(seen.targets) };
  report.checks.thePictureIsTheSameWithAndWithoutWaiting = { held: seen.settled, ok: every(seen.settled) };
  report.checks.thePageFetchesNothing = { held: seen.fetched, ok: every(seen.fetched) };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/device.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/device.json\n");
process.exit(report.passed ? 0 : 1);
