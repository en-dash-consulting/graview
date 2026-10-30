#!/usr/bin/env node
/**
 * THE QUICK ASK, IN PLACE OF THE ASK BOX (Roadmap f-quick-ask-framework) —
 * driven in a real browser against the todo app, whose dev build fills the
 * host's Fast and Thinking slots with stubs at `?ai=stub` and is a host that
 * turned AI off at `?ai=off`.
 *
 * No face draws the Ask box. ⌘K opens a command bar beside what is
 * selected — a task's card on the scene, the task's page on Pages — that
 * completes the acts on it, "Show …" (a panel drawn, which "Keep as a lens"
 * keeps), its places and its records. Words that complete nothing are
 * asked, and the answer is a card beside the record: its words, the change
 * it proposes waiting as a ghost until it is accepted as one batch with its
 * undo, and a follow-up on the card that replaces the answer rather than
 * threading it. The context menu's "Ask about this…" opens it too, Escape
 * puts it away with the keyboard back where it was, Activity keeps each
 * ask once, and with AI off none of it is drawn and ⌘K is Find's.
 *
 *   node scripts/verify-quick-ask.mjs [--engine=chromium|webkit|firefox]   (all three by default)
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ENGINES;
const VERDICT = resolve(repoRoot, "docs/quick-ask.json");

const report = { at: new Date().toISOString(), engines, checks: {}, byEngine: {} };
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

const CARD = '[data-testid="quick-ask"]';
const FIELD = '[data-testid="quick-ask-input"]';
const ANSWER = '[data-testid="quick-answer-text"]';
const GHOST = '[data-testid="ai-ghost"]';
const DAY = "today=2026-09-01";
const ASK_BOX = '[data-testid="seat-field"], [data-testid="seat"], [data-testid="page-seat"]';

/* The store itself, handed to the watch as it opens (as verify-inline-ai keeps it). */
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
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(700);
};

/** What the card says, or null when there is none. */
const cardSays = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('[data-testid="quick-ask"]');
    if (!card) return null;
    return {
      mode: card.getAttribute("data-quick-ask"),
      beside: card.getAttribute("data-quick-ask-beside"),
      side: card.getAttribute("data-quick-ask-side"),
      about: card.querySelector('[data-testid="quick-ask-about"]')?.textContent?.trim() ?? null,
      label: card.getAttribute("aria-label"),
      rows: [...card.querySelectorAll('[data-testid="quick-ask-option"]')].map((row) => ({ kind: row.getAttribute("data-quick-ask-kind"), text: (row.textContent ?? "").trim() })),
      asked: card.querySelector('[data-testid="quick-answer-asked"]')?.textContent?.trim() ?? null,
      answer: card.querySelector('[data-testid="quick-answer-text"]')?.textContent?.trim() ?? null,
      answers: card.querySelectorAll('[data-testid="quick-answer-text"]').length,
      offers: [...card.querySelectorAll('[data-testid="quick-answer-offer"]')].map((one) => one.getAttribute("data-ai-offer-type")),
      ghostOnTheCard: card.querySelector('[data-testid="ai-ghost"]') !== null,
      keyboard: document.activeElement?.getAttribute("data-testid") ?? null,
      // Beside, not on: the card does not stand over the record it is about.
      overIt: (() => {
        const beside = card.getAttribute("data-quick-ask-beside");
        const anchor = beside && beside !== "page" ? document.querySelector(`[data-graview-view="${CSS.escape(beside)}"], [data-graview-pick="${CSS.escape(beside)}"]`) : null;
        if (!anchor) return false;
        const a = anchor.getBoundingClientRect();
        const b = card.getBoundingClientRect();
        return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
      })(),
      inTheWindow: (() => {
        const b = card.getBoundingClientRect();
        return b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
      })(),
    };
  });

const type = async (page, words) => {
  await page.fill(FIELD, words);
  await page.waitForTimeout(250);
};

