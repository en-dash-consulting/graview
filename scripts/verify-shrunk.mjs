#!/usr/bin/env node
/**
 * Does the picture you rise from stay readable?
 *
 * Rising from a place kept it in the Graview as a billboard: the same
 * picture, scaled down onto its district's plot — complete, and at eight
 * pixels a letter, unreadable until it was opened again. It stands beside
 * the map now, in a panel docked at the side, at its own size. That claim
 * is about pixels, so no amount of static rendering settles it. This walks
 * every place in every app, in both schemes, up into the Graview, and
 * measures the picture beside the map:
 *
 *   - it stands in the panel, and nothing of it is drawn small on a plot
 *   - it is drawn at its own size: no transform scales it, its text is
 *     text-sized
 *   - nothing of it runs out sideways past the panel
 *   - the pick targets inside it are real targets, inside the panel, and
 *     nothing is drawn over them
 *
 *   node scripts/verify-shrunk.mjs [--headed]
 *
 * Writes docs/shrunk-interface.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchCanaryGpu } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { portFor } from "./lib/ports.mjs";
import { pressPlace } from "./lib/places.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

// The GPU capture path: Chromium-only by nature, so Canary is genuinely
// required here — the one launch shape the engine matrix does not cover.
const GPU_ARGS = ["--enable-unsafe-webgpu", "--use-angle=metal"];

/**
 * Every place worth checking, named the way the app names it: the example's
 * two, a list and a week. The product apps run their own copies of this
 * against a board, a matrix and a calendar in their own repositories.
 */
const APPS = [
  {
    name: "todo",
    port: portFor("todo"),
    ready: "__todoReady",
    query: "&today=2026-09-01",
    places: [
      { label: "The lists", switchTo: null, lens: null },
      { label: "The week", switchTo: "The week", lens: "timeline" },
    ],
  },
];

/*
 * Its own process GROUP, so stopping it stops vite and not merely the `npx`
 * that launched it. Killing the wrapper leaves the server holding the port,
 * and the next app in the loop then fails to start for a reason that has
 * nothing to do with what is being tested.
 */
/**
 * The app this harness drives — borrowed if a dev server is already holding
 * the port, started and owned otherwise. See `lib/serve.mjs`: spawning a
 * second vite blindly meant every harness died with "vite did not start"
 * whenever anyone had the app open.
 */
function startVite(app) {
  return serving(app.name, app.port, repoRoot);
}

/**
 * What the browser says about the shrunk view, measured rather than assumed.
 *
 * `getBoundingClientRect` reports the box AFTER every transform, which is
 * exactly the question: the natural box is 1040 wide in its own coordinates
 * and must land inside a slot half that on screen.
 */
const measure = () => {
  const panel = document.querySelector('[data-testid="lens-panel"]');
  if (!panel) return { present: false, screens: document.querySelectorAll("[data-graview-screen]").length };
  const box = panel.getBoundingClientRect();
  const lens = panel.querySelector("[data-graview-lens]");
  // Drawn at its own size: an element's drawn width is its laid-out width, as no transform scales it.
  const scaled = [...(lens?.querySelectorAll("*") ?? [])].slice(0, 200).some((el) => el.offsetWidth > 0 && Math.abs(el.getBoundingClientRect().width - el.offsetWidth) > 1);
  // Text-sized: the smallest text a person reads in it.
  let smallest = Infinity;
  for (const el of lens?.querySelectorAll("*") ?? []) {
    if (![...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length > 0)) continue;
    smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
  }
  // Nothing runs out sideways past the panel.
  let overflowRight = 0;
  for (const el of lens?.querySelectorAll("*") ?? []) {
    const at = el.getBoundingClientRect();
    if (at.width === 0 && at.height === 0) continue;
    if (el.closest(".graview-scroll") && el.closest(".graview-scroll") !== el) continue;
    overflowRight = Math.max(overflowRight, at.right - box.right);
  }
  const picks = [...panel.querySelectorAll("[data-graview-pick]")].map((el) => {
    const at = el.getBoundingClientRect();
    const x = Math.round(at.x + at.width / 2);
    const y = Math.round(at.y + at.height / 2);
    const over = document.elementFromPoint(x, y);
    return {
      id: el.getAttribute("data-graview-pick"),
      x,
      y,
      inside: at.x >= box.x - 1 && at.right <= box.right + 1,
      // What a press there reaches is the panel, not a line or a district drawn over it.
      reachable: at.y < box.top || at.bottom > box.bottom ? null : over !== null && panel.contains(over),
    };
  });
  return {
    present: true,
    panel: panel.getAttribute("data-graview-map-panel"),
    width: Math.round(box.width),
    scaled,
    smallest: smallest === Infinity ? null : smallest,
    overflowRight: Math.round(overflowRight),
    screens: document.querySelectorAll("[data-graview-screen]").length,
    picks,
  };
};

