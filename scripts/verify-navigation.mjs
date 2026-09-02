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
import { engineName, launchEngine } from "./lib/engine.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

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

const report = { at: new Date().toISOString(), engine: ENGINE, steps: [] };
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
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
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

  /*
   * The altitude control is a TOGGLE, and says which way it goes.
   *
   * "Graview" from the ground, "Focus" from altitude, aria state agreeing
   * with the word — and the mark morphs between its two states on the
   * scene's own curve rather than being swapped. Sampled mid-transition on
   * the way back down: a mark caught between its states is morphing; one
   * already at its end is cutting. Which of those is RIGHT depends on the
   * engine: where the property registers, the scene morphs and so must the
   * mark; where it cannot, the scene cuts and the mark must cut with it.
   */
  const control = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="overview"]');
      if (!el) return null;
      const wing = el.querySelector(".graview-altitude-mark-wing");
      return {
        label: el.textContent.trim(),
        pressed: el.getAttribute("aria-pressed"),
        name: el.getAttribute("aria-label"),
        wingOpacity: wing ? Number(getComputedStyle(wing).opacity) : null,
        registered: typeof globalThis.CSSPropertyRule !== "undefined",
      };
    });
  report.control = { ground: await control() };
  await page.click('[data-testid="overview"]');
  await page.waitForTimeout(900);
  report.control.altitude = await control();
  await page.click('[data-testid="overview"]');
  await page.waitForTimeout(300);
  report.control.midway = await control();
  await page.waitForTimeout(700);
  report.control.groundAgain = await control();
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
const near = (value, target) => typeof value === "number" && Math.abs(value - target) < 0.03;
const between = (value, low, high) => typeof value === "number" && value > low && value < high;
/*
 * The stop without its selection. A stop's address carries what was selected
 * at it — deliberately, so returning restores the pane — and the click that
 * precedes a double-click's travel updates the departing stop's selection.
 * Claims about GOING BACK are claims about places.
 */
const placeOf = (hash) => {
  const params = new URLSearchParams((hash ?? "").replace(/^#/, ""));
  params.delete("sel");
  return params.toString();
};
report.verdict = {
  // Nowhere to go back to on arrival, and the control says so rather than
  // being offered and doing nothing.
  nothingToGoBackToAtFirst: step("landed")?.back === false,
  travellingChangesTheAddress: step("travelled")?.url !== step("landed")?.url,
  backBecomesAvailable: step("travelled")?.back === true,
  // Nothing ahead until you have actually gone back.
  nothingAheadUntilYouGoBack: step("travelled")?.forward === false,
  backActuallyGoesBack: placeOf(step("back once")?.url) === placeOf(step("travelled")?.url),
  // The pane you had open at that stop comes back with it.
  backRestoresTheSelection: (step("back once")?.url ?? "").includes("sel="),
  wentDeeperThanOnce: report.wentDeeper === true,
  eachTravelIsItsOwnStop: step("travelled again")?.url !== step("travelled")?.url,
  // Two stops back from two stops in is where you started.
  backAgainReachesTheStart: placeOf(step("back twice")?.url) === placeOf(step("landed")?.url),
  forwardIsOfferedOnceThereIsSomewhere: step("back twice")?.forward === true,
  // Forward is ONE step, not all the way back to where you had got to.
  forwardActuallyGoesForward: placeOf(step("forward once")?.url) === placeOf(step("travelled")?.url),
  // And the breadcrumb still names where you are, and gets you out in one.
  theTrailNamesWhereYouAre: (step("travelled")?.trail ?? "").includes("deposit"),
  theTrailGetsYouHome: placeOf(step("home by breadcrumb")?.url) === placeOf(step("landed")?.url),
  // The altitude control: a toggle that names where it takes you.
  theControlSaysGraviewOnTheGround:
    report.control?.ground?.label === "Graview" &&
    report.control?.ground?.name === "Graview" &&
    report.control?.ground?.pressed === "false",
  theControlSaysFocusFromAltitude:
    report.control?.altitude?.label === "Focus" &&
    report.control?.altitude?.name === "Focus" &&
    report.control?.altitude?.pressed === "true",
  theMarkHasTwoStates:
    near(report.control?.ground?.wingOpacity, 0.75) && near(report.control?.altitude?.wingOpacity, 0),
  // Morphing where the scene morphs; cutting where it cuts.
  theMarkMovesAsTheSceneDoes: report.control?.midway?.registered
    ? between(report.control?.midway?.wingOpacity, 0.04, 0.71)
    : near(report.control?.midway?.wingOpacity, 0.75),
  theControlComesBackDown:
    report.control?.groundAgain?.label === "Graview" &&
    near(report.control?.groundAgain?.wingOpacity, 0.75),
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/navigation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n\nwrote docs/navigation.json\n`);
process.exit(report.passed ? 0 : 1);
