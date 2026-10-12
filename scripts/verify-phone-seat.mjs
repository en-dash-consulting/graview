#!/usr/bin/env node
/**
 * A PHONE'S SEAT CAN BE PUT AWAY (FR-164) — held to its claims on an
 * emulated iPhone and Pixel, with touch, in Chromium and WebKit, on the
 * scene and on Pages.
 *
 * On a phone the open seat is a bottom sheet. Its grab line read as
 * something to pull down or tap, and neither did anything a person could
 * see: there was no ✕, a tap closed the sheet and put the keyboard back in
 * the field, so the on-screen keyboard stayed up and the next letter opened
 * the sheet again, and the field's 15px text made iOS Safari zoom the page.
 *
 *   closesByTheCross          the ✕ is on the phone's sheet, and a tap on it
 *                             puts the sheet away
 *   closesByATapOnTheGrab     a tap on the grab line puts it away
 *   closesByASwipeDown        a pull down on the top row puts it away (in
 *                             Chromium a real touch drag over CDP, so the
 *                             top row's touch-action is held too; in WebKit
 *                             the same pointer events dispatched); a short,
 *                             slow pull settles back and leaves it open
 *   theKeyboardIsDownAfterClose
 *                             after every close no field holds the
 *                             keyboard, it is not on <body> either, and a
 *                             letter typed then opens nothing
 *   theFieldIsAtLeast16px     the ask field's text is at least 16px, so iOS
 *                             does not zoom when it is focused
 *   theDraftIsKept            words typed and not sent are still in the
 *                             field after the sheet is put away and opened
 *                             again; and where the talk was scrolled to
 *   aReloadedSheetCanBeClosed an open sheet comes back open after a reload
 *                             (the conversation is the tab's), with no
 *                             field focused, and its ✕ puts it away
 *
 *   node scripts/verify-phone-seat.mjs [--engine=chromium|webkit] [--quick]
 *
 * Quick: Chromium on a Pixel and WebKit on an iPhone; otherwise both phones
 * in both engines.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { devices } from "playwright";
import { launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const PHONES = ["iPhone 13", "Pixel 7"];
const RUNS = (QUICK ? [["chromium", "Pixel 7"], ["webkit", "iPhone 13"]] : ["chromium", "webkit"].flatMap((engine) => PHONES.map((phone) => [engine, phone]))).filter(
  ([engine]) => !asked || engine === asked,
);
const DAY = "today=2026-09-01";
const report = { at: new Date().toISOString(), runs: RUNS.map(([engine, phone]) => `${engine} ${phone}`), quick: QUICK, checks: {}, pageErrors: [] };

const cases = {};
const note = (claim, one) => (cases[claim] ??= []).push(one);

const SEAT = '[data-testid="seat"]';
const FIELD = '[data-testid="seat-field"]';
const PANEL = '[data-testid="seat-panel"]';

/** Whether the sheet is open, where the keyboard is, and what the field holds. */
const state = (page) =>
  page.evaluate(() => {
    const now = document.activeElement;
    const field = document.querySelector('[data-testid="seat-field"]');
    return {
      seat: document.querySelector('[data-testid="seat"]')?.getAttribute("data-graview-seat") ?? null,
      shape: document.querySelector('[data-testid="seat"]')?.getAttribute("data-graview-seat-shape") ?? null,
      on: !now || now === document.body ? "body" : (now.getAttribute("data-testid") ?? now.tagName.toLowerCase()),
      typing: Boolean(now?.matches("input,textarea,[contenteditable='true'],[contenteditable='']")),
      draft: field?.value ?? null,
    };
  });

async function visit(page, path) {
  await page.goto(`${at("todo")}${path}`, { waitUntil: "load" });
  await page.waitForSelector(FIELD, { timeout: 120_000 });
  await page.waitForTimeout(1200);
}

async function openIt(page) {
  await page.tap(FIELD);
  await page.waitForSelector(PANEL, { timeout: 30_000 });
  await page.waitForTimeout(400);
}

/** After a close: closed, no field focused, not on <body>; and a letter typed opens nothing. */
async function keyboardDown(page, how, where) {
  const after = await state(page);
  await page.keyboard.type("q");
  await page.waitForTimeout(300);
  const typed = await state(page);
  note("theKeyboardIsDownAfterClose", { at: `${where} by ${how}`, on: after.on, typing: after.typing, thenTyped: typed.seat, ok: after.seat === "closed" && !after.typing && after.on !== "body" && typed.seat === "closed" });
  return after;
}

