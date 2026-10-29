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
 * And what the menu knows of what is under the cursor (Roadmap
 * request:add-copy-link-under-open-in-a-new-tab, request:right-click-
 * context-menu-options-to-be-more-relevant-to-the-item-under-my-cursor):
 * "Copy link" right under "Open in a new tab", copying the whole address
 * and saying so; "Inspect" at the foot, a sheet of the thing's kind, id and
 * link; a selection copied by "Copy" rather than swallowed, the browser's
 * own menu kept on the selected text and a finger resting on text left to
 * the phone's selection; and a column — a status board's, and one a worker
 * view marked `data-column` — offering a task added in it and the place
 * narrowed to it.
 *
 *   node scripts/verify-menu.mjs [--engine=chromium|webkit|firefox]
 */
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving, vacant } from "./lib/serve.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let app;
let browser;
let menuHost;
// Each claim gets three minutes; one that takes longer fails by name (lib/deadline.mjs).
const reach = deadline({
  verdict: resolve(repoRoot, "docs/menu.json"),
  report,
  cleanup: async () => {
    await browser?.close();
    app?.stop();
    menuHost?.stop();
  },
});
app = await serving("todo", portFor("todo"), repoRoot);

const MENU = '[data-testid="context-menu"]';

/*
 * THE TASKS' STATUS BOARD, AND A VIEW THAT MARKS ITS OWN COLUMNS, mounted
 * the way Graview Cloud mounts an app: the embed on the pages, at its own
 * address under a base, the reader its owner.
 */
const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const MENU_BASE = "/menu";
const BY_HAND = { name: "by-hand", title: "By hand", attach: "task", cardinality: "many" };
const BY_HAND_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<div class="by-hand">\${["todo", "doing", "done"].map((status) => graview.html\`<section data-column=\${"status:" + status} style="min-height:120px;padding:8px;border:1px solid"><h3>\${status}</h3><ul>\${props.nodes.filter((task) => task.status === status).map((task) => graview.html\`<li>\${task.label}</li>\`)}</ul></section>\`)}</div>\`));`;
const BOARD_SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
  ],
  edges: [],
};

