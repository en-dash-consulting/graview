#!/usr/bin/env node
/**
 * THE APP'S HISTORY, PLAYED BACK (Roadmap f-playback), in a real browser on
 * the todo example. Six changes are made — tasks added to Today, one by an
 * agent, a link drawn, a task renamed and one finished — and then, from a
 * row of Activity, "Show the app as it was here" opens the timeline. The
 * claims: the timeline has a tick per change marked by who made it;
 * scrubbing from the start to now shows the app grow on the scene; every
 * stop shows the app exactly as `pastOf` says it stood, on the scene and
 * on the routed face's list; nothing is offered to change while the past is
 * shown; the player walks to now at its speed; and "Back to now" is now.
 *
 *   node scripts/verify-playback.mjs [--engine=chromium|webkit|firefox] [--quick] [--headed]
 *
 * Writes docs/playback.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arriveWithoutWebfonts, ENGINES, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const SCENE = (search = "") => `${at("todo")}/?today=2026-09-01&remember=1${search}`;
const PAGES = `${at("todo")}/pages/tasks?today=2026-09-01&remember=1`;
/** `--shots=<dir>`: the scene and the list stopped part way, for a person to look at. */
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const shot = async (page, name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
};
const ADDED = ["Measure the hallway", "Label the boxes", "Defrost the freezer"];
/** `@graview/core/past` as the todo example's dev server serves it (its alias is the source), so the page's own store classes fold it. */
const PAST = `/@fs${resolve(repoRoot, "packages/core/src/past.ts")}`;

/*
 * THE STORE ITSELF, for the claims that compare a screen with what
 * `pastOf` (`@graview/core/past`) says: the watch is handed every store as it opens (as the
 * journeys keep it), and the first that holds tasks is the app's.
 */
const KEEP_THE_STORE = () => {
  const keep = (store) => (window.__playbackStores ??= []).push(store);
  const watch = (window.__graviewWatch ??= {});
  const handed = watch.store;
  watch.store = (store) => {
    handed?.(store);
    keep(store);
  };
};

const ready = async (page) => {
  await page.waitForFunction(() => "__todoReady" in window && (window.__playbackStores ?? []).some((store) => store.schema.kinds.includes("task")), undefined, { timeout: 120_000 });
  await page.waitForTimeout(600);
};

/** The six changes, made through the store as the person at the keyboard (and one as an agent). */
const grow = (page) =>
  page.evaluate((added) => {
    const store = window.__playbackStores.find((one) => one.schema.kinds.includes("task"));
    const me = { kind: "human" };
    const agent = { kind: "agent", id: "claude", name: "Claude" };
    const ids = [];
    for (const [index, label] of added.entries()) {
      const result = store.apply({ name: "add-task", args: { listId: "today", label } }, { author: index === 1 ? agent : me });
      ids.push(result.ops[0].writes.find((id) => id !== "today"));
    }
    store.apply({ name: "wait-for", args: { taskId: ids[2], blockerId: ids[0] } }, { author: me });
    store.apply({ name: "rename", args: { id: "t-deposit", label: "Pay the deposit early" } }, { author: me });
    store.apply({ name: "finish", args: { taskId: ids[0] } }, { author: me });
    return { ids, length: store.log.length, batches: store.batches().length };
  }, ADDED);

/** What `pastOf(store, seq)` says stood then: the added tasks, the deposit's label, which are done, and the links. */
const asItWas = (page, seq) =>
  page.evaluate(
    async ([seq, added, module]) => {
      const { pastOf } = await import(module);
      const store = window.__playbackStores.find((one) => one.schema.kinds.includes("task"));
      const past = pastOf(store, seq);
      const tasks = past.graph.nodesOfKind("task");
      return {
        added: added.filter((label) => tasks.some((task) => task.label === label)),
        deposit: past.graph.getNode("t-deposit")?.label ?? null,
        done: tasks.filter((task) => added.includes(task.label) && task.done).map((task) => task.label),
        // What a list of what is still to do draws: the routed face leaves a finished task off it.
        open: added.filter((label) => tasks.some((task) => task.label === label && !task.done)),
        waits: past.graph.allEdges().filter((edge) => edge.kind === "waitsOn" || edge.kind === "blockedBy" || edge.kind === "waitingOn").length,
        edges: past.graph.allEdges().length,
      };
    },
    [seq, ADDED, PAST],
  );

