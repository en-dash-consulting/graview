#!/usr/bin/env node
/**
 * WHO IS WHERE, held to its claims in a real browser: two tabs of one
 * origin — two pages in one context share a BroadcastChannel — sat down
 * as two different people.
 *
 * B sees A's figure at the tasks plot when A focuses the tasks drive-in;
 * A picks a showing and moves to the audience row on B; A runs a turn and
 * A's robot appears on B captioned as hers; A shares what she points at
 * and B sees the outline; B clicks A and B's URL follows A's until Escape;
 * A closes and is gone within the TTL.
 *
 *   node scripts/verify-who.mjs [--engine=chromium|webkit|firefox]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { PRESENCE_TTL_MS } = await import(resolve(repoRoot, "packages/core/dist/index.js"));
const ENGINE = engineName();
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {}, pageErrors: [] };
let browser;
let vite;

const NORA = "user-nora";
const SAM = "user-sam";
const BASE = "http://localhost:5193/?today=2026-09-01";

/** The figure B draws for a participant, if any. */
const figureOf = (page, id) =>
  page.evaluate((who) => {
    const figure = document.querySelector(`[data-graview-figure^="human:${who}:"]`);
    if (!figure) return null;
    return {
      at: figure.getAttribute("data-graview-at"),
      audience: figure.hasAttribute("data-graview-audience"),
      followed: figure.hasAttribute("data-graview-followed"),
      name: figure.querySelector(".graview-figure-name")?.textContent?.trim() ?? null,
    };
  }, id);
/** Everything B draws for the others, for the report to say when a figure is missing. */
const others = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-graview-figure], [data-testid="presence-edge"], [data-testid="presence-count"]')].map((el) => ({
      figure: el.getAttribute("data-graview-figure"),
      person: el.getAttribute("data-graview-person"),
      at: el.getAttribute("data-graview-at"),
      text: (el.textContent ?? "").trim().slice(0, 30),
    })),
  );
const open = async (context, as, hash) => {
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(`${as}: ${String(error).slice(0, 200)}`));
  await page.goto(`${BASE}&fresh=1&as=${as}${hash}`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  return page;
};
const go = async (page, hash) => {
  await page.evaluate((next) => {
    location.hash = next;
  }, hash);
  await page.waitForTimeout(1300);
};

