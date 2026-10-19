#!/usr/bin/env node
/**
 * THE INLINE AI, END TO END (Roadmap f-ai-candidate-catalog, f-activity-ai-
 * entries) — driven in a real browser against the todo app, whose dev build
 * fills the host's Fast and Thinking slots with stubs at `?ai=stub` and is a
 * host that turned AI off at `?ai=off`.
 *
 * Right-clicked, a task's menu carries the AI's suggestions, picked from the
 * catalog (never an act the menu does not offer); one taken is a ghost until
 * it is accepted, then one change with its undo; "Fill in with AI" proposes
 * fills that are accepted in part as one batch; "Draw a panel" draws one
 * that "Keep as a lens" makes a real place. Activity shows each interaction
 * once — its outcome, its model, the batch it made with its undo — under the
 * AI filter and the reader's own; a record's page shows the ones about it;
 * a host's stored entries are drawn; and with AI off no AI part is drawn on
 * either face. A menu opened on a card the pointer rested on draws complete
 * in its first frame, hovering across the tasks asks no model, a menu opened
 * again asks nothing until its record changes (FR-186), and a host with only
 * a Thinking slot is asked only when "Suggest…" is pressed (FR-185). With a
 * Fast slot that answers in 100 to 250 ms, the menu's AI section fills in
 * under 400 ms at the 95th percentile of twenty opens; and where the host
 * asks for hover chips there is at most one, never for a pointer passing
 * over, and none with AI off or where the host did not ask.
 *
 *   node scripts/verify-inline-ai.mjs [--engine=chromium|webkit|firefox]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const VERDICT = resolve(repoRoot, "docs/inline-ai.json");

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let app;
let browser;
const reach = deadline({
  verdict: VERDICT,
  report,
  cleanup: async () => {
    await browser?.close();
    app?.stop();
  },
});
app = await serving("todo", portFor("todo"), repoRoot);

const MENU = '[data-testid="context-menu"]';
const AI = '[data-menu-section="inline-ai"]';
const GHOST = '[data-testid="ai-ghost"]';
const DAY = "today=2026-09-01";
/* A record page's heading, in the derived face or the app's own design. */
const HEADING = "main :is([data-graview-page-title], h1, h2) >> nth=0";

/* The store itself, handed to the watch as it opens (as verify-playback keeps it). */
const KEEP_THE_STORE = () => {
  const keep = (store) => (window.__aiStores ??= []).push(store);
  const watch = (window.__graviewWatch ??= {});
  const handed = watch.store;
  watch.store = (store) => {
    handed?.(store);
    keep(store);
  };
};

const ready = async (page) => {
  await page.waitForFunction(() => "__todoReady" in window && (window.__aiStores ?? []).some((store) => store.schema.kinds.includes("task")), undefined, { timeout: 120_000 });
  await page.waitForTimeout(600);
};

/** What the store says about a task: done, and what it waits for. */
const taskSays = (page, id) =>
  page.evaluate((id) => {
    const store = window.__aiStores.find((one) => one.schema.kinds.includes("task"));
    const node = store.graph.getNode(id);
    return { done: node?.done === true, waitsFor: store.graph.out(id, "waits-for").map((one) => one.id).sort() };
  }, id);

/** The ops of a batch: their lineage and channel. */
const batchSays = (page, batch) =>
  page.evaluate((batch) => {
    const store = window.__aiStores.find((one) => one.schema.kinds.includes("task"));
    return store.log.all().filter((op) => op.batch === batch).map((op) => ({ interaction: op.lineage?.interaction ?? null, via: op.via ?? null, intent: op.intent }));
  }, batch);

/** The last batch in the log. */
const lastBatch = (page) =>
  page.evaluate(() => {
    const store = window.__aiStores.find((one) => one.schema.kinds.includes("task"));
    return store.batches().at(-1)?.id ?? null;
  });

