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
 * that drafts view-spec edits, and a full one that is Graview's agent: a
 * scripted conversation that looks at the page, drafts, is told what the
 * checks found, and drafts again (`window.__agentScenario`: "fix" drafts
 * names only first; `window.__agentDelay` slows each step).
 *
 * Claims (docs/page-better.json):
 *   theFieldIsFirstAndFocused
 *   theTwoWaysAreButtonsWithNamesUnderTheField
 *   suggestedFillsWithoutMovingTheMenusTop
 *   suggestedSaysWhatTheRowsDoNot
 *   moreRevealsTheRest
 *   theMenuOffersBetterUiOnTheHeadingATasksPageAndHome
 *   theLitWayFollowsTheFastSlotOnTypedWords
 *   aSettingsDraftLandsInSecondsWithoutTheAgentKeptAndUndone
 *   thePanelOpensBesideThePartAndItsStepsShowAsItWorks
 *   theAgentsWordsShowAsTheModelWritesThem
 *   aCheckFindingIsFedBackAndTheNextDraftFixesIt
 *   stopPutsThePageBackAtOnce
 *   keepMakesItThePageAndOneUndoTakesItAway
 *   aFollowUpTurnRevisesTheKeptDesign
 *   aBetterUiSuggestionOpensThePanelWithADraft
 *   onAPhoneThePanelIsASheetBelowThePage
 *   thePanelSpeaksPlainly
 *   thePanelIsPartOfThePageAtEveryWidthInLightAndDark
 *   thePersonsWordsStayAsTypedAndThePartIsNamedBesideThem
 *   aDraftWithACheckboxBoundToNothingIsNeverShown
 *   aKeptRedesignFinishesATaskAndUndoPutsItBack
 *   aPressThatDrawsNothingNewIsFedBackAndTheNextDraftShowsIt
 *   aPressThatChangesNothingWhereItStandsIsFedBackNamingTheActThatWould
 *   aFinishFromAKeptRedesignIsStillDoneAfterAReload
 *   whatAControlDoesIsSaidOnlyAsThePressCheckFoundIt
 *   itDoesntWorkMakesGraviewPressEveryControl
 *   theConversationsFirstMessageIsWhollyVisible
 *   aSeatThatMayNotChangeTheAppIsNotOffered
 *
 * Other ways to show this (Roadmap f-display-options-switch), with AI off:
 *   otherWaysOpensByTheKeyboardWithAiOff
 *   everyOptionIsDrawnAheadInRealDataUnderThePagesHeading
 *   flippingBetweenOptionsIsInstant
 *   nothingIsWrittenWhileFlipping
 *   asItIsNowPutsThePageBackAtOnce
 *   thePersonReadsPlainWordsAndOneFilledButton
 *   keepMakesItTheListWithItsHeadingItsFormAndItsWayToTheList
 *   oneUndoTakesAllOfItBack
 *   aChoiceRanksTheNextOffer
 *   aPlaceChangesWhatDrawsItAndKeepsItsAddress
 *   aHostsOptionJoinsAfterTheFirstDrawAndHearsTheChoice
 *   aReaderIsOfferedNoOtherWays
 *   onAPhoneTheSwitchFitsAndTheKeyboardStaysOnIt
 *   aListDrawnAsTheAppDrawsItIsOfferedNoOtherWays
 *
 * And on the todo example, whose product design (`thingsDesign`) replaces
 * its kinds' lists, with its development host (`__todoDevHost`,
 * apps/todo/src/dev-change.ts) lending the change to the app:
 *   aListADesignReplacesIsOfferedNoOtherWays
 *   aPlaceUnderADesignIsStillOfferedAndKeepsThroughTheDevHost
 *   aListNoDesignReplacesOpensAsItsOptionThroughTheDevHost
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const SHOTS = process.env.GRAVIEW_PAGE_BETTER_SHOTS;
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let browser;
let host;
let todo;
let page;
const consoled = [];
const errors = [];
const reach = deadline({
  verdict: resolve(repoRoot, "docs/page-better.json"),
  report,
  cleanup: async () => {
    await browser?.close();
    host?.stop();
    todo?.stop();
  },
});