/**
 * A pull down the top row from the grab line's middle: real touch over CDP in Chromium, dispatched pointer events in WebKit.
 * Says how the sheet stood just before the finger left: it follows the finger, or the browser took the drag for a scroll.
 */
async function pull(page, engine, { by, steps, every }) {
  let followed = null;
  const standing = () => page.$eval('[data-testid="seat"]', (el) => el.style.transform);
  const grab = await page.$eval('[data-testid="seat-grab"]', (el) => {
    const box = el.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  if (engine === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: grab.x, y: grab.y }] });
    for (let step = 1; step <= steps; step++) {
      await page.waitForTimeout(every);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: grab.x, y: grab.y + (by * step) / steps }] });
    }
    followed = await standing();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    followed = await page.evaluate(
      async ({ x, y, by, steps, every }) => {
        const grab = document.querySelector('[data-testid="seat-grab"]');
        const fire = (type, at) => grab.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: "touch", isPrimary: true, button: type === "pointermove" ? -1 : 0, clientX: x, clientY: at }));
        fire("pointerdown", y);
        for (let step = 1; step <= steps; step++) {
          await new Promise((done) => setTimeout(done, every));
          fire("pointermove", y + (by * step) / steps);
        }
        const followed = document.querySelector('[data-testid="seat"]').style.transform;
        fire("pointerup", y + by);
        return followed;
      },
      { ...grab, by, steps, every },
    );
  }
  await page.waitForTimeout(400);
  return followed;
}

