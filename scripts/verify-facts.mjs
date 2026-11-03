#!/usr/bin/env node
/**
 * A RECORD'S FACTS, EACH DRAWN AND CHANGED BY ITS TYPE (Roadmap
 * f-facts-by-type).
 *
 * On a task's page in the example (its own design over the framework's
 * sheet) and on a talk's page in the gauntlet (the framework's own record
 * page), at a desk and on a phone, light and dark, in three engines, it asks:
 *
 *   a yes or no is a switch, toggled in place and taken back with Undo;
 *   an empty date says "Pick a day" and is given one through the date editor;
 *   an empty note says "Add notes" and is filled where it stands;
 *   a choice of a few is its options, changed with one press;
 *   the list a task is on is a chip, changed from its own picker;
 *   the heading renames in place;
 *   a change the store refuses is said beside its field, and the value kept;
 *   "What can be done" lists no act a fact's own control already does;
 *   a desk sets each label beside its value, a phone above it, and nothing
 *   scrolls sideways — in both schemes.
 *
 * Every page it opens is also judged by the watch (`lib/watch.mjs`).
 *
 *   node scripts/verify-facts.mjs [--engine=chromium|webkit|firefox] [--quick] [--headed]
 *
 * Writes docs/facts.json.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const DESK = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 844 };
const SCHEMES = QUICK ? ["dark"] : ["light", "dark"];
const TASK = "/pages/tasks/t-paint?today=2026-09-01";
/** The chair, who may change a talk; the gauntlet's seats are ids, never names. */
const TALK_ID = "talk:memory-safety-without-garbage-collection-a-field-report-on-an-airline-s-booking-engine";
const TALK = `/pages/talks/${encodeURIComponent(TALK_ID)}?as=u-4f1c9a`;

const report = { at: new Date().toISOString(), engines, checks: {} };
const errors = [];
const seen = {
  yesNo: [],
  date: [],
  note: [],
  choice: [],
  chip: [],
  title: [],
  refused: [],
  acts: [],
  layout: [],
};

async function until(page, check, timeout = 10_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > end) return false;
    await page.waitForTimeout(100);
  }
}

const FACTS = '[data-testid="record-fields"]';
const textOf = (page, selector) => page.evaluate((one) => document.querySelector(one)?.textContent?.trim() ?? null, selector);
const actsOf = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="record-actions"] [data-affordance]')].map((button) => button.textContent?.replace("…", "").trim()));

