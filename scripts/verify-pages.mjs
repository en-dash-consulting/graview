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
import { ENGINES, engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { stored } from "./lib/stored.mjs";
import { arrangeByKeyboard, chooseOnTheLine, endClearsTheFoot, FIRST_RECORD_WITHIN, listHead } from "./lib/arranging-line.mjs";
import { at, portFor } from "./lib/ports.mjs";

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
let garden;
let catalog;
let program;

const hygiene = (page) =>
  page.evaluate(() => ({
    noSideScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
    hasH1: document.querySelectorAll("h1, header a").length > 0,
    // Named in words or by `aria-label`: the bar's standing is a dot whose name is its words (FR-131).
    namedLinks: [...document.querySelectorAll("a")].every((a) => (a.textContent ?? "").trim().length > 0 || (a.getAttribute("aria-label") ?? "").trim().length > 0),
    /*
     * A NAME, however it is given. A wrapping label is the common way and
     * an `aria-label` is the other one — it is what a screen reader
     * announces, and the seat's own field has carried one since it was
     * written. The question is whether the control has a name, not which
     * of the two spellings the author reached for.
     */
    labeledInputs: [...document.querySelectorAll("input, select")].every(
      (el) =>
        el.closest("label")?.textContent?.trim() ||
        el.getAttribute("aria-label")?.trim() ||
        (el.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .some((id) => document.getElementById(id)?.textContent?.trim()) ||
        el.type === "checkbox",
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

/*
 * THE STEPS, in the order the run takes them. Each writes its claims into
 * `report.checks`; the order they are written in is the order the verdict
 * lists them, so the run below calls them in the order they always ran.
 */

/** The routed face at a phone's width: the home, a list and a record, each read for its hygiene. The page stays open for the steps that follow it. */
async function thePhoneFirst() {
  /* ---------------------------------------------------- the phone, first */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${at("todo")}/pages?today=2026-09-01`, { waitUntil: "networkidle" });
  await phone.waitForTimeout(600);
  report.checks.phoneHome = await hygiene(phone);
  report.checks.homeIndexesKinds = await phone.evaluate(() =>
    ["Lists", "Tasks", "Rules"].every((word) => document.body.textContent.includes(word)),
  );

  // The bar holds the places now (the design's rail stands aside under it): the list by its address.
  await phone.goto(`${at("todo")}/pages/tasks?today=2026-09-01`, { waitUntil: "networkidle" });
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
  return phone;
}

async function theReadersOwnTextSize(phone) {
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
  await phone.goto(`${at("todo")}/?today=2026-09-01&fresh=1`, { waitUntil: "load" });
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
    await phone.goto(`${at("todo")}${path}?today=2026-09-01`, { waitUntil: "networkidle" });
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
}

/** A list you arranged is a link you can send: opened cold, the same arrangement. */
async function aListYouArrangedIsALinkYouCanSend(desk2) {
  await desk2.goto(`${at("todo")}/pages/tasks?today=2026-09-01&fresh=1`, { waitUntil: "networkidle" });
  await desk2.waitForSelector('[data-testid="arrange-bar"]', { timeout: 20_000 });
  await chooseOnTheLine(desk2, "arrange", "group", "due");
  await desk2.waitForTimeout(300);
  await desk2.fill('[data-testid="nav-find"]', "the");
  await desk2.waitForTimeout(400);
  const arranged = await desk2.evaluate(() => ({
    url: location.search,
    rows: document.querySelectorAll('[data-testid="records"] li').length,
  }));
  // A link somebody could send: opened cold, the same arrangement.
  await desk2.goto(`${at("todo")}/pages/tasks${arranged.url}&today=2026-09-01`, { waitUntil: "networkidle" });
  await desk2.waitForSelector('[data-testid="arrange-bar"]', { timeout: 20_000 });
  await desk2.waitForTimeout(300);
  const reopened = await desk2.evaluate(() => ({
    group: document.querySelector('button[data-testid="arrange-group"]')?.value,
    query: document.querySelector('[data-testid="nav-find"]')?.value,
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
}

async function aListArrangesOnOneQuietLine() {
  /*
   * A LIST ARRANGES ON ONE QUIET LINE (todo's own list page, which draws the
   * framework's line). Nick, on Cloud's "Purchase scenarios": "these
   * filters/controls are annoying, ugly, and consume a lot of real estate".
   * The first record stands near the top at a desk and on a phone; the
   * count is said once, on the line, never in an eyebrow; no select is left
   * for arranging; the keyboard reaches every way to arrange; an address
   * opens the list arranged; and a list short enough to read has no
   * controls at all.
   */
  const quiet = { heads: [], keys: [], addressed: null, short: [] };
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    for (const path of ["/pages/tasks", "/pages/reasons"]) {
      await page.goto(`${at("todo")}${path}?today=2026-09-01`, { waitUntil: "networkidle" });
      await page.waitForSelector('[data-testid="records"]', { timeout: 20_000 });
      await page.waitForTimeout(300);
      const head = await listHead(page);
      quiet.heads.push({ app: "todo", path, width: viewport.width, ...head, end: await endClearsTheFoot(page) });
      if (path === "/pages/reasons") quiet.short.push({ width: viewport.width, count: head.count, controls: await page.locator('[data-testid="arrange-sort"], [data-testid="arrange-all"]').count() });
    }
    await page.goto(`${at("todo")}/pages/tasks?today=2026-09-01`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    quiet.keys.push({ width: viewport.width, ...(await arrangeByKeyboard(page, "arrange")) });
    if (viewport.width === 1440) {
      await page.goto(`${at("todo")}/pages/tasks?sort=due:desc&group=due:month&today=2026-09-01`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      quiet.addressed = await page.evaluate(() => ({
        sort: document.querySelector('button[data-testid="arrange-sort"]')?.value ?? null,
        sortSaid: document.querySelector('button[data-testid="arrange-sort"]')?.getAttribute("aria-label") ?? null,
        group: document.querySelector('button[data-testid="arrange-group"]')?.value ?? null,
        groupSaid: document.querySelector('button[data-testid="arrange-group"]')?.textContent?.trim() ?? null,
        headings: [...document.querySelectorAll('[data-testid="list-group"] h2')].map((h) => (h.textContent ?? "").trim()),
      }));
    }
    await page.close();
  }
  report.checks.aListsFirstRecordStandsNearTheTopOfThePage = {
    within: FIRST_RECORD_WITHIN,
    seen: quiet.heads,
    ok: quiet.heads.length === 4 && quiet.heads.every((one) => one.relatedRepeats.length === 0 && one.fromTop !== null && one.fromTop <= (one.width >= 1000 ? FIRST_RECORD_WITHIN.desk : FIRST_RECORD_WITHIN.phone) && !one.countedInAnEyebrow && !one.scrolls && one.count !== null && one.end.ok),
  };
  report.checks.noSelectArrangesAList = { seen: quiet.heads.map(({ path, width, lines, selects }) => ({ path, width, lines, selects })), ok: quiet.heads.every((one) => one.selects === 0) };
  report.checks.everyWayToArrangeAListIsReachedByTheKeyboard = { seen: quiet.keys, ok: quiet.keys.length === 2 && quiet.keys.every((one) => one.ok) };
  report.checks.anArrangedAddressOpensTheListArranged = {
    seen: quiet.addressed,
    ok: quiet.addressed !== null && quiet.addressed.sort === "due" && /latest first/.test(quiet.addressed.sortSaid ?? "") && quiet.addressed.group === "due" && /a month each/.test(quiet.addressed.groupSaid ?? "") && quiet.addressed.headings.length >= 2,
  };
  report.checks.aShortListIsReadNotArranged = { seen: quiet.short, ok: quiet.short.length === 2 && quiet.short.every((one) => one.count === "1 reason" && one.controls === 0) };
}

/**
 * A LIST IS EXPORTED AS IT IS SHOWN (Roadmap f-view-export-csv). Pressing
 * "Export CSV" on todo's tasks — grouped by the list each is on, open ones
 * only — downloads a CSV whose rows are the rows on screen, in their order,
 * under their group's heading; and the reasons, whose list the declaration
 * switched off (`pages.lists.reason.export: false`), offer it to nobody.
 */
async function aListIsExportedAsItIsShown() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${at("todo")}/pages/tasks?today=2026-09-01`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="arrange-export"]', { timeout: 20_000 });
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="list-group"]')].flatMap((section) => {
      const heading = section.querySelector("h2")?.firstChild?.textContent?.trim() ?? "";
      return [...section.querySelectorAll("li[data-graview-record]")].map((row) => ({ group: heading, text: (row.textContent ?? "").replace(/\s+/g, " ").trim() }));
    }),
  );
  const button = await page.evaluate(() => {
    const press = document.querySelector('[data-testid="arrange-export"]');
    return { tag: press?.tagName ?? null, name: press?.getAttribute("aria-label") ?? press?.textContent?.trim() ?? null, filled: press ? getComputedStyle(press).backgroundColor : null };
  });
  // Pressed from the keyboard, where the keys are: the press keeps them.
  await page.focus('[data-testid="arrange-export"]');
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10_000 }), page.keyboard.press("Enter")]);
  const file = download.suggestedFilename();
  const text = readFileSync(await download.path(), "utf8");
  const rows = parseCsvText(text);
  const [header, ...body] = rows;
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null);
  /*
   * A GROUP DRAWN SHUT IS STILL WRITTEN: grouped by whether they are
   * finished, the finished tasks stand last and shut (`pages.lists.task.group.closed`),
   * and the file holds every row each heading counts.
   */
  await page.goto(`${at("todo")}/pages/tasks?group=done&today=2026-09-01`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="arrange-export"]', { timeout: 20_000 });
  const heads = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="list-group"]')].map((section) => ({
      shut: section.getAttribute("data-closed") === "shut",
      drawn: section.querySelectorAll("li[data-graview-record]").length,
      counted: Number(((section.querySelector("h2")?.textContent ?? "").match(/(\d+)\D*$/) ?? [])[1] ?? NaN),
    })),
  );
  await page.focus('[data-testid="arrange-export"]');
  const [shutDownload] = await Promise.all([page.waitForEvent("download", { timeout: 10_000 }), page.keyboard.press("Enter")]);
  const shutRows = parseCsvText(readFileSync(await shutDownload.path(), "utf8")).slice(1);
  await page.goto(`${at("todo")}/pages/reasons?today=2026-09-01`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="records"]', { timeout: 20_000 });
  await page.waitForTimeout(300);
  const offOffers = await page.locator('[data-testid="arrange-export"]').count();
  await page.close();
  const matches = body.length === shown.length && body.every((row, at) => row[0] === shown[at]?.group && shown[at]?.text.includes(row[1] ?? "\u0000"));
  report.checks.exportingAGroupedListWritesTheRowsOnScreenInTheirOrder = {
    file,
    header,
    rows: body.slice(0, 6),
    shown: shown.slice(0, 6),
    count: { file: body.length, screen: shown.length },
    bom: text.charCodeAt(0) === 0xfeff,
    button,
    focus,
    ok: /^Tasks — \d{4}-\d{2}-\d{2}\.csv$/.test(file) && text.charCodeAt(0) === 0xfeff && header?.[0] === "Group" && header?.[1] === "Name" && shown.length > 3 && matches && button.tag === "BUTTON" && button.name === "Export CSV" && focus === "arrange-export",
  };
  const counted = heads.reduce((sum, head) => sum + head.counted, 0);
  report.checks.aGroupDrawnShutIsStillWritten = {
    heads,
    written: shutRows.length,
    ok: heads.some((head) => head.shut && head.drawn === 0 && head.counted > 0) && shutRows.length === counted && shutRows.length > heads.reduce((sum, head) => sum + head.drawn, 0),
  };
  report.checks.aListSwitchedOffOffersNoExport = { offers: offOffers, ok: offOffers === 0 };
}

