#!/usr/bin/env node
/**
 * THE TWO PATHS, held against each other (Roadmap f-gpu-default, f-plane-blur).
 *
 * A scene is drawn on the GPU by default where the browser has WebGPU and
 * element capture, and on the DOM path everywhere else — silently, per
 * page. That is only true if a page on either path is the same page: the
 * same accessibility tree, the same picture, the same silence. So this
 * opens the example on both, in the browsers that have each:
 *
 * - a Chromium that can capture (Canary, or GRAVIEW_BROWSER with the
 *   switches in `GPU_ARGS`): `auto` draws on the GPU, `?renderer=dom` on
 *   the DOM path, and the two are compared — tree, pixels, frames;
 * - a Chromium whose capture hit-tests where a view is laid out rather than
 *   where it is drawn (Chrome 155's `layoutSubtree` build, flag on): it
 *   draws on the DOM path, silently, since a press there would miss;
 * - Firefox, WebKit, the bundled Chromium (WebGPU, no capture) and a
 *   Chromium whose adapter is refused (Canary without the switches): each
 *   draws on the DOM path and says nothing on the console;
 * - the blur: on the GPU the focused plane is the same pixels blurred or
 *   not and a receded one is not, at the frame budget it holds unblurred;
 *   the DOM path blurs within its budget or not at all; and reduced
 *   transparency and reduced motion turn it off on both.
 *
 * The frames are timed with vsync off, so an interval is the frame's work,
 * not the display's. Where no Chromium here can draw on the GPU — a runner
 * with neither Canary nor a GPU — the verdict says so in `gpu.unavailable`
 * and claims nothing about that path either way.
 *
 *   node scripts/verify-renderer.mjs [--headed]
 *
 * Writes docs/renderer.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { GPU_ARGS, gpuChromium, launchEngine } from "./lib/engine.mjs";
import { watched } from "./lib/watch.mjs";
import { serving } from "./lib/serve.mjs";
import { portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const headless = !process.argv.includes("--headed");
const VIEWPORT = { width: 1440, height: 900 };
const UNTHROTTLED = ["--disable-gpu-vsync", "--disable-frame-rate-limit"];

/** A frame at sixty a second, and the DOM path's blur budget (`DOM_BLUR_FRAME_MS`): a frame and a half. */
const FRAME_MS = 1000 / 60;
const DOM_BLUR_FRAME_MS = FRAME_MS * 1.5;
/** How much slower blurred GPU frames may be than unblurred ones and still be "the same budget": noise, not cost. */
const SAME_BUDGET_SLACK_MS = 1;

/**
 * THE BROWSER'S OWN WORD on an adapter it could not make. Chromium logs
 * "Failed to create WebGPU Context Provider" against the page's
 * `requestAdapter` call when it has no GPU to give — before the page can
 * know, since asking is the only way to find out. It is the browser's
 * diagnostic, not the page's; it is kept apart, and reported, rather than
 * counted as the page speaking.
 */
const BROWSERS_OWN = /^Failed to create WebGPU Context Provider$|^No available adapters\.?$/;

/** What a page said that a reader could have seen: errors and warnings, and page errors. Vite's own chatter is not the page's. */
function listen(page) {
  const said = [];
  said.browsers = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const line = `${message.type()}: ${message.text().slice(0, 200)}`;
    (BROWSERS_OWN.test(message.text()) ? said.browsers : said).push(line);
  });
  page.on("pageerror", (error) => said.push(`pageerror: ${String(error?.message ?? error).slice(0, 200)}`));
  return said;
}

async function open(browser, url, { media } = {}) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const said = listen(page);
  if (media) await page.emulateMedia(media);
  // Not "load": a font request WebKit leaves hanging is not the page failing to draw.
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 120_000 });
  return { page, said };
}

