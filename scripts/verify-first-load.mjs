#!/usr/bin/env node
/**
 * HOW LONG A PERSON WAITS: THE FIRST LOAD AND A PAGE SWITCH, TIMED.
 *
 * Nick, on the Graview Roadmap in Graview Cloud (2026-10-15): "too slow to
 * load initially and between pages". The bundle budgets
 * (`bundle-budget.mjs`, `hosted-page.mjs`) hold what a page carries; this
 * holds how long it takes. It serves Graview Cloud's shell as `graview
 * preview` builds it — the page bundled as Cloud bundles it, handed the
 * compiled app, the store opened over the wire, the embed mounted as the
 * whole page — gzipped and over HTTP/2 as a host serves it
 * (`lib/secure-front.mjs`), over two apps:
 *
 *   the roadmap: `scripts/fixtures/roadmap/roadmap.gdd.json`, its seed grown
 *   to the Roadmap's size today (190 features under 14 areas, 60 requests,
 *   28 releases, 20 briefs: 330 records and about 600 links);
 *
 *   the tasks: `packages/core/tests/document/fixtures/tasks.gdd.json`, a
 *   small team's tasks the size of the todo example (16 tasks, 4 people);
 *
 * at a desk (1280 × 800, the machine as it is, a host 40 ms away at 20
 * Mbit/s) and on a mid-range phone (390 × 844, the CPU slowed four times
 * and the network a slow 4G: 562.5 ms of latency, 1.47 Mbit/s down,
 * 675 kbit/s up — what Lighthouse's mobile run applies). Each is timed from
 * a cold start (no cache, a new context), the median of `--runs` (3 by
 * default):
 *
 *   cold — first useful paint (the face drawn and painted: the app's bar
 *   and its home), and interactive (the end of the last long task before
 *   two quiet seconds on the main thread, from the useful paint on);
 *   list → record — a press on a list's first row until the record's page
 *   is painted, and until it is settled (its last long task over);
 *   pages → scene — a press on the bar's Scene until the scene's ground is
 *   painted, and settled.
 *
 * A switch is pressed once the page is interactive and has been quiet two
 * seconds, as a reader who has looked at it would press it.
 *
 * Chromium only: the CPU and network throttling are DevTools'. The watch
 * (`lib/watch.mjs`) is not attached — its observers would run inside what
 * is timed; every other harness opens these faces under it.
 *
 * And what a cold load asks for before the place has drawn and settled
 * (`data-graview-drawn`): its requests and bytes, and every script the
 * head did not name — a door opened only once the face had run, a round
 * trip after the face's own (FR-194). Each app on each profile holds that
 * there are none (`…DrawsPagesWithNoChunkAskedForAfterTheFace`).
 *
 * THE BUDGET (`TIMING_BUDGET`, below) is what CI holds, with room for a
 * shared runner's noise.
 *
 *   node scripts/verify-first-load.mjs [--runs=3] [--quick] [--out=<file.json>]
 *
 * `--quick` measures the desk alone. Writes docs/first-load.json.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createMemoryAdapter } from "../packages/core/dist/index.js";
import { servePreview } from "../packages/ship/dist/index.js";
import { portFor } from "./lib/ports.mjs";
import { secureFront } from "./lib/secure-front.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = resolve(repoRoot, "packages/graview/dist/preview");
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const RUNS = Number(process.argv.find((arg) => arg.startsWith("--runs="))?.slice("--runs=".length) ?? 3);
const OUT = process.argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length);

if (!existsSync(resolve(PAGE, "index.html"))) {
  process.stderr.write("verify-first-load: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

/* ── the two apps ─────────────────────────────────────────────────────── */

/** The roadmap fixture's seed, grown from 146 features to the 190 the Roadmap holds today, the same every run. */
function grownRoadmapSeed() {
  const seed = JSON.parse(readFileSync(resolve(repoRoot, "scripts/fixtures/roadmap/roadmap.seed.json"), "utf8"));
  const features = seed.nodes.filter((node) => node.kind === "feature");
  let edge = seed.edges.length;
  for (let at = features.length; at < 190; at++) {
    const like = features[at % features.length];
    seed.nodes.push({ ...like, id: `feature-${at}`, name: `${like.name} again (${at})`, stage: ["considering", "planned", "building"][at % 3] });
    seed.edges.push({ id: `e${++edge}`, kind: "partOf", from: `feature-${at}`, to: `area-${at % 14}` });
    if (at % 5 === 0) seed.edges.push({ id: `e${++edge}`, kind: "dependsOn", from: `feature-${at}`, to: `feature-${at - 40}` });
  }
  return seed;
}

