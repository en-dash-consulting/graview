#!/usr/bin/env node
/**
 * NOTIFY ME, IN TWO PRESSES (Roadmap f-notify-subscriptions) — driven in a
 * real browser against the todo app, which keeps a reader's subscriptions in
 * the page and is its own host's hook (`__notified`, where Graview Cloud
 * would send an email or a push).
 *
 * From a right-click on a record in the scene, on a kind's list on the
 * routed face and on an act on a record's page, a person subscribes in two
 * presses: the menu's "Notify me…", then the sheet's "Notify me", already
 * filled in. What they are told of is listed in Activity with one press to
 * stop. A change somebody else makes is told once, with what changed; their
 * own is not; and once they stop, nothing more is told. After an act's form
 * is done on a record's page, "Notify me when someone else does this" is
 * offered beside the acts.
 *
 *   node scripts/verify-notify.mjs [--engine=chromium|webkit|firefox]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const VERDICT = resolve(repoRoot, "docs/notify.json");

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let app;
let browser;
const reach = deadline({
  verdict: VERDICT,
  report,
  cleanup: async () => {
    await browser?.close();
    app?.stop();
  },
});
app = await serving("todo", portFor("todo"), repoRoot);

const MENU = '[data-testid="context-menu"]';
const NOTIFY_ROW = `${MENU} [data-menu-item="notify-me"]`;
const SHEET = '[data-testid="notify-sheet"]';
const KEEP = '[data-testid="notify-keep"]';
const DAY = "today=2026-09-01";
/* A record page's or a list's heading, in the derived face or the app's own design. */
const HEADING = "main :is([data-graview-page-title], h1, h2) >> nth=0";

/* The store itself, handed to the watch as it opens (as verify-inline-ai keeps it). */
const KEEP_THE_STORE = () => {
  const keep = (store) => (window.__notifyStores ??= []).push(store);
  const watch = (window.__graviewWatch ??= {});
  const handed = watch.store;
  watch.store = (store) => {
    handed?.(store);
    keep(store);
  };
};

const ready = async (page) => {
  await page.waitForFunction(() => "__todoReady" in window && (window.__notifyStores ?? []).some((store) => store.schema.kinds.includes("task")), undefined, { timeout: 120_000 });
  await page.waitForTimeout(600);
};

/** Where the keyboard is: never <body>. */
const keyboard = (page) => page.evaluate(() => ({ body: document.activeElement === document.body || document.activeElement === null, on: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName.toLowerCase() ?? null }));

/**
 * THE TWO PRESSES, counted: the menu's row, then the sheet's first button.
 * Answers what the row said, what the sheet said it would keep, and where
 * the keyboard went.
 */
async function subscribeFromTheMenu(page, rightClick) {
  let presses = 0;
  await rightClick();
  await page.waitForSelector(NOTIFY_ROW, { timeout: 10_000 });
  const row = ((await page.textContent(NOTIFY_ROW)) ?? "").trim();
  await page.click(NOTIFY_ROW);
  presses += 1;
  await page.waitForSelector(`${SHEET} ${KEEP}`, { timeout: 15_000 });
  const said = ((await page.textContent(`${SHEET} [data-testid="notify-said"]`)) ?? "").trim();
  const othersOnly = await page.isChecked(`${SHEET} [data-testid="notify-others-only"]`);
  await page.click(`${SHEET} ${KEEP}`);
  presses += 1;
  await page.waitForSelector(SHEET, { state: "detached", timeout: 10_000 });
  await page.waitForTimeout(300);
  return { row, said, othersOnly, presses, keyboard: await keyboard(page) };
}

/** What Activity lists the reader is told of. */
async function notifiedInActivity(page) {
  if (!(await page.$('[data-testid="activity"]'))) await page.click('[data-testid="activity-button"]');
  await page.waitForSelector('[data-testid="activity"]', { timeout: 10_000 });
  await page.waitForTimeout(400);
  return page.evaluate(() => [...document.querySelectorAll('[data-testid="activity"] [data-testid="notified"] li')].map((one) => (one.textContent ?? "").replace(/Stop$/, "").trim()));
}

/** A change made in the page's store as somebody, as another tab or a server would land it. */
const changeAs = (page, call, author) =>
  page.evaluate(({ call, author }) => {
    const store = window.__notifyStores.find((one) => one.schema.kinds.includes("task"));
    store.apply(call, { author });
  }, { call, author });

/** What the host's hook was told. */
const told = (page) => page.evaluate(() => (window.__notified ?? []).map((match) => ({ said: match.said, by: match.byName, records: match.records.map((record) => `${record.label}:${record.change}`), subscription: match.subscription.when })));