/** RFC 4180, as `parseCsv` reads it: quoted cells, doubled quotes, CRLF, the byte-order mark. */
function parseCsvText(text) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let at = 0; at < source.length; at++) {
    const char = source[at];
    if (quoted) {
      if (char === '"' && source[at + 1] === '"') (cell += '"'), at++;
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") row.push(cell), (cell = "");
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && source[at + 1] === "\n") at++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += char;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}

async function anEmptyStateSaysWhatToDoNext(desk2) {
  /* An empty state that says what to do next, rather than a blank page. */
  await desk2.fill('[data-testid="nav-find"]', "zzzz");
  await desk2.waitForTimeout(400);
  const empty = await desk2.evaluate(() => ({
    said: document.querySelector('[data-testid="empty"], [data-testid="none-yet"]')?.textContent?.trim() ?? null,
    away: document.querySelectorAll('[data-testid="empty"] button, [data-testid="empty"] a, [data-testid="none-yet"] a, [data-testid="beginnings"] button').length,
  }));
  report.checks.anEmptyStateSaysWhatToDoNext = {
    ...empty,
    ok: empty.said !== null && empty.away > 0,
  };
}

async function theWordsFindItOnAPage() {
  /*
   * SEARCH, ON A PAGE. `/search?q=` is the Find box's matcher at an address:
   * opened cold it lists what the words find grouped by kind, each heading
   * a link to its list with the words carried — and the list opens already
   * narrowed. The box on the rail goes there from anywhere; words that find
   * nothing say what was searched and offer the beginnings, the words
   * already in the name. On a phone at a 32px root font it neither scrolls
   * sideways nor offers a target under 24px.
   */
  const finder = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await finder.goto(`${at("todo")}/pages/search?q=the&today=2026-09-01`, { waitUntil: "networkidle" });
  await finder.waitForSelector('[data-testid="search-heading"]', { timeout: 20_000 });
  const cold = await finder.evaluate(() => ({
    heading: document.querySelector('[data-testid="search-heading"]')?.textContent?.trim() ?? "",
    groups: [...document.querySelectorAll('[data-testid="search-group"]')].map((el) => el.getAttribute("data-kind")),
    hits: document.querySelectorAll('[data-testid="search-hit"][data-about="node"]').length,
    why: document.querySelectorAll('[data-testid="search-why"]').length,
    taskList: document.querySelector('[data-testid="search-group"][data-kind="task"] [data-testid="search-kind-link"]')?.getAttribute("href") ?? null,
  }));
  await finder.click('[data-testid="search-group"][data-kind="task"] [data-testid="search-kind-link"]');
  await finder.waitForSelector('[data-testid="arrange-bar"]', { timeout: 20_000 });
  await finder.waitForTimeout(300);
  const intoTheList = await finder.evaluate(() => ({
    url: location.pathname + location.search,
    query: document.querySelector('[data-testid="nav-find"]')?.value ?? null,
    rows: document.querySelectorAll('[data-testid="records"] li').length,
  }));
  await finder.goto(`${at("todo")}/pages/?today=2026-09-01`, { waitUntil: "networkidle" });
  await finder.waitForSelector('[data-testid="nav-find"]', { timeout: 20_000 });
  await finder.fill('[data-testid="nav-find"]', "deposit");
  await finder.waitForSelector('[data-testid="search-heading"]', { timeout: 20_000 });
  await finder.waitForTimeout(300);
  const typed = await finder.evaluate(() => ({
    url: location.pathname + location.search,
    hits: [...document.querySelectorAll('[data-testid="search-hit"][data-about="node"] a')].map((a) => a.textContent?.trim()),
  }));
  /*
   * TYPED AT FULL SPEED, KEY BY KEY. `fill` above is one input event; a
   * person is a run of them, and the box wrote each to the address and took
   * the address back — one that caught up after the next key overwrote it,
   * so on a slow runner "digital" was searched as "dgtl". Every key arrives.
   */
  await finder.goto(`${at("todo")}/pages/tasks?today=2026-09-01`, { waitUntil: "networkidle" });
  await finder.waitForSelector('[data-testid="nav-find"]', { timeout: 20_000 });
  await finder.click('[data-testid="nav-find"]');
  await finder.keyboard.type("pay the deposit now", { delay: 0 });
  await finder.waitForTimeout(800);
  const fast = await finder.evaluate(() => ({
    box: document.querySelector('[data-testid="nav-find"]')?.value ?? null,
    q: new URLSearchParams(location.search).get("q"),
  }));
  await finder.goto(`${at("todo")}/pages/search?q=zzzz&today=2026-09-01`, { waitUntil: "networkidle" });
  await finder.waitForSelector('[data-testid="search-heading"]', { timeout: 20_000 });
  const nothing = await finder.evaluate(() => ({
    heading: document.querySelector('[data-testid="search-heading"]')?.textContent?.trim() ?? "",
    searched: document.querySelector('[data-testid="search-searched"]')?.textContent?.trim() ?? "",
    beginnings: [...document.querySelectorAll('[data-testid="search-to-create"] h2')].map((h) => h.textContent?.trim()),
    prefilled: [...document.querySelectorAll('[data-testid="search-to-create"] input')].some((input) => input.value === "zzzz"),
  }));
  await finder.close();
  const phoneFinder = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phoneFinder.goto(`${at("todo")}/pages/search?q=the&today=2026-09-01`, { waitUntil: "networkidle" });
  await phoneFinder.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await phoneFinder.waitForSelector('[data-testid="search-heading"]', { timeout: 20_000 });
  await phoneFinder.waitForTimeout(300);
  const onAPhone = await hygiene(phoneFinder);
  await phoneFinder.close();
  report.checks.theWordsFindItOnAPage = {
    cold,
    intoTheList,
    typed,
    fast,
    nothing,
    bigEnoughToHit: onAPhone.bigEnoughToHit,
    ok:
      cold.groups.includes("task") &&
      cold.hits > 3 &&
      (cold.taskList ?? "").endsWith("/tasks?q=the") &&
      intoTheList.url.endsWith("/tasks?q=the") &&
      intoTheList.query === "the" &&
      intoTheList.rows > 0 &&
      intoTheList.rows <= cold.hits &&
      typed.url.endsWith("/search?q=deposit") &&
      typed.hits.some((label) => /deposit/i.test(label ?? "")) &&
      fast.box === "pay the deposit now" &&
      fast.q === "pay the deposit now" &&
      /Nothing here is called/.test(nothing.heading) &&
      /is:any/.test(nothing.searched) &&
      nothing.beginnings.length > 0 &&
      nothing.prefilled &&
      onAPhone.noSideScroll,
  };
}

