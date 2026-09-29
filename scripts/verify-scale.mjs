#!/usr/bin/env node
/**
 * A picture draws what a person can read, at a real size (docs/scale.md).
 *
 * The fixtures were a few dozen nodes, and every harness passed while a real
 * catalogue — Tech N9ne's discography, 1,177 songs, 568 artists, 479
 * releases, about 5,000 edges — drew 21,000 elements at altitude and panned
 * at one frame a second around its hub. This drives apps/discography's
 * PRODUCTION build (dev-mode React would exaggerate every number) and
 * records, per stop and gesture: the DOM, the hosts, the line strands, and
 * every frame's length from a requestAnimationFrame recorder with vsync off,
 * so a frame is exactly as long as the work in it.
 *
 *   node scripts/verify-scale.mjs            (writes docs/scale.json)
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(repoRoot, "apps/discography");
const PORT = 5198;
const ENGINE = engineName();
const report = { at: new Date().toISOString(), engine: ENGINE, stops: {} };

/* The page as it ships: built, then served by vite preview. */
execFileSync("npx", ["vite", "build"], { cwd: app, stdio: "ignore" });
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: app, detached: true, stdio: ["ignore", "pipe", "pipe"] });
await new Promise((ready, fail) => {
  const timer = setTimeout(() => fail(new Error("vite preview did not start")), 60_000);
  server.stdout.on("data", (chunk) => String(chunk).includes(String(PORT)) && (clearTimeout(timer), ready()));
});