const answered = async (page) => {
  await page.waitForFunction(() => /as drafted|AI isn't on|could not/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? ""), undefined, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
};

/** What the store says about a task, and the lineage of the last batch. */
const storeSays = (page, id) =>
  page.evaluate((id) => {
    const store = window.__aiStores.find((one) => one.schema.kinds.includes("task"));
    const node = store.graph.getNode(id);
    const batch = store.batches().at(-1)?.id ?? null;
    const ops = store.log.all().filter((op) => op.batch === batch);
    return { done: node?.done === true, batch, via: ops[0]?.via ?? null, interaction: ops[0]?.lineage?.interaction ?? null };
  }, id);

const openTheBar = async (page) => {
  await page.keyboard.press("ControlOrMeta+K");
  await page.waitForSelector(CARD, { timeout: 30_000 });
  await page.waitForTimeout(300);
};

/** One engine's run: each claim into `checks`, each page error into `errors`. */
async function drive(engine, checks, errors) {
  browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
  const context = await browser.newContext({ viewport: { width: 1560, height: 940 } });
  await context.addInitScript(KEEP_THE_STORE);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${at("todo")}/?${DAY}&ai=stub`, { waitUntil: "load", timeout: 90_000 });
  await ready(page);

  /* ------------------------------------------- no Ask box on the scene */
  reach("noAskBoxOnTheScene");
  const sceneBox = await page.evaluate((selector) => ({ askBox: document.querySelector(selector) !== null, marker: document.querySelector("[data-graview-quick-ask]")?.getAttribute("data-graview-quick-ask") ?? null }), ASK_BOX);
  checks.noAskBoxOnTheScene = { ...sceneBox, ok: !sceneBox.askBox && sceneBox.marker === "scene" };

  /* ------------------------------------------- ⌘K beside the selection */
  reach("theBarOpensBesideTheSelection");
  await page.click('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(900);
  await openTheBar(page);
  const bar = await cardSays(page);
  checks.theBarOpensBesideTheSelection = {
    bar,
    ok: bar !== null && bar.mode === "bar" && (bar.about ?? "").includes("deposit") && bar.beside === "t-deposit" && !bar.overIt && bar.inTheWindow && bar.keyboard === "quick-ask-input" && bar.rows.some((row) => row.kind === "act") && bar.rows.some((row) => row.kind === "show"),
  };

  /* ------------------------------------------- it completes acts, places, records and "Show …" */
  reach("itCompletesActsPlacesRecordsAndShow");
  await type(page, "show");
  const shows = await cardSays(page);
  await type(page, "week");
  const places = await cardSays(page);
  await type(page, "van");
  const records = await cardSays(page);
  await type(page, "what is left to do here?");
  const asking = await cardSays(page);
  checks.itCompletesActsPlacesRecordsAndShow = {
    shows: shows?.rows,
    places: places?.rows,
    records: records?.rows,
    asking: asking?.rows,
    ok:
      (shows?.rows ?? []).length > 0 && shows.rows.filter((row) => row.kind !== "ask").every((row) => row.kind === "show" && row.text.startsWith("Show ")) &&
      (places?.rows ?? []).some((row) => row.kind === "place" && /week/i.test(row.text)) &&
      (records?.rows ?? []).some((row) => row.kind === "record" && /van/i.test(row.text)) &&
      // Words that complete nothing are asked, and the Ask row is the last.
      (asking?.rows ?? []).at(-1)?.kind === "ask",
  };

  /* ------------------------------------------- the answer is a card beside the record, its change a ghost */
  reach("anAnswerIsACardBesideTheRecordItsChangeAGhost");
  const before = await storeSays(page, "t-deposit");
  await page.press(FIELD, "Enter");
  await answered(page);
  const card = await cardSays(page);
  await page.waitForSelector(GHOST, { timeout: 10_000 }).catch(() => undefined);
  const ghostShown = await page.$(GHOST);
  const notMade = await storeSays(page, "t-deposit");
  let accepted = null;
  let undone = null;
  if (ghostShown) {
    await page.click('[data-testid="ghost-accept"]');
    await page.waitForTimeout(400);
    accepted = await storeSays(page, "t-deposit");
    await page.click('[data-testid="ghost-undo"]').catch(() => undefined);
    await page.waitForTimeout(400);
    undone = await storeSays(page, "t-deposit");
  }
  checks.anAnswerIsACardBesideTheRecordItsChangeAGhost = {
    card,
    before,
    notMade,
    accepted,
    undone,
    ok:
      card !== null && card.mode === "answer" && card.beside === "t-deposit" && !card.overIt && /as drafted/.test(card.answer ?? "") && card.ghostOnTheCard &&
      ghostShown !== null && notMade.batch === before.batch &&
      accepted !== null && accepted.batch !== before.batch && (accepted.via ?? "").startsWith("ai:") && accepted.interaction !== null &&
      undone !== null && undone.done === before.done,
  };

  /* ------------------------------------------- a follow-up replaces the answer */
  reach("aFollowUpOnTheCardReplacesTheAnswer");
  await page.click(FIELD);
  await type(page, "and after that?");
  await page.press(FIELD, "Enter");
  await page.waitForFunction(() => document.querySelector('[data-testid="quick-answer-asked"]')?.textContent?.includes("and after that?") && /as drafted/.test(document.querySelector('[data-testid="quick-answer-text"]')?.textContent ?? ""), undefined, { timeout: 15_000 }).catch(() => undefined);
  const followed = await cardSays(page);
  checks.aFollowUpOnTheCardReplacesTheAnswer = {
    followed,
    ok: followed !== null && (followed.asked ?? "").includes("and after that?") && followed.answers === 1 && /“and after that\?”/.test(followed.answer ?? "") && followed.keyboard === "quick-ask-input",
  };

  /* ------------------------------------------- Escape puts it away, the keyboard back */
  reach("escapePutsItAwayWithTheKeyboardBack");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const away = await page.evaluate(() => ({ card: document.querySelector('[data-testid="quick-ask"]') !== null, keyboard: document.activeElement === document.body ? "body" : (document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null) }));
  checks.escapePutsItAwayWithTheKeyboardBack = { away, ok: !away.card && away.keyboard !== "body" && away.keyboard !== null };

  /* ------------------------------------------- Activity keeps each ask, once */
  reach("activityKeepsEachAskOnce");
  await page.click('[data-testid="activity-button"]');
  await page.waitForSelector('[data-testid="activity"]', { timeout: 10_000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="activity-interaction"]')].filter((one) => /answer “|told Graview “/.test(one.textContent ?? "")).length >= 2, undefined, { timeout: 10_000 }).catch(() => undefined);
  const asks = await page.evaluate(() => [...document.querySelectorAll('[data-testid="activity-interaction"]')].map((one) => (one.textContent ?? "").replace(/\s+/g, " ").trim()).filter((text) => /answer “|told Graview “/.test(text)));
  checks.activityKeepsEachAskOnce = { asks, ok: asks.length === 2 && asks.some((text) => text.includes("what is left to do here?")) && asks.some((text) => text.includes("and after that?")) };
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  /* ------------------------------------------- "Show …" draws a panel, kept as a lens */
  reach("aShowRowDrawsAPanelKeptAsALens");
  await page.click('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(600);
  await openTheBar(page);
  await type(page, "show");
  await page.press(FIELD, "Enter");
  await page.waitForSelector('[data-testid="draft-keep"]', { timeout: 15_000 }).catch(() => undefined);
  const drawn = await page.evaluate(() => ({ keep: document.querySelector('[data-testid="draft-keep"]') !== null, card: document.querySelector('[data-testid="quick-ask"]') !== null }));
  let kept = false;
  if (drawn.keep) {
    await page.click('[data-testid="draft-keep"]');
    await page.waitForTimeout(800);
    kept = await page.evaluate(() => document.querySelector('[data-testid="draft-keep"]') === null);
  }
  checks.aShowRowDrawsAPanelKeptAsALens = { drawn, kept, ok: drawn.keep && !drawn.card && kept };

  /* ------------------------------------------- the menu's "Tell Graview…" */
  reach("theMenuOpensItOnWhatItWasOpenedOn");
  await page.goto(`${at("todo")}/?${DAY}&ai=stub`, { waitUntil: "load", timeout: 90_000 });
  await ready(page);
  await page.click('[data-graview-pick="t-book"]', { button: "right" });
  await page.waitForSelector('[data-menu-item="ai-ask"]', { timeout: 15_000 });
  await page.click('[data-menu-item="ai-ask"]');
  await page.waitForSelector(CARD, { timeout: 15_000 });
  await page.waitForTimeout(400);
  const fromTheMenu = await cardSays(page);
  checks.theMenuOpensItOnWhatItWasOpenedOn = { fromTheMenu, ok: fromTheMenu !== null && /van/i.test(fromTheMenu.about ?? "") && fromTheMenu.keyboard === "quick-ask-input" };
  await page.keyboard.press("Escape");
  await page.close();

  /* ------------------------------------------- on Pages: beside the page's heading */
  reach("onPagesTheCardStandsByTheRecordsHeading");
  const pages = await context.newPage();
  pages.on("pageerror", (error) => errors.push(error.message));
  await pages.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}&ai=stub`, { waitUntil: "load", timeout: 90_000 });
  await pages.waitForSelector("main :is([data-graview-page-title], h1, h2)", { timeout: 60_000 });
  await pages.waitForTimeout(700);
  const pagesBox = await pages.evaluate((selector) => ({ askBox: document.querySelector(selector) !== null, marker: document.querySelector("[data-graview-quick-ask]")?.getAttribute("data-graview-quick-ask") ?? null }), ASK_BOX);
  await openTheBar(pages);
  const pagesBar = await cardSays(pages);
  await type(pages, "what is left to do here?");
  await pages.press(FIELD, "Enter");
  await answered(pages);
  const pagesAnswer = await cardSays(pages);
  checks.onPagesTheCardStandsByTheRecordsHeading = {
    pagesBox,
    pagesBar,
    pagesAnswer,
    ok: !pagesBox.askBox && pagesBox.marker === "pages" && pagesBar !== null && (pagesBar.about ?? "").includes("deposit") && pagesBar.beside === "page" && pagesBar.inTheWindow && pagesAnswer?.mode === "answer" && /as drafted/.test(pagesAnswer?.answer ?? ""),
  };
  await pages.keyboard.press("Escape");
  await pages.close();

  /* ------------------------------------------- AI off: nothing of it, ⌘K is Find's */
  reach("aiOffHidesTheQuickAskCleanly");
  const off = {};
  for (const [face, path] of [["scene", "/"], ["pages", "/pages/tasks/t-deposit"]]) {
    const one = await context.newPage();
    one.on("pageerror", (error) => errors.push(error.message));
    await one.goto(`${at("todo")}${path}?${DAY}&ai=off`, { waitUntil: "load", timeout: 90_000 });
    await one.waitForTimeout(1500);
    await one.keyboard.press("ControlOrMeta+K");
    await one.waitForTimeout(500);
    off[face] = await one.evaluate((selector) => ({
      marker: document.querySelector("[data-graview-quick-ask]") !== null,
      card: document.querySelector('[data-testid="quick-ask"]') !== null,
      askBox: document.querySelector(selector) !== null,
      menuRow: document.querySelector('[data-menu-item="ai-ask"]') !== null,
      find: ["find-box", "nav-find"].includes(document.activeElement?.getAttribute("data-testid") ?? ""),
    }), ASK_BOX);
    await one.close();
  }
  checks.aiOffHidesTheQuickAskCleanly = { off, ok: Object.values(off).every((one) => !one.marker && !one.card && !one.askBox && !one.menuRow && one.find) };

  await browser.close();
  browser = undefined;
}

try {
  const errors = [];
  for (const engine of engines) {
    const checks = (report.byEngine[engine] = {});
    reach(`${engine}: starting`);
    await drive(engine, checks, errors);
    for (const [name, check] of Object.entries(checks)) {
      const all = (report.checks[name] ??= { engines: {}, ok: true });
      all.engines[engine] = check.ok;
      all.ok = all.ok && check.ok;
    }
  }
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
process.stdout.write(`${JSON.stringify(Object.fromEntries(Object.entries(report.checks).map(([name, check]) => [name, check.ok])), null, 1)}\n${report.error ? `\n${report.error}` : ""}\n\nwrote docs/quick-ask.json\n`);
process.exit(report.passed ? 0 : 1);
