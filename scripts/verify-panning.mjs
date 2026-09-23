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
/**
 * A WHEEL IS A HAND TOO, and is measured the same way.
 *
 * The drag came off writing state per move long before the wheel did, so
 * for a while the same picture was smooth under a finger and not under a
 * trackpad — one gesture measured, the other taken on trust.
 */
async function wheelAcross(page, { at, ticks, label }) {
  await watchFrames(page);
  await page.mouse.move(at.x, at.y);
  const before = await whereIsIt(page);
  /*
   * THE NOTCHES COME FROM INSIDE THE PAGE, one per animation frame.
   *
   * `page.mouse.wheel` awaits a round trip per call, and under a quartered
   * processor two notches could be more than 160ms apart — which is the
   * window after which a wheel is considered to have stopped. So the
   * harness's own latency broke one gesture into several, each paying the
   * commit that ends a gesture, and the measurement blamed the app for it:
   * a hundred-millisecond frame a third of the way through a wheel that a
   * trackpad would never have produced.
   *
   * A trackpad delivers a notch about every frame. So does this.
   */
  await page.evaluate(
    ({ x, y, ticks }) =>
      new Promise((done) => {
        const target = document.elementFromPoint(x, y) ?? document.body;
        let sent = 0;
        const send = () => {
          target.dispatchEvent(
            new WheelEvent("wheel", { deltaX: -18, deltaY: -14, clientX: x, clientY: y, bubbles: true, cancelable: true }),
          );
          sent += 1;
          if (sent < ticks) requestAnimationFrame(send);
          else done(undefined);
        };
        requestAnimationFrame(send);
      }),
    { x: at.x, y: at.y, ticks },
  );
  const { at: stamps, blocking } = await page.evaluate(() => window.__stopFrames());
  const underHand = await whereIsIt(page);
  // The wheel settles on its own, 160ms after it stops turning.
  await page.waitForTimeout(700);
  const afterwards = await whereIsIt(page);
  const stuck = await stuckLayers(page);
  return {
    ...framesToVerdict(stamps, blocking, label),
    stuckLayers: stuck,
    jumpOnRelease:
      underHand && afterwards
        ? Math.round(Math.hypot(afterwards.x - underHand.x, afterwards.y - underHand.y))
        : null,
    moved: before && afterwards ? Math.round(Math.hypot(afterwards.x - before.x, afterwards.y - before.y)) : 0,
  };
}

/**
 * START THE CLOCK. Frames are collected by the page itself rather than by
 * sampling from outside: a harness that polls measures its own polling, not
 * the page's paint.
 */
const watchFrames = (page) =>
  page.evaluate(() => {
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
 * NEITHER THE HAND NOR THE URL IS THE MEASURE.
 *
 * Not the hand: a pan is clamped to what the city actually reaches, and
 * todo's whole city fits the window, so dragging it moves nothing at all
 * and that is right. Not the URL either: in the stack the pan is not
 * serialised at all, which was true of the code this replaced as well.
 *
 * What must hold is that LETTING GO CHANGES NOTHING — the picture where the
 * gesture left it and the picture a moment later are the same picture. The
 * first version of the transform failed precisely here: ending the gesture
 * re-enabled the tween, and the whole city flew back to where it had
 * started and animated forward again over half a second.
 */
const whereIsIt = (page) =>
  page.evaluate(() => {
    const card = document.querySelector("[data-graview-view]");
    const box = card?.getBoundingClientRect();
    return box ? { x: Math.round(box.left), y: Math.round(box.top) } : null;
  });

/** A transform left behind is a world stuck where nobody put it. */
const stuckLayers = (page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("[data-graview-world]")].filter((el) => {
        const move = getComputedStyle(el).transform;
        return move !== "none" && move !== "";
      }).length,
  );

/** Frame stamps and blocked time, as the numbers a person argues about. */
function framesToVerdict(stamps, blocking, label) {
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
    slowFrames: gaps.filter((gap) => gap > 1000 / FLOOR).length,
    blockedMs: Number(blocking.reduce((sum, one) => sum + one, 0).toFixed(1)),
  };
}

/**
 * OPEN GROUND near where the gesture wants to start. A fixed point is a
 * guess about an app's layout: when Rota gained a kind, its new district
 * landed on (900, 600), the "drag the ground" began on a card — which is a
 * press, not a pan — and the run measured a gesture that never happened.
 * So the start is searched for: the nearest point, outward from the one
 * asked for, that has nothing pickable under it.
 */
async function groundNear(page, wanted) {
  return page.evaluate(({ x, y }) => {
    const bare = (px, py) => {
      const el = document.elementFromPoint(px, py);
      return el !== null && !el.closest("[data-graview-pick], .graview-kind-card, button, a, [role='button']");
    };
    for (let r = 0; r <= 400; r += 20) {
      for (let a = 0; a < 360; a += r === 0 ? 360 : 30) {
        const px = Math.round(x + r * Math.cos((a * Math.PI) / 180));
        const py = Math.round(y + r * Math.sin((a * Math.PI) / 180));
        if (bare(px, py)) return { x: px, y: py };
      }
    }
    return { x, y };
  }, wanted);
}

