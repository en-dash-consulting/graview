#!/usr/bin/env node
/**
 * The traditional face, at phone width.
 *
 * The routed pages are the mobile answer, so mobile is an acceptance
 * criterion here, not an aspiration: at 390×844 the body must not scroll
 * sideways, headings and landmarks must exist, every link must have a name,
 * and a derived form must actually apply its mutation. Desktop gets the
 * cross-face checks: the record page's spatial link, the scene's pages link.
 *
 *   node scripts/verify-pages.mjs
 *
 * Writes docs/pages-face.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const ENGINE = engineName();

/**
 * The app this harness drives — borrowed if a dev server is already holding
 * the port, started and owned otherwise. See `lib/serve.mjs`: spawning a
 * second vite blindly meant every harness died with "vite did not start"
 * whenever anyone had the app open.
 */
function startVite(name, port) {
  return serving(name, port, repoRoot);
}

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let browser;
let vite;

const hygiene = (page) =>
  page.evaluate(() => ({
    noSideScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
    hasH1: document.querySelectorAll("h1, header a").length > 0,
    namedLinks: [...document.querySelectorAll("a")].every((a) => (a.textContent ?? "").trim().length > 0),
    labelledInputs: [...document.querySelectorAll("input, select")].every(
      (el) => el.closest("label")?.textContent?.trim() || el.type === "checkbox",
    ),
    /*
     * A CONTROL BIG ENOUGH TO HIT. 24px is the WCAG 2.2 minimum, and
     * `audit-ui` has counted it on the SCENE's screens since it existed —
     * nothing measured the routed face, where "Start fresh" sat in the
     * footer of every page of every app at 15 pixels tall. The count names
     * what it found rather than answering true or false, because a bare
     * `false` on a page with forty controls tells you nothing.
     */
    bigEnoughToHit: [...document.querySelectorAll("a[href], button, summary, select, input")]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) return false;
        if (el.type === "hidden") return false;
        return box.height < 24 || box.width < 24;
      })
      .slice(0, 6)
      .map((el) => {
        const box = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 20)}" ${Math.round(box.width)}x${Math.round(box.height)}`;
      }),
  }));

