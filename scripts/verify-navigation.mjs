#!/usr/bin/env node
/**
 * Getting somewhere, and getting back.
 *
 * Travelling is a double click, and the screen you land on is the one nobody
 * designs: you arrived by accident as often as on purpose, and the first thing
 * you want is out. Every stop here is a URL, so back and forward are the
 * browser's — but an interface whose navigation is the browser's should not
 * require the person using it to know that, which is what the ← → controls are
 * for.
 *
 * This walks it in a real browser, because history is not something static
 * rendering has an opinion about.
 *
 *   node scripts/verify-navigation.mjs [--headed]
 *
 * Writes docs/navigation.json.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSER =
  process.env["GRAVIEW_BROWSER"] ??
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";

function startVite(name, port) {
  const child = spawn("npx", ["vite"], {
    cwd: resolve(repoRoot, `apps/${name}`),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start")), 40_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes(String(port))) {
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

const report = { at: new Date().toISOString(), steps: [] };
let browser;
let vite;

const enabled = (page, label) =>
  page.evaluate(
    (name) =>
      !document.querySelector(`[data-testid="backtrack"] button[aria-label="${name}"]`)?.disabled,
    label,
  );
const where = (page) => page.evaluate(() => window.location.hash);
const note = async (page, step) =>
  report.steps.push({
    step,
    url: await where(page),
    back: await enabled(page, "Back"),
    forward: await enabled(page, "Forward"),
    trail: await page.evaluate(
      () => document.querySelector('nav[aria-label="View"]')?.textContent?.trim() ?? null,
    ),
  });

try {
  vite = await startVite("todo", 5193);
  browser = await chromium.launch({
    executablePath: BROWSER,
    headless: !process.argv.includes("--headed"),
    args: ["--enable-blink-features=CanvasDrawElement"],
  });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  await page.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(900);
  await note(page, "landed");

  // Travel: the double click, and the screen it lands on.
  await page.dblclick('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(800);
  await note(page, "travelled");

  /*
   * Travel again, deeper — through a PICK TARGET rather than a card.
   *
   * Double-clicking a card with no pick target inside it zooms it in close,
   * which is a different move with a different meaning ("give this the
   * room") — and an ordinary stop like any other. Travelling is following a
   * thing the view nominated, and that is what a chain of stops is made of.
   */
  const onward = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-graview-pick]")]
        .map((el) => el.getAttribute("data-graview-pick"))
        .find((id) => id?.startsWith("reason")) ?? null,
  );
  if (onward) {
    await page.dblclick(`[data-graview-pick="${onward}"]`);
    await page.waitForTimeout(800);
    await note(page, "travelled again");
  }
  report.wentDeeper = onward !== null;

  // And back, twice, through the control rather than the keyboard.
  await page.click('[data-testid="backtrack"] button[aria-label="Back"]');
  await page.waitForTimeout(600);
  await note(page, "back once");
  await page.click('[data-testid="backtrack"] button[aria-label="Back"]');
  await page.waitForTimeout(600);
  await note(page, "back twice");

  // Forward is only offered when there is somewhere to go.
  await page.click('[data-testid="backtrack"] button[aria-label="Forward"]');
  await page.waitForTimeout(600);
  await note(page, "forward once");

  // And the breadcrumb gets you home in one.
  await page.click('[data-testid="focused"]');
  await page.waitForTimeout(600);
  await note(page, "home by breadcrumb");
} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  if (vite) {
    try {
      process.kill(-vite.pid, "SIGKILL");
    } catch {
      vite.kill("SIGKILL");
    }
  }
}

const step = (name) => report.steps.find((entry) => entry.step === name);
report.verdict = {
  // Nowhere to go back to on arrival, and the control says so rather than
  // being offered and doing nothing.
  nothingToGoBackToAtFirst: step("landed")?.back === false,
  travellingChangesTheAddress: step("travelled")?.url !== step("landed")?.url,
  backBecomesAvailable: step("travelled")?.back === true,
  // Nothing ahead until you have actually gone back.
  nothingAheadUntilYouGoBack: step("travelled")?.forward === false,
  backActuallyGoesBack: step("back once")?.url === step("travelled")?.url,
  wentDeeperThanOnce: report.wentDeeper === true,
  eachTravelIsItsOwnStop: step("travelled again")?.url !== step("travelled")?.url,
  // Two stops back from two stops in is where you started.
  backAgainReachesTheStart: step("back twice")?.url === step("landed")?.url,
  forwardIsOfferedOnceThereIsSomewhere: step("back twice")?.forward === true,
  // Forward is ONE step, not all the way back to where you had got to.
  forwardActuallyGoesForward: step("forward once")?.url === step("travelled")?.url,
  // And the breadcrumb still names where you are, and gets you out in one.
  theTrailNamesWhereYouAre: (step("travelled")?.trail ?? "").includes("deposit"),
  theTrailGetsYouHome: step("home by breadcrumb")?.url === step("landed")?.url,
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/navigation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n\nwrote docs/navigation.json\n`);
process.exit(report.passed ? 0 : 1);
