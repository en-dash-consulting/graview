#!/usr/bin/env node
/**
 * MAKE ANY PAGE BETTER (Roadmap f-make-any-page-better), in a real browser.
 *
 * A host page mounts the tasks the way Graview Cloud mounts an app — the
 * embed on the pages, under a base — with the host's door to a change to
 * the app (`composeChange` is the checker's composer, `onDraftChange` shows
 * one on this page only, `onProposeChange` keeps it with one undo, each by
 * `setApp`), the host's views kept in memory (`withMemoryRevisions`, which
 * lends `fork`), and a fake host AI: a Fast slot that says whether words
 * are about the look and whether the view spec can say them, a light slot
 * that drafts view-spec edits, and a full one that writes a page as a view
 * of its own from the page as it stands.
 *
 * Claims (docs/page-better.json):
 *   aTasksRowOffersMakeTheListBetter
 *   theTasksHeadingOffersMakeTheListBetter
 *   aTasksPageOffersMakeItBetter
 *   theHomeOffersMakeItBetter
 *   lookWordsTypedInTheMenuGoToMakeBetterAndRecordWordsToTheQuickAsk
 *   aSpecDraftShowsKeepLandsOneChangeAndUndoTakesItBack
 *   whatTheSpecCannotSayIsOfferedAsItsOwnViewKeptAsThePagesView
 *   aSeatThatMayNotChangeTheAppIsNotOffered
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { vacant } from "./lib/serve.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const SHOTS = process.env.GRAVIEW_PAGE_BETTER_SHOTS;
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let browser;
let host;
let page;
const consoled = [];
const errors = [];
const reach = deadline({
  verdict: resolve(repoRoot, "docs/page-better.json"),
  report,
  cleanup: async () => {
    await browser?.close();
    host?.stop();
  },
});

const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const BASE = "/better";
const SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo", due: "2026-09-03" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing", due: "2026-09-05" },
    { id: "t3", kind: "task", label: "Print the flyers", status: "doing" },
  ],
  edges: [],
};

/*
 * THE FAKE HOST AI. The Fast slot: words about the look ("bigger", "show",
 * "look", "cards") are the look's, others the records'; "bigger" and "side
 * by side" need drawing the spec has none for. The light slot drafts the
 * row's spec with the due date in it. The full slot writes the page as a
 * view of cards, every heading it was told drawn as it was.
 */
