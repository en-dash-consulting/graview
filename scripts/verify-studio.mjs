#!/usr/bin/env node
/**
 * THE STUDIO IS ONE PRESS FROM THE APP, and it actually works.
 *
 * `@graview/studio` shipped as a package and as a chapter of the seedbed
 * with no way in from the app you were looking at — so the claim the whole
 * platform story rests on, that a declaration is a graph you change with
 * the same gestures you change data with, was true and unreachable.
 *
 * Driven the way a person would: open it from Things' own bar as the seat
 * that keeps the installation, add a field to a kind from the actions
 * strip, read what the checker makes of the declaration as it now stands,
 * see the field in the schema the studio would write, take the change back,
 * and check that the seat that may not administer is never offered the door
 * at all.
 *
 *   node scripts/verify-studio.mjs [--engine=chromium|webkit|firefox]
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

/** The written schema, read out of the download link the studio offers. */
const writtenSchema = (page) =>
  page.evaluate(() => {
    const link = document.querySelector('[data-testid="studio-file-src/domain/schema.ts"]');
    const href = link?.getAttribute("href") ?? "";
    return decodeURIComponent(href.slice(href.indexOf(",") + 1));
  });

const verdict = (page) =>
  page.evaluate(() => {
    const said = document.querySelector('[data-testid="studio-verdict"]');
    return {
      text: said?.textContent?.trim() ?? null,
      errors: Number(said?.getAttribute("data-errors") ?? -1),
      warnings: Number(said?.getAttribute("data-warnings") ?? -1),
    };
  });

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const open = async (as) => {
    await page.goto(`http://localhost:5193/?today=2026-09-01&fresh=1&as=${as}`, { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    await page.waitForTimeout(800);
  };

  /* ------------------------------------ the door, and who is offered it */
  await open("user-sam");
  const memberSees = await page.$('[data-testid="studio-place"]');
  await open("user-nora");
  const keeperSees = await page.$('[data-testid="studio-place"]');
  report.checks.theDoorBelongsToWhoeverKeepsTheApp = {
    member: memberSees !== null,
    keeper: keeperSees !== null,
    ok: memberSees === null && keeperSees !== null,
  };

  /* ------------------------------------------- it opens the running app */
  await page.click('[data-testid="studio-place"]');
  await page.waitForSelector('[data-testid="studio"]', { timeout: 20_000 });
  await page.waitForTimeout(1200);
  const opened = await page.evaluate(() => ({
    districts: [...document.querySelectorAll('[data-testid="studio"] [data-graview-view]')].map((el) =>
      el.getAttribute("data-graview-view"),
    ),
    places: [...document.querySelectorAll('[data-testid="studio"] nav[aria-label="Places"] button')].map(
      (button) => button.textContent?.trim(),
    ),
  }));
  const before = await verdict(page);
  report.checks.itOpensTheRunningAppsOwnDeclaration = {
    ...opened,
    verdict: before,
    ok:
      ["kind:kind", "kind:field", "kind:act", "kind:rule", "kind:role", "kind:grant"].every((one) =>
        opened.districts.includes(one),
      ) &&
      opened.places.includes("What the checker says") &&
      before.errors === 0,
  };

  /* ------------------------------- a field added with the ordinary acts */
  /*
   * The kinds district, opened into its members, then the task kind itself.
   * An act on a kind is offered where the kind is, like any other act on
   * any other node — which is the whole claim: there is no second editor.
   */
  await page.locator('[data-graview-view="kind:kind"] button', { hasText: "open" }).first().click();
  await page.waitForSelector('[data-graview-pick="kind:task"]', { timeout: 10_000 });
  await page.waitForTimeout(600);
  /*
   * Selected FROM THE KEYBOARD. A chip in an opened district can sit under
   * the district's own card, so a pointer click is refused as intercepted —
   * and the keyboard path is the one that matters anyway: the scene makes
   * every pick target focusable precisely so that the primary way through
   * the graph is not mouse-only.
   */
  await page.focus('[data-graview-pick="kind:task"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="inspector-strip"] [data-affordance]', { timeout: 10_000 });
  const offered = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="inspector-strip"] [data-affordance]')].map((b) =>
      b.textContent?.trim(),
    ),
  );
  await page.locator('[data-testid="inspector-strip"] [data-affordance]', { hasText: "Add a field" }).first().click();
  await page.waitForSelector("[data-graview-asking]", { timeout: 10_000 });
  // Answer what the act still wants: a name, a type, and whether it is required.
  await page.keyboard.type("urgency");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  for (let step = 0; step < 4 && (await page.$("[data-graview-asking]")) !== null; step++) {
    const choice = await page.$("[data-graview-asking] button:not([disabled])");
    if (choice) {
      await choice.click();
    } else {
      await page.keyboard.type("x");
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  const after = await verdict(page);
  await page.click('[data-testid="studio-apply"]');
  await page.waitForSelector('[data-testid="studio-applied"]', { timeout: 10_000 });
  const schema = await writtenSchema(page);
  report.checks.aFieldAddedIsAFieldWritten = {
    offered,
    verdict: after,
    inTheSchema: schema.includes("urgency"),
    stillATask: schema.includes('defineNode("task"'),
    /* What the studio does not model it must not destroy: the task's own
       display labels came from the checkout and have to survive the trip. */
    keptHowItReads: schema.includes("Blocked"),
    ok:
      after.errors === 0 &&
      schema.includes("urgency") &&
      schema.includes('defineNode("task"') &&
      schema.includes("Blocked"),
  };

  /* ------------------------------------------- and taking it back works */
  // The STUDIO's rail, not the app's behind it: two exist on the page, and
  // the one that matters is the one about the declaration.
  await page.click('[data-testid="studio"] [data-testid="activity-button"]');
  await page.waitForTimeout(500);
  await page.locator('[data-testid="studio"] [data-testid="undo-turn"]').first().click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.click('[data-testid="studio-apply"]');
  await page.waitForSelector('[data-testid="studio-applied"]', { timeout: 10_000 });
  const undone = await writtenSchema(page);
  report.checks.everyChangeIsAnActWithUndo = {
    goneAgain: !undone.includes("urgency"),
    ok: !undone.includes("urgency") && undone.includes('defineNode("task"'),
  };

  /* ------------------------- an agent proposes; the trail keeps or declines */
  /*
   * A rule that says what is wrong without naming what puts it right is a
   * rule the interface can only complain about. The studio's seat finds
   * them and proposes the act that plausibly repairs each — under its own
   * name, in a batch of its own, so the trail beside it says who did it and
   * one press takes it back. Keeping is doing nothing.
   */
  await page.click('[data-testid="studio"] [data-testid="activity-button"]');
  await page.waitForTimeout(400);
  const seat = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="studio-seat"]');
    return { label: button?.textContent?.trim() ?? null, disabled: button?.disabled ?? null };
  });
  if (seat.disabled === false) {
    await page.click('[data-testid="studio-seat"]');
    await page.waitForTimeout(1500);
  }
  const proposed = await page.evaluate(() => ({
    turns: [...document.querySelectorAll('[data-testid="studio"] [data-testid="diff-log"] li')].map((li) =>
      (li.textContent ?? "").replace(/\s+/g, " ").slice(0, 80),
    ),
  }));
  report.checks.anAgentProposesAndTheTrailDecides = {
    seat,
    ...proposed,
    /* Either it had something to propose and the trail carries it under the
       agent's name, or every rule already names its repair and the seat
       says so instead of sitting there live and doing nothing. */
    ok:
      seat.label !== null &&
      (seat.disabled === true
        ? /names what puts it right|Nothing/i.test(seat.label)
        : proposed.turns.some((turn) => /studio|repair/i.test(turn))),
  };
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  /* ------------------------------------ and closing puts you back in the app */
  await page.click('[data-testid="studio-close"]');
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => ({
    studioGone: document.querySelector('[data-testid="studio"]') === null,
    stillTheApp: document.querySelector('[data-graview-pick="t-deposit"]') !== null,
  }));
  report.checks.closingPutsYouBackWhereYouWere = { ...back, ok: back.studioGone && back.stillTheApp };

  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
}

writeFileSync(resolve(repoRoot, "docs/studio.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/studio.json\n`);
process.exit(report.passed ? 0 : 1);