async function serveMenuHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-menu-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { registerWorkerView } from "@graview/guest/host/views";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import tasks from ${JSON.stringify(TASKS)};
        const compiled = compileDocumentWithoutCheck(tasks, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: ${JSON.stringify(BOARD_SEED)},
          principal: { kind: "human", id: "p1", roles: ["owner"] },
          face: "pages",
          views: (schema, registry) => registerWorkerView(registry, { manifest: ${JSON.stringify(BY_HAND)}, worker: { source: ${JSON.stringify(BY_HAND_SOURCE)} } }),
          bar: true,
          label: "The tasks",
          heading: 1,
          height: "100%",
          fonts: false,
          studio: false,
          routing: "address",
          basePath: "${MENU_BASE}/",
        });
        window.__handle.drawn().then(() => { window.__ready = true; });
      `,
      resolveDir: resolve(repoRoot, "packages/embed"),
      loader: "js",
    },
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    outdir: out,
    entryNames: "entry",
    define: { "process.env.NODE_ENV": '"development"' },
    jsx: "automatic",
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The tasks</title><style>body{margin:0}#app{position:relative;height:100vh}</style></head><body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const file = join(out, path.replace(/^\/+/, ""));
    if (path.endsWith(".js") && file.startsWith(out) && existsSync(file)) {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(readFileSync(file));
      return;
    }
    if (path === MENU_BASE || path.startsWith(`${MENU_BASE}/`)) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(page);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await vacant(portFor("menu-host"));
  await new Promise((ready) => server.listen(portFor("menu-host"), ready));
  return { stop: () => (server.close(), rmSync(out, { recursive: true, force: true })) };
}

/**
 * A FINGER RESTING at a point: Chromium's touch input, which raises the
 * pointer events a phone does; elsewhere the same pointer events, said by
 * the page. Says which it was.
 */
async function restAt(context, on, { x, y }) {
  if (ENGINE === "chromium") {
    const cdp = await context.newCDPSession(on);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await on.waitForTimeout(800);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await on.waitForTimeout(300);
    return "touch";
  }
  await on.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, pointerType: "touch", isPrimary: true, clientX: x, clientY: y })), { x, y });
  await on.waitForTimeout(800);
  await on.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true, pointerType: "touch", isPrimary: true, clientX: x, clientY: y })), { x, y });
  await on.waitForTimeout(300);
  return "pointer events";
}

/** Every copy the page makes, kept where a harness can read it: the clipboard itself asks a person. */
const KEEP_COPIES = () => {
  window.__copied = [];
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (text) => (window.__copied.push(text), Promise.resolve()) } });
};

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
    await context.addInitScript(KEEP_COPIES);
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

    /* ------------------------------------------------- Copy link, under Open in a new tab */
    reach(`theMenuOffersCopyLinkUnderOpenInANewTab_${size}`);
    await on.goto(pagesAt("/tasks"), { waitUntil: "networkidle" });
    await on.waitForSelector('[data-graview-record="t-deposit"]', { timeout: 30_000 });
    const linked = await pagesMenu(on, '[data-graview-record="t-deposit"]');
    await on.evaluate(() => (window.__copied = []));
    await on.click(`${MENU} [data-menu-item="copy-link"]`).catch(() => undefined);
    await on.waitForFunction(() => window.__copied.length > 0, null, { timeout: 5_000 }).catch(() => undefined);
    const linkCopied = await on.evaluate(() => {
      const said = document.querySelector('[data-testid="menu-said"]');
      const box = said?.getBoundingClientRect();
      return { copied: window.__copied[0] ?? null, said: said?.textContent ?? null, seen: Boolean(box && box.width > 1 && box.height > 1), menuGone: !document.querySelector('[data-testid="context-menu"]') };
    });
    const expectedLink = new URL("/pages/tasks/t-deposit", at("todo")).href;
    report.checks[`theMenuOffersCopyLinkUnderOpenInANewTab_${size}`] = {
      rows: linked?.rows ?? null,
      ...linkCopied,
      expectedLink,
      ok:
        linked !== null &&
        linked.rows.indexOf("copy-link") === linked.rows.indexOf("open-in-a-new-tab") + 1 &&
        linked.rows.includes("open-in-a-new-tab") &&
        linkCopied.copied === expectedLink &&
        linkCopied.said === "Link copied" &&
        linkCopied.seen &&
        linkCopied.menuGone,
    };
    await putAway(on);

    /* ------------------------------------------------- Inspect, at the foot */
    reach(`inspectSaysWhatIsUnderTheCursor_${size}`);
    const inspecting = await pagesMenu(on, '[data-graview-record="t-deposit"]');
    const foot = await on.evaluate(() => {
      const sections = [...document.querySelectorAll('[data-testid="context-menu"] [data-menu-section]')];
      return sections.at(-1)?.getAttribute("data-menu-section") ?? null;
    });
    await on.click(`${MENU} [data-menu-item="inspect"]`).catch(() => undefined);
    await on.waitForSelector('[data-testid="inspect-sheet"]', { timeout: 10_000 }).catch(() => undefined);
    const sheet = await on.evaluate(() => {
      const shown = document.querySelector('[data-testid="inspect-sheet"]');
      if (!shown) return null;
      const box = shown.getBoundingClientRect();
      return {
        heading: shown.querySelector("h2")?.textContent ?? "",
        kind: shown.querySelector('[data-inspect="kind"] code')?.textContent ?? null,
        record: shown.querySelector('[data-inspect="record"] code')?.textContent ?? null,
        link: shown.querySelector('[data-testid="inspect-link"]')?.href ?? null,
        declared: Boolean(shown.querySelector('[data-inspect="declared"]')),
        inTheWindow: box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
        focusIn: shown.contains(document.activeElement),
      };
    });
    await on.keyboard.press("Escape");
    await on.waitForTimeout(250);
    const sheetGone = !(await on.$('[data-testid="inspect-sheet"]'));
    report.checks[`inspectSaysWhatIsUnderTheCursor_${size}`] = {
      lastRow: inspecting?.rows.at(-1) ?? null,
      foot,
      sheet,
      sheetGone,
      ok:
        inspecting !== null &&
        inspecting.rows.at(-1) === "inspect" &&
        foot === "inspect" &&
        sheet !== null &&
        sheet.heading.includes("Pay the deposit") &&
        sheet.kind === "task" &&
        sheet.record === "t-deposit" &&
        sheet.link === expectedLink &&
        sheet.inTheWindow &&
        sheet.focusIn &&
        sheetGone,
    };

    /* ------------------------------------------------- a selection, copied and not swallowed */
    reach(`aSelectionIsCopiedNotSwallowed_${size}`);
    const selected = await on.evaluate(() => {
      const title = document.querySelector("main [data-graview-page-title], main h1");
      const range = document.createRange();
      range.selectNodeContents(title);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      return getSelection().toString();
    });
    // On the selected text itself: the browser's own menu (Copy, Look up), never ours.
    const onTheText = await prevented("main [data-graview-page-title], main h1", false);
    const oursOnIt = Boolean(await on.$(MENU));
    await putAway(on);
    // Elsewhere, with the text still selected: ours, Copy first.
    await on.evaluate(() => {
      const title = document.querySelector("main [data-graview-page-title], main h1");
      const range = document.createRange();
      range.selectNodeContents(title);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      window.__copied = [];
    });
    const elsewhere = await prevented('[data-graview-record="t-deposit"]', false);
    await on.waitForSelector(MENU, { timeout: 10_000 }).catch(() => undefined);
    await on.waitForTimeout(200);
    const withSelection = await menuSays(on);
    await on.click(`${MENU} [data-menu-item="copy-selection"]`).catch(() => undefined);
    await on.waitForFunction(() => window.__copied.length > 0, null, { timeout: 5_000 }).catch(() => undefined);
    const copiedText = await on.evaluate(() => window.__copied[0] ?? null);
    await putAway(on);
    await on.evaluate(() => getSelection().removeAllRanges());
    /* A finger resting on text is selecting it: no menu over it, where a row or a value still opens one. */
    let restedOnText = null;
    if (size === "phone") {
      await on.goto(pagesAt("/tasks/t-deposit"), { waitUntil: "networkidle" });
      await on.waitForSelector("main h1", { timeout: 30_000 });
      const point = await on.evaluate(() => {
        const title = document.querySelector('[data-testid="record-fields"] h2');
        const range = document.createRange();
        range.selectNodeContents(title.firstChild ?? title);
        const box = range.getClientRects()[0] ?? title.getBoundingClientRect();
        return { x: Math.round(box.left + Math.min(8, box.width / 2)), y: Math.round(box.top + box.height / 2) };
      });
      await restAt(context, on, point);
      restedOnText = { menu: Boolean(await on.$(MENU)) };
      await putAway(on);
    }
    report.checks[`aSelectionIsCopiedNotSwallowed_${size}`] = {
      selected,
      onTheText,
      oursOnIt,
      elsewhere,
      firstRow: withSelection?.rows[0] ?? null,
      copiedText,
      restedOnText,
      ok:
        selected.trim().length > 0 &&
        onTheText === false &&
        !oursOnIt &&
        elsewhere === true &&
        withSelection !== null &&
        withSelection.rows[0] === "copy-selection" &&
        copiedText === selected &&
        (restedOnText === null || restedOnText.menu === false),
    };

    /* ------------------------------------------------- a finger resting on the page */
    if (size === "phone") {
      reach("pagesLongPressOpensTheMenu_phone");
      await on.goto(pagesAt("/tasks/t-deposit"), { waitUntil: "networkidle" });
      await on.waitForSelector("main h1", { timeout: 30_000 });
      // A value on the page: a handle, which a resting finger opens the menu on (text alone is the phone's to select).
      const box = await on.evaluate(() => {
        const at = document.querySelector('[data-testid="record-fields"] [data-graview-editable][data-graview-field]')?.getBoundingClientRect();
        return at ? { x: Math.round(at.left + Math.min(12, at.width / 2)), y: Math.round(at.top + at.height / 2) } : null;
      });
      const how = box ? await restAt(context, on, box) : "nowhere";
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

  /* ================================================ A COLUMN UNDER THE CURSOR */
  /*
   * "Like on a custom view if I'm on a column and I right click, I probably
   * want to add an item in that column or view only items in that column."
   * On the tasks' status board, and on a worker view that marks its own
   * columns `data-column="status:<value>"`: a right-click on a column's
   * ground offers "Add a task in Doing" — the add act, its status given —
   * and "Show only Doing", the place narrowed as its address narrows it.
   */
  reach("aColumnOffersAddInItAndShowOnlyIt");
  menuHost = await serveMenuHost();
  const hostAt = (path) => `http://localhost:${portFor("menu-host")}${MENU_BASE}${path}`;
  const columns = {};
  for (const [width, height, size] of [
    [1440, 900, "desk"],
    [390, 844, "phone"],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: size === "phone" });
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`${size} column: ${error.message}`));
    const said = () =>
      on.evaluate(() => {
        const menu = document.querySelector('[data-testid="context-menu"]');
        return menu ? Object.fromEntries([...menu.querySelectorAll("[data-menu-item]")].map((row) => [row.getAttribute("data-menu-item"), (row.textContent ?? "").trim()])) : null;
      });
    /** A point at the top of a column's ground: its heading's line, clear of its cards. */
    const columnPoint = (selector, inView) =>
      on.evaluate(
        ([selector, inView]) => {
          const roots = inView ? [...document.querySelectorAll("*")].map((element) => element.shadowRoot).filter(Boolean) : [document];
          const column = roots.map((root) => root.querySelector(selector)).find(Boolean);
          if (!column) return null;
          column.scrollIntoView({ block: "center" });
          const box = column.getBoundingClientRect();
          return { x: Math.round(box.left + Math.min(box.width - 4, 12)), y: Math.round(box.top + 6) };
        },
        [selector, inView],
      );
    const rightAt = async (point) => {
      await on.mouse.click(point.x, point.y, { button: "right" });
      await on.waitForSelector(MENU, { timeout: 10_000 }).catch(() => undefined);
      await on.waitForTimeout(250);
      return said();
    };

    // The status board.
    await on.goto(hostAt("/places/the-board"), { waitUntil: "load" });
    await on.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
    await on.waitForSelector('[data-column="status:doing"]', { timeout: 30_000 });
    const boardPoint = await columnPoint('[data-column="status:doing"]', false);
    const board = boardPoint ? await rightAt(boardPoint) : null;
    await on.click(`${MENU} [data-menu-item="add-in-column"]`).catch(() => undefined);
    const asked = await on.waitForSelector(`${MENU} form input`, { timeout: 10_000 }).catch(() => null);
    const name = `Hang the lights ${size}`;
    if (asked) {
      await asked.fill(name);
      await on.keyboard.press("Enter");
    }
    const added = await on
      .waitForFunction((name) => [...document.querySelectorAll('[data-column="status:doing"] [data-graview-listed]')].some((card) => (card.textContent ?? "").includes(name)), name, { timeout: 10_000 })
      .then(() => true, () => false);
    if (await on.$(MENU)) await on.keyboard.press("Escape");
    const againPoint = await columnPoint('[data-column="status:doing"]', false);
    if (againPoint) await rightAt(againPoint);
    await on.click(`${MENU} [data-menu-item="show-only-column"]`).catch(() => undefined);
    const narrowed = await on
      .waitForFunction(() => location.search.includes("filter=status%3Adoing") && !document.querySelector('[data-graview-listed="t1"]') && Boolean(document.querySelector('[data-graview-listed="t2"]')), null, { timeout: 10_000 })
      .then(() => true, () => false);

    // The worker view that marks its own columns.
    await on.goto(hostAt("/places/by-hand"), { waitUntil: "load" });
    await on.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
    await on.waitForFunction(() => [...document.querySelectorAll("*")].some((element) => element.shadowRoot?.querySelector('[data-column="status:doing"]')), null, { timeout: 30_000 }).catch(() => undefined);
    const viewPoint = await columnPoint('[data-column="status:doing"]', true);
    const view = viewPoint ? await rightAt(viewPoint) : null;
    await on.click(`${MENU} [data-menu-item="show-only-column"]`).catch(() => undefined);
    const viewNarrowed = await on
      .waitForFunction(
        () => {
          const drawn = [...document.querySelectorAll("*")].map((element) => element.shadowRoot?.querySelector(".by-hand")).find(Boolean);
          return location.search.includes("filter=status%3Adoing") && drawn !== undefined && !drawn.textContent.includes("Write the brief") && drawn.textContent.includes("Book the hall");
        },
        null,
        { timeout: 10_000 },
      )
      .then(() => true, () => false);
    columns[size] = { board, added, narrowed, view, viewNarrowed };
    await context.close();
  }
  const offers = (rows) => rows !== null && /^Add a task in Doing$/i.test(rows["add-in-column"] ?? "") && /^Show only Doing$/i.test(rows["show-only-column"] ?? "");
  report.checks.aColumnOffersAddInItAndShowOnlyIt = {
    ...columns,
    ok: Object.values(columns).every((one) => offers(one.board) && one.added && one.narrowed && offers(one.view) && one.viewNarrowed),
  };

  /* ================================================ THE SCENE'S GROUND IS OURS TOO (FR-228) */
  /*
   * A right-click on the scene's empty ground opened nothing and left the
   * browser's own menu: only a card answered the gesture. Now the ground
   * answers it with the scene's menu about what is chosen, or about nothing,
   * at the pointer; Shift keeps the browser's, and so does a text field; a
   * finger resting on the ground or on a card opens it on a phone. At a desk
   * and at a phone's width.
   */
  for (const [width, height, size] of [
    [1560, 940, "desk"],
    [390, 844, "phone"],
  ]) {
    reach(`sceneRightClickIsAlwaysOurs_${size}`);
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: size === "phone" });
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`${size} scene: ${error.message}`));
    await on.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
    await on.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    await on.waitForTimeout(800);
    await on.evaluate(() => {
      window.__ctx = [];
      window.addEventListener("contextmenu", (event) => window.__ctx.push(event), true);
    });
    /** A point on bare ground: inside the scene, over no view and no control. */
    const ground = await on.evaluate(() => {
      const root = document.querySelector(".graview-ground");
      if (!root) return null;
      const box = root.getBoundingClientRect();
      for (let y = box.top + 40; y < box.bottom - 20; y += 24)
        for (let x = box.left + 20; x < box.right - 20; x += 24) {
          const el = document.elementFromPoint(x, y);
          if (!el || !root.contains(el)) continue;
          if (el.closest("[data-graview-view], button, a, input, select, textarea, [data-graview-pick], section[aria-label], aside, [data-graview-app-bar], [data-graview-offstage]")) continue;
          return { x, y };
        }
      return null;
    });
    const record = await on.evaluate(() => {
      const el = document.querySelector('[data-graview-pick="t-deposit"]');
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { x: box.left + Math.min(20, box.width / 2), y: box.top + Math.min(20, box.height / 2) };
    });
    /** Whether the browser's menu was kept (its default not prevented) by the last gesture, and whether ours opened. */
    const heard = () =>
      on.evaluate(() => {
        const events = window.__ctx.splice(0);
        return { ours: Boolean(document.querySelector('[data-testid="context-menu"]')), events: events.length, kept: events.some((event) => !event.defaultPrevented) };
      });
    const rightClick = async (point, modifiers = []) => {
      // The mouse alone takes no modifiers: Shift is held on the keyboard across the press.
      for (const key of modifiers) await on.keyboard.down(key);
      await on.mouse.click(point.x, point.y, { button: "right" });
      for (const key of modifiers) await on.keyboard.up(key);
      await on.waitForSelector(MENU, { timeout: 3_000 }).catch(() => undefined);
      await on.waitForTimeout(250);
      const said = await heard();
      await putAway(on);
      return said;
    };
    const plain = ground ? await rightClick(ground) : null;
    const shifted = ground ? await rightClick(ground, ["Shift"]) : null;
    const onCard = record ? await rightClick(record) : null;
    // In the bar's Find box the browser keeps its own menu (paste, spelling).
    const typing = await on.evaluate(() => {
      const opener = document.querySelector('[data-testid="app-find-open"]');
      if (opener) opener.click();
      const box = document.querySelector('[data-testid="app-find"]');
      if (!box) return null;
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: box.getBoundingClientRect().left + 4, clientY: box.getBoundingClientRect().top + 4 });
      box.dispatchEvent(event);
      return { kept: !event.defaultPrevented };
    });
    await on.keyboard.press("Escape");
    await putAway(on);
    /* A finger resting on the ground, and on a card, on a phone: Chromium's touch input, which raises the pointer events a phone does. */
    let rested = null;
    if (size === "phone" && ENGINE === "chromium" && ground && record) {
      rested = {};
      const cdp = await context.newCDPSession(on);
      for (const [what, point] of [
        ["ground", ground],
        ["record", record],
      ]) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
        await on.waitForTimeout(800);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await on.waitForTimeout(300);
        const said = await menuSays(on);
        rested[what] = { opened: said !== null, inTheWindow: said?.inTheWindow ?? false, ...(what === "record" ? { about: said?.text.includes("Pay the deposit") ?? false } : {}) };
        await putAway(on);
      }
    }
    report.checks[`sceneRightClickIsAlwaysOurs_${size}`] = {
      ground: Boolean(ground),
      plain,
      shifted,
      onCard,
      typing,
      rested,
      ok:
        plain !== null &&
        plain.ours &&
        plain.events >= 1 &&
        !plain.kept &&
        shifted !== null &&
        !shifted.ours &&
        shifted.kept &&
        onCard !== null &&
        onCard.ours &&
        !onCard.kept &&
        typing !== null &&
        typing.kept &&
        (rested === null || (rested.ground.opened && rested.ground.inTheWindow && rested.record.opened && rested.record.about)),
    };
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
  menuHost?.stop();
}

writeFileSync(resolve(repoRoot, "docs/menu.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/menu.json\n`);
process.exit(report.passed ? 0 : 1);