const FAKE_AI = () => {
  const asked = (window.__pageAsked = []);
  const choice = (key, choice) => ({ type: "choice", choice, confidence: 0.92, probabilities: { [choice]: 0.92 } });
  const decide = async (state, questions) => {
    asked.push({ slot: "fast", state, keys: Object.keys(questions) });
    const answers = {};
    for (const key of Object.keys(questions)) {
      const words = String(state.typed ?? state.asked ?? "");
      if (key === "about") answers[key] = choice(key, /look|bigger|show|cards|rows|nicer/.test(words) ? "look" : "records");
      else if (key === "can") answers[key] = choice(key, /bigger|side by side|colou?r/.test(words) ? "drawing" : "spec");
      else answers[key] = choice(key, Object.keys(questions[key].criteria ?? { none: 1 }).at(-1));
    }
    return { answers, usage: { inputTokens: 10, outputTokens: 2 } };
  };
  const think = (slot) => async ({ prompt }) => {
    let parsed;
    try {
      parsed = JSON.parse(prompt);
    } catch {
      return { text: "I can only answer about this page." };
    }
    asked.push({ slot, ...parsed });
    if (parsed.now !== undefined) return { text: JSON.stringify({ edits: [{ op: "set-view", kind: "task", slot: "row", blocks: [{ title: "{label}" }, { badge: "{status}" }, { field: "due", as: "date", label: "Due" }] }], said: "Each row shows its status and when it is due." }) };
    if (parsed.as_it_stands !== undefined) {
      const headings = String(parsed.as_it_stands).split("\n").filter((line) => line.startsWith("#")).map((line) => { const level = line.match(/^#+/)[0].length; return `<h${level}>${line.replace(/^#+\s*/, "")}</h${level}>`; }).join("");
      const source = [
        "graview.style(`.pb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; } .pb-card { display: block; padding: 16px; font-size: 1.25rem; border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); background: var(--graview-panel); }`);",
        "graview.onProps((props) => {",
        "  const tasks = props.nodes.filter((node) => node.kind === 'task');",
        `  graview.render(graview.html\`<div class="pb-page">${headings.replace(/`/g, "")}<div class="pb-grid">\${tasks.map((task) => graview.html\`<a class="pb-card" data-key="\${task.id}" data-record="\${task.id}">\${task.label}</a>\`)}</div></div>\`);`,
        "});",
      ].join("\n");
      return { text: JSON.stringify({ source, said: "The tasks are big cards, side by side." }) };
    }
    return { text: "{}" };
  };
  window.__pageAi = { name: "fake", fast: { model: "fake-fast", decide }, light: { model: "fake-light", think: think("light") }, thinking: { model: "fake-full", think: think("thinking") } };
};

async function serveHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-page-better-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { composeAppChange } from "@graview/core/compose";
        import { memoryViews, withMemoryRevisions, Store } from "@graview/core";
        import tasks from ${JSON.stringify(TASKS)};
        const visitor = new URLSearchParams(location.search).get("visitor") === "1";
        const compiled = compileDocumentWithoutCheck(tasks, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const storeOver = (app, records) => new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: records });
        let current = { app: compiled.app, document: tasks, store: storeOver(compiled.app, ${JSON.stringify(SEED)}) };
        const changes = (window.__changes = { drafts: 0, applied: 0, undone: 0, document: () => current.document });
        const changed = (edits) => {
          const composed = composeAppChange({ document: current.document, edits });
          if (!composed.ok) throw new Error(composed.refused);
          return composed;
        };
        const keptViews = withMemoryRevisions(memoryViews({ may: { views: !visitor, lenses: false } }));
        window.__keeper = keptViews;
        window.__handle = mount(document.getElementById("app"), {
          app: current.app,
          store: current.store,
          principal: visitor ? { kind: "human", id: "v1", roles: ["viewer"] } : { kind: "human", id: "p1", roles: ["owner"] },
          face: "pages",
          keptViews,
          composeChange: (change) => composeAppChange(change),
          onDraftChange: (proposal) => {
            const composed = changed(proposal.edits ?? []);
            changes.drafts += 1;
            window.__handle.setApp(composed.app, storeOver(composed.app, current.store.graph.snapshot()));
            return { undo: () => window.__handle.setApp(current.app, current.store) };
          },
          onProposeChange: (proposal) => {
            const before = current;
            const composed = changed(proposal.edits ?? []);
            current = { app: composed.app, document: composed.document, store: storeOver(composed.app, before.store.graph.snapshot()) };
            changes.applied += 1;
            window.__handle.setApp(current.app, current.store);
            return { applied: true, note: "Kept until this page reloads.", undo: () => { current = before; changes.undone += 1; window.__handle.setApp(current.app, current.store); } };
          },
          bar: true,
          label: "The tasks",
          heading: 1,
          height: "100%",
          fonts: false,
          studio: false,
          routing: "address",
          basePath: "${BASE}/",
          ai: window.__pageAi,
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
    if (path === BASE || path.startsWith(`${BASE}/`)) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(page);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await vacant(portFor("page-better-host"));
  await new Promise((ready) => server.listen(portFor("page-better-host"), ready));
  return { stop: () => (server.close(), rmSync(out, { recursive: true, force: true })) };
}

const URL_OF = (path, query = "") => `http://localhost:${portFor("page-better-host")}${BASE}${path}${query}`;
const MENU = '[data-testid="context-menu"]';
const CARD = '[data-testid="section-card"]';
const MAIN = "[data-graview-page-main]";

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${ENGINE}-${name}.png`) });
}

async function ready(page, path, query = "") {
  await page.goto(URL_OF(path, query));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
  await page.waitForSelector(`${MAIN} [data-graview-page-title]`, { timeout: 30_000 });
}

/** Right-clicks the element a selector finds in the page's region, and waits for the menu. */
async function menuOn(page, selector) {
  if (await page.$(MENU)) {
    await page.keyboard.press("Escape");
    await page.waitForSelector(MENU, { state: "detached" }).catch(() => {});
  }
  const box = await page.locator(`${MAIN} ${selector}`).first().boundingBox();
  await page.mouse.click(Math.round(box.x + Math.min(12, box.width / 2)), Math.round(box.y + box.height / 2), { button: "right" });
  await page.waitForSelector(MENU, { timeout: 10_000 });
}

/** What the menu offers to make better: its heading and its rows. */
const offered = (page) =>
  page.evaluate(() => {
    const menu = document.querySelector('[data-testid="context-menu"]');
    const section = menu?.querySelector('[data-menu-section="make-better"]');
    return { heading: section?.textContent ?? null, rows: [...(section?.querySelectorAll("[data-menu-item]") ?? [])].map((row) => row.getAttribute("data-menu-item")), outlined: document.querySelector('[data-testid="section-outline"]') !== null };
  });
const threeWays = (seen) => seen.rows.join() === "section-just-do-it,section-describe,section-highlight";
const settled = (page, phase) => page.waitForSelector(`${CARD}[data-section-phase="${phase}"]`, { timeout: 30_000 });

/** Types words into the menu's field and presses Enter: the row lit, or the words told. */
async function typeInMenu(page, words) {
  await page.focus(`${MENU} [data-testid="menu-type"]`);
  await page.keyboard.type(words, { delay: 20 });
  await page.waitForTimeout(400);
  const row = await page.waitForSelector(`${MENU} [data-menu-item="ask-typed"]`, { timeout: 5_000 }).catch(() => null);
  if (!row) throw new Error(`no "Tell Graview" row; the menu says: ${await page.textContent(MENU)} · the keyboard is on ${await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 200))}`);
  await row.click();
}

/** The rows the list page draws now, by their words. */
const rows = (page) => page.$$eval(`${MAIN} [data-graview-record], ${MAIN} [data-graview-listed]`, (all) => all.map((one) => one.textContent.replace(/\s+/g, " ").trim()));

try {
  host = await serveHost();
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(FAKE_AI);
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && consoled.push(message.text().slice(0, 300)));
  await ready(page, "/tasks");

  reach("aTasksRowOffersMakeTheListBetter");
  {
    await menuOn(page, "[data-graview-record] a, [data-graview-listed] a");
    const seen = await offered(page);
    await shot(page, "menu-on-a-row");
    report.checks.aTasksRowOffersMakeTheListBetter = { ...seen, ok: /Make “Tasks” better/.test(seen.heading ?? "") && threeWays(seen) && seen.outlined };
  }

  reach("theTasksHeadingOffersMakeTheListBetter");
  {
    await menuOn(page, "[data-graview-page-title]");
    const seen = await offered(page);
    report.checks.theTasksHeadingOffersMakeTheListBetter = { ...seen, ok: /Make “Tasks” better/.test(seen.heading ?? "") && threeWays(seen) };
    await page.keyboard.press("Escape");
  }

  reach("aTasksPageOffersMakeItBetter");
  {
    await page.evaluate(() => window.__handle.setPath("/tasks/t1"));
    await page.waitForFunction(() => document.querySelector("[data-graview-page-main] [data-graview-page-title]")?.textContent?.includes("Write the brief"), null, { timeout: 15_000 });
    await menuOn(page, "[data-graview-page-title]");
    const seen = await offered(page);
    await shot(page, "menu-on-a-task");
    report.checks.aTasksPageOffersMakeItBetter = { ...seen, ok: /Make “Task page” better/.test(seen.heading ?? "") && threeWays(seen) };
    await page.keyboard.press("Escape");
  }

  reach("theHomeOffersMakeItBetter");
  {
    await page.evaluate(() => window.__handle.setPath("/"));
    await page.waitForFunction(() => location.pathname.replace(/\/$/, "") === "/better", null, { timeout: 15_000 });
    await page.waitForSelector(MAIN, { timeout: 15_000 });
    await page.waitForTimeout(300);
    const box = await page.locator(MAIN).first().boundingBox();
    await page.mouse.click(Math.round(box.x + 24), Math.round(box.y + 24), { button: "right" });
    await page.waitForSelector(MENU, { timeout: 10_000 });
    const seen = await offered(page);
    report.checks.theHomeOffersMakeItBetter = { ...seen, path: await page.evaluate(() => location.pathname), ok: /Make “Home” better/.test(seen.heading ?? "") && threeWays(seen) };
    await page.keyboard.press("Escape");
  }

  reach("lookWordsTypedInTheMenuGoToMakeBetterAndRecordWordsToTheQuickAsk");
  {
    await page.evaluate(() => window.__handle.setPath("/tasks"));
    await page.waitForFunction(() => document.querySelector("[data-graview-page-main] [data-graview-page-title]")?.textContent?.trim() === "Tasks", null, { timeout: 15_000 });
    // Record words first: the quick ask's, never the page's card.
    await menuOn(page, "[data-graview-record] a, [data-graview-listed] a");
    await typeInMenu(page, "close these");
    await page.waitForSelector('[data-testid="quick-ask"]', { timeout: 15_000 });
    const recordsWent = { quickAsk: true, card: (await page.$(CARD)) !== null };
    await page.click('[data-testid="quick-ask-close"]').catch(() => page.keyboard.press("Escape"));
    await page.waitForSelector('[data-testid="quick-ask"]', { state: "detached", timeout: 5_000 }).catch(() => {});
    const rowsBefore = await rows(page);
    await menuOn(page, "[data-graview-record] a, [data-graview-listed] a");
    await typeInMenu(page, "show the due date on each row");
    await page.waitForSelector(`${CARD}[data-page-card]`, { timeout: 15_000 });
    const looked = { card: true, quickAsk: (await page.$('[data-testid="quick-ask"]')) !== null, routedBy: await page.evaluate(() => window.__pageAsked.filter((one) => one.slot === "fast" && one.keys.includes("about")).at(-1)?.state ?? null) };
    report.checks.lookWordsTypedInTheMenuGoToMakeBetterAndRecordWordsToTheQuickAsk = {
      recordsWent,
      looked,
      ok: recordsWent.quickAsk && !recordsWent.card && looked.card && !looked.quickAsk && looked.routedBy?.typed === "show the due date on each row",
    };

    reach("aSpecDraftShowsKeepLandsOneChangeAndUndoTakesItBack");
    await settled(page, "spec");
    const drafted = await rows(page);
    const draftLine = await page.textContent('[data-testid="section-draft-line"]');
    const steps = await page.$$eval('[data-testid="section-steps"] li', (all) => all.map((one) => one.textContent));
    const asked = await page.evaluate(() => window.__pageAsked.filter((one) => one.slot !== "fast" && one.now !== undefined).map((one) => one.slot));
    const during = await page.evaluate(() => ({ drafts: window.__changes.drafts, applied: window.__changes.applied }));
    await shot(page, "spec-draft");
    await page.click('[data-testid="section-keep"]');
    await settled(page, "kept");
    const kept = await page.evaluate(() => ({ applied: window.__changes.applied, row: window.__changes.document().views?.task?.row ?? null }));
    const keptRows = await rows(page);
    const said = await page.textContent('[data-testid="section-status"]');
    await page.click('[data-testid="section-undo"]');
    await settled(page, "undone");
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => ({ undone: window.__changes.undone, row: window.__changes.document().views?.task?.row ?? null }));
    const backRows = await rows(page);
    report.checks.aSpecDraftShowsKeepLandsOneChangeAndUndoTakesItBack = {
      rowsBefore,
      drafted,
      draftLine,
      steps,
      asked,
      during,
      kept,
      keptRows,
      said,
      back,
      backRows,
      ok:
        asked.join() === "light" &&
        during.drafts === 1 &&
        during.applied === 0 &&
        /Draft — shown on this page, not kept/.test(draftLine ?? "") &&
        drafted.join("|") !== rowsBefore.join("|") &&
        kept.applied === 1 &&
        Array.isArray(kept.row) &&
        keptRows.join("|") === drafted.join("|") &&
        /^Kept\./.test(said ?? "") &&
        back.undone === 1 &&
        back.row === null &&
        backRows.join("|") === rowsBefore.join("|"),
    };
    await page.keyboard.press("Escape");
    await page.waitForSelector(CARD, { state: "detached" }).catch(() => {});
  }

  reach("whatTheSpecCannotSayIsOfferedAsItsOwnViewKeptAsThePagesView");
  {
    await menuOn(page, "[data-graview-record] a, [data-graview-listed] a");
    await page.click(`${MENU} [data-menu-item="section-describe"]`);
    await settled(page, "asking");
    await page.keyboard.type("make the cards bigger and side by side");
    await page.keyboard.press("Enter");
    await settled(page, "own");
    const question = await page.textContent('[data-testid="section-own-view"]');
    await shot(page, "own-view-question");
    await page.click('[data-testid="section-own-yes"]');
    await settled(page, "view");
    const drafted = await page.evaluate(() => ({
      region: document.querySelector('[data-worker-view="task-list"]') !== null,
      cards: document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelectorAll(".pb-card").length ?? 0,
      listed: window.__keeper.forked().map((one) => ({ name: one.manifest.name, draft: one.draft === true })),
    }));
    const draftLine = await page.textContent('[data-testid="section-draft-line"]');
    await shot(page, "own-view-draft");
    await page.click('[data-testid="section-keep"]');
    await settled(page, "kept");
    await page.waitForTimeout(300);
    const kept = await page.evaluate(() => ({
      listed: window.__keeper.forked().map((one) => ({ name: one.manifest.name, draft: one.draft === true, replaces: one.manifest.replaces, attach: one.manifest.attach, cardinality: one.manifest.cardinality })),
      region: document.querySelector('[data-testid="list-view"] [data-worker-view="task-list"]') !== null,
      alsoAs: document.querySelector('[data-testid="built-in-list"]')?.textContent ?? null,
    }));
    await shot(page, "own-view-kept");
    await page.click('[data-testid="built-in-list"]');
    await page.waitForFunction(() => location.search.includes("drawn=built-in"), null, { timeout: 10_000 });
    await page.waitForTimeout(300);
    const builtIn = { rows: (await rows(page)).length, view: await page.evaluate(() => document.querySelector('[data-worker-view="task-list"]') !== null) };
    report.checks.whatTheSpecCannotSayIsOfferedAsItsOwnViewKeptAsThePagesView = {
      question,
      drafted,
      draftLine,
      kept,
      builtIn,
      ok:
        /That needs its own view\. Make “Tasks” its own view and change it\?/.test(question ?? "") &&
        drafted.region &&
        drafted.cards === 3 &&
        drafted.listed.some((one) => one.name === "task-list" && one.draft) &&
        kept.listed.length === 1 &&
        kept.listed[0].name === "task-list" &&
        !kept.listed[0].draft &&
        kept.listed[0].replaces === "page" &&
        kept.listed[0].cardinality === "many" &&
        kept.region &&
        kept.alsoAs === "Built-in list" &&
        builtIn.rows === 3 &&
        !builtIn.view,
    };
  }

  reach("aSeatThatMayNotChangeTheAppIsNotOffered");
  {
    const visitor = await context.newPage();
    visitor.on("pageerror", (error) => errors.push(error.message));
    await ready(visitor, "/tasks", "?visitor=1");
    await menuOn(visitor, "[data-graview-page-title]");
    const seen = await offered(visitor);
    report.checks.aSeatThatMayNotChangeTheAppIsNotOffered = { ...seen, ok: seen.heading === null && seen.rows.length === 0 && !seen.outlined };
    await visitor.close();
  }

  reach.done();
  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  reach.done();
  if (!report.checks[reach.at()]) report.checks[reach.at()] = { ok: false, stopped: String(error) };
  report.stoppedAt = reach.at();
  report.pageErrors = errors;
  report.console = consoled;
  report.drawn = await page?.evaluate(() => document.querySelector("#app")?.innerText?.slice(0, 1500) ?? null).catch(() => null);
  if (page && SHOTS) await page.screenshot({ path: join(SHOTS, `${ENGINE}-stopped.png`) }).catch(() => {});
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  host?.stop();
}

writeFileSync(resolve(repoRoot, "docs/page-better.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/page-better.json\n`);
process.exit(report.passed ? 0 : 1);