/** The AI section of the open menu, once its suggestions have arrived. */
async function aiSection(page) {
  await page.waitForSelector(MENU, { timeout: 10_000 });
  await page.waitForSelector(`${AI} [data-ai-offer], ${AI} [data-menu-item="ai-fill"]`, { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector('[data-testid="inline-ai-thinking"]'), undefined, { timeout: 10_000 }).catch(() => undefined);
  return page.evaluate(() => {
    const menu = document.querySelector('[data-testid="context-menu"]');
    const section = menu?.querySelector('[data-menu-section="inline-ai"]');
    return {
      drawn: section !== null && section !== undefined,
      offers: [...(section?.querySelectorAll("[data-ai-offer]") ?? [])].map((one) => ({ id: one.getAttribute("data-ai-offer"), type: one.getAttribute("data-ai-offer-type"), text: (one.textContent ?? "").trim() })),
      rows: [...(section?.querySelectorAll("[data-menu-item]") ?? [])].map((one) => one.getAttribute("data-menu-item")),
      acts: [...(menu?.querySelectorAll("[data-pin-for]") ?? [])].map((one) => one.getAttribute("data-pin-for")),
    };
  });
}

async function openOn(page, id) {
  await page.click(`[data-graview-pick="${id}"]`, { button: "right" });
  return aiSection(page);
}

async function putAway(page) {
  if (await page.$(MENU)) await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

/** What the ghost tray says. */
const ghostSays = (page) =>
  page.evaluate(() => {
    const tray = document.querySelector('[data-testid="ai-ghost"]');
    if (!tray) return null;
    return {
      text: (tray.textContent ?? "").replace(/\s+/g, " ").trim(),
      proposals: [...tray.querySelectorAll("[data-ghost-proposal]")].map((one) => one.getAttribute("data-ghost-proposal")),
      accept: tray.querySelector('[data-testid="ghost-accept"]')?.textContent?.trim() ?? null,
      undo: tray.querySelector('[data-testid="ghost-undo"]') !== null,
    };
  });

/** Activity, opened: its interactions and its change rows. */
async function activitySays(page) {
  if (!(await page.$('[data-testid="activity"]'))) await page.click('[data-testid="activity-button"]');
  await page.waitForSelector('[data-testid="activity"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const pane = document.querySelector('[data-testid="activity"]');
    return {
      filter: pane?.querySelector('[data-testid="activity-filter"]') !== null,
      interactions: [...(pane?.querySelectorAll('[data-testid="activity-interaction"]') ?? [])].map((one) => ({
        id: one.getAttribute("data-interaction"),
        outcome: one.getAttribute("data-outcome"),
        text: (one.textContent ?? "").replace(/\s+/g, " ").trim(),
        batches: [...one.querySelectorAll("[data-interaction-batch]")].map((batch) => batch.getAttribute("data-interaction-batch")),
        undo: one.querySelector('[data-testid="undo-turn"]') !== null,
      })),
      changes: [...(pane?.querySelectorAll("li[data-batch]") ?? [])].map((one) => one.getAttribute("data-batch")),
    };
  });
}

/** A stored entry, as a host (Graview Cloud) hands one back. */
const STORED = {
  id: "ai-stored-1",
  at: "2026-09-01T08:00:00.000Z",
  by: { kind: "human", id: "user-nora" },
  target: { on: "record", id: "t-book" },
  targetLabel: "Book the van",
  ask: { kind: "suggest", said: "Suggest" },
  offered: [{ id: "act:finish:t-book", type: "act", label: "Mark it done: Book the van", confidence: 0.8 }],
  outcome: "dismissed",
  usage: [{ tier: "fast", model: "jev-latest", inputTokens: 900, outputTokens: 0, costUsd: 0.0000378 }],
};

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  await context.addInitScript(KEEP_THE_STORE);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${at("todo")}/?${DAY}&ai=stub`, { waitUntil: "load", timeout: 90_000 });
  await ready(page);

  /* ------------------------------------------- a suggestion, from the catalog */
  reach("aMenuSuggestionIsPickedFromWhatTheMenuOffers");
  const first = await openOn(page, "t-deposit");
  const actOffers = first.offers.filter((offer) => offer.type === "act").map((offer) => offer.id.split(":")[1]);
  report.checks.aMenuSuggestionIsPickedFromWhatTheMenuOffers = {
    first,
    ok:
      first.drawn &&
      first.offers.length > 0 &&
      first.offers[0].id === "act:finish:t-deposit" &&
      // Never an act the derivation does not offer this seat here.
      actOffers.every((mutation) => first.acts.includes(mutation)) &&
      first.rows.includes("ai-fill") &&
      first.rows.includes("ai-panel"),
  };

  /* ------------------------------------------- a ghost, then one change, then undo */
  reach("aSuggestionIsAGhostUntilAcceptedThenOneUndo");
  await page.click(`${AI} [data-ai-offer="act:finish:t-deposit"]`);
  await page.waitForSelector(GHOST, { timeout: 10_000 });
  const ghost = await ghostSays(page);
  const before = await taskSays(page, "t-deposit");
  await page.click('[data-testid="ghost-accept"]');
  await page.waitForTimeout(300);
  const accepted = await taskSays(page, "t-deposit");
  const acceptedBatch = await lastBatch(page);
  const lineage = await batchSays(page, acceptedBatch);
  const afterAccept = await ghostSays(page);
  await page.click('[data-testid="ghost-undo"]');
  await page.waitForTimeout(300);
  const undone = await taskSays(page, "t-deposit");
  report.checks.aSuggestionIsAGhostUntilAcceptedThenOneUndo = {
    ghost,
    before,
    accepted,
    lineage,
    afterAccept,
    undone,
    trayGone: (await ghostSays(page)) === null,
    ok:
      ghost !== null &&
      ghost.proposals.length === 1 &&
      before.done === false &&
      accepted.done === true &&
      lineage.length > 0 &&
      lineage.every((op) => op.interaction !== null && op.via === `ai:${op.interaction}`) &&
      afterAccept?.undo === true &&
      undone.done === false,
  };

  /* ------------------------------------------- fills, accepted in part, as one batch */
  reach("fillsAreAcceptedInPartAsOneBatch");
  await openOn(page, "t-deposit");
  await page.click(`${AI} [data-menu-item="ai-fill"]`);
  await page.waitForSelector(GHOST, { timeout: 10_000 });
  const fills = await ghostSays(page);
  // Leave the second out: "Accept some".
  await page.click(`${GHOST} [data-ghost-proposal]:nth-child(2) input[type="checkbox"]`);
  const some = await ghostSays(page);
  await page.click('[data-testid="ghost-accept"]');
  await page.waitForTimeout(300);
  const filled = await taskSays(page, "t-deposit");
  const fillBatch = await lastBatch(page);
  const fillLineage = await batchSays(page, fillBatch);
  await page.click('[data-testid="ghost-close"]');
  report.checks.fillsAreAcceptedInPartAsOneBatch = {
    fills,
    some,
    filled,
    fillLineage,
    ok:
      fills !== null &&
      fills.proposals.length >= 2 &&
      some?.accept === `Accept ${fills.proposals.length - 1} of ${fills.proposals.length}` &&
      filled.waitsFor.length === fills.proposals.length - 1 &&
      fillLineage.length === fills.proposals.length - 1 &&
      fillLineage.every((op) => op.interaction !== null),
  };

  /* ------------------------------------------- a panel, kept as a real lens */
  reach("aGeneratedPanelIsPinnedIntoARealLens");
  await openOn(page, "t-deposit");
  await page.click(`${AI} [data-menu-item="ai-panel"]`);
  await page.waitForSelector('[data-testid="draft-frame"]', { timeout: 15_000 });
  const title = await page.evaluate(() => document.querySelector('[data-testid="draft-title"]')?.textContent?.trim() ?? null);
  const lens = await page.evaluate(() => document.querySelector('[data-testid="draft-lens"]')?.getAttribute("data-graview-draft") ?? null);
  await page.click('[data-testid="draft-keep"]');
  await page.waitForTimeout(1200);
  const kept = await page.evaluate((title) => ({ frameGone: !document.querySelector('[data-testid="draft-frame"]'), named: title !== null && (document.body.textContent ?? "").includes(title) }), title);
  report.checks.aGeneratedPanelIsPinnedIntoARealLens = {
    title,
    lens,
    kept,
    ok: title !== null && /as drafted/.test(title) && lens === "blocks" && kept.named,
  };

  /* ------------------------------------------- Activity: once each, with the undo */
  reach("activityShowsEachInteractionOnceWithItsUndo");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const activity = await activitySays(page);
  const fillEntry = activity.interactions.find((one) => one.batches.includes(fillBatch));
  const acceptedEntry = activity.interactions.find((one) => one.batches.includes(acceptedBatch));
  const panelEntry = activity.interactions.find((one) => one.outcome === "drawn");
  report.checks.activityShowsEachInteractionOnceWithItsUndo = {
    activity,
    ok:
      fillEntry !== undefined &&
      fillEntry.outcome === "partly" &&
      fillEntry.undo &&
      /stub-fast/.test(fillEntry.text) &&
      acceptedEntry !== undefined &&
      acceptedEntry.outcome === "accepted" &&
      panelEntry !== undefined &&
      // The batch is drawn in its entry, and not again as a change of its own.
      !activity.changes.includes(fillBatch) &&
      activity.interactions.filter((one) => one.id === fillEntry.id).length === 1,
  };

  reach("anEntrysUndoTakesItsBatchBack");
  await page.click(`[data-testid="activity-interaction"][data-interaction="${fillEntry?.id}"] [data-testid="undo-turn"]`);
  await page.waitForTimeout(300);
  const takenBack = await taskSays(page, "t-deposit");
  report.checks.anEntrysUndoTakesItsBatchBack = { takenBack, ok: takenBack.waitsFor.length === 0 };

  reach("theAiFilterAndThePersonViewShowIt");
  const shown = {};
  for (const shows of ["ai", "changes", "all"]) {
    await page.click(`[data-testid="activity-filter"] [data-shows="${shows}"]`);
    await page.waitForTimeout(150);
    shown[shows] = await activitySays(page);
  }
  await page.click('[data-testid="activity-mine"]');
  await page.waitForTimeout(150);
  shown.mine = await activitySays(page);
  await page.click('[data-testid="activity-mine"]');
  report.checks.theAiFilterAndThePersonViewShowIt = {
    counts: Object.fromEntries(Object.entries(shown).map(([key, value]) => [key, { interactions: value.interactions.length, changes: value.changes.length }])),
    ok:
      shown.ai.filter &&
      shown.ai.interactions.length >= 3 &&
      shown.ai.changes.length === 0 &&
      shown.changes.interactions.length === 0 &&
      shown.changes.changes.length > 0 &&
      shown.all.interactions.length >= 3 &&
      shown.mine.interactions.length === shown.all.interactions.length,
  };
  await page.keyboard.press("Escape");

  /* ------------------------------------------- the record view, on the routed face */
  reach("theRecordViewShowsIt");
  await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}&ai=stub`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForSelector(HEADING, { timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.click(HEADING, { button: "right" });
  const onPage = await aiSection(page);
  await page.click(`${AI} [data-menu-item="ai-fill"]`);
  await page.waitForSelector(GHOST, { timeout: 10_000 });
  await page.click('[data-testid="ghost-accept"]');
  await page.waitForTimeout(400);
  await page.click('[data-testid="ghost-close"]');
  await page.waitForSelector('[data-testid="record-ai"]', { timeout: 10_000 }).catch(() => undefined);
  const record = await page.evaluate(() => {
    const section = document.querySelector('[data-testid="record-ai"]');
    return section ? [...section.querySelectorAll('[data-testid="activity-interaction"]')].map((one) => ({ outcome: one.getAttribute("data-outcome"), undo: one.querySelector('[data-testid="undo-turn"]') !== null })) : null;
  });
  const pagesActivity = await activitySays(page);
  report.checks.theRecordViewShowsIt = {
    onPage,
    record,
    pagesActivity: { filter: pagesActivity.filter, interactions: pagesActivity.interactions.length },
    ok: onPage.drawn && onPage.rows.includes("ai-fill") && record !== null && record.length === 1 && record[0].outcome === "accepted" && record[0].undo && pagesActivity.filter && pagesActivity.interactions.length === 1,
  };

  /* ------------------------------------------- a panel from the menu, on the face it was asked on (FR-184) */
  reach("aPanelDrawnFromTheMenuOnPagesLandsOnTheDraftPage");
  if (await page.$('[data-testid="activity-panel"], [data-graview-popover]')) await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.click(HEADING, { button: "right" });
  const panelRows = await aiSection(page);
  await page.click(`${AI} [data-menu-item="ai-panel"]`);
  await page.waitForSelector('[data-testid="draft-keep"]', { timeout: 15_000 }).catch(() => undefined);
  const drafted = await page.evaluate(() => ({
    path: location.pathname,
    page: document.querySelector('[data-testid="draft-page"]') !== null,
    keep: document.querySelector('[data-testid="draft-keep"]')?.textContent?.trim() ?? null,
    discard: document.querySelector('[data-testid="draft-discard"]')?.textContent?.trim() ?? null,
    face: document.querySelector("[data-graview-face]")?.getAttribute("data-graview-face") ?? null,
    menu: document.querySelector('[data-testid="context-menu"]') !== null,
    keyboard: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null,
  }));
  report.checks.aPanelDrawnFromTheMenuOnPagesLandsOnTheDraftPage = {
    rows: panelRows.rows,
    drafted,
    ok: panelRows.rows.includes("ai-panel") && drafted.path.endsWith("/~draft") && drafted.page && drafted.keep === "Keep as a lens" && drafted.discard === "Discard" && drafted.face === "pages" && !drafted.menu,
  };
  await context.close();

  /* ------------------------------------------- a host's stored entries */
  reach("aHostsStoredEntriesAreDrawn");
  const hosted = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  await hosted.addInitScript(KEEP_THE_STORE);
  await hosted.addInitScript((stored) => {
    window.__kept = [];
    const decide = async (_state, questions) => ({
      answers: Object.fromEntries(Object.entries(questions).map(([key, question]) => {
        const first = Object.keys(question.criteria)[0];
        return [key, { type: "choice", choice: first, confidence: 0.7, probabilities: { [first]: 0.7 } }];
      })),
      usage: { inputTokens: 100, outputTokens: 0 },
    });
    const off = new URLSearchParams(location.search).get("hostOff") === "1";
    window.__todoAi = { ...(off ? { off: true } : {}), fast: { model: "host-fast", decide }, interactions: { load: async () => [stored], keep: (entry) => window.__kept.push(entry) } };
  }, STORED);
  const host = await hosted.newPage();
  host.on("pageerror", (error) => errors.push(error.message));
  await host.goto(`${at("todo")}/?${DAY}`, { waitUntil: "load", timeout: 90_000 });
  await ready(host);
  await host.click('[data-testid="activity-button"]');
  await host.waitForSelector('[data-interaction="ai-stored-1"]', { timeout: 10_000 }).catch(() => undefined);
  const storedShown = await activitySays(host);
  await host.keyboard.press("Escape");
  await openOn(host, "t-deposit");
  await host.click(`${AI} [data-menu-item="ai-fill"]`);
  await host.waitForSelector(GHOST, { timeout: 10_000 });
  await host.click('[data-testid="ghost-dismiss"]');
  await host.waitForTimeout(300);
  const keptByHost = await host.evaluate(() => window.__kept.map((entry) => ({ id: entry.id, outcome: entry.outcome, usage: entry.usage?.map((one) => `${one.tier}:${one.model}`) })));
  report.checks.aHostsStoredEntriesAreDrawn = {
    stored: storedShown.interactions.find((one) => one.id === "ai-stored-1") ?? null,
    keptByHost,
    ok:
      storedShown.interactions.some((one) => one.id === "ai-stored-1" && one.outcome === "dismissed" && /jev-latest/.test(one.text)) &&
      keptByHost.some((entry) => entry.outcome === "dismissed" && entry.usage?.includes("fast:host-fast")),
  };

  /* ------------------------------------------- the menu is ready before the click (FR-185, FR-186) */
  reach("aRestedOnMenuDrawsCompleteInItsFirstFrame");
  const counting = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  await counting.addInitScript(KEEP_THE_STORE);
  await counting.addInitScript(() => {
    window.__calls = { fast: 0, thinking: 0 };
    const decide = async (_state, questions) => {
      window.__calls.fast += 1;
      return {
        answers: Object.fromEntries(Object.entries(questions).map(([key, question]) => {
          const first = Object.keys(question.criteria)[0];
          return [key, { type: "choice", choice: first, confidence: 0.7, probabilities: { [first]: 0.7 } }];
        })),
        usage: { inputTokens: 100, outputTokens: 0 },
      };
    };
    const think = async ({ catalog }) => {
      window.__calls.thinking += 1;
      return { text: JSON.stringify({ pick: catalog.candidates.slice(0, 2).map((one) => one.id) }), usage: { inputTokens: 100, outputTokens: 10 } };
    };
    const thinkingOnly = new URLSearchParams(location.search).get("thinkingOnly") === "1";
    window.__todoAi = thinkingOnly ? { thinking: { model: "host-thinking", think } } : { fast: { model: "host-fast", decide } };
  });
  const rested = await counting.newPage();
  rested.on("pageerror", (error) => errors.push(error.message));
  await rested.goto(`${at("todo")}/?${DAY}`, { waitUntil: "load", timeout: 90_000 });
  await ready(rested);
  const calls = () => rested.evaluate(() => ({ ...window.__calls }));
  /* A right-click dispatched on a card, and what the menu is one frame later. */
  const firstFrame = (id) =>
    rested.evaluate(async (id) => {
      const card = document.querySelector(`[data-graview-pick="${id}"]`);
      const box = card.getBoundingClientRect();
      card.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
      await new Promise((done) => requestAnimationFrame(() => done()));
      const menu = document.querySelector('[data-testid="context-menu"]');
      const section = menu?.querySelector('[data-menu-section="inline-ai"]');
      return {
        menu: menu !== null,
        acts: menu?.querySelectorAll("[data-affordance]").length ?? 0,
        section: Boolean(section),
        ask: Boolean(section?.querySelector('[data-menu-item="ai-ask"]')),
        offers: section?.querySelectorAll("[data-ai-offer]").length ?? 0,
        thinking: Boolean(section?.querySelector('[data-testid="inline-ai-thinking"]')),
        missing: Boolean(menu?.querySelector('[data-testid="lazy-part-missing"]')),
      };
    }, id);
  // Across the list: the pointer resting a moment on each task asks no model.
  const cards = await rested.evaluate(() => [...document.querySelectorAll('[data-graview-pick^="t-"]')].map((one) => one.getAttribute("data-graview-pick")).filter((id, at, all) => all.indexOf(id) === at).slice(0, 5));
  for (const id of cards) {
    await rested.hover(`[data-graview-pick="${id}"]`);
    await rested.waitForTimeout(250);
  }
  const afterHover = await calls();
  await rested.hover('[data-graview-pick="t-deposit"]');
  await rested.waitForTimeout(500);
  const restedFrame = await firstFrame("t-deposit");
  await aiSection(rested);
  const afterOpen = await calls();
  await putAway(rested);
  report.checks.aRestedOnMenuDrawsCompleteInItsFirstFrame = {
    cards,
    afterHover,
    restedFrame,
    ok: cards.length > 1 && afterHover.fast === 0 && afterHover.thinking === 0 && restedFrame.menu && restedFrame.acts > 0 && restedFrame.section && restedFrame.ask && !restedFrame.missing && afterOpen.fast === 1,
  };

  reach("aReopenedMenuAsksNothingUntilTheRecordChanges");
  const reopened = await firstFrame("t-deposit");
  await rested.waitForTimeout(600);
  const afterReopen = await calls();
  await putAway(rested);
  report.checks.aReopenedMenuAsksNothingUntilTheRecordChanges = {
    reopened,
    afterReopen,
    ok: reopened.menu && reopened.offers > 0 && !reopened.thinking && afterReopen.fast === 1,
  };

  reach("onlyAThinkingSlotAsksWhenSuggestIsPressed");
  await rested.goto(`${at("todo")}/?${DAY}&thinkingOnly=1`, { waitUntil: "load", timeout: 90_000 });
  await ready(rested);
  await rested.click('[data-graview-pick="t-deposit"]', { button: "right" });
  await rested.waitForSelector(`${AI} [data-menu-item="ai-suggest"]`, { timeout: 10_000 }).catch(() => undefined);
  await rested.waitForTimeout(500);
  const openedAndClosed = await calls();
  const suggestRow = (await rested.$(`${AI} [data-menu-item="ai-suggest"]`)) !== null;
  await putAway(rested);
  await rested.click('[data-graview-pick="t-deposit"]', { button: "right" });
  await rested.waitForSelector(`${AI} [data-menu-item="ai-suggest"]`, { timeout: 10_000 }).catch(() => undefined);
  await rested.click(`${AI} [data-menu-item="ai-suggest"]`).catch(() => undefined);
  await rested.waitForSelector(`${AI} [data-ai-offer]`, { timeout: 10_000 }).catch(() => undefined);
  const pressed = await calls();
  const offered = await rested.evaluate(() => document.querySelectorAll('[data-menu-section="inline-ai"] [data-ai-offer]').length);
  await putAway(rested);
  report.checks.onlyAThinkingSlotAsksWhenSuggestIsPressed = {
    openedAndClosed,
    suggestRow,
    pressed,
    offered,
    ok: openedAndClosed.thinking === 0 && openedAndClosed.fast === 0 && suggestRow && pressed.thinking === 1 && offered > 0,
  };
  await counting.close();

  /* ------------------------------------------- the menu's AI section fills in under 400 ms (Roadmap f-inline-ai-framework-finish) */
  reach("theMenusAiSectionFillsInUnder400MsAtP95");
  /*
   * A Fast slot as slow as a real one: each decision answered after 100 to
   * 250 ms, at random. Each open is on a task whose suggestion is not kept
   * yet (the page is loaded again once every task has been asked about), the
   * pointer resting on it first as a person's does before a right-click, and
   * the time is from the right-click to the section's suggestions drawn.
   */
  const timed = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  await timed.addInitScript(KEEP_THE_STORE);
  await timed.addInitScript(() => {
    const params = new URLSearchParams(location.search);
    window.__calls = { fast: 0, thinking: 0 };
    const sure = Number(params.get("sure") ?? "0.9");
    const decide = async (_state, questions) => {
      window.__calls.fast += 1;
      await new Promise((done) => setTimeout(done, 100 + Math.random() * 150));
      return {
        answers: Object.fromEntries(Object.entries(questions).map(([key, question]) => {
          const names = Object.keys(question.criteria);
          return [key, { type: "choice", choice: names[0], confidence: sure, probabilities: Object.fromEntries(names.map((name, at) => [name, at === 0 ? sure : 0.02])) }];
        })),
        usage: { inputTokens: 100, outputTokens: 0 },
      };
    };
    window.__todoAi = { fast: { model: "host-fast", decide }, ...(params.get("chips") === "1" ? { hoverChips: true } : {}), ...(params.get("off") === "1" ? { off: true } : {}) };
  });
  const clock = await timed.newPage();
  clock.on("pageerror", (error) => errors.push(error.message));
  const OPENS = 20;
  const samples = [];
  let loads = 0;
  while (samples.length < OPENS && loads < 8) {
    loads += 1;
    await clock.goto(`${at("todo")}/?${DAY}`, { waitUntil: "load", timeout: 90_000 });
    await ready(clock);
    const tasks = await clock.evaluate(() => [...new Set([...document.querySelectorAll('[data-graview-pick^="t-"]')].map((one) => one.getAttribute("data-graview-pick")))]);
    for (const id of tasks) {
      if (samples.length >= OPENS) break;
      const sample = await clock.evaluate(async (id) => {
        const card = document.querySelector(`[data-graview-pick="${id}"]`);
        if (!card) return null;
        const box = card.getBoundingClientRect();
        const at = { clientX: box.left + box.width / 2, clientY: box.top + Math.min(box.height / 2, 20) };
        const before = window.__calls.fast;
        // The pointer comes to rest on the card, as before any right-click.
        card.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse", ...at }));
        await new Promise((done) => setTimeout(done, 200));
        const start = performance.now();
        card.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, ...at }));
        const drawn = await new Promise((done) => {
          const look = () => {
            const section = document.querySelector('[data-testid="context-menu"] [data-menu-section="inline-ai"]');
            if (section?.querySelector("[data-ai-offer]")) return done(performance.now() - start);
            if (performance.now() - start > 5000) return done(null);
            requestAnimationFrame(look);
          };
          look();
        });
        const asked = window.__calls.fast - before;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        card.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: document.body }));
        await new Promise((done) => setTimeout(done, 150));
        return { id, ms: drawn === null ? null : Math.round(drawn), asked };
      }, id);
      // Only an open that asked the model is a measure of filling in; one already kept is drawn in its first frame.
      if (sample && sample.asked > 0) samples.push(sample);
    }
  }
  const times = samples.map((one) => (one.ms === null ? Infinity : one.ms)).sort((a, b) => a - b);
  const p95 = times.length > 0 ? times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)] : null;
  report.checks.theMenusAiSectionFillsInUnder400MsAtP95 = {
    opens: samples.length,
    fastLatencyMs: "100–250",
    p50: times[Math.floor(times.length / 2)] ?? null,
    p95: p95 === Infinity ? "never drawn" : p95,
    slowest: samples.slice().sort((a, b) => (b.ms ?? Infinity) - (a.ms ?? Infinity)).slice(0, 3),
    ok: samples.length >= OPENS && p95 !== null && p95 < 400,
  };

  /* ------------------------------------------- one quiet hover chip */
  reach("aHoverChipIsAtMostOneAndNeverOnAPassOver");
  const chipsSaid = () => clock.evaluate(() => ({ chips: document.querySelectorAll('[data-testid="hover-chip"]').length, fast: window.__calls.fast, label: document.querySelector('[data-testid="hover-chip"]')?.getAttribute("aria-label") ?? null }));
  await clock.goto(`${at("todo")}/?${DAY}&chips=1`, { waitUntil: "load", timeout: 90_000 });
  await ready(clock);
  const passing = await clock.evaluate(() => [...new Set([...document.querySelectorAll('[data-graview-pick^="t-"]')].map((one) => one.getAttribute("data-graview-pick")))].slice(0, 6));
  // Across the tasks without stopping: each passed over in a few milliseconds, then the pointer away from them all.
  for (const id of passing) {
    const box = await clock.locator(`[data-graview-pick="${id}"]`).first().boundingBox();
    if (box) await clock.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 16), { steps: 2 });
  }
  await clock.mouse.move(4, 470, { steps: 2 });
  await clock.waitForTimeout(700);
  const passedOver = await chipsSaid();
  // Resting on one, then on another: one chip, moved.
  await clock.hover('[data-graview-pick="t-deposit"]');
  await clock.waitForTimeout(900);
  const restedOnOne = await chipsSaid();
  const other = passing.find((id) => id !== "t-deposit");
  if (other) await clock.hover(`[data-graview-pick="${other}"]`);
  await clock.waitForTimeout(900);
  const restedOnAnother = await chipsSaid();
  const mostAtOnce = await clock.evaluate(async () => {
    let most = 0;
    for (let frame = 0; frame < 30; frame += 1) {
      most = Math.max(most, document.querySelectorAll('[data-testid="hover-chip"]').length);
      await new Promise((done) => requestAnimationFrame(done));
    }
    return most;
  });
  await clock.mouse.move(4, 470);
  await clock.waitForTimeout(700);
  const leftIt = await chipsSaid();
  report.checks.aHoverChipIsAtMostOneAndNeverOnAPassOver = {
    passing,
    passedOver,
    restedOnOne,
    restedOnAnother,
    mostAtOnce,
    leftIt,
    ok: passing.length > 2 && passedOver.fast === 0 && passedOver.chips === 0 && restedOnOne.chips === 1 && restedOnOne.fast === 1 && restedOnAnother.chips === 1 && mostAtOnce === 1 && leftIt.chips === 0,
  };

  reach("aHoverChipVanishesWithAiOff");
  await clock.goto(`${at("todo")}/?${DAY}&chips=1&off=1`, { waitUntil: "load", timeout: 90_000 });
  await ready(clock);
  await clock.hover('[data-graview-pick="t-deposit"]');
  await clock.waitForTimeout(900);
  const offChips = await chipsSaid();
  // And off unless the host asks for chips: the same rest, a Fast slot, no chip and no call.
  await clock.goto(`${at("todo")}/?${DAY}`, { waitUntil: "load", timeout: 90_000 });
  await ready(clock);
  await clock.hover('[data-graview-pick="t-deposit"]');
  await clock.waitForTimeout(900);
  const unasked = await chipsSaid();
  report.checks.aHoverChipVanishesWithAiOff = {
    offChips,
    unasked,
    ok: offChips.chips === 0 && offChips.fast === 0 && unasked.chips === 0 && unasked.fast === 0,
  };
  await timed.close();

  /* ------------------------------------------- AI off: no AI part, on either face */
  reach("aiOffHidesEveryAiPartOnBothFaces");
  await host.goto(`${at("todo")}/?${DAY}&hostOff=1`, { waitUntil: "load", timeout: 90_000 });
  await ready(host);
  await host.click('[data-graview-pick="t-deposit"]', { button: "right" });
  await host.waitForSelector(MENU, { timeout: 10_000 });
  await host.waitForTimeout(400);
  const sceneOff = await host.evaluate(() => ({ section: document.querySelector('[data-menu-section="inline-ai"]') !== null, seat: document.querySelector('[data-graview-quick-ask], [data-testid="seat-field"]') !== null }));
  await putAway(host);
  await host.click('[data-testid="activity-button"]').catch(() => undefined);
  await host.waitForTimeout(400);
  const activityOff = await host.evaluate(() => ({ filter: document.querySelector('[data-testid="activity-filter"]') !== null, interactions: document.querySelectorAll('[data-testid="activity-interaction"]').length }));
  await host.keyboard.press("Escape");
  await host.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}&hostOff=1`, { waitUntil: "load", timeout: 90_000 });
  await host.waitForSelector(HEADING, { timeout: 60_000 });
  await host.waitForTimeout(500);
  await host.click(HEADING, { button: "right" });
  await host.waitForSelector(MENU, { timeout: 10_000 });
  await host.waitForTimeout(400);
  const pagesOff = await host.evaluate(() => ({
    section: document.querySelector('[data-menu-section="inline-ai"]') !== null,
    seat: document.querySelector('[data-graview-quick-ask], [data-testid="seat-field"]') !== null,
    record: document.querySelector('[data-testid="record-ai"]') !== null,
  }));
  await host.keyboard.press("Escape");
  report.checks.aiOffHidesEveryAiPartOnBothFaces = {
    sceneOff,
    activityOff,
    pagesOff,
    ok: !sceneOff.section && !sceneOff.seat && !activityOff.filter && activityOff.interactions === 0 && !pagesOff.section && !pagesOff.seat && !pagesOff.record,
  };
  await hosted.close();

  reach.done();
  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  reach.done();
  if (!report.checks[reach.at()]) report.checks[reach.at()] = { ok: false, stopped: String(error) };
  report.stoppedAt = reach.at();
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
}

writeFileSync(VERDICT, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/inline-ai.json\n`);
process.exit(report.passed ? 0 : 1);