async function aRecordEditsWhereItIsShown(desk2) {
  /* A record edits where it is shown, through the act the framework found. */
  await desk2.goto(`${at("todo")}/pages/tasks/t-deposit?today=2026-09-01`, { waitUntil: "networkidle" });
  await desk2.waitForSelector('[data-testid="record-fields"]', { timeout: 20_000 });
  // The HEADING is the name, so the heading is where the name is changed —
  // `readableFields` leaves the label out of the facts because it is
  // already the heading.
  await desk2.locator(':is([data-graview-page-title], h1) [data-graview-editable="rename"]').first().click();
  await desk2.waitForSelector('[data-testid="edit-label"] input', { timeout: 10_000 });
  await desk2.fill('[data-testid="edit-label"] input', "Pay the deposit today");
  await desk2.click('[data-testid="edit-label"] button[type="submit"]');
  await desk2.waitForTimeout(600);
  const edited = await desk2.evaluate(() => ({
    heading: (document.querySelector("[data-graview-page-title]") ?? document.querySelector("main h1"))?.textContent?.trim() ?? null,
    stillAForm: document.querySelector('[data-testid="edit-label"]') !== null,
  }));
  report.checks.aRecordEditsWhereItIsShown = {
    ...edited,
    ok: edited.heading === "Pay the deposit today" && !edited.stillAForm,
  };
}

async function theProblemsPageIsAnInbox(desk2) {
  /* And the problems page is an inbox: one press puts a rule right. */
  await desk2.goto(`${at("todo")}/pages/problems?today=2026-09-01`, { waitUntil: "networkidle" });
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
}

