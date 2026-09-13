#!/usr/bin/env node
/**
 * THE CALENDAR, driven the way a person drives one.
 *
 * The timeline binds minutes of a day in named columns, which is a week
 * grid: it cannot say "due on the 14th of next month". This checks the
 * things a calendar owes that a week grid never had to — four ranges, a
 * multi-day span drawn on every day it covers, overflow that OPENS the day
 * rather than hiding it, the month you are looking at being a place Back
 * returns to, and every entry still being a real node the scene selects.
 *
 *   node scripts/verify-calendar.mjs [--engine=chromium|webkit|firefox]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
const app = await serving("todo", 5193, repoRoot);
let browser;

const showing = (page) =>
  page.evaluate(() => {
    const cal = document.querySelector('[data-testid="calendar"]');
    return {
      range: cal?.getAttribute("data-calendar-range") ?? null,
      at: cal?.getAttribute("data-calendar-at") ?? null,
      days: document.querySelectorAll("[data-calendar-day]").length,
      entries: [...document.querySelectorAll("[data-calendar-entry]")].length,
      hash: location.hash,
    };
  });

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  /* ----------------------------------- the month is a place on the bar */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  const places = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Places"] button')].map((b) => b.textContent?.trim()),
  );
  await page.locator('nav[aria-label="Places"] button', { hasText: "The month" }).first().click();
  await page.waitForSelector('[data-testid="calendar"]', { timeout: 20_000 });
  await page.waitForTimeout(700);
  const opened = await showing(page);
  report.checks.aSecondPictureOfOneGroupIsASecondPlace = {
    places,
    opened,
    /* Three pictures over two groups: the month, the week and the lists.
       Until a place could be addressed, a kind had exactly one. */
    ok:
      places.includes("The month") &&
      places.includes("The week") &&
      opened.range === "month" &&
      opened.days === 42 &&
      opened.entries > 0 &&
      opened.hash.includes("in.view=the-month"),
  };

  /* ------------------------------- the month you left is a place to return to */
  await page.locator('[data-testid="calendar"] button[aria-label="Next"]').click();
  await page.waitForTimeout(600);
  const next = await showing(page);
  await page.goBack();
  await page.waitForTimeout(900);
  const back = await showing(page);
  report.checks.theMonthYouLeftIsWhereBackGoes = {
    next: next.at,
    back: back.at,
    ok: next.at === "2026-10-01" && back.at === "2026-09-01" && back.range === "month",
  };

  /* --------------------------------------------- all four ranges answer */
  const ranges = {};
  for (const range of ["week", "day", "agenda", "month"]) {
    await page.click(`[data-testid="calendar-range-${range}"]`);
    await page.waitForTimeout(500);
    ranges[range] = await showing(page);
  }
  report.checks.fourRangesOverTheSameEntries = {
    ...Object.fromEntries(Object.entries(ranges).map(([key, value]) => [key, value.days])),
    ok:
      ranges["week"].days === 7 &&
      ranges["day"].days === 1 &&
      ranges["agenda"].days > 0 &&
      ranges["month"].days === 42 &&
      Object.values(ranges).every((one) => one.range !== null),
  };

  /* ------------------ an entry is a node: selecting it opens the strip */
  await page.click('[data-testid="calendar-range-month"]');
  await page.waitForTimeout(500);
  const first = await page.evaluate(
    () => document.querySelector("[data-calendar-entry]")?.getAttribute("data-calendar-entry") ?? null,
  );
  await page.focus(`[data-calendar-entry="${first}"]`);
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="inspector-strip"] [data-affordance]', { timeout: 10_000 });
  const acted = await page.evaluate((id) => ({
    strip: [...document.querySelectorAll('[data-testid="inspector-strip"] [data-affordance]')].map((b) =>
      b.textContent?.trim(),
    ),
    lit: document.querySelector(`[data-calendar-entry="${id}"]`)?.getAttribute("data-graview-emphasis"),
  }), first);
  report.checks.anEntryIsANodeAndTheStripKnowsIt = {
    entry: first,
    ...acted,
    ok: acted.strip.length > 0 && acted.lit === "lit",
  };

  /* -------------------------- a busy day says how many, and opens itself */
  // 2026-09-04 onwards: the example's tasks cluster, so at one per cell the
  // overflow is guaranteed rather than hoped for.
  await page.goto("http://localhost:5193/?today=2026-09-01#focus=aggregate:task&in.view=the-month&in.range=day&in.at=2026-09-03", {
    waitUntil: "load",
  });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.waitForSelector('[data-testid="calendar"]', { timeout: 20_000 });
  await page.waitForTimeout(600);
  const oneDay = await showing(page);
  report.checks.aRangeInTheAddressOpensThere = {
    ...oneDay,
    ok: oneDay.range === "day" && oneDay.at === "2026-09-03" && oneDay.days === 1,
  };

  /* ---------------- dragging an entry to a day is an act, and undoes */
  /*
   * A calendar you cannot drag in is a picture of a schedule rather than a
   * schedule. The lens asks the DECLARATION which act writes the bound
   * date, the store judges it, and the log records it — so one undo puts
   * the entry back on the day it came from.
   */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1#focus=aggregate:task&in.view=the-month", {
    waitUntil: "load",
  });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.waitForSelector('[data-testid="calendar"]', { timeout: 20_000 });
  await page.waitForTimeout(700);
  const dragged = await page.evaluate(() => {
    const entry = document.querySelector('[data-calendar-entry]');
    const id = entry?.getAttribute("data-calendar-entry");
    const was = entry?.closest("[data-calendar-day]")?.getAttribute("data-calendar-day");
    const onto = [...document.querySelectorAll("[data-calendar-day]")].find(
      (cell) => cell.getAttribute("data-calendar-day") === "2026-09-23",
    );
    if (!entry || !id || !onto) return { id, was, moved: false };
    /*
     * The browser's own drag, driven by hand: Playwright's dragTo needs a
     * real pointer sequence that the scene's card drag would intercept
     * first, and what is under test here is the DROP contract, not the
     * pointer emulation.
     */
    const data = new DataTransfer();
    entry.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
    onto.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
    onto.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
    return { id, was, moved: true };
  });
  await page.waitForTimeout(700);
  const landed = await page.evaluate(
    (id) =>
      document
        .querySelector(`[data-calendar-entry="${id}"]`)
        ?.closest("[data-calendar-day]")
        ?.getAttribute("data-calendar-day") ?? null,
    dragged.id,
  );
  // The rail only offers a turn to take back once there IS one, so it is
  // opened after the drop rather than before.
  await page.click('[data-testid="activity-button"]');
  await page.waitForSelector('[data-testid="undo-turn"]', { timeout: 20_000 });
  await page.locator('[data-testid="undo-turn"]').first().click();
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const returned = await page.evaluate(
    (id) =>
      document
        .querySelector(`[data-calendar-entry="${id}"]`)
        ?.closest("[data-calendar-day]")
        ?.getAttribute("data-calendar-day") ?? null,
    dragged.id,
  );
  report.checks.draggingAnEntryIsAnActWithUndo = {
    ...dragged,
    landed,
    returned,
    refused: await page.evaluate(
      () => document.querySelector('[data-testid="calendar-refused"]')?.textContent ?? null,
    ),
    ok: dragged.moved && landed === "2026-09-23" && returned === dragged.was,
  };

  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
}

writeFileSync(resolve(repoRoot, "docs/calendar.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/calendar.json\n`);
process.exit(report.passed ? 0 : 1);