/** The path the page's ground says it draws on, once it has settled on one. */
async function pathOf(page, want) {
  if (want) await page.waitForSelector(`.graview-ground[data-graview-renderer="${want}"]`, { timeout: 15_000 }).catch(() => {});
  // The GPU's first frames, and the check on them, before anything is judged.
  await page.waitForTimeout(1_800);
  return page.evaluate(() => {
    const ground = document.querySelector(".graview-ground");
    return {
      renderer: ground?.getAttribute("data-graview-renderer") ?? null,
      blur: ground?.hasAttribute("data-graview-blur") ?? false,
      inCanvas: document.querySelectorAll('canvas[data-graview-stage="gpu"] > [data-graview-view]').length,
      notices: [...document.querySelectorAll("[role=alert], [role=status]")].map((el) => el.textContent?.trim() ?? "").filter((text) => /gpu|webgpu|renderer|fall/i.test(text)),
    };
  });
}

/** Reduced transparency, as the page's media query hears it (Chromium's CDP; Playwright 1.49 has no word for it). */
async function reduceTransparency(page, on) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: on ? "reduce" : "" }] });
  await page.waitForTimeout(600);
}

/** The rectangles of a focused view and a receded one, as drawn. */
const rects = (page) =>
  page.evaluate(() => {
    const box = (plane) => {
      const el = [...document.querySelectorAll("[data-graview-view]")].find((one) => one.getAttribute("data-graview-plane") === String(plane));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, Math.round(r.left) + 4), y: Math.max(0, Math.round(r.top) + 4), width: Math.max(1, Math.round(r.width) - 8), height: Math.max(1, Math.round(r.height) - 8) };
    };
    return { focused: box(0), receded: box(2) ?? box(1) };
  });

/**
 * Two screenshots compared in a page of their own: the share of pixels
 * that differ by more than `tolerance` in any channel, and the mean
 * difference. No image library: the browser decodes PNG.
 */
async function compare(scratch, a, b, tolerance = 24) {
  return scratch.evaluate(
    async ({ a, b, tolerance }) => {
      const decode = async (base64) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d");
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [x, y] = await Promise.all([decode(a), decode(b)]);
      if (x.width !== y.width || x.height !== y.height) return { share: 1, mean: 255, size: "different" };
      let off = 0;
      let sum = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]));
        sum += d;
        if (d > tolerance) off += 1;
      }
      const pixels = x.data.length / 4;
      return { share: Number((off / pixels).toFixed(5)), mean: Number((sum / pixels).toFixed(3)) };
    },
    { a: a.toString("base64"), b: b.toString("base64"), tolerance },
  );
}

/**
 * Frames while the picture moves: the stops of the bar, one after another,
 * each tween timed from inside the page. With vsync off an interval is what
 * the frame cost.
 */
async function framesWhileMoving(page) {
  const stops = await page.$$eval("nav button, nav a", (links) => links.map((link) => link.textContent?.trim()).filter((text) => text && /^The |^What /.test(text)));
  const names = [...new Set(stops)].slice(0, 5);
  const all = [];
  for (let round = 0; round < 2; round += 1) {
    for (const name of names) {
      await page.evaluate(() => {
        window.__frames = [];
        let last = 0;
        const tick = (now) => {
          if (last > 0) window.__frames.push(now - last);
          last = now;
          if (window.__frames.length < 4000) window.__tick = requestAnimationFrame(tick);
        };
        window.__tick = requestAnimationFrame(tick);
      });
      await page.locator("nav").getByRole("button", { name, exact: true }).first().click();
      await page.waitForTimeout(700);
      all.push(...(await page.evaluate(() => {
        cancelAnimationFrame(window.__tick);
        return window.__frames;
      })));
    }
  }
  const sorted = [...all].sort((a, b) => a - b);
  const at = (share) => (sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))].toFixed(2)) : null);
  return { frames: all.length, p50: at(0.5), p95: at(0.95), worst: at(1) };
}

const report = { at: new Date().toISOString(), viewport: VIEWPORT, frameMs: Number(FRAME_MS.toFixed(2)), domBlurFrameMs: Number(DOM_BLUR_FRAME_MS.toFixed(2)), gpu: {}, dom: {}, without: {} };
const vite = await serving("todo", portFor("todo"), repoRoot);
const home = `${vite.url}/?theme=light`;