async function everyRouteOfTheOwnFaceIsReachable(axeSource) {
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
        await seen.goto(`${at("todo")}${route}?today=2026-09-01&theme=${theme}`, {
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
}

async function theCalendarIsReachable(axeSource) {
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
      await seen.goto(`${at("todo")}/?today=2026-09-01&theme=${theme}#focus=aggregate:task&in.view=the-month`, {
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
}

async function theProfilePaneIsReachable(axeSource) {
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
  const paneFindings = {};
  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"]) {
      const seen = await browser.newPage({ viewport: { width, height: 900 } });
      await seen.goto(`${at("todo")}/?today=2026-09-01&theme=${theme}`, { waitUntil: "load" });
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
}

async function backToTheReadersOwnSize(phone) {
  /* Back to the reader's own size, through the same control. */
  await phone.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await phone.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await phone.waitForTimeout(500);
  await phone.click('[data-testid="profile-button"]');
  await phone.waitForSelector('[data-testid="setting-text-size-browser"]', { timeout: 10_000 });
  await phone.click('[data-testid="setting-text-size-browser"]');
  await phone.waitForTimeout(300);
}

async function aDerivedFormApplies(phone) {
  /* ------------------------------------- a derived form actually applies */
  await phone.goto(`${at("todo")}/pages/tasks?today=2026-09-01`, { waitUntil: "networkidle" });
  await phone.waitForTimeout(500);
  const before = await phone.evaluate(
    () => document.querySelectorAll('[data-testid="records"] a').length,
  );
  // Adding one is a press beside the list's heading: its form opens under the head.
  if (!(await phone.locator('[data-testid="form-add-task"]').isVisible().catch(() => false))) await phone.click('[data-testid="act-open-add-task"]');
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
}

/** The scene offers the pages, and a record page links its stop on the scene. */
async function theTwoFacesCrossLink(desk) {
  await desk.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await desk.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  // The scene's bar is the one app bar: its switch offers the pages, and the app's name is the way to their front page.
  report.checks.sceneOffersThePages = await desk.evaluate(
    () =>
      document.querySelector('[data-testid="app-face-pages"]') !== null &&
      document.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed") === "true" &&
      document.querySelector('[data-testid="app-home"]')?.getAttribute("href") === "/pages",
  );
  await desk.goto(`${at("todo")}/pages/tasks/t-deposit?today=2026-09-01`, { waitUntil: "networkidle" });
  await desk.waitForTimeout(400);
  const spatial = await desk.evaluate(
    () => document.querySelector('[data-testid="spatial-link"]')?.getAttribute("href") ?? "",
  );
  report.checks.recordLinksItsStop = spatial === "/#focus=t-deposit";
}

async function thePicturesOnPages(desk) {
  /* ------------------------------------------------ the pictures on pages */
  await desk.goto(`${at("todo")}/pages/places?today=2026-09-01`, { waitUntil: "networkidle" });
  await desk.waitForTimeout(500);
  const index = await desk.evaluate(() => ({
    cards: [...document.querySelectorAll('[data-testid="place-card"]')].map((a) => a.getAttribute("href")),
    inert: [...document.querySelectorAll('[data-testid="place-picture"]')].every(
      (el) => el.hasAttribute("inert") && el.getAttribute("aria-hidden") === "true",
    ),
    // Each picture is the lens itself, drawn: something is in the frame.
    drawn: [...document.querySelectorAll('[data-testid="place-picture"]')].every((el) => el.querySelector("*") !== null),
    nav: [...document.querySelectorAll("nav a, nav [data-place-path]")].map((a) => (a.textContent ?? "").trim()),
    outsideTheBar: [...document.querySelectorAll("nav a, nav [data-place-path]")].filter((a) => !a.closest("[data-graview-app-bar]")).map((a) => (a.textContent ?? "").trim()),
  }));
  report.checks.placesIndex = { cards: index.cards, inert: index.inert, drawn: index.drawn, ok: index.cards.length >= 2 && index.inert && index.drawn };
  // The places are the one bar's (FR-131, FR-138): the pictures and the kinds are offered there, and no rail under it says them again.
  report.checks.navMirrorsTheBar = {
    nav: index.nav,
    outsideTheBar: index.outsideTheBar,
    ok: index.nav.some((text) => text.startsWith("The week")) && index.nav.some((text) => text.startsWith("Tasks")) && index.outsideTheBar.length === 0,
  };
  await desk.goto(`${at("todo")}/pages/places/the-week?today=2026-09-01`, { waitUntil: "networkidle" });
  await desk.waitForTimeout(500);
  const lens = await desk.evaluate(() => ({
    present: document.querySelector('[data-testid="place-lens"]') !== null,
    picks: document.querySelectorAll('[data-testid="place-lens"] [data-graview-pick]').length,
    // Its own way to its kind as a list, and not the other places again: those are the bar's (FR-138).
    asList: document.querySelector('[data-testid="place-as-list"]')?.getAttribute("href") ?? null,
    repeats: document.querySelector('[data-testid="place-stop"], [data-testid="sibling-pictures"]') !== null,
    noSideScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
  }));
  report.checks.placePage = { ...lens, ok: lens.present && lens.picks > 0 && lens.asList === "/pages/tasks" && !lens.repeats && lens.noSideScroll };
  // A pick inside the picture travels to the record.
  // A moment in the week has its own children under the pointer; the click lands on them and bubbles, as a finger's would.
  await desk.click('[data-testid="place-lens"] [data-graview-pick]', { force: true });
  await desk.waitForTimeout(500);
  const landed = await desk.evaluate(() => location.pathname);
  report.checks.aPickTravelsToTheRecord = { landed, ok: /^\/pages\/tasks\/.+/.test(landed) };
}

async function thePicturesAtAPhonesWidth() {
  // The index and a picture at a phone's width: one column, nothing side-scrolls the document.
  const phone3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone3.goto(`${at("todo")}/pages/places?today=2026-09-01`, { waitUntil: "networkidle" });
  await phone3.waitForTimeout(400);
  report.checks.phonePlaces = await hygiene(phone3);
  await phone3.goto(`${at("todo")}/pages/places/the-week?today=2026-09-01`, { waitUntil: "networkidle" });
  await phone3.waitForTimeout(400);
  report.checks.phonePlace = await hygiene(phone3);
  await phone3.close();
}

async function theAssistantOnEveryPage() {
  /* ------------------------------------------ the quick ask on every page (Roadmap f-quick-ask-framework) */
  const asker = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await asker.goto(`${at("todo")}/pages/tasks/t-deposit?today=2026-09-01&fresh=1&ai=stub`, { waitUntil: "networkidle" });
  await asker.waitForTimeout(600);
  /* No Ask box on the page: no field at its foot, no box for one. */
  const box = await asker.evaluate(() => document.querySelector('[data-testid="seat-field"], [data-testid="page-seat"], [data-testid="seat"]') !== null);
  /* ⌘K: the bar, beside the page's heading, about the record the route names. */
  await asker.locator("main").first().click({ position: { x: 4, y: 4 } }).catch(() => {});
  await asker.keyboard.press("ControlOrMeta+K");
  await asker.waitForSelector('[data-testid="quick-ask"]', { timeout: 30_000 });
  const bar = await asker.evaluate(() => {
    const card = document.querySelector('[data-testid="quick-ask"]');
    return { about: card?.querySelector('[data-testid="quick-ask-about"]')?.textContent?.trim() ?? null, beside: card?.getAttribute("data-quick-ask-beside") ?? null, rows: [...document.querySelectorAll('[data-testid="quick-ask-option"]')].map((row) => row.getAttribute("data-quick-ask-kind")) };
  });
  report.checks.theAssistantIsOnThePage = { askBox: box, ...bar, ok: !box && (bar.about ?? "").includes("deposit") && bar.beside === "page" && bar.rows.length > 0 };
  /* A question, answered on the card. */
  await asker.fill('[data-testid="quick-ask-input"]', "what is left to do here?");
  await asker.press('[data-testid="quick-ask-input"]', "Enter");
  await asker.waitForFunction(() => /as drafted/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? ""), undefined, { timeout: 15_000 }).catch(() => {});
  const answered = await asker.evaluate(() => (document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? "").slice(0, 160));
  report.checks.aGroundedQuestionIsAnswered = { answered, ok: /as drafted/.test(answered) };
  await asker.close();
  /* The quick ask's card on a phone: nothing side-scrolls the document. */
  const phone4 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone4.goto(`${at("todo")}/pages/tasks?today=2026-09-01&ai=stub`, { waitUntil: "networkidle" });
  await phone4.waitForTimeout(500);
  await phone4.keyboard.press("ControlOrMeta+K");
  await phone4.waitForSelector('[data-testid="quick-ask"]', { timeout: 30_000 }).catch(() => {});
  await phone4.waitForTimeout(400);
  report.checks.phoneAsk = await hygiene(phone4);
  await phone4.close();
}

/** Relationships as structure, on seedbed's derived pages: the map, a list grouped by a relation, a record that links the other way round. */
async function relationshipsAsStructure(bed) {
  await bed.goto(`${at("seedbed")}/pages/map?chapter=9`, { waitUntil: "networkidle" });
  await bed.waitForTimeout(500);
  const map = await bed.evaluate(() => ({
    relations: [...document.querySelectorAll('[data-testid="relation"]')].map((li) => ({
      edge: li.getAttribute("data-relation"),
      count: Number((li.querySelector("a[href*='with=']")?.textContent ?? "").trim()),
      marked: li.querySelector('[data-testid="relation-mark"]') !== null,
    })),
    kinds: document.querySelectorAll('[data-testid="map-kinds"] li').length,
  }));
  report.checks.theMapSaysHowItFitsTogether = {
    ...map,
    ok: map.relations.length >= 2 && map.relations.every((r) => r.marked) && map.relations.some((r) => r.edge === "grows-in" && r.count === 2) && map.kinds >= 3,
  };
  // A list grouped by a relation is a link you can send: opened cold, the same groups.
  await bed.goto(`${at("seedbed")}/pages/plantings?chapter=9&by=grows-in&past=1`, { waitUntil: "networkidle" });
  await bed.waitForTimeout(500);
  const grouped = await bed.evaluate(() => ({
    groups: [...document.querySelectorAll('[data-testid="list-group"] h2')].map((h) => (h.textContent ?? "").trim()),
    by: document.querySelector('[data-testid="arrange-group"]')?.value ?? null,
    related: document.querySelector('[data-testid="kind-relations"]') !== null,
  }));
  report.checks.aListGroupsByARelation = {
    ...grouped,
    ok: grouped.groups.length === 2 && grouped.groups.some((g) => g.startsWith("Plot 1")) && grouped.by === "grows-in" && grouped.related,
  };
  // A record links the other way round: the far kind's list, narrowed to it.
  await bed.goto(`${at("seedbed")}/pages/gardeners/june?chapter=9`, { waitUntil: "networkidle" });
  await bed.waitForTimeout(500);
  const related = await bed.evaluate(() => document.querySelector('[data-testid="related-all"]')?.getAttribute("href") ?? null);
  await bed.click('[data-testid="related-all"]');
  await bed.waitForTimeout(500);
  const narrowed = await bed.evaluate(() => ({
    path: location.pathname + location.search,
    rows: document.querySelectorAll('[data-testid="records"] li').length,
    note: [...document.querySelectorAll('[data-testid="arrange-condition"]')].map((token) => token.textContent?.trim()).join(" ") || null,
  }));
  report.checks.aRecordLinksTheOtherWayRound = {
    related,
    ...narrowed,
    ok: related === "/pages/plots?tended-by=june" && narrowed.rows === 1 && narrowed.note !== null && narrowed.note.includes("June"),
  };
}

async function theDerivedListArrangesOnOneQuietLine() {
  /* The same line on the framework's own list page, which seedbed keeps: near the top, no select, every way to arrange by keyboard. */
  const heads = [];
  let keys = null;
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${at("seedbed")}/pages/plantings?chapter=9&sort=label`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="records"]', { timeout: 20_000 });
    await page.waitForTimeout(300);
    heads.push({ width: viewport.width, ...(await listHead(page)) });
    if (viewport.width === 1440) keys = await arrangeByKeyboard(page, "arrange");
    await page.close();
  }
  report.checks.theDerivedListArrangesOnOneQuietLine = {
    heads,
    keys,
    ok: heads.every((one) => one.fromTop !== null && one.fromTop <= (one.width >= 1000 ? FIRST_RECORD_WITHIN.desk : FIRST_RECORD_WITHIN.phone) && one.selects === 0 && !one.countedInAnEyebrow && !one.scrolls) && keys?.ok === true,
  };
}

async function aLargeListHasAWayThrough() {
  /*
   * A LARGE LIST HAS A WAY THROUGH IT (Discography's 479 albums, its own
   * design drawing the framework's list): newest first, said on the line;
   * each row saying whose and when; an index of years that jumps; and the
   * bar's "Narrow…" never cut at its box's edge, at a desk and on a phone.
   */
  const seen = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${at("discography")}/pages/albums`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="records"]', { timeout: 30_000 });
    await page.waitForTimeout(400);
    const read = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="nav-find"]');
      let placeholderFits = null;
      if (box && box.getBoundingClientRect().width > 0) {
        const style = getComputedStyle(box);
        const pen = document.createElement("canvas").getContext("2d");
        pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        placeholderFits = pen.measureText(box.placeholder).width <= box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + 0.5;
      }
      const rows = [...document.querySelectorAll('[data-testid="records"] [data-testid="record-row"]')];
      return {
        sort: document.querySelector('button[data-testid="arrange-sort"]')?.getAttribute("aria-label") ?? null,
        years: [...document.querySelectorAll('[data-testid="list-index"] a')].map((a) => a.textContent?.trim()).slice(0, 4),
        rows: rows.length,
        saysWhoseAndWhen: rows.slice(0, 20).every((row) => /\d{4}/.test(row.textContent ?? "") && (row.textContent ?? "").includes(" · ")),
        placeholder: box?.placeholder ?? null,
        placeholderFits,
        selects: [...document.querySelectorAll('[role="group"][aria-label="Arrange"] select')].length,
        eyebrow: document.querySelector(".ln-eyebrow") !== null && document.querySelector("main .ln-eyebrow")?.textContent?.includes("discography"),
        // No entry of the index cut at its edge, nor the index wider than the page.
        indexCut: (() => {
          const index = document.querySelector('[data-testid="list-index"]');
          if (!index) return null;
          const box = index.getBoundingClientRect();
          return index.scrollWidth > index.clientWidth + 1 || [...index.querySelectorAll("a")].some((a) => { const at = a.getBoundingClientRect(); return at.right > box.right + 1 || at.right > document.documentElement.clientWidth; });
        })(),
      };
    });
    // The index jumps: the fifth year's heading comes to the top of the window.
    const fifth = page.locator('[data-testid="list-index"] a').nth(4);
    let jumped = null;
    if (await fifth.isVisible().catch(() => false)) {
      const year = (await fifth.textContent())?.trim();
      await fifth.click();
      await page.waitForTimeout(300);
      jumped = await page.evaluate((year) => {
        const heading = [...document.querySelectorAll('[data-testid="list-section"] h2')].find((h) => h.textContent?.trim() === year);
        return heading ? Math.round(heading.getBoundingClientRect().top) : null;
      }, year);
    }
    seen.push({ width: viewport.width, ...read, jumped });
    await page.close();
  }
  report.checks.aLargeListHasAWayThrough = {
    seen,
    ok: seen.every(
      (one) =>
        /^Sorted by released, latest first$/.test(one.sort ?? "") &&
        one.years.length === 4 &&
        one.rows > 400 &&
        one.saysWhoseAndWhen &&
        one.selects === 0 &&
        one.indexCut === false &&
        !one.eyebrow &&
        (one.placeholderFits === null || one.placeholderFits) &&
        one.jumped !== null && one.jumped >= 0 && one.jumped < 160,
    ),
  };
}