/** A small team's tasks, the todo example's size. */
function tasksSeed() {
  const people = ["Ada", "Ben", "Cleo", "Dev"].map((label, at) => ({ id: `person-${at}`, kind: "person", label }));
  const verbs = ["Book", "Write", "Fix", "Plan"];
  const things = ["the venue", "the newsletter", "the gate", "the trip"];
  const tasks = Array.from({ length: 16 }, (_, at) => ({
    id: `task-${at}`,
    kind: "task",
    label: `${verbs[at % 4]} ${things[Math.floor(at / 4)]}`,
    status: ["todo", "doing", "done"][at % 3],
    ...(at % 2 === 0 ? { due: `2026-10-${String(10 + at).padStart(2, "0")}` } : {}),
  }));
  const edges = tasks.map((task, at) => ({ id: `e${at}`, kind: "assigned-to", from: task.id, to: people[at % 4].id }));
  return { nodes: [...tasks, ...people], edges };
}

const APPS = [
  { name: "roadmap", port: portFor("first-load-roadmap"), document: "scripts/fixtures/roadmap/roadmap.gdd.json", seed: grownRoadmapSeed(), list: "/features" },
  { name: "tasks", port: portFor("first-load-tasks"), document: "packages/core/tests/document/fixtures/tasks.gdd.json", seed: tasksSeed(), list: "/tasks" },
];

/* ── the two profiles ─────────────────────────────────────────────────── */

const PROFILES = [
  // A desk on broadband: the machine as it is, and a host 40 ms away at 20 Mbit/s.
  { name: "desk", viewport: { width: 1280, height: 800 }, cpu: 1, network: { offline: false, latency: 40, downloadThroughput: (20 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8 } },
  {
    name: "phone",
    viewport: { width: 390, height: 844 },
    cpu: 4,
    // DevTools' "Slow 4G", as Lighthouse's mobile run applies it: bytes a second.
    network: { offline: false, latency: 562.5, downloadThroughput: (1.4746 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 },
  },
];

/*
 * WHAT CI HOLDS, in milliseconds: a median over the runs above one fails.
 *
 * At a desk, the bar the Roadmap's ask set (f-perf-first-load): a cold
 * load interactive within 2 s, a page switch within 300 ms. After the
 * first-load work a laptop measured a third of a second cold and under
 * 40 ms a switch (docs/first-load.md), so a runner several times slower
 * still holds, and a page that comes to wait what it waited before the
 * work — the scene 343 ms from a press — fails.
 *
 * On the phone the network is emulated and the same everywhere; the CPU,
 * slowed four times, is the runner's, slower than a laptop's. Each budget
 * is what a laptop measured after the work with room for a runner two or
 * three times slower in its CPU share: the roadmap 3.4 s to its useful
 * paint and 5.2 s to interactive (7.6 s before the work), the tasks 3.4 s
 * (5.1 s before), a switch to a record 55 ms and to the scene 0.8 s.
 */
const TIMING_BUDGET = {
  roadmap: {
    desk: { useful: 2_000, interactive: 2_000, record: 300, scene: 300 },
    phone: { useful: 5_500, interactive: 7_000, record: 500, scene: 2_000 },
  },
  tasks: {
    desk: { useful: 2_000, interactive: 2_000, record: 300, scene: 300 },
    phone: { useful: 5_500, interactive: 5_500, record: 500, scene: 2_000 },
  },
};

/* ── what is timed in the page ────────────────────────────────────────── */

/**
 * Before anything of the page runs: long tasks recorded, and the moment the
 * face is drawn and painted (the page's `__graviewReady`, then a frame).
 */
function timers() {
  const w = window;
  w.__long = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) w.__long.push({ start: entry.startTime, end: entry.startTime + entry.duration });
  }).observe({ type: "longtask", buffered: true });
  // The moment the place says it has drawn and settled (`data-graview-drawn`, FR-188): every part it draws arrived.
  new MutationObserver((records, watcher) => {
    if (w.__drawnAt !== undefined || !document.querySelector("[data-graview-drawn]")) return;
    w.__drawnAt = performance.now();
    watcher.disconnect();
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-graview-drawn"] });
  let ready = false;
  Object.defineProperty(w, "__graviewReady", {
    configurable: true,
    get: () => ready,
    set: (value) => {
      ready = value;
      if (value === true && w.__useful === undefined) requestAnimationFrame(() => setTimeout(() => (w.__useful ??= performance.now()), 0));
    },
  });
}

/** Wait in the page until the main thread has been quiet for `quiet` ms since `from`, and say when its last long task ended. */
async function settledAfter(page, from, { quiet = 2_000, limit = 30_000 } = {}) {
  return page.evaluate(
    ({ from, quiet, limit }) =>
      new Promise((done) => {
        const started = performance.now();
        const tick = () => {
          const now = performance.now();
          const last = window.__long.filter((task) => task.end > from).reduce((latest, task) => Math.max(latest, task.end), from);
          if (now - last >= quiet || now - started > limit) done(last);
          else setTimeout(tick, 100);
        };
        tick();
      }),
    { from, quiet, limit },
  );
}

/** Press in the page, and time until `selector` holds something and a frame has painted it. */
async function pressUntil(page, press, drawn) {
  return page.evaluate(
    ({ press, drawn }) =>
      new Promise((done, fail) => {
        const target = document.querySelector(press);
        if (!target) return fail(new Error(`nothing to press at ${press}`));
        const there = () => [...document.querySelectorAll(drawn.selector)].length >= (drawn.least ?? 1);
        const start = performance.now();
        const finish = () => requestAnimationFrame(() => setTimeout(() => done({ start, painted: performance.now() }), 0));
        const watcher = new MutationObserver(() => {
          if (!there()) return;
          watcher.disconnect();
          finish();
        });
        watcher.observe(document.body, { childList: true, subtree: true, attributes: true });
        setTimeout(() => (watcher.disconnect(), fail(new Error(`${drawn.selector} not drawn within 60 s`))), 60_000);
        target.click();
      }),
    { press, drawn },
  );
}

/* ── the run ──────────────────────────────────────────────────────────── */

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)]);
};

