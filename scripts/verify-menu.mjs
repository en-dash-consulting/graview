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
 * and saying so, and no "Inspect" (shipped in 0.1.63, taken out: the menu
 * is for what can be done); a selection copied by "Copy" rather than swallowed, the browser's
 * own menu kept on the selected text and a finger resting on text left to
 * the phone's selection; and a column — a status board's, and one a worker
 * view marked `data-column` — offering a task added in it and the place
 * narrowed to it.
 *
 * And typing in the menu (Roadmap f-menu-type-anything), on both faces: a
 * letter typed goes into the menu's field and narrows every row to those
 * whose words begin with it, the Fast slot then finding what they mean as
 * the typing rests; Enter runs the one lit; words that fit nothing are
 * asked of a fake host AI — its Fast slot picking the context, its Thinking
 * slot told only that — about what is under the cursor, its thinking
 * marked on the thing itself and its answer a card beside it whose change
 * is accepted and taken back; and with AI off the field only filters.
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
        import { composeAppChange } from "@graview/core/compose";
        import { Store } from "@graview/core";
        import tasks from ${JSON.stringify(TASKS)};
        /*
         * ?lean=1: the tasks with nobody to give them to — no person kind, no
         * assignee, no Assign — the app a missing capability is asked of, its
         * host one that applies a change to the app (and the records that
         * finish the ask) as one change and hands back its one way back.
         */
        const lean = new URLSearchParams(location.search).get("lean") === "1";
        const document0 = lean
          ? { ...tasks, kinds: { task: { ...tasks.kinds.task, edges: {} } }, acts: { "add-task": tasks.acts["add-task"], "set-status": tasks.acts["set-status"] }, policy: { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: ["owner"], kinds: ["task"] }] } }
          : tasks;
        const today = () => "2026-09-01";
        const compiled = compileDocumentWithoutCheck(document0, { today });
        if (!compiled.ok) throw new Error("the document did not compile");
        const principal = { kind: "human", id: "p1", roles: ["owner"] };
        let current = { document: document0, app: compiled.app };
        const onProposeChange = async (proposal) => {
          window.__proposed = (window.__proposed ?? []).concat([proposal]);
          const before = { ...current, store: window.__handle.store };
          const composed = composeAppChange(proposal.edits ? { document: current.document, edits: proposal.edits } : { document: current.document, add: proposal.add, drop: proposal.drop });
          if (!composed.ok) return "declined";
          const app = composed.app;
          const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: before.store.graph.snapshot(), ...(app.policy ? { policy: app.policy } : {}) });
          if (proposal.records?.length) store.applyAll(proposal.records, { author: principal, ...(proposal.via ? { via: proposal.via } : {}) });
          current = { document: composed.document, app };
          window.__handle.setApp(app, store);
          const undo = () => {
            current = { document: before.document, app: before.app };
            window.__handle.setApp(before.app, before.store);
            window.__undone = (window.__undone ?? 0) + 1;
          };
          window.__undoPlan = undo;
          // The app is drawn again for its new declaration: the host says what changed, with its one way back.
          setTimeout(() => window.__handle.notify({ kind: "toast", sentence: "Changed the app and its records as one change.", action: { label: "Undo", onSelect: undo }, timeout: false, id: "plan" }), 50);
          return { applied: true, undo };
        };
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: ${JSON.stringify(BOARD_SEED)},
          principal,
          ...(lean ? { onProposeChange, composeChange: composeAppChange } : {}),
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
          // A host's own row below the AI's, as Homeflow's "Send feedback" is: the row the jumpy menu moved.
          ai: window.__todoAi,
          menuSections: [() => ({ id: "host", items: [{ id: "send-feedback", label: "Send feedback", run: () => (window.__feedback = (window.__feedback ?? 0) + 1) }] })],
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

    /* ------------------------------------------------- no Inspect */
    reach(`theMenuHasNoInspectRow_${size}`);
    const noInspect = await pagesMenu(on, '[data-graview-record="t-deposit"]');
    report.checks[`theMenuHasNoInspectRow_${size}`] = {
      rows: noInspect?.rows ?? null,
      ok: noInspect !== null && noInspect.rows.length > 0 && !noInspect.rows.includes("inspect") && !/\bInspect\b/.test(noInspect.text) && noInspect.rows.includes("copy-link"),
    };
    await putAway(on);

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

  /* ================================================ TYPE IN THE MENU (Roadmap f-menu-type-anything) */
  /*
   * "When I right-click on anything, I want to be able to type in something
   * about it. It could filter and show available actions, but I also would
   * like it to accept freeform text and then hit enter, and see some
   * thinking kind of thing on that part of the app that would pop back up
   * with the changes that it is making or about to make." Driven on the
   * scene's card and on the routed face's row for the same task, with a
   * fake host AI that answers after a moment and proposes finishing it, and
   * with AI off.
   */
  /*
   * A FAKE HOST AI, BOTH SLOTS. The Fast slot answers each typed choice at
   * once — the menu's rows ("complete" means "Finish it"), and which
   * candidates and records a quick ask should send (the one that finishes
   * the task, the first record) — keeping what it picked; the Thinking slot
   * answers after a moment, keeping what it was told, and picks every
   * candidate it was sent.
   */
  const FAKE_AI = () => {
    window.__fastPicked = [];
    window.__thinkingSaw = [];
    const choose = (question, wanted) => {
      const names = Object.keys(question.criteria);
      const choice = names.find((name) => wanted.test(question.criteria[name])) ?? names[0];
      return { type: "choice", choice, confidence: 0.9, probabilities: Object.fromEntries(names.map((name) => [name, name === choice ? 0.9 : 0.01])) };
    };
    window.__todoAi = {
      name: "fake",
      fast: {
        model: "fake-fast",
        decide: async (state, questions) => {
          const answers = {};
          // The menu's own suggestions come slowly, as a real model's do: the rows below them must not move meanwhile.
          if (questions.next) await new Promise((done) => setTimeout(done, 2000));
          // A plan over the graph: Jev's typed questions answer in about a tenth of a second.
          if (questions.act) await new Promise((done) => setTimeout(done, 150));
          const said = String(state.said ?? "");
          const giving = /\b(assign|give)\b/i.test(`${said} ${state.replyingTo ?? ""}`);
          const sure = (question, choice, chance = 0.92) => {
            const names = Object.keys(question.criteria);
            return { type: "choice", choice, confidence: chance, probabilities: Object.fromEntries(names.map((name) => [name, name === choice ? chance : (1 - chance) / Math.max(1, names.length - 1)])) };
          };
          let firstRecord = true;
          for (const [key, question] of Object.entries(questions)) {
            if (question.type === "choice" && key === "reading") {
              // "These" on a list are the tasks it holds; a first turn misread on purpose (__misread) is close, so the card says it.
              const misread = window.__misread === true && !/\btasks\b/i.test(said);
              // Sure where the words say which ("these", "all"); less so of "the old ones", which a destructive act must not take as all.
              const plain = /\b(these|all|them|each|everything)\b/i.test(said);
              const names = Object.keys(question.criteria);
              // "Everything that's already ticked off" read as everything, sure of it — the misreading the code must catch.
              const misreadAll = /\beverything that'?s\b/i.test(said);
              answers[key] = misread ? sure(question, "itself", 0.55) : misreadAll ? sure(question, "held", 0.95) : names.includes("done") && /\b(done|finished|ticked|completed)\b/i.test(said) ? sure(question, "done") : names.includes("open") && /\b(open|remaining|outstanding)\b/i.test(said) ? sure(question, "open") : sure(question, /\b(these|all|them|each|everything|tasks|ones)\b/i.test(said) ? "held" : "itself", plain ? 0.92 : 0.7);
              continue;
            }
            if (question.type === "choice" && key === "mood") {
              answers[key] = sure(question, /\?\s*$|^(is|are|has|have|what|who|when|where|which|how|does)\b/i.test(said) ? "asks" : "tells");
              continue;
            }
            if (question.type === "choice" && key === "act") {
              // "Close", "complete", "finish": the act that marks done, read by what it does — on the tasks a list holds.
              const closing = /\b(close|complete|finish|tick|check off)\b/i.test(said) && !/\?\s*$/.test(said);
              const held = /\b(these|all|them|each|everything|tasks)\b/i.test(said);
              const finish = Object.keys(question.criteria).find((name) => name === `${held ? "held" : "itself"}:finish`);
              const removing = /\b(delete|drop|bin|get rid of|clear out|scrap)\b/i.test(said) && !/\?\s*$/.test(said);
              const drop = Object.keys(question.criteria).find((name) => name === `${held || /\bones\b/i.test(said) ? "held" : "itself"}:drop`);
              answers[key] = closing && finish ? sure(question, finish) : removing && drop ? sure(question, drop) : giving ? sure(question, "none") : sure(question, "none", 0.3);
              continue;
            }
            if (question.type === "choice" && (key === "person" || key === "named")) {
              const names = Object.keys(question.criteria);
              const named = names.find((name) => /^[pr]:/.test(name) && new RegExp(`\\b${String(question.criteria[name]).replace(/ \(.*\)$/, "")}\\b`, "i").test(said));
              answers[key] = sure(question, named ?? (giving && key === "person" ? "new" : "none"));
              continue;
            }
            if (question.type === "choice" && key === "need") {
              answers[key] = giving ? sure(question, "person") : sure(question, "none", 0.5);
              continue;
            }
            // Which records a quick ask is about, a Noul each: the first, and no other.
            if (question.type === "noul") {
              answers[key] = { type: "noul", noul: firstRecord ? 0.9 : 0.05 };
              if (firstRecord) window.__fastPicked.push({ key: "records", said: question.instructions });
              firstRecord = false;
              continue;
            }
            if (question.type !== "choice") continue;
            if (key === "row") {
              if (/complete/.test(state.typed ?? "")) answers.row = choose(question, /^Finish it$/);
              continue;
            }
            if (key === "candidates") {
              answers[key] = choose(question, /^Finish it/);
              window.__fastPicked.push({ key, said: question.criteria[answers[key].choice] });
              continue;
            }
            answers[key] = choose(question, /./);
          }
          return { answers, usage: { inputTokens: 10, outputTokens: 1 } };
        },
      },
      thinking: {
        model: "fake-thinking",
        think: async ({ prompt }) => {
          window.__thinkingCalls = (window.__thinkingCalls ?? 0) + 1;
          await new Promise((done) => setTimeout(done, 1500));
          const told = JSON.parse(prompt);
          const acts = (told.member_acts ?? []).map((one) => one.name);
          // "Mark these done": one act over every member. "Assign these to nick": the app has nothing to assign with.
          if (/done/i.test(told.ask ?? "") && acts.includes("set-status")) return { text: JSON.stringify({ answer: "Marking each of them done.", each: { act: "set-status", args: { status: "done" } } }) };
          // A model's note to the pipeline, never to be shown as it came: a fragment, no need named.
          if (/frobnicate/i.test(told.ask ?? "")) return { text: JSON.stringify({ answer: "", lacks: "a way to frobnicate tasks" }) };
          if (/assign/i.test(told.ask ?? "") && !acts.some((name) => /assign|give/.test(name))) return { text: JSON.stringify({ answer: "", lacks: "Tasks have no one to assign them to.", need: { link: { on: "task", called: "assigned to", to: "person" } }, who: "Nick" }) };
          window.__thinkingSaw.push({ candidates: (told.candidates ?? []).map((one) => one.says), records: [...(told.state?.selection ?? []), ...(told.state?.neighbors ?? [])].map((one) => one.label) });
          return { text: JSON.stringify({ answer: `About ${told.about}: it is not done yet, so finish it.`, pick: (told.candidates ?? []).map((one) => one.id) }) };
        },
      },
    };
  };
  const KEEP_THE_STORE = () => {
    const keep = (store) => (window.__menuStores ??= []).push(store);
    const watch = (window.__graviewWatch ??= {});
    const handed = watch.store;
    watch.store = (store) => {
      handed?.(store);
      keep(store);
    };
  };
  const doneOf = (on, id) => on.evaluate((id) => (window.__menuStores ?? []).find((one) => one.schema.kinds.includes("task"))?.graph.getNode(id)?.done === true, id);
  /** What the menu shows as it is typed in: the field, the acts, the rows, the one lit. */
  const typedSays = (on) =>
    on.evaluate(() => {
      const menu = document.querySelector('[data-testid="context-menu"]');
      if (!menu) return null;
      const field = menu.querySelector('[data-testid="menu-type"]');
      const clean = (element) => (element.textContent ?? "").replace(/[…↵]/g, "").trim();
      return {
        typed: field?.value ?? null,
        keyboardInTheField: document.activeElement === field,
        acts: [...menu.querySelectorAll("[data-affordance]")].map(clean),
        rows: [...menu.querySelectorAll("[data-menu-item]")].map((row) => ({ id: row.getAttribute("data-menu-item"), text: clean(row) })),
        lit: menu.querySelector("[data-menu-lit]") ? clean(menu.querySelector("[data-menu-lit]")) : null,
        noMatch: menu.querySelector('[data-testid="menu-no-match"]')?.textContent ?? null,
      };
    });
  /** Every row's words begin with every word typed. */
  const allFit = (said, words) => {
    const fold = (text) => text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const wanted = fold(words);
    return [...said.acts, ...said.rows.filter((row) => row.id !== "ask-typed").map((row) => row.text)].every((label) => wanted.every((word) => fold(label).some((one) => one.startsWith(word))));
  };
  const faces = {
    scene: { at: (ai) => `${at("todo")}/?today=2026-09-01&fresh=1${ai}`, ready: async (on) => {
      await on.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await on.waitForTimeout(800);
    }, target: '[data-graview-pick="t-deposit"]' },
    pages: { at: (ai) => `${at("todo")}/pages/tasks?today=2026-09-01&fresh=1${ai}`, ready: async (on) => {
      await on.waitForSelector('[data-graview-record="t-deposit"]', { timeout: 60_000 });
      await on.waitForTimeout(500);
    }, target: '[data-graview-record="t-deposit"]' },
  };
  const opened = async (on, face, ai) => {
    await on.goto(faces[face].at(ai), { waitUntil: "load" });
    await faces[face].ready(on);
    await on.click(faces[face].target, { button: "right" });
    await on.waitForSelector(MENU, { timeout: 10_000 });
    await on.waitForTimeout(250);
  };
  const typeIn = async (on, words) => {
    await on.keyboard.type(words, { delay: 20 });
    await on.waitForTimeout(250);
    return typedSays(on);
  };
  const typing = { filters: {}, enter: {}, asks: {}, answer: {}, context: {}, off: {} };
  for (const face of ["scene", "pages"]) {
    reach(`typingInTheMenuFiltersItsItems_${face}`);
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    await context.addInitScript(FAKE_AI);
    await context.addInitScript(KEEP_THE_STORE);
    await context.addInitScript(KEEP_COPIES);
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`typing ${face}: ${error.message}`));

    /* Typing filters every row: the acts, Open, Copy link, Show in the scene, Inspect. */
    await opened(on, face, "");
    const firstStop = await on.evaluate(() => document.activeElement?.closest('[data-testid="context-menu"]') !== null && document.activeElement?.getAttribute("data-testid") !== "menu-type");
    const before = await typedSays(on);
    const fin = await typeIn(on, "fin");
    await on.keyboard.press("Escape");
    await on.waitForTimeout(150);
    const cleared = await typedSays(on);
    // A row that is not an act, found by its first word: Copy link on the pages, whatever the scene's own rows begin with.
    const other = before?.rows.find((row) => (face === "pages" ? row.id === "copy-link" : !row.id.startsWith("ai-") && row.id !== "ask-typed")) ?? null;
    const word = (other?.text ?? "").split(/\s+/)[0]?.toLowerCase() ?? "";
    const copy = word ? await typeIn(on, word) : null;
    // The Fast slot, once the typing rests: "complete" begins no row's words, and finds "Finish it".
    await on.keyboard.press("Escape");
    // Read at once, before the typing has rested (the Fast slot is asked 250 ms after the last key).
    await on.keyboard.type("complete");
    const completeAtOnce = await typedSays(on);
    await on.waitForFunction(() => document.querySelector('[data-testid="context-menu"] [data-affordance][data-menu-lit]') !== null, null, { timeout: 5_000 }).catch(() => undefined);
    const completeRested = await typedSays(on);
    const fastRefines = { atOnce: completeAtOnce?.acts ?? null, rested: completeRested?.acts ?? null, lit: completeRested?.lit ?? null };
    typing.filters[face] = { firstStop, before: { acts: before?.acts.length, rows: before?.rows.map((row) => row.id) }, fin, cleared: cleared?.typed, word, copy, fastRefines };
    typing.filters[face].ok =
      firstStop &&
      before !== null && before.acts.length > 1 &&
      fin !== null && fin.keyboardInTheField && fin.typed === "fin" && fin.acts.includes("Finish it") && fin.acts.length < before.acts.length && allFit(fin, "fin") && fin.lit === "Finish it" &&
      cleared?.typed === "" &&
      copy !== null && allFit(copy, copy.typed) && copy.rows.some((row) => row.id === other.id) && copy.rows.at(-1)?.id === "ask-typed" &&
      fastRefines.atOnce !== null && !fastRefines.atOnce.includes("Finish it") && (fastRefines.rested ?? []).includes("Finish it") && fastRefines.lit === "Finish it";
    await on.keyboard.press("Escape");
    await on.keyboard.press("Escape");
    await on.waitForTimeout(150);

    /* Enter runs the row typed: Finish it on the scene; Copy link on the pages. */
    reach(`enterRunsTheItemTyped_${face}`);
    await opened(on, face, "");
    const words = face === "pages" ? "copy li" : "finish";
    const lit = await typeIn(on, words);
    const doneBefore = await doneOf(on, "t-deposit");
    await on.evaluate(() => (window.__copied = []));
    await on.keyboard.press("Enter");
    await on.waitForTimeout(500);
    const ran = face === "pages" ? await on.evaluate(() => window.__copied[0] ?? null) : await doneOf(on, "t-deposit");
    const menuGone = !(await on.$(MENU));
    const keyboardOnBody = await on.evaluate(() => document.activeElement === document.body);
    typing.enter[face] = { words, lit: lit?.lit, doneBefore, ran, menuGone, keyboardOnBody };
    typing.enter[face].ok = menuGone && !keyboardOnBody && (face === "pages" ? lit?.lit === "Copy link" && ran === new URL("/pages/tasks/t-deposit", at("todo")).href : lit?.lit === "Finish it" && doneBefore === false && ran === true);

    /* Free words, asked about what is under the cursor: the thinking marked on it, the answer a card beside it. */
    reach(`freeWordsAskAboutWhatIsUnderTheCursor_${face}`);
    await opened(on, face, "");
    const asking = "is this one still waiting on anything?";
    const askRow = await typeIn(on, asking);
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="ai-thinking-mark"]', { timeout: 5_000 }).catch(() => undefined);
    await on.waitForTimeout(150);
    const thinking = await on.evaluate(() => {
      const mark = document.querySelector('[data-testid="ai-thinking-mark"]');
      if (!mark) return null;
      const on = mark.getAttribute("data-thinking-on");
      const anchor = on ? document.querySelector(`[data-graview-ai-thinking]`) : null;
      const m = mark.getBoundingClientRect();
      const a = anchor?.getBoundingClientRect();
      return {
        on,
        role: mark.getAttribute("role"),
        said: (mark.textContent ?? "").trim(),
        visible: getComputedStyle(mark).visibility === "visible" && m.width > 0,
        anchorIs: anchor ? (anchor.getAttribute("data-graview-view") ?? anchor.getAttribute("data-graview-pick") ?? anchor.getAttribute("data-graview-record") ?? anchor.getAttribute("data-graview-listed")) : null,
        // On the thing: its middle within the thing's box, give or take its own height.
        onIt: Boolean(a && m.left + m.width / 2 >= a.left - 4 && m.left + m.width / 2 <= a.right + 4 && m.top + m.height / 2 >= a.top - m.height && m.top + m.height / 2 <= a.bottom + 4),
        modal: document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
      };
    });
    const card = await on.evaluate(() => {
      const card = document.querySelector('[data-testid="quick-ask"]');
      return card ? { beside: card.getAttribute("data-quick-ask-beside"), asked: card.querySelector('[data-testid="quick-answer-asked"]')?.textContent ?? null } : null;
    });
    typing.asks[face] = { askRow: askRow?.rows.at(-1) ?? null, lit: askRow?.lit, thinking, card, menuGone: !(await on.$(MENU)) };
    typing.asks[face].ok =
      askRow !== null && askRow.acts.length === 0 && askRow.rows.at(-1)?.id === "ask-typed" && askRow.lit === `Tell Graview “${asking}”` &&
      thinking !== null && thinking.on === "t-deposit" && thinking.anchorIs === "t-deposit" && thinking.role === "status" && thinking.said.includes("Pay the deposit") && thinking.visible && thinking.onIt && !thinking.modal &&
      card !== null && card.beside === "t-deposit" && card.asked === `“${asking}”` && typing.asks[face].menuGone;

    /* The answer beside it, its change a ghost accepted and taken back. */
    reach(`theAnswerShowsBesideItsTargetAndCanBeTakenBack_${face}`);
    await on.waitForFunction(() => /not done yet/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? ""), null, { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const answer = await on.evaluate(() => {
      const card = document.querySelector('[data-testid="quick-ask"]');
      if (!card) return null;
      const beside = card.getAttribute("data-quick-ask-beside");
      const anchor = beside ? document.querySelector(`[data-graview-view="${CSS.escape(beside)}"], [data-graview-pick="${CSS.escape(beside)}"], [data-graview-record="${CSS.escape(beside)}"]`) : null;
      const a = anchor?.getBoundingClientRect();
      const b = card.getBoundingClientRect();
      return {
        beside,
        side: card.getAttribute("data-quick-ask-side"),
        boxes: { it: a ? [Math.round(a.left), Math.round(a.top), Math.round(a.right), Math.round(a.bottom)] : null, card: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] },
        text: card.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? null,
        ghost: card.querySelector('[data-testid="ai-ghost"]') !== null,
        proposed: [...card.querySelectorAll("[data-ghost-proposal]")].map((one) => (one.textContent ?? "").trim()),
        // A question's change is a suggestion beside the answer, the person's to choose: "Finish it?".
        suggested: [...card.querySelectorAll('[data-testid="quick-answer-offer"]')].map((one) => (one.textContent ?? "").trim()),
        overIt: Boolean(a && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2),
        inTheWindow: b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1,
        markGone: document.querySelector('[data-testid="ai-thinking-mark"]') === null && document.querySelector("[data-graview-ai-thinking]") === null,
      };
    });
    const notMade = await doneOf(on, "t-deposit");
    // Chosen, the suggestion is proposed as any change is: a ghost, accepted, then taken back.
    await on.click('[data-testid="quick-ask"] [data-testid="quick-answer-offer"][data-ai-offer-type="act"]').catch(() => undefined);
    await on.waitForSelector('[data-testid="ghost-accept"]', { timeout: 5_000 }).catch(() => undefined);
    const stillNotMade = await doneOf(on, "t-deposit");
    await on.click('[data-testid="ghost-accept"]').catch(() => undefined);
    await on.waitForTimeout(400);
    const accepted = await doneOf(on, "t-deposit");
    await on.click('[data-testid="ghost-undo"]').catch(() => undefined);
    await on.waitForTimeout(400);
    const undone = await doneOf(on, "t-deposit");
    typing.answer[face] = { answer, notMade, stillNotMade, accepted, undone };

    /* The Fast slot's pick is what reached the Thinking slot, and Activity says so. */
    reach(`theFastSlotsPickIsWhatReachesTheThinkingSlot_${face}`);
    const handed = await on.evaluate(() => ({ picked: window.__fastPicked.slice(), saw: window.__thinkingSaw.at(-1) ?? null }));
    await on.click('[data-testid="quick-ask"] [data-testid="ghost-close"], [data-testid="quick-ask-close"]').catch(() => undefined);
    await on.keyboard.press("Escape").catch(() => undefined);
    await on.click('[data-testid="activity-button"]:visible').catch(() => undefined);
    await on.waitForSelector('[data-testid="interaction-context"]', { timeout: 8_000 }).catch(() => undefined);
    const said = await on.evaluate(() => {
      const row = document.querySelector('[data-testid="interaction-context"]');
      return row ? { by: row.getAttribute("data-context-by"), words: (row.textContent ?? "").trim() } : null;
    });
    const pickedCandidate = handed.picked.find((one) => one.key === "candidates")?.said ?? "";
    const pickedRecord = handed.picked.find((one) => one.key === "records")?.said ?? "";
    typing.context[face] = { picked: handed.picked, saw: handed.saw, activity: said };
    typing.context[face].ok =
      handed.saw !== null &&
      handed.saw.candidates.length === 1 && pickedCandidate.endsWith(handed.saw.candidates[0]) && /^Finish it/.test(pickedCandidate) &&
      (pickedRecord === "" ? handed.saw.records.length === 0 : handed.saw.records.length === 1 && pickedRecord.includes(handed.saw.records[0])) &&
      said !== null && said.by === "fast" && said.words.includes("fake-fast");
    typing.answer[face].ok = answer !== null && answer.beside === "t-deposit" && (answer.text ?? "").includes("not done yet") && !answer.ghost && answer.proposed.length === 0 && answer.suggested.some((one) => /\?$/.test(one)) && answer.inTheWindow && answer.markGone && notMade === false && stillNotMade === false && accepted === true && undone === false;
    await context.close();

    /* With AI off, the field only filters. */
    reach(`withoutAiTheFieldOnlyFilters_${face}`);
    const offContext = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    const off = await offContext.newPage();
    off.on("pageerror", (error) => errors.push(`typing off ${face}: ${error.message}`));
    await opened(off, face, "&ai=off");
    const offFin = await typeIn(off, "fin");
    const offNothing = await typeIn(off, "zzq");
    await off.keyboard.press("Enter");
    await off.waitForTimeout(300);
    const stillOpen = Boolean(await off.$(MENU));
    const noCard = !(await off.$('[data-testid="quick-ask"]'));
    const placeholder = await off.getAttribute('[data-testid="menu-type"]', "placeholder").catch(() => null);
    typing.off[face] = { fin: offFin, nothing: offNothing, stillOpen, noCard, placeholder };
    typing.off[face].ok =
      offFin !== null && offFin.acts.includes("Finish it") && allFit(offFin, "fin") && !offFin.rows.some((row) => row.id === "ask-typed" || row.id.startsWith("ai-")) &&
      offNothing !== null && offNothing.acts.length === 0 && offNothing.rows.length === 0 && offNothing.lit === null && (offNothing.noMatch ?? "").includes("finzzq") &&
      stillOpen && noCard && placeholder === "Type to filter…";
    await offContext.close();
  }
  /*
   * THE MENU NEVER CALLS AN INSTRUCTION A QUESTION. Nick mostly tells it to
   * do something: the field, the row Enter runs, the card and its reply
   * field, Activity's line, every name a screen reader hears — none says
   * "ask".
   */
  reach("theMenuNeverCallsAnInstructionAQuestion");
  {
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    await context.addInitScript(FAKE_AI);
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`words: ${error.message}`));
    const wordsOf = (selector) =>
      on.evaluate((selector) => {
        const root = document.querySelector(selector);
        if (!root) return null;
        const named = [...root.querySelectorAll("[aria-label], [placeholder], [title]")].flatMap((one) => [one.getAttribute("aria-label"), one.getAttribute("placeholder"), one.getAttribute("title")]);
        // The model's own answer is its words, not the app's: left out.
        const shown = [...root.querySelectorAll("button, label, [role=option], [data-menu-item], [data-testid=quick-answer-asked], [data-testid=ai-thinking-mark]")].map((one) => one.textContent ?? "");
        return [root.getAttribute("aria-label"), ...named, ...shown].filter(Boolean).join(" | ");
      }, selector);
    await opened(on, "scene", "");
    await on.keyboard.type("assign all these to nick");
    await on.waitForTimeout(300);
    const inTheMenu = await wordsOf(MENU);
    const inlineRow = await on.evaluate(() => document.querySelector('[data-menu-item="ai-ask"]')?.textContent ?? null);
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask"]', { timeout: 10_000 }).catch(() => undefined);
    await on.waitForTimeout(400);
    const onTheCard = await wordsOf('[data-testid="quick-ask"]');
    await on.click('[data-testid="quick-ask-close"]').catch(() => undefined);
    await on.click('[data-testid="activity-button"]:visible').catch(() => undefined);
    await on.waitForSelector('[data-testid="activity-interaction"]', { timeout: 8_000 }).catch(() => undefined);
    const inActivity = await on.evaluate(() => [...document.querySelectorAll('[data-testid="activity-interaction"]')].map((one) => one.querySelector("[data-graview-activity-words]")?.textContent ?? "").join(" | "));
    const asks = (words) => /\bask(s|ed|ing)?\b/i.test(words ?? "");
    report.checks.theMenuNeverCallsAnInstructionAQuestion = {
      inTheMenu,
      inlineRow,
      onTheCard,
      inActivity,
      ok: inTheMenu !== null && !asks(inTheMenu) && /Tell Graview/.test(inTheMenu) && onTheCard !== null && !asks(onTheCard) && /told Graview/.test(inActivity) && !asks(inActivity),
    };
    await context.close();
  }

  /*
   * GRAVIEW IS HERE WHILE IT THINKS, AND GOES WHEN THE CARD CLOSES. Asked
   * from the menu, the app's AI stands among who is here — in this tab's
   * bar and, over the presence channel, in another tab's — from the words
   * asked until the card is put away.
   */
  reach("graviewIsHereWhileItThinksAndGoesWhenTheCardCloses");
  {
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    await context.addInitScript(FAKE_AI);
    const on = await context.newPage();
    const other = await context.newPage();
    on.on("pageerror", (error) => errors.push(`present: ${error.message}`));
    other.on("pageerror", (error) => errors.push(`present (other tab): ${error.message}`));
    await other.goto(faces.scene.at(""), { waitUntil: "load" });
    await faces.scene.ready(other);
    await opened(on, "scene", "");
    await on.keyboard.type("is this one still waiting on anything?");
    await on.keyboard.press("Enter");
    const hereSays = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="here-open"]')].map((one) => one.getAttribute("aria-label") ?? "").join(" | "));
    await on.waitForFunction(() => [...document.querySelectorAll('[data-testid="here-open"]')].some((one) => /Graview/.test(one.getAttribute("aria-label") ?? "")), null, { timeout: 5_000 }).catch(() => undefined);
    const whileThinking = { here: await hereSays(on), thinking: Boolean(await on.$('[data-testid="ai-thinking-mark"]')) };
    await other.waitForFunction(() => [...document.querySelectorAll('[data-testid="here-open"]')].some((one) => /Graview/.test(one.getAttribute("aria-label") ?? "")), null, { timeout: 5_000 }).catch(() => undefined);
    const otherTab = await hereSays(other);
    await on.waitForFunction(() => /not done yet/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? ""), null, { timeout: 15_000 }).catch(() => undefined);
    const answered = await hereSays(on);
    await on.click('[data-testid="quick-ask-close"]').catch(() => undefined);
    await on.waitForTimeout(400);
    const closedHere = await hereSays(on);
    await other.waitForFunction(() => ![...document.querySelectorAll('[data-testid="here-open"]')].some((one) => /Graview/.test(one.getAttribute("aria-label") ?? "")), null, { timeout: 12_000 }).catch(() => undefined);
    const closedThere = await hereSays(other);
    report.checks.graviewIsHereWhileItThinksAndGoesWhenTheCardCloses = {
      whileThinking,
      otherTab,
      answered,
      closedHere,
      closedThere,
      ok: /Graview/.test(whileThinking.here) && whileThinking.thinking && /Graview/.test(otherTab) && /Graview/.test(answered) && !/Graview/.test(closedHere) && !/Graview/.test(closedThere),
    };
    await context.close();
  }

  /*
   * AN ASK ABOUT A LIST ACTS ON EVERY RECORD IN IT AS ONE CHANGE, and A
   * MISSING CAPABILITY IS OFFERED AS ONE PLAN THAT FINISHES THE ASK — on the
   * tasks with nobody to give them to, mounted as Cloud mounts an app, its
   * host one that applies a change to the app.
   */
  {
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    await context.addInitScript(FAKE_AI);
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`plan: ${error.message}`));
    if (!menuHost) menuHost = await serveMenuHost();
    const openLean = async () => {
      await on.goto(`http://localhost:${portFor("menu-host")}${MENU_BASE}/tasks?lean=1`, { waitUntil: "load" });
      await on.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await on.waitForSelector('[data-graview-record="t1"]', { timeout: 30_000 });
      await on.click(":is([data-graview-page-title], main h1, main h2) >> nth=0", { button: "right" });
      await on.waitForSelector(MENU, { timeout: 10_000 });
      await on.waitForTimeout(250);
    };
    const storeSays = () =>
      on.evaluate(() => {
        const store = window.__handle.store;
        const tasks = ["t1", "t2"].map((id) => store.graph.getNode(id));
        const people = store.graph.allNodes().filter((node) => node.kind === "person");
        const owned = ["t1", "t2"].map((id) => store.graph.out(id, "assignedTo").map((node) => node.name ?? node.label));
        const last = store.log.all().at(-1);
        return { kinds: store.schema.kinds, statuses: tasks.map((task) => task?.status), people: people.map((one) => one.name ?? one.label), owned, lastBatch: last?.batch ?? null, lastVia: last?.via ?? null, rules: store.allInvariants?.().length ?? null };
      });

    reach("anAskAboutAListActsOnEveryRecordInItAsOneChange");
    await openLean();
    await on.keyboard.type("mark these done");
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask"] [data-testid="ai-ghost"]', { timeout: 15_000 }).catch(() => undefined);
    const proposed = await on.evaluate(() => [...document.querySelectorAll('[data-testid="quick-ask"] [data-ghost-proposal]')].map((one) => one.getAttribute("data-ghost-proposal")));
    const before = await storeSays();
    await on.click('[data-testid="quick-ask"] [data-testid="ghost-accept"]').catch(() => undefined);
    await on.waitForTimeout(400);
    const accepted = await storeSays();
    const batches = await on.evaluate(() => [...new Set(window.__handle.store.log.all().slice(-2).map((op) => op.batch))]);
    await on.click('[data-testid="quick-ask"] [data-testid="ghost-undo"]').catch(() => undefined);
    await on.waitForTimeout(400);
    const undone = await storeSays();
    report.checks.anAskAboutAListActsOnEveryRecordInItAsOneChange = {
      proposed,
      before: before.statuses,
      accepted: accepted.statuses,
      batches,
      undone: undone.statuses,
      ok: proposed.length === 2 && proposed.every((id) => /^each:set-status:t[12]$/.test(id ?? "")) && before.statuses.some((one) => one !== "done") && accepted.statuses.every((one) => one === "done") && batches.length === 1 && JSON.stringify(undone.statuses) === JSON.stringify(before.statuses),
    };

    reach("aMissingCapabilityIsOfferedAsOnePlanThatFinishesTheAsk");
    await openLean();
    await on.keyboard.type("assign these to nick");
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask-plan"]', { timeout: 15_000 }).catch(() => undefined);
    const offered = await on.evaluate(() => {
      const card = document.querySelector('[data-testid="quick-ask"]');
      return {
        said: card?.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? null,
        parts: [...(card?.querySelectorAll("[data-plan-part]") ?? [])].map((one) => ({ part: one.getAttribute("data-plan-part"), said: (one.textContent ?? "").trim() })),
        yes: Boolean(card?.querySelector('[data-testid="quick-ask-plan-yes"]')),
        proposedYet: (window.__proposed ?? []).length,
      };
    });
    const notYet = await storeSays();
    await on.click('[data-testid="quick-ask-plan-yes"]').catch(() => undefined);
    await on.waitForFunction(() => window.__handle.store.schema.kinds.includes("person"), null, { timeout: 10_000 }).catch(() => undefined);
    await on.waitForTimeout(500);
    const landed = await storeSays();
    const undoOffered = await on.waitForSelector('[data-testid="notice-action"]', { timeout: 5_000 }).then(() => true, () => false);
    if (undoOffered) await on.click('[data-testid="notice-action"]');
    else await on.evaluate(() => window.__undoPlan?.());
    await on.waitForFunction(() => !window.__handle.store.schema.kinds.includes("person"), null, { timeout: 10_000 }).catch(() => undefined);
    await on.waitForTimeout(400);
    const back = await storeSays();
    const text = offered.parts.map((one) => one.said).join(" | ");
    // The list the page shows is the board it opens on: "in The board".
    const STEPS = ["Add a People list.", "Give each task an “Assigned to” field that points to a person.", "Add Nick to People.", "Assign Nick to the 2 tasks in The board."];
    report.checks.aMissingCapabilityIsOfferedAsOnePlanThatFinishesTheAsk = {
      offered,
      notYet: { kinds: notYet.kinds, people: notYet.people },
      landed,
      undoOffered,
      back: { kinds: back.kinds, owned: back.owned },
      ok:
        offered.said === "Tasks have no one assigned to them. I can do it in 4 steps. Should I?" && offered.yes && offered.proposedYet === 0 &&
        JSON.stringify(offered.parts.map((one) => one.said)) === JSON.stringify(STEPS) &&
        !notYet.kinds.includes("person") &&
        landed.kinds.includes("person") && landed.people.includes("Nick") && landed.owned.every((names) => names.length === 1 && names[0] === "Nick") && landed.lastVia === "ai:fake" &&
        undoOffered && !back.kinds.includes("person") && back.owned.every((names) => names.length === 0),
    };
    /* Its steps in plain words, and only what the ask needed: no rule, no new place, nothing the app's names. */
    report.checks.aPlanSaysItsStepsInPlainWords = {
      said: offered.said,
      steps: offered.parts.map((one) => one.said),
      ok: offered.parts.length > 0 && !/\b[a-z]+-[a-z]+\b|people who own things|owner link|Who has what|somebody on it|[a-z,] (Give|Set|Add) [a-z]/.test([offered.said, text].join(" ")),
    };
    report.checks.aPlanTakesOnlyWhatTheAskNeeds = {
      edits: (await on.evaluate(() => (window.__proposed ?? []).at(-1)?.edits?.map((edit) => edit.op) ?? null)),
      rulesBefore: notYet.rules,
      rulesLanded: landed.rules,
      ok: false,
    };
    report.checks.aPlanTakesOnlyWhatTheAskNeeds.ok = JSON.stringify(report.checks.aPlanTakesOnlyWhatTheAskNeeds.edits) === JSON.stringify(["add-kind", "add-relation", "add-act"]) && notYet.rules === landed.rules;
    await context.close();
  }

  /*
   * OPTION KEEPS THE BROWSER'S OWN MENU; CTRL+CLICK IS OURS. A right-click
   * with Option (Alt) held is the browser's — Inspect element, Look up —
   * on the scene's card, its ground and the pages' row alike; a Ctrl+click,
   * which a Mac's one-button trackpad sends as a contextmenu with ctrlKey,
   * opens ours as any right-click does.
   */
  reach("aRightClickWithOptionShowsTheBrowsersMenu");
  {
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`option: ${error.message}`));
    const heard = () =>
      on.evaluate(() => {
        const events = (window.__ctx ?? []).splice(0);
        return { ours: Boolean(document.querySelector('[data-testid="context-menu"]')), events: events.length, prevented: events.some((event) => event.defaultPrevented) };
      });
    const listen = () => on.evaluate(() => {
      window.__ctx = [];
      window.addEventListener("contextmenu", (event) => window.__ctx.push(event), true);
    });
    /* A contextmenu said by the page itself on the target, as the browser would raise it, with these keys held. */
    const said = (selector, keys) =>
      on.evaluate(([selector, keys]) => {
        const target = document.querySelector(selector);
        const box = target?.getBoundingClientRect();
        target?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, composed: true, clientX: (box?.left ?? 0) + 8, clientY: (box?.top ?? 0) + 8, ...keys }));
      }, [selector, keys]);
    const centerOf = (selector) => on.evaluate((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { x: Math.round(box.left + Math.min(20, box.width / 2)), y: Math.round(box.top + Math.min(14, box.height / 2)) } : null;
    }, selector);
    const option = {};
    const ctrl = {};
    for (const face of ["scene", "pages"]) {
      await on.goto(faces[face].at(""), { waitUntil: "load" });
      await faces[face].ready(on);
      await listen();
      const point = await centerOf(faces[face].target);
      if (!point) continue;
      // Option held across a real right-click.
      await on.keyboard.down("Alt");
      await on.mouse.click(point.x, point.y, { button: "right" });
      await on.keyboard.up("Alt");
      await on.waitForTimeout(400);
      option[face] = { how: "a right-click", ...(await heard()) };
      // An engine whose driven right-click with Option raises no contextmenu (WebKit) is told it as the browser would say it.
      if (option[face].events === 0) {
        await putAway(on);
        await said(faces[face].target, { button: 2, altKey: true });
        await on.waitForTimeout(400);
        option[face] = { how: "said by the page", ...(await heard()) };
      }
      await putAway(on);
      // A Ctrl+click as a Mac trackpad sends it: a contextmenu from the primary button, ctrlKey held.
      await said(faces[face].target, { button: 0, ctrlKey: true });
      await on.waitForSelector(MENU, { timeout: 5_000 }).catch(() => undefined);
      await on.waitForTimeout(200);
      ctrl[face] = await heard();
      await putAway(on);
    }
    report.checks.aRightClickWithOptionShowsTheBrowsersMenu = {
      ...option,
      ok: ["scene", "pages"].every((face) => option[face] && option[face].events >= 1 && !option[face].prevented && !option[face].ours),
    };
    report.checks.aCtrlClickStillOpensOurMenu = {
      ...ctrl,
      ok: ["scene", "pages"].every((face) => ctrl[face] && ctrl[face].events >= 1 && ctrl[face].prevented && ctrl[face].ours),
    };
    await context.close();
  }

  /*
   * A ROW UNDER THE POINTER NEVER MOVES AS SUGGESTIONS ARRIVE. Homeflow: "i
   * end up often clicking a different option when i try to hit Send Feedback
   * because it jumps down as AI items are populated". On a row's menu on the
   * pages of an app mounted as Cloud mounts one, whose host adds "Send
   * feedback" below the AI's rows, the pointer goes straight to it while
   * the Fast slot is still suggesting; its box is the same before and after
   * the suggestions land, and the press sends feedback.
   */
  reach("aRowUnderThePointerNeverMovesAsSuggestionsArrive");
  {
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    await context.addInitScript(FAKE_AI);
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`steady: ${error.message}`));
    if (!menuHost) menuHost = await serveMenuHost();
    await on.goto(`http://localhost:${portFor("menu-host")}${MENU_BASE}/tasks`, { waitUntil: "load" });
    await on.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
    await on.waitForSelector('[data-graview-record="t1"]', { timeout: 30_000 });
    await on.click('[data-graview-record="t1"]', { button: "right" });
    await on.waitForSelector(MENU, { timeout: 10_000 });
    const FOOT = `${MENU} [data-menu-item="send-feedback"]`;
    await on.waitForSelector(FOOT, { timeout: 10_000 });
    const boxOf = () => on.evaluate((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { x: Math.round(box.x * 10) / 10, y: Math.round(box.y * 10) / 10, height: Math.round(box.height * 10) / 10 } : null;
    }, FOOT);
    // The menu scrolls inside itself when it is taller than its room: the row into view first, as a pointer's wheel would.
    await on.evaluate((selector) => document.querySelector(selector)?.scrollIntoView({ block: "nearest" }), FOOT);
    const thinkingAtFirst = Boolean(await on.$(`${MENU} [data-testid="inline-ai-thinking"]`));
    const before = await boxOf();
    if (before) await on.mouse.move(before.x + 20, before.y + before.height / 2);
    const hovered = await on.evaluate((selector) => document.querySelector(selector)?.matches(":hover") ?? false, FOOT);
    await on.waitForSelector(`${MENU} [data-ai-offer]`, { timeout: 8_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const after = await boxOf();
    const arrived = await on.evaluate(() => document.querySelectorAll('[data-testid="context-menu"] [data-ai-offer]').length);
    // The press lands on the row the pointer went to.
    await on.mouse.down();
    await on.mouse.up();
    await on.waitForTimeout(300);
    const pressedIt = await on.evaluate(() => window.__feedback === 1);
    report.checks.aRowUnderThePointerNeverMovesAsSuggestionsArrive = {
      thinkingAtFirst,
      before,
      after,
      window: await on.evaluate(() => innerHeight),
      hovered,
      arrived,
      pressedIt,
      ok: thinkingAtFirst && before !== null && after !== null && before.y === after.y && before.x === after.x && hovered && arrived > 0 && pressedIt,
    };
    await context.close();
  }

  /*
   * ALL THESE ON A LIST MEANS THE RECORDS IN IT; A REPLY REVISES THE PLAN ON
   * THE CARD; A PLAN OVER THE GRAPH NEEDS NO THINKING MODEL. On the todo
   * example's This week list, "assign all these to Sam": the Fast slot reads
   * "these" as the tasks the list holds and the plan's steps act on them,
   * with the Thinking slot never asked. Misread on purpose, the card says
   * the reading it took in one line; the reply Nick typed revises the plan
   * to the tasks, and Yes is offered — no checker's sentence shown.
   */
  {
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    await context.addInitScript(FAKE_AI);
    await context.addInitScript(() => (window.__todoDevHost = true));
    await context.addInitScript(KEEP_THE_STORE);
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`these: ${error.message}`));
    const WEEK = `${at("todo")}/pages/lists/week?today=2026-09-01&fresh=1`;
    const openWeek = async () => {
      await on.goto(WEEK, { waitUntil: "load" });
      await on.waitForSelector("[data-graview-page-title], main h1", { timeout: 60_000 });
      await on.waitForTimeout(500);
      await on.click(":is([data-graview-page-title], main h1) >> nth=0", { button: "right" });
      await on.waitForSelector(MENU, { timeout: 10_000 });
      await on.waitForTimeout(250);
    };
    const cardSays = () =>
      on.evaluate(() => {
        const card = document.querySelector('[data-testid="quick-ask"]');
        return {
          said: card?.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? null,
          reading: card?.querySelector('[data-testid="quick-ask-reading"]')?.textContent ?? null,
          steps: [...(card?.querySelectorAll("[data-plan-part]") ?? [])].map((one) => (one.textContent ?? "").trim()),
          yes: Boolean(card?.querySelector('[data-testid="quick-ask-plan-yes"]')),
          refused: card?.querySelector('[data-testid="quick-ask-refused"]')?.textContent ?? null,
          whole: card?.textContent ?? "",
          thinkingCalls: window.__thinkingCalls ?? 0,
        };
      });
    const tasksInWeek = await (async () => {
      await on.goto(WEEK, { waitUntil: "load" });
      await on.waitForSelector("[data-graview-page-title], main h1", { timeout: 60_000 });
      await on.waitForTimeout(500);
      return on.evaluate(() => (window.__menuStores ?? []).find((one) => one.schema.kinds.includes("task"))?.graph.out("week", "holds").length ?? null);
    })();

    reach("allTheseOnAListMeansTheRecordsInIt");
    await openWeek();
    const started = Date.now();
    await on.keyboard.type("assign all these to Sam");
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask-plan"]', { timeout: 15_000 }).catch(() => undefined);
    const tookMs = Date.now() - started;
    const these = await cardSays();
    const held = tasksInWeek ?? Number(/the (\d+) tasks/.exec(these.steps.at(-1) ?? "")?.[1] ?? NaN);
    report.checks.allTheseOnAListMeansTheRecordsInIt = {
      ...these,
      held,
      ok: these.steps.at(-1) === `Assign Sam to the ${held} tasks in This week.` && held > 1 && these.reading === null && these.yes && !/list/i.test(these.said ?? ""),
    };
    report.checks.aPlanOverTheGraphNeedsNoThinkingModel = {
      thinkingCalls: these.thinkingCalls,
      tookMs,
      stages: null,
      ok: false,
    };
    await on.click('[data-testid="quick-ask-close"]').catch(() => undefined);
    await on.keyboard.press("Escape").catch(() => undefined);
    await on.click('[data-testid="activity-button"]:visible').catch(() => undefined);
    await on.waitForSelector('[data-testid="interaction-stages"]', { timeout: 8_000 }).catch(() => undefined);
    const stages = await on.evaluate(() => {
      const details = document.querySelector('[data-testid="interaction-stages"]');
      if (details) details.open = true;
      return details ? (details.textContent ?? "").trim() : null;
    });
    report.checks.aPlanOverTheGraphNeedsNoThinkingModel.stages = stages;
    report.checks.aPlanOverTheGraphNeedsNoThinkingModel.ok = these.thinkingCalls === 0 && these.steps.length > 0 && tookMs < 5_000 && /Jev|fake-fast/.test(stages ?? "") && !/fake-thinking/.test(stages ?? "");

    reach("aReplyRevisesThePlanOnTheCard");
    await openWeek();
    await on.evaluate(() => (window.__misread = true));
    await on.keyboard.type("assign all these to Sam");
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask-reading"]', { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const first = await cardSays();
    await on.fill('[data-testid="quick-ask-input"]', "no, not lists.. i want to assign the tasks in this list to sam").catch(() => undefined);
    await on.press('[data-testid="quick-ask-input"]', "Enter").catch(() => undefined);
    await on.waitForFunction(() => [...document.querySelectorAll('[data-testid="quick-ask"] [data-plan-part]')].some((one) => /tasks in This week/.test(one.textContent ?? "")), null, { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const revised = await cardSays();
    report.checks.aReplyRevisesThePlanOnTheCard = {
      first,
      revised,
      ok:
        first.reading === "Taking this as This week itself." &&
        revised.steps.at(-1) === `Assign Sam to the ${held} tasks in This week.` && revised.yes && revised.refused === null &&
        !/acts on|not on a list|checker/i.test(`${first.whole} ${revised.whole}`) && revised.thinkingCalls === 0,
    };

    /* THE CARD NEVER SHOWS THE PIPELINE'S OWN NOTES. "Close all tasks in this list" is the act that marks done, over the tasks; a model's fragment ("a way to frobnicate tasks") is never the card's words. */
    reach("theCardNeverShowsThePipelinesOwnNotes");
    await on.evaluate(() => (window.__misread = false));
    await openWeek();
    await on.keyboard.type("close all tasks in this list");
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask"] [data-testid="ai-ghost"]', { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const closing = await on.evaluate(() => ({
      text: document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? null,
      proposed: [...document.querySelectorAll('[data-testid="quick-ask"] [data-ghost-proposal]')].map((one) => one.getAttribute("data-ghost-proposal")),
      plan: Boolean(document.querySelector('[data-testid="quick-ask-plan"]')),
    }));
    await openWeek();
    await on.keyboard.type("frobnicate these");
    await on.keyboard.press("Enter");
    await on.waitForFunction(() => !/Thinking/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? "Thinking"), null, { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const fragment = await on.evaluate(() => document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? null);
    const whole = (text) => /^[\p{Lu}\p{N}"“‘'(]/u.test(text ?? "") && /[.!?…][”’"')]*$/u.test((text ?? "").trim()) && (text ?? "").trim().split(/\s+/).length >= 3;
    report.checks.theCardNeverShowsThePipelinesOwnNotes = {
      closing,
      fragment,
      ok:
        closing.proposed.length >= 1 && closing.proposed.length <= held && closing.proposed.every((id) => /^each:finish:t-/.test(id ?? "")) && !closing.plan && whole(closing.text) &&
        fragment !== null && whole(fragment) && !/a way to frobnicate/i.test(fragment),
    };

    /* A DESTRUCTIVE ACT OVER SEVERAL NEEDS A CLEAR READING: "delete the old ones" asks which; "delete the done ones" drops exactly the done. */
    reach("aDestructiveActOverSeveralNeedsAClearReading");
    await openWeek();
    await on.keyboard.type("delete the old ones");
    await on.keyboard.press("Enter");
    await on.waitForFunction(() => !/Thinking/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? "Thinking"), null, { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const unclear = await on.evaluate(() => ({
      text: document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? null,
      proposed: [...document.querySelectorAll('[data-testid="quick-ask"] [data-ghost-proposal]')].length,
    }));
    await openWeek();
    await on.keyboard.type("delete the done ones");
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask"] [data-testid="ai-ghost"]', { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const clear = await on.evaluate(() => {
      const store = (window.__menuStores ?? []).find((one) => one.schema.kinds.includes("task"));
      const done = store ? store.graph.out("week", "holds").filter((task) => task.done === true).map((task) => task.id) : [];
      return {
        done,
        text: document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? null,
        proposed: [...document.querySelectorAll('[data-testid="quick-ask"] [data-ghost-proposal]')].map((one) => one.getAttribute("data-ghost-proposal")),
      };
    });
    report.checks.aDestructiveActOverSeveralNeedsAClearReading = {
      unclear,
      clear,
      ok:
        unclear.proposed === 0 && /\?$/.test((unclear.text ?? "").trim()) && /\ball \d+\b/.test(unclear.text ?? "") &&
        clear.done.length > 0 && clear.proposed.length === clear.done.length && clear.proposed.every((id) => clear.done.some((done) => (id ?? "").endsWith(`:${done}`))),
    };

    /* A TRAILING QUALIFIER IS NEVER IGNORED BY A DESTRUCTIVE ACT: read as everything, "that's already ticked off" is left over — the card asks which. */
    reach("aTrailingQualifierIsNeverIgnoredByADestructiveAct");
    await openWeek();
    await on.keyboard.type("scrap everything that's already ticked off");
    await on.keyboard.press("Enter");
    await on.waitForFunction(() => !/Thinking/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? "Thinking"), null, { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const trailing = await on.evaluate(() => ({
      text: document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? null,
      proposed: document.querySelectorAll('[data-testid="quick-ask"] [data-ghost-proposal]').length,
    }));
    report.checks.aTrailingQualifierIsNeverIgnoredByADestructiveAct = { ...trailing, ok: trailing.proposed === 0 && /\?$/.test((trailing.text ?? "").trim()) && /\b1 done\b/.test(trailing.text ?? "") };

    /* THE CARD SAYS WHAT WILL HAPPEN, WITH ITS VALUES: the count it acts on, the name it gives. */
    reach("theCardSaysWhatWillHappenWithItsValues");
    await openWeek();
    await on.keyboard.type("close all tasks in this list");
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask"] [data-testid="ai-ghost"]', { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const closingSaid = await on.evaluate(() => ({ text: document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? "", proposed: document.querySelectorAll('[data-testid="quick-ask"] [data-ghost-proposal]').length }));
    await openWeek();
    await on.keyboard.type("rename this list to Packing week");
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="quick-ask"] [data-testid="ai-ghost"]', { timeout: 15_000 }).catch(() => undefined);
    await on.waitForTimeout(300);
    const renameSaid = await on.evaluate(() => document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? "");
    report.checks.theCardSaysWhatWillHappenWithItsValues = {
      closingSaid,
      renameSaid,
      ok:
        closingSaid.proposed > 1 && new RegExp(`\\bthe ${closingSaid.proposed}\\b`).test(closingSaid.text) && !/ — |itself|each of/.test(closingSaid.text) &&
        /^Rename (?:“?This week”? )?to “Packing week”\.$/.test(renameSaid) && !/ — |itself/.test(renameSaid),
    };
    await context.close();
  }

  /*
   * THE CARD OPENS WHERE THE MENU STOOD, AND NEVER MOVES. Nick: "i don't
   * want the dialog position to change when i select 'tell graview'… rn it
   * jumps." Enter turns the menu into the card with the menu's top-left
   * corner; the answer arriving and the plan growing move it not at all —
   * on the scene and the pages, at a desk's width and a phone's.
   */
  reach("theCardOpensWhereTheMenuStoodAndNeverMoves");
  {
    const stood = {};
    for (const [width, height, size] of [[1560, 940, "desk"], [390, 844, "phone"]]) {
      const context = await browser.newContext({ viewport: { width, height }, ...(size === "phone" ? { hasTouch: true, isMobile: true } : {}) });
      await context.addInitScript(FAKE_AI);
      const on = await context.newPage();
      on.on("pageerror", (error) => errors.push(`stood ${size}: ${error.message}`));
      for (const face of ["scene", "pages"]) {
        await opened(on, face, "");
        const corner = (selector) => on.evaluate((selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box ? { left: Math.round(box.left * 10) / 10, top: Math.round(box.top * 10) / 10, right: Math.round(box.right), bottom: Math.round(box.bottom) } : null;
        }, selector);
        const menuAtOpen = await corner(MENU);
        await on.keyboard.type("assign this to Sam");
        await on.waitForTimeout(300);
        // Where the menu stands as Enter is pressed: the corner the card takes.
        const menu = await corner(MENU);
        await on.keyboard.press("Enter");
        await on.waitForSelector('[data-testid="quick-ask"]', { timeout: 10_000 }).catch(() => undefined);
        const opening = await corner('[data-testid="quick-ask"]');
        const from = await on.evaluate(() => document.querySelector('[data-testid="quick-ask"]')?.getAttribute("data-quick-ask-from") ?? null);
        await on.waitForFunction(() => !/Thinking/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? "Thinking"), null, { timeout: 15_000 }).catch(() => undefined);
        const answered = await corner('[data-testid="quick-ask"]');
        await on.waitForSelector('[data-testid="quick-ask-plan"]', { timeout: 10_000 }).catch(() => undefined);
        await on.waitForTimeout(400);
        const planned = await corner('[data-testid="quick-ask"]');
        const inTheWindow = planned !== null && planned.left >= 0 && planned.top >= 0 && planned.right <= width + 1 && planned.bottom <= height + 1;
        const same = (a, b) => a !== null && b !== null && Math.abs(a.left - b.left) <= 1 && Math.abs(a.top - b.top) <= 1;
        // Where the menu stood: its corner, unless the card's width would leave the window — then moved left that once.
        const fromTheMenu = menu !== null && opening !== null && Math.abs(opening.top - menu.top) <= 1 && (Math.abs(opening.left - menu.left) <= 1 || opening.right >= width - 16);
        // The menu too stood still as it was typed in: its rows narrowed under its own top.
        const menuSteady = same(menuAtOpen, menu);
        stood[`${face}_${size}`] = { menuAtOpen, menu, from, opening, answered, planned, inTheWindow, menuSteady, ok: menuSteady && fromTheMenu && same(opening, answered) && same(opening, planned) && inTheWindow };
        await on.click('[data-testid="quick-ask-close"]').catch(() => undefined);
        await on.keyboard.press("Escape").catch(() => undefined);
      }
      await context.close();
    }
    report.checks.theCardOpensWhereTheMenuStoodAndNeverMoves = { ...stood, ok: Object.values(stood).length === 4 && Object.values(stood).every((one) => one.ok) };
  }

  /*
   * THE FIRST LETTER FILTERS AT ONCE, AND FETCHES WHAT ENTER WILL NEED. The
   * menu's field and its filter are drawn with the menu; the quick ask's
   * card and the plan's code are fetched at the first letter typed, and the
   * filter never waits for them.
   */
  reach("theFirstLetterFiltersAtOnce");
  {
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    await context.addInitScript(FAKE_AI);
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`first letter: ${error.message}`));
    const timings = {};
    for (const face of ["scene", "pages"]) {
      await opened(on, face, "");
      const fetchedBefore = await on.evaluate(() => performance.getEntriesByType("resource").some((one) => /quick-ask-plan/.test(one.name)));
      // A dev server's page fetches hundreds of modules: the buffer is emptied so what the first letter fetches is kept.
      await on.evaluate(() => {
        performance.setResourceTimingBufferSize(5000);
        performance.clearResourceTimings();
      });
      await on.evaluate(() => {
        const menu = document.querySelector('[data-testid="context-menu"]');
        const rows = () => menu.querySelectorAll("[data-affordance], [data-menu-item]").length;
        const before = rows();
        window.__letter = { pressed: 0, filtered: 0 };
        document.addEventListener("keydown", () => { if (!window.__letter.pressed) window.__letter.pressed = performance.now(); }, { capture: true, once: true });
        new MutationObserver((_, observer) => {
          if (window.__letter.pressed && rows() !== before) {
            window.__letter.filtered = performance.now();
            observer.disconnect();
          }
        }).observe(menu, { subtree: true, childList: true, attributes: true });
      });
      await on.keyboard.press("f");
      await on.waitForFunction(() => window.__letter.filtered > 0, null, { timeout: 5_000 }).catch(() => undefined);
      const letter = await on.evaluate(() => ({ ms: Math.round(window.__letter.filtered - window.__letter.pressed), filtered: window.__letter.filtered > 0 }));
      await on.waitForTimeout(800);
      const fetchedAfter = await on.evaluate(() => performance.getEntriesByType("resource").some((one) => /quick-ask-plan/.test(one.name)));
      const marked = await on.evaluate(() => performance.getEntriesByName("graview:quick-ask-preload").length);
      timings[face] = { ...letter, fetchedBefore, fetchedAfter, marked };
      await on.keyboard.press("Escape");
      await on.keyboard.press("Escape");
    }
    report.checks.theFirstLetterFiltersAtOnce = {
      ...timings,
      // At once: within two frames of the key, the chunks fetched by then or after, never waited on.
      ok: ["scene", "pages"].every((face) => timings[face].filtered && timings[face].ms <= 50 && timings[face].marked === 1 && !timings[face].fetchedBefore && timings[face].fetchedAfter),
    };
    await context.close();
  }

  /*
   * LABELS AT ONE SPOT NEVER LIE ON EACH OTHER. Nora's own agent and
   * Graview thinking for her stand at the same list: their names are said
   * once, together ("Nora's agent · Graview, for Nora"), and no figure's
   * label overlaps another's.
   */
  reach("labelsAtOneSpotAreSaidTogetherNeverOverEachOther");
  {
    const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
    const on = await context.newPage();
    on.on("pageerror", (error) => errors.push(`labels: ${error.message}`));
    await on.goto(faces.scene.at(""), { waitUntil: "load" });
    await faces.scene.ready(on);
    await on.evaluate(() => {
      const channel = new BroadcastChannel("graview:who:todo");
      const say = () => {
        const at = new Date().toISOString();
        channel.postMessage({ type: "here", presence: { participant: "human:user-nora:other-tab", kind: "human", name: "Nora", hue: 30, stop: "focus=t-deposit", robot: { at: "t-deposit", mode: "working" }, at } });
        channel.postMessage({ type: "here", presence: { participant: "agent:graview:for-nora", kind: "agent", name: "Graview", onBehalfOf: "user-nora", onBehalfOfName: "Nora", hue: 260, stop: "/", robot: { at: "t-deposit", mode: "thinking" }, at } });
      };
      say();
      window.__saying = setInterval(say, 1000);
    });
    await on.waitForFunction(() => document.querySelectorAll(".graview-figure-name").length > 0, null, { timeout: 10_000 }).catch(() => undefined);
    await on.waitForTimeout(600);
    const labels = await on.evaluate(() => {
      const shown = [...document.querySelectorAll(".graview-figure-name, .graview-figure-edge, [data-graview-label]")].filter((one) => one.getBoundingClientRect().width > 0);
      const boxes = shown.map((one) => ({ text: (one.textContent ?? "").trim(), box: one.getBoundingClientRect().toJSON() }));
      const over = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].box;
          const b = boxes[j].box;
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) over.push([boxes[i].text, boxes[j].text]);
        }
      clearInterval(window.__saying);
      return { said: [...new Set(boxes.map((one) => one.text))], over };
    });
    report.checks.labelsAtOneSpotAreSaidTogetherNeverOverEachOther = {
      ...labels,
      ok: labels.said.some((text) => /Nora's agent/.test(text) && /Graview/.test(text) && text.includes(" · ")) && labels.said.includes("Nora") && labels.over.length === 0,
    };
    await context.close();
  }

  for (const [claim, of] of [
    ["typingInTheMenuFiltersItsItems", typing.filters],
    ["enterRunsTheItemTyped", typing.enter],
    ["freeWordsAskAboutWhatIsUnderTheCursor", typing.asks],
    ["theAnswerShowsBesideItsTargetAndCanBeTakenBack", typing.answer],
    ["theFastSlotsPickIsWhatReachesTheThinkingSlot", typing.context],
    ["withoutAiTheFieldOnlyFilters", typing.off],
  ]) {
    report.checks[claim] = { ...of, ok: ["scene", "pages"].every((face) => of[face]?.ok === true) };
    for (const face of ["scene", "pages"]) delete report.checks[`${claim}_${face}`];
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
