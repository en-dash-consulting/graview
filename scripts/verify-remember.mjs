#!/usr/bin/env node
/**
 * The app remembers, and a person can always get back to the example.
 *
 * Every sample app used to forget everything on reload — reasonable for a
 * harness, dishonest for a demo that invites you to edit. Now the browser
 * adapter sits behind ship's `openStore`, and these are the claims worth
 * checking in a real browser: an edit survives a reload, still attributed
 * and still undoable; the seed is the FIRST load, not every load; "Start
 * fresh" and `?fresh=1` return to the example; and a driven browser starts
 * from the seed unless it asks to remember, so every other harness keeps
 * specifying the example rather than its own residue.
 *
 *   node scripts/verify-remember.mjs [--headed]
 *
 * Writes docs/remember.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const BASE = `${at("todo")}/?today=2026-09-01`;

/**
 * The app this harness drives — borrowed if a dev server is already holding
 * the port, started and owned otherwise. See `lib/serve.mjs`: spawning a
 * second vite blindly meant every harness died with "vite did not start"
 * whenever anyone had the app open.
 */
function startVite(name, port) {
  return serving(name, port, repoRoot);
}

const report = { at: new Date().toISOString(), engine: ENGINE, steps: {} };
let browser;
let vite;

const ready = async (page) => {
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(700);
};
const labelOf = (page, id) =>
  page.evaluate(
    (pick) => document.querySelector(`[data-graview-pick="${pick}"]`)?.textContent?.trim() ?? null,
    id,
  );
/**
 * Where the keyboard was left after the last rename committed — read
 * BEFORE the Escape that closes the pane, which has a home of its own.
 */