/* The tasks, with a yes-or-no "done" and the acts that mark it — as the todo example finishes a task — written beside the harness's bundle. */
const TASKS = (() => {
  const document = JSON.parse(readFileSync(resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json"), "utf8"));
  document.kinds.task.fields.done = { type: "boolean", default: false };
  document.acts.finish = { title: "Mark it done", on: "task", description: "Say a task is done.", sets: { done: true } };
  document.acts.reopen = { title: "Open it again", on: "task", description: "Say a task is not done after all.", sets: { done: false } };
  const at = join(mkdtempSync(join(tmpdir(), "graview-page-better-tasks-")), "tasks.gdd.json");
  writeFileSync(at, JSON.stringify(document));
  return at;
})();
const BASE = "/better";
const SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo", due: "2026-09-03", done: false },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing", due: "2026-09-05", done: false },
    { id: "t3", kind: "task", label: "Print the flyers", status: "doing", done: false },
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
      else if (key === "can") answers[key] = choice(/bigger|side by side|colou?r|smaller|ugly|creative/.test(words) ? "drawing" : "spec");
      else if (key === "pick") {
        const keys = Object.keys(question.criteria);
        answers[key] = { type: "choice", choice: keys.at(-1), confidence: 0.6, probabilities: Object.fromEntries(keys.map((one, at) => [one, (at + 1) / keys.length])) };
      } else if (key.startsWith("about_")) answers[key] = choice(/^(Show|Sort|Make)\b/.test(String(question.instructions).replace(/^Is “/, "")) ? "look" : "records");
      else answers[key] = choice(Object.keys(question.criteria ?? { none: 1 }).at(-1));
    }
    return { answers, usage: { inputTokens: 10, outputTokens: 2 } };
  };
  const view = ({ lose, small, titles, regroup, says, checkbox, stale, alwaysFinish }) => {
    // The heading each record sat under, as the page said it; one moved to the first group's where a regroup is asked of the fake.
    const under = Object.fromEntries(Object.entries(says ?? {}).flatMap(([label, one]) => (one.under ? [[label, one.under]] : [])));
    const groups = [...new Set(Object.values(under))];
    if (regroup && groups.length > 1) for (const label of Object.keys(under)) if (under[label] !== groups[0]) { under[label] = groups[0]; break; }
    return [
      `graview.style(\`.pg { display: grid; gap: 12px; } .pb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; } .pb-card { display: grid; gap: 4px; padding: 16px; font-size: ${small ? "0.875rem" : "1.375rem"}; border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); background: var(--graview-panel); } .pb-meta { font-size: ${small ? "0.6875rem" : "0.8125rem"}; color: var(--graview-ink-muted); }\`);`,
      `const UNDER = ${JSON.stringify(under)};`,
      `const GROUPS = ${JSON.stringify(groups)};`,
      "graview.onProps((props) => {",
      `  const tasks = props.nodes.filter((node) => node.kind === 'task')${lose ? ".slice(1)" : ""};`,
      "  const day = (iso) => (iso ? new Date(`${iso}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');",
      "  const status = (task) => props.choices?.task?.status?.[task.status] ?? '';",
      titles
        ? "  const card = (task) => graview.html`<a class=\"pb-card\" data-key=\"${task.id}\" data-record=\"${task.id}\"><span>${task.label}</span></a>`;"
        : stale
          ? "  const card = (task) => graview.html`<div class=\"pb-card\" data-key=\"${task.id}\"><a data-record=\"${task.id}\">${task.label}</a><span class=\"pb-meta\">${status(task)}</span><span class=\"pb-meta\">${day(task.due)}</span><span class=\"pb-meta\">Done: no</span><button class=\"pb-done\" data-act=\"finish\" data-record=\"${task.id}\">Mark done</button></div>`;"
        : alwaysFinish
          ? "  const card = (task) => graview.html`<div class=\"pb-card\" data-key=\"${task.id}\"><a data-record=\"${task.id}\">${task.label}</a><span class=\"pb-meta\">${status(task)}</span><span class=\"pb-meta\">${day(task.due)}</span><span class=\"pb-meta\">Done: ${task.done ? \"yes\" : \"no\"}</span><button class=\"pb-done\" data-act=\"finish\" data-record=\"${task.id}\">Done</button></div>`;"
        : checkbox
          ? "  const card = (task) => graview.html`<div class=\"pb-card\" data-key=\"${task.id}\"><a data-record=\"${task.id}\">${task.label}</a><span class=\"pb-meta\">${status(task)}</span><span class=\"pb-meta\">${day(task.due)}</span><span class=\"pb-meta\">Done: ${task.done ? \"yes\" : \"no\"}</span><label><input type=\"checkbox\"> Done</label></div>`;"
          : "  const card = (task) => graview.html`<div class=\"pb-card\" data-key=\"${task.id}\"><a data-record=\"${task.id}\">${task.label}</a><span class=\"pb-meta\">${status(task)}</span><span class=\"pb-meta\">${day(task.due)}</span><span class=\"pb-meta\">Done: ${task.done ? \"yes\" : \"no\"}</span><button class=\"pb-done\" data-act=\"${task.done ? \"reopen\" : \"finish\"}\" data-record=\"${task.id}\">${task.done ? \"Open again\" : \"Done\"}</button></div>`;",
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
    if (parsed.your_steps !== undefined) {
      // GRAVIEW'S AGENT, scripted: it looks, drafts, reads what the checks found, drafts again, and says it is done.
      (window.__agentPrompts ??= []).push(parsed);
      await new Promise((done) => setTimeout(done, window.__agentDelay ?? 0));
      const steps = parsed.your_steps;
      const person = (parsed.conversation ?? []).flatMap((one) => (one.person ? [one.person] : []));
      const small = /smaller/.test(person.at(-1) ?? "");
      const says = Object.fromEntries((parsed.records ?? []).map((one) => [one.record, { shows: one.must_show, under: one.under }]));
      const drafts = steps.filter((one) => one.did === "draft");
      const last = steps.at(-1);
      const answer = (one) => ({ text: JSON.stringify(one) });
      const claims = window.__agentScenario === "checkbox" || window.__agentScenario === "claims";
      const said = small ? "The dates are smaller now." : claims ? "Each task card now has a checkbox so you can mark tasks complete, and it saves." : "Tasks are cards now, side by side, each with its status and date.";
      if (!last || last.did === "look") {
        const titles = window.__agentScenario === "fix" && drafts.length === 0;
        const checkbox = window.__agentScenario === "checkbox" && drafts.length === 0;
        const stale = window.__agentScenario === "stale" && drafts.length === 0;
        const alwaysFinish = window.__agentScenario === "always-finish" && drafts.length === 0;
        return answer({ say: said, do: "draft", source: view({ titles, says, small, checkbox, stale, alwaysFinish }) });
      }
      if (last.did === "draft" && (last.result?.findings ?? []).length > 0) return answer({ say: said, do: "draft", source: view({ says, small }) });
      if (last.did === "draft") return answer({ say: small ? "The dates are smaller now." : "Tasks are cards now, side by side, each with its status and date.", do: "done" });
      return answer({ say: "Done.", do: "done" });
    }
    if (parsed.now !== undefined) return { text: JSON.stringify({ edits: [{ op: "set-view", kind: "task", slot: "row", blocks: [{ title: "{label}" }, { badge: "{status}" }, { field: "due", as: "date", label: "Due" }] }], said: "Each row looks modern and friendly now." }) };
    if (parsed.as_it_stands !== undefined) {
      // As slow as the scenario says: the light slot by `__lightDelay`, the full one (Try harder) by `__thinkingDelay`.
      await new Promise((done) => setTimeout(done, (slot === "light" ? window.__lightDelay : window.__thinkingDelay) ?? 0));
      // The full model, asked only by Try harder, keeps the page; the scenarios break the light one.
      const scenario = slot === "light" ? window.__viewScenario : "good";
      const repairing = Array.isArray(parsed.what_broke);
      const lose = scenario === "always-broken" || (scenario === "broken-first" && !repairing);
      const says = Object.fromEntries((parsed.checklist ?? []).map((one) => [one.record, { shows: one.must_show, under: one.under }]));
      return { text: JSON.stringify({ source: view({ lose, small: Boolean(parsed.your_view_so_far), titles: scenario === "always-titles", regroup: scenario === "always-regroup", says }), said: "Clean cards, a friendly intro, looks modern." }) };
    }
    return { text: "{}" };
  };
  /* The design slot streams: the agent's answer told in four pieces, a beat apart, as a model writes it. */
  const design = think("design");
  const stream = async (request, onText) => {
    const reply = await design(request);
    const pieces = 4;
    const size = Math.ceil(reply.text.length / pieces);
    for (let at = 1; at <= pieces; at++) {
      await new Promise((done) => setTimeout(done, 250));
      onText(reply.text.slice(0, at * size));
    }
    return reply;
  };
  window.__pageAi = { name: "fake", fast: { model: "fake-fast", decide }, light: { model: "fake-light", think: think("light") }, thinking: { model: "fake-full", think: think("thinking") }, design: { model: "fake-design", think: design, stream } };
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
        const asked = new URLSearchParams(location.search);
        const seeded = ${JSON.stringify(SEED)};
        for (const id of (asked.get("done") ?? "").split(",").filter(Boolean)) seeded.nodes.find((one) => one.id === id).done = true;
        const remember = asked.get("remember") === "1";
        let saved = null;
        try { saved = remember ? JSON.parse(localStorage.getItem("pb-records") ?? "null") : null; } catch {}
        let current = { app: grouped ? grouped.app : compiled.app, document: grouped ? grouped.document : tasks, store: storeOver(grouped ? grouped.app : compiled.app, saved ?? seeded) };
        if (remember) current.store.subscribe(() => localStorage.setItem("pb-records", JSON.stringify(current.base.graph.snapshot())));
        current.base = current.store;
        // What is done in a store made over the page's records reaches the store under it, as Things' dev host does (apps/todo/src/dev-change.ts, forwardActs).
        const handDown = (over, under) => {
          const knows = new Set(under.allMutations().map((one) => one.name));
          over.subscribe((_diff, ops) => {
            const held = new Set(under.log.all().map((op) => op.id));
            const fits = ops.filter((op) => (op.mutation ? knows.has(op.mutation.name) : op.undoes !== undefined && held.has(op.undoes)));
            if (fits.length > 0) under.receive(fits);
          });
          return over;
        };
        window.__store = () => current.store;
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
            window.__handle.setApp(composed.app, handDown(storeOver(composed.app, current.store.graph.snapshot()), current.store));
            return { undo: () => window.__handle.setApp(current.app, current.store) };
          },
          onProposeChange: (proposal) => {
            const before = current;
            const composed = changed(proposal.edits ?? []);
            current = { app: composed.app, document: composed.document, base: before.base, store: handDown(storeOver(composed.app, before.store.graph.snapshot()), before.store) };
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
          ai: asked.get("noai") === "1" ? { off: true } : window.__pageAi,
          // ?offers=1: a host that hands in one more way to show the tasks, late, and hears what was kept.
          ...(asked.get("offers") === "1"
            ? {
                displayOptions: {
                  offers: () => new Promise((done) => setTimeout(() => done([{ id: "others-kept", label: "What others kept", weight: 1, lens: { lens: "columns", title: "Tasks others kept", bindings: { task: { column: "status" } } } }]), 300)),
                  onChoice: (heard) => (window.__heard ??= []).push(heard),
                },
              }
            : {}),
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

const PANEL = '[data-testid="better-panel"]';
/** Waits for the panel at a phase. */
const panelAt = (page, phase) => page.waitForSelector(`${PANEL}[data-better-phase="${phase}"]`, { timeout: 30_000 });
/** Every word the panel and the cover say. */
const panelWords = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="better-panel"], [data-testid="redesigning"]')].map((one) => one.innerText).join(" | "));
/** Whether the panel stands clear of the page it changes: beside it on a desk, a sheet below it on a phone with the page given room above it. */
const panelClear = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector('[data-testid="better-panel"]')?.getBoundingClientRect();
    const part = (document.querySelector('[data-worker-view="task-list"]') ?? document.querySelector('[data-testid="list-view"]') ?? document.querySelector('[data-testid="records"]') ?? document.querySelector("[data-graview-page-main]"))?.getBoundingClientRect();
    if (!panel || !part) return { panel: Boolean(panel), part: Boolean(part), clear: false };
    const meet = panel.left < part.right && panel.right > part.left && panel.top < part.bottom && panel.bottom > part.top;
    const width = document.documentElement.clientWidth;
    return {
      panel: { left: Math.round(panel.left), right: Math.round(panel.right), top: Math.round(panel.top), bottom: Math.round(panel.bottom) },
      part: { left: Math.round(part.left), right: Math.round(part.right) },
      clear: !meet,
      side: panel.right <= width && panel.left > part.right - 1,
      sheet: Math.round(panel.bottom) === innerHeight && Math.round(panel.width) === width,
      roomBelow: (parseFloat(document.body.style.paddingBottom) || 0) >= Math.round(panel.height),
    };
  });
/** Watches, every frame, for a design on the page that drops what each task said while nothing covers it: read back with `seenBroken`. */
const watchBroken = (page) =>
  page.evaluate(() => {
    window.__broken = 0;
    const look = () => {
      const cards = [...(document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelectorAll(".pb-card") ?? [])];
      const covered = document.querySelector("[data-graview-redesigning]");
      if (!covered && cards.length > 0 && cards.some((one) => !/Todo|Doing/.test(one.textContent ?? ""))) window.__broken += 1;
      window.__watching = requestAnimationFrame(look);
    };
    look();
  });
/** Watches, every frame, for a design on the page drawing a checkbox where nothing covers it: read back as `window.__boxes`. */
const watchCheckboxes = (page) =>
  page.evaluate(() => {
    window.__boxes = 0;
    const look = () => {
      const box = document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelector('input[type="checkbox"]');
      if (box && !document.querySelector("[data-graview-redesigning]")) window.__boxes += 1;
      window.__boxWatch = requestAnimationFrame(look);
    };
    look();
  });
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
const seenBroken = (page) => page.evaluate(() => (cancelAnimationFrame(window.__watching), window.__broken ?? window.__uncovered?.length ?? 0));