let browser;
let vite;
try {
  vite = await serving("todo", portFor("todo"), repoRoot);
  for (const [engine, phone] of RUNS) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    const { defaultBrowserType: _engine, ...device } = devices[phone];
    for (const face of ["scene", "pages"]) {
      const where = `${engine} ${phone} ${face}`;
      const context = await browser.newContext({ ...device, colorScheme: "light" });
      const page = await context.newPage();
      page.on("pageerror", (error) => report.pageErrors.push(`${where}: ${String(error).slice(0, 200)}`));
      const path = face === "scene" ? `/?${DAY}&fresh=1` : `/pages/?${DAY}&fresh=1`;
      try {
        await visit(page, path);
        const shape = await state(page);
        const size = await page.$eval(FIELD, (el) => parseFloat(getComputedStyle(el).fontSize));
        note("theFieldIsAtLeast16px", { at: where, px: size, shape: shape.shape, ok: size >= 16 && shape.shape === "phone" });

        /* ✕. */
        await openIt(page);
        const cross = await page.$eval('[data-testid="seat-close"]', (el) => {
          const box = el.getBoundingClientRect();
          return { shown: box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight, text: el.textContent?.trim() ?? "" };
        }).catch(() => ({ shown: false, text: "" }));
        await page.tap('[data-testid="seat-close"]');
        await page.waitForTimeout(300);
        const byCross = await keyboardDown(page, "✕", where);
        note("closesByTheCross", { at: where, ...cross, seat: byCross.seat, ok: cross.shown && cross.text === "✕" && byCross.seat === "closed" });

        /* A tap on the grab. */
        await openIt(page);
        await page.tap('[data-testid="seat-grab"]');
        await page.waitForTimeout(300);
        const byTap = await keyboardDown(page, "a tap on the grab", where);
        note("closesByATapOnTheGrab", { at: where, seat: byTap.seat, ok: byTap.seat === "closed" });

        /* A short, slow pull settles back; a pull down puts it away. */
        await openIt(page);
        const shortFollowed = await pull(page, engine, { by: 24, steps: 8, every: 60 });
        const settled = await page.evaluate(() => ({
          seat: document.querySelector('[data-testid="seat"]')?.getAttribute("data-graview-seat") ?? null,
          transform: document.querySelector('[data-testid="seat"]')?.style.transform ?? null,
        }));
        const followed = await pull(page, engine, { by: 140, steps: 8, every: 16 });
        const bySwipe = await keyboardDown(page, "a pull down", where);
        const transform = await page.$eval(SEAT, (el) => el.style.transform);
        note("closesByASwipeDown", {
          at: where,
          how: engine === "chromium" ? "touch over CDP" : "pointer events dispatched",
          shortPull: { ...settled, followed: shortFollowed },
          followed,
          seat: bySwipe.seat,
          transform,
          ok: /translateY\(2\dpx\)/.test(shortFollowed ?? "") && settled.seat === "open" && settled.transform === "" && /translateY\(1[34]\dpx\)/.test(followed ?? "") && bySwipe.seat === "closed" && transform === "",
        });

        /* The draft, and where the talk was scrolled to. */
        await openIt(page);
        /* Enough talk that it scrolls. */
        for (const [at, words] of ["what is overdue", "what is here?", "what is due next", "what is here?", "what is overdue"].entries()) {
          if (at >= 2 && (await page.$eval('[data-testid="seat-body"]', (el) => el.scrollHeight - el.clientHeight)) > 60) break;
          await page.fill(FIELD, words);
          await page.press(FIELD, "Enter");
          await page.waitForFunction((n) => document.querySelectorAll('[data-testid="seat-panel"] ol > li').length >= n, 2 * (at + 1), { timeout: 60_000 });
          await page.waitForTimeout(300);
        }
        await page.fill(FIELD, "and after th");
        const scrolled = await page.$eval('[data-testid="seat-body"]', (el) => {
          const room = el.scrollHeight - el.clientHeight;
          el.scrollTop = Math.round(room / 3);
          el.dispatchEvent(new Event("scroll"));
          return { room, top: el.scrollTop };
        });
        await page.waitForTimeout(200);
        await page.tap('[data-testid="seat-close"]');
        await page.waitForTimeout(300);
        const closedWith = await state(page);
        await openIt(page);
        const reopened = await state(page);
        const scrollAfter = await page.$eval('[data-testid="seat-body"]', (el) => el.scrollTop);
        note("theDraftIsKept", {
          at: where,
          closed: closedWith.draft,
          reopened: reopened.draft,
          scroll: { room: scrolled.room, left: scrolled.top, found: scrollAfter },
          ok: closedWith.draft === "and after th" && reopened.draft === "and after th" && scrolled.room > 60 && Math.abs(scrollAfter - scrolled.top) <= 2,
        });

        /* Reloaded open: it is the tab's conversation, and the ✕ is right there. */
        await page.reload({ waitUntil: "load" });
        await page.waitForSelector(FIELD, { timeout: 120_000 });
        await page.waitForSelector(PANEL, { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(800);
        const reloaded = await state(page);
        const closable = (await page.$('[data-testid="seat-close"]')) !== null;
        if (closable) await page.tap('[data-testid="seat-close"]');
        await page.waitForTimeout(300);
        const after = await state(page);
        note("aReloadedSheetCanBeClosed", { at: where, reloaded: reloaded.seat, typing: reloaded.typing, closable, after: after.seat, ok: reloaded.seat === "open" && !reloaded.typing && closable && after.seat === "closed" && !after.typing && after.on !== "body" });
      } catch (error) {
        const why = String(error).split("\n")[0].slice(0, 200);
        for (const claim of ["theFieldIsAtLeast16px", "closesByTheCross", "closesByATapOnTheGrab", "closesByASwipeDown", "theKeyboardIsDownAfterClose", "theDraftIsKept", "aReloadedSheetCanBeClosed"]) {
          if (!(cases[claim] ?? []).some((one) => one.at.startsWith(where))) note(claim, { at: where, why, ok: false });
        }
      }
      await context.close();
    }
    await browser.close();
    browser = undefined;
  }
} catch (error) {
  report.error = String(error?.stack ?? error).slice(0, 2000);
} finally {
  await browser?.close();
  vite?.stop();
}

for (const [claim, all] of Object.entries(cases)) {
  const failing = all.filter((one) => !one.ok);
  report.checks[claim] = { cases: all.length, failing, ok: failing.length === 0 };
}
report.cases = cases;
report.passed = !report.error && Object.keys(report.checks).length > 0 && Object.values(report.checks).every((check) => check.ok) && report.pageErrors.length === 0;
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/phone-seat.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const said = Object.entries(report.checks).map(([name, check]) => `${check.ok ? "ok  " : "FAIL"} ${name} (${check.cases})`).join("\n");
process.stdout.write(`${said}${report.error ? `\n${report.error}` : ""}${report.pageErrors.length ? `\npage errors: ${report.pageErrors.length}` : ""}\n\nwrote docs/phone-seat.json\n`);
process.exit(report.passed ? 0 : 1);