let keyboardAfterRename = null;
/** Rename the deposit task in place, through the mutation, to `to`. */
const rename = async (page, to) => {
  await page.dblclick('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(800);
  await page.click('[data-graview-editable][data-graview-field="label"]');
  await page.waitForTimeout(200);
  await page.fill('input[data-graview-field="label"]', to);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  /*
   * THE KEYBOARD COMES BACK TO THE VALUE. Committing the editor unmounts
   * the field, and a removed element takes focus to <body> — so a rename
   * ended at the top of the document, once per edit, and this harness had
   * asked only what the graph said afterwards.
   */
  keyboardAfterRename = await page.evaluate(() => {
    const at = document.activeElement;
    return { tag: at?.tagName ?? null, editable: at?.getAttribute("data-graview-field") ?? null };
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
};
const activity = async (page) => {
  await page.click('[data-testid="activity-button"]');
  await page.waitForTimeout(300);
  return page.evaluate(() => ({
    log: [...document.querySelectorAll('[data-testid="diff-log"] li')].map((li) =>
      li.textContent.trim(),
    ),
    undo: document.querySelector('[data-testid="undo-turn"]') !== null,
    remembered: document.querySelector('[data-testid="remembered"]')?.textContent?.trim() ?? null,
    startFresh: document.querySelector('[data-testid="start-fresh"]') !== null,
  }));
};

try {
  vite = await startVite("todo", portFor("todo"));
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });

  /* -------------------------------- one browser that asks to remember */
  const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  const page = await context.newPage();
  await page.goto(`${BASE}&remember=1`, { waitUntil: "load" });
  await ready(page);
  report.steps.seed = { deposit: await labelOf(page, "t-deposit") };

  await rename(page, "Pay the deposit, remembered");
  report.steps.edited = { deposit: await labelOf(page, "t-deposit"), keyboard: keyboardAfterRename };

  // The reload: same address, same browser.
  await page.goto(`${BASE}&remember=1`, { waitUntil: "load" });
  await ready(page);
  report.steps.reloaded = { deposit: await labelOf(page, "t-deposit"), ...(await activity(page)) };

  // And the way back, from the history itself.
  if (report.steps.reloaded.undo) {
    await page.click('[data-testid="undo-turn"]');
    await page.waitForTimeout(500);
    report.steps.undone = { deposit: await labelOf(page, "t-deposit") };
    await page.keyboard.press("Escape");
  }


  // Edit again, so there is something to forget; then start fresh through
  // the control, and check the flag did not stick to the address.
  await rename(page, "Pay the deposit, again");
  await page.click('[data-testid="activity-button"]');
  await page.waitForTimeout(300);
  await page.click('[data-testid="start-fresh"]');
  await page.waitForTimeout(500);
  await ready(page);
  report.steps.fresh = {
    deposit: await labelOf(page, "t-deposit"),
    address: await page.evaluate(() => window.location.search),
    ...(await activity(page)),
  };
  await page.keyboard.press("Escape");

  // After starting fresh the browser still remembers what comes next.
  await rename(page, "Pay the deposit, after fresh");
  await page.goto(`${BASE}&remember=1`, { waitUntil: "load" });
  await ready(page);
  report.steps.afterFresh = { deposit: await labelOf(page, "t-deposit") };

  // The pages face shares the store — and the way back.
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?today=2026-09-01&remember=1`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);
  report.steps.pages = await page.evaluate(() => ({
    // The record's own title, under the bar's name (the bar holds the app's h1).
    title: document.querySelector("main h1, main h2")?.textContent?.trim() ?? null,
    startFresh: document.querySelector('[data-testid="start-fresh"]') !== null,
  }));

  // A driven browser that does NOT ask: the seed, whatever this browser did.
  await page.goto(BASE, { waitUntil: "load" });
  await ready(page);
  report.steps.driven = { deposit: await labelOf(page, "t-deposit"), ...(await activity(page)) };
  await context.close();

  /* ----------------------- a second visit, and what it does on arriving */
  /*
   * A CHANGE MADE AFTER A RELOAD IS A TURN OF ITS OWN.
   *
   * A hydrated store started both id counters at zero, so the first change
   * of the second visit was minted `op1` in `batch:1` — ids the log already
   * held. `batches()` groups by batch id, so the new work was filed under
   * the FIRST turn ever taken: the rail went on naming that turn and never
   * grew, and undoing it would have taken the new change with it. Every
   * check above passes anyway, because every one of them asks about a
   * change made BEFORE the reload — so this is a visit of its own.
   */
  const second = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  const visitor = await second.newPage();
  await visitor.goto(`${BASE}&remember=1`, { waitUntil: "load" });
  await ready(visitor);
  await rename(visitor, "Pay the deposit, on the first visit");
  const firstVisit = await activity(visitor);
  await visitor.keyboard.press("Escape");
  // Away, and back: the same browser, the same address.
  await visitor.goto(`${BASE}&remember=1`, { waitUntil: "load" });
  await ready(visitor);
  await rename(visitor, "Pay the deposit, on the second");
  report.steps.secondVisit = { before: firstVisit.log, ...(await activity(visitor)) };
  await second.close();

  /* --------------------------------------- and a browser that never saw any of it */
  const other = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  const stranger = await other.newPage();
  await stranger.goto(`${BASE}&remember=1`, { waitUntil: "load" });
  await ready(stranger);
  report.steps.stranger = { deposit: await labelOf(stranger, "t-deposit") };
  await other.close();

  /* ------------------------------ the garden opens planted, and empties */
  /*
   * THE SEEDBED OPENS ON THE EXAMPLE GARDEN. It used to open empty on
   * purpose, so the first thing anybody saw was a city of "none yet" and a
   * seat with nothing to answer about. Now a first visit is planted, and an
   * empty garden is one press in the person menu — "Start empty" — which
   * this browser remembers until "Load the example garden" plants it again.
   */
  const garden = await serving("seedbed", portFor("seedbed"), repoRoot);
  try {
    const gardenContext = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    const bed = await gardenContext.newPage();
    const gardenErrors = [];
    bed.on("pageerror", (error) => gardenErrors.push(String(error).slice(0, 120)));
    const opened = async () => {
      await bed.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 120_000 });
      await bed.waitForTimeout(900);
      return bed.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("graview:seedbed:snapshot") ?? "null");
        const gardeners = document.querySelector('[data-graview-view="kind:gardener"]')?.textContent?.trim() ?? null;
        return { nodes: stored?.nodes?.length ?? 0, gardeners, address: window.location.search };
      });
    };
    const pressInMenu = async (label) => {
      await bed.click('[data-testid="profile-button"]');
      await bed.waitForSelector('[data-testid="host-action"]', { timeout: 20_000 });
      const offered = await bed.evaluate(() => [...document.querySelectorAll('[data-testid="host-action"]')].map((one) => one.textContent.trim()));
      await Promise.all([bed.waitForNavigation({ waitUntil: "load" }), bed.locator('[data-testid="host-action"]', { hasText: label }).first().click()]);
      return offered;
    };
    await bed.goto(`${at("seedbed")}/?theme=light&remember=1`, { waitUntil: "load" });
    const planted = await opened();
    const offered = await pressInMenu("Start empty");
    const emptied = await opened();
    await bed.reload({ waitUntil: "load" });
    const reloaded = await opened();
    await pressInMenu("Load the example garden");
    const restored = await opened();
    // The flag itself, from a fresh browser: `?empty=1` opens the garden with nothing in it.
    const flagged = await gardenContext.newPage();
    await flagged.goto(`${at("seedbed")}/?theme=light&empty=1`, { waitUntil: "load" });
    await flagged.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 120_000 });
    await flagged.waitForTimeout(900);
    const byFlag = await flagged.evaluate(() => ({
      nodes: JSON.parse(localStorage.getItem("graview:seedbed:snapshot") ?? "null")?.nodes?.length ?? 0,
      address: window.location.search,
    }));
    await flagged.close();
    report.steps.garden = { planted, offered, emptied, reloaded, restored, byFlag, errors: gardenErrors };
    await gardenContext.close();
  } finally {
    garden.stop();
  }

  /* -------------------------------------- and the same is true on the desk */
  /*
   * THE LAUNCHER MOUNTS EACH DEMO THE WAY THE DEMO OPENS ITSELF.
   *
   * Mounted with no store, an app built an in-memory one from its example and
   * forgot on reload — so the desk, which is the first thing anybody opens,
   * hid the one persistence capability every demo already had. There was no
   * way to tell from inside it whether Things persisted anything at all.
   *
   * Driven here end to end: an edit made on the desk survives a reload of the
   * desk, and is there at the app's OWN port in the same browser, because
   * both go through `open()` with the same scope. And the two demos keep two
   * stores, because each names its own.
   */
  const desk = await serving("launcher", portFor("launcher"), repoRoot);
  try {
    const context = await browser.newContext();
    const page = await context.newPage({ viewport: { width: 1400, height: 900 } });
    const deskErrors = [];
    page.on("pageerror", (error) => deskErrors.push(String(error).slice(0, 90)));
    const onTheDesk = async (app) => {
      // `remember=1` because a driven browser starts fresh unless it asks to,
      // which is what keeps every other harness from inheriting the last one's.
      await page.goto(`${at("launcher")}/?theme=light&remember=1&app=${app}`, { waitUntil: "load" });
      /*
       * For the MOUNT, not for a card: a garden can be empty on purpose,
       * and waiting for something pickable there waits for ever. A district
       * exists whether or not anything is in it — which is the seedbed's
       * whole first screen.
       */
      await page.waitForFunction(
        () => document.querySelector("[data-graview-view]") !== null,
        null,
        { timeout: 40_000 },
      );
      await page.waitForTimeout(1000);
    };
    /* A thing's acts: the menu a right-click opens on it (the scene draws no strip beside a selection). */
    const offeredOn = async (target, id, label) => {
      if (await target.$('[data-testid="context-menu"]')) {
        await target.keyboard.press("Escape");
        await target.waitForTimeout(200);
      }
      await target.click(`[data-graview-pick="${id}"]`, { button: "right" });
      await target.waitForSelector('[data-testid="context-menu"] [data-affordance]', { timeout: 20_000 });
      return target.evaluate(
        (wanted) =>
          [...document.querySelectorAll('[data-testid="context-menu"] [data-affordance]')].some((button) =>
            (button.textContent ?? "").includes(wanted),
          ),
        label,
      );
    };

    await onTheDesk("todo");
    const FINISH = 'Finish "Pay the deposit"';
    const beforeEdit = await offeredOn(page, "t-deposit", FINISH);
    await page.locator('[data-testid="context-menu"] [data-affordance]', { hasText: FINISH }).first().click();
    await page.waitForTimeout(1000);
    const afterEdit = await offeredOn(page, "t-deposit", FINISH);

    await onTheDesk("todo");
    const afterReload = await offeredOn(page, "t-deposit", FINISH);

    // The same browser, at the app's own port: one store, two doors.
    const own = await serving("todo", portFor("todo"), repoRoot);
    const alone = await context.newPage({ viewport: { width: 1400, height: 900 } });
    await alone.goto(`${at("todo")}/?today=2026-09-01&remember=1`, { waitUntil: "load" });
    await alone.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    await alone.waitForTimeout(1000);
    const atItsOwnPort = await offeredOn(alone, "t-deposit", FINISH);
    await alone.close();
    own.stop();

    // And the garden, which has nothing of Things' in it.
    await onTheDesk("seedbed");
    const separate = await page.evaluate(() => document.querySelector('[data-graview-pick="t-deposit"]') === null);

    report.steps.onTheDesk = { beforeEdit, afterEdit, afterReload, atItsOwnPort, separate };
    report.steps.deskErrors = deskErrors;
    await page.close();
    await context.close();
  } finally {
    desk.stop();
  }
} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  if (vite) {
    vite.stop();
  }
}

const s = report.steps;
/*
 * A pick target's text is the label PLUS whatever the view draws beside it
 * (the due date, on the list) — so a claim about the label is a claim about
 * how the text begins, and "the seed" is the label with nothing appended.
 */
const says = (step, label) => (step?.deposit ?? "").startsWith(label);
const isSeed = (step) => says(step, "Pay the deposit") && !(step?.deposit ?? "").includes(",");
report.verdict = {
  theSeedLoadsFirst: isSeed(s.seed),
  theEditTookEffect: says(s.edited, "Pay the deposit, remembered"),
  theKeyboardStaysOnWhatItRenamed: s.edited?.keyboard?.tag === "BUTTON" && s.edited?.keyboard?.editable === "label",
  theEditSurvivesAReload: says(s.reloaded, "Pay the deposit, remembered"),
  // In the history, attributed to you, and takeable back.
  theHistorySurvivesAttributed: (s.reloaded?.log ?? []).some(
    (line) => line.startsWith("you") && line.includes("remembered"),
  ),
  theEditIsStillUndoable: s.reloaded?.undo === true && isSeed(s.undone),
  aChangeOnTheSecondVisitIsATurnOfItsOwn:
    (s.secondVisit?.log ?? []).length === (s.secondVisit?.before ?? []).length + 1 &&
    (s.secondVisit?.log ?? [])[0]?.includes("on the second") === true &&
    (s.secondVisit?.log ?? [])[1]?.includes("on the first visit") === true,
  theBrowserSaysItRemembers:
    (s.reloaded?.remembered ?? "").includes("Remembered") && s.reloaded?.startFresh === true,
  startFreshReturnsToTheExample: isSeed(s.fresh) && (s.fresh?.log ?? []).length === 0,
  theFreshFlagDoesNotStick: !(s.fresh?.address ?? "").includes("fresh="),
  // The seed is the first load, not every load: what came after fresh stays.
  rememberingResumesAfterFresh: says(s.afterFresh, "Pay the deposit, after fresh"),
  thePagesFaceSharesTheStore:
    s.pages?.title === "Pay the deposit, after fresh" && s.pages?.startFresh === true,
  aDrivenBrowserStartsFromTheSeed: isSeed(s.driven) && (s.driven?.log ?? []).length === 0,
  aFreshContextStartsFromTheSeed: isSeed(s.stranger),
  /*
   * An edit made on the DESK is the app's own edit: still there after the
   * desk reloads, and there at the app's own port in the same browser.
   */
  theLauncherMountsTheDemoTheWayItOpensItself:
    s.onTheDesk?.beforeEdit === true &&
    s.onTheDesk?.afterEdit === false &&
    s.onTheDesk?.afterReload === false &&
    s.onTheDesk?.atItsOwnPort === false,
  // Two demos on one desk keep two stores, because each names its own scope.
  eachDemoKeepsItsOwnStore: s.onTheDesk?.separate === true,
  /* The seedbed opens on the example garden; "Start empty" empties it, and it stays empty until the example is loaded again. */
  theGardenOpensPlanted: (s.garden?.planted?.nodes ?? 0) > 0,
  thePersonMenuOffersStartEmptyAndTheExample:
    (s.garden?.offered ?? []).includes("Start empty") && (s.garden?.offered ?? []).includes("Load the example garden"),
  startEmptyEmptiesTheGarden: s.garden?.emptied?.nodes === 0 && !(s.garden?.emptied?.address ?? "").includes("empty="),
  anEmptyGardenStaysEmptyAfterAReload: s.garden?.reloaded?.nodes === 0,
  loadTheExampleGardenPlantsItAgain: s.garden?.restored?.nodes === s.garden?.planted?.nodes && (s.garden?.restored?.nodes ?? 0) > 0,
  theEmptyFlagOpensItEmpty: s.garden?.byFlag?.nodes === 0 && !(s.garden?.byFlag?.address ?? "").includes("empty="),
  nothingThrewInTheGarden: (s.garden?.errors ?? []).length === 0,
  nothingThrewOnTheDesk: (s.deskErrors ?? []).length === 0,
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/remember.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n\nwrote docs/remember.json\n`);
if (report.error) process.stdout.write(`\n${report.error}\n`);
process.exit(report.passed ? 0 : 1);
