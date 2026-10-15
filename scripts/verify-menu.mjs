#!/usr/bin/env node
/**
 * The menu scales — search, pins, and what you actually use, driven in a
 * real browser against the todo app.
 *
 * A pin made from the menu must reorder the same list every surface reads,
 * survive a reload (it lives in this browser's storage), outrank the app's
 * own declared pin, and come back off with the same gesture.
 *
 * The acts are the context menu now — a right-click, or the acts key on a
 * card. The strip a selection used to draw beside the picture is gone from
 * the scene, and with it the filter field and "Show N more" (the seat is a
 * guide, not a control panel): the claims about the filter went with them.
 *
 * And the same menu on the routed face, at a desk and a phone's width: a
 * row, a record's page, a value on it, a picture's mark and ground, a list's
 * ground; Shift+F10 and the context-menu key; a finger resting on the page;
 * Escape giving the keyboard back; the browser's own menu kept in a text
 * field and with Shift held; and axe over the menu while it is open.
 *
 *   node scripts/verify-menu.mjs [--engine=chromium|webkit|firefox]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let app;
let browser;
// Each claim gets three minutes; one that takes longer fails by name (lib/deadline.mjs).
const reach = deadline({
  verdict: resolve(repoRoot, "docs/menu.json"),
  report,
  cleanup: async () => {
    await browser?.close();
    app?.stop();
  },
});
app = await serving("todo", portFor("todo"), repoRoot);

const MENU = '[data-testid="context-menu"]';

/** The menu's offered mutations, in document order, via each row's pin. */
const offeredOrder = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="context-menu"] [data-pin-for]')].map(
      (star) => star.getAttribute("data-pin-for"),
    ),
  );

/** Opens a thing's acts at the pointer, as a right-click does. */
async function openActs(page, id) {
  await page.click(`[data-graview-pick="${id}"]`, { button: "right" });
  await page.waitForSelector(`${MENU} [data-pin-for]`, { timeout: 10_000 });
}