try {
  // ---- A Chromium that can capture: both paths, side by side. ----
  const executablePath = gpuChromium();
  const capturing = watched(await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless, args: [...GPU_ARGS, ...UNTHROTTLED] }), "chromium");
  try {
    const scratch = await capturing.newPage();
    const gpu = await open(capturing, home);
    const gpuPath = await pathOf(gpu.page, "gpu");
    report.gpu.path = gpuPath;
    report.gpu.browser = executablePath ?? "the bundled Chromium";
    // Chrome 155's capture build (`layoutSubtree`) ignores a reported geometry, so a press misses what was drawn: it is held to the DOM path.
    report.gpu.hitsWhereLaidOut = await gpu.page.evaluate(() => "layoutSubtree" in HTMLCanvasElement.prototype);
    if (gpuPath.renderer !== "gpu") {
      report.gpu.said = gpu.said;
      report.gpu.unavailable = report.gpu.hitsWhereLaidOut
        ? `${report.gpu.browser} drew this page on the ${gpuPath.renderer} path: its element capture hit-tests where a view is laid out, not where it is drawn`
        : `${report.gpu.browser} drew this page on the ${gpuPath.renderer} path: no Chromium here can capture onto WebGPU`;
    } else {
      report.gpu.said = gpu.said;
      const dom = await open(capturing, `${home}&renderer=dom`);
      report.dom.path = await pathOf(dom.page, "dom");
      report.dom.said = dom.said;

      // THE SAME TREE on both paths, at the same stop.
      const [treeOnGpu, treeOnDom] = [await gpu.page.locator("body").ariaSnapshot(), await dom.page.locator("body").ariaSnapshot()];
      report.tree = { same: treeOnGpu === treeOnDom, lines: treeOnGpu.split("\n").length };
      if (!report.tree.same) {
        const a = treeOnGpu.split("\n");
        const b = treeOnDom.split("\n");
        report.tree.firstDifference = a.findIndex((line, i) => line !== b[i]);
        report.tree.gpu = a.slice(Math.max(0, report.tree.firstDifference - 1), report.tree.firstDifference + 3);
        report.tree.dom = b.slice(Math.max(0, report.tree.firstDifference - 1), report.tree.firstDifference + 3);
      }

      // THE SAME PICTURE: the scene's own box, both blurred as they draw by default.
      const scene = await gpu.page.locator(".graview-ground").boundingBox();
      const clip = { x: scene.x, y: scene.y, width: scene.width, height: scene.height };
      report.picture = await compare(scratch, await gpu.page.screenshot({ clip }), await dom.page.screenshot({ clip }));

      // THE BLUR ON THE GPU: the focused plane sharp, a receded one blurred.
      const where = await rects(gpu.page);
      report.gpu.rects = where;
      const blurredFocus = await gpu.page.screenshot({ clip: where.focused });
      const blurredBack = await gpu.page.screenshot({ clip: where.receded });
      await reduceTransparency(gpu.page, true);
      report.gpu.reducedTransparency = await pathOf(gpu.page, "gpu");
      report.gpu.focusedPlane = await compare(scratch, blurredFocus, await gpu.page.screenshot({ clip: where.focused }), 0);
      report.gpu.recededPlane = await compare(scratch, blurredBack, await gpu.page.screenshot({ clip: where.receded }), 0);
      // The frame budget, unblurred and then blurred, over the same moves.
      report.gpu.framesUnblurred = await framesWhileMoving(gpu.page);
      await reduceTransparency(gpu.page, false);
      report.gpu.framesBlurred = await framesWhileMoving(gpu.page);
      report.gpu.stillOnGpuAfterMoving = (await pathOf(gpu.page)).renderer === "gpu";

      // THE DOM PATH'S BLUR, within its budget or not at all.
      report.dom.framesBlurred = await framesWhileMoving(dom.page);
      report.dom.blurAfterMoving = (await pathOf(dom.page)).blur;
      await reduceTransparency(dom.page, true);
      report.dom.reducedTransparency = await pathOf(dom.page);
      report.dom.framesUnblurred = await framesWhileMoving(dom.page);

      // REDUCED MOTION turns it off on both.
      const still = await open(capturing, home, { media: { reducedMotion: "reduce" } });
      report.gpu.reducedMotion = await pathOf(still.page, "gpu");
      const stillDom = await open(capturing, `${home}&renderer=dom`, { media: { reducedMotion: "reduce" } });
      report.dom.reducedMotion = await pathOf(stillDom.page, "dom");
    }
  } finally {
    await capturing.close();
  }

  // ---- Browsers without the GPU path: the DOM path, and silence. ----
  const without = [
    ["firefox", () => launchEngine("firefox", { headless })],
    ["webkit", () => launchEngine("webkit", { headless })],
    // WebGPU without element capture: the bundled Chromium, whatever GRAVIEW_RENDERER says.
    ["chromium without capture", async () => watched(await chromium.launch({ headless }), "chromium")],
    // Capture, but the adapter refused: the first-frame check's way back.
    ...(executablePath ? [["chromium with its adapter refused", async () => watched(await chromium.launch({ executablePath, headless }), "chromium")]] : []),
  ];
  for (const [name, launch] of without) {
    console.log(`  ${name}`);
    const browser = await launch();
    try {
      const { page, said } = await open(browser, home);
      report.without[name] = { ...(await pathOf(page)), said, ...(said.browsers.length ? { browserSaid: said.browsers } : {}) };
    } finally {
      await browser.close();
    }
  }
} finally {
  vite.stop();
}