try {
  host = await serveHost();
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(FAKE_AI);
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && consoled.push(message.text().slice(0, 300)));
  await ready(page, "/tasks");

  /** Every word the panel said along the way, held to plain words at the end. */
  const panelSaid = [];

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
    // Inside the home's body, not only at its edge: a right-click in its middle offers it too.
    await page.keyboard.press("Escape");
    await page.waitForSelector(MENU, { state: "detached" }).catch(() => {});
    await page.mouse.click(Math.round(box.x + box.width / 2), Math.round(box.y + Math.min(box.height / 2, 220)), { button: "right" });
    await page.waitForSelector(MENU, { timeout: 10_000 });
    const homeBody = await menuSays(page);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await page.waitForSelector(PANEL, { timeout: 10_000 });
    const card = await page.evaluate(() => document.querySelector('[data-testid="better-panel"]')?.innerText ?? "");
    await page.keyboard.press("Escape");
    await page.waitForSelector(PANEL, { state: "detached", timeout: 5_000 }).catch(() => {});
    report.checks.theMenuOffersBetterUiOnTheHeadingATasksPageAndHome = {
      heading: heading.modes,
      record: record.modes,
      home: home.modes,
      homeBody: homeBody.modes,
      card,
      ok: offersBetter(heading) && offersBetter(record) && offersBetter(home) && offersBetter(homeBody) && /Change how “Home” looks/.test(card) && /Make it easier to read/.test(card) && /Point at a part/.test(card),
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

  reach("aSettingsDraftLandsInSecondsWithoutTheAgentKeptAndUndone");
  {
    const rowsBefore = await rows(page);
    const began = Date.now();
    await page.keyboard.press("Enter");
    await page.waitForSelector(PANEL, { timeout: 15_000 });
    await panelAt(page, "draft");
    const took = Date.now() - began;
    const drafted = await rows(page);
    const said = await page.textContent('[data-testid="better-changed"]');
    const clear = await panelClear(page);
    const agentAsked = await page.evaluate(() => (window.__agentPrompts ?? []).length);
    const during = await page.evaluate(() => ({ drafts: window.__changes.drafts, applied: window.__changes.applied }));
    await shot(page, "settings-draft");
    await page.click('[data-testid="better-keep"]');
    await panelAt(page, "kept");
    const kept = await page.evaluate(() => ({ applied: window.__changes.applied, row: window.__changes.document().views?.task?.row ?? null }));
    await page.click('[data-testid="better-undo"]');
    await panelAt(page, "undone");
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => ({ undone: window.__changes.undone, row: window.__changes.document().views?.task?.row ?? null }));
    const backRows = await rows(page);
    panelSaid.push(await panelWords(page));
    report.checks.aSettingsDraftLandsInSecondsWithoutTheAgentKeptAndUndone = {
      took,
      said,
      clear,
      agentAsked,
      during,
      kept,
      back,
      ok: took < 10_000 && agentAsked === 0 && during.drafts >= 1 && during.applied === 0 && drafted.join("|") !== rowsBefore.join("|") && !/modern and friendly/.test(said ?? "") && clear.clear && kept.applied === 1 && Array.isArray(kept.row) && back.undone === 1 && back.row === null && backRows.join("|") === rowsBefore.join("|"),
    };
    await page.click('[data-testid="better-close"]');
    await page.waitForSelector(PANEL, { state: "detached", timeout: 5_000 }).catch(() => {});
  }

  reach("thePanelOpensBesideThePartAndItsStepsShowAsItWorks");
  {
    await page.evaluate(() => ((window.__agentScenario = "fix"), (window.__agentDelay = 500), (window.__agentPrompts = [])));
    await menuOn(page, ROW);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await page.waitForSelector(PANEL, { timeout: 10_000 });
    const opened = await panelClear(page);
    await shot(page, "panel-open");
    await watchBroken(page);
    await page.fill('[data-testid="better-words"]', "make the tasks cards side by side");
    await page.click('[data-testid="better-send"]');
    // The steps as they come: read every 150 ms until a draft is offered.
    const seen = [];
    let mid = false;
    for (const until = Date.now() + 30_000; Date.now() < until; ) {
      const now = await page.evaluate(() => ({ phase: document.querySelector('[data-testid="better-panel"]')?.getAttribute("data-better-phase"), steps: [...document.querySelectorAll('[data-testid="better-step"]:not([data-step-kind="streaming"])')].map((one) => one.lastElementChild?.textContent?.trim() ?? ""), streaming: document.querySelector('[data-testid="better-step"][data-step-kind="streaming"]')?.lastElementChild?.textContent?.trim() ?? null, time: document.querySelector('[data-testid="better-time"]')?.textContent ?? null }));
      seen.push(now);
      if (!mid && now.steps.length >= 2) {
        await shot(page, "panel-working");
        mid = true;
      }
      if (now.phase === "draft") break;
      await page.waitForTimeout(150);
    }
    const final = seen.at(-1);
    const counted = [...new Set(seen.map((one) => one.steps.length))];
    report.checks.thePanelOpensBesideThePartAndItsStepsShowAsItWorks = {
      seen: seen.map(({ streaming }) => ({ streaming })),
      opened,
      steps: final?.steps ?? [],
      counted,
      times: [...new Set(seen.map((one) => one.time).filter(Boolean))].slice(0, 5),
      ok:
        opened.clear &&
        opened.side &&
        final?.phase === "draft" &&
        counted.length >= 3 &&
        final.steps.some((one) => /^Looking at Tasks/.test(one)) &&
        final.steps.filter((one) => /^Drafting/.test(one)).length === 2 &&
        final.steps.some((one) => /^Check: .* — fixing$/.test(one)) &&
        final.steps.some((one) => /^Check: nothing lost/.test(one)) &&
        seen.some((one) => /^0:0\d$/.test(one.time ?? "")),
    };
  }

  reach("theAgentsWordsShowAsTheModelWritesThem");
  {
    // What the panel showed of each answer while the model was still writing it: its sentence growing, then how far into the design it is.
    const streamed = [...new Set((report.checks.thePanelOpensBesideThePartAndItsStepsShowAsItWorks.seen ?? []).flatMap((one) => (one.streaming ? [one.streaming] : [])))];
    report.checks.theAgentsWordsShowAsTheModelWritesThem = {
      streamed,
      ok: streamed.length >= 2 && streamed.some((one) => /^Tasks are cards/.test(one)) && streamed.some((one) => /writing it, \d+ lines so far$/.test(one)) && !streamed.some((one) => /graview\.|\{|\}/.test(one)),
    };
  }

  reach("aCheckFindingIsFedBackAndTheNextDraftFixesIt");
  {
    const broken = await seenBroken(page);
    const prompts = await page.evaluate(() => window.__agentPrompts.map((one) => ({ steps: one.your_steps.map((step) => ({ did: step.did, findings: step.result?.findings ?? null })) })));
    const fedBack = prompts.flatMap((one) => one.steps).find((one) => one.did === "draft" && (one.findings ?? []).length > 0)?.findings ?? [];
    const cards = await page.evaluate(() => [...(document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelectorAll(".pb-card") ?? [])].map((one) => one.innerText.replace(/\s+/g, " ").trim()));
    const talk = await page.evaluate(() => [...document.querySelectorAll('[data-testid="better-message"]')].map((one) => `${one.getAttribute("data-who")}: ${one.textContent.trim()}`));
    const changed = await page.textContent('[data-testid="better-changed"]');
    await shot(page, "design-draft");
    panelSaid.push(await panelWords(page));
    report.checks.aCheckFindingIsFedBackAndTheNextDraftFixesIt = {
      broken,
      fedBack,
      cards,
      talk,
      changed,
      ok:
        broken === 0 &&
        fedBack.some((one) => /“Todo” on “Write the brief”/.test(one) && /“Sep 3, 2026” on “Write the brief”/.test(one)) &&
        cards.length === 3 &&
        cards.some((one) => /Write the brief/.test(one) && /Todo/.test(one) && /Sep 3, 2026/.test(one)) &&
        (talk.at(-1) ?? "").startsWith("graview: Tasks are cards now, side by side, each with its status and date.") &&
        /^Tasks now show/.test(changed ?? ""),
    };
  }

  reach("stopPutsThePageBackAtOnce");
  {
    await page.click('[data-testid="better-discard"]');
    await panelAt(page, "open");
    const rowsBefore = await rows(page);
    await page.evaluate(() => ((window.__agentScenario = "good"), (window.__agentDelay = 20_000)));
    await page.fill('[data-testid="better-words"]', "make the tasks cards side by side");
    await page.click('[data-testid="better-send"]');
    await page.waitForSelector('[data-testid="better-stop"]', { timeout: 10_000 });
    await page.waitForTimeout(800);
    const pressed = Date.now();
    await page.click('[data-testid="better-stop"]');
    await panelAt(page, "open");
    const back = Date.now() - pressed;
    await page.waitForTimeout(300);
    const left = await page.evaluate(() => ({ region: document.querySelector('[data-worker-view="task-list"]') !== null, cover: document.querySelector("[data-graview-redesigning]") !== null, said: [...document.querySelectorAll('[data-testid="better-message"]')].at(-1)?.textContent?.trim() ?? null }));
    const rowsAfter = await rows(page);
    report.checks.stopPutsThePageBackAtOnce = {
      back,
      left,
      ok: back < 1_000 && !left.region && !left.cover && left.said === "Stopped. The page is as it was." && rowsAfter.join("|") === rowsBefore.join("|"),
    };
  }

  reach("keepMakesItThePageAndOneUndoTakesItAway");
  {
    await page.evaluate(() => ((window.__agentDelay = 0), (window.__agentScenario = "good")));
    await page.fill('[data-testid="better-words"]', "make the tasks cards side by side");
    await page.click('[data-testid="better-send"]');
    await panelAt(page, "draft");
    await page.click('[data-testid="better-before"]');
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => ({ region: document.querySelector('[data-worker-view="task-list"]') !== null, pressed: document.querySelector('[data-testid="better-before"]')?.getAttribute("aria-pressed") }));
    await page.click('[data-testid="better-after"]');
    await page.waitForFunction(() => document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelector(".pb-card"), null, { timeout: 10_000 });
    await page.click('[data-testid="better-keep"]');
    await panelAt(page, "kept");
    await page.waitForTimeout(400);
    const kept = await page.evaluate(() => ({ listed: window.__keeper.forked().length, region: document.querySelector('[data-worker-view="task-list"]') !== null }));
    await shot(page, "kept");
    await page.click('[data-testid="better-undo"]');
    await panelAt(page, "undone");
    await page.waitForTimeout(400);
    const undone = await page.evaluate(() => ({ listed: window.__keeper.forked().length, region: document.querySelector('[data-worker-view="task-list"]') !== null }));
    report.checks.keepMakesItThePageAndOneUndoTakesItAway = { before, kept, undone, ok: !before.region && before.pressed === "true" && kept.listed === 1 && kept.region && undone.listed === 0 && !undone.region };
  }

  reach("aFollowUpTurnRevisesTheKeptDesign");
  {
    await page.fill('[data-testid="better-words"]', "make the tasks cards side by side");
    await page.click('[data-testid="better-send"]');
    await panelAt(page, "draft");
    await page.click('[data-testid="better-keep"]');
    await panelAt(page, "kept");
    const keptSource = await page.evaluate(() => window.__keeper.forked()[0]?.source ?? null);
    await page.evaluate(() => (window.__agentPrompts = []));
    await page.fill('[data-testid="better-words"]', "make the dates smaller");
    await page.click('[data-testid="better-send"]');
    await panelAt(page, "draft");
    const asked = await page.evaluate(() => ({ current: window.__agentPrompts[0]?.your_draft_on_the_page ?? null, conversation: window.__agentPrompts[0]?.conversation ?? [] }));
    const meta = await page.evaluate(() => getComputedStyle(document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelector(".pb-meta") ?? document.body).fontSize);
    const talk = await page.evaluate(() => [...document.querySelectorAll('[data-testid="better-message"]')].map((one) => one.textContent.trim()));
    await shot(page, "follow-up-draft");
    report.checks.aFollowUpTurnRevisesTheKeptDesign = {
      asked: { current: Boolean(asked.current), sameAsKept: asked.current === keptSource, people: asked.conversation.filter((one) => one.person).length },
      meta,
      talk: talk.slice(-2),
      ok: asked.current !== null && asked.current === keptSource && asked.conversation.filter((one) => one.person).length >= 2 && meta === "11px" && (talk.at(-1) ?? "").startsWith("The dates are smaller now."),
    };
    await page.click('[data-testid="better-discard"]');
    await panelAt(page, "open");
    await page.click('[data-testid="better-close"]');
    await page.waitForSelector(PANEL, { state: "detached", timeout: 5_000 }).catch(() => {});
  }

  reach("aBetterUiSuggestionOpensThePanelWithADraft");
  {
    await ready(page, "/tasks");
    await page.evaluate(() => ((window.__agentScenario = "good"), (window.__agentDelay = 0)));
    await menuOn(page, ROW);
    await page.waitForFunction(() => document.querySelector('[data-menu-section="suggested"] [data-suggested-mode="better"]'), null, { timeout: 10_000 });
    const label = await page.textContent('[data-menu-section="suggested"] [data-suggested-mode="better"]');
    await page.click('[data-menu-section="suggested"] [data-suggested-mode="better"]');
    await page.waitForSelector(PANEL, { timeout: 10_000 });
    await panelAt(page, "draft");
    const first = await page.evaluate(() => document.querySelector('[data-testid="better-message"]')?.textContent?.trim() ?? null);
    await shot(page, "suggestion-draft");
    report.checks.aBetterUiSuggestionOpensThePanelWithADraft = { label, first, ok: Boolean(first) && label.includes(first.replace(/ \(.*\)$/, "").slice(0, 12)) };
    await page.click('[data-testid="better-discard"]');
    await page.click('[data-testid="better-close"]');
    await page.waitForSelector(PANEL, { state: "detached", timeout: 5_000 }).catch(() => {});
  }

  reach("onAPhoneThePanelIsASheetBelowThePage");
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await phone.addInitScript(FAKE_AI);
    const on = await phone.newPage();
    on.on("pageerror", (error) => errors.push(`phone: ${error.message}`));
    await ready(on, "/tasks");
    await on.evaluate(() => ((window.__agentScenario = "good"), (window.__agentDelay = 0)));
    await menuOn(on, ROW);
    const seen = await menuSays(on);
    await shot(on, "phone-menu");
    await on.click(`${MENU} [data-menu-mode="better"]`);
    await on.waitForSelector(PANEL, { timeout: 10_000 });
    await on.fill('[data-testid="better-words"]', "make the tasks cards side by side");
    await on.click('[data-testid="better-send"]');
    await on.waitForSelector(`${PANEL}[data-better-phase="draft"]`, { timeout: 30_000 });
    const sheet = await panelClear(on);
    await shot(on, "phone-design-draft");
    await on.click('[data-testid="better-discard"]');
    report.checks.onAPhoneThePanelIsASheetBelowThePage = {
      order: seen.order,
      sheet,
      ok: seen.order[0] === "menu-type" && offersBetter(seen) && sheet.sheet && sheet.roomBelow,
    };
    await phone.close();
  }

  reach("thePanelSpeaksPlainly");
  report.checks.thePanelSpeaksPlainly = { words: panelSaid.join(" | ").slice(0, 2000), ok: panelSaid.length >= 2 && !JARGON.test(panelSaid.join(" ")) };

  reach("thePanelIsPartOfThePageAtEveryWidthInLightAndDark");
  {
    /*
     * At four widths and in both schemes: the app's bar spans the window with
     * the panel open, the panel stands flush under it down to the window's
     * foot (beside the page on a desk, a drawer over it where narrow, a sheet
     * on a phone), the page gives up the width beside it and nothing scrolls
     * sideways.
     */
    const seen = [];
    for (const width of [2000, 1440, 1024, 390]) {
      for (const colorScheme of ["light", "dark"]) {
        const sized = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, colorScheme, ...(width === 390 ? { deviceScaleFactor: 2 } : {}) });
        await sized.addInitScript(FAKE_AI);
        const on = await sized.newPage();
        on.on("pageerror", (error) => errors.push(`${width} ${colorScheme}: ${error.message}`));
        await ready(on, "/tasks");
        await on.evaluate(() => ((window.__agentScenario = "good"), (window.__agentDelay = 0)));
        await menuOn(on, ROW);
        await on.click(`${MENU} [data-menu-mode="better"]`);
        await on.waitForSelector(PANEL, { timeout: 10_000 });
        await on.fill('[data-testid="better-words"]', "make the tasks cards side by side");
        await on.click('[data-testid="better-send"]');
        await on.waitForSelector(`${PANEL}[data-better-phase="draft"]`, { timeout: 30_000 });
        await on.waitForTimeout(300);
        const one = await on.evaluate(() => {
          const panel = document.querySelector('[data-testid="better-panel"]');
          const box = panel.getBoundingClientRect();
          const bar = (document.querySelector('[data-testid="app-bar"]') ?? document.querySelector("header"))?.getBoundingClientRect();
          const page = (document.querySelector('[data-worker-view="task-list"]') ?? document.querySelector("[data-graview-page-main]"))?.getBoundingClientRect();
          const width = document.documentElement.clientWidth;
          return {
            dock: panel.getAttribute("data-better-dock"),
            bar: bar ? { left: Math.round(bar.left), right: Math.round(bar.right), bottom: Math.round(bar.bottom) } : null,
            panel: { left: Math.round(box.left), right: Math.round(box.right), top: Math.round(box.top), bottom: Math.round(box.bottom) },
            page: page ? { left: Math.round(page.left), right: Math.round(page.right) } : null,
            width,
            height: innerHeight,
            sideways: document.documentElement.scrollWidth > width,
            radius: getComputedStyle(panel).borderTopLeftRadius,
            background: getComputedStyle(panel).backgroundColor,
          };
        });
        await shot(on, `panel-${width}-${colorScheme}`);
        const wantDock = width >= 1100 ? "side" : width >= 640 ? "drawer" : "sheet";
        const fits =
          one.dock === wantDock &&
          !one.sideways &&
          one.bar !== null &&
          one.bar.left <= 0 &&
          one.bar.right >= one.width &&
          (wantDock === "sheet"
            ? one.panel.bottom === one.height && one.panel.left === 0 && one.panel.right === one.width
            : Math.abs(one.panel.top - one.bar.bottom) <= 1 && one.panel.bottom === one.height && one.panel.right === one.width && one.radius === "0px" && (wantDock === "drawer" || (one.page !== null && one.page.right <= one.panel.left)));
        seen.push({ width, colorScheme, ...one, fits });
        await sized.close();
      }
    }
    report.checks.thePanelIsPartOfThePageAtEveryWidthInLightAndDark = { seen, ok: seen.length === 8 && seen.every((one) => one.fits) && seen.some((one) => one.colorScheme === "dark" && one.background !== seen.find((other) => other.width === one.width && other.colorScheme === "light")?.background) };
  }

  reach("thePersonsWordsStayAsTypedAndThePartIsNamedBesideThem");
  {
    // A group of the list pointed at with the point tool: the chip says "About: …" by its own name, and the person's words are left as typed.
    await ready(page, "/tasks", "?grouped=1");
    await page.evaluate(() => ((window.__agentScenario = "good"), (window.__agentDelay = 0), (window.__agentPrompts = [])));
    await menuOn(page, ROW);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await page.waitForSelector(PANEL, { timeout: 10_000 });
    const before = await page.textContent('[data-testid="better-about"]');
    await page.click('[data-testid="better-point"]');
    await page.waitForSelector('[data-testid="section-highlighter"]', { timeout: 10_000 });
    const group = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("[data-graview-page-main] h2, [data-graview-page-main] h3")].find((one) => /Doing/.test(one.textContent ?? ""));
      const box = (heading?.closest('[data-testid="list-group"]') ?? heading)?.getBoundingClientRect();
      return box ? { x: Math.round(box.left + 8), y: Math.round(box.top + 6) } : null;
    });
    if (group) await page.mouse.click(group.x, group.y);
    await page.waitForTimeout(300);
    const about = await page.textContent('[data-testid="better-about"]');
    const words = "this is ugly and not creative enough";
    await page.fill('[data-testid="better-words"]', words);
    await page.click('[data-testid="better-send"]');
    await page.waitForSelector(`${PANEL}[data-better-phase="draft"]`, { timeout: 30_000 });
    const said = await page.evaluate(() => [...document.querySelectorAll('[data-testid="better-message"][data-who="person"]')].map((one) => one.textContent));
    const told = await page.evaluate(() => ({ about: window.__agentPrompts[0]?.about ?? null, person: (window.__agentPrompts[0]?.conversation ?? []).flatMap((one) => (one.person ? [one.person] : [])) }));
    await shot(page, "about-chip");
    report.checks.thePersonsWordsStayAsTypedAndThePartIsNamedBesideThem = {
      before,
      about,
      said,
      told,
      ok: before === "About: Tasks" && /^About: Doing$/.test(about ?? "") && said.length === 1 && said[0] === words && told.person.length === 1 && told.person[0] === words && told.about === "Doing",
    };
    await page.click('[data-testid="better-discard"]');
    await page.click('[data-testid="better-close"]');
  }

  reach("aDraftWithACheckboxBoundToNothingIsNeverShown");
  {
    await ready(page, "/tasks");
    await page.evaluate(() => ((window.__agentScenario = "checkbox"), (window.__agentDelay = 0), (window.__agentPrompts = [])));
    await menuOn(page, ROW);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await page.waitForSelector(PANEL, { timeout: 10_000 });
    await watchCheckboxes(page);
    await page.fill('[data-testid="better-words"]', "I can't mark them complete");
    await page.click('[data-testid="better-send"]');
    await page.waitForSelector(`${PANEL}[data-better-phase="draft"]`, { timeout: 30_000 });
    const seenCheckbox = await page.evaluate(() => (cancelAnimationFrame(window.__boxWatch), window.__boxes));
    const fedBack = await page.evaluate(() => window.__agentPrompts.flatMap((one) => one.your_steps.flatMap((step) => step.result?.findings ?? [])));
    const actsTold = await page.evaluate(() => (window.__agentPrompts[0]?.acts_a_press_may_ask_for ?? []).map((one) => one.act));
    const buttons = await page.evaluate(() => [...(document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelectorAll("button[data-act]") ?? [])].map((one) => `${one.getAttribute("data-act")}:${one.getAttribute("data-record")}`));
    report.checks.aDraftWithACheckboxBoundToNothingIsNeverShown = {
      seenCheckbox,
      fedBack: fedBack.slice(0, 4),
      actsTold,
      buttons,
      ok: seenCheckbox === 0 && fedBack.some((one) => /checkbox|mark|finish/i.test(one)) && actsTold.includes("finish") && buttons.length === 3 && buttons.every((one) => /^finish:t\d$/.test(one)),
    };
  }

  reach("whatAControlDoesIsSaidOnlyAsThePressCheckFoundIt");
  {
    // The agent said "a checkbox … and it saves"; the panel says what pressing found, and not the agent's claim.
    const reply = await page.evaluate(() => [...document.querySelectorAll('[data-testid="better-message"][data-who="graview"]')].at(-1)?.textContent ?? null);
    report.checks.whatAControlDoesIsSaidOnlyAsThePressCheckFoundIt = {
      reply,
      ok: reply !== null && !/checkbox|saves/i.test(reply) && /^Pressing each control checked it: Mark it done works on 3 tasks and 3 open their pages\.$/.test(reply),
    };
  }

  reach("aKeptRedesignFinishesATaskAndUndoPutsItBack");
  {
    await page.click('[data-testid="better-keep"]');
    await page.waitForSelector(`${PANEL}[data-better-phase="kept"]`, { timeout: 15_000 });
    await page.waitForFunction(() => document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelector('button[data-act="finish"][data-record="t1"]'), null, { timeout: 15_000 });
    const before = await page.evaluate(() => window.__store().graph.getNode("t1")?.done ?? null);
    // A real press: the host takes only a trusted one.
    await page.click('[data-worker-view="task-list"] button[data-act="finish"][data-record="t1"]');
    await page.waitForFunction(() => window.__store().graph.getNode("t1")?.done === true, null, { timeout: 10_000 }).catch(() => {});
    const after = await page.evaluate(() => {
      const store = window.__store();
      const batch = [...store.batches()].reverse().find((one) => !one.undone && one.ops.some((op) => op.writes.includes("t1")));
      return { done: store.graph.getNode("t1")?.done ?? null, batch: batch?.id ?? null, batches: store.batches().length };
    });
    if (after.batch) await page.evaluate((batch) => window.__store().undo(batch, { author: { kind: "human", id: "p1", roles: ["owner"] } }), after.batch);
    await page.waitForTimeout(300);
    const undone = await page.evaluate(() => window.__store().graph.getNode("t1")?.done ?? null);
    report.checks.aKeptRedesignFinishesATaskAndUndoPutsItBack = { before, after: after.done, batches: after.batches, undone, ok: before === false && after.done === true && undone === false };
  }

  reach("itDoesntWorkMakesGraviewPressEveryControl");
  {
    await page.evaluate(() => ((window.__agentScenario = "good"), (window.__agentPrompts = [])));
    await page.fill('[data-testid="better-words"]', "it doesn't work");
    await page.click('[data-testid="better-send"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="better-panel"]')?.getAttribute("data-better-phase") !== "working", null, { timeout: 30_000 });
    const steps = await page.evaluate(() => [...document.querySelectorAll('[data-testid="better-step"]')].map((one) => one.lastElementChild?.textContent?.trim() ?? ""));
    const said = await page.evaluate(() => [...document.querySelectorAll('[data-testid="better-message"][data-who="graview"]')].map((one) => one.textContent));
    const told = await page.evaluate(() => window.__agentPrompts[0]?.the_controls_as_pressed ?? null);
    report.checks.itDoesntWorkMakesGraviewPressEveryControl = {
      steps,
      said: said.slice(-2),
      told: told?.slice(0, 3) ?? null,
      ok: steps[0] === "Pressing every control on the page" && said.some((one) => /^I pressed every control\./.test(one) && /Mark it done works on/.test(one)) && Array.isArray(told) && told.length > 0,
    };
  }

  reach("theConversationsFirstMessageIsWhollyVisible");
  {
    await page.evaluate(() => {
      const list = document.querySelector('[data-testid="better-talk"]');
      if (list) list.scrollTop = 0;
    });
    const first = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="better-talk"]').getBoundingClientRect();
      const one = document.querySelector('[data-testid="better-message"]').getBoundingClientRect();
      const head = document.querySelector('[data-testid="better-about"]')?.getBoundingClientRect() ?? document.querySelector('[data-testid="better-scope"]').getBoundingClientRect();
      return { listTop: Math.round(list.top), top: Math.round(one.top), bottom: Math.round(one.bottom), listBottom: Math.round(list.bottom), headBottom: Math.round(head.bottom) };
    });
    await shot(page, "conversation-top");
    report.checks.theConversationsFirstMessageIsWhollyVisible = { first, ok: first.top >= first.listTop && first.top >= first.headBottom && first.bottom <= first.listBottom };
    await page.click('[data-testid="better-close"]');
  }

  reach("aPressThatDrawsNothingNewIsFedBackAndTheNextDraftShowsIt");
  {
    await ready(page, "/tasks");
    await page.evaluate(() => ((window.__agentScenario = "stale"), (window.__agentDelay = 0), (window.__agentPrompts = [])));
    await menuOn(page, ROW);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await page.waitForSelector(PANEL, { timeout: 10_000 });
    await page.fill('[data-testid="better-words"]', "make them cards side by side");
    await page.click('[data-testid="better-send"]');
    await page.waitForSelector(`${PANEL}[data-better-phase="draft"]`, { timeout: 60_000 });
    const fedBack = await page.evaluate(() => window.__agentPrompts.flatMap((one) => one.your_steps.flatMap((step) => step.result?.findings ?? [])));
    const buttons = await page.evaluate(() => [...(document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelectorAll("button[data-act]") ?? [])].map((one) => one.textContent.trim()));
    report.checks.aPressThatDrawsNothingNewIsFedBackAndTheNextDraftShowsIt = {
      fedBack: fedBack.filter((one) => /just as before/.test(one)).slice(0, 2),
      buttons,
      ok: fedBack.some((one) => /^“Mark done”: Pressed on “Write the brief”, it lands, and the design draws “Write the brief” just as before it/.test(one)) && buttons.length === 3 && !buttons.includes("Mark done"),
    };
    await page.click('[data-testid="better-discard"]').catch(() => {});
    await page.click('[data-testid="better-close"]').catch(() => {});
  }

  reach("aPressThatChangesNothingWhereItStandsIsFedBackNamingTheActThatWould");
  {
    await ready(page, "/tasks", "?done=t3");
    await page.evaluate(() => ((window.__agentScenario = "always-finish"), (window.__agentDelay = 0), (window.__agentPrompts = [])));
    await menuOn(page, ROW);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await page.waitForSelector(PANEL, { timeout: 10_000 });
    await page.fill('[data-testid="better-words"]', "make them cards side by side");
    await page.click('[data-testid="better-send"]');
    await page.waitForSelector(`${PANEL}[data-better-phase="draft"]`, { timeout: 60_000 });
    const fedBack = await page.evaluate(() => window.__agentPrompts.flatMap((one) => one.your_steps.flatMap((step) => step.result?.findings ?? [])));
    const buttons = await page.evaluate(() => [...(document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelectorAll("button[data-act]") ?? [])].map((one) => `${one.getAttribute("data-act")}:${one.getAttribute("data-record")}`));
    report.checks.aPressThatChangesNothingWhereItStandsIsFedBackNamingTheActThatWould = {
      fedBack: fedBack.filter((one) => /changes nothing there/.test(one)).slice(0, 2),
      buttons,
      ok: fedBack.some((one) => /^“Done”: On “Print the flyers” it asks for “finish”, which changes nothing there: it is so already\. Bind its press there to “reopen” instead/.test(one)) && buttons.includes("reopen:t3") && buttons.includes("finish:t1"),
    };
    await page.click('[data-testid="better-discard"]').catch(() => {});
    await page.click('[data-testid="better-close"]').catch(() => {});
  }

  reach("aFinishFromAKeptRedesignIsStillDoneAfterAReload");
  {
    await ready(page, "/tasks", "?remember=1");
    await page.evaluate(() => localStorage.removeItem("pb-records"));
    await ready(page, "/tasks", "?remember=1");
    await page.evaluate(() => ((window.__agentScenario = "good"), (window.__agentDelay = 0), (window.__agentPrompts = [])));
    await menuOn(page, ROW);
    await page.click(`${MENU} [data-menu-mode="better"]`);
    await page.waitForSelector(PANEL, { timeout: 10_000 });
    // First the settings' way, which draws the page over a store of its own, then a new design over it, kept.
    await page.fill('[data-testid="better-words"]', "show the due date on each row");
    await page.click('[data-testid="better-send"]');
    await page.waitForSelector(`${PANEL}[data-better-phase="draft"]`, { timeout: 60_000 });
    const overlaid = await page.evaluate(() => window.__changes.drafts > 0);
    await page.fill('[data-testid="better-words"]', "make them cards side by side");
    await page.click('[data-testid="better-send"]');
    await page.waitForFunction(() => document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelector('button[data-act="finish"]'), null, { timeout: 60_000 });
    await page.waitForSelector(`${PANEL}[data-better-phase="draft"]`, { timeout: 60_000 });
    await page.click('[data-testid="better-keep"]');
    await page.waitForSelector(`${PANEL}[data-better-phase="kept"]`, { timeout: 15_000 });
    await page.waitForFunction(() => document.querySelector('[data-worker-view="task-list"]')?.shadowRoot?.querySelector('button[data-act="finish"][data-record="t1"]'), null, { timeout: 15_000 });
    const rowOf = () => page.evaluate(() => document.querySelector('[data-worker-view="task-list"]').shadowRoot.querySelector('button[data-record="t1"]').closest(".pb-card").textContent.replace(/\s+/g, " ").trim());
    const rowBefore = await rowOf();
    await page.click('[data-worker-view="task-list"] button[data-act="finish"][data-record="t1"]');
    await page.waitForFunction(() => document.querySelector('[data-worker-view="task-list"]').shadowRoot.querySelector('button[data-act="reopen"][data-record="t1"]'), null, { timeout: 10_000 }).catch(() => {});
    const rowAfter = await rowOf();
    await shot(page, "kept-pressed");
    await ready(page, "/tasks", "?remember=1");
    const reloaded = await page.evaluate(() => window.__store().graph.getNode("t1")?.done ?? null);
    await page.evaluate(() => localStorage.removeItem("pb-records"));
    report.checks.aFinishFromAKeptRedesignIsStillDoneAfterAReload = { overlaid, rowBefore, rowAfter, reloaded, ok: overlaid && rowBefore !== rowAfter && /Done: yes/.test(rowAfter) && reloaded === true };
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

  /*
   * OTHER WAYS TO SHOW THIS, with AI off: the whole of it from the keyboard
   * until a page is told apart by its pointer alone.
   */
  const OPTION = '[data-testid="display-option"]';
  const PANE = '[data-testid="display-option-pane"]';
  /** The menu by Shift+F10 on the page's title, the row by its words, and Enter. */
  const otherWaysByKeyboard = async (on) => {
    await on.evaluate(() => {
      const title = document.querySelector("[data-graview-page-title]");
      title.setAttribute("tabindex", "-1");
      title.focus();
    });
    await on.keyboard.press("Shift+F10");
    await on.waitForSelector(MENU, { timeout: 10_000 });
    // A letter typed anywhere in the menu goes into its field, and what it filters to is lit for Enter.
    await on.keyboard.type("other ways");
    await on.waitForSelector(`${MENU} [data-menu-item="other-ways"][data-menu-lit]`, { timeout: 5000 });
    const reached = true;
    await on.keyboard.press("Enter");
    await on.waitForSelector('[data-testid="display-options"]', { timeout: 15_000 });
    return reached;
  };
  const switchSays = (on) =>
    on.evaluate(() => ({
      options: [...document.querySelectorAll('[data-testid="display-option"]')].map((one) => one.textContent),
      checked: document.querySelector('[data-testid="display-option"][aria-checked="true"]')?.textContent ?? null,
      focus: document.activeElement?.getAttribute("role") ?? document.activeElement?.tagName,
      shown: document.querySelector('[data-testid="display-options-stage"]')?.getAttribute("data-display-shown") ?? null,
      panes: [...document.querySelectorAll('[data-testid="display-option-pane"]')].map((one) => ({ key: one.getAttribute("data-display-option"), shown: one.hasAttribute("data-shown"), hasRecords: /Write the brief/.test(one.textContent) })),
      titleVisible: (document.querySelector("[data-graview-page-title]")?.getBoundingClientRect().height ?? 0) > 0,
      rowsVisible: [...document.querySelectorAll('[data-graview-page-main] [data-graview-listed], [data-graview-page-main] [data-graview-record]')].filter((one) => !one.closest('[data-testid="display-options-stage"]') && one.getBoundingClientRect().height > 0).length,
      bar: document.querySelector("[data-better-bar]")?.innerText ?? "",
    }));
  const writes = (on) => on.evaluate(() => ({ applied: window.__changes.applied, drafts: window.__changes.drafts, log: window.__store().log.all().length, document: JSON.stringify(window.__changes.document()) }));
  const nowBare = (on) => on.evaluate(() => localStorage.removeItem("graview:display-choices:The tasks"));

  reach("otherWaysOpensByTheKeyboardWithAiOff");
  await ready(page, "/tasks", "?noai=1");
  await nowBare(page);
  await ready(page, "/tasks", "?noai=1");
  const before = await writes(page);
  {
    const reached = await otherWaysByKeyboard(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]') && document.activeElement?.getAttribute("role") === "radio", null, { timeout: 5000 });
    const seen = await switchSays(page);
    await shot(page, "other-ways-open");
    const focusOn = await page.evaluate(() => document.activeElement?.getAttribute("aria-checked"));
    report.checks.otherWaysOpensByTheKeyboardWithAiOff = { reached, options: seen.options, checked: seen.checked, focusOn, ok: reached && focusOn === "true" && seen.focus === "radio" && seen.options.length >= 3 && seen.options[0] === "As it is now" && seen.checked !== "As it is now" };
  }

  reach("everyOptionIsDrawnAheadInRealDataUnderThePagesHeading");
  {
    const seen = await switchSays(page);
    report.checks.everyOptionIsDrawnAheadInRealDataUnderThePagesHeading = { options: seen.options, panes: seen.panes.map((one) => ({ shown: one.shown, hasRecords: one.hasRecords })), titleVisible: seen.titleVisible, rowsVisible: seen.rowsVisible, ok: seen.options.length - 1 === seen.panes.length && seen.panes.length >= 2 && seen.panes.length <= 4 && seen.panes.every((one) => one.hasRecords) && seen.panes.filter((one) => one.shown).length === 1 && seen.titleVisible && seen.rowsVisible === 0 };
  }

  reach("flippingBetweenOptionsIsInstant");
  {
    // Each flip, pressed and painted: the press to the frame after it, with what it shows already in place.
    const times = await page.evaluate(async () => {
      const out = [];
      const options = [...document.querySelectorAll('[data-testid="display-option"]')];
      for (const option of [...options, ...options]) {
        await new Promise((done) => requestAnimationFrame(done));
        const from = performance.now();
        option.click();
        const key = option.getAttribute("data-option");
        // Read just before the first paint after the press: what it shows is already there.
        const inPlaceBeforeThePaint = await new Promise((done) => requestAnimationFrame(() => done(document.querySelector('[data-testid="display-options-stage"]').getAttribute("data-display-shown") === key && (key === "__now__" || document.querySelector('[data-testid="display-option-pane"][data-shown]')?.getAttribute("data-display-option") === key))));
        out.push({ key: option.textContent, ms: Math.round((performance.now() - from) * 10) / 10, inPlaceBeforeThePaint });
      }
      return out;
    });
    const slowest = Math.max(...times.map((one) => one.ms));
    const slow = Number(process.env.GRAVIEW_SLOW ?? 1);
    report.checks.flippingBetweenOptionsIsInstant = { times, slowest, ok: times.every((one) => one.inPlaceBeforeThePaint) && slowest < 60 * slow };
  }

  reach("nothingIsWrittenWhileFlipping");
  {
    for (let press = 0; press < 6; press++) await page.keyboard.press("ArrowRight");
    const after = await writes(page);
    report.checks.nothingIsWrittenWhileFlipping = { before: { applied: before.applied, drafts: before.drafts, log: before.log }, after: { applied: after.applied, drafts: after.drafts, log: after.log }, ok: after.applied === before.applied && after.drafts === before.drafts && after.log === before.log && after.document === before.document };
  }

  reach("asItIsNowPutsThePageBackAtOnce");
  {
    await page.evaluate(() => document.querySelector('[data-testid="display-option"][data-option="__now__"]').click());
    const seen = await switchSays(page);
    await shot(page, "other-ways-as-it-is");
    report.checks.asItIsNowPutsThePageBackAtOnce = { rowsVisible: seen.rowsVisible, shown: seen.shown, ok: seen.rowsVisible >= 3 && seen.shown === "__now__" && seen.panes.every((one) => !one.shown) };
  }

  reach("thePersonReadsPlainWordsAndOneFilledButton");
  {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(40);
    const seen = await switchSays(page);
    const filled = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--graview-accent)";
      const bar = document.querySelector("[data-better-bar]");
      bar.append(probe);
      const said = getComputedStyle(probe).color;
      probe.remove();
      return [...bar.querySelectorAll("button")].filter((one) => getComputedStyle(one).backgroundColor === said).map((one) => one.textContent);
    });
    await shot(page, "other-ways-option");
    report.checks.thePersonReadsPlainWordsAndOneFilledButton = { bar: seen.bar, filled, ok: !JARGON.test(seen.bar) && !/\btask\b.*:|add-lens|columns|blocks/.test(seen.bar) && filled.length === 1 && filled[0] === "Keep" };
  }

  reach("keepMakesItTheListWithItsHeadingItsFormAndItsWayToTheList");
  let keptOption;
  {
    // Cards, a new place: everything it edits is what one Undo must take back.
    await page.click(`${OPTION}:has-text("Cards")`);
    keptOption = await page.evaluate(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]').textContent);
    await page.focus('[data-testid="section-keep"]');
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-section-phase="options-kept"]', { timeout: 15_000 });
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "section-undo", null, { timeout: 5000 });
    await page.waitForSelector('[data-testid="place-lens"]', { timeout: 15_000 });
    const after = await page.evaluate(() => ({
      opens: window.__changes.document().pages?.lists?.task?.opens,
      applied: window.__changes.applied,
      title: document.querySelector("[data-graview-page-title]")?.textContent,
      path: location.pathname,
      stage: Boolean(document.querySelector('[data-testid="display-options-stage"]')),
      hasRecords: /Write the brief/.test(document.querySelector('[data-testid="place-lens"]')?.textContent ?? ""),
      toList: document.querySelector('[data-testid="place-as-list"]')?.getAttribute("href"),
      said: document.querySelector('[data-testid="section-status"]')?.textContent,
    }));
    await shot(page, "other-ways-kept");
    report.checks.keepMakesItTheListWithItsHeadingItsFormAndItsWayToTheList = { keptOption, ...after, ok: Boolean(after.opens) && after.applied === before.applied + 1 && after.title === "Tasks" && after.path.endsWith("/tasks") && !after.stage && after.hasRecords && /drawn=built-in/.test(after.toList ?? "") && /Tasks now shows as cards/.test(after.said ?? "") };
  }

  reach("oneUndoTakesAllOfItBack");
  {
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-section-phase="options-undone"]', { timeout: 15_000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="place-lens"]'), null, { timeout: 15_000 });
    const after = await writes(page);
    const seen = await switchSays(page);
    const focus = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    report.checks.oneUndoTakesAllOfItBack = { rowsVisible: seen.rowsVisible, focus, ok: after.document === before.document && seen.rowsVisible >= 3 && focus === "section-close" && (await page.evaluate(() => window.__changes.undone)) >= 1 };
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-better-bar]', { state: "detached", timeout: 5000 });
  }

  reach("aChoiceRanksTheNextOffer");
  {
    // Kept and left kept, cards opens the next offer first; the undone one above ranked nothing.
    await ready(page, "/tasks", "?noai=1");
    const first = await (async () => {
      await otherWaysByKeyboard(page);
      await page.waitForFunction(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]'), null, { timeout: 5000 });
      return (await switchSays(page)).options;
    })();
    await page.click(`${OPTION}:has-text("Cards")`);
    await page.click('[data-testid="section-keep"]');
    await page.waitForSelector('[data-section-phase="options-kept"]', { timeout: 15_000 });
    await page.click('[data-testid="section-close"]');
    await ready(page, "/tasks", "?noai=1");
    await otherWaysByKeyboard(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]'), null, { timeout: 5000 });
    const next = await switchSays(page);
    report.checks.aChoiceRanksTheNextOffer = { first, next: next.options, opensOn: next.checked, ok: first[1] !== "Cards" && next.options[1] === "Cards" && next.checked === "Cards" };
    await page.keyboard.press("Escape");
    await nowBare(page);
  }

  reach("aPlaceChangesWhatDrawsItAndKeepsItsAddress");
  {
    await ready(page, "/places/the-board", "?noai=1");
    const was = await page.evaluate(() => JSON.stringify(window.__changes.document()));
    await otherWaysByKeyboard(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]'), null, { timeout: 5000 });
    const seen = await switchSays(page);
    await shot(page, "other-ways-place");
    await page.click('[data-testid="section-keep"]');
    await page.waitForSelector('[data-section-phase="options-kept"]', { timeout: 15_000 });
    const kept = await page.evaluate(() => ({ lens: window.__changes.document().lenses.find((one) => one.title === "The board"), count: window.__changes.document().lenses.length, path: location.pathname, title: document.querySelector("[data-graview-page-title]")?.textContent }));
    await page.click('[data-testid="section-undo"]');
    await page.waitForSelector('[data-section-phase="options-undone"]', { timeout: 15_000 });
    const back = await page.evaluate(() => JSON.stringify(window.__changes.document()));
    report.checks.aPlaceChangesWhatDrawsItAndKeepsItsAddress = { options: seen.options, kept: { name: kept.lens?.name, count: kept.count, path: kept.path, title: kept.title }, ok: !seen.options.some((one) => /^Board by/.test(one)) && kept.lens && kept.lens.name !== "columns" && kept.count === 1 && kept.path.endsWith("/places/the-board") && kept.title === "The board" && back === was };
    await page.keyboard.press("Escape");
    await nowBare(page);
  }

  reach("aHostsOptionJoinsAfterTheFirstDrawAndHearsTheChoice");
  {
    await ready(page, "/tasks", "?noai=1&offers=1");
    await otherWaysByKeyboard(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]'), null, { timeout: 5000 });
    const firstShown = (await switchSays(page)).checked;
    await page.waitForSelector(`${OPTION}:has-text("What others kept")`, { timeout: 5000 });
    const stayed = (await switchSays(page)).checked === firstShown;
    await page.click(`${OPTION}:has-text("What others kept")`);
    await page.click('[data-testid="section-keep"]');
    await page.waitForSelector('[data-section-phase="options-kept"]', { timeout: 15_000 });
    const heard = await page.evaluate(() => window.__heard);
    await page.click('[data-testid="section-undo"]');
    await page.waitForSelector('[data-section-phase="options-undone"]', { timeout: 15_000 });
    const heardAfter = await page.evaluate(() => window.__heard);
    report.checks.aHostsOptionJoinsAfterTheFirstDrawAndHearsTheChoice = { stayed, heard, ok: stayed && heard?.length === 1 && heard[0].kept.hostId === "others-kept" && heard[0].undone === false && heard[0].offered.includes("host:others-kept") && heardAfter?.length === 2 && heardAfter[1].undone === true };
    await page.keyboard.press("Escape");
    await nowBare(page);
  }

  reach("aReaderIsOfferedNoOtherWays");
  {
    const visitor = await context.newPage();
    visitor.on("pageerror", (error) => errors.push(error.message));
    await ready(visitor, "/tasks", "?visitor=1&noai=1");
    await menuOn(visitor, "[data-graview-page-title]");
    await visitor.waitForTimeout(300);
    if (await visitor.$(`${MENU} [data-menu-item="more"]`)) await visitor.click(`${MENU} [data-menu-item="more"]`);
    await visitor.waitForTimeout(60);
    const rows = await visitor.evaluate(() => [...document.querySelectorAll('[data-testid="context-menu"] [data-menu-item]')].map((one) => one.getAttribute("data-menu-item")));
    report.checks.aReaderIsOfferedNoOtherWays = { rows, ok: rows.length > 0 && !rows.includes("other-ways") };
    await visitor.close();
  }

  reach("onAPhoneTheSwitchFitsAndTheKeyboardStaysOnIt");
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
    await phone.addInitScript(FAKE_AI);
    const small = await phone.newPage();
    small.on("pageerror", (error) => errors.push(error.message));
    await ready(small, "/tasks", "?noai=1");
    await otherWaysByKeyboard(small);
    await small.waitForFunction(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]'), null, { timeout: 5000 });
    await small.keyboard.press("ArrowRight");
    await small.waitForTimeout(40);
    const seen = await small.evaluate(() => {
      const bar = document.querySelector("[data-better-bar]").getBoundingClientRect();
      return { sideways: document.documentElement.scrollWidth > window.innerWidth + 1, barFits: bar.left >= 0 && bar.right <= window.innerWidth + 1, barOver: Math.round(bar.height), onRadio: document.activeElement?.getAttribute("aria-checked") === "true", shownWidth: Math.round(document.querySelector('[data-testid="display-option-pane"][data-shown]')?.getBoundingClientRect().width ?? 0) };
    });
    await shot(small, "other-ways-phone");
    report.checks.onAPhoneTheSwitchFitsAndTheKeyboardStaysOnIt = { ...seen, ok: !seen.sideways && seen.barFits && seen.onRadio && seen.shownWidth > 0 && seen.shownWidth <= 390 };
    await phone.close();
  }

  /** The rows a menu holds, every one of them: More… pressed, and what typing its words would light. */
  const rowsOfMenu = async (on, selector) => {
    if (await on.$(MENU)) {
      await on.keyboard.press("Escape");
      await on.waitForSelector(MENU, { state: "detached" }).catch(() => {});
    }
    const box = await on.locator(selector).first().boundingBox();
    await on.mouse.click(Math.round(box.x + Math.min(12, box.width / 2)), Math.round(box.y + box.height / 2), { button: "right" });
    await on.waitForSelector(MENU, { timeout: 10_000 });
    await on.waitForTimeout(300);
    if (await on.$(`${MENU} [data-menu-item="more"]`)) await on.click(`${MENU} [data-menu-item="more"]`);
    await on.waitForTimeout(60);
    return on.evaluate(() => [...document.querySelectorAll('[data-testid="context-menu"] [data-menu-item]')].map((one) => one.getAttribute("data-menu-item")));
  };

  reach("aListDrawnAsTheAppDrawsItIsOfferedNoOtherWays");
  {
    // Keeping one would not change an address that asks for the list itself.
    await ready(page, "/tasks", "?noai=1&drawn=built-in");
    const rows = await rowsOfMenu(page, `${MAIN} [data-graview-page-title]`);
    report.checks.aListDrawnAsTheAppDrawsItIsOfferedNoOtherWays = { rows, ok: rows.length > 0 && !rows.includes("other-ways") };
    await page.keyboard.press("Escape");
  }

  /*
   * THE EXAMPLE'S OWN DESIGN AND ITS DEVELOPMENT HOST. The host lends the
   * change on every page here, so a row withheld on the tasks is withheld
   * for the design's sake and for no other: the same seat is offered it on
   * a place and on a list the design left alone, and keeps through
   * dev-change.ts, which lays the change's lenses over the code app.
   */
  todo = await serving("todo", portFor("todo"), repoRoot);
  const todoContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await todoContext.addInitScript(() => (window.__todoDevHost = true));
  const things = await todoContext.newPage();
  things.on("pageerror", (error) => errors.push(`todo: ${error.message}`));
  const thingsAt = async (path) => {
    await things.goto(`${at("todo")}/pages${path}?today=2026-09-01&fresh=1`, { waitUntil: "load" });
    await things.waitForSelector("[data-graview-page-title], main h1", { timeout: 60_000 });
    await things.waitForTimeout(300);
  };

  reach("aListADesignReplacesIsOfferedNoOtherWays");
  {
    await thingsAt("/tasks");
    const rows = await rowsOfMenu(things, "[data-graview-page-title], main h1");
    report.checks.aListADesignReplacesIsOfferedNoOtherWays = { rows, ok: rows.length > 0 && !rows.includes("other-ways") };
    await things.keyboard.press("Escape");
  }

  reach("aPlaceUnderADesignIsStillOfferedAndKeepsThroughTheDevHost");
  {
    await thingsAt("/places/the-month");
    const lensOf = () => things.evaluate(() => ({ flows: document.querySelector('[data-testid="place-lens"]')?.hasAttribute("data-flows") ?? null, title: document.querySelector("[data-graview-page-title]")?.textContent, path: location.pathname }));
    const was = await lensOf();
    await otherWaysByKeyboard(things);
    await things.waitForFunction(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]'), null, { timeout: 5000 });
    const seen = await switchSays(things);
    await things.click(`${OPTION}:has-text("Cards")`);
    await things.click('[data-testid="section-keep"]');
    await things.waitForSelector('[data-section-phase="options-kept"]', { timeout: 15_000 });
    await things.waitForFunction(() => document.querySelector('[data-testid="place-lens"]')?.hasAttribute("data-flows"), null, { timeout: 15_000 });
    const kept = await lensOf();
    const said = await things.evaluate(() => document.querySelector('[data-testid="section-status"]')?.textContent);
    await shot(things, "other-ways-todo-place-kept");
    await things.click('[data-testid="section-undo"]');
    await things.waitForSelector('[data-section-phase="options-undone"]', { timeout: 15_000 });
    await things.waitForFunction(() => !document.querySelector('[data-testid="place-lens"]')?.hasAttribute("data-flows"), null, { timeout: 15_000 });
    const back = await lensOf();
    report.checks.aPlaceUnderADesignIsStillOfferedAndKeepsThroughTheDevHost = { options: seen.options, was, kept, said, back, ok: was.flows === false && kept.flows === true && kept.title === was.title && kept.path === was.path && back.flows === false && /now shows as cards/.test(said ?? "") };
    await things.keyboard.press("Escape");
  }

  reach("aListNoDesignReplacesOpensAsItsOptionThroughTheDevHost");
  {
    await thingsAt("/people");
    const before = await things.evaluate(() => ({ title: document.querySelector("[data-graview-page-title], main h1")?.textContent, lens: Boolean(document.querySelector('[data-testid="place-lens"]')) }));
    await otherWaysByKeyboard(things);
    await things.waitForFunction(() => document.querySelector('[data-testid="display-option"][aria-checked="true"]'), null, { timeout: 5000 });
    const seen = await switchSays(things);
    await things.click(`${OPTION}:has-text("Cards")`);
    await things.click('[data-testid="section-keep"]');
    await things.waitForSelector('[data-section-phase="options-kept"]', { timeout: 15_000 });
    await things.waitForSelector('[data-testid="place-lens"]', { timeout: 15_000 });
    const kept = await things.evaluate(() => ({ title: document.querySelector("[data-graview-page-title], main h1")?.textContent, toList: document.querySelector('[data-testid="place-as-list"]')?.getAttribute("href"), path: location.pathname }));
    await shot(things, "other-ways-todo-list-kept");
    await things.click('[data-testid="section-undo"]');
    await things.waitForSelector('[data-section-phase="options-undone"]', { timeout: 15_000 });
    await things.waitForSelector('[data-testid="place-lens"]', { state: "detached", timeout: 15_000 });
    report.checks.aListNoDesignReplacesOpensAsItsOptionThroughTheDevHost = { options: seen.options, before, kept, ok: before.lens === false && kept.title === before.title && kept.path.endsWith("/people") && /drawn=built-in/.test(kept.toList ?? "") };
  }
  await todoContext.close();

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
  todo?.stop();
}

writeFileSync(resolve(repoRoot, "docs/page-better.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/page-better.json\n`);
process.exit(report.passed ? 0 : 1);