async function aListReadsOnOneScale() {
  /*
   * A LIST READS WELL BY DEFAULT (the gauntlet's Program, the derived face
   * with nothing of its own). Nick, on its Sessions grouped by day: the
   * title very large, every row's name bold and wrapping to a third and
   * fourth line on a phone so every row shouted, "Sep 25, 2017" under a
   * heading that said "Sep 25, 2017", the glance pushed to the right edge
   * at whatever x its length left it, and the Ask box over the last rows.
   * Read at a desk and a phone at the reader's 16px, and on a phone at 32.
   */
  const seen = [];
  for (const { width, height, root } of [{ width: 1440, height: 900, root: 16 }, { width: 390, height: 844, root: 16 }, { width: 390, height: 844, root: 32 }]) {
    const page = await browser.newPage({ viewport: { width, height } });
    for (const path of ["/pages/sessions?group=day&sort=label", "/pages/talks"]) {
      await page.goto(`${at("gauntlet")}${path}`, { waitUntil: "load", timeout: 120_000 });
      await page.waitForSelector('[data-testid="records"] li', { timeout: 120_000 });
      await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, root);
      await page.waitForTimeout(500);
      const read = await page.evaluate((root) => {
        const px = (element) => (element ? Number.parseFloat(getComputedStyle(element).fontSize) : null);
        // The steps of the theme's scale, at this root: a minor third apart, the title one step down (1.44) on a phone.
        const steps = [0.833, 1, 1.2, 1.44, 1.728].map((step) => step * root);
        const rows = [...document.querySelectorAll('[data-testid="records"] li')].slice(0, 60);
        const names = rows.map((row) => row.querySelector("a"));
        const glances = rows.map((row) => row.querySelector(".graview-row-glance")).filter(Boolean);
        const heads = [...document.querySelectorAll('[data-testid="list-group"] > h2, [data-testid="list-section"] > h2')];
        const sizes = {
          title: px(document.querySelector("[data-graview-page-title]")),
          description: px(document.querySelector("[data-graview-page-title]")?.closest("header")?.querySelector(":scope > p") ?? null),
          name: px(names[0]),
          glance: px(glances[0]),
          heading: px(heads[0]),
        };
        const leading = Number.parseFloat(getComputedStyle(names[0]).lineHeight);
        // Each group's own words — its heading less its count — said again on one of its rows.
        const repeats = [...document.querySelectorAll('[data-testid="list-group"]')].flatMap((group) => {
          const said = (group.querySelector("h2")?.firstChild?.textContent ?? "").trim();
          return [...group.querySelectorAll("li")].filter((row) => said && (row.textContent ?? "").includes(said)).map((row) => `${said} in “${(row.textContent ?? "").trim().slice(0, 60)}”`);
        });
        return {
          sizes,
          offScale: Object.entries(sizes).filter(([, size]) => size !== null && !steps.some((step) => Math.abs(step - size) < 0.6)).map(([part, size]) => `${part} ${size}px`),
          nameWeight: Number.parseInt(getComputedStyle(names[0]).fontWeight, 10),
          groups: document.querySelectorAll('[data-testid="list-group"]').length,
          repeats: repeats.slice(0, 3),
          longerThanTwoLines: names.filter((name) => name.getBoundingClientRect().height > 2 * leading + 1).length,
          heights: [...new Set(rows.map((row) => Math.round(row.getBoundingClientRect().height)))],
          glances: glances.length,
          glanceXs: [...new Set(glances.map((glance) => Math.round(glance.getBoundingClientRect().left)))],
          scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      }, root);
      seen.push({ path, width, root, ...read, ...(await hygiene(page)), end: await endClearsTheFoot(page) });
    }
    await page.close();
  }
  const sessions = seen.filter((one) => one.path.startsWith("/pages/sessions"));
  report.checks.noListRowRepeatsTheFieldItsGroupHeadingSays = {
    seen: sessions.map(({ width, root, groups, repeats }) => ({ width, root, groups, repeats })),
    ok: sessions.length === 3 && sessions.every((one) => one.groups > 0 && one.repeats.length === 0),
  };
  report.checks.rowTitlesClampToTwoLinesAndRowsAreOneOfTwoHeights = {
    seen: seen.map(({ path, width, root, longerThanTwoLines, heights }) => ({ path, width, root, longerThanTwoLines, heights })),
    // At 32px a glance may wrap under its name on a phone; the name never runs past two lines.
    ok: seen.every((one) => one.longerThanTwoLines === 0 && (one.root !== 16 || one.heights.length <= 2)),
  };
  const desk = seen.find((one) => one.width === 1440 && one.path === "/pages/talks");
  report.checks.theDatesDownAListShareAnXOnADesk = {
    seen: desk ? { glances: desk.glances, xs: desk.glanceXs } : null,
    ok: Boolean(desk && desk.glances >= 20 && desk.glanceXs.length === 1),
  };
  report.checks.theLastRowScrollsClearOfTheFoot = {
    seen: seen.map(({ path, width, root, end }) => ({ path, width, root, ...end })),
    ok: seen.filter((one) => one.root === 16).every((one) => one.end.ok),
  };
  report.checks.aListsTypeComesFromTheScale = {
    seen: seen.map(({ path, width, root, sizes, offScale, nameWeight, scrolls, bigEnoughToHit }) => ({ path, width, root, sizes, offScale, nameWeight, scrolls, bigEnoughToHit })),
    ok: seen.every((one) => one.offScale.length === 0 && one.nameWeight <= 500 && !one.scrolls),
  };
}

