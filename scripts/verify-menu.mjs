#!/usr/bin/env node
/**
 * The menu scales — search, pins, and what you actually use, driven in a
 * real browser against the todo app.
 *
 * A pin made from the menu must reorder the same list every surface reads,
 * survive a reload (it lives in this browser's storage), outrank the app's
 * own declared pin, and come back off with the same gesture.
 *
 * The acts are the context menu now — a right-click, or the acts key on a
 * card. The strip a selection used to draw beside the picture is gone from
 * the scene, and with it the filter field and "Show N more" (the seat is a
 * guide, not a control panel): the claims about the filter went with them.
 *
 *   node scripts/verify-menu.mjs [--engine=chromium|webkit|firefox]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
const app = await serving("todo", portFor("todo"), repoRoot);
let browser;

const MENU = '[data-testid="context-menu"]';

/** The menu's offered mutations, in document order, via each row's pin. */
const offeredOrder = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="context-menu"] [data-pin-for]')].map(
      (star) => star.getAttribute("data-pin-for"),
    ),
  );

/** Opens a thing's acts at the pointer, as a right-click does. */
async function openActs(page, id) {
  await page.click(`[data-graview-pick="${id}"]`, { button: "right" });
  await page.waitForSelector(`${MENU} [data-pin-for]`, { timeout: 10_000 });
}

