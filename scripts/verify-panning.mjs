#!/usr/bin/env node
/**
 * Does the city keep up with the hand?
 *
 * Every other harness here asks whether a claim still holds. This one asks
 * how fast, because "the picture lags behind the pointer" is not something a
 * screenshot or an assertion can catch — it is a distribution of frame
 * times, and the only honest way to have it is to measure it.
 *
 * The measurement is the browser's own animation frames, collected in the
 * page while a drag is actually running: the gap between successive frames
 * IS the frame time a person sees. A median rather than a mean, because one
 * long frame (a lens laying itself out for the first time) should not
 * condemn a drag that is otherwise smooth, and the worst frame is reported
 * beside it so that a drag which stutters once is not reported as clean.
 *
 *   node scripts/verify-panning.mjs [--headed] [--engine=webkit]
 *
 * Writes docs/panning.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

/**
 * What a drag has to clear.
 *
 * 55, not 60: a browser that is also decoding a font or running a GC will
 * drop one frame in a two-second drag on any machine, and a harness that
 * fails for that is a harness people start ignoring. What it will not
 * tolerate is the picture running at half rate, which is what this is for.
 */
const FLOOR = 55;
/*
 * AND NO SINGLE FRAME MAY DO MORE THAN THIS MUCH WORK — one stutter is
 * visible. In real milliseconds, and multiplied by the slowdown below,
 * because the processor is deliberately running at a quarter speed: a frame
 * that takes 83ms here is twenty-one milliseconds of actual work, and
 * judging it against a real-time budget was a unit error that flagged the
 * throttled browser's own jitter. A genuine stutter — the 117ms frames
 * rota's city was dropping — still fails this comfortably.
 */
const WORST_WORK_MS = 24;
/*
 * THE MEDIAN IS THE WRONG NUMBER ON ITS OWN, and it took a measurement to
 * see it: rota's city dropped 169 of 467 frames in a two-second drag and
 * still reported 59.9fps, because the frames it did not drop were fine. A
 * drag that stutters every third frame is not a drag at 60fps. So the share
 * of slow frames is a verdict of its own, and so is how long the thread
 * spent unable to answer anything at all.
 */
const SLOW_SHARE = 0.1;
const BLOCKED_MS = 500;

const APPS = [
  { name: "todo", port: 5193, ready: "__todoReady" },
  { name: "rota", port: 5195, ready: "__rotaReady" },
];

/*
 * THE SAMPLE GRAPHS ARE TWENTY NODES, and this machine draws twenty nodes
 * at sixty frames however wastefully it is asked to. A drag that recomputes
 * the world every frame still looks clean here and does not on a graph four
 * times the size — which is the graph people actually have.
 *
 * Rather than invent data, the harness slows the processor down. A quarter
 * of the speed on twenty nodes is the same arithmetic per frame as full
 * speed on eighty, and it is honest in its own right: somebody is reading
 * this on a laptop with thirty tabs open.
 */
const SLOWDOWN = 4;
const WORST_MS = WORST_WORK_MS * SLOWDOWN;

/**
 * A drag, measured.
 *
 * The frames are collected by the page itself rather than by counting
 * screenshots: a harness that samples from outside measures its own polling,
 * not the page's paint.
 */
async function dragAcross(page, { from, to, steps, label }) {
  await page.evaluate(() => {
    const at = [];
    const blocking = [];
    let stop = false;
    /*
     * LONG TASKS ARE THE HONEST NUMBER. A frame gap only grows once the
     * main thread misses its deadline, so work that costs eight
     * milliseconds every move hides completely at sixty frames — until the
     * graph doubles, and then it is all anybody sees. What the thread was
     * doing is the measurement; the frame gap is the symptom.
     */
    const watch =
      typeof PerformanceObserver === "undefined"
        ? null
        : new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) blocking.push(entry.duration);
          });
    try {
      watch?.observe({ entryTypes: ["longtask"] });
    } catch {
      // Not every engine reports long tasks; the frame gaps still stand.
    }
    window.__stopFrames = () => {
      stop = true;
      watch?.disconnect();
      return { at, blocking };
    };
    const tick = (now) => {
      at.push(now);
      if (!stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /*
   * ONE CALL, many moves. Awaiting each move separately puts a round trip
   * between every one of them, so the page is handed a gentle trickle of
   * input no hand ever produced and the harness measures its own latency.
   */
  /*
   * NEITHER THE HAND NOR THE URL IS THE MEASURE.
   *
   * Not the hand: a pan is clamped to what the city actually reaches, and
   * todo's whole city fits the window, so dragging it moves nothing at all
   * and that is right. Not the URL either: in the stack the pan is not
   * serialised at all, which is true of the code this replaced as well.
   *
   * What must hold is that LETTING GO CHANGES NOTHING. The drag moves the
   * layers with a transform and writes the pan on release, and the two must
   * be worth exactly the same — so the picture where the hand left it and
   * the picture a moment later are the same picture. The first version of
   * this change failed precisely here: releasing re-enabled the tween, and
   * the whole city flew back to where the drag started and animated forward
   * again over half a second.
   */
  const whereIsIt = () =>
    page.evaluate(() => {
      const card = document.querySelector("[data-graview-view]");
      const box = card?.getBoundingClientRect();
      return box ? { x: Math.round(box.left), y: Math.round(box.top) } : null;
    });

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });

  /*
   * THE FRAMES ARE THE DRAG'S OWN, and the clock stops at the release.
   * Letting go costs one full lay-out and one re-measure — the world has to
   * be put where the hand left it — and that frame is a legitimate cost at
   * the end of a gesture, not a stutter during it. Counting it condemned
   * every drag for the one frame that finishes it.
   */
  const { at: stamps, blocking } = await page.evaluate(() => window.__stopFrames());
  const underHand = await whereIsIt();
  await page.mouse.up();
  await page.waitForTimeout(600);
  const afterwards = await whereIsIt();

  /*
   * AND THE WORLD IS WHERE THE HAND LEFT IT.
   *
   * The drag moves the layers with a transform and writes the pan on
   * release, which is the whole of the speed — and exactly the sort of
   * trade that can leave the picture a few pixels out, or leave a transform
   * on a layer for good if the release is missed. So the gesture is checked
   * as well as timed: nothing may still be transformed, and a card must have
   * travelled the distance the pointer did.
   */
  const stuck = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-graview-world]")].filter((el) => {
        const move = getComputedStyle(el).transform;
        return move !== "none" && move !== "";
      }).length,
  );
  const gaps = [];
  for (let i = 1; i < stamps.length; i += 1) gaps.push(stamps[i] - stamps[i - 1]);
  if (gaps.length < 8) return { label, frames: gaps.length, error: "too few frames to judge" };
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const worst = sorted[sorted.length - 1];
  return {
    label,
    frames: gaps.length,
    medianMs: Number(median.toFixed(2)),
    worstMs: Number(worst.toFixed(2)),
    fps: Number((1000 / median).toFixed(1)),
    // What a person actually complains about: how much of the drag was slow.
    slowFrames: gaps.filter((gap) => gap > 1000 / FLOOR).length,
    // How long the thread spent unable to answer anything, over the drag.
    blockedMs: Number(blocking.reduce((sum, one) => sum + one, 0).toFixed(1)),
    stuckLayers: stuck,
    // How far the picture shifted between the hand letting go and the world coming to rest.
    jumpOnRelease:
      underHand && afterwards
        ? Math.round(Math.hypot(afterwards.x - underHand.x, afterwards.y - underHand.y))
        : null,
  };
}