async function aLargeStoreReloadsWithItsEdit() {
  /*
   * A STORE TOO LARGE FOR LOCALSTORAGE IS KEPT (the engines leg, #330).
   * WebKit keeps 5 MB of localStorage an origin and counts each character
   * twice, so the gauntlet's 2.8 MB seed did not fit: the store opened,
   * reported the failed write, and a reload had forgotten every edit. The
   * browser adapter keeps it in IndexedDB now. Here, in whichever engine
   * this run is: start fresh, add a session through the derived form,
   * reload remembering, and find it again.
   */
  const LABEL = "Kept across a reload";
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const failed = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("persistence failed")) failed.push(message.text().slice(0, 200));
  });
  await page.goto(`${at("gauntlet")}/pages/sessions?remember=1&fresh=1`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForSelector('[data-testid="records"] li', { timeout: 120_000 });
  if (!(await page.locator('[data-testid="form-add-session"]').isVisible().catch(() => false))) await page.click('[data-testid="act-open-add-session"]');
  await page.fill('[data-testid="form-add-session"] input[name="label"]', LABEL);
  await page.fill('[data-testid="form-add-session"] input[name="day"]', "2017-09-25");
  await page.click('[data-testid="form-add-session"] button[type="submit"]');
  // The write of 2.8 MB settles on its own time; ask what is kept until it says so.
  let kept = null;
  for (let tries = 0; tries < 20 && !kept?.nodes?.some((node) => node.label === LABEL); tries++) {
    await page.waitForTimeout(500);
    kept = await stored(page, "graview:Program:snapshot");
  }
  const log = (await stored(page, "graview:Program:log")) ?? [];
  await page.goto(`${at("gauntlet")}/pages/search?q=${encodeURIComponent(LABEL)}&remember=1`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForFunction((label) => document.querySelector("main")?.textContent?.includes(label), LABEL, { timeout: 30_000 }).catch(() => undefined);
  const found = await page.evaluate((label) => document.querySelector("main")?.textContent?.includes(label) ?? false, LABEL);
  report.checks.aLargeStoreReloadsWithItsEdit = {
    engine: ENGINE,
    storedNodes: kept?.nodes?.length ?? 0,
    keptTheEdit: kept?.nodes?.some((node) => node.label === LABEL) ?? false,
    logged: log.length,
    foundAfterTheReload: found,
    failed,
    ok: (kept?.nodes?.length ?? 0) > 1000 && log.length > 0 && found && failed.length === 0,
  };
  await page.close();
}

async function aShortPagesPaperFillsTheWindow() {
  /* A design's short page (the almanac's two gardeners): its paper fills the window, and nothing side-scrolls. */
  const seen = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${at("seedbed")}/pages/gardeners?chapter=13`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="records"]', { timeout: 20_000 });
    await page.waitForTimeout(400);
    const head = await listHead(page);
    const paper = await page.evaluate(() => Math.round(document.querySelector('[data-testid="seedbed-design"]')?.getBoundingClientRect().bottom ?? 0));
    seen.push({ width: viewport.width, paperEndsAt: paper, window: viewport.height, scrolls: head.scrolls });
    await page.close();
  }
  report.checks.aShortPagesPaperFillsTheWindow = {
    seen,
    ok: seen.every((one) => one.paperEndsAt >= one.window - 2 && !one.scrolls),
  };
}

/** Seedbed's map at a phone's width, read for its hygiene. */
async function theMapOnAPhone() {
  const small = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await small.goto(`${at("seedbed")}/pages/map?chapter=9`, { waitUntil: "networkidle" });
  await small.waitForTimeout(400);
  const seen = await hygiene(small);
  await small.close();
  report.checks.phoneMap = seen;
}

/* ------------------------------------------- the landing is a gallery */
/*
 * THE HOME IS THE PICTURES, LARGE AND LIVE — measured, not asserted.
 *
 * The derived home read as a readme: a sentence of counts, the relations,
 * a section per kind, with the app's own pictures as two 288-pixel cards
 * between them. On the framework's default face — seedbed's finished
 * garden, which registers no shell of its own — the gallery has to be the
 * first thing after the header (chapter sixteen, the garden with every
 * lens it ever grew), two across at a desk and one on a phone,
 * every card wide enough to see into and every frame with something drawn
 * in it. Chapter nine has no titled lens at all, so it proves the other
 * half: a kind with no picture is drawn anyway.
 */
async function readGallery(page, path) {
  await page.goto(`${at("seedbed")}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  /*
   * A picture is drawn as it nears the window (the first load, 0.1.31):
   * each card is scrolled to, so every frame has had its chance to draw,
   * and the page is read from its top again.
   */
  const cardCount = await page.locator('[data-testid="place-card"], [data-testid="kind-card"]').count();
  for (let at = 0; at < cardCount; at++) {
    await page.locator('[data-testid="place-card"], [data-testid="kind-card"]').nth(at).scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const scroller of document.querySelectorAll("*")) if (scroller.scrollTop > 0) scroller.scrollTop = 0;
  });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const sections = [...(main?.children ?? [])];
    const gallery = document.querySelector('[data-testid="gallery"]');
    const cards = [...document.querySelectorAll('[data-testid="place-card"], [data-testid="kind-card"]')];
    const tops = cards.map((card) => Math.round(card.getBoundingClientRect().top));
    /* The bar's row, control by control (FR-138): the lines their middles stand on, and its height. */
    const bar = document.querySelector("[data-graview-app-bar]");
    const middles = [...(bar?.querySelectorAll(".graview-bar-row a, .graview-bar-row button, .graview-bar-row input") ?? [])]
      .filter((one) => !one.closest("[hidden], .graview-bar-list") && one.getBoundingClientRect().width > 2)
      .map((one) => { const box = one.getBoundingClientRect(); return (box.top + box.bottom) / 2; })
      .sort((a, b) => a - b);
    const barLines = middles.reduce((lines, middle, at) => (at === 0 || middle - middles[at - 1] > 3 ? lines + 1 : lines), 0);
    return {
      headerThenGallery: sections[0]?.tagName === "HEADER" && sections[1] === gallery,
      cards: cards.length,
      placeCards: document.querySelectorAll('[data-testid="place-card"]').length,
      kindCards: document.querySelectorAll('[data-testid="kind-card"]').length,
      narrowest: Math.min(...cards.map((card) => Math.round(card.getBoundingClientRect().width))),
      // Two cards sharing a top are two cards in one row.
      rows: new Set(tops).size,
      barLines,
      barHeight: bar ? Math.round(bar.getBoundingClientRect().height) : null,
      drawn: cards.every((card) => card.querySelector('[data-testid$="-picture"] > span > *') !== null),
      noSideScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
      readmeGone: !document.querySelector('main [data-testid="kind-map"]') && !/none yet<\/span><\/div><p/.test(main?.innerHTML ?? ""),
    };
  });
}

/** The landing is a gallery at a desk and on a phone, and chapter nine's kinds are drawn though none has a picture. Returns the two readings the bar's own claim is judged from. */
async function theLandingIsAGallery() {
  const wideDesk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const deskGallery = await readGallery(wideDesk, "/pages?chapter=16");
  const deskNine = await readGallery(wideDesk, "/pages?chapter=9");
  await wideDesk.close();
  const narrow = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const phoneGallery = await readGallery(narrow, "/pages?chapter=16");
  await narrow.close();
  report.checks.theLandingIsAGallery = {
    desk: deskGallery,
    phone: phoneGallery,
    chapterNine: deskNine,
    ok:
      deskGallery.headerThenGallery &&
      deskGallery.placeCards >= 4 &&
      deskGallery.narrowest >= 420 &&
      deskGallery.rows < deskGallery.cards &&
      deskGallery.drawn &&
      deskGallery.readmeGone &&
      phoneGallery.headerThenGallery &&
      phoneGallery.rows === phoneGallery.cards &&
      phoneGallery.noSideScroll &&
      deskNine.placeCards === 0 &&
      deskNine.kindCards >= 4 &&
      deskNine.drawn,
  };
  return { deskGallery, phoneGallery };
}

async function aNewPageOpensAtItsTop() {
  /* A new page opens at its top, however far down the gallery the press was. */
  const scroller = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await scroller.goto(`${at("seedbed")}/pages?chapter=16`, { waitUntil: "networkidle" });
  await scroller.waitForTimeout(500);
  await scroller.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await scroller.waitForTimeout(200);
  const pressedFrom = await scroller.evaluate(() => window.scrollY);
  await scroller.click('[data-testid="kinds"] a[href="/pages/rules"]');
  await scroller.waitForTimeout(500);
  const landedAt = await scroller.evaluate(() => ({ path: location.pathname, scrollY: window.scrollY }));
  // And Back is left to the browser, which puts the gallery where it was left.
  await scroller.goBack({ waitUntil: "networkidle" });
  await scroller.waitForTimeout(500);
  const cameBackTo = await scroller.evaluate(() => window.scrollY);
  await scroller.close();
  report.checks.aNewPageOpensAtItsTop = {
    pressedFrom,
    landedAt,
    cameBackTo,
    ok: pressedFrom > 400 && landedAt.path === "/pages/rules" && landedAt.scrollY === 0 && cameBackTo > 400,
  };
}

/*
 * A RECORD'S PAGE SAYS WHERE IT IS (Roadmap gv-pages-where-am-i). People
 * caught in the derived pages did not know where they were: the page now
 * opens with a trail — a nav called "You are here", the kind's list a link,
 * the record itself last and current, which the heading under it says — on
 * one line at a phone's width, and its link goes where it says, under the
 * face's base. Seedbed's chapter nine keeps the derived record page, in
 * every engine, at 390 and 1440; and a planting's page says the section
 * the garden's registry put plantings in first ("The garden › Plantings").
 */