async function contextFor(browser, profile) {
  const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: 1, colorScheme: "light", ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.addInitScript(timers);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (profile.network) await cdp.send("Network.emulateNetworkConditions", profile.network);
  if (profile.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
  return { context, page };
}

/** Every script the page's head names — its entry and the chunks it preloads: what is asked for as the head is read. */
async function namedInTheHead(context, url) {
  const html = await (await context.request.get(url)).text();
  return new Set([...html.matchAll(/"(\/[^"]+\.js)"/g)].map((match) => new URL(match[1], url).pathname));
}

/*
 * WHAT IS ASKED FOR AFTER THE FACE'S OWN (FR-194). A door inside a face —
 * the home's lenses, a list's arranging, the bar's Activity, the scene's
 * ribbons and plots — opened only once the face has run is a round trip
 * after the face's chunk, half a second and more on a phone. Every script
 * asked for before the place has drawn and settled that the head did not
 * name is one.
 */
async function askedLate(page, head) {
  return page.evaluate(
    (head) => {
      const until = window.__drawnAt ?? performance.now();
      return performance
        .getEntriesByType("resource")
        .filter((entry) => entry.startTime < until && new URL(entry.name).pathname.endsWith(".js") && !head.includes(new URL(entry.name).pathname))
        .map((entry) => new URL(entry.name).pathname);
    },
    [...head],
  );
}

async function openCold(page, url, errors) {
  page.on("pageerror", (error) => errors.push(`${url}: ${error.message}`));
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__useful !== undefined || typeof window.__graviewFailed === "string", null, { timeout: 120_000, polling: 50 });
  const failed = await page.evaluate(() => window.__graviewFailed ?? null);
  if (failed) throw new Error(`${url} did not open: ${failed}`);
  const useful = await page.evaluate(() => window.__useful);
  await page.waitForFunction(() => window.__drawnAt !== undefined, null, { timeout: 60_000, polling: 50 });
  const late = await askedLate(page, await namedInTheHead(page.context(), url));
  const drawn = await page.evaluate(() => window.__drawnAt);
  const interactive = await settledAfter(page, useful);
  const resources = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    const drawn = window.__drawnAt ?? Infinity;
    const before = entries.filter((entry) => entry.startTime < drawn);
    const size = (entry) => entry.transferSize || entry.encodedBodySize || 0;
    return {
      requests: entries.length + 1,
      scripts: entries.filter((entry) => entry.initiatorType === "script" || entry.name.endsWith(".js")).length,
      bytes: entries.reduce((sum, entry) => sum + size(entry), 0),
      // Before the place has drawn and settled: what a person waited on.
      requestsBeforeDrawn: before.length + 1,
      bytesBeforeDrawn: before.reduce((sum, entry) => sum + size(entry), 0),
    };
  });
  return { useful, drawn, interactive, late, ...resources };
}