const NORA = { kind: "human", id: "user-nora", roles: ["keeper"] };
const SAM = { kind: "human", id: "user-sam", name: "Sam", roles: ["member"] };

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const errors = [];

  /* ------------------------------------------------ a record, on the scene */
  reach("fromARecordInTwoPresses");
  const scene = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  scene.on("pageerror", (error) => errors.push(`scene: ${error.message}`));
  await scene.addInitScript(KEEP_THE_STORE);
  await scene.goto(`${at("todo")}/?${DAY}&fresh=1`, { waitUntil: "load", timeout: 90_000 });
  await ready(scene);
  const record = await subscribeFromTheMenu(scene, () => scene.click('[data-graview-pick="t-deposit"]', { button: "right" }));
  const listed = await notifiedInActivity(scene);
  report.checks.fromARecordInTwoPresses = {
    ...record,
    listed,
    ok: record.presses <= 2 && /Notify me when this changes/.test(record.row) && record.othersOnly && /someone else changes “Pay the deposit”/.test(record.said) && !record.keyboard.body && listed.some((one) => /someone else changes “Pay the deposit”/.test(one)),
  };
  await scene.keyboard.press("Escape");

  /* ------------------------- somebody else's change is told once; mine is not */
  reach("someoneElsesChangeIsToldOnce");
  await changeAs(scene, { name: "finish", args: { taskId: "t-deposit" } }, SAM);
  await scene.waitForTimeout(400);
  const afterSam = await told(scene);
  await changeAs(scene, { name: "rename", args: { id: "t-deposit", label: "Pay the deposit today" } }, NORA);
  await scene.waitForTimeout(400);
  const afterNora = await told(scene);
  report.checks.someoneElsesChangeIsToldOnce = {
    afterSam,
    afterNora: afterNora.length,
    ok: afterSam.length === 1 && afterSam[0].by === "Sam" && afterSam[0].records.includes("Pay the deposit:changed") && afterNora.length === 1,
  };

  /* --------------------------------------------- one press stops it, in Activity */
  reach("onePressStops");
  await notifiedInActivity(scene);
  await scene.click('[data-testid="activity"] [data-testid="notify-stop"]');
  await scene.waitForTimeout(500);
  const stillListed = await scene.evaluate(() => document.querySelectorAll('[data-testid="activity"] [data-testid="notified"] li').length);
  const afterStop = await keyboard(scene);
  await scene.keyboard.press("Escape");
  await changeAs(scene, { name: "rename", args: { id: "t-deposit", label: "Pay the deposit now" } }, SAM);
  await scene.waitForTimeout(400);
  const afterStopTold = await told(scene);
  report.checks.onePressStops = {
    stillListed,
    keyboard: afterStop,
    told: afterStopTold.length,
    ok: stillListed === 0 && !afterStop.body && afterStopTold.length === 1,
  };
  await scene.close();

  /* ---------------------------------------- a kind's list, on the routed face */
  reach("fromAKindInTwoPresses");
  const pages = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  pages.on("pageerror", (error) => errors.push(`pages: ${error.message}`));
  await pages.addInitScript(KEEP_THE_STORE);
  await pages.goto(`${at("todo")}/pages/tasks?${DAY}&fresh=1`, { waitUntil: "load", timeout: 90_000 });
  await pages.waitForSelector(HEADING, { timeout: 60_000 });
  await ready(pages);
  // The list's own ground, past its words: WebKit takes a right-click on a word as choosing it, and the browser's menu is then its own.
  const kind = await subscribeFromTheMenu(pages, () => pages.click("main", { button: "right", position: { x: 4, y: 4 } }));
  await changeAs(pages, { name: "add-task", args: { listId: "today", label: "Water the plants" } }, SAM).catch((error) => errors.push(`add-task: ${String(error)}`));
  await pages.waitForTimeout(400);
  const toldOfTheKind = await told(pages);
  report.checks.fromAKindInTwoPresses = {
    ...kind,
    told: toldOfTheKind,
    ok: kind.presses <= 2 && /Notify me when a task is added/.test(kind.row) && /someone else adds a task/.test(kind.said) && !kind.keyboard.body && toldOfTheKind.some((one) => one.records.some((record) => record.endsWith(":created"))),
  };

  /* ---------------------------------------------- an act, on a record's page */
  reach("fromAnActInTwoPresses");
  await pages.goto(`${at("todo")}/pages/tasks/t-book?${DAY}&fresh=1`, { waitUntil: "load", timeout: 90_000 });
  await pages.waitForSelector('[data-testid="record-actions"] [data-graview-act]', { timeout: 60_000 });
  await ready(pages);
  const actName = await pages.getAttribute('[data-testid="record-actions"] [data-graview-act] >> nth=0', "data-graview-act");
  const act = await subscribeFromTheMenu(pages, () => pages.click('[data-testid="record-actions"] [data-graview-act] >> nth=0', { button: "right", position: { x: 3, y: 3 } }));
  report.checks.fromAnActInTwoPresses = {
    act: actName,
    ...act,
    ok: act.presses <= 2 && /Notify me when someone does this/.test(act.row) && /someone else runs “.+” on “Book the van”/.test(act.said) && !act.keyboard.body,
  };

  /* ----------------------------------------------- after an act's form is done */
  reach("offeredAfterAnAct");
  await pages.goto(`${at("todo")}/pages/tasks/t-book?${DAY}&fresh=1`, { waitUntil: "load", timeout: 90_000 });
  await pages.waitForSelector('[data-testid="record-actions"] [data-affordance]', { timeout: 60_000 });
  await ready(pages);
  // The first act: done at once when it asks nothing, else through its form, sent as it is filled in.
  await pages.click('[data-testid="record-actions"] [data-affordance] >> nth=0');
  const asks = await pages.waitForSelector('[data-testid="record-actions"] form button[type="submit"]', { timeout: 2_000 }).then(() => true, () => false);
  if (asks) await pages.click('[data-testid="record-actions"] form button[type="submit"]');
  const offered = await pages.waitForSelector('[data-testid="notify-after-act"]', { timeout: 10_000 }).then(() => true, () => false);
  const offeredSays = offered ? ((await pages.textContent('[data-testid="notify-after-act"]')) ?? "").trim() : null;
  report.checks.offeredAfterAnAct = { offered, says: offeredSays, ok: offered && /someone else does this/.test(offeredSays ?? "") };
  await pages.close();

  reach.done();
  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  reach.done();
  if (!report.checks[reach.at()]) report.checks[reach.at()] = { ok: false, stopped: String(error) };
  report.stoppedAt = reach.at();
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
}

writeFileSync(VERDICT, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/notify.json\n`);
process.exit(report.passed ? 0 : 1);