const report = { at: new Date().toISOString(), engine: "canary-gpu", flags: GPU_ARGS, places: [] };
let browser;

try {
  browser = await launchCanaryGpu({ headless: !process.argv.includes("--headed"), extraArgs: GPU_ARGS });

  for (const app of APPS) {
    const vite = await startVite(app);
    try {
      for (const scheme of ["dark", "light"]) {
        const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
        await page.goto(`http://localhost:${app.port}/?theme=${scheme}${app.query ?? ""}`, { waitUntil: "load" });
        await page.waitForFunction((flag) => flag in window, app.ready, { timeout: 120_000 });

        for (const place of app.places) {
          if (place.switchTo) {
            // Switch place the way a person does: on the bar, by its name.
            await pressPlace(page, place.switchTo);
            await page.waitForTimeout(400);
          }
          // Rise above the stack.
          await page.click('[data-testid="overview"]');
          await page.waitForSelector('[data-testid="lens-panel"]', { timeout: 10_000 });
          // Let the transition settle: the layout tweens, and measuring
          // mid-flight would report a size nothing is ever drawn at.
          await page.waitForTimeout(900);

          const measured = await page.evaluate(measure);
          const entry = { app: app.name, scheme, place: place.label, lens: place.lens, ...measured };

          // Still LIVE: clicking a target in the picture beside the map chooses it.
          if (measured.present && measured.picks.length > 0) {
            const target = measured.picks.find((pick) => pick.inside && pick.reachable) ?? measured.picks[0];
            await page.mouse.click(target.x, target.y);
            await page.waitForTimeout(250);
            entry.clickedInside = target.id;
            // Chosen: the scene marks what is selected (it draws no strip beside it any more).
            entry.stillLive = await page.evaluate(
              () => document.querySelector("[data-graview-selected]") !== null || location.hash.includes("sel="),
            );
            // And it chose in place rather than traveling: the picture still stands beside the map.
            entry.stayedInGraview = await page.evaluate(
              () => document.querySelector('[data-testid="lens-panel"]') !== null && document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true",
            );
          }

          report.places.push(entry);
          // Back down for the next place.
          await page.click('[data-testid="overview"]');
          await page.waitForTimeout(400);
        }
        await page.close();
      }
    } finally {
      vite.stop();
    }
  }
} catch (error) {
  report.error = String(error);
} finally {
  await browser?.close();
}

/*
 * The verdict, stated as the criteria rather than as a pass count, so a
 * failure names which claim stopped being true.
 */
const places = report.places;
report.verdict = {
  everyPlaceStandsBesideTheMap: places.length > 0 && places.every((p) => p.present && p.panel === "dock"),
  noPictureIsDrawnSmallOnAPlot: places.every((p) => p.screens === 0),
  drawnAtItsOwnSize: places.every((p) => !p.present || (p.scaled === false && (p.width ?? 0) >= 440)),
  readableText: places.every((p) => !p.present || (p.smallest ?? 0) >= 11),
  nothingRunsOutSideways: places.every((p) => !p.present || p.overflowRight <= 1),
  everyPickInsideThePanel: places.every((p) => !p.present || p.picks.every((pick) => pick.inside)),
  nothingIsDrawnOverIt: places.every((p) => !p.present || p.picks.every((pick) => pick.reachable !== false)),
  staysLive: places.every((p) => p.clickedInside === undefined || p.stillLive === true),
  selectsInPlace: places.every((p) => p.clickedInside === undefined || p.stayedInGraview === true),
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;

const out = resolve(repoRoot, "docs/shrunk-interface.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n\nwrote ${out}\n`);
process.exit(report.passed ? 0 : 1);