/** What a face draws now: which added tasks, the deposit's label, and the timeline's state. */
const drawn = (page, scope) =>
  page.evaluate(
    ([added, scope]) => {
      const root = scope ? document.querySelector(scope) ?? document.body : document.body;
      // The timeline, Activity and what is announced (the bar's and the notices' status lines, which still say the last change made now) say what changed; the app is what is drawn outside them.
      const text = [...root.querySelectorAll("main, [data-graview-pick], [data-testid='record-row'], li, a, h1, h2, h3, p, span")]
        .filter((el) => !el.closest('[data-testid="timeline"], [data-testid="activity"], [data-graview-offstage], [role="status"]'))
        .map((el) => el.textContent ?? "")
        .join(" \n ");
      const timeline = document.querySelector('[data-testid="timeline"]');
      return {
        added: added.filter((label) => text.includes(label)),
        early: text.includes("Pay the deposit early"),
        deposit: text.includes("Pay the deposit"),
        timeline: timeline !== null,
        past: timeline?.getAttribute("data-graview-past") ?? null,
        asOf: timeline?.querySelector('[data-testid="as-of"]')?.textContent?.trim() ?? null,
        caption: timeline?.querySelector('[data-testid="timeline-caption"]')?.textContent?.trim() ?? null,
        ticks: [...(timeline?.querySelectorAll("[data-graview-tick]") ?? [])].map((tick) => ({ seq: Number(tick.getAttribute("data-graview-tick")), maker: tick.getAttribute("data-maker"), declaration: tick.hasAttribute("data-declaration") })),
        index: Number(timeline?.querySelector('[data-testid="scrubber"]')?.value ?? -1),
        max: Number(timeline?.querySelector('[data-testid="scrubber"]')?.max ?? -1),
        playing: timeline?.querySelector('[data-testid="play"]')?.getAttribute("aria-pressed") === "true",
        undo: document.querySelectorAll('[data-testid="undo-turn"]').length,
        restore: document.querySelector('[data-testid="restore-here"]') !== null,
        // An act offered on the page: the strip's, the menu's, the list's "Add a task".
        acts: [...document.querySelectorAll("button, a")].filter((el) => !el.closest('[data-testid="timeline"]') && /^(Add a task|Mark it done|Rename|Wait for|Drop|Take back)\b/.test((el.textContent ?? "").trim())).length,
        // A control of the app's own design that would change something: the routed face's tick beside each task.
        pressable: document.querySelectorAll("button.th-tick:not([disabled])").length,
        seat: document.querySelector('[data-graview-quick-ask], [data-testid="quick-ask"], [data-testid="seat-field"]') !== null,
      };
    },
    [ADDED, scope ?? null],
  );