async function aRecordPageSaysWhereItIs() {
  const seen = [];
  for (const engine of ENGINES) {
    const own = engine === ENGINE ? browser : await launchEngine(engine, { headless: true });
    try {
      for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
        const page = await own.newPage({ viewport });
        await page.goto(`${at("seedbed")}/pages/gardeners/june?chapter=9`, { waitUntil: "networkidle" });
        await page.waitForSelector('nav[aria-label="You are here"]', { timeout: 15_000 }).catch(() => {});
        const said = await page.evaluate(() => {
          const trails = [...document.querySelectorAll('nav[aria-label="You are here"]')];
          const trail = trails[0];
          const links = [...(trail?.querySelectorAll("a") ?? [])];
          const box = trail?.querySelector("ol")?.getBoundingClientRect();
          const current = trail?.querySelector('[aria-current="page"]');
          return {
            trails: trails.length,
            links: links.map((a) => ({ words: (a.textContent ?? "").trim(), href: a.getAttribute("href") })),
            current: (current?.textContent ?? "").trim(),
            heading: (document.querySelector("[data-graview-page-title]")?.textContent ?? "").trim(),
            // The page's own name is said once to the eye, by its heading.
            currentOutOfSight: current ? current.getBoundingClientRect().width <= 1 : false,
            oneLine: box ? box.height <= 32 : false,
            noSideScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
          };
        });
        await page.click('nav[aria-label="You are here"] a[href="/pages/gardeners"]').catch(() => {});
        // The address moves before the list is drawn: wait for the page it went to, not only its path (WebKit read the record's heading still standing).
        await page
          .waitForFunction(() => location.pathname === "/pages/gardeners" && (document.querySelector("[data-graview-page-title]")?.textContent ?? "").trim() === "Gardeners", undefined, { timeout: 10_000 })
          .catch(() => {});
        const went = await page.evaluate(() => ({ path: location.pathname, heading: (document.querySelector("[data-graview-page-title]")?.textContent ?? "").trim() }));
        await page.goto(`${at("seedbed")}/pages/plantings/beans?chapter=9`, { waitUntil: "networkidle" });
        await page.waitForSelector('nav[aria-label="You are here"]', { timeout: 15_000 }).catch(() => {});
        const inSection = await page.evaluate(() => {
          const trail = document.querySelector('nav[aria-label="You are here"]');
          const box = trail?.querySelector("ol")?.getBoundingClientRect();
          return {
            steps: [...(trail?.querySelectorAll("li:not([aria-current])") ?? [])].map((li) => (li.textContent ?? "").replace("›", "").trim()),
            links: [...(trail?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href")),
            current: (trail?.querySelector('[aria-current="page"]')?.textContent ?? "").trim(),
            oneLine: box ? box.height <= 32 : false,
          };
        });
        await page.close();
        seen.push({ engine, width: viewport.width, ...said, went, inSection });
      }
    } finally {
      if (own !== browser) await own.close();
    }
  }
  report.checks.aRecordPageSaysWhereItIs = {
    seen,
    ok:
      seen.length === ENGINES.length * 2 &&
      seen.every(
        (one) =>
          one.trails === 1 &&
          one.links.length === 1 &&
          one.links[0].words === "Gardeners" &&
          one.links[0].href === "/pages/gardeners" &&
          one.current === one.heading &&
          one.current.length > 0 &&
          one.currentOutOfSight &&
          one.oneLine &&
          one.noSideScroll &&
          one.went.path === "/pages/gardeners" &&
          one.went.heading === "Gardeners" &&
          one.inSection.steps.join(" › ") === "The garden › Plantings" &&
          one.inSection.links.join(" ") === "/pages/plantings" &&
          one.inSection.current === "Beans" &&
          one.inSection.oneLine,
      ),
  };
}

/** The bar is one row, at a desk and on a phone: read from the gallery's own readings. */
async function theBarIsOneRow(deskGallery, phoneGallery) {
  report.checks.theBarIsOneRow = {
    desk: { lines: deskGallery.barLines, height: deskGallery.barHeight },
    phone: { lines: phoneGallery.barLines, height: phoneGallery.barHeight },
    ok: deskGallery.barLines === 1 && phoneGallery.barLines === 1 && deskGallery.barHeight <= 48 && phoneGallery.barHeight <= 48 && phoneGallery.noSideScroll,
  };
}

/* ------------------- a page draws with whatever the picture needs */
/*
 * HTML AND CANVAS BOTH, AND HTML-IN-CANVAS NEITHER.
 *
 * The routed face is derived from a schema and was traditional on purpose,
 * which is the right shape for lists and records and the wrong ceiling for a
 * picture — so a lens that wants a drawing surface gets one here, on a phone
 * as much as on a desk. Todo's "What is left" is that lens: a burn-down, one
 * stroke per day, sized from the box the page gives it.
 *
 * The exception is the capture path the spatial scene's GPU renderer uses.
 * `layoutsubtree` is the whole of its opt-in, it is Chromium-only and behind
 * a flag, and on this face it is not defaulted off but absent. Checked on
 * every route rather than asserted once.
 */
async function aPageDrawsWithWhatThePictureNeeds() {
  try {
    const canvasChecks = {};
    for (const width of [390, 1280]) {
      const seen = await browser.newPage({ viewport: { width, height: 900 } });
      await seen.goto(`${vite.url}/pages/places/what-is-left`, { waitUntil: "load" });
      await seen.waitForSelector('[data-testid="burndown-canvas"]', { timeout: 20_000 });
      // A canvas with no pixels is a canvas that never drew.
      canvasChecks[`drawnAt${width}`] = await seen.evaluate(() => {
        const canvas = document.querySelector('[data-testid="burndown-canvas"]');
        const box = canvas.getBoundingClientRect();
        return {
          backingPixels: canvas.width > 0 && canvas.height > 0,
          fillsItsColumn: box.width > 0 && box.width <= document.documentElement.clientWidth,
          named: (canvas.getAttribute("aria-label") ?? "").length > 10,
          // The same facts in the document, for a reader the canvas cannot serve.
          factsInTheDocument: (document.querySelector('[data-testid="burndown-days"]')?.textContent ?? "").includes("left"),
          /*
           * And the facts say something IS left: the example has seven
           * dated tasks open, so its first day reads "Aug 26: 7 left". A
           * picture that read "0 left" on every day drew a flat line along
           * the bottom, and every claim above still held.
           */
          somethingIsLeft: [...document.querySelectorAll('[data-testid="burndown-days"] li')].some((li) => /: [1-9]\d* left$/.test(li.textContent ?? "")),
          daysSaidAsRead: (document.querySelector('[data-testid="burndown-days"] li')?.textContent ?? "") === "Aug 26: 7 left",
          // And the picture must not push the page sideways on a phone.
          noSidewaysPage: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        };
      });
      await seen.close();
    }
    // The same picture on the scene, where it was found reading "0 left" on every day.
    {
      const seen = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await seen.goto(`${vite.url}/#focus=aggregate%3Atask&in.view=what-is-left`, { waitUntil: "load" });
      await seen.waitForSelector('[data-testid="burndown-canvas"]', { timeout: 20_000 });
      canvasChecks.onTheSceneSomethingIsLeft = await seen.evaluate(() =>
        [...document.querySelectorAll('[data-testid="burndown-days"] li')].some((li) => /: [1-9]\d* left$/.test(li.textContent ?? "")),
      );
      await seen.close();
    }
    const routes = ["", "/problems", "/map", "/places", "/places/what-is-left", "/places/the-week", "/tasks"];
    const captured = [];
    for (const route of routes) {
      const seen = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await seen.goto(`${vite.url}/pages${route}`, { waitUntil: "load" });
      await seen.waitForTimeout(400);
      const reached = await seen.evaluate(
        () =>
          document.querySelectorAll("[layoutsubtree]").length +
          [...document.querySelectorAll("canvas")].filter((c) => "layoutSubtree" in c && c.layoutSubtree).length,
      );
      if (reached > 0) captured.push(route || "/");
      await seen.close();
    }
    report.checks.aPageDrawsWithWhatThePictureNeeds = {
      ...canvasChecks,
      noCaptureOnAnyRoute: captured.length === 0,
      routesChecked: routes.length,
    };
  } catch (error) {
    report.checks.aPageDrawsWithWhatThePictureNeeds = { ok: false, error: String(error).slice(0, 200) };
  }
}

/*
 * SEVERAL TASKS ARE ONE CHANGE. Every act on a page was on one record, so
 * marking six tasks done was six rounds. On todo's tasks: a box at a row's
 * start chooses it, Shift chooses a range, the bar says how many and offers
 * the acts they share; "Mark it done" does all three as one change, and one
 * take-back puts all three back. From the keyboard, Space chooses and
 * Cmd/Ctrl-A chooses the list, Escape puts it down and the keyboard stays
 * in the list. On a phone, a long press on a row chooses it without opening
 * it, a tap chooses the next, and the same act runs once.
 */
const rowsDrawn = (page) => page.evaluate(() => document.querySelectorAll("[data-graview-choose]").length);
const barSays = (page) => page.locator('[data-testid="several-count"]').textContent({ timeout: 5_000 }).catch(() => null);
async function severalTasksAreOneChange() {
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await desk.goto(`${at("todo")}/pages/tasks?today=2026-09-01`, { waitUntil: "networkidle" });
  await desk.waitForSelector("[data-graview-choose-box]", { timeout: 20_000 });
  const before = await rowsDrawn(desk);
  const boxes = desk.locator("[data-graview-choose-box]");
  const names = await desk.evaluate(() => [...document.querySelectorAll("[data-graview-choose-box]")].slice(0, 3).map((box) => box.getAttribute("aria-label")));
  await boxes.nth(0).hover();
  await boxes.nth(0).click();
  await boxes.nth(2).hover();
  await boxes.nth(2).click({ modifiers: ["Shift"] });
  await desk.waitForSelector('[data-testid="several-bar"]', { timeout: 10_000 });
  const chosen = {
    said: await barSays(desk),
    heard: await desk.evaluate(() => document.querySelector('[data-testid="several-count"]')?.getAttribute("role")),
    acts: await desk.locator('[data-testid="several-act"]').allTextContents(),
    names,
  };
  report.checks.severalTasksAreChosenAndSaidByCount = chosen;
  await desk.click('[data-testid="several-act"][data-mutation="finish"]', { timeout: 5_000 });
  await desk.waitForTimeout(800);
  const done = {
    rows: await rowsDrawn(desk),
    bar: await desk.locator('[data-testid="several-bar"]').count(),
    offer: (await desk.locator('[data-testid="page-undo"]').allTextContents()).join(" "),
    focus: await desk.evaluate(() => (document.activeElement && document.activeElement !== document.body ? document.activeElement.className || document.activeElement.tagName : "body")),
  };
  await desk.click('[data-testid="page-undo"]');
  await desk.waitForTimeout(600);
  const back = await rowsDrawn(desk);
  report.checks.severalTasksAreChosenAndSaidByCount = { ...chosen, ok: chosen.said === "3 tasks chosen" && chosen.heard === "status" && chosen.acts[0] === "Mark it done" && chosen.names.every((name) => /^Choose /.test(name ?? "")) };
  report.checks.threeTasksAreMarkedDoneAsOneChangeWithOneUndo = { before, done, back, ok: done.rows === before - 3 && done.bar === 0 && /Mark it done — 3 tasks/.test(done.offer) && back === before && done.focus !== "body" };

  // The keyboard alone: Space on a box, Cmd/Ctrl-A for the list, Escape to put it down.
  await boxes.nth(1).focus();
  await desk.keyboard.press("Space");
  const one = await barSays(desk);
  await desk.keyboard.press("ControlOrMeta+a");
  await desk.waitForTimeout(300);
  const all = await barSays(desk);
  // The bar's acts are next in the keyboard's order after the list.
  await boxes.last().focus();
  let reaches = false;
  for (let press = 0; press < 8 && !reaches; press += 1) {
    await desk.keyboard.press("Tab");
    reaches = await desk.evaluate(() => document.activeElement?.closest('[data-testid="several-bar"]') !== null);
  }
  await boxes.nth(1).focus();
  await desk.keyboard.press("Escape");
  await desk.waitForTimeout(300);
  const put = { bar: await desk.locator('[data-testid="several-bar"]').count(), inList: await desk.evaluate(() => document.activeElement?.closest("[data-graview-choosable]") !== null) };
  report.checks.theKeyboardChoosesAndPutsDown = { one, all, reaches, put, ok: one === "1 task chosen" && all === `${before} tasks chosen` && reaches && put.bar === 0 && put.inList };

  // The boxes are one Tab stop and the arrows move between them: three tasks in Space, ↓, Space, ↓, Space; Shift with ↓ chooses as it goes.
  await boxes.nth(0).focus();
  for (const key of ["Space", "ArrowDown", "Space", "ArrowDown", "Space"]) await desk.keyboard.press(key);
  const arrowed = await barSays(desk);
  const stops = await desk.evaluate(() => [...document.querySelectorAll("[data-graview-choose-box]")].filter((box) => box.tabIndex >= 0).length);
  await desk.keyboard.press("Escape");
  await desk.waitForTimeout(300);
  await boxes.nth(0).focus();
  for (const key of ["Space", "Shift+ArrowDown", "Shift+ArrowDown", "Shift+ArrowDown"]) await desk.keyboard.press(key);
  const extended = await barSays(desk);
  await desk.keyboard.press("Escape");
  await desk.waitForTimeout(300);
  report.checks.theArrowsChooseRowsFromOneTabStop = { arrowed, extended, stops, ok: arrowed === "3 tasks chosen" && extended === "4 tasks chosen" && stops === 1 };
  await desk.close();

  // Firefox takes no isMobile from Playwright; a touch screen is what the list asks of a phone (pointer: coarse).
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, ...(ENGINE === "firefox" ? {} : { isMobile: true }) })).newPage();
  await phone.goto(`${at("todo")}/pages/tasks?today=2026-09-01`, { waitUntil: "networkidle" });
  await phone.waitForSelector("[data-graview-choose]", { timeout: 20_000 });
  const rows = phone.locator("[data-graview-choose]");
  const atRest = await phone.evaluate(() => [...document.querySelectorAll("[data-graview-choose-box]")].filter((box) => box.getBoundingClientRect().width > 0).length);
  const phoneBefore = await rowsDrawn(phone);
  /*
   * THE FINGER RESTS until the row is chosen, then lifts. A real touch where
   * the engine takes one from outside (Chromium's CDP); elsewhere the
   * pointer events a touch is heard as, since WebKit and Firefox take no
   * held touch from Playwright — the list listens to pointers either way.
   * The rest lasts until the bar says a task is chosen, not a guessed time.
   */
  const held = await rows.nth(0).boundingBox();
  const finger = { x: held.x + held.width / 2, y: held.y + held.height / 2 };
  const touch = ENGINE === "chromium" ? await phone.context().newCDPSession(phone) : null;
  const pointer = (type) =>
    phone.evaluate(({ type, x, y }) => {
      document.elementFromPoint(x, y)?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true, clientX: x, clientY: y }));
    }, { type, ...finger });
  if (touch) await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger] });
  else await pointer("pointerdown");
  await phone.waitForSelector('[data-testid="several-count"]', { timeout: 5_000 }).catch(() => null);
  if (touch) await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  else await pointer("pointerup");
  const pressed = { how: touch ? "touch" : "pointer events", said: await barSays(phone), path: await phone.evaluate(() => location.pathname) };
  for (const at of [1, 2]) {
    const box = await rows.nth(at).boundingBox();
    await phone.touchscreen.tap(box.x + box.width / 2, box.y + Math.min(box.height / 2, 20));
    await phone.waitForFunction((n) => document.querySelector('[data-testid="several-count"]')?.textContent === `${n} tasks chosen`, at + 1, { timeout: 5_000 }).catch(() => null);
  }
  const tapped = { said: await barSays(phone), path: await phone.evaluate(() => location.pathname) };
  await phone.locator('[data-testid="several-act"][data-mutation="finish"]').tap();
  await phone.waitForTimeout(800);
  const after = { rows: await rowsDrawn(phone), offer: (await phone.locator('[data-testid="page-undo"]').allTextContents()).join(" ") };
  report.checks.onAPhoneALongPressChoosesAndOneActDoesThree = {
    atRest,
    pressed,
    tapped,
    after,
    ok: atRest === 0 && pressed.said === "1 task chosen" && pressed.path === "/pages/tasks" && tapped.said === "3 tasks chosen" && tapped.path === "/pages/tasks" && after.rows === phoneBefore - 3 && /Mark it done — 3 tasks/.test(after.offer),
  };
  report.checks.phoneChoosing = await hygiene(phone);
  await phone.close();
}