/** Puts the menu away. */
async function closeActs(page) {
  if (await page.$(MENU)) await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

try {
  reach("pinThenReorder");
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });

  /*
   * THE FILTER FIELD, "Show N more" AND ENTER ON A SOLE SURVIVOR were the
   * strip's: a selection drew every act beside the picture, past a fold. The
   * scene draws no strip now — the seat offers at most three acts and the
   * menu holds the rest — so those three claims (filterOnlyPastTheFold,
   * searchThenApply, destructiveNeedsTheClick) have no surface to hold on.
   */
  /* --------------------------------------------------- pin, then reorder */
  await openActs(page, "t-deposit");
  const before = await offeredOrder(page);
  await page.click(`${MENU} [data-pin-for="edit-task"]`);
  await page.waitForTimeout(150);
  const after = await offeredOrder(page);
  await closeActs(page);
  /*
   * On this overdue task "finish" and "reschedule" are REPAIRS, so they sit
   * in the top band where no pin may reach — which is itself part of the
   * claim. The pin's movement is measured against an unpinned peer that sits
   * above it beforehand ("rename"), and the repairs must still lead
   * afterwards.
   *
   * The peer used to be "reopen", which is offered on nothing: it sets
   * `done: false` on a task that was never finished, so it changes nothing,
   * and an act with nothing left to do is no longer offered. A peer that is
   * not there makes `indexOf` return -1, and a comparison against -1 passes
   * or fails for reasons that have nothing to do with pinning — so the peer
   * is asserted to be present before it is compared against.
   *
   * Which repair leads is the RULE'S order, not the app's pin. `finish` is
   * pinned by the declaration and used to head the band for that reason;
   * `nothing-overdue` names a new date before finishing, and a rule that
   * says how to fix itself is saying which way out it prefers. A pin still
   * moves everything below the repairs — that is what the rest of this
   * check measures. (The strip said "pinned" and "⚠" over its bands; the
   * menu draws no headings, so the order is the claim.)
   */
  report.checks.pinThenReorder = {
    before,
    after,
    peerIsOffered: before.includes("rename") && before.includes("edit-task"),
    ok:
      before.includes("rename") &&
      before.includes("edit-task") &&
      before.indexOf("edit-task") > before.indexOf("rename") &&
      after.indexOf("edit-task") < after.indexOf("rename") &&
      after.indexOf("reschedule") === 0 &&
      after.indexOf("finish") === 1,
  };

  /* -------------------------------------------- the pin is this browser's */
  reach("pinSurvivesReloadAndUnpins");
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  await openActs(page, "t-deposit");
  const survived = await offeredOrder(page);
  const pressed = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="context-menu"] [data-pin-for="edit-task"]')
        ?.getAttribute("aria-pressed") === "true",
  );
  // Unpinning is the same gesture.
  await page.click(`${MENU} [data-pin-for="edit-task"]`);
  await page.waitForTimeout(150);
  const unpinned = await offeredOrder(page);
  await closeActs(page);
  const above = (list) =>
    list.includes("rename") && list.indexOf("edit-task") < list.indexOf("rename");
  report.checks.pinSurvivesReloadAndUnpins = {
    survived: above(survived),
    pressed,
    unpinnedAgain: !above(unpinned) && unpinned.includes("rename"),
    ok: above(survived) && pressed && !above(unpinned) && unpinned.includes("rename"),
  };

  /* ------------------------------------- the dev's pin is overridable too */
  reach("devPinOverride");
  // finish is pinned by the app's own declaration. The same star demotes
  // it for this person — and brings it back. Without this, the star on a
  // declared pin was a control that visibly did nothing.
  await openActs(page, "t-book");
  await page.waitForSelector(`${MENU} [data-pin-for="finish"]`);
  const pinnedNow = () =>
    page.evaluate(() => document.querySelector('[data-testid="context-menu"] [data-pin-for="finish"]')?.getAttribute("aria-pressed") === "true");
  const declaredShown = await pinnedNow();
  await page.click(`${MENU} [data-pin-for="finish"]`);
  await page.waitForTimeout(150);
  const demotedNow = !(await pinnedNow());
  await page.click(`${MENU} [data-pin-for="finish"]`);
  await page.waitForTimeout(150);
  const restoredNow = await pinnedNow();
  await closeActs(page);
  report.checks.devPinOverride = {
    declaredShown,
    demotedNow,
    restoredNow,
    ok: declaredShown && demotedNow && restoredNow,
  };

  /* --------------------------- the list leads with the thing you clicked */
  reach("leadsWithWhatYouClicked");
  /*
   * ONE RULE, FIVE LATE TASKS, TEN REPAIRS — and until the derivation knew
   * which node the gesture landed on, it offered them in the order the rule
   * happened to name its subjects. Right-clicking the fourth late task met
   * the FIRST task's "give it a new date" at the top of the menu, so the
   * obvious press fixed somebody else's problem.
   *
   * Driven on three surfaces, because the claim is that they share one
   * rank: the scene's pointer menu, the routed record, and the problems
   * inbox, where pressing a repair must change the task it names.
   */
  const firstOffered = (page, testid) =>
    page.evaluate((id) => {
      const first = document
        .querySelector(`[data-testid="${id}"]`)
        ?.querySelector("[data-affordance]");
      return { label: (first?.textContent ?? "").trim(), rank: first?.getAttribute("data-rank") };
    }, testid);

  // 2026-09-04 leaves five tasks past their date; 2026-09-01 leaves one,
  // and one subject cannot show an order problem between subjects.
  const LATE = "today=2026-09-04";
  await page.goto(`${at("todo")}/?${LATE}&fresh=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  const led = {};
  for (const [id, label] of [
    ["t-post", "Redirect the post"],
    ["t-meter", "Read the meters"],
  ]) {
    await page.click(`[data-graview-pick="${id}"]`, { button: "right" });
    await page.waitForSelector('[data-testid="context-menu"] [data-affordance]', { timeout: 10_000 });
    const first = await firstOffered(page, "context-menu");
    led[id] = { label, ...first, names: first.label.includes(label) };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }

  /* --------------------------------- the same rank on the routed record */
  /*
   * The record renders a rule's repairs beside the rule rather than in
   * "what can be done", so the claim there is about the REPAIR list: the
   * page about the post leads with the post's own repair, not with the
   * first subject the rule happened to walk. And the acts it does list
   * carry the derivation's rank, ascending — one order, two renderings.
   */
  await page.goto(`${at("todo")}/pages/tasks/t-post?${LATE}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="record-violations"] [data-graview-repair]', {
    timeout: 20_000,
  });
  const record = {
    firstRepair: await page.evaluate(
      () =>
        (
          document
            .querySelector('[data-testid="record-violations"]')
            ?.querySelector("[data-graview-repair]")?.textContent ?? ""
        ).trim(),
    ),
    ranks: await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="record-actions"] [data-affordance]')].map(
        (button) => Number(button.getAttribute("data-rank")),
      ),
    ),
  };
  const recordLeads =
    record.firstRepair.includes("Redirect the post") &&
    record.ranks.length > 0 &&
    record.ranks.every((rank, at) => at === 0 || rank > record.ranks[at - 1]);

  /* ------------------------- the inbox's repair changes what it names */
  await page.goto(`${at("todo")}/pages/problems?${LATE}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="repairs"] [data-graview-repair]', { timeout: 20_000 });
  const finishPost = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="repairs"] [data-graview-repair="finish"]')].findIndex(
      (button) => (button.textContent ?? "").includes("Redirect the post"),
    ),
  );
  await page.evaluate(() => {
    const button = [
      ...document.querySelectorAll('[data-testid="repairs"] [data-graview-repair="finish"]'),
    ].find((candidate) => (candidate.textContent ?? "").includes("Redirect the post"));
    button?.click();
  });
  await page.waitForTimeout(500);
  // The one it named is done; the one listed above it is untouched.
  const inbox = await page.evaluate(() => {
    const said = [...document.querySelectorAll('[data-testid="repairs"] [data-graview-repair]')].map(
      (button) => (button.textContent ?? "").trim(),
    );
    return {
      postGone: !said.some((label) => label.includes("Redirect the post")),
      othersKept: said.some((label) => label.includes("Pay the deposit")),
    };
  });

  report.checks.leadsWithWhatYouClicked = {
    menu: led,
    record,
    inbox,
    namedItsOwn: finishPost > 0,
    ok:
      led["t-post"].names &&
      led["t-meter"].names &&
      led["t-post"].rank === "0" &&
      led["t-meter"].rank === "0" &&
      recordLeads &&
      inbox.postGone &&
      inbox.othersKept,
  };

  /* ------------------------------------ the keyboard keeps its place */
  reach("theKeyboardKeepsItsPlace");
  /*
   * EVERY ACT TAKEN FROM THE KEYBOARD used to end at the top of the
   * document: the list is live — an act applies and goes, a pin regroups,
   * an ask closes — and React drops focus to <body> whenever the focused
   * element goes away. In the menu, a pin keeps the keyboard in it, and an
   * act or an answered ask closes the menu and gives the keyboard back to
   * where it was opened — never to the body.
   */
  await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  const where = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      const menu = document.querySelector('[data-testid="context-menu"]');
      return {
        where:
          active === document.body
            ? "body"
            : (active?.getAttribute("data-affordance") ??
              active?.getAttribute("data-pin-for") ??
              active?.getAttribute("data-graview-view") ??
              active?.getAttribute("aria-label") ??
              active?.tagName.toLowerCase() ??
              "none"),
        inside: menu !== null && active !== null && menu.contains(active),
        body: active === document.body || active === null,
      };
    });
  const pressFromTheKeyboard = async (selector) => {
    await page.focus(selector);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    return where();
  };
  const actRow = (mutation) => `${MENU} li:has([data-pin-for="${mutation}"]) button[data-affordance]`;
  await openActs(page, "t-deposit");
  const afterAnAct = await pressFromTheKeyboard(actRow("finish"));
  await closeActs(page);
  await openActs(page, "t-book");
  const afterAPin = await pressFromTheKeyboard(`${MENU} [data-pin-for="edit-task"]`);
  await page.focus(actRow("edit-task"));
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-graview-asking]");
  await page.waitForTimeout(200);
  /*
   * ANSWER EVERY OPEN ARGUMENT, so the ask actually closes — the way a
   * person on the keyboard would: type into a field, pass over a file.
   *
   * This loop typed "90" and pressed Enter until the ask went away, which
   * held for as long as every argument was a field you type into. Then the
   * example's tasks gained attachments: the third step became a file
   * editor, the keyboard landed on "Choose files", Enter opened a file
   * chooser nobody answers, and the loop asked again forever — the nightly
   * ran out its sixty minutes with no verdict from this harness or the one
   * queued behind it. A file step is passed over by its own Skip, and the
   * loop is bounded: an ask that does not close names the step it stuck on.
   */
  const answered = [];
  for (let turn = 0; (await page.$("[data-graview-asking]")) !== null; turn += 1) {
    const asking = page.locator("[data-graview-asking]");
    const step = ((await asking.locator("span").first().textContent()) ?? "").trim();
    if (turn >= 8) throw new Error(`the ask did not close after ${turn} answers; it stopped on "${step}"`);
    if ((await asking.locator("[data-graview-file-editor]").count()) > 0) {
      await asking.getByRole("button", { name: "Skip", exact: true }).focus();
      await page.keyboard.press("Enter");
      answered.push(`${step}: skipped`);
    } else {
      // Over what the box opened on: a record's change starts from what it holds ("590"), and "59090" is past the box's own max, so the form would not submit.
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type("90");
      await page.keyboard.press("Enter");
      answered.push(`${step}: typed`);
    }
    await page.waitForTimeout(400);
  }
  const afterAnAsk = await where();
  report.checks.theKeyboardKeepsItsPlace = {
    afterAnAct,
    afterAPin,
    afterAnAsk,
    answered,
    ok: !afterAnAct.body && afterAPin.inside && !afterAnAsk.body,
  };

  /* ================================================ THE SAME MENU ON THE PAGES */
  /*
   * The routed face opens the scene's own menu — the same pane, the same
   * derived acts — on what a right-click lands on there: a row, a record's
   * page, one of its values, a picture's mark or its ground, the page's own
   * ground. Shift+F10 and the context-menu key open it on what has the
   * keyboard, a finger resting on the page opens it on a phone, Escape gives
   * the keyboard back, and the browser keeps its own menu in a text field
   * and with Shift held. At a desk and at a phone's width.
   */
  const pagesAt = (path) => `${at("todo")}/pages${path}?today=2026-09-01`;
  /** What the menu is showing: its words, its acts, the face's own rows, and whether the keyboard is in it. */
  const menuSays = (on) =>
    on.evaluate(() => {
      const menu = document.querySelector('[data-testid="context-menu"]');
      if (!menu) return null;
      const box = menu.getBoundingClientRect();
      return {
        text: menu.textContent ?? "",
        acts: [...menu.querySelectorAll("[data-affordance]:not([disabled])")].map((act) => (act.textContent ?? "").replace(/ …$/, "").trim()),
        rows: [...menu.querySelectorAll("[data-menu-item]")].map((row) => row.getAttribute("data-menu-item")),
        focusIn: menu.contains(document.activeElement),
        inTheWindow: box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
      };
    });
  const pagesMenu = async (on, selector, options = {}) => {
    await on.click(selector, { button: "right", ...options });
    await on.waitForSelector(MENU, { timeout: 10_000 }).catch(() => undefined);
    await on.waitForTimeout(200);
    return menuSays(on);
  };
  const putAway = async (on) => {
    if (await on.$(MENU)) await on.keyboard.press("Escape");
    await on.waitForTimeout(200);
  };

  for (const [width, height, size] of [
    [1560, 940, "desk"],
    [390, 844, "phone"],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: size === "phone" });
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`${size}: ${error.message}`));

    /* ------------------------------------------------- a row, and its record's page */
    reach(`pagesRecordOpensTheMenu_${size}`);
    await on.goto(pagesAt("/tasks"), { waitUntil: "networkidle" });
    await on.waitForSelector('[data-graview-record="t-deposit"]', { timeout: 30_000 });
    const row = await pagesMenu(on, '[data-graview-record="t-deposit"]');
    /* The menu open, judged by axe with Cloud's tags (verify-a11y.mjs): every item named, nothing it draws refused. */
    reach(`pagesMenuPassesAxe_${size}`);
    await on.addScriptTag({ content: readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8") });
    const axe = await on.evaluate(async () => {
      const result = await window.axe.run({ include: [['[data-testid="context-menu"]']] }, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }, resultTypes: ["violations"] });
      return result.violations.map((violation) => ({ rule: violation.id, nodes: violation.nodes.map((node) => node.html.slice(0, 160)) }));
    });
    report.checks[`pagesMenuPassesAxe_${size}`] = { open: row !== null, axe, ok: row !== null && axe.length === 0 };
    await putAway(on);
    await on.goto(pagesAt("/tasks/t-deposit"), { waitUntil: "networkidle" });
    await on.waitForSelector("main h1", { timeout: 30_000 });
    // The page's own ground: the heading over its facts, which is no value and no link.
    const record = await pagesMenu(on, '[data-testid="record-fields"] h2');
    await putAway(on);
    report.checks[`pagesRecordOpensTheMenu_${size}`] = {
      row,
      record,
      ok:
        row !== null &&
        row.text.includes("Pay the deposit") &&
        row.acts.includes("Finish it") &&
        row.rows.includes("open") &&
        row.focusIn &&
        row.inTheWindow &&
        record !== null &&
        record.text.includes("Pay the deposit") &&
        record.acts.includes("Finish it") &&
        // Already on its page: no "Open", and the way to it in the scene.
        !record.rows.includes("open") &&
        record.rows.includes("in-the-scene") &&
        record.inTheWindow,
    };

    /* ------------------------------------------------- a value, changed where it stands */
    reach(`pagesFieldOffersItsChange_${size}`);
    const field = await pagesMenu(on, '[data-testid="record-fields"] [data-graview-editable][data-graview-field]');
    await on.click(`${MENU} [data-menu-item="change-field"]`).catch(() => undefined);
    await on.waitForTimeout(300);
    const editing = await on.evaluate(() => {
      const active = document.activeElement;
      return { tag: active?.tagName.toLowerCase() ?? null, inTheFacts: active?.closest('[data-testid="record-fields"]') !== null, menuGone: !document.querySelector('[data-testid="context-menu"]') };
    });
    await on.keyboard.press("Escape");
    await on.waitForTimeout(200);
    report.checks[`pagesFieldOffersItsChange_${size}`] = {
      field,
      editing,
      ok: field !== null && field.rows[0] === "change-field" && field.acts.includes("Finish it") && editing.menuGone && editing.inTheFacts && ["input", "select", "textarea"].includes(editing.tag ?? ""),
    };

    /* ------------------------------------------------- a picture's mark, and its ground */
    reach(`pagesBlockAndGroundOpenTheMenu_${size}`);
    await on.goto(pagesAt("/places/the-week"), { waitUntil: "networkidle" });
    await on.waitForSelector('[data-testid="place-lens"] [data-graview-pick]', { timeout: 30_000 });
    const picked = await on.getAttribute('[data-testid="place-lens"] [data-graview-pick]', "data-graview-pick");
    const mark = await pagesMenu(on, `[data-testid="place-lens"] [data-graview-pick="${picked}"]`);
    await putAway(on);
    const ground = await pagesMenu(on, '[data-testid="place-lens"]', { position: { x: 3, y: 3 } });
    await putAway(on);
    await on.goto(pagesAt("/tasks"), { waitUntil: "networkidle" });
    const heading = "main :is([data-graview-page-title], h1, h2) >> nth=0";
    await on.waitForSelector(heading, { timeout: 30_000 });
    const list = await pagesMenu(on, heading);
    await putAway(on);
    report.checks[`pagesBlockAndGroundOpenTheMenu_${size}`] = {
      picked,
      mark,
      ground,
      list,
      ok:
        mark !== null &&
        mark.rows.includes("open") &&
        mark.acts.length > 0 &&
        ground !== null &&
        ground.text.includes("The week") &&
        ground.acts.includes("Add a task") &&
        ground.rows.includes("find") &&
        !ground.rows.includes("open") &&
        list !== null &&
        list.acts.includes("Add a task") &&
        list.rows.includes("find"),
    };

    /* ------------------------------------------------- the keyboard, and Escape */
    reach(`pagesKeyboardOpensAndReturns_${size}`);
    const opener = '[data-graview-record="t-deposit"] a[href]';
    const keyed = {};
    for (const key of ["Shift+F10", "ContextMenu"]) {
      await on.focus(opener);
      await on.keyboard.press(key);
      await on.waitForSelector(MENU, { timeout: 10_000 }).catch(() => undefined);
      await on.waitForTimeout(200);
      const said = await menuSays(on);
      await on.keyboard.press("Escape");
      await on.waitForTimeout(250);
      const back = await on.evaluate((selector) => document.activeElement === document.querySelector(selector), opener);
      keyed[key] = { opened: said !== null && said.text.includes("Pay the deposit"), focusIn: said?.focusIn ?? false, closed: !(await on.$(MENU)), back };
    }
    report.checks[`pagesKeyboardOpensAndReturns_${size}`] = {
      keyed,
      ok: Object.values(keyed).every((one) => one.opened && one.focusIn && one.closed && one.back),
    };

    /* ------------------------------------------------- the browser's own menu */
    reach(`pagesBrowserMenuKept_${size}`);
    // A right-click the page did not take is one whose default was not prevented.
    const prevented = (selector, shiftKey) =>
      on.evaluate(
        ([selector, shiftKey]) => {
          const target = document.querySelector(selector);
          if (!target) return null;
          const box = target.getBoundingClientRect();
          const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, shiftKey, clientX: box.left + 4, clientY: box.top + 4 });
          target.dispatchEvent(event);
          return event.defaultPrevented;
        },
        [selector, shiftKey],
      );
    const inFind = await prevented('[data-testid="nav-find"]', false);
    await putAway(on);
    const shifted = await prevented(opener, true);
    await putAway(on);
    const plain = await prevented(opener, false);
    await putAway(on);
    report.checks[`pagesBrowserMenuKept_${size}`] = {
      inFind,
      shifted,
      plain,
      // In the Find box and with Shift the browser's; elsewhere the page's.
      ok: inFind === false && shifted === false && plain === true,
    };

    /* ------------------------------------------------- a finger resting on the page */
    if (size === "phone") {
      reach("pagesLongPressOpensTheMenu_phone");
      await on.goto(pagesAt("/tasks/t-deposit"), { waitUntil: "networkidle" });
      await on.waitForSelector("main h1", { timeout: 30_000 });
      const box = await on.evaluate(() => {
        const at = document.querySelector('[data-testid="record-fields"] h2')?.getBoundingClientRect();
        return at ? { x: Math.round(at.left + at.width / 2), y: Math.round(at.top + at.height / 2) } : null;
      });
      /*
       * A REAL FINGER where the engine can be given one (Chromium's touch
       * input, which raises the pointer events a phone does); elsewhere the
       * same pointer events, said by the page.
       */
      let how = "touch";
      if (ENGINE === "chromium" && box) {
        const cdp = await context.newCDPSession(on);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x, y: box.y }] });
        await on.waitForTimeout(800);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else if (box) {
        how = "pointer events";
        await on.evaluate(({ x, y }) => {
          const target = document.elementFromPoint(x, y);
          target?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", isPrimary: true, clientX: x, clientY: y }));
        }, box);
        await on.waitForTimeout(800);
        await on.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", isPrimary: true, clientX: x, clientY: y })), box);
      }
      await on.waitForTimeout(300);
      const rested = await menuSays(on);
      // Still on the record's page: the press that opened the menu followed nothing.
      const stayed = on.url().includes("/pages/tasks/t-deposit");
      await putAway(on);
      report.checks.pagesLongPressOpensTheMenu_phone = {
        how,
        rested,
        stayed,
        ok: rested !== null && rested.text.includes("Pay the deposit") && rested.acts.includes("Finish it") && rested.inTheWindow && stayed,
      };
    }
    await context.close();
  }

  reach.done();
  report.pageErrors = errors;
  report.passed =
    Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  reach.done();
  // The claim it was driving fails by name, not only the run.
  if (!report.checks[reach.at()]) report.checks[reach.at()] = { ok: false, stopped: String(error) };
  report.stoppedAt = reach.at();
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
}

writeFileSync(resolve(repoRoot, "docs/menu.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/menu.json\n`);
process.exit(report.passed ? 0 : 1);