/** Move the scrubber to stop `index`, as a person dragging it would. */
const scrub = async (page, index) => {
  await page.evaluate((index) => {
    const scrubber = document.querySelector('[data-testid="scrubber"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(scrubber, String(index));
    scrubber.dispatchEvent(new Event("input", { bubbles: true }));
    scrubber.dispatchEvent(new Event("change", { bubbles: true }));
  }, index);
  await page.waitForTimeout(350);
};

/** Open Activity and press "Show the app as it was here" on its oldest row. */
const showOldest = async (page) => {
  await page.click('[data-testid="activity-button"]');
  await page.waitForSelector('[data-testid="show-past"]', { timeout: 20_000 });
  const rows = await page.locator('[data-testid="show-past"]').count();
  await page.locator('[data-testid="show-past"]').nth(rows - 1).click();
  await page.waitForSelector('[data-testid="timeline"]', { timeout: 20_000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return rows;
};

const report = { at: new Date().toISOString(), quick: QUICK, engines, runs: [] };
let vite;
try {
  vite = await serving("todo", portFor("todo"), repoRoot);
  for (const engine of engines) {
    const run = { engine, errors: [] };
    report.runs.push(run);
    const browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(KEEP_THE_STORE);
      const page = await context.newPage();
      page.on("pageerror", (error) => run.errors.push(String(error).slice(0, 200)));
      // A fresh start, remembered from here so the pages face opens on the same history.
      await arriveWithoutWebfonts(page, SCENE("&fresh=1"));
      await ready(page);
      run.before = await drawn(page);
      run.grown = await grow(page);
      await page.waitForTimeout(500);
      run.now = await drawn(page);

      // From Activity, the app as it was after its first change.
      run.rows = await showOldest(page);
      run.opened = await drawn(page);
      run.stops = [];
      const stops = run.opened.max + 1;
      for (let index = 0; index < stops; index++) {
        await scrub(page, index);
        const shown = await drawn(page);
        const seq = shown.past === "now" ? run.grown.length : Number(shown.past);
        run.stops.push({ index, seq, shown, was: await asItWas(page, seq) });
      }
      // Stopped part way: exactly as it was there, with nothing to change.
      await scrub(page, 2);
      run.stopped = await drawn(page);
      await shot(page, `${engine}-scene-stopped`);
      run.stoppedWas = await asItWas(page, Number(run.stopped.past));
      // The player, from the start at 8×, walks to now and stops.
      await scrub(page, 0);
      await page.selectOption('[data-testid="speed"]', "8");
      await page.click('[data-testid="play"]');
      await page.waitForTimeout(400);
      run.playing = await drawn(page);
      await page.waitForFunction(() => document.querySelector('[data-testid="play"]')?.getAttribute("aria-pressed") === "false", undefined, { timeout: 20_000 }).catch(() => {});
      run.played = await drawn(page);
      await page.click('[data-testid="back-to-now"]');
      await page.waitForTimeout(400);
      run.backToNow = await drawn(page);

      // The routed face, on the same history: the list of tasks as it was.
      await arriveWithoutWebfonts(page, PAGES);
      await ready(page);
      run.pagesNow = await drawn(page);
      await showOldest(page);
      await scrub(page, 0);
      run.pagesStart = await drawn(page);
      run.pagesStartWas = await asItWas(page, Number(run.pagesStart.past));
      await scrub(page, 3);
      run.pagesStopped = await drawn(page);
      await shot(page, `${engine}-pages-stopped`);
      run.pagesStoppedWas = await asItWas(page, Number(run.pagesStopped.past));
      await page.click('[data-testid="back-to-now"]');
      await page.waitForTimeout(400);
      run.pagesBack = await drawn(page);
      // "Restore to here": every change since taken back as one, which is undone as one.
      await showOldest(page);
      await scrub(page, 2);
      const restoredTo = Number((await drawn(page)).past);
      run.restoreOffered = (await drawn(page)).restore;
      await page.click('[data-testid="restore-here"]');
      await page.waitForTimeout(500);
      run.restored = await drawn(page);
      run.restoredStore = await page.evaluate(async ([seq, module]) => {
        const { pastOf } = await import(module);
        const store = window.__playbackStores.find((one) => one.schema.kinds.includes("task"));
        const key = (snapshot) => JSON.stringify([[...snapshot.nodes].map((node) => JSON.stringify(node)).sort(), [...snapshot.edges].map((edge) => `${edge.kind}:${edge.from}->${edge.to}`).sort()]);
        const last = store.batches().at(-1);
        return { same: key(store.graph.snapshot()) === key(pastOf(store, seq).graph.snapshot()), oneUndo: last.ops.every((op) => op.undoes !== undefined), intent: last.intent };
      }, [restoredTo, PAST]);
      await context.close();
    } catch (error) {
      run.error = String(error).slice(0, 1200);
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  report.error = String(error).slice(0, 1200);
} finally {
  vite?.stop();
}

const every = (holds) => report.runs.length > 0 && report.runs.every((run) => !run.error && holds(run));
/** A face shows a moment exactly as it was: the added tasks `pastOf` holds and no other, and the deposit as it was called. */
const exactly = (shown, was, which = "added") => shown && was && JSON.stringify([...shown.added].sort()) === JSON.stringify([...was[which]].sort()) && shown.early === (was.deposit === "Pay the deposit early") && shown.deposit === (was.deposit !== null);
report.checks = {
  // Activity lists the latest changes, newest first: its oldest row opens the app as it stood just after that change.
  theTimelineOpensFromARowOfActivity: every((run) => run.rows > 0 && run.opened.timeline && /^As of /.test(run.opened.asOf ?? "") && run.opened.past === String(run.grown.batches - run.rows + 1)),
  aTickPerChangeMarkedByWhoMadeIt: every((run) => run.opened.ticks.length === 6 && run.opened.ticks.filter((tick) => tick.maker === "agent").length === 1 && run.opened.ticks.filter((tick) => tick.maker === "you").length === 5),
  scrubbingFromTheStartShowsTheAppGrow: every((run) => {
    const counts = run.stops.map((stop) => stop.shown.added.length);
    return counts[0] === 0 && counts.at(-1) === ADDED.length && counts.every((count, at) => at === 0 || count >= counts[at - 1]);
  }),
  everyStopShowsTheAppExactlyAsItWas: every((run) => run.stops.every((stop) => exactly(stop.shown, stop.was))),
  stoppingPartWayShowsItExactlyAsItWas: every((run) => run.stopped.past !== "now" && exactly(run.stopped, run.stoppedWas) && run.stopped.caption?.length > 0),
  nothingIsOfferedToChangeInThePast: every((run) => run.stops.filter((stop) => stop.shown.past !== "now").every((stop) => stop.shown.undo === 0 && stop.shown.acts === 0 && !stop.shown.seat) && run.pagesStopped.acts === 0 && run.pagesStopped.pressable === 0 && run.pagesNow.pressable > 0),
  thePlayerWalksToNowAtItsSpeed: every((run) => run.playing.playing && !run.played.playing && run.played.index === run.played.max && run.played.past === "now"),
  backToNowIsNow: every((run) => !run.backToNow.timeline && run.backToNow.added.length === ADDED.length && run.backToNow.early),
  theRoutedFaceRedrawsThePlaceAsItWas: every((run) => run.pagesNow.added.length === ADDED.length - 1 && /^As of /.test(run.pagesStart.asOf ?? "") && exactly(run.pagesStart, run.pagesStartWas, "open") && exactly(run.pagesStopped, run.pagesStoppedWas, "open") && run.pagesBack.added.length === ADDED.length - 1 && !run.pagesBack.timeline),
  restoreToHereIsOneChangeBackToThatMoment: every((run) => run.restoreOffered && !run.restored.timeline && run.restoredStore?.same && run.restoredStore?.oneUndo && /^Restore to /.test(run.restoredStore?.intent ?? "")),
  noPageErrors: every((run) => run.errors.length === 0),
};
report.ok = Object.values(report.checks).every(Boolean) && !report.error;
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/playback.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, ok] of Object.entries(report.checks)) process.stdout.write(`${ok ? "✓" : "✗"} ${name}\n`);
if (report.error) process.stdout.write(`\n${report.error}\n`);
for (const run of report.runs) if (run.error) process.stdout.write(`\n${run.engine}: ${run.error}\n`);
process.stdout.write("wrote docs/playback.json\n");
process.exit(report.ok ? 0 : 1);