/** Puts the menu away. */
async function closeActs(page) {
  if (await page.$(MENU)) await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });

  /*
   * THE FILTER FIELD, "Show N more" AND ENTER ON A SOLE SURVIVOR were the
   * strip's: a selection drew every act beside the picture, past a fold. The
   * scene draws no strip now — the seat offers at most three acts and the
   * menu holds the rest — so those three claims (filterOnlyPastTheFold,
   * searchThenApply, destructiveNeedsTheClick) have no surface to hold on.
   */
  /* --------------------------------------------------- pin, then reorder */
  await openActs(page, "t-deposit");
  const before = await offeredOrder(page);
  await page.click(`${MENU} [data-pin-for="edit-task"]`);
  await page.waitForTimeout(150);
  const after = await offeredOrder(page);
  await closeActs(page);
  /*
   * On this overdue task "finish" and "reschedule" are REPAIRS, so they sit
   * in the top band where no pin may reach — which is itself part of the
   * claim. The pin's movement is measured against an unpinned peer that sits
   * above it beforehand ("rename"), and the repairs must still lead
   * afterwards.
   *
   * The peer used to be "reopen", which is offered on nothing: it sets
   * `done: false` on a task that was never finished, so it changes nothing,
   * and an act with nothing left to do is no longer offered. A peer that is
   * not there makes `indexOf` return -1, and a comparison against -1 passes
   * or fails for reasons that have nothing to do with pinning — so the peer
   * is asserted to be present before it is compared against.
   *
   * Which repair leads is the RULE'S order, not the app's pin. `finish` is
   * pinned by the declaration and used to head the band for that reason;
   * `nothing-overdue` names a new date before finishing, and a rule that
   * says how to fix itself is saying which way out it prefers. A pin still
   * moves everything below the repairs — that is what the rest of this
   * check measures. (The strip said "pinned" and "⚠" over its bands; the
   * menu draws no headings, so the order is the claim.)
   */
  report.checks.pinThenReorder = {
    before,
    after,
    peerIsOffered: before.includes("rename") && before.includes("edit-task"),
    ok:
      before.includes("rename") &&
      before.includes("edit-task") &&
      before.indexOf("edit-task") > before.indexOf("rename") &&
      after.indexOf("edit-task") < after.indexOf("rename") &&
      after.indexOf("reschedule") === 0 &&
      after.indexOf("finish") === 1,
  };

  /* -------------------------------------------- the pin is this browser's */
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  await openActs(page, "t-deposit");
  const survived = await offeredOrder(page);
  const pressed = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="context-menu"] [data-pin-for="edit-task"]')
        ?.getAttribute("aria-pressed") === "true",
  );
  // Unpinning is the same gesture.
  await page.click(`${MENU} [data-pin-for="edit-task"]`);
  await page.waitForTimeout(150);
  const unpinned = await offeredOrder(page);
  await closeActs(page);
  const above = (list) =>
    list.includes("rename") && list.indexOf("edit-task") < list.indexOf("rename");
  report.checks.pinSurvivesReloadAndUnpins = {
    survived: above(survived),
    pressed,
    unpinnedAgain: !above(unpinned) && unpinned.includes("rename"),
    ok: above(survived) && pressed && !above(unpinned) && unpinned.includes("rename"),
  };

  /* ------------------------------------- the dev's pin is overridable too */
  // finish is pinned by the app's own declaration. The same star demotes
  // it for this person — and brings it back. Without this, the star on a
  // declared pin was a control that visibly did nothing.
  await openActs(page, "t-book");
  await page.waitForSelector(`${MENU} [data-pin-for="finish"]`);
  const pinnedNow = () =>
    page.evaluate(() => document.querySelector('[data-testid="context-menu"] [data-pin-for="finish"]')?.getAttribute("aria-pressed") === "true");
  const declaredShown = await pinnedNow();
  await page.click(`${MENU} [data-pin-for="finish"]`);
  await page.waitForTimeout(150);
  const demotedNow = !(await pinnedNow());
  await page.click(`${MENU} [data-pin-for="finish"]`);
  await page.waitForTimeout(150);
  const restoredNow = await pinnedNow();
  await closeActs(page);
  report.checks.devPinOverride = {
    declaredShown,
    demotedNow,
    restoredNow,
    ok: declaredShown && demotedNow && restoredNow,
  };

  /* --------------------------- the list leads with the thing you clicked */
  /*
   * ONE RULE, FIVE LATE TASKS, TEN REPAIRS — and until the derivation knew
   * which node the gesture landed on, it offered them in the order the rule
   * happened to name its subjects. Right-clicking the fourth late task met
   * the FIRST task's "give it a new date" at the top of the menu, so the
   * obvious press fixed somebody else's problem.
   *
   * Driven on three surfaces, because the claim is that they share one
   * rank: the scene's pointer menu, the routed record, and the problems
   * inbox, where pressing a repair must change the task it names.
   */
  const firstOffered = (page, testid) =>
    page.evaluate((id) => {
      const first = document
        .querySelector(`[data-testid="${id}"]`)
        ?.querySelector("[data-affordance]");
      return { label: (first?.textContent ?? "").trim(), rank: first?.getAttribute("data-rank") };
    }, testid);

  // 2026-09-04 leaves five tasks past their date; 2026-09-01 leaves one,
  // and one subject cannot show an order problem between subjects.
  const LATE = "today=2026-09-04";
  await page.goto(`${at("todo")}/?${LATE}&fresh=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  const led = {};
  for (const [id, label] of [
    ["t-post", "Redirect the post"],
    ["t-meter", "Read the meters"],
  ]) {
    await page.click(`[data-graview-pick="${id}"]`, { button: "right" });
    await page.waitForSelector('[data-testid="context-menu"] [data-affordance]', { timeout: 10_000 });
    const first = await firstOffered(page, "context-menu");
    led[id] = { label, ...first, names: first.label.includes(label) };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }

  /* --------------------------------- the same rank on the routed record */
  /*
   * The record renders a rule's repairs beside the rule rather than in
   * "what can be done", so the claim there is about the REPAIR list: the
   * page about the post leads with the post's own repair, not with the
   * first subject the rule happened to walk. And the acts it does list
   * carry the derivation's rank, ascending — one order, two renderings.
   */
  await page.goto(`${at("todo")}/pages/tasks/t-post?${LATE}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="record-violations"] [data-graview-repair]', {
    timeout: 20_000,
  });
  const record = {
    firstRepair: await page.evaluate(
      () =>
        (
          document
            .querySelector('[data-testid="record-violations"]')
            ?.querySelector("[data-graview-repair]")?.textContent ?? ""
        ).trim(),
    ),
    ranks: await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="record-actions"] [data-affordance]')].map(
        (button) => Number(button.getAttribute("data-rank")),
      ),
    ),
  };
  const recordLeads =
    record.firstRepair.includes("Redirect the post") &&
    record.ranks.length > 0 &&
    record.ranks.every((rank, at) => at === 0 || rank > record.ranks[at - 1]);

  /* ------------------------- the inbox's repair changes what it names */
  await page.goto(`${at("todo")}/pages/problems?${LATE}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="repairs"] [data-graview-repair]', { timeout: 20_000 });
  const finishPost = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="repairs"] [data-graview-repair="finish"]')].findIndex(
      (button) => (button.textContent ?? "").includes("Redirect the post"),
    ),
  );
  await page.evaluate(() => {
    const button = [
      ...document.querySelectorAll('[data-testid="repairs"] [data-graview-repair="finish"]'),
    ].find((candidate) => (candidate.textContent ?? "").includes("Redirect the post"));
    button?.click();
  });
  await page.waitForTimeout(500);
  // The one it named is done; the one listed above it is untouched.
  const inbox = await page.evaluate(() => {
    const said = [...document.querySelectorAll('[data-testid="repairs"] [data-graview-repair]')].map(
      (button) => (button.textContent ?? "").trim(),
    );
    return {
      postGone: !said.some((label) => label.includes("Redirect the post")),
      othersKept: said.some((label) => label.includes("Pay the deposit")),
    };
  });

  report.checks.leadsWithWhatYouClicked = {
    menu: led,
    record,
    inbox,
    namedItsOwn: finishPost > 0,
    ok:
      led["t-post"].names &&
      led["t-meter"].names &&
      led["t-post"].rank === "0" &&
      led["t-meter"].rank === "0" &&
      recordLeads &&
      inbox.postGone &&
      inbox.othersKept,
  };

  /* ------------------------------------ the keyboard keeps its place */
  /*
   * EVERY ACT TAKEN FROM THE KEYBOARD used to end at the top of the
   * document: the list is live — an act applies and goes, a pin regroups,
   * an ask closes — and React drops focus to <body> whenever the focused
   * element goes away. In the menu, a pin keeps the keyboard in it, and an
   * act or an answered ask closes the menu and gives the keyboard back to
   * where it was opened — never to the body.
   */
  await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  const where = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      const menu = document.querySelector('[data-testid="context-menu"]');
      return {
        where:
          active === document.body
            ? "body"
            : (active?.getAttribute("data-affordance") ??
              active?.getAttribute("data-pin-for") ??
              active?.getAttribute("data-graview-view") ??
              active?.getAttribute("aria-label") ??
              active?.tagName.toLowerCase() ??
              "none"),
        inside: menu !== null && active !== null && menu.contains(active),
        body: active === document.body || active === null,
      };
    });
  const pressFromTheKeyboard = async (selector) => {
    await page.focus(selector);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    return where();
  };
  const actRow = (mutation) => `${MENU} li:has([data-pin-for="${mutation}"]) button[data-affordance]`;
  await openActs(page, "t-deposit");
  const afterAnAct = await pressFromTheKeyboard(actRow("finish"));
  await closeActs(page);
  await openActs(page, "t-book");
  const afterAPin = await pressFromTheKeyboard(`${MENU} [data-pin-for="edit-task"]`);
  await page.focus(actRow("edit-task"));
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-graview-asking]");
  await page.waitForTimeout(200);
  // Answer every open argument, so the ask actually closes.
  while ((await page.$("[data-graview-asking]")) !== null) {
    await page.keyboard.type("90");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  const afterAnAsk = await where();
  report.checks.theKeyboardKeepsItsPlace = {
    afterAnAct,
    afterAPin,
    afterAnAsk,
    ok: !afterAnAct.body && afterAPin.inside && !afterAnAsk.body,
  };

  report.pageErrors = errors;
  report.passed =
    Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
}

writeFileSync(resolve(repoRoot, "docs/menu.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/menu.json\n`);
process.exit(report.passed ? 0 : 1);