async function dragAcross(page, { from: wanted, to, steps, label, onGround = true }) {
  const from = onGround ? await groundNear(page, wanted) : wanted;
  // The same distance, from wherever the ground was found.
  to = { x: to.x + (from.x - wanted.x), y: to.y + (from.y - wanted.y) };
  await watchFrames(page);
  const before = await whereIsIt(page);

  /*
   * ONE CALL, many moves. Awaiting each move separately puts a round trip
   * between every one of them, so the page is handed a gentle trickle of
   * input no hand ever produced and the harness measures its own latency.
   */
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
  const underHand = await whereIsIt(page);
  await page.mouse.up();
  await page.waitForTimeout(600);
  const afterwards = await whereIsIt(page);

  return {
    ...framesToVerdict(stamps, blocking, label),
    stuckLayers: await stuckLayers(page),
    jumpOnRelease:
      underHand && afterwards
        ? Math.round(Math.hypot(afterwards.x - underHand.x, afterwards.y - underHand.y))
        : null,
    moved: before && afterwards ? Math.round(Math.hypot(afterwards.x - before.x, afterwards.y - before.y)) : 0,
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
        // Slowed to stand in for a bigger graph; see SLOWDOWN.
        const cdp = await page.context().newCDPSession(page).catch(() => null);
        await cdp?.send("Emulation.setCPUThrottlingRate", { rate: SLOWDOWN });

        /*
         * EVERY GESTURE STARTS FROM A PICTURE NOBODY HAS MOVED.
         *
         * These used to run one after another on the same page, and a pan is
         * clamped to what the city actually reaches — so by the time the
         * wheel ran, the drag before it had spent the whole budget and the
         * wheel moved nothing at all. Every run reported a clean sixty
         * frames for a gesture that did not happen, which is a harness
         * agreeing with itself.
         */
        const arrive = async (aloft) => {
          await page.goto(`${vite.url}/?theme=light`, { waitUntil: "load" });
          await page.waitForFunction((flag) => flag in window, app.ready, { timeout: 120_000 });
          await page.waitForTimeout(1200);
          if (aloft) {
            await page.click('[data-testid="overview"]');
            await page.waitForTimeout(1400);
          }
        };

        // In the stack first: the picture a person spends most of their time in.
        await arrive(false);
        report.runs.push({
          app: app.name,
          where: "stack",
          ...(await dragAcross(page, { from: { x: 900, y: 600 }, to: { x: 500, y: 300 }, steps: 120, label: "drag the ground" })),
        });
        /*
         * NO WHEEL RUN IN THE STACK. The plain wheel pans at altitude only —
         * `onWheel` returns early below the city, because down here a lens, a
         * scroll region and a pane each keep their own wheel. A run here
         * measured a gesture that deliberately does not exist and reported
         * sixty clean frames for it, which is a harness agreeing with itself.
         */

        // Then at altitude, where there is a whole city under the hand.
        await arrive(true);
        report.runs.push({
          app: app.name,
          where: "altitude",
          ...(await dragAcross(page, { from: { x: 900, y: 600 }, to: { x: 500, y: 300 }, steps: 120, label: "drag the city" })),
        });
        /*
         * AND A DISTRICT MOVED BY HAND, which is the other drag at altitude:
         * pressing a district's card and dragging places it, and every move
         * re-measures the lines that meet it. It was left unmeasured for as
         * long as the pan's fixed start point happened to be open ground.
         */
        await arrive(true);
        const cardAt = () =>
          page.evaluate(() => {
            // A district, not a billboard: a picture is looked around, not moved.
            const card = document.querySelector("[data-graview-view]:not([data-graview-screen]) .graview-kind-card");
            const box = card?.getBoundingClientRect();
            if (!card || !box) return null;
            // On the card itself, not on a control drawn on it: a drive-in's thumbnail is a button.
            for (let fy = 0.5; fy > 0.05; fy -= 0.1) {
              for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
                const x = Math.round(box.x + box.width * fx);
                const y = Math.round(box.y + box.height * fy);
                const el = document.elementFromPoint(x, y);
                if (el && card.contains(el) && !el.closest("button, a, [role='button']")) return { x, y };
              }
            }
            return null;
          });
        const card = await cardAt();
        if (card) {
          const run = await dragAcross(page, { from: card, to: { x: card.x - 300, y: card.y - 150 }, steps: 120, label: "move a district", onGround: false });
          // And the district is where it was put, after the hand has let go: the gesture happened.
          const put = await cardAt();
          report.runs.push({
            app: app.name,
            where: "altitude/card",
            ...run,
            cardMoved: put ? Math.round(Math.hypot(put.x - card.x, put.y - card.y)) : 0,
          });
        }
        // And by wheel, which is the same gesture with a different hand on it.
        await arrive(true);
        report.runs.push({
          app: app.name,
          where: "altitude/wheel",
          ...(await wheelAcross(page, { at: { x: 800, y: 520 }, ticks: 40, label: "wheel the city" })),
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
    run.cardMoved !== undefined && run.cardMoved < 100 ? `the district moved only ${run.cardMoved}px` : "",
  ].filter(Boolean);
  if (faults.length) bad += 1;
  process.stdout.write(
    `${faults.length ? "??" : "ok"} ${`${run.app}/${run.where}`.padEnd(18)} ${String(run.fps).padStart(5)}fps  worst ${String(run.worstMs).padStart(6)}ms  ${String(run.slowFrames).padStart(3)}/${run.frames} slow  blocked ${String(run.blockedMs).padStart(6)}ms  jump ${String(run.jumpOnRelease).padStart(3)}px  moved ${String(run.moved).padStart(4)}px  ${faults.join("; ")}\n`,
  );
}
process.stdout.write(`\n${report.runs.length - bad} of ${report.runs.length} drags hold ${FLOOR}fps\n`);
process.exit(report.error || bad > 0 ? 1 : 0);