async function measure(browser, app, profile, errors) {
  const base = app.url;
  const cold = [];
  const record = [];
  const scene = [];
  const late = new Set();
  for (let run = 0; run < RUNS; run++) {
    // Cold: the home, from nothing.
    {
      const { context, page } = await contextFor(browser, profile);
      cold.push(await openCold(page, `${base}/`, errors));
      for (const one of cold.at(-1).late) late.add(`/ ${one}`);
      // Pages → Scene, from the home just opened.
      const pressed = await pressUntil(page, '[data-testid="app-face-scene"]', { selector: ".graview-ground *", least: 3 });
      const settled = await settledAfter(page, pressed.painted);
      scene.push({ painted: pressed.painted - pressed.start, settled: Math.max(settled, pressed.painted) - pressed.start });
      await context.close();
    }
    // List → record: the list opened, then its first row pressed.
    {
      const { context, page } = await contextFor(browser, profile);
      const list = await openCold(page, `${base}${app.list}`, errors);
      for (const one of list.late) late.add(`${app.list} ${one}`);
      const pressed = await pressUntil(page, '[data-testid="records"] li a', { selector: '[data-testid="record-fields"]' });
      const settled = await settledAfter(page, pressed.painted);
      record.push({ painted: pressed.painted - pressed.start, settled: Math.max(settled, pressed.painted) - pressed.start });
      await context.close();
    }
  }
  return {
    useful: median(cold.map((one) => one.useful)),
    drawn: median(cold.map((one) => one.drawn)),
    interactive: median(cold.map((one) => one.interactive)),
    record: median(record.map((one) => one.painted)),
    recordSettled: median(record.map((one) => one.settled)),
    scene: median(scene.map((one) => one.painted)),
    sceneSettled: median(scene.map((one) => one.settled)),
    requests: median(cold.map((one) => one.requests)),
    bytes: median(cold.map((one) => one.bytes)),
    requestsBeforeDrawn: median(cold.map((one) => one.requestsBeforeDrawn)),
    bytesBeforeDrawn: median(cold.map((one) => one.bytesBeforeDrawn)),
    askedAfterTheFace: [...late],
    runs: { cold, record, scene },
  };
}

const report = { at: new Date().toISOString(), engine: "chromium", runs: RUNS, profiles: PROFILES.map(({ name, viewport, cpu, network }) => ({ name, viewport, cpu, network })), measured: {}, checks: {} };
const errors = [];
const previews = [];
let browser;
try {
  for (const app of APPS) {
    const document = JSON.parse(readFileSync(resolve(repoRoot, app.document), "utf8"));
    const preview = await servePreview({ document, seed: app.seed, page: PAGE, port: 0, adapter: createMemoryAdapter() });
    const front = await secureFront(app.port, preview.served.port);
    app.url = front.url;
    previews.push({ close: async () => (await front.stop(), await preview.close()) });
  }
  browser = await chromium.launch({ headless: true });
  for (const app of APPS) {
    report.measured[app.name] = {};
    for (const profile of QUICK ? PROFILES.slice(0, 1) : PROFILES) {
      const measured = await measure(browser, app, profile, errors);
      report.measured[app.name][profile.name] = measured;
      process.stdout.write(
        `${app.name} ${profile.name}: useful ${measured.useful} ms, drawn and settled ${measured.drawn} ms, interactive ${measured.interactive} ms, list → record ${measured.record} ms (settled ${measured.recordSettled}), pages → scene ${measured.scene} ms (settled ${measured.sceneSettled}); ${measured.requests} requests, ${Math.round(measured.bytes / 1024)} KB; before the home drew ${measured.requestsBeforeDrawn} requests, ${Math.round(measured.bytesBeforeDrawn / 1024)} KB, ${measured.askedAfterTheFace.length} asked for after the face\n`,
      );
      const budget = TIMING_BUDGET[app.name][profile.name];
      for (const [what, limit] of Object.entries(budget)) {
        const name = `${app.name}On${profile.name[0].toUpperCase()}${profile.name.slice(1)}${{ useful: "IsUsefulWithin", interactive: "IsInteractiveWithin", record: "GoesFromAListToARecordWithin", scene: "GoesFromPagesToTheSceneWithin" }[what]}${limit}Ms`;
        report.checks[name] = { measured: measured[what], budget: limit, ok: measured[what] <= limit };
      }
      report.checks[`${app.name}On${profile.name[0].toUpperCase()}${profile.name.slice(1)}DrawsPagesWithNoChunkAskedForAfterTheFace`] = { late: measured.askedAfterTheFace, ok: measured.askedAfterTheFace.length === 0 };
    }
  }
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  for (const preview of previews) await preview.close();
}

writeFileSync(resolve(repoRoot, OUT ?? "docs/first-load.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}${check.measured !== undefined ? ` (${check.measured} ms)` : ""}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.exit(report.passed ? 0 : 1);