try {
  vite = await serving("todo", 5193, repoRoot);
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  const a = await open(context, NORA, "#overview=1&focus=aggregate%3Atask");
  const b = await open(context, SAM, "#overview=1&focus=aggregate%3Alist");

  /* ------------------------------------- B sees A at the tasks plot */
  await b.waitForTimeout(1200);
  const seen = await figureOf(b, NORA);
  const bOnA = await figureOf(a, SAM);
  report.checks.bSeesAAtTheTasksPlot = {
    seen,
    ok: seen !== null && seen.at === "aggregate:task" && seen.name === "Nora" && !seen.audience,
  };
  report.checks.andASeesBAtTheListsPlot = {
    seen: bOnA,
    ...(bOnA ? {} : { drawn: await others(a) }),
    ok: bOnA !== null && bOnA.at === "aggregate:list" && bOnA.name === "Sam",
  };

  /* ---------------------------- A picks a showing: the audience row on B */
  const marquee = await a.$('[data-testid^="drive-in-"] button');
  let showing = null;
  if (marquee) {
    await marquee.click();
    await a.waitForTimeout(1300);
    showing = await a.evaluate(() => location.hash);
  }
  const inRow = await figureOf(b, NORA);
  // The screen of whichever drive-in's marquee A pressed: its focus names the kind.
  const screen = showing ? `screen:${decodeURIComponent(showing.match(/focus=([^&]+)/)?.[1] ?? "").replace(/^aggregate:/, "")}` : null;
  report.checks.aPicksAShowingAndStandsInTheAudienceRowOnB = {
    showing,
    screen,
    seen: inRow,
    ok: showing !== null && /in\.view=/.test(showing) && inRow !== null && inRow.audience && inRow.at === screen,
  };

  /* ------------------------------------- A's robot, on B, captioned as hers */
  await a.click('[data-testid="activity-button"]').catch(() => {});
  await a.waitForTimeout(300);
  const seat = await a.$('[data-testid="agent-tidy"]');
  const enabled = seat ? !(await seat.isDisabled()) : false;
  let theirs = null;
  if (enabled) {
    await seat.click();
    for (let i = 0; i < 12 && !theirs; i++) {
      await b.waitForTimeout(150);
      theirs = await b.evaluate((who) => {
        const figure = document.querySelector(`[data-graview-figure^="theirs:human:${who}:"]`);
        return figure ? { at: figure.getAttribute("data-graview-at"), mode: figure.getAttribute("data-graview-mode"), caption: figure.querySelector(".graview-figure-name")?.textContent ?? null } : null;
      }, NORA);
    }
  }
  report.checks.asRobotAppearsOnBCaptionedAsHers = { enabled, theirs, ok: enabled && theirs !== null && theirs.caption === "Nora's agent" };
  await a.keyboard.press("Escape");
  await a.waitForTimeout(3300);

  /* ---------------------------------- A shares what she points at: B sees the outline */
  await a.click('[data-testid="profile-button"]');
  await a.waitForTimeout(300);
  const seenAs = await a.evaluate(() => document.querySelector('[data-testid="profile-seen-as"]')?.textContent ?? null);
  const shareControl = await a.$('[data-testid="setting-share-over-shared"]');
  const privateByDefault = await a.evaluate(() => document.querySelector('[data-testid="setting-share-over-private"]')?.getAttribute("aria-pressed") === "true");
  if (shareControl) await shareControl.click();
  await a.keyboard.press("Escape");
  await a.waitForTimeout(200);
  report.checks.profileSaysHowSheIsSeen = { seenAs, ok: seenAs === "Seen by others as Nora" };
  const pick = await a.$('[data-graview-pick]');
  const pickId = pick ? await pick.getAttribute("data-graview-pick") : null;
  let outline = null;
  if (pick) {
    await pick.hover();
    for (let i = 0; i < 12 && !outline; i++) {
      await b.waitForTimeout(150);
      outline = await b.evaluate((who) => document.querySelector(`[data-testid="presence-over"][data-graview-over-by^="human:${who}:"]`) !== null, NORA);
    }
  }
  report.checks.hoverIsPrivateUntilSharedThenOutlinedOnB = { privateByDefault, pickId, outline, ok: privateByDefault && shareControl !== null && outline === true };

  /* ------------------------------------------ B follows A until Escape */
  await go(a, "#overview=1&focus=aggregate%3Atask");
  await b.click(`[data-graview-figure^="human:${NORA}:"] .graview-figure-body`);
  await b.waitForTimeout(600);
  const followingLine = await b.evaluate(() => document.querySelector('[data-testid="following-who"]')?.textContent ?? null);
  await go(a, "#overview=1&focus=aggregate%3Alist");
  const bHash = await b.evaluate(() => location.hash);
  await b.keyboard.press("Escape");
  await b.waitForTimeout(300);
  const lineAfterEscape = await b.evaluate(() => document.querySelector('[data-testid="following-who"]') !== null);
  await go(a, "#overview=1&focus=aggregate%3Atask");
  const bHashAfter = await b.evaluate(() => location.hash);
  report.checks.bClicksAAndFollowsHerUntilEscape = {
    followingLine,
    bHash,
    bHashAfter,
    ok: followingLine === "following Nora" && /focus=aggregate%3Alist/.test(bHash) && !lineAfterEscape && /focus=aggregate%3Alist/.test(bHashAfter),
  };

  /*
   * A closes: gone within the TTL. WHAT THE CODE PROMISES, not a number
   * beside it: the last heartbeat can land just before the close, the
   * person lapses PRESENCE_TTL_MS after it, and the sweep that notices runs
   * every half TTL — so gone by TTL × 1.5, and a frame to draw it. A fixed
   * 3.2s look sat inside that window and failed whenever the beats fell
   * badly (nightly #16). B watches for her to go, and the claim says when.
   */
  await a.close();
  const closed = Date.now();
  const promised = Math.ceil(PRESENCE_TTL_MS * 1.5) + 750;
  let gone = await figureOf(b, NORA);
  while (gone !== null && Date.now() - closed < promised) {
    await b.waitForTimeout(100);
    gone = await figureOf(b, NORA);
  }
  report.checks.aClosesAndIsGoneWithinTheTtl = { gone, tookMs: Date.now() - closed, promisedMs: promised, ok: gone === null };

  await b.close();
  report.passed = Object.values(report.checks).every((check) => check.ok) && report.pageErrors.length === 0;
} catch (error) {
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  vite?.stop();
}

writeFileSync(resolve(repoRoot, "docs/who.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
for (const [name, check] of Object.entries(report.checks)) console.log(`${check.ok ? "ok  " : "FAIL"} ${name}`);
if (report.error) console.log(report.error);
console.log(`wrote docs/who.json — ${report.passed ? "passed" : "FAILED"}`);
process.exit(report.passed ? 0 : 1);
