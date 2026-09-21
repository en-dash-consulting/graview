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
        // A lens drawn small on a picture card is inert: what it holds is not a control of this page.
        if (el.closest('[inert], [aria-hidden="true"]')) return false;
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
      /*
       * OFF THE SIDE WITH NOWHERE TO SCROLL is the failure; off the side
       * INSIDE something that scrolls is a row of navigation links you
       * swipe, which is what a phone does with them. `audit-ui` has drawn
       * this distinction since it existed; this one counted both, so a
       * design whose nav scrolls sideways on purpose read as a page that
       * scrolls sideways by accident.
       */
      widest: [...document.querySelectorAll("*")]
        .filter((el) => {
          if (el.getBoundingClientRect().right <= window.innerWidth + 1) return false;
          for (let at = el.parentElement; at; at = at.parentElement) {
            const overflow = getComputedStyle(at).overflowX;
            if ((overflow === "auto" || overflow === "scroll") && at.scrollWidth > at.clientWidth + 1) {
              return false;
            }
          }
          return true;
        })
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
  const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");

  /* ------------------------- the face behaves like something finished */
  /*
   * A DESIGN IS NOT A STYLESHEET. What makes Things' face read as shipped
   * is not the type: it is that a list you arranged is a link you can send,
   * a record edits where it is shown, and a problem is one press from being
   * fixed. All three through the framework — the same acts, the same
   * policy, the same op log.
   */
  const desk2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await desk2.goto("http://localhost:5193/pages/tasks?today=2026-09-01&fresh=1", { waitUntil: "networkidle" });
  await desk2.waitForSelector('[data-testid="list-controls"]', { timeout: 20_000 });
  await desk2.selectOption('[data-testid="list-group"]', "due");
  await desk2.fill('[data-testid="list-filter"]', "the");
  await desk2.waitForTimeout(400);
  const arranged = await desk2.evaluate(() => ({
    url: location.search,
    rows: document.querySelectorAll('[data-testid="records"] li').length,
  }));
  // A link somebody could send: opened cold, the same arrangement.
  await desk2.goto(`http://localhost:5193/pages/tasks${arranged.url}&today=2026-09-01`, { waitUntil: "networkidle" });
  await desk2.waitForSelector('[data-testid="list-controls"]', { timeout: 20_000 });
  await desk2.waitForTimeout(300);
  const reopened = await desk2.evaluate(() => ({
    group: document.querySelector('[data-testid="list-group"]')?.value,
    query: document.querySelector('[data-testid="list-filter"]')?.value,
    rows: document.querySelectorAll('[data-testid="records"] li').length,
  }));
  report.checks.aListYouArrangedIsALinkYouCanSend = {
    arranged,
    reopened,
    ok:
      arranged.url.includes("group=due") &&
      arranged.url.includes("q=the") &&
      reopened.group === "due" &&
      reopened.query === "the" &&
      reopened.rows === arranged.rows,
  };

  /* An empty state that says what to do next, rather than a blank page. */
  await desk2.fill('[data-testid="list-filter"]', "zzzz");
  await desk2.waitForTimeout(400);
  const empty = await desk2.evaluate(() => ({
    said: document.querySelector('[data-testid="empty"]')?.textContent?.trim() ?? null,
    away: document.querySelectorAll('[data-testid="empty"] button, [data-testid="empty"] a').length,
  }));
  report.checks.anEmptyStateSaysWhatToDoNext = {
    ...empty,
    ok: empty.said !== null && empty.away > 0,
  };

  /* A record edits where it is shown, through the act the framework found. */
  await desk2.goto("http://localhost:5193/pages/tasks/t-deposit?today=2026-09-01", { waitUntil: "networkidle" });
  await desk2.waitForSelector('[data-testid="record-fields"]', { timeout: 20_000 });
  // The HEADING is the name, so the heading is where the name is changed —
  // `readableFields` leaves the label out of the facts because it is
  // already the heading.
  await desk2.locator('h1 [data-graview-editable="rename"]').first().click();
  await desk2.waitForSelector('[data-testid="edit-label"] input', { timeout: 10_000 });
  await desk2.fill('[data-testid="edit-label"] input', "Pay the deposit today");
  await desk2.click('[data-testid="edit-label"] button[type="submit"]');
  await desk2.waitForTimeout(600);
  const edited = await desk2.evaluate(() => ({
    heading: document.querySelector("h1")?.textContent?.trim() ?? null,
    stillAForm: document.querySelector('[data-testid="edit-label"]') !== null,
  }));
  report.checks.aRecordEditsWhereItIsShown = {
    ...edited,
    ok: edited.heading === "Pay the deposit today" && !edited.stillAForm,
  };

  /* And the problems page is an inbox: one press puts a rule right. */
  await desk2.goto("http://localhost:5193/pages/problems?today=2026-09-01", { waitUntil: "networkidle" });
  await desk2.waitForSelector('[data-testid="problem"]', { timeout: 20_000 });
  const before2 = await desk2.evaluate(() => document.querySelectorAll('[data-testid="problem"]').length);
  await desk2.locator('[data-testid="repairs"] button:not([data-graview-asks])').first().click();
  await desk2.waitForTimeout(700);
  const after2 = await desk2.evaluate(() => document.querySelectorAll('[data-testid="problem"]').length);
  report.checks.theProblemsPageIsAnInbox = {
    before: before2,
    after: after2,
    ok: before2 > 0 && after2 < before2,
  };
  await desk2.close();

  /* ------------------- every route of the app's own face, read by a machine */
  /*
   * A DESIGN IS NOT FINISHED UNTIL A MACHINE CAN READ IT.
   *
   * Things replaces every routed surface, so every one of them is its own
   * chance to get contrast, names, landmarks or focus wrong. Both widths,
   * both schemes, every route — including the not-found page, which no
   * design can register and which therefore renders the framework's own
   * inside somebody else's shell.
   */
  const routes = ["/pages", "/pages/tasks", "/pages/tasks/t-deposit", "/pages/lists", "/pages/problems", "/pages/nowhere"];
  const faceFindings = {};
  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"]) {
      const seen = await browser.newPage({ viewport: { width, height: 900 } });
      for (const route of routes) {
        await seen.goto(`http://localhost:5193${route}?today=2026-09-01&theme=${theme}`, {
          waitUntil: "networkidle",
        });
        await seen.waitForTimeout(400);
        await seen.addScriptTag({ content: axeSource });
        const found = await seen.evaluate(async () => {
          const result = await window.axe.run(document, { resultTypes: ["violations"] });
          return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        });
        if (found.length > 0) faceFindings[`${width}-${theme}${route}`] = found;
      }
      await seen.close();
    }
  }
  report.checks.everyRouteOfTheOwnFaceIsReachable = {
    ...faceFindings,
    ok: Object.keys(faceFindings).length === 0,
  };

  /* --------------------------- the profile pane, read by a machine */
  /*
   * A PANE HOLDING THE ACCESSIBILITY CONTROLS HAS TO BE ACCESSIBLE.
   *
   * Text size and motion are settings people who need them come looking for,
   * so a pane that offers them and fails a contrast or a name rule is worse
   * than one that offers nothing. Both widths and both schemes, with the
   * pane OPEN — closed, it is one button and proves nothing.
   */
  const axeOnThePane = async (page) => {
    await page.click('[data-testid="profile-button"]');
    await page.waitForSelector('[data-testid="profile"]', { timeout: 10_000 });
    await page.addScriptTag({ content: axeSource });
    return page.evaluate(async () => {
      const result = await window.axe.run(document, { resultTypes: ["violations"] });
      return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    });
  };
  /*
   * AND THE CALENDAR, which is a grid of controls a person navigates: six
   * weeks of day cells, an overflow button per busy day, four ranges and
   * three steps. Every one of them has to be reachable and named, at a
   * phone's width as well as a desk's, in both schemes.
   */
  const calendarFindings = {};
  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"]) {
      const seen = await browser.newPage({ viewport: { width, height: 900 } });
      await seen.goto(`http://localhost:5193/?today=2026-09-01&theme=${theme}#focus=aggregate:task&in.view=the-month`, {
        waitUntil: "load",
      });
      await seen.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await seen.waitForSelector('[data-testid="calendar"]', { timeout: 20_000 });
      await seen.waitForTimeout(600);
      await seen.addScriptTag({ content: axeSource });
      calendarFindings[`${width}-${theme}`] = await seen.evaluate(async () => {
        const result = await window.axe.run(document, { resultTypes: ["violations"] });
        return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
      });
      await seen.close();
    }
  }
  report.checks.theCalendarIsReachable = {
    ...calendarFindings,
    ok: Object.values(calendarFindings).every((found) => found.length === 0),
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

  /* ------------------------------------------------ the pictures on pages */
  await desk.goto("http://localhost:5193/pages/places?today=2026-09-01", { waitUntil: "networkidle" });
  await desk.waitForTimeout(500);
  const index = await desk.evaluate(() => ({
    cards: [...document.querySelectorAll('[data-testid="place-card"]')].map((a) => a.getAttribute("href")),
    inert: [...document.querySelectorAll('[data-testid="place-picture"]')].every(
      (el) => el.hasAttribute("inert") && el.getAttribute("aria-hidden") === "true",
    ),
    // Each picture is the lens itself, drawn: something is in the frame.
    drawn: [...document.querySelectorAll('[data-testid="place-picture"]')].every((el) => el.querySelector("*") !== null),
    nav: [...document.querySelectorAll("nav a")].map((a) => (a.textContent ?? "").trim()),
  }));
  report.checks.placesIndex = { cards: index.cards, inert: index.inert, drawn: index.drawn, ok: index.cards.length >= 2 && index.inert && index.drawn };
  // The scene's bar, mirrored: a picture's name comes before a kind's plural, and Problems is last.
  // A rail's link carries its count in the same text ("Tasks10"), so it is read by its opening words.
  const firstPlace = index.nav.findIndex((text) => text.startsWith("The week"));
  const firstKind = index.nav.findIndex((text) => text.startsWith("Tasks"));
  report.checks.navMirrorsTheBar = {
    nav: index.nav,
    ok: firstPlace !== -1 && firstKind !== -1 && firstPlace < firstKind && (index.nav[index.nav.length - 1] ?? "").startsWith("Problems"),
  };
  await desk.goto("http://localhost:5193/pages/places/the-week?today=2026-09-01", { waitUntil: "networkidle" });
  await desk.waitForTimeout(500);
  const lens = await desk.evaluate(() => ({
    present: document.querySelector('[data-testid="place-lens"]') !== null,
    picks: document.querySelectorAll('[data-testid="place-lens"] [data-graview-pick]').length,
    stop: document.querySelector('[data-testid="place-stop"]')?.getAttribute("href") ?? null,
    noSideScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
  }));
  report.checks.placePage = { ...lens, ok: lens.present && lens.picks > 0 && lens.stop === "/#view=the-week" && lens.noSideScroll };
  // A pick inside the picture travels to the record.
  // A moment in the week has its own children under the pointer; the click lands on them and bubbles, as a finger's would.
  await desk.click('[data-testid="place-lens"] [data-graview-pick]', { force: true });
  await desk.waitForTimeout(500);
  const landed = await desk.evaluate(() => location.pathname);
  report.checks.aPickTravelsToTheRecord = { landed, ok: /^\/pages\/tasks\/.+/.test(landed) };
  await desk.close();
  // The index and a picture at a phone's width: one column, nothing side-scrolls the document.
  const phone3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone3.goto("http://localhost:5193/pages/places?today=2026-09-01", { waitUntil: "networkidle" });
  await phone3.waitForTimeout(400);
  report.checks.phonePlaces = await hygiene(phone3);
  await phone3.goto("http://localhost:5193/pages/places/the-week?today=2026-09-01", { waitUntil: "networkidle" });
  await phone3.waitForTimeout(400);
  report.checks.phonePlace = await hygiene(phone3);
  await phone3.close();
} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  if (vite) {
    vite.stop();
  }
}

/*
 * A CHECK THAT SAYS `ok` IS JUDGED BY IT; anything else is judged by having
 * no `false` anywhere in it.
 *
 * The verdict used to be "the whole report contains no false", which cannot
 * express a check whose correct answer IS false — "the editor closed after
 * saving" reports `stillAForm: false` and could never pass. Every check
 * either states its own verdict or is a bag of things that must all be
 * true; both are now read as what they are.
 */
const stated = (check) =>
  check && typeof check === "object" && Object.prototype.hasOwnProperty.call(check, "ok");
const failing = Object.entries(report.checks).filter(([, check]) =>
  stated(check) ? check.ok !== true : JSON.stringify(check).includes("false"),
);
const tooSmall = Object.values(report.checks).flatMap((check) => check?.bigEnoughToHit ?? []);
report.failing = failing.map(([name]) => name);
report.passed = !report.error && failing.length === 0 && tooSmall.length === 0;
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/pages-face.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/pages-face.json\n`);
process.exit(report.passed ? 0 : 1);