try {
  vite = await startVite("todo", portFor("todo"));
  browser = await launchEngine(ENGINE, { headless: true });

  const phone = await thePhoneFirst();
  await theReadersOwnTextSize(phone);
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
  await aListYouArrangedIsALinkYouCanSend(desk2);
  await aListArrangesOnOneQuietLine();
  await aListIsExportedAsItIsShown();
  await anEmptyStateSaysWhatToDoNext(desk2);
  await theWordsFindItOnAPage();
  await aRecordEditsWhereItIsShown(desk2);
  await theProblemsPageIsAnInbox(desk2);
  await desk2.close();
  await severalTasksAreOneChange();

  await everyRouteOfTheOwnFaceIsReachable(axeSource);
  await theCalendarIsReachable(axeSource);
  await theProfilePaneIsReachable(axeSource);
  await backToTheReadersOwnSize(phone);
  await aDerivedFormApplies(phone);
  await phone.close();

  /* ------------------------------------------- the two faces cross-link */
  const desk = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  await theTwoFacesCrossLink(desk);
  await thePicturesOnPages(desk);
  await desk.close();
  await thePicturesAtAPhonesWidth();
  await theAssistantOnEveryPage();

  /*
   * ---------------------------------------- relationships as structure
   * On the DERIVED pages, which the todo app has replaced with its own
   * design: seedbed's chapter nine keeps the framework's list and record
   * pages, with plots tended by gardeners and plantings that grow in plots.
   */
  garden = await startVite("seedbed", portFor("seedbed"));
  const bed = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await relationshipsAsStructure(bed);
  await aRecordPageSaysWhereItIs();
  await theDerivedListArrangesOnOneQuietLine();
  // Discography's 479 albums, for a large list's way through.
  catalog = await startVite("discography", portFor("discography"));
  await aLargeListHasAWayThrough();
  // The gauntlet's Program, the derived face with nothing of its own, for a list that reads well by default.
  program = await startVite("gauntlet", portFor("gauntlet"));
  await aListReadsOnOneScale();
  await aLargeStoreReloadsWithItsEdit();
  await aShortPagesPaperFillsTheWindow();
  await theMapOnAPhone();
  const { deskGallery, phoneGallery } = await theLandingIsAGallery();
  await aNewPageOpensAtItsTop();
  await theBarIsOneRow(deskGallery, phoneGallery);
  await bed.close();
  await aPageDrawsWithWhatThePictureNeeds();
} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  if (vite) {
    vite.stop();
  }
  if (garden) {
    garden.stop();
  }
  if (catalog) {
    catalog.stop();
  }
  if (program) {
    program.stop();
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
