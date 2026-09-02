#!/usr/bin/env node
/**
 * The menu scales — search, pins, and what you actually use, driven in a
 * real browser against the todo app.
 *
 * The searcher must appear only past the fold, filter the same derived
 * list, and run a sole survivor on Enter. A pin made from the menu must
 * reorder the same list every surface reads, survive a reload (it lives in
 * this browser's storage), outrank the app's own declared pin, and come
 * back off with the same gesture.
 *
 *   node scripts/verify-menu.mjs [--engine=chromium|webkit|firefox]
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

function startVite() {
  const child = spawn("npx", ["vite"], {
    cwd: resolve(repoRoot, "apps/todo"),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start")), 60_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("5193")) {
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

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
const vite = await startVite();
let browser;

/** The strip's offered mutations, in document order, via each row's pin. */
const offeredOrder = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="inspector-strip"] [data-pin-for]')].map(
      (star) => star.getAttribute("data-pin-for"),
    ),
  );

const visibleActionCount = (page) =>
  page.evaluate(
    () => document.querySelectorAll('[data-testid="inspector-strip"] [data-affordance]').length,
  );

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });

  /* ------------------------- the searcher appears only past the fold */
  await page.click('[data-graview-pick="t-post"]');
  await page.waitForSelector('[data-testid="inspector-strip"]');
  const quietCount = await page.evaluate(() => {
    const more = document.querySelector('[data-testid="inspector-strip"] ol li:last-child button');
    const hiddenSaid = more?.textContent?.match(/Show (\d+) more/);
    const shown = document.querySelectorAll(
      '[data-testid="inspector-strip"] [data-affordance]',
    ).length;
    return shown + (hiddenSaid ? Number(hiddenSaid[1]) : 0);
  });
  const quietFilter = await page.$('[data-testid="action-filter"]');
  report.checks.filterOnlyPastTheFold = {
    quietTaskActions: quietCount,
    filterShown: quietFilter !== null,
    ok: (quietCount > 9) === (quietFilter !== null),
  };

  /* ------------------------------------------------- search, then apply */
  // t-book waits for t-quote, so its list carries the severing act too —
  // past the fold, and the field appears.
  await page.click('[data-graview-pick="t-book"]');
  await page.waitForSelector('[data-testid="action-filter"]', { timeout: 10_000 });
  await page.fill('[data-testid="action-filter"]', "done");
  await page.waitForTimeout(120);
  const survivors = await visibleActionCount(page);
  const soleLabel = await page.evaluate(
    () =>
      document.querySelector('[data-testid="inspector-strip"] [data-affordance]')?.textContent ??
      "",
  );
  const dueBefore = await page.evaluate(() =>
    (document.querySelector('[data-graview-pick="t-book"]')?.textContent ?? "").includes("09-01"),
  );
  await page.press('[data-testid="action-filter"]', "Enter");
  /*
   * Applied: the row stops carrying its due date (done tasks do not), and
   * the searcher clears itself so the full list is back for the next act.
   */
  await page.waitForFunction(
    () =>
      !(document.querySelector('[data-graview-pick="t-book"]')?.textContent ?? "").includes(
        "09-01",
      ) && (document.querySelector('[data-testid="action-filter"]')?.value ?? "x") === "",
    null,
    { timeout: 10_000 },
  );
  report.checks.searchThenApply = {
    survivors,
    soleLabel: soleLabel.trim(),
    dueShownBeforehand: dueBefore,
    applied: true,
    ok: survivors === 1 && soleLabel.includes("Mark it done") && dueBefore,
  };

  /* ------------------------------ Enter never runs the destructive tail */
  // Narrow to the one destructive act and press Enter: nothing may happen.
  // What cannot be taken back keeps requiring the aimed click, and the row
  // carries no ↵ promise.
  await page.fill('[data-testid="action-filter"]', "Drop");
  await page.waitForTimeout(150);
  const dropSurvivors = await visibleActionCount(page);
  const dropHint = await page.evaluate(
    () =>
      document.querySelector('[data-testid="inspector-strip"] [data-affordance]')?.textContent ??
      "",
  );
  await page.press('[data-testid="action-filter"]', "Enter");
  await page.waitForTimeout(400);
  const stillThere = await page.evaluate(
    () => document.querySelector('[data-graview-pick="t-book"]') !== null,
  );
  report.checks.destructiveNeedsTheClick = {
    dropSurvivors,
    hintShown: dropHint.includes("↵"),
    stillThere,
    ok: dropSurvivors === 1 && !dropHint.includes("↵") && stillThere,
  };
  await page.fill('[data-testid="action-filter"]', "");

  /* --------------------------------------------------- pin, then reorder */
  // Clear t-book first: its drawn ties otherwise lie over the next card.
  await page.click('[aria-label="Clear selection"]');
  await page.waitForTimeout(200);
  await page.click('[data-graview-pick="t-deposit"]');
  await page.waitForSelector('[data-testid="inspector-strip"] [data-pin-for]');
  const before = await offeredOrder(page);
  await page.click('[data-pin-for="rename"]');
  await page.waitForTimeout(150);
  const after = await offeredOrder(page);
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="inspector-strip"] ol li[data-graview-heading]')].map(
      (heading) => heading.textContent?.trim(),
    ),
  );
  /*
   * On this overdue task "finish" is a REPAIR, so it sits in the top band
   * where no pin may reach — which is itself part of the claim. The pin's
   * movement is measured against an unpinned peer (reopen), and the
   * repairs must still lead afterwards.
   */
  report.checks.pinThenReorder = {
    before: before.slice(0, 5),
    after: after.slice(0, 5),
    headings,
    ok:
      before.indexOf("rename") > before.indexOf("reopen") &&
      after.indexOf("rename") < after.indexOf("reopen") &&
      after.indexOf("finish") === 0 &&
      headings.includes("pinned") &&
      headings.some((heading) => heading?.includes("⚠")),
  };

  /* -------------------------------------------- the pin is this browser's */
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.click('[data-graview-pick="t-deposit"]');
  await page.waitForSelector('[data-testid="inspector-strip"] [data-pin-for]');
  const survived = await offeredOrder(page);
  const pressed = await page.evaluate(
    () =>
      document
        .querySelector('[data-pin-for="rename"]')
        ?.getAttribute("aria-pressed") === "true",
  );
  // Unpinning is the same gesture.
  await page.click('[data-pin-for="rename"]');
  await page.waitForTimeout(150);
  const unpinned = await offeredOrder(page);
  report.checks.pinSurvivesReloadAndUnpins = {
    survived: survived.indexOf("rename") < survived.indexOf("reopen"),
    pressed,
    unpinnedAgain: unpinned.indexOf("rename") > unpinned.indexOf("reopen"),
    ok:
      survived.indexOf("rename") < survived.indexOf("reopen") &&
      pressed &&
      unpinned.indexOf("rename") > unpinned.indexOf("reopen"),
  };

  /* ------------------------------------- the dev's pin is overridable too */
  // finish is pinned by the app's own declaration. The same star demotes
  // it for this person — and brings it back. Without this, the star on a
  // declared pin was a control that visibly did nothing.
  await page.click('[aria-label="Clear selection"]');
  await page.waitForTimeout(200);
  await page.click('[data-graview-pick="t-book"]');
  await page.waitForSelector('[data-testid="inspector-strip"] [data-pin-for="finish"]');
  const headed = (list) => list.includes("pinned");
  const headingsNow = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll('[data-testid="inspector-strip"] ol li[data-graview-heading]'),
      ].map((heading) => heading.textContent?.trim() ?? ""),
    );
  const declaredShown = headed(await headingsNow());
  await page.click('[data-pin-for="finish"]');
  await page.waitForTimeout(150);
  const demotedNow = !headed(await headingsNow());
  await page.click('[data-pin-for="finish"]');
  await page.waitForTimeout(150);
  const restoredNow = headed(await headingsNow());
  report.checks.devPinOverride = {
    declaredShown,
    demotedNow,
    restoredNow,
    ok: declaredShown && demotedNow && restoredNow,
  };

  report.pageErrors = errors;
  report.passed =
    Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    vite.kill("SIGTERM");
  }
}

writeFileSync(resolve(repoRoot, "docs/menu.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/menu.json\n`);
process.exit(report.passed ? 0 : 1);
