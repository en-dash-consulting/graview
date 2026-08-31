#!/usr/bin/env node
/**
 * Does the shrunk interface survive being shrunk?
 *
 * The Graview keeps your actual interface in the middle of the ring rather
 * than a card standing in for it, and the claim that makes that worth doing
 * is that it is the SAME picture, scaled — still complete, still legible,
 * still live. That claim is about pixels, so no amount of static rendering
 * settles it. This walks every place in every app, in both schemes, into the
 * Graview, and measures the shrunk view:
 *
 *   - it laid itself out at its natural size, not at the slot's size
 *   - the scale is uniform, so nothing is stretched
 *   - its content fits inside its own box, so nothing is clipped
 *   - the pick targets inside it are still real targets, at real coordinates
 *
 *   node scripts/verify-shrunk.mjs [--headed]
 *
 * Writes docs/shrunk-interface.json.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const BROWSER =
  process.env["GRAVIEW_BROWSER"] ??
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const FLAGS = [
  "--enable-blink-features=CanvasDrawElement",
  "--enable-unsafe-webgpu",
  "--use-angle=metal",
];

/**
 * Every place worth checking, named the way the app names it.
 *
 * The the coaching example's three are the hard cases — a board, a matrix and a timeline are
 * three genuinely different pictures — and the bid desk is the fourth lens.
 * The household example's week is the one the whole thing started from.
 */
const APPS = [
  {
    name: "the coaching example",
    port: 5192,
    ready: "__the coaching exampleReady",
    places: [
      { label: "The team", switchTo: "The team", lens: "board" },
      { label: "What we train", switchTo: "What we train", lens: "coverage" },
      { label: "The week", switchTo: "The week", lens: "timeline" },
    ],
  },
  {
    name: "proposal",
    port: 5191,
    ready: "__proposalReady",
    places: [{ label: "the bid desk", switchTo: null, lens: "coverage" }],
  },
  {
    name: "the household example",
    port: 5190,
    ready: "__the household exampleReady",
    places: [{ label: "the week", switchTo: null, lens: "timeline" }],
  },
];

/*
 * Its own process GROUP, so stopping it stops vite and not merely the `npx`
 * that launched it. Killing the wrapper leaves the server holding the port,
 * and the next app in the loop then fails to start for a reason that has
 * nothing to do with what is being tested.
 */
function startVite(app) {
  const child = spawn("npx", ["vite"], {
    cwd: resolve(repoRoot, `apps/${app.name}`),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start in 40s")), 40_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes(String(app.port))) {
        clearTimeout(timer);
        ready(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`vite exited with ${code}`));
    });
  });
}

/**
 * What the browser says about the shrunk view, measured rather than assumed.
 *
 * `getBoundingClientRect` reports the box AFTER every transform, which is
 * exactly the question: the natural box is 1040 wide in its own coordinates
 * and must land inside a slot half that on screen.
 */
const measure = () => {
  const natural = document.querySelector("[data-graview-natural]");
  if (!natural) return { present: false };
  const host = natural.closest("[data-graview-view]");
  const declared = natural.getAttribute("data-graview-natural").split("x").map(Number);
  const drawn = natural.getBoundingClientRect();
  const slot = host.getBoundingClientRect();

  // Every element inside, in the natural box's OWN coordinates: the transform
  // scales both alike, so overflow is a ratio and survives the scaling.
  let overflowRight = 0;
  let overflowBottom = 0;
  for (const el of natural.querySelectorAll("*")) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    overflowRight = Math.max(overflowRight, box.right - drawn.right);
    overflowBottom = Math.max(overflowBottom, box.bottom - drawn.bottom);
  }

  // Anything that scrolls inside the shrunk view is content that did not fit.
  let clipped = null;
  for (const el of natural.querySelectorAll(".graview-scroll")) {
    if (el.scrollHeight > el.clientHeight + 1) {
      clipped = { by: el.scrollHeight - el.clientHeight, of: el.scrollHeight };
      break;
    }
  }

  const picks = [...natural.querySelectorAll("[data-graview-pick]")].map((el) => {
    const box = el.getBoundingClientRect();
    return {
      id: el.getAttribute("data-graview-pick"),
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
      inside:
        box.x >= slot.x - 1 &&
        box.y >= slot.y - 1 &&
        box.right <= slot.right + 1 &&
        box.bottom <= slot.bottom + 1,
    };
  });

  return {
    present: true,
    natural: { width: declared[0], height: declared[1] },
    drawn: { width: Math.round(drawn.width), height: Math.round(drawn.height) },
    slot: { width: Math.round(slot.width), height: Math.round(slot.height) },
    scaleX: drawn.width / declared[0],
    scaleY: drawn.height / declared[1],
    overflowRight: Math.round(overflowRight),
    overflowBottom: Math.round(overflowBottom),
    clipped,
    picks,
  };
};

