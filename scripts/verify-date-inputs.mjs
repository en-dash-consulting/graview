#!/usr/bin/env node
/**
 * A DATE AND A DATE AND TIME, GIVEN AS PEOPLE GIVE THEM (Roadmap f-date-inputs).
 *
 * Adding meetings to a small app served by `graview preview`, each start and
 * end was a bare text box that wanted `2026-10-17T15:00:00Z`. This serves the
 * same meetings document the calendar demo syncs (no Google needed) and asks
 * a browser, on both faces:
 *
 *   what people type — "tomorrow 3pm", "Fri 10:30", "17 Oct" — is read as
 *   the day they meant, and said back in words;
 *   the zone it is read in is said, and the store keeps an instant (UTC);
 *   an end moves with its start: an hour after a first start in a form, as
 *   far as the start moved on a record's page, on the scene's card and in
 *   the scene's ask;
 *   the month opens and picks by keyboard alone — Alt+Down or its button,
 *   the arrows, Page Down, Enter — and Escape gives the keyboard back;
 *   the box, the button and every day are named for a screen reader;
 *   on a 390-pixel phone the editor and its month fit, with targets big
 *   enough to hit.
 *
 *   node scripts/verify-date-inputs.mjs [--engine=chromium|webkit|firefox]
 *
 * Writes docs/date-inputs.json.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");
const DOCUMENT = "scripts/fixtures/calendar-sync/meetings.gdd.json";
const report = { at: new Date().toISOString(), engine: ENGINE, document: DOCUMENT, checks: {} };

if (!existsSync(resolve(repoRoot, "packages/graview/dist/preview/index.html"))) {
  process.stderr.write("verify-date-inputs: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

const server = spawn(process.execPath, [CLI, "preview", DOCUMENT, "--port", String(portFor("date-inputs"))], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
let said = "";
server.stdout.on("data", (chunk) => (said += chunk));
server.stderr.on("data", (chunk) => (said += chunk));
const base = at("date-inputs");
const started = Date.now();
for (;;) {
  try {
    if ((await fetch(`${base}/graview/health`)).ok) break;
  } catch {
    // not listening yet
  }
  if (Date.now() - started > 30_000 || server.exitCode !== null) {
    process.stderr.write(`verify-date-inputs: graview preview did not start:\n${said}\n`);
    server.kill();
    process.exit(1);
  }
  await new Promise((ready) => setTimeout(ready, 200));
}

/** The meetings the served store holds, by name: what was kept, not what was drawn. */
async function meetings() {
  const { principal } = await (await fetch(`${base}/graview/document`)).json();
  const { seatHeaders } = await import("../packages/ship/dist/index.js");
  const state = await (await fetch(`${base}/graview/state`, { headers: seatHeaders(principal) })).json();
  return Object.fromEntries((state.snapshot?.nodes ?? []).filter((node) => node.kind === "meeting").map((node) => [node.name, node]));
}
const HOUR = 3_600_000;
const gap = (meeting) => (meeting?.starts && meeting?.ends ? Date.parse(meeting.ends) - Date.parse(meeting.starts) : null);

