#!/usr/bin/env node
/**
 * THE SEAT IS A ROBOT IN THE CITY, held to its claims in a real browser.
 *
 * Docked at its dock on open; a one-press turn moves it to the kind it
 * wrote; follow mode moves it with the pointer and makes "this" the hovered
 * task in a chat reply; a refused proposal parks it at the gate with the
 * refusal in its bubble; undo walks it home; nothing animates on a quiet
 * city three seconds after load; and the keyboard reaches it: Tab, Space
 * to follow, Escape to release.
 *
 *   node scripts/verify-robot.mjs [--engine=chromium|webkit|firefox]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let browser;
let vite;

const robot = (page) =>
  page.evaluate(() => {
    const figure = document.querySelector('[data-graview-figure="agent:tidy:ui"]');
    if (!figure) return null;
    const ground = document.querySelector(".graview-ground").getBoundingClientRect();
    const box = figure.querySelector(".graview-figure-body").getBoundingClientRect();
    return {
      mode: figure.getAttribute("data-graview-mode"),
      at: figure.getAttribute("data-graview-at"),
      x: Math.round(box.x + box.width / 2 - ground.left),
      y: Math.round(box.y + box.height - ground.top),
      bubble: figure.querySelector('[data-testid="figure-bubble"]')?.textContent?.trim() ?? null,
      label: figure.querySelector("button")?.getAttribute("aria-label") ?? null,
    };
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  vite = await serving("todo", 5193, repoRoot);
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  report.pageErrors = [];
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1#overview=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);

  /* ------------------------------------------------- docked on open */
  const docked = await robot(page);
  report.checks.dockedOnOpen = { ...docked, ok: docked !== null && docked.mode === "docked" && docked.at === "" };

  /* --------------------------------------- quiet: nothing animating */
  await sleep(3000);
  const quiet = await page.evaluate(() => ({
    animations: document.getAnimations().filter((a) => a.playState === "running").length,
    listeners: document.querySelector(".graview-ground")?.__graviewPointer ? 1 : 0,
  }));
  report.checks.quietCityRunsNothing = { ...quiet, ok: quiet.animations === 0 && quiet.listeners === 0 };

  /* --------------------------------- a one-press turn moves it to the kind */
  const before = await robot(page);
  await page.click('[data-testid="activity-button"]').catch(() => {});
  await page.waitForTimeout(300);
  const seat = await page.$('[data-testid="agent-tidy"]');
  const enabled = seat ? !(await seat.isDisabled()) : false;
  let after = before;
  if (enabled) {
    await seat.click();
    await page.waitForTimeout(250);
    after = await robot(page);
  }
  const wroteTasks = after !== null && (after.at.startsWith("t-") || after.at === "kind:task");
  report.checks.aTurnMovesItToWhatItWrote = {
    enabled,
    before: before && { x: before.x, y: before.y, at: before.at },
    after: after && { x: after.x, y: after.y, at: after.at, mode: after.mode },
    ok: enabled && wroteTasks && (after.x !== before.x || after.y !== before.y),
  };
  await page.waitForTimeout(3200);
  const rested = await robot(page);
  report.checks.itWalksHomeAfterTheHold = { mode: rested?.mode, ok: rested?.mode === "docked" };

  /* ------------------------------------------ undo walks it home too */
  if (enabled) {
    await seat.click().catch(() => {});
    await page.waitForTimeout(250);
    const undo = await page.$('[data-testid="undo-turn"], button[aria-label^="Undo"], button:has-text("Undo")');
    if (undo) {
      await undo.click();
      await page.waitForTimeout(250);
      const home = await robot(page);
      report.checks.undoWalksItHome = { mode: home?.mode, ok: home?.mode === "docked" };
    } else report.checks.undoWalksItHome = { ok: false, why: "no undo control found" };
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  /* ------------------------------------------------- follow the pointer */
  await page.click('[data-graview-figure="agent:tidy:ui"] .graview-figure-body');
  await page.waitForTimeout(200);
  const ground = await page.$eval(".graview-ground", (el) => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, width: b.width, height: b.height };
  });
  await page.mouse.move(ground.left + 300, ground.top + 300);
  await page.waitForTimeout(600);
  const at300 = await robot(page);
  await page.mouse.move(ground.left + 900, ground.top + 500);
  await page.waitForTimeout(600);
  const at900 = await robot(page);
  report.checks.followModeTrailsThePointer = {
    mode: at900?.mode,
    at300: at300 && { x: at300.x, y: at300.y },
    at900: at900 && { x: at900.x, y: at900.y },
    ok: at300?.mode === "following" && at900 !== null && at300 !== null && at900.x > at300.x + 300,
  };
  /* "This" is the hovered task: open the tasks district so its members stand as buildings, hover one, ask about "this". */
  await page.click('[data-testid="open-task"]').catch(() => {});
  await page.waitForTimeout(700);
  const chip = await page.$('[data-graview-pick="t-deposit"]');
  let thisIsTheHovered = { ok: false, why: "no t-deposit pick on screen" };
  if (chip) {
    const cb = await chip.boundingBox();
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.waitForTimeout(500);
    const over = await page.evaluate(() => document.querySelector('[data-graview-figure="agent:tidy:ui"]')?.getAttribute("data-graview-at"));
    const anchor = await page.evaluate(() => document.querySelector('[data-testid="chat-panel"]')?.getAttribute("data-graview-anchor") ?? null);
    await page.fill('[aria-label="Message the seat"]', "tell me about this");
    await page.press('[aria-label="Message the seat"]', "Enter");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-panel"] ol li').length >= 2, undefined, { timeout: 15_000 });
    const reply = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-testid="chat-panel"] ol li')];
      return rows[rows.length - 1]?.textContent ?? "";
    });
    thisIsTheHovered = { over, anchor, reply: reply.slice(0, 120), ok: anchor === "figure" && /deposit/i.test(reply) };
  }
  report.checks.thisIsTheHoveredTask = thisIsTheHovered;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const released = await robot(page);
  report.checks.escapeReleases = { mode: released?.mode, ok: released?.mode !== "following" };

  /* ------------------------------------------------- keyboard: Tab, Space */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1#overview=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.closest?.("[data-graview-figure]") !== null);
  }
  if (reached) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }
  const viaKeys = await robot(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const afterEscape = await robot(page);
  report.checks.keyboardReachesIt = { reached, follows: viaKeys?.mode === "following", releases: afterEscape?.mode !== "following", ok: reached && viaKeys?.mode === "following" && afterEscape?.mode !== "following" };

  /* --------------------------------- a refused proposal parks it at the gate */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1&as=user-sam#overview=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  await page.click('[data-testid="chat"]');
  await page.waitForSelector('[data-testid="chat-panel"]');
  await page.fill('[aria-label="Message the seat"]', "give a role keeper to Sam");
  await page.press('[aria-label="Message the seat"]', "Enter");
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-panel"] ol li').length >= 2, undefined, { timeout: 15_000 });
  await page.waitForTimeout(400);
  const refusalReply = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="chat-panel"] ol li')];
    return rows[rows.length - 1]?.textContent?.slice(0, 160) ?? "";
  });
  const parked = await page.evaluate(() => {
    const figure = document.querySelector('[data-graview-figure^="agent:"][data-graview-mode="refused"]');
    return figure ? { at: figure.getAttribute("data-graview-at"), bubble: figure.querySelector('[data-testid="figure-bubble"]')?.textContent?.trim() ?? "" } : null;
  });
  const withheld = await page.evaluate(() => document.querySelector('[data-testid="chat-withheld"]')?.textContent?.trim() ?? null);
  report.checks.aRefusalIsSaidAtTheGate = {
    reply: refusalReply,
    parked,
    withheld: withheld?.slice(0, 100),
    ok: parked !== null && parked.bubble.length > 0 && (withheld === null || parked.bubble.includes(withheld.split(" — ").pop()?.slice(0, 20) ?? "")),
  };

  report.passed = Object.values(report.checks).every((check) => check.ok) && report.pageErrors.length === 0;
} catch (error) {
  report.error = String(error).slice(0, 600);
  report.passed = false;
} finally {
  await browser?.close();
  vite?.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/robot.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/robot.json\n`);
process.exit(report.passed ? 0 : 1);