let browser;
try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed"), args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  report.pageErrors = [];
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await page.addInitScript(() => {
    const w = window;
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__long.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
    w.__record = () => {
      w.__frames = [];
      w.__long = [];
      w.__on = true;
      let last = performance.now();
      const tick = (at) => {
        if (!w.__on) return;
        w.__frames.push(at - last);
        last = at;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    w.__stop = () => {
      w.__on = false;
      // The first frame is the new stop being laid out and drawn; it is judged apart.
      const first = w.__frames[1] ?? 0;
      const rest = w.__frames.slice(2).sort((a, b) => a - b);
      const at = (p) => (rest.length ? Math.round(rest[Math.min(rest.length - 1, Math.floor(rest.length * p))] * 10) / 10 : 0);
      return {
        frames: rest.length,
        first: Math.round(first),
        p50: at(0.5),
        p95: at(0.95),
        worst: rest.length ? Math.round(rest[rest.length - 1]) : 0,
        longTasks: w.__long.length,
        dom: document.querySelectorAll("*").length,
        hosts: document.querySelectorAll("[data-graview-view]").length,
        strands: document.querySelectorAll("[data-graview-connector]").length,
        // Thumbnails drawn once the scene is still and they are on screen, and those still waiting.
        thumbnails: document.querySelectorAll('[data-graview-thumbnail="drawn"]').length,
        waiting: document.querySelectorAll('[data-graview-thumbnail="waiting"]').length,
      };
    };
  });
  const measure = async (name, act, settle = 800) => {
    await page.evaluate(() => window.__record());
    // A gesture that cannot be made is recorded, not fatal: the next claim still gets measured.
    try {
      await act();
    } catch (error) {
      report.stops[`${name} (failed)`] = String(error).split("\n")[0].slice(0, 200);
    }
    await page.waitForTimeout(settle);
    const seen = await page.evaluate(() => window.__stop());
    report.stops[name] = seen;
    process.stdout.write(`${name.padEnd(34)} ${JSON.stringify(seen)}\n`);
    return seen;
  };
  const drag = async (x, y, dx, dy, steps = 30) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
  };
  const wheel = async (x, y, dy, times = 24) => {
    await page.mouse.move(x, y);
    for (let i = 0; i < times; i++) {
      await page.mouse.wheel(0, dy);
      await page.waitForTimeout(16);
    }
  };
  const travel = (hash) => page.evaluate((next) => { location.hash = next; }, hash);

  await page.goto(`http://localhost:${PORT}/?fresh=1#overview=1`, { waitUntil: "load" });
  await page.waitForSelector("[data-graview-view]", { timeout: 120_000 });
  await page.waitForTimeout(1500);

  /* ALTITUDE: the city, and the ground dragged and wheeled under it. */
  const city = await measure("altitude, still", async () => {}, 300);
  const cityDrag = await measure("altitude, drag", () => drag(700, 520, -260, -120));
  const cityWheel = await measure("altitude, wheel", () => wheel(700, 520, 60));

  /* DOWN, then THE HUB: an artist with more than a thousand songs. */
  const descend = await measure("descend", () => page.click('[data-testid="overview"]'), 1500);
  const hub = await measure("focus the hub", () => travel("#focus=artist%3Atech-n9ne"), 2000);
  const hubDrag = await measure("hub, drag", () => drag(700, 420, -260, -120));
  const hubWheel = await measure("hub, wheel", () => wheel(700, 420, 60));
  const groups = await page.evaluate(() =>
    [...document.querySelectorAll('[data-graview-plane="1"][data-graview-view^="aggregate:"]')].map((el) => ({
      id: el.getAttribute("data-graview-view"),
      opens: el.querySelector("[data-graview-band]")?.getAttribute("data-graview-band") ?? null,
      text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
    })),
  );
  report.groups = groups;

  /* A GROUP OPENS: a stop, its members take the band, Back closes it. */
  let opened = null;
  // An in-place group if the band drew one; the "+N more" door otherwise.
  const pressed = groups.find((group) => group.opens === "place") ?? groups[0];
  if (pressed) {
    const before = await page.evaluate(() => location.hash);
    await page.dblclick(`[data-graview-view="${pressed.id}"]`, { force: true, timeout: 5000 });
    await page.waitForTimeout(1500);
    const during = await page.evaluate(() => ({ hash: location.hash, band: document.querySelectorAll('[data-graview-plane="1"]').length }));
    await page.goBack();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => location.hash);
    opened = { pressed: pressed.opens, before, during, after };
  }
  report.opened = opened;

  /* A SELECTION AND A SEARCH at the hub. */
  const select = await measure("hub, select", async () => {
    // Pressed where it is drawn, whatever line runs over it: the claim is about the cost of selecting.
    const card = await page.$('[data-graview-plane="1"] [data-graview-pick], [data-graview-plane="1"][data-graview-view]');
    if (card) await card.click({ force: true, timeout: 5000 });
  }, 1200);
  const search = await measure("hub, type in Find", async () => {
    await page.keyboard.press("Escape");
    await page.keyboard.press("/");
    await page.keyboard.type("the", { delay: 80 });
  }, 1200);
  await page.keyboard.press("Escape");
  const rise = await measure("rise", () => page.click('[data-testid="overview"]'), 1500);

  /*
   * SIXTY FRAMES A SECOND, as this browser can measure it: headless Chromium
   * paces an idle frame at about 19 ms even with vsync off (the altitude,
   * still, baseline), so the p95 is held to 20 ms — a frame that fits — and
   * no frame after the first may take longer than 50 ms, three frames.
   */
  const holds = (stop) => stop && stop.p95 <= 20 && stop.worst <= 50;
  const quiet = (stop) => stop && stop.worst <= 50;
  report.verdict = {
    // The city at altitude is a map of districts, not every member of every lens drawn small —
    // and the thumbnails are still drawn, once it is still: light by budget, not by drawing nothing.
    theCityAtAltitudeIsLight: city.dom < 3000 && city.thumbnails > 0,
    // Focusing a hub draws what the band can hold, and says what the rest are.
    aHubStopIsBounded: hub.hosts <= 60 && hub.strands <= 120 && groups.length > 0,
    // A group is a real place: a stop whose members take the band, and Back closes it.
    everyGroupOpens:
      opened !== null &&
      opened.during.hash !== opened.before &&
      // A group opens in place, its members in the band; the door goes to the kind's picture.
      (opened.pressed === "place" ? opened.during.band > 0 : opened.during.hash.includes("in.filter=")) &&
      opened.after === opened.before,
    // Dragging the ground holds sixty frames a second, up high and at the hub.
    panningHolds60: holds(cityDrag) && holds(hubDrag),
    wheelHolds60: holds(cityWheel) && holds(hubWheel),
    // Rising, descending and changing focus: one first frame for the new stop, then sixty.
    aTransitionHolds60: [descend, hub, rise].every((stop) => stop.first <= 150 && holds(stop)),
    // Selecting and typing at the hub never drop a frame past 50 ms after the first.
    aSelectionAndASearchAreCheap: quiet(select) && quiet(search),
  };
} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid);
  } catch {}
}

report.passed = !report.error && report.verdict && Object.values(report.verdict).every(Boolean) && (report.pageErrors?.length ?? 0) === 0;
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/scale.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.verdict ?? report.error, null, 2)}\n\nwrote docs/scale.json\n`);
process.exit(report.passed ? 0 : 1);