const report = { at: new Date().toISOString(), browser: BROWSER, flags: FLAGS, places: [] };
let browser;

try {
  browser = await chromium.launch({
    executablePath: BROWSER,
    headless: !process.argv.includes("--headed"),
    args: FLAGS,
  });

  for (const app of APPS) {
    const vite = await startVite(app);
    try {
      for (const scheme of ["dark", "light"]) {
        const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
        await page.goto(`http://localhost:${app.port}/?theme=${scheme}`, { waitUntil: "load" });
        await page.waitForFunction((flag) => flag in window, app.ready, { timeout: 120_000 });

        for (const place of app.places) {
          if (place.switchTo) {
            // Switch place the way a person does: press the button that says so.
            await page
              .locator('[data-testid="places"] button', { hasText: place.switchTo })
              .first()
              .click();
            await page.waitForTimeout(400);
          }
          // Rise above the stack.
          await page.click('[data-testid="overview"]');
          await page.waitForSelector("[data-graview-natural]", { timeout: 10_000 });
          // Let the transition settle: the layout tweens, and measuring
          // mid-flight would report a size nothing is ever drawn at.
          await page.waitForTimeout(900);

          const measured = await page.evaluate(measure);
          const entry = { app: app.name, scheme, place: place.label, lens: place.lens, ...measured };

          // Still LIVE: clicking a target inside the shrunk view selects it.
          if (measured.present && measured.picks.length > 0) {
            const target = measured.picks.find((pick) => pick.inside) ?? measured.picks[0];
            await page.mouse.click(target.x, target.y);
            await page.waitForTimeout(250);
            entry.clickedInside = target.id;
            entry.stillLive = await page.evaluate(
              () => document.querySelector('[data-testid="inspector-strip"]') !== null,
            );
            // And it selected in place rather than travelling.
            entry.stayedInGraview = await page.evaluate(
              () => document.querySelector("[data-graview-natural]") !== null,
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
      try {
        process.kill(-vite.pid, "SIGKILL");
      } catch {
        vite.kill("SIGKILL");
      }
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
  everyPlaceShrinks: places.length > 0 && places.every((p) => p.present),
  // Uniform to within a rounding error on the drawn box.
  scaleIsUniform: places.every((p) => !p.present || Math.abs(p.scaleX - p.scaleY) < 0.01),
  // The view laid itself out at the size it was designed for.
  laidOutAtNaturalSize: places.every((p) => !p.present || p.natural.width > p.slot.width),
  nothingOverflows: places.every((p) => !p.present || (p.overflowRight <= 1 && p.overflowBottom <= 1)),
  nothingClipped: places.every((p) => !p.present || p.clipped === null),
  everyPickInsideTheSlot: places.every(
    (p) => !p.present || p.picks.every((pick) => pick.inside),
  ),
  staysLive: places.every((p) => p.clickedInside === undefined || p.stillLive === true),
  selectsInPlace: places.every((p) => p.clickedInside === undefined || p.stayedInGraview === true),
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;

const out = resolve(repoRoot, "docs/shrunk-interface.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n\nwrote ${out}\n`);
process.exit(report.passed ? 0 : 1);