const report = { at: new Date().toISOString(), engine: ENGINE, floor: FLOOR, slowdown: SLOWDOWN, runs: [] };
let browser;

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  for (const app of APPS) {
    const vite = await serving(app.name, app.port, repoRoot);
    try {
      const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
      try {
        await page.goto(`${vite.url}/?theme=light`, { waitUntil: "load" });
        await page.waitForFunction((flag) => flag in window, app.ready, { timeout: 120_000 });
        await page.waitForTimeout(1200);
        // Slowed to stand in for a bigger graph; see SLOWDOWN.
        const cdp = await page.context().newCDPSession(page).catch(() => null);
        await cdp?.send("Emulation.setCPUThrottlingRate", { rate: SLOWDOWN });

        // In the stack first: the picture a person spends most of their time in.
        report.runs.push({
          app: app.name,
          where: "stack",
          ...(await dragAcross(page, { from: { x: 900, y: 600 }, to: { x: 500, y: 300 }, steps: 120, label: "drag the ground" })),
        });

        // Then at altitude, where there is a whole city under the hand.
        await page.click('[data-testid="overview"]');
        await page.waitForTimeout(1400);
        report.runs.push({
          app: app.name,
          where: "altitude",
          ...(await dragAcross(page, { from: { x: 900, y: 600 }, to: { x: 500, y: 300 }, steps: 120, label: "drag the city" })),
        });
      } finally {
        await page.close();
      }
    } catch (error) {
      report.runs.push({ app: app.name, error: String(error).slice(0, 200) });
    } finally {
      vite.stop();
    }
  }
} catch (error) {
  report.error = String(error);
} finally {
  await browser?.close();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/panning.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

let bad = 0;
for (const run of report.runs) {
  if (run.error) {
    process.stdout.write(`FAIL ${run.app}/${run.where ?? "?"}: ${run.error}\n`);
    bad += 1;
    continue;
  }
  const share = run.slowFrames / run.frames;
  const faults = [
    run.fps < FLOOR ? `${run.fps}fps` : "",
    share > SLOW_SHARE ? `${Math.round(share * 100)}% of frames slow` : "",
    run.blockedMs > BLOCKED_MS ? `thread blocked ${Math.round(run.blockedMs)}ms` : "",
    run.worstMs > WORST_MS ? `one frame took ${run.worstMs}ms` : "",
    run.stuckLayers > 0 ? `${run.stuckLayers} layers still transformed` : "",
    run.jumpOnRelease !== null && run.jumpOnRelease > 2 ? `the picture jumped ${run.jumpOnRelease}px on release` : "",
  ].filter(Boolean);
  if (faults.length) bad += 1;
  process.stdout.write(
    `${faults.length ? "??" : "ok"} ${`${run.app}/${run.where}`.padEnd(18)} ${String(run.fps).padStart(5)}fps  worst ${String(run.worstMs).padStart(6)}ms  ${String(run.slowFrames).padStart(3)}/${run.frames} slow  blocked ${String(run.blockedMs).padStart(6)}ms  jump ${String(run.jumpOnRelease).padStart(3)}px  ${faults.join("; ")}\n`,
  );
}
process.stdout.write(`\n${report.runs.length - bad} of ${report.runs.length} drags hold ${FLOOR}fps\n`);
process.exit(report.error || bad > 0 ? 1 : 0);
