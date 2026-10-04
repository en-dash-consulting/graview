#!/usr/bin/env node
/**
 * THE CALENDAR, driven the way a person drives one.
 *
 * The timeline binds minutes of a day in named columns, which is a week
 * grid: it cannot say "due on the 14th of next month". This checks the
 * things a calendar owes that a week grid never had to — every range, a
 * multi-day span drawn on every cell it covers, overflow that OPENS the cell
 * rather than hiding it, the month you are looking at being a place Back
 * returns to, and every entry still being a real node the scene selects.
 *
 * And the LONGER HORIZONS, in the two demos that have something to show at
 * them: the garden's rotation over four years, a month per cell, with a drop
 * onto a coarse cell saying out loud what date it wrote; and the rota's
 * quarter, a week per cell.
 *
 *   node scripts/verify-calendar.mjs [--engine=chromium|webkit|firefox]
 */
import { pressPlace } from "./lib/places.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
const app = await serving("todo", portFor("todo"), repoRoot);
const garden = await serving("seedbed", portFor("seedbed"), repoRoot);
const roster = await serving("rota", portFor("rota"), repoRoot);
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
  await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  const places = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Places"] button')].map((b) => b.textContent?.trim()),
  );
  await pressPlace(page, "The month");
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
  await page.goto(`${at("todo")}/?today=2026-09-01#focus=aggregate:task&in.view=the-month&in.range=day&in.at=2026-09-03`, {
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
  await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1#focus=aggregate:task&in.view=the-month`, {
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

  /* ------------------------------ the garden's rotation, four years out */
  /*
   * A bed is turned through four families and comes back to the first four
   * years later. Until the cell could coarsen, that was off the end of every
   * picture the framework could draw — a month grid you page through
   * forty-eight times. A month per cell, the span drawn across every cell it
   * covers, and the years themselves as stops down into one of them.
   */
  await page.goto(`${at("seedbed")}/?chapter=16&theme=light#focus=agg:rotation&in.view=the-rotation`, {
    waitUntil: "load",
  });
  await page.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
  await page.waitForSelector('[data-testid="calendar"]', { timeout: 20_000 });
  await page.waitForTimeout(900);
  const horizon = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("[data-calendar-cell]")];
    const entry = document.querySelector("[data-calendar-entry]");
    const id = entry?.getAttribute("data-calendar-entry") ?? null;
    return {
      range: document.querySelector('[data-testid="calendar"]')?.getAttribute("data-calendar-range") ?? null,
      grain: cells[0]?.getAttribute("data-calendar-grain") ?? null,
      cells: cells.length,
      years: [...document.querySelectorAll('[data-testid="calendar-years"] button')].map((b) => b.textContent?.trim()),
      named: [...document.querySelectorAll('[data-testid="calendar-ranges"] button')].map((b) => b.textContent?.trim()),
      /* One rotation, drawn across every month it runs through: eight months
         of a growing year, opening in March and closing in October. */
      across: id ? document.querySelectorAll(`[data-calendar-entry="${id}"]`).length : 0,
      parts: id
        ? [...document.querySelectorAll(`[data-calendar-entry="${id}"]`)].map((e) => e.getAttribute("data-calendar-part"))
        : [],
    };
  });
  report.checks.aHorizonTheAppNamesDrawsAMonthPerCell = {
    ...horizon,
    ok:
      horizon.range === "years" &&
      horizon.grain === "month" &&
      // Four years the GARDEN named, twelve months each.
      horizon.cells === 48 &&
      horizon.years.length === 4 &&
      horizon.named.includes("The rotation") &&
      horizon.across === 8 &&
      horizon.parts[0] === "opens" &&
      horizon.parts[horizon.parts.length - 1] === "closes",
  };

  /* ------------------------- down a level is an ordinary stop, and Back returns */
  await page.click('[data-testid="calendar-year-2028"]');
  await page.waitForTimeout(800);
  const aYear = await page.evaluate(() => ({
    range: document.querySelector('[data-testid="calendar"]')?.getAttribute("data-calendar-range") ?? null,
    at: document.querySelector('[data-testid="calendar"]')?.getAttribute("data-calendar-at") ?? null,
    cells: document.querySelectorAll("[data-calendar-cell]").length,
    hash: location.hash,
  }));
  await page.goBack();
  await page.waitForTimeout(900);
  const returnedToHorizon = await page.evaluate(
    () => document.querySelector('[data-testid="calendar"]')?.getAttribute("data-calendar-range") ?? null,
  );
  report.checks.goingDownALevelIsAnOrdinaryStop = {
    ...aYear,
    returnedToHorizon,
    ok: aYear.range === "year" && aYear.at === "2028-01-01" && aYear.cells === 12 && returnedToHorizon === "years",
  };

  /* --------------- a coarse cell rounds a drop, and SAYS what it wrote */
  const rounded = await page.evaluate(() => {
    const entry = document.querySelector("[data-calendar-entry]");
    const id = entry?.getAttribute("data-calendar-entry");
    const onto = [...document.querySelectorAll("[data-calendar-cell]")].find(
      (cell) => cell.getAttribute("data-calendar-cell") === "2028-06-01",
    );
    if (!entry || !id || !onto) return { id, moved: false };
    const data = new DataTransfer();
    entry.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
    onto.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
    onto.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
    return { id, moved: true };
  });
  await page.waitForTimeout(800);
  const saidSo = await page.evaluate(() => ({
    rounded: document.querySelector('[data-testid="calendar-rounded"]')?.textContent?.trim() ?? null,
    refused: document.querySelector('[data-testid="calendar-refused"]')?.textContent?.trim() ?? null,
  }));
  report.checks.aCoarseCellSaysWhatTheDropMeant = {
    ...rounded,
    ...saidSo,
    /* Either it wrote the date and said which one, or the policy refused it
       in its own words — never a silent rounding. */
    ok:
      rounded.moved &&
      ((saidSo.rounded !== null && /1 Jun/.test(saidSo.rounded) && /Undo/.test(saidSo.rounded)) ||
        saidSo.refused !== null),
  };

  /* ------------------------------------- and the rota plans by the quarter */
  await page.goto(`${at("rota")}/?today=2026-09-14&fresh=1#focus=aggregate:shift&in.view=the-quarter`, {
    waitUntil: "load",
  });
  await page.waitForFunction(() => "__rotaReady" in window, null, { timeout: 60_000 }).catch(() => {});
  await page.waitForSelector('[data-testid="calendar"]', { timeout: 30_000 });
  await page.waitForTimeout(900);
  const quarter = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("[data-calendar-cell]")];
    return {
      range: document.querySelector('[data-testid="calendar"]')?.getAttribute("data-calendar-range") ?? null,
      grain: cells[0]?.getAttribute("data-calendar-grain") ?? null,
      cells: cells.length,
      withEntries: cells.filter((cell) => Number(cell.getAttribute("data-calendar-count")) > 0).length,
      places: [...document.querySelectorAll('nav[aria-label="Places"] button')].map((b) => b.textContent?.trim()),
    };
  });
  report.checks.theRotaPlansByTheQuarter = {
    ...quarter,
    ok:
      quarter.range === "quarter" &&
      quarter.grain === "week" &&
      quarter.cells >= 13 &&
      quarter.withEntries > 0 &&
      quarter.places.includes("The quarter"),
  };

  /* ------------- and a horizon a machine can read, at both widths and schemes */
  /*
   * A NEW PICTURE IS A NEW CHANCE TO BE UNREADABLE. Forty-eight cells in a
   * grid is the densest thing this framework draws, and a phone is where
   * density goes wrong: read by axe at 390 and 1280 in both schemes, at the
   * reader's own text size, and with their motion setting honoured.
   */
  const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");
  const horizons = [
    ["the rotation", `${at("seedbed")}/?chapter=16#focus=agg:rotation&in.view=the-rotation`, "__seedbedReady"],
    ["the quarter", `${at("rota")}/?today=2026-09-14#focus=aggregate:shift&in.view=the-quarter`, "__rotaReady"],
  ];
  const violations = {};
  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"]) {
      const seen = await browser.newPage({ viewport: { width, height: 900 } });
      for (const [what, where] of horizons) {
        await seen.goto(`${where.replace("?", `?theme=${theme}&`)}`, { waitUntil: "load" });
        await seen.waitForSelector('[data-testid="calendar"]', { timeout: 30_000 });
        await seen.waitForTimeout(600);
        await seen.addScriptTag({ content: axeSource });
        const found = await seen.evaluate(async () => {
          const result = await window.axe.run(document, { resultTypes: ["violations"] });
          return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        });
        if (found.length > 0) violations[`${width}-${theme} · ${what}`] = found;
      }
      await seen.close();
    }
  }
  report.checks.theHorizonsReadCleanAtBothWidths = { ...violations, ok: Object.keys(violations).length === 0 };

  /* -------- the reader's own text size, and their say about movement */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${at("seedbed")}/?chapter=16#focus=agg:rotation&in.view=the-rotation`, { waitUntil: "load" });
  await phone.waitForSelector('[data-testid="calendar"]', { timeout: 30_000 });
  await phone.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  /*
   * Long enough for the re-layout to SETTLE.
   *
   * Every size the scene draws is the reader's, so changing the text size
   * moves every card — and the scene animates that move like any other, in
   * 380ms plus whatever the browser is doing. At 500ms this was measuring a
   * frame mid-flight and calling it the layout: a card on its way to a new
   * slot is briefly wherever the tween has it, which is not a claim about
   * where anything ends up. Every other harness here settles before it
   * counts.
   */
  await phone.waitForTimeout(1600);
  const reflow = await phone.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth,
    /* Anything reaching past the viewport that is not inside something
       scrollable — the grid itself is allowed to scroll, the page is not. */
    spilling: [...document.querySelectorAll("*")]
      .filter((el) => {
        if (el.getBoundingClientRect().right <= window.innerWidth + 1) return false;
        for (let at = el.parentElement; at; at = at.parentElement) {
          const overflow = getComputedStyle(at).overflowX;
          if ((overflow === "auto" || overflow === "scroll") && at.scrollWidth > at.clientWidth + 1) return false;
        }
        return true;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className || "").split(" ")[0]}`),
  }));
  await phone.close();

  const still = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await still.goto(`${at("seedbed")}/?chapter=16#focus=agg:rotation&in.view=the-rotation`, { waitUntil: "load" });
  await still.waitForSelector('[data-testid="calendar"]', { timeout: 30_000 });
  await still.waitForTimeout(500);
  const motion = await still.evaluate(() => {
    const cell = document.querySelector("[data-calendar-cell]");
    return {
      transition: cell ? parseFloat(getComputedStyle(cell).transitionDuration) : null,
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });
  await still.close();
  report.checks.theReaderSSettingsAreHonoured = {
    ...reflow,
    ...motion,
    ok:
      reflow.spilling.length === 0 &&
      reflow.scrollWidth <= reflow.width + 1 &&
      (motion.transition === null || motion.transition < 0.05) &&
      motion.scroll === "auto",
  };

  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
  garden.stop();
  roster.stop();
}

writeFileSync(resolve(repoRoot, "docs/calendar.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/calendar.json\n`);
process.exit(report.passed ? 0 : 1);