let browser;
const errors = [];
try {
  browser = await launchEngine(ENGINE);
  const open = async (path, viewport = { width: 1280, height: 900 }) => {
    const page = await browser.newPage({ viewport, colorScheme: "light" });
    page.on("pageerror", (error) => errors.push(`${path}: ${error.message}`));
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true || typeof window.__graviewFailed === "string", null, { timeout: 60_000 });
    await page.waitForTimeout(600);
    return page;
  };
  /** "Add a meeting" opened: it stands open over an empty list, and behind its button once there is a meeting. */
  const addForm = async (page) => {
    const name = page.locator('[data-testid=form-add-meeting] input[name="name"]');
    if (!(await name.isVisible().catch(() => false))) await page.click("[data-testid=act-open-add-meeting]");
    await name.waitFor({ state: "visible", timeout: 10_000 });
    // An opened form puts the keyboard in its first field a beat later: let it, before the keyboard goes anywhere else.
    await page.waitForTimeout(400);
  };
  /** The words a date's box says it read, and the zone it says them in. */
  const reading = (page, box) =>
    page.locator(box).evaluate((input) => {
      const said = input.closest("[data-graview-when]")?.querySelector("[data-graview-part=when-said]");
      return { text: said?.textContent ?? "", zone: said?.getAttribute("data-graview-zone") ?? null, invalid: input.getAttribute("aria-invalid") === "true" };
    });
  /** What the page itself calls a day: the reader's clock, in words. */
  const dayInWords = (page, offset, options) => page.evaluate(([offset, options]) => {
    const at = new Date();
    at.setDate(at.getDate() + offset);
    return new Intl.DateTimeFormat("en-US", options).format(at);
  }, [offset, options]);

  /* ---- the act's form on the pages: phrases read, the zone said, the end an hour on, an instant kept */
  {
    const page = await open("/meetings");
    await addForm(page);
    const form = page.locator("[data-testid=form-add-meeting]");
    const starts = '[data-testid=form-add-meeting] input[name="starts"]';
    const phrases = {};
    await page.fill(starts, "tomorrow 3pm");
    phrases.tomorrow3pm = await reading(page, starts);
    const tomorrow = await dayInWords(page, 1, { weekday: "long", month: "long", day: "numeric" });
    phrases.tomorrow3pm.ok = phrases.tomorrow3pm.text.includes(tomorrow) && phrases.tomorrow3pm.text.includes("3:00 PM");
    await page.fill(starts, "Fri 10:30");
    phrases.fri1030 = await reading(page, starts);
    phrases.fri1030.ok = phrases.fri1030.text.startsWith("Friday") && phrases.fri1030.text.includes("10:30 AM");
    await page.fill(starts, "17 Oct");
    phrases.oct17 = await reading(page, starts);
    phrases.oct17.ok = phrases.oct17.text.includes("October 17");
    await page.fill(starts, "sometime soon");
    phrases.refused = await reading(page, starts);
    phrases.refused.ok = phrases.refused.invalid && phrases.refused.text.startsWith("Not a date this reads");
    report.checks.whatPeopleTypeIsReadAsTheDayTheyMeant = { phrases, ok: Object.values(phrases).every((one) => one.ok) };

    await form.locator('input[name="name"]').fill("Planning");
    await page.fill(starts, "tomorrow 3pm");
    const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    const told = await reading(page, starts);
    const endsBox = await form.locator('input[name="ends"]').inputValue();
    await form.locator("[data-graview-part=submit]").click();
    await page.waitForTimeout(600);
    const kept = (await meetings())["Planning"];
    report.checks.theZoneIsSaidAndAnInstantIsKept = {
      zone,
      said: told.text,
      saidZone: told.zone,
      starts: kept?.starts ?? null,
      ok: told.zone === zone && /\b[A-Z]{2,5}\b|GMT/.test(told.text.split(" PM ")[1] ?? "") && /Z$/.test(kept?.starts ?? ""),
    };
    report.checks.aFirstStartPutsTheEndAnHourOnInAForm = { endsBox, gap: gap(kept), ok: endsBox.includes("4:00 PM") && gap(kept) === HOUR };
    await page.close();
  }

  /* ---- a record's page: the start moved in place carries the end with it, the keyboard back on the value */
  {
    const page = await open("/meetings/meeting%3Aplanning");
    const before = (await meetings())["Planning"];
    await page.locator("button[data-graview-field=starts]").first().click();
    const box = "[data-graview-when] input";
    await page.waitForSelector(box);
    const chosenWhole = await page.locator(box).evaluate((input) => input.selectionStart === 0 && input.selectionEnd === input.value.length);
    await page.keyboard.type("1 Dec 2026 9am");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const after = (await meetings())["Planning"];
    const focus = await page.evaluate(() => document.activeElement?.getAttribute("data-graview-field"));
    report.checks.aStartMovedOnTheRecordPageCarriesItsEnd = {
      chosenWhole,
      starts: after?.starts,
      gapBefore: gap(before),
      gapAfter: gap(after),
      focus,
      ok: chosenWhole && new Date(after?.starts).getHours() === 9 && new Date(after?.starts).getDate() === 1 && gap(after) === gap(before) && focus === "starts",
    };
    await page.close();
  }

  /* ---- the month, by keyboard alone; and every part named for a screen reader */
  {
    const page = await open("/meetings");
    await addForm(page);
    const starts = '[data-testid=form-add-meeting] input[name="starts"]';
    await page.fill(starts, "17 Oct 2026 2pm");
    await page.focus(starts);
    await page.keyboard.press("Alt+ArrowDown");
    await page.waitForSelector("[data-graview-part=when-month] [role=grid]", { timeout: 10_000 });
    await page.waitForTimeout(200);
    const first = await page.evaluate(() => document.activeElement?.getAttribute("data-day"));
    await page.keyboard.press("ArrowRight");
    const right = await page.evaluate(() => document.activeElement?.getAttribute("data-day"));
    await page.keyboard.press("ArrowDown");
    const down = await page.evaluate(() => document.activeElement?.getAttribute("data-day"));
    await page.keyboard.press("PageDown");
    const nextMonth = await page.evaluate(() => document.activeElement?.getAttribute("data-day"));
    const named = await page.evaluate(() => {
      const box = document.querySelector('[data-testid=form-add-meeting] input[name="starts"]');
      const described = document.getElementById(box.getAttribute("aria-describedby") ?? "");
      const pick = box.closest("[data-graview-when]").querySelector("[data-graview-part=when-pick]");
      const grid = document.querySelector("[data-graview-part=when-month] [role=grid]");
      const title = document.getElementById(grid.getAttribute("aria-labelledby") ?? "");
      const days = [...grid.querySelectorAll("button[data-day]")];
      return {
        box: box.getAttribute("aria-label"),
        describedLive: described?.getAttribute("aria-live") ?? null,
        pick: pick.getAttribute("aria-label"),
        expanded: pick.getAttribute("aria-expanded"),
        grid: title?.textContent ?? null,
        day: document.activeElement?.getAttribute("aria-label") ?? null,
        tabStops: days.filter((day) => day.tabIndex === 0).length,
        everyDayNamed: days.every((day) => /\d{4}/.test(day.getAttribute("aria-label") ?? "")),
      };
    });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const picked = await reading(page, starts);
    const backInBox = await page.evaluate(() => document.activeElement?.getAttribute("name"));
    report.checks.theMonthPicksByKeyboardAndKeepsTheTime = {
      first,
      right,
      down,
      nextMonth,
      picked: picked.text,
      backInBox,
      ok: first === "2026-10-17" && right === "2026-10-18" && down === "2026-10-25" && nextMonth === "2026-11-25" && picked.text.includes("November 25, 2026") && picked.text.includes("2:00 PM") && backInBox === "starts",
    };
    // Escape closes the month and gives the keyboard to the button that opened it.
    await page.locator(`${starts} >> xpath=..`).locator("[data-graview-part=when-pick]").click();
    await page.waitForSelector("[data-graview-part=when-month] [role=grid]");
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const escaped = await page.evaluate(() => ({ open: document.querySelector("[data-graview-part=when-month]") !== null, focus: document.activeElement?.getAttribute("data-graview-part") ?? null }));
    report.checks.escapeClosesTheMonthAndGivesTheKeyboardBack = { ...escaped, ok: !escaped.open && escaped.focus === "when-pick" };
    report.checks.theEditorIsNamedForAScreenReader = {
      ...named,
      ok: named.box === "Starts" && named.describedLive === "polite" && named.pick === "Pick a date for Starts" && named.expanded === "true" && named.grid === "November 2026" && /^Wednesday, November 25, 2026/.test(named.day ?? "") && named.tabStops === 1 && named.everyDayNamed,
    };
    await page.close();
  }

  /* ---- the scene: the card's value changed in place, and the act's ask, both with the same editor */
  {
    const page = await open("/#focus=meeting%3Aplanning");
    await page.waitForSelector('[data-graview-view="meeting:planning"] button[data-graview-field=starts]', { timeout: 30_000 });
    const before = (await meetings())["Planning"];
    await page.locator('[data-graview-view="meeting:planning"] button[data-graview-field=starts]').click();
    await page.waitForSelector('[data-graview-view="meeting:planning"] [data-graview-when] input');
    await page.keyboard.type("2 Dec 2026 11am");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const inPlace = (await meetings())["Planning"];
    report.checks.theScenesCardMovesTheStartAndItsEnd = {
      starts: inPlace?.starts,
      gapBefore: gap(before),
      gapAfter: gap(inPlace),
      ok: new Date(inPlace?.starts).getDate() === 2 && new Date(inPlace?.starts).getHours() === 11 && gap(inPlace) === gap(before),
    };

    const card = await page.locator('[data-graview-view="meeting:planning"] [data-graview-variant=card]').boundingBox();
    await page.mouse.click(card.x + card.width - 60, card.y + card.height - 20, { button: "right" });
    await page.waitForSelector('[data-testid="context-menu"] [data-pin-for="edit-meeting"]', { timeout: 10_000 });
    await page.click('[data-testid="context-menu"] li:has([data-pin-for="edit-meeting"]) button[data-affordance]');
    await page.waitForSelector("[data-graview-asking]");
    const steps = [];
    for (let turn = 0; turn < 8 && (await page.$("[data-graview-asking]")) !== null; turn++) {
      const ask = page.locator("[data-graview-asking]");
      const input = ask.locator("form input, form textarea").first();
      const name = (await input.count()) ? await input.getAttribute("name") : null;
      const editor = await ask.locator("[data-graview-when]").count();
      const held = (await input.count()) ? await input.inputValue() : "";
      steps.push({ name, editor, held });
      if (name === "starts") await input.fill("tomorrow 2pm");
      if (name === "where" || name === "notes") {
        await ask.getByRole("button", { name: "Skip" }).click();
      } else await input.press("Enter");
      await page.waitForTimeout(300);
    }
    const asked = (await meetings())["Planning"];
    const endStep = steps.find((step) => step.name === "ends");
    const expectedEnd = await page.evaluate((gapMs) => {
      const at = new Date();
      at.setDate(at.getDate() + 1);
      at.setHours(14, 0, 0, 0);
      return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(at.getTime() + gapMs)).replace(/ /g, " ");
    }, gap(inPlace));
    report.checks.theScenesAskUsesTheEditorAndTheEndFollows = {
      steps,
      expectedEnd,
      gap: gap(asked),
      ok: steps.filter((step) => step.name === "starts" || step.name === "ends").every((step) => step.editor === 1) && (endStep?.held ?? "").includes(expectedEnd) && gap(asked) === gap(inPlace) && new Date(asked?.starts).getHours() === 14,
    };
    await page.close();
  }

  /* ---- a 390-pixel phone: the editor and its month fit, every target big enough to hit */
  {
    const page = await open("/meetings", { width: 390, height: 844 });
    await addForm(page);
    const starts = '[data-testid=form-add-meeting] input[name="starts"]';
    await page.fill(starts, "tomorrow 3pm");
    await page.locator(`${starts} >> xpath=..`).locator("[data-graview-part=when-pick]").click();
    await page.waitForSelector("[data-graview-part=when-month] [role=grid]");
    await page.waitForTimeout(200);
    const fit = await page.evaluate(() => {
      const month = document.querySelector("[data-graview-part=when-month]").getBoundingClientRect();
      const box = document.querySelector('[data-testid=form-add-meeting] input[name="starts"]').getBoundingClientRect();
      const targets = [...document.querySelectorAll("[data-graview-part=when-month] button, [data-graview-part=when-pick]")].map((one) => one.getBoundingClientRect());
      return {
        scrollWidth: document.documentElement.scrollWidth,
        month: { left: Math.round(month.left), right: Math.round(month.right) },
        box: { left: Math.round(box.left), right: Math.round(box.right) },
        smallest: Math.round(Math.min(...targets.map((one) => Math.min(one.width, one.height)))),
      };
    });
    report.checks.aPhoneFitsTheEditorAndItsMonth = { ...fit, ok: fit.scrollWidth <= 390 && fit.month.left >= 0 && fit.month.right <= 390 && fit.box.right <= 390 && fit.smallest >= 24 };
    await page.close();
  }

  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  server.kill();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/date-inputs.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/date-inputs.json\n");
process.exit(report.passed ? 0 : 1);
