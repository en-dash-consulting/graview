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
 *   theFieldIsFirstAndFocused
 *   theTwoWaysAreButtonsWithNamesUnderTheField
 *   suggestedFillsWithoutMovingTheMenusTop
 *   suggestedSaysWhatTheRowsDoNot
 *   moreRevealsTheRest
 *   theMenuOffersBetterUiOnTheHeadingATasksPageAndHome
 *   theLitWayFollowsTheFastSlotOnTypedWords
 *   aSettingsDraftIsShownUncoveredKeptAsOneChangeAndUndone
 *   aBrokenDraftIsNeverShown
 *   aDraftThatDropsWhatEachRecordSaidIsNeverShown
 *   aDraftThatMovesARecordToAnotherGroupIsNeverShown
 *   aNewDesignIsRepairedUnderCoverThenGivenThePage
 *   beforeAndAfterToggleTheOriginalInPlace
 *   iteratingMakesASecondStepAndStepBackRestoresTheFirst
 *   keepMakesItThePageAndOneUndoTakesItAway
 *   aBetterUiSuggestionOpensItsCardWithADraft
 *   onAPhoneTheSameLayoutFitsAsASheet
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
 * "look", "cards", "smaller") are the look's, others the records'; "bigger"
 * and "side by side" need drawing the settings have no word for; Suggested
 * picks the last candidate first and tags "Show …"/"Sort …"/"Make …" as the
 * look's — after a beat, as a real model would. The light slot drafts the
 * row's settings with the due date in it, and writes the page as a new
 * design of cards as `window.__viewScenario` says: "good" (each card says
 * its status and its date in words, under the heading it was under),
 * "broken-first" (the first try loses a record, the repair keeps it),
 * "always-broken", "always-titles" (the cards say only their names) or
 * "always-regroup" (a record moved under another group's heading).
 */
const FAKE_AI = () => {
  const asked = (window.__pageAsked = []);
  window.__viewScenario = "good";
  const choice = (choice, chance = 0.92) => ({ type: "choice", choice, confidence: chance, probabilities: { [choice]: chance } });
  const decide = async (state, questions) => {
    asked.push({ slot: "fast", state, keys: Object.keys(questions) });
    const answers = {};
    if (questions.pick) await new Promise((done) => setTimeout(done, 600));
    for (const [key, question] of Object.entries(questions)) {
      const words = String(state.typed ?? state.asked ?? "");
      if (key === "about") answers[key] = choice(/look|bigger|smaller|show|cards|rows|nicer/.test(words) ? "look" : "records");
      else if (key === "can") answers[key] = choice(/bigger|side by side|colou?r|smaller/.test(words) ? "drawing" : "spec");
      else if (key === "pick") {
        const keys = Object.keys(question.criteria);
        answers[key] = { type: "choice", choice: keys.at(-1), confidence: 0.6, probabilities: Object.fromEntries(keys.map((one, at) => [one, (at + 1) / keys.length])) };
      } else if (key.startsWith("about_")) answers[key] = choice(/^(Show|Sort|Make)\b/.test(String(question.instructions).replace(/^Is “/, "")) ? "look" : "records");
      else answers[key] = choice(Object.keys(question.criteria ?? { none: 1 }).at(-1));
    }
    return { answers, usage: { inputTokens: 10, outputTokens: 2 } };
  };
  const view = ({ lose, small, titles, regroup, says }) => {
    // The heading each record sat under, as the page said it; one moved to the first group's where a regroup is asked of the fake.
    const under = Object.fromEntries(Object.entries(says ?? {}).flatMap(([label, one]) => (one.under ? [[label, one.under]] : [])));
    const groups = [...new Set(Object.values(under))];
    if (regroup && groups.length > 1) for (const label of Object.keys(under)) if (under[label] !== groups[0]) { under[label] = groups[0]; break; }
    return [
      `graview.style(\`.pg { display: grid; gap: 12px; } .pb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; } .pb-card { display: grid; gap: 4px; padding: 16px; font-size: ${small ? "0.875rem" : "1.375rem"}; border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); background: var(--graview-panel); } .pb-meta { font-size: 0.8125rem; color: var(--graview-ink-muted); }\`);`,
      `const UNDER = ${JSON.stringify(under)};`,
      `const GROUPS = ${JSON.stringify(groups)};`,
      "graview.onProps((props) => {",
      `  const tasks = props.nodes.filter((node) => node.kind === 'task')${lose ? ".slice(1)" : ""};`,
      "  const day = (iso) => (iso ? new Date(`${iso}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');",
      "  const status = (task) => props.choices?.task?.status?.[task.status] ?? '';",
      titles
        ? "  const card = (task) => graview.html`<a class=\"pb-card\" data-key=\"${task.id}\" data-record=\"${task.id}\"><span>${task.label}</span></a>`;"
        : "  const card = (task) => graview.html`<a class=\"pb-card\" data-key=\"${task.id}\" data-record=\"${task.id}\"><span>${task.label}</span><span class=\"pb-meta\">${status(task)}</span><span class=\"pb-meta\">${day(task.due)}</span></a>`;",
      "  const grid = (list) => graview.html`<div class=\"pb-grid\">${list.map(card)}</div>`;",
      "  graview.render(GROUPS.length > 0",
      "    ? graview.html`<div class=\"pg\">${GROUPS.map((heading, at) => graview.html`<section aria-labelledby=\"pb-g${at}\"><h2 id=\"pb-g${at}\">${heading}</h2>${grid(tasks.filter((task) => UNDER[task.label] === heading))}</section>`)}</div>`",
      "    : graview.html`<div class=\"pg\">${grid(tasks)}</div>`);",
      "});",
    ].join("\n");
  };
  const think = (slot) => async ({ prompt }) => {
    let parsed;
    try {
      parsed = JSON.parse(prompt);
    } catch {
      return { text: "I can only answer about this page." };
    }
    asked.push({ slot, ...parsed });
    if (parsed.now !== undefined) return { text: JSON.stringify({ edits: [{ op: "set-view", kind: "task", slot: "row", blocks: [{ title: "{label}" }, { badge: "{status}" }, { field: "due", as: "date", label: "Due" }] }], said: "Each row looks modern and friendly now." }) };
    if (parsed.as_it_stands !== undefined) {
      const scenario = window.__viewScenario;
      const repairing = Array.isArray(parsed.what_broke);
      const lose = scenario === "always-broken" || (scenario === "broken-first" && !repairing);
      const says = parsed.each_record_still_shows_this_and_stays_under_its_heading;
      return { text: JSON.stringify({ source: view({ lose, small: Boolean(parsed.your_view_so_far), titles: scenario === "always-titles", regroup: scenario === "always-regroup", says }), said: "Clean cards, a friendly intro, looks modern." }) };
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
        // ?grouped=1: the tasks open grouped by their status, as a person may have kept them.
        const grouped = new URLSearchParams(location.search).get("grouped") === "1" ? composeAppChange({ document: tasks, edits: [{ op: "arrange-pages", group: { task: "status" } }] }) : null;
        if (grouped && !grouped.ok) throw new Error(grouped.refused);
        let current = { app: grouped ? grouped.app : compiled.app, document: grouped ? grouped.document : tasks, store: storeOver(grouped ? grouped.app : compiled.app, ${JSON.stringify(SEED)}) };
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
const BAR = '[data-better-bar]';
const MAIN = "[data-graview-page-main]";
const ROW = "[data-graview-record] a, [data-graview-listed] a";
/* Words no person should read on the card or the bar. */
const JARGON = /own view|\bhost\b|stylesheet|\bspec\b|also as|worker|\bcss\b|manifest/i;

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

/** What the menu shows, top to bottom: its title, the field and where the keyboard is, the two ways and which is lit, Suggested, the acts, More…. */
const menuSays = (page) =>
  page.evaluate(() => {
    const menu = document.querySelector('[data-testid="context-menu"]');
    const field = menu?.querySelector('[data-testid="menu-type"]');
    const order = [...(menu?.querySelectorAll('[data-testid="menu-type"], [data-testid="menu-modes"], [data-menu-section="suggested"], [data-testid="affordances"], [data-menu-item="more"]') ?? [])].map((one) => one.getAttribute("data-testid") ?? one.getAttribute("data-menu-section") ?? one.getAttribute("data-menu-item"));
    const modes = [...(menu?.querySelectorAll("[data-menu-mode]") ?? [])].map((one) => ({ mode: one.getAttribute("data-menu-mode"), name: one.getAttribute("aria-label"), pressed: one.getAttribute("aria-pressed"), tag: one.tagName }));
    const suggested = [...(menu?.querySelectorAll('[data-menu-section="suggested"] [data-menu-item]') ?? [])].map((one) => ({ text: one.textContent.trim(), mode: one.getAttribute("data-suggested-mode") }));
    const box = menu?.getBoundingClientRect();
    return {
      title: menu?.querySelector("strong")?.textContent ?? null,
      placeholder: field?.getAttribute("placeholder") ?? null,
      focused: document.activeElement === field,
      order,
      modes,
      suggested,
      acts: [...(menu?.querySelectorAll("[data-affordance]:not([disabled])") ?? [])].filter((one) => !one.closest("[hidden]")).map((one) => one.textContent.trim()),
      more: Boolean(menu?.querySelector('[data-menu-item="more"]')),
      rest: [...(menu?.querySelectorAll("[data-menu-item]") ?? [])].filter((one) => !one.closest("[hidden]")).map((one) => one.getAttribute("data-menu-item")),
      heading: menu?.querySelector('[data-menu-section="make-better"]')?.textContent ?? null,
      box: box ? { top: Math.round(box.top), left: Math.round(box.left), right: Math.round(box.right), bottom: Math.round(box.bottom), width: Math.round(box.width) } : null,
    };
  });
const offersBetter = (seen) => seen.modes.some((one) => one.mode === "better" && one.tag === "BUTTON" && one.name === "Better UI") && seen.modes.some((one) => one.mode === "chat" && one.name === "Chat");
const settled = (page, phase) => page.waitForSelector(`${CARD}[data-section-phase="${phase}"]`, { timeout: 30_000 });

/** Types words into the menu's field, waits for the Fast slot, and says which way is lit. */
async function typeInMenu(page, words) {
  await page.focus(`${MENU} [data-testid="menu-type"]`);
  await page.keyboard.type(words, { delay: 15 });
  await page.waitForTimeout(700);
  return page.evaluate(() => document.querySelector('[data-menu-mode][aria-pressed="true"]')?.getAttribute("data-menu-mode") ?? null);
}

/** The rows the list page draws now, by their words. */
const rows = (page) => page.$$eval(`${MAIN} [data-graview-record], ${MAIN} [data-graview-listed]`, (all) => all.map((one) => one.textContent.replace(/\s+/g, " ").trim()));
/** Every word the card or the bar shows a person now. */
const cardWords = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="section-card"], [data-testid="redesigning"]')].map((one) => one.innerText).join(" | "));
/** Whether the bar stands clear of the part it changed: their boxes in the window do not meet. */
const barClear = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector("[data-better-bar]")?.getBoundingClientRect();
    const part = (document.querySelector('[data-testid="list-view"]') ?? document.querySelector('[data-testid="records"]') ?? document.querySelector("[data-graview-page-main]"))?.getBoundingClientRect();
    if (!bar || !part) return { bar: Boolean(bar), part: Boolean(part), clear: false };
    const meet = bar.left < part.right && bar.right > part.left && bar.top < part.bottom && bar.bottom > part.top;
    return { bar: { top: Math.round(bar.top), bottom: Math.round(bar.bottom) }, part: { top: Math.round(part.top), bottom: Math.round(part.bottom) }, clear: !meet, inWindow: bar.bottom <= innerHeight && bar.left >= 0 && bar.right <= document.documentElement.clientWidth };
  });

/**
 * Watches, every frame, for a draft seen uncovered before it passed: a new
 * design's drawing on the page while no cover hides it and the bar does
 * not yet offer it. Read back with `seenBroken`.
 */
const watchUncovered = (page) =>
  page.evaluate(() => {
    window.__uncovered = [];
    const look = () => {
      const region = document.querySelector('[data-worker-view="task-list"]');
      const covered = document.querySelector("[data-graview-redesigning]");
      const offered = document.querySelector('[data-better-bar][data-section-phase="view"]');
      if (region && !covered && !offered && region.getBoundingClientRect().height > 0) window.__uncovered.push(Date.now());
      window.__watching = requestAnimationFrame(look);
    };
    look();
  });
const seenBroken = (page) => page.evaluate(() => (cancelAnimationFrame(window.__watching), window.__uncovered.length));

try {
  host = await serveHost();
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(FAKE_AI);
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && consoled.push(message.text().slice(0, 300)));
  await ready(page, "/tasks");

  reach("theFieldIsFirstAndFocused");
  {
    await menuOn(page, ROW);
    const seen = await menuSays(page);
    await shot(page, "menu-on-a-row");
    report.checks.theFieldIsFirstAndFocused = { ...seen, ok: seen.order[0] === "menu-type" && seen.placeholder === "Tell Graview what you want…" && seen.focused && seen.heading === null };
  }

  reach("theTwoWaysAreButtonsWithNamesUnderTheField");
  {
    const seen = await menuSays(page);
    report.checks.theTwoWaysAreButtonsWithNamesUnderTheField = { modes: seen.modes, order: seen.order, ok: offersBetter(seen) && seen.order[1] === "menu-modes" && seen.modes.some((one) => one.pressed === "true") };
  }

  reach("suggestedFillsWithoutMovingTheMenusTop");
  {
    await page.keyboard.press("Escape");
    await page.waitForSelector(MENU, { state: "detached" }).catch(() => {});
    const box = await page.locator(`${MAIN} ${ROW}`).first().boundingBox();
    await page.mouse.click(Math.round(box.x + 12), Math.round(box.y + box.height / 2), { button: "right" });
    await page.waitForSelector(MENU, { timeout: 10_000 });
    const first = await menuSays(page);
    await page.waitForFunction(() => window.__pageAsked.some((one) => one.slot === "fast" && one.keys.includes("pick")), null, { timeout: 10_000 });
    await page.waitForTimeout(900);
    const later = await menuSays(page);
    await shot(page, "menu-suggested");
    report.checks.suggestedFillsWithoutMovingTheMenusTop = {
      first: { box: first.box, suggested: first.suggested },
      later: { box: later.box, suggested: later.suggested },
      ok:
        later.suggested.length >= 2 &&
        later.suggested.length <= 3 &&
        later.suggested.every((one) => one.mode === "chat" || one.mode === "better") &&
        later.suggested.some((one) => one.mode === "better") &&
        first.box?.top === later.box?.top &&
        first.box?.left === later.box?.left &&
        later.suggested.every((one) => !/last time/i.test(one.text)),
    };
  }

  reach("suggestedSaysWhatTheRowsDoNot");
  {
    // Every row the menu has, folded or not, and anything drawn between Suggested and the acts.
    const seen = await page.evaluate(() => {
      const menu = document.querySelector('[data-testid="context-menu"]');
      const fold = (text) => text.replace(/[✦💬✨]|\((Chat|Better UI)\)/gu, "").replace(/\s*…\s*$/u, "").replace(/\s+/g, " ").trim().toLowerCase();
      const rows = [...(menu?.querySelectorAll("[data-affordance]") ?? [])].map((one) => fold(one.textContent ?? ""));
      const suggested = [...(menu?.querySelectorAll('[data-menu-section="suggested"] [data-menu-item]') ?? [])].map((one) => fold(one.textContent ?? ""));
      const section = menu?.querySelector('[data-menu-section="suggested"]');
      const acts = menu?.querySelector('[data-testid="affordances"]');
      const between = [];
      for (let one = section?.nextElementSibling; one && one !== acts; one = one.nextElementSibling) if (one.getClientRects().length > 0 && (one.textContent ?? "").trim()) between.push((one.textContent ?? "").trim());
      return { rows, suggested, between, observationsShown: [...(menu?.querySelectorAll('[data-testid="observations"]') ?? [])].some((one) => one.getClientRects().length > 0) };
    });
    report.checks.suggestedSaysWhatTheRowsDoNot = {
      ...seen,
      ok: seen.suggested.length >= 2 && seen.suggested.every((one) => !seen.rows.includes(one)) && seen.suggested.some((one) => / to /.test(one) || /^(show|sort|make)\b/.test(one)) && seen.between.length === 0 && !seen.observationsShown,
    };
  }

  reach("moreRevealsTheRest");
  {
    const before = await menuSays(page);
    await page.click(`${MENU} [data-menu-item="more"]`);
    await page.waitForTimeout(200);
    const after = await menuSays(page);
    const rest = await page.evaluate(() => [...document.querySelectorAll('[data-testid="context-menu"] [data-menu-item]')].filter((one) => !one.closest("[hidden]")).map((one) => one.getAttribute("data-menu-item")));
    const restBefore = before.rest;
    report.checks.moreRevealsTheRest = { actsBefore: before.acts, actsAfter: after.acts, restBefore, rest, ok: before.more && before.acts.length <= 4 && !restBefore.includes("copy-link") && !after.more && after.acts.length > before.acts.length && rest.includes("copy-link") };
    await page.keyboard.press("Escape");
  }

  reach("theMenuOffersBetterUiOnTheHeadingATasksPageAndHome");
  {
    await menuOn(page, "[data-graview-page-title]");
    const heading = await menuSays(page);
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__handle.setPath("/tasks/t1"));
    await page.waitForFunction(() => document.querySelector("[data-graview-page-main] [data-graview-page-title]")?.textContent?.includes("Write the brief"), null, { timeout: 15_000 });
    await menuOn(page, "[data-graview-page-title]");
    const record = await menuSays(page);
    await shot(page, "menu-on-a-task");
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__handle.setPath("/"));
    await page.waitForFunction(() => location.pathname.replace(/\/$/, "") === "/better", null, { timeout: 15_000 });
    await page.waitForTimeout(300);
    const box = await page.locator(MAIN).first().boundingBox();
    await page.mouse.click(Math.round(box.x + 24), Math.round(box.y + 24), { button: "right" });
    await page.waitForSelector(MENU, { timeout: 10_000 });
    const home = await menuSays(page);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await settled(page, "choose");
    const card = await page.evaluate(() => document.querySelector('[data-testid="section-card"]')?.innerText ?? "");
    await page.keyboard.press("Escape");
    report.checks.theMenuOffersBetterUiOnTheHeadingATasksPageAndHome = {
      heading: heading.modes,
      record: record.modes,
      home: home.modes,
      card,
      ok: offersBetter(heading) && offersBetter(record) && offersBetter(home) && /Change how “Home” looks/.test(card) && /Just do it/.test(card) && /Describe changes/.test(card) && /Highlight area/.test(card),
    };
  }

  reach("theLitWayFollowsTheFastSlotOnTypedWords");
  {
    await page.evaluate(() => window.__handle.setPath("/tasks"));
    await page.waitForFunction(() => document.querySelector("[data-graview-page-main] [data-graview-page-title]")?.textContent?.trim() === "Tasks", null, { timeout: 15_000 });
    await menuOn(page, ROW);
    const recordsLit = await typeInMenu(page, "close these");
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid="quick-ask"]', { timeout: 15_000 });
    const recordsWent = { quickAsk: true, card: (await page.$(CARD)) !== null };
    await page.click('[data-testid="quick-ask-close"]').catch(() => page.keyboard.press("Escape"));
    await page.waitForSelector('[data-testid="quick-ask"]', { state: "detached", timeout: 5_000 }).catch(() => {});
    await menuOn(page, ROW);
    const lookLit = await typeInMenu(page, "show the due date on each row");
    await shot(page, "menu-better-lit");
    report.checks.theLitWayFollowsTheFastSlotOnTypedWords = { recordsLit, lookLit, recordsWent, ok: recordsLit === "chat" && lookLit === "better" && recordsWent.quickAsk && !recordsWent.card };
  }

  reach("aSettingsDraftIsShownUncoveredKeptAsOneChangeAndUndone");
  {
    const rowsBefore = await rows(page);
    await page.keyboard.press("Enter");
    await page.waitForSelector(`${CARD}[data-page-card], ${BAR}`, { timeout: 15_000 });
    await settled(page, "spec");
    const drafted = await rows(page);
    const said = await page.textContent('[data-testid="section-status"]');
    const clear = await barClear(page);
    const words = await cardWords(page);
    const during = await page.evaluate(() => ({ drafts: window.__changes.drafts, applied: window.__changes.applied }));
    await shot(page, "settings-draft");
    await page.click('[data-testid="section-keep"]');
    await settled(page, "kept");
    const kept = await page.evaluate(() => ({ applied: window.__changes.applied, row: window.__changes.document().views?.task?.row ?? null }));
    await page.click('[data-testid="section-undo"]');
    await settled(page, "undone");
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => ({ undone: window.__changes.undone, row: window.__changes.document().views?.task?.row ?? null }));
    const backRows = await rows(page);
    report.checks.aSettingsDraftIsShownUncoveredKeptAsOneChangeAndUndone = {
      said,
      clear,
      during,
      kept,
      back,
      ok: during.drafts >= 1 && during.applied === 0 && drafted.join("|") !== rowsBefore.join("|") && !/modern and friendly/.test(said ?? "") && clear.clear && kept.applied === 1 && Array.isArray(kept.row) && back.undone === 1 && back.row === null && backRows.join("|") === rowsBefore.join("|") && !JARGON.test(words),
    };
    await page.click('[data-testid="section-close"]').catch(() => page.keyboard.press("Escape"));
  }

  reach("aBrokenDraftIsNeverShown");
  {
    await page.evaluate(() => (window.__viewScenario = "always-broken"));
    await menuOn(page, ROW);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await settled(page, "choose");
    await page.click('[data-testid="section-describe"]');
    await settled(page, "asking");
    await page.keyboard.type("make the cards bigger and side by side");
    await page.keyboard.press("Enter");
    await settled(page, "design");
    const question = await page.textContent('[data-testid="section-own-view"]');
    await watchUncovered(page);
    await page.click('[data-testid="section-own-yes"]');
    await settled(page, "refused");
    const uncovered = await seenBroken(page);
    const refused = await page.textContent('[data-testid="section-status"]');
    const left = await page.evaluate(() => ({ region: document.querySelector('[data-worker-view="task-list"]') !== null, listed: window.__keeper.forked().length }));
    const tries = await page.evaluate(() => window.__pageAsked.filter((one) => one.as_it_stands !== undefined).map((one) => one.slot));
    const words = await cardWords(page);
    await shot(page, "broken-refused");
    report.checks.aBrokenDraftIsNeverShown = {
      question,
      uncovered,
      refused,
      left,
      tries,
      ok: uncovered === 0 && refused === "I couldn't make a version that looks right." && !left.region && left.listed === 0 && tries.join() === "light,light,thinking" && !JARGON.test(`${question} ${words}`) && (await page.$('[data-testid="section-iterate"]')) !== null,
    };
    await page.click('[data-testid="section-close"]');
  }

  /** Asks for a new design of the Tasks list in words, with the cards a fake scenario draws, and says what came of it. */
  const designedAs = async (on, scenario, words) => {
    await on.evaluate((scenario) => ((window.__viewScenario = scenario), (window.__pageAsked.length = 0)), scenario);
    await menuOn(on, ROW);
    await on.click(`${MENU} [data-menu-mode="better"]`);
    await on.waitForSelector(`${CARD}[data-section-phase="choose"]`, { timeout: 10_000 });
    await on.click('[data-testid="section-describe"]');
    await on.waitForSelector(`${CARD}[data-section-phase="asking"]`, { timeout: 10_000 });
    await on.keyboard.type(words);
    await on.keyboard.press("Enter");
    await on.waitForSelector(`${CARD}[data-section-phase="design"]`, { timeout: 30_000 });
    await watchUncovered(on);
    await on.click('[data-testid="section-own-yes"]');
    await on.waitForSelector(`${CARD}[data-section-phase="refused"], ${BAR}[data-section-phase="view"]`, { timeout: 60_000 });
    const uncovered = await seenBroken(on);
    const phase = await on.getAttribute(`${CARD}[data-section-phase]`, "data-section-phase").catch(() => null);
    const refused = await on.textContent('[data-testid="section-status"]').catch(() => null);
    const asked = await on.evaluate(() => window.__pageAsked.filter((one) => one.as_it_stands !== undefined).map((one) => ({ slot: one.slot, broke: one.what_broke ?? [], keep: one.each_record_still_shows_this_and_stays_under_its_heading ?? null })));
    const left = await on.evaluate(() => ({ region: document.querySelector('[data-worker-view="task-list"]') !== null, listed: window.__keeper.forked().length }));
    return { uncovered, phase, refused, tries: asked.map((one) => one.slot), broke: asked.flatMap((one) => one.broke), told: asked[0]?.keep ?? null, left };
  };

  reach("aDraftThatDropsWhatEachRecordSaidIsNeverShown");
  {
    const seen = await designedAs(page, "always-titles", "make the cards bigger and side by side");
    await shot(page, "lossy-refused");
    report.checks.aDraftThatDropsWhatEachRecordSaidIsNeverShown = {
      ...seen,
      ok:
        seen.uncovered === 0 &&
        seen.refused === "I couldn't make a version that looks right." &&
        !seen.left.region &&
        seen.left.listed === 0 &&
        seen.tries.join() === "light,light,thinking" &&
        seen.broke.some((one) => /“Todo” on “Write the brief”/.test(one) && /“Sep 3, 2026” on “Write the brief”/.test(one)) &&
        // The prompt told the model what each record said, before any draft.
        JSON.stringify(seen.told ?? {}).includes("Sep 3, 2026"),
    };
    await page.click('[data-testid="section-close"]');
    await page.evaluate(() => (window.__viewScenario = "good"));
  }

  reach("aDraftThatMovesARecordToAnotherGroupIsNeverShown");
  {
    const grouped = await context.newPage();
    grouped.on("pageerror", (error) => errors.push(`grouped: ${error.message}`));
    await ready(grouped, "/tasks", "?grouped=1");
    const headings = await grouped.evaluate(() => [...document.querySelectorAll("[data-graview-page-main] h2, [data-graview-page-main] h3")].map((one) => one.textContent.trim()));
    const moved = await designedAs(grouped, "always-regroup", "make the cards bigger and side by side");
    await shot(grouped, "regroup-refused");
    await grouped.click('[data-testid="section-close"]');
    // The same draft with every record where it was is shown: the check is about the move, not the groups.
    const kept = await designedAs(grouped, "good", "make the cards bigger and side by side");
    await shot(grouped, "grouped-design-draft");
    await grouped.click('[data-testid="section-discard"]').catch(() => {});
    report.checks.aDraftThatMovesARecordToAnotherGroupIsNeverShown = {
      headings,
      moved,
      kept: { phase: kept.phase, uncovered: kept.uncovered, broke: kept.broke },
      ok:
        moved.uncovered === 0 &&
        moved.refused === "I couldn't make a version that looks right." &&
        !moved.left.region &&
        moved.broke.some((one) => /is under “[^”]+”, and was under “[^”]+”/.test(one)) &&
        kept.uncovered === 0 &&
        kept.phase === "view",
    };
    await grouped.close();
  }

  reach("aNewDesignIsRepairedUnderCoverThenGivenThePage");
  {
    await page.evaluate(() => ((window.__viewScenario = "broken-first"), (window.__pageAsked.length = 0)));
    await menuOn(page, ROW);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await settled(page, "choose");
    await page.click('[data-testid="section-describe"]');
    await settled(page, "asking");
    await page.keyboard.type("make the cards bigger and side by side");
    await page.keyboard.press("Enter");
    await settled(page, "design");
    await watchUncovered(page);
    await page.click('[data-testid="section-own-yes"]');
    await page.waitForSelector('[data-testid="redesigning"]', { timeout: 10_000 });
    const cover = await page.textContent('[data-testid="redesigning"]');
    await shot(page, "redesigning");
    await settled(page, "view");
    const uncovered = await seenBroken(page);
    const said = await page.textContent('[data-testid="section-status"]');
    const clear = await barClear(page);
    const words = await cardWords(page);
    const drawn = await page.evaluate(() => document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelectorAll(".pb-card").length ?? 0);
    await shot(page, "design-draft");
    report.checks.aNewDesignIsRepairedUnderCoverThenGivenThePage = {
      cover,
      uncovered,
      said,
      clear,
      drawn,
      ok: /Graview is redesigning “Tasks”/.test(cover ?? "") && uncovered === 0 && drawn === 3 && /^Tasks now show/.test(said ?? "") && !/modern|friendly/.test(said ?? "") && clear.clear && clear.inWindow && !JARGON.test(words),
    };
  }

  reach("beforeAndAfterToggleTheOriginalInPlace");
  {
    await page.click('[data-testid="section-before"]');
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => ({ view: document.querySelector('[data-worker-view="task-list"]') !== null, rows: document.querySelectorAll("[data-graview-page-main] [data-graview-record], [data-graview-page-main] [data-graview-listed]").length, pressed: document.querySelector('[data-testid="section-before"]')?.getAttribute("aria-pressed") }));
    await shot(page, "before");
    await page.click('[data-testid="section-after"]');
    await page.waitForFunction(() => document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelector(".pb-card"), null, { timeout: 10_000 });
    const after = await page.evaluate(() => ({ view: document.querySelector('[data-worker-view="task-list"]') !== null, pressed: document.querySelector('[data-testid="section-after"]')?.getAttribute("aria-pressed") }));
    report.checks.beforeAndAfterToggleTheOriginalInPlace = { before, after, ok: !before.view && before.rows === 3 && before.pressed === "true" && after.view && after.pressed === "true" };
  }

  reach("iteratingMakesASecondStepAndStepBackRestoresTheFirst");
  {
    const size = () => page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('[data-worker-view="task-list"]').shadowRoot.querySelector(".pb-card")).fontSize));
    const first = await size();
    await page.fill('[data-testid="section-iterate"]', "make them smaller");
    await page.press('[data-testid="section-iterate"]', "Enter");
    await page.waitForFunction(() => document.querySelector('[data-testid="section-step"]')?.textContent === "Step 2 of 2", null, { timeout: 20_000 });
    await page.waitForTimeout(300);
    const second = await size();
    const said = await page.textContent('[data-testid="section-status"]');
    await shot(page, "second-step");
    await page.click('[data-testid="section-step-back"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="section-step"]'), null, { timeout: 10_000 });
    await page.waitForTimeout(400);
    const back = await size();
    report.checks.iteratingMakesASecondStepAndStepBackRestoresTheFirst = { first, second, back, said, ok: second < first && back === first };
  }

  reach("keepMakesItThePageAndOneUndoTakesItAway");
  {
    await page.click('[data-testid="section-keep"]');
    await settled(page, "kept");
    await page.waitForTimeout(300);
    const kept = await page.evaluate(() => ({ listed: window.__keeper.forked().map((one) => ({ name: one.manifest.name, draft: one.draft === true })), view: document.querySelector('[data-testid="list-view"] [data-worker-view="task-list"]') !== null, original: document.querySelector('[data-testid="built-in-list"]')?.textContent ?? null }));
    const words = await cardWords(page);
    await shot(page, "kept");
    await page.click('[data-testid="built-in-list"]');
    await page.waitForFunction(() => location.search.includes("drawn=built-in"), null, { timeout: 10_000 });
    await page.waitForTimeout(300);
    const original = { rows: (await rows(page)).length, view: await page.evaluate(() => document.querySelector('[data-worker-view="task-list"]') !== null) };
    await page.goBack();
    await page.waitForTimeout(300);
    await page.click('[data-testid="section-undo"]');
    await settled(page, "undone");
    await page.waitForTimeout(300);
    const undone = await page.evaluate(() => ({ listed: window.__keeper.forked().length, view: document.querySelector('[data-worker-view="task-list"]') !== null }));
    report.checks.keepMakesItThePageAndOneUndoTakesItAway = {
      kept,
      original,
      undone,
      ok: kept.listed.length === 1 && !kept.listed[0].draft && kept.view && kept.original === "Original" && original.rows === 3 && !original.view && undone.listed === 0 && !undone.view && !JARGON.test(words),
    };
    await page.click('[data-testid="section-close"]').catch(() => page.keyboard.press("Escape"));
  }

  reach("aBetterUiSuggestionOpensItsCardWithADraft");
  {
    await page.evaluate(() => (window.__viewScenario = "good"));
    await menuOn(page, ROW);
    await page.waitForFunction(() => document.querySelector('[data-menu-section="suggested"] [data-suggested-mode="better"]'), null, { timeout: 10_000 });
    const label = await page.textContent('[data-menu-section="suggested"] [data-suggested-mode="better"]');
    await page.click('[data-menu-section="suggested"] [data-suggested-mode="better"]');
    await page.waitForSelector(`${BAR}:is([data-section-phase="spec"],[data-section-phase="view"]), ${CARD}[data-section-phase="design"]`, { timeout: 30_000 });
    const phase = await page.getAttribute(CARD, "data-section-phase");
    if (phase === "design") {
      await page.click('[data-testid="section-own-yes"]');
      await page.waitForSelector(`${BAR}[data-section-phase="view"]`, { timeout: 30_000 });
    }
    const drafted = await page.getAttribute(CARD, "data-section-phase");
    await shot(page, "suggestion-draft");
    report.checks.aBetterUiSuggestionOpensItsCardWithADraft = { label, phase, drafted, ok: drafted === "spec" || drafted === "view" };
    await page.click('[data-testid="section-discard"]').catch(() => page.keyboard.press("Escape"));
    await page.waitForTimeout(300);
  }

  reach("onAPhoneTheSameLayoutFitsAsASheet");
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await phone.addInitScript(FAKE_AI);
    const on = await phone.newPage();
    on.on("pageerror", (error) => errors.push(`phone: ${error.message}`));
    await ready(on, "/tasks");
    await menuOn(on, ROW);
    const seen = await menuSays(on);
    await shot(on, "phone-menu");
    await on.click(`${MENU} [data-menu-mode="better"]`);
    await on.waitForSelector(`${CARD}[data-section-phase="choose"]`, { timeout: 10_000 });
    await on.click('[data-testid="section-describe"]');
    await on.waitForSelector(`${CARD}[data-section-phase="asking"]`);
    await on.fill('[data-testid="section-words"]', "make the cards bigger and side by side");
    await on.press('[data-testid="section-words"]', "Enter");
    await on.waitForSelector(`${CARD}[data-section-phase="design"]`, { timeout: 15_000 });
    await on.click('[data-testid="section-own-yes"]');
    await on.waitForSelector(`${BAR}[data-section-phase="view"]`, { timeout: 30_000 });
    const clear = await barClear(on);
    await shot(on, "phone-design-draft");
    await on.click('[data-testid="section-discard"]');
    report.checks.onAPhoneTheSameLayoutFitsAsASheet = {
      order: seen.order,
      box: seen.box,
      clear,
      ok: seen.order[0] === "menu-type" && seen.order[1] === "menu-modes" && offersBetter(seen) && seen.box !== null && seen.box.left >= 0 && seen.box.right <= 390 && clear.clear && clear.inWindow,
    };
    await phone.close();
  }

  reach("aSeatThatMayNotChangeTheAppIsNotOffered");
  {
    const visitor = await context.newPage();
    visitor.on("pageerror", (error) => errors.push(error.message));
    await ready(visitor, "/tasks", "?visitor=1");
    await menuOn(visitor, "[data-graview-page-title]");
    const seen = await menuSays(visitor);
    report.checks.aSeatThatMayNotChangeTheAppIsNotOffered = { modes: seen.modes, ok: !seen.modes.some((one) => one.mode === "better") && !(await visitor.$('[data-testid="section-outline"]')) };
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