const gpuDrew = report.gpu.path?.renderer === "gpu";
const sameBudget = (blurred, unblurred) => blurred && unblurred && blurred.p95 <= Math.max(FRAME_MS, unblurred.p95 + SAME_BUDGET_SLACK_MS);
report.claims = {
  ...(gpuDrew
    ? {
        aChromiumThatCanCaptureDrawsOnTheGpuByDefault: report.gpu.path.inCanvas > 0 && report.gpu.said.length === 0 && report.gpu.stillOnGpuAfterMoving,
        theAccessibilityTreeIsTheSameOnBothPaths: report.tree.same,
        theTwoPathsDrawTheSamePicture: report.picture.share <= 0.01,
        onTheGpuTheFocusedPlaneIsSharp: report.gpu.focusedPlane.share === 0,
        onTheGpuTheRecededPlanesAreBlurred: report.gpu.recededPlane.share > 0,
        onTheGpuBlurHoldsTheBudgetItHoldsWithout: Boolean(sameBudget(report.gpu.framesBlurred, report.gpu.framesUnblurred)),
        theDomPathBlursWithinBudgetOrNotAtAll: !report.dom.blurAfterMoving || (report.dom.framesBlurred.p95 ?? Infinity) <= DOM_BLUR_FRAME_MS,
        reducedTransparencyTurnsBlurOffOnBothPaths: !report.gpu.reducedTransparency.blur && !report.dom.reducedTransparency.blur,
        reducedMotionTurnsBlurOffOnBothPaths: !report.gpu.reducedMotion.blur && !report.dom.reducedMotion.blur,
      }
    : {}),
  ...(report.gpu.hitsWhereLaidOut
    ? { aChromiumWhosePressesWouldMissTheDrawingDrawsOnTheDomPath: report.gpu.path.renderer === "dom" && report.gpu.said.length === 0 && report.gpu.path.notices.length === 0 }
    : {}),
  aPageWithoutTheGpuPathDrawsOnTheDomPathAndSaysNothing: Object.values(report.without).every((one) => one.renderer === "dom" && one.said.length === 0 && one.notices.length === 0),
};
const failed = Object.entries(report.claims).filter(([, ok]) => !ok).map(([name]) => name);
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/renderer.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
for (const [name, ok] of Object.entries(report.claims)) console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
if (!gpuDrew) console.log(`the GPU path was not measured: ${report.gpu.unavailable}`);
console.log(failed.length === 0 ? `both paths hold (${gpuDrew ? "GPU and DOM" : "DOM only here"})` : `${failed.length} claim(s) failed: ${failed.join(", ")}`);
process.exit(failed.length === 0 ? 0 : 1);