const todo = await serving("todo", portFor("todo"), repoRoot);
const gauntlet = await serving("gauntlet", portFor("gauntlet"), repoRoot);
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    const open = async (base, path, { viewport = DESK, scheme = "dark" } = {}) => {
      const context = await browser.newContext({ viewport, locale: "en-US", colorScheme: scheme });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${engine} ${path}: ${error.message}`));
      await page.goto(`${base}${path}${path.includes("?") ? "&" : "?"}theme=${scheme}`, { waitUntil: "load" });
      await page.waitForSelector(FACTS, { timeout: 60_000 });
      await page.waitForTimeout(300);
      return { page, close: () => context.close() };
    };
    const attempt = async (list, base, path, run, options) => {
      let opened;
      try {
        opened = await open(base, path, options);
        list.push({ engine, ...(options ?? {}), ...(await run(opened.page)) });
      } catch (error) {
        list.push({ engine, error: String(error.message ?? error).split("\n")[0] });
      }
      await opened?.close();
    };

    /* A YES OR NO: a switch, toggled where it stands, taken back with Undo. */
    await attempt(seen.yesNo, at("todo"), TASK, async (page) => {
      const toggle = `${FACTS} [role="switch"][data-graview-field="done"]`;
      const before = await page.getAttribute(toggle, "aria-checked");
      const name = await page.getAttribute(toggle, "aria-label");
      // The same control after the change: marked before, found after (a control drawn again would drop the keyboard).
      await page.evaluate((one) => document.querySelector(one)?.setAttribute("data-facts-marked", ""), toggle);
      await page.click(toggle);
      await until(page, async () => (await page.getAttribute(toggle, "aria-checked")) === "true", 3000);
      const after = await page.getAttribute(toggle, "aria-checked");
      const sameControl = await page.evaluate((one) => document.querySelector(one)?.hasAttribute("data-facts-marked") === true, toggle);
      // The way back the face offers after an act, else the key it answers.
      const undo = page.locator('[data-testid="page-undo"]');
      const offered = await until(page, async () => (await undo.count()) > 0 && (await undo.first().isVisible()), 3000);
      if (offered) await undo.first().click();
      else await page.keyboard.press("ControlOrMeta+z");
      await until(page, async () => (await page.getAttribute(toggle, "aria-checked")) === "false", 3000);
      const undone = await page.getAttribute(toggle, "aria-checked");
      // And from the keyboard: Space on the switch toggles it, and the keyboard stays on it.
      await page.focus(toggle);
      await page.keyboard.press("Space");
      await until(page, async () => (await page.getAttribute(toggle, "aria-checked")) === "true", 3000);
      const byKey = await page.getAttribute(toggle, "aria-checked");
      const keyboardStays = await page.evaluate((one) => document.activeElement === document.querySelector(one), toggle);
      return { before, name, after, sameControl, offered, undone, byKey, keyboardStays };
    });

    /* AN EMPTY DATE: "Pick a day", given one through the date editor. */
    await attempt(seen.date, at("todo"), TASK, async (page) => {
      const slot = `${FACTS} [data-graview-blank-fact="due"] button[data-graview-blank]`;
      const words = await textOf(page, slot);
      await page.click(slot);
      const opened = await until(page, () => page.evaluate(() => document.activeElement?.closest('[data-graview-fact="due"]') != null && document.activeElement?.tagName === "INPUT"), 5000);
      if (opened) {
        await page.keyboard.type("4 Sep 2026");
        await page.keyboard.press("Enter");
      }
      await until(page, () => page.evaluate(() => document.querySelector('[data-graview-blank-fact="due"]') === null), 5000);
      const said = await textOf(page, `${FACTS} button[data-graview-field="due"]`);
      return { words, opened, said };
    });

    /* AN EMPTY NOTE: "Add notes", filled where it stands. */
    await attempt(seen.note, at("todo"), TASK, async (page) => {
      const slot = `${FACTS} [data-graview-blank-fact="notes"] button[data-graview-blank]`;
      const words = await textOf(page, slot);
      await page.click(slot);
      const box = `${FACTS} [data-graview-fact="notes"] input, ${FACTS} [data-graview-fact="notes"] textarea`;
      const opened = await until(page, async () => (await page.locator(box).count()) > 0, 5000);
      if (opened) {
        await page.locator(box).first().fill("Use the satin finish");
        await page.keyboard.press("Enter");
      }
      await until(page, async () => (await textOf(page, `${FACTS} [data-graview-field="notes"]`)) === "Use the satin finish", 5000);
      return { words, opened, said: await textOf(page, `${FACTS} [data-graview-field="notes"]`) };
    });

    /* THE LIST IT IS ON: a chip that opens the list, changed from its own picker. */
    await attempt(seen.chip, at("todo"), TASK, async (page) => {
      const row = `${FACTS} [data-graview-relation="holds"]`;
      const label = await textOf(page, `${row} dt`);
      const before = await textOf(page, `${row} [data-graview-chip] a`);
      const href = await page.getAttribute(`${row} [data-graview-chip] a`, "href");
      const caret = `${row} [data-graview-relation-set]`;
      const caretName = await page.getAttribute(caret, "aria-label");
      await page.click(caret);
      const offered = await until(page, async () => (await page.locator(`${row} [data-graview-candidate]`).count()) > 0, 5000);
      const candidates = await page.evaluate((one) => [...document.querySelectorAll(`${one} [data-graview-candidate]`)].map((button) => button.textContent), row);
      if (offered) await page.locator(`${row} [data-graview-candidate]`, { hasText: "This week" }).click();
      await until(page, async () => (await textOf(page, `${row} [data-graview-chip] a`)) === "This week", 5000);
      const after = await textOf(page, `${row} [data-graview-chip] a`);
      const keyboardHome = await page.evaluate((one) => document.activeElement?.closest(one) != null, row);
      return { label, before, href, caretName, candidates, after, keyboardHome };
    });

    /* WHAT CAN BE DONE: nothing a fact's own control already does. */
    await attempt(seen.acts, at("todo"), TASK, async (page) => ({ app: "todo", acts: await actsOf(page) }));
    await attempt(seen.acts, at("gauntlet"), TALK, async (page) => ({ app: "gauntlet", acts: await actsOf(page) }));

    /* A CHOICE OF A FEW: its options, one press to change. */
    await attempt(seen.choice, at("gauntlet"), TALK, async (page) => {
      const group = `${FACTS} [role="group"][data-graview-field="format"]`;
      const name = await page.getAttribute(group, "aria-label");
      const options = await page.evaluate((one) => [...document.querySelectorAll(`${one} button`)].map((button) => [button.textContent, button.getAttribute("aria-pressed")]), group);
      await page.click(`${group} button[data-graview-option="keynote"]`);
      await until(page, async () => (await page.getAttribute(`${group} button[data-graview-option="keynote"]`, "aria-pressed")) === "true", 3000);
      return { name, options, pressed: await page.getAttribute(`${group} button[data-graview-option="keynote"]`, "aria-pressed") };
    });

    /* THE HEADING RENAMES IN PLACE, and is not said again among the facts. */
    await attempt(seen.title, at("gauntlet"), TALK, async (page) => {
      const heading = '[data-graview-page-title] button[data-graview-field="title"]';
      const control = (await page.locator(heading).count()) > 0;
      const factToo = (await page.locator(`${FACTS} [data-graview-fact="title"]`).count()) > 0;
      if (control) {
        await page.click(heading);
        await page.locator('[data-graview-page-title] input[data-graview-field="title"]').fill("Memory Safety, Reconsidered");
        await page.keyboard.press("Enter");
      }
      await until(page, async () => (await textOf(page, "[data-graview-page-title]")) === "Memory Safety, Reconsidered", 5000);
      return { control, factToo, said: await textOf(page, "[data-graview-page-title]") };
    });

    /* A REFUSAL, SAID BESIDE ITS FIELD: a length past its longest. */
    await attempt(seen.refused, at("gauntlet"), TALK, async (page) => {
      const value = `${FACTS} button[data-graview-field="minutes"]`;
      const before = await textOf(page, value);
      await page.click(value);
      await page.locator(`${FACTS} input[data-graview-field="minutes"]`).fill("999");
      await page.keyboard.press("Enter");
      const said = await until(page, async () => (await page.locator(`${FACTS} [data-graview-refused="minutes"]`).count()) > 0, 5000);
      const where = await page.evaluate(() => {
        const refusal = document.querySelector('[data-graview-refused="minutes"]');
        return { inItsRow: refusal?.closest('[data-graview-fact="minutes"]') != null, words: refusal?.textContent ?? "", visible: (refusal?.getBoundingClientRect().width ?? 0) > 0 };
      });
      return { before, said, ...where, after: await textOf(page, value) };
    });

    /* THE SHEET: a label beside its value at a desk, above it on a phone; nothing sideways; both schemes. */
    for (const scheme of SCHEMES) {
      for (const [where, viewport] of [["desk", DESK], ["phone", PHONE]]) {
        for (const [app, base, path] of [["todo", at("todo"), TASK], ["gauntlet", at("gauntlet"), TALK]]) {
          await attempt(seen.layout, base, path, async (page) => ({
            app,
            where,
            ...(await page.evaluate(() => {
              const rows = [...document.querySelectorAll("[data-graview-sheet] > div")].map((row) => {
                const label = row.querySelector(":scope > dt")?.getBoundingClientRect();
                const value = row.querySelector(":scope > dd")?.getBoundingClientRect();
                return label && value ? { beside: label.right <= value.left + 1 && Math.abs(label.top - value.top) < 14, above: label.bottom <= value.top + 2 } : undefined;
              }).filter(Boolean);
              return {
                rows: rows.length,
                beside: rows.filter((row) => row.beside).length,
                above: rows.filter((row) => row.above).length,
                sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
                scheme: document.documentElement.getAttribute("data-graview-scheme") ?? document.documentElement.style.colorScheme ?? "",
              };
            })),
          }), { viewport, scheme });
        }
      }
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  if (browser) await browser.close();
  todo.stop();
  gauntlet.stop();
}

const all = (list, claim, count = engines.length) => list.length === count && list.every((one) => !one.error && claim(one));
const FOLDED_TODO = ["Mark it done", "Put it back", "Move the date", "Move it to another list", "Rename", "This has to happen first"];
const FOLDED_TALK = ["Accept it", "Turn it down", "Withdraw it", "Add a presenter", "Drop a presenter", "Say who proposed it", "Say what it is about", "Say it is not about that"];
report.checks.aYesOrNoIsASwitchToggledInPlaceAndTakenBack = {
  seen: seen.yesNo,
  ok: all(seen.yesNo, (one) => one.before === "false" && one.name === "Finished" && one.after === "true" && one.sameControl && one.undone === "false" && one.byKey === "true" && one.keyboardStays),
};
report.checks.anEmptyDateIsPickedThroughTheDateEditor = {
  seen: seen.date,
  // Said against the day the app judges by (`?today=2026-09-01`): its weekday and how far it is.
  ok: all(seen.date, (one) => one.words === "Pick a day" && one.opened && one.said === "Fri, Sep 4 · in 3 days"),
};
report.checks.anEmptyNoteIsFilledWhereItStands = {
  seen: seen.note,
  ok: all(seen.note, (one) => one.words === "Add notes" && one.opened && one.said === "Use the satin finish"),
};
report.checks.aChoiceOfAFewIsItsOptions = {
  seen: seen.choice,
  ok: all(seen.choice, (one) => one.name === "Format" && one.options.length === 4 && one.options.filter(([, pressed]) => pressed === "true").length === 1 && one.pressed === "true"),
};
report.checks.theListATaskIsOnIsAChipChangedFromItsPicker = {
  seen: seen.chip,
  ok: all(seen.chip, (one) => one.label === "The list it is on" && one.before === "Someday" && one.href?.endsWith("/lists/someday") && one.caretName === "Move it to another list" && one.candidates.includes("This week") && !one.candidates.includes("Someday") && one.after === "This week" && one.keyboardHome),
};
report.checks.theHeadingRenamesInPlace = {
  seen: seen.title,
  ok: all(seen.title, (one) => one.control && !one.factToo && one.said === "Memory Safety, Reconsidered"),
};
report.checks.aRefusedChangeIsSaidBesideItsField = {
  seen: seen.refused,
  ok: all(seen.refused, (one) => one.said && one.inItsRow && one.visible && one.words === "Length is at most 180; it keeps 25 min." && one.after === one.before),
};
report.checks.whatCanBeDoneListsNoActAFactAlreadyDoes = {
  seen: seen.acts,
  ok: all(
    seen.acts,
    (one) => one.acts.length > 0 && !one.acts.some((act) => (one.app === "todo" ? FOLDED_TODO : FOLDED_TALK).includes(act)) && (one.app === "todo" ? one.acts.includes("Block time for it") : one.acts.includes("Give it a slot")),
    engines.length * 2,
  ),
};
report.checks.aDeskSetsLabelsBesideValuesAPhoneAboveThemInBothSchemes = {
  seen: seen.layout,
  ok: all(seen.layout, (one) => one.rows >= 4 && !one.sideways && (one.where === "desk" ? one.beside === one.rows : one.above === one.rows), engines.length * SCHEMES.length * 4),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/facts.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/facts.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