try {
  vite = await startVite("todo", 5193);
  browser = await launchEngine(ENGINE, { headless: true });

  /* ---------------------------------------------------- the phone, first */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto("http://localhost:5193/pages?today=2026-09-01", { waitUntil: "networkidle" });
  await phone.waitForTimeout(600);
  report.checks.phoneHome = await hygiene(phone);
  report.checks.homeIndexesKinds = await phone.evaluate(() =>
    ["Lists", "Tasks", "Rules"].every((word) => document.body.textContent.includes(word)),
  );

  await phone.click('nav[aria-label="Kinds"] a[href="/pages/tasks"]');
  await phone.waitForTimeout(500);
  report.checks.phoneList = await hygiene(phone);
  report.checks.listLinksRecords = await phone.evaluate(
    () => document.querySelectorAll('[data-testid="records"] a[href^="/pages/tasks/"]').length > 3,
  );

  await phone.click('[data-testid="records"] a[href="/pages/tasks/t-deposit"]');
  await phone.waitForTimeout(500);
  report.checks.phoneRecord = await hygiene(phone);
  report.checks.recordSaysItsFacts = await phone.evaluate(() => ({
    fields: document.querySelector('[data-testid="record-fields"]') !== null,
    linksToList: [...document.querySelectorAll('a[href^="/pages/lists/"]')].length > 0,
    actions: document.querySelector('[data-testid="record-actions"]') !== null,
    spatialLink: document.querySelector('[data-testid="spatial-link"]') !== null,
  }));

  /* ------------------- the reader's own text size, on the narrow screen */
  /*
   * 200% TEXT AT PHONE WIDTH, WHICH IS WHAT WCAG 1.4.4 AND 1.4.10 ACTUALLY
   * ASK. W-050 made every size in the framework relative and pinned it with
   * a test that reads the SOURCE for absolute pixels; nothing ever rendered
   * anything at a bigger root and looked. A rem-based grid minimum is the
   * shape that gets through that test and still pushes the document
   * sideways — `minmax(12rem, 1fr)` is 384px once a reader asks for 32, and
   * a column that cannot shrink is a page that scrolls two ways.
   */
  /*
   * AND THE SIZE IS SET THROUGH THE CONTROL, not injected.
   *
   * Every run of this check used to write `document.documentElement.style
   * .fontSize = "32px"` itself, which tests the CSS and says nothing about
   * whether a reader can get there. The profile pane on the scene's bar now
   * offers it; "Largest" is 32px precisely because that is the 200% WCAG
   * 1.4.4 asks for, so the promise the app makes and the size the harness
   * checks are one number. Set once, on the scene, and carried to the
   * routed face by the browser rather than by this script.
   */
  await phone.goto("http://localhost:5193/?today=2026-09-01&fresh=1", { waitUntil: "load" });
  await phone.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await phone.waitForTimeout(600);
  await phone.click('[data-testid="profile-button"]');
  await phone.waitForSelector('[data-testid="setting-text-size-32px"]', { timeout: 10_000 });
  await phone.click('[data-testid="setting-text-size-32px"]');
  await phone.waitForTimeout(400);
  report.checks.theControlSetsIt = await phone.evaluate(() => ({
    root: getComputedStyle(document.documentElement).fontSize,
    pressed:
      document.querySelector('[data-testid="setting-text-size-32px"]')?.getAttribute("aria-pressed") ===
      "true",
    ok: getComputedStyle(document.documentElement).fontSize === "32px",
  }));

  for (const path of ["/pages", "/pages/tasks", "/pages/tasks/t-deposit", "/pages/problems"]) {
    await phone.goto(`http://localhost:5193${path}?today=2026-09-01`, { waitUntil: "networkidle" });
    await phone.waitForTimeout(400);
    const reflow = await phone.evaluate(() => ({
      root: getComputedStyle(document.documentElement).fontSize,
      // The text really is bigger — a pass at the default size proves nothing.
      body: getComputedStyle(document.body).fontSize,
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      widest: [...document.querySelectorAll("*")]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className || "").split(" ")[0]}`),
    }));
    report.checks.readersOwnTextSize = {
      ...(report.checks.readersOwnTextSize ?? {}),
      [path]: {
        ...reflow,
        ok:
          reflow.scrollWidth <= reflow.width + 1 &&
          parseFloat(reflow.body) > 20 &&
          reflow.widest.length === 0,
      },
    };
  }
  /* --------------------------- the profile pane, read by a machine */
  /*
   * A PANE HOLDING THE ACCESSIBILITY CONTROLS HAS TO BE ACCESSIBLE.
   *
   * Text size and motion are settings people who need them come looking for,
   * so a pane that offers them and fails a contrast or a name rule is worse
   * than one that offers nothing. Both widths and both schemes, with the
   * pane OPEN — closed, it is one button and proves nothing.
   */
  const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");
  const axeOnThePane = async (page) => {
    await page.click('[data-testid="profile-button"]');
    await page.waitForSelector('[data-testid="profile"]', { timeout: 10_000 });
    await page.addScriptTag({ content: axeSource });
    return page.evaluate(async () => {
      const result = await window.axe.run(document, { resultTypes: ["violations"] });
      return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    });
  };
  const paneFindings = {};
  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"]) {
      const seen = await browser.newPage({ viewport: { width, height: 900 } });
      await seen.goto(`http://localhost:5193/?today=2026-09-01&theme=${theme}`, { waitUntil: "load" });
      await seen.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await seen.waitForTimeout(700);
      paneFindings[`${width}-${theme}`] = await axeOnThePane(seen);
      await seen.close();
    }
  }
  report.checks.theProfilePaneIsReachable = {
    ...paneFindings,
    ok: Object.values(paneFindings).every((found) => found.length === 0),
  };

  /* Back to the reader's own size, through the same control. */
  await phone.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
  await phone.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await phone.waitForTimeout(500);
  await phone.click('[data-testid="profile-button"]');
  await phone.waitForSelector('[data-testid="setting-text-size-browser"]', { timeout: 10_000 });
  await phone.click('[data-testid="setting-text-size-browser"]');
  await phone.waitForTimeout(300);

  /* ------------------------------------- a derived form actually applies */
  await phone.goto("http://localhost:5193/pages/tasks?today=2026-09-01", { waitUntil: "networkidle" });
  await phone.waitForTimeout(500);
  const before = await phone.evaluate(
    () => document.querySelectorAll('[data-testid="records"] a').length,
  );
  await phone.fill('[data-testid="form-add-task"] input[name="label"]', "Buy compost");
  await phone.selectOption('[data-testid="form-add-task"] select[name="listId"]', { index: 1 });
  await phone.click('[data-testid="form-add-task"] button[type="submit"]');
  await phone.waitForTimeout(500);
  const after = await phone.evaluate(
    () => document.querySelectorAll('[data-testid="records"] a').length,
  );
  report.checks.derivedFormApplies =
    after === before + 1 &&
    (await phone.evaluate(() => document.body.textContent.includes("Buy compost")));
  await phone.close();

  /* ------------------------------------------- the two faces cross-link */
  const desk = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  await desk.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
  await desk.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  report.checks.sceneOffersThePages = await desk.evaluate(
    () => document.querySelector('[data-testid="pages-link"]')?.getAttribute("href") === "/pages",
  );
  await desk.goto("http://localhost:5193/pages/tasks/t-deposit?today=2026-09-01", { waitUntil: "networkidle" });
  await desk.waitForTimeout(400);
  const spatial = await desk.evaluate(
    () => document.querySelector('[data-testid="spatial-link"]')?.getAttribute("href") ?? "",
  );
  report.checks.recordLinksItsStop = spatial === "/#focus=t-deposit";
  await desk.close();
} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  if (vite) {
    vite.stop();
  }
}

const flat = JSON.stringify(report.checks);
const tooSmall = Object.values(report.checks).flatMap((check) => check?.bigEnoughToHit ?? []);
report.passed = !report.error && !flat.includes("false") && tooSmall.length === 0;
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/pages-face.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/pages-face.json\n`);
process.exit(report.passed ? 0 : 1);
