#!/usr/bin/env node
/**
 * THE SEAT IS A GUIDE, NOT A CONTROL PANEL — held to its claims in a real
 * browser, on both faces.
 *
 * It was a rail down the scene's left edge (and on Pages a drawer behind a
 * "◆ Ask" pill): an eyebrow over the selected thing, nine acts with nine
 * stars, a filter field, "Show 1 more", three canned questions, the
 * relations, a log and the key to the lines, in the mutations' own words.
 * Now it is one quiet field at the picture's foot, "Ask Things…", that grows
 * into a panel over the page when asked. This drives it on the scene and on
 * Pages, at a desk's width and a phone's, light and dark, and asks:
 *
 *   noMachineWordsInTheSeat      closed and open, nothing chosen and a record
 *                                chosen: no mutation name, no kebab- or
 *                                camelCase token, no "seat", no uppercase
 *                                eyebrow, no "tidy · listening", no ☆★, no
 *                                filter field, no "Show N more"
 *   atMostThreeActs              unprompted: at most three acts and three
 *                                suggestions
 *   thePageDoesNotMove           opening it shifts nothing: no layout shift
 *                                (where the engine reports one), the same
 *                                boxes, no padding put on anything
 *   everyPartIsReachable         a region named "Ask Things"; every button
 *                                and link in it is reached from the field by
 *                                the keyboard; the latest answer is in a
 *                                polite live region; axe finds nothing
 *                                serious in it
 *   escapeReturnsFocus           Escape closes it and the keyboard is where
 *                                it was, never on the body
 *   theConversationSurvivesTheFaceSwitch
 *                                asked on the scene, the same turns on Pages —
 *                                the whole-page faces and an embed switching
 *                                face in place
 *   findAsks                     Find's last row "Ask: ‘…’" opens the seat
 *                                with that question asked
 *   theActsKeyOpensTheMenu       A on a card opens its acts at the card with
 *                                the keyboard in them; Escape goes back
 *   theFieldStaysClearOfCards    no card of the scene stands under the field
 *   noChoiceOfWhatAnswers        open, closed and in the person's menu: no ⚙,
 *                                no source line, no picker, and no rung's
 *                                name ("graph-native", "Onboard AI", "Jev"…)
 *                                anywhere a reader can see or hear it
 *   withoutAiAnOpenQuestionIsToldSo
 *                                with no model given, an open question is
 *                                answered "…Open questions need AI, which
 *                                isn't on here." and carries no AI note
 *
 *   node scripts/verify-seat-guide.mjs [--engine=chromium|webkit|firefox] [--quick]
 *
 * Every engine in turn unless one is named; `--quick` is Chromium alone, a
 * desk in the light and a phone in the dark.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
/* Three engines, one after the other; quick, Chromium alone; `--engine=` names one. */
const RUN = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const report = { at: new Date().toISOString(), engines: RUN, quick: QUICK, checks: {}, pageErrors: [] };
let ENGINE_NOW = RUN[0];

const SIZES = { desk: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
/* Quick: a desk in the light and a phone in the dark; otherwise both sizes in both schemes. */
const COMBOS = QUICK
  ? [["desk", "light"], ["phone", "dark"]]
  : [["desk", "light"], ["desk", "dark"], ["phone", "light"], ["phone", "dark"]];
const DAY = "today=2026-09-01";

/** Each claim gathers its cases; a claim holds when every case does. */
const cases = {};
const note = (claim, one) => (cases[claim] ??= []).push({ engine: ENGINE_NOW, ...one });

/* What offered a choice of what answers, and the words it offered: none of it is ever shown now. */
const RUNG_WORDS = "graph-native|Graph only|Onboard AI|\\bJev\\b|\\bLLM\\b|on this device|with my key|What answers|Answers come from|Answering now";
const CHOOSERS = ["seat-settings", "seat-source", "seat-ladder", "setting-intelligence", "seat-offer-model"];
/** An open question with no model: said plainly, or — on a dev server holding no key — with how to turn one on. */
const NO_AI = /I can answer about what's in this app\. Open questions need AI(?:, which isn't on here\.|\. Set ANTHROPIC_API_KEY when you start the dev server to turn it on\.)/;

/** Whatever on the page offers a choice of what answers, and any rung's name it shows or says. */
const choosers = (page) =>
  page.evaluate(
    ({ words, ids }) => {
      const said = `${document.body.innerText} ${[...document.querySelectorAll("[aria-label],[title]")].map((el) => `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`).join(" ")}`;
      return { controls: ids.filter((id) => document.querySelector(`[data-testid="${id}"]`) !== null), words: [...new Set(said.match(new RegExp(words, "g")) ?? [])] };
    },
    { words: RUNG_WORDS, ids: CHOOSERS },
  );

const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");

/* ------------------------------------------------------------- the host page */

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Things, on a host's page</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}header,footer{padding:8px 16px}#app{position:relative;height:calc(100vh - 80px)}</style></head>
<body><header><a href="/apps">Your apps</a></header><main><h1 style="position:absolute;left:-9999px">Things</h1><div id="app"></div></main><footer>Hosted elsewhere</footer>
<script type="module" src="/entry.js"></script></body></html>`;

/** The embed over the todo app, as a host's bundler builds it, so a face can be switched in place. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-seat-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { todoApp } from ${JSON.stringify(resolve(repoRoot, "apps/todo/src/index.ts"))};
        import seed from ${JSON.stringify(resolve(repoRoot, "apps/todo/src/data/example.json"))};
        window.__handle = mount(document.getElementById("app"), {
          app: todoApp, seed, face: "graview",
          principal: { kind: "human", id: "user-nora", roles: ["keeper"] },
          label: "Things", heading: false, height: "100%", fonts: false, studio: false,
        });
        window.__handle.drawn().then(() => { window.__ready = true; });`,
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
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = join(out, path);
    if (!file.startsWith(out) || !existsSync(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
    response.end(readFileSync(file));
  });
  await new Promise((ready) => host.listen(portFor("seat-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/* ------------------------------------------------------------------ helpers */

const SEAT = '[data-testid="seat"]';
const FIELD = '[data-testid="seat-field"]';

/** Opens a face of todo and waits for its seat's field. */
async function visit(page, path) {
  await page.goto(`${at("todo")}${path}`, { waitUntil: "load" });
  if (!path.startsWith("/pages")) await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForSelector(FIELD, { timeout: 60_000 });
  await page.waitForTimeout(path.startsWith("/pages") ? 1200 : 1600);
}

async function openTheSeat(page) {
  await page.click(FIELD);
  await page.waitForSelector('[data-testid="seat-panel"]', { timeout: 30_000 });
  await page.waitForTimeout(700);
}

/** What a person reads in the seat, and what in it would be a machine's word. */
const machineWords = (page) =>
  page.evaluate(() => {
    const seat = document.querySelector('[data-testid="seat"]');
    if (!seat) return { found: false };
    const field = seat.querySelector('[data-testid="seat-field"]');
    const text = `${seat.innerText}\n${field?.getAttribute("placeholder") ?? ""}\n${seat.getAttribute("aria-label") ?? ""}`;
    const words = [];
    for (const match of text.matchAll(/\b[a-z]+(?:-[a-z]+)+\b/g)) words.push(match[0]);
    for (const match of text.matchAll(/\b[a-z]+[A-Z][A-Za-z]*\b/g)) words.push(match[0]);
    if (/\bseat\b/i.test(text)) words.push("seat");
    if (/\btidy\b|\blistening\b/i.test(text)) words.push("tidy/listening");
    if (/[☆★]/.test(text)) words.push("☆★");
    if (/\bfilter\b/i.test(text)) words.push("filter");
    if (/show \d+ more/i.test(text)) words.push("show N more");
    const eyebrows = [...seat.querySelectorAll("*")]
      .filter((el) => el.childElementCount === 0 && (el.textContent ?? "").trim() && el.getClientRects().length > 0 && getComputedStyle(el).textTransform === "uppercase")
      .map((el) => (el.textContent ?? "").trim().slice(0, 40));
    return { found: true, words, eyebrows, text: text.replace(/\s+/g, " ").slice(0, 300) };
  });

const counts = (page) =>
  page.evaluate(() => ({
    acts: document.querySelectorAll('[data-testid="seat"] [data-testid="seat-act"]').length,
    suggestions: document.querySelectorAll('[data-testid="seat"] [data-testid="seat-suggestion"]').length,
    stars: document.querySelectorAll('[data-testid="seat"] [data-testid="pin-toggle"]').length,
  }));

/** The boxes that must not move when the seat opens, and every inline padding on the page. */
const steadyMarks = (page) =>
  page.evaluate(() => {
    const boxes = [...document.querySelectorAll('[data-graview-view], [data-graview-page-title], main h1, main h2, [data-embed-content] h2')]
      .filter((el) => !el.closest('[data-testid="seat"]'))
      .slice(0, 60)
      .map((el) => {
        const box = el.getBoundingClientRect();
        return `${el.getAttribute("data-graview-view") ?? el.tagName}@${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)}x${Math.round(box.height)}`;
      });
    const padded = [...document.querySelectorAll("[style]")]
      .filter((el) => !el.closest('[data-testid="seat"]') && /padding/.test(el.getAttribute("style") ?? ""))
      .map((el) => `${el.tagName}:${el.style.padding}|${el.style.paddingBottom}|${el.style.paddingLeft}`);
    return { boxes, padded };
  });

/** Starts summing layout shifts, where the engine reports them. */
const watchShifts = (page) =>
  page.evaluate(() => {
    window.__shift = null;
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) return false;
      window.__shift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value;
      }).observe({ type: "layout-shift", buffered: false });
      return true;
    } catch {
      return false;
    }
  });

/** Every control in the open seat, and which of them the keyboard reaches from the field. */
async function keyboardReach(page) {
  const wanted = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="seat"] button:not([disabled]), [data-testid="seat"] a[href], [data-testid="seat"] input, [data-testid="seat"] [tabindex="0"]')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el, at) => {
        el.setAttribute("data-reach", String(at));
        return String(at);
      }),
  );
  const reached = new Set();
  for (const key of ["Shift+Tab", "Tab"]) {
    await page.focus(FIELD);
    for (let press = 0; press < 40; press++) {
      const here = await page.evaluate(() => document.activeElement?.getAttribute("data-reach"));
      if (here !== null && here !== undefined) reached.add(here);
      await page.keyboard.press(key);
      const inside = await page.evaluate(() => document.activeElement?.closest('[data-testid="seat"]') !== null);
      if (!inside) break;
    }
  }
  return { controls: wanted.length, reached: reached.size, missed: wanted.filter((one) => !reached.has(one)) };
}

const turnsOf = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')].map((li) => (li.textContent ?? "").trim().slice(0, 60)));

async function ask(page, words) {
  await page.fill(FIELD, words);
  await page.press(FIELD, "Enter");
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="seat-panel"] ol > li').length >= 2, undefined, { timeout: 20_000 });
  await page.waitForTimeout(500);
}

/* --------------------------------------------------------------------- run */

let browser;
let vite;
let host;
try {
  vite = await serving("todo", portFor("todo"), repoRoot);
  host = await buildHost().catch((error) => {
    report.hostError = String(error).split("\n")[0].slice(0, 200);
    return null;
  });
  for (const engine of RUN) {
  ENGINE_NOW = engine;
  browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });

  for (const [size, scheme] of COMBOS) {
    const context = await browser.newContext({ viewport: SIZES[size], colorScheme: scheme });
    const where = `${size} ${scheme}`;
    for (const face of ["scene", "pages"]) {
      for (const chosen of [false, true]) {
        const page = await context.newPage();
        page.on("pageerror", (error) => report.pageErrors.push(`${ENGINE_NOW} ${where} ${face}: ${String(error).slice(0, 200)}`));
        try {
        const path = face === "scene" ? `/?${DAY}&fresh=1` : chosen ? `/pages/tasks/t-deposit?${DAY}&fresh=1` : `/pages/?${DAY}&fresh=1`;
        await visit(page, path);
        if (face === "scene" && chosen) {
          await page.click('[data-graview-pick="t-deposit"]').catch(() => {});
          await page.waitForTimeout(600);
        }
        const label = `${where} ${face}${chosen ? " t-deposit" : ""}`;
        const closed = await machineWords(page);
        note("noMachineWordsInTheSeat", { at: `${label} closed`, ...closed, ok: closed.found && closed.words.length === 0 && closed.eyebrows.length === 0 });

        /* The field stays clear of the scene's cards. */
        if (face === "scene") {
          const clear = await page.evaluate(() => {
            const field = document.querySelector('[data-testid="seat-field"]')?.getBoundingClientRect();
            if (!field) return { ok: false, why: "no field" };
            const under = [...document.querySelectorAll("[data-graview-view]")]
              .map((el) => ({ id: el.getAttribute("data-graview-view"), box: el.getBoundingClientRect(), shown: Number(getComputedStyle(el).opacity) > 0.05 }))
              .filter(({ box, shown }) => shown && box.width > 0 && box.right > field.left && box.left < field.right && box.bottom > field.top && box.top < field.bottom)
              .map(({ id }) => id);
            return { under, ok: under.length === 0 };
          });
          note("theFieldStaysClearOfCards", { at: label, ...clear });
        }

        /* Open it: nothing moves. */
        const before = await steadyMarks(page);
        const shifts = await watchShifts(page);
        await openTheSeat(page);
        const after = await steadyMarks(page);
        const shifted = shifts ? await page.evaluate(() => window.__shift) : null;
        const moved = before.boxes.filter((one, at) => after.boxes[at] !== one);
        const repadded = after.padded.filter((one) => !before.padded.includes(one));
        note("thePageDoesNotMove", { at: label, shift: shifted, moved: moved.slice(0, 4), repadded: repadded.slice(0, 4), ok: (shifted === null || shifted === 0) && moved.length === 0 && repadded.length === 0 });

        const open = await machineWords(page);
        note("noMachineWordsInTheSeat", { at: `${label} open`, ...open, ok: open.found && open.words.length === 0 && open.eyebrows.length === 0 });
        const offered = await choosers(page);
        note("noChoiceOfWhatAnswers", { at: `${label} open`, ...offered, ok: offered.controls.length === 0 && offered.words.length === 0 });
        const counted = await counts(page);
        note("atMostThreeActs", { at: label, ...counted, ok: counted.acts <= 3 && counted.suggestions <= 3 && counted.stars === 0 });

        /* Reached by the keyboard and named for a screen reader. */
        const named = await page.evaluate(() => {
          const seat = document.querySelector('[data-testid="seat"]');
          return {
            role: seat?.getAttribute("role") ?? null,
            name: seat?.getAttribute("aria-label") ?? null,
            live: seat?.querySelector('[aria-live="polite"]') !== null,
          };
        });
        const reach = await keyboardReach(page);
        let serious = [];
        if (size === "desk") {
          await page.addScriptTag({ content: axeSource });
          serious = await page.evaluate(async () => {
            const result = await window.axe.run({ include: [['[data-testid="seat"]']] }, { resultTypes: ["violations"] });
            return result.violations.filter((one) => one.impact === "serious" || one.impact === "critical").map((one) => `${one.id} ${one.nodes.map((node) => node.target.join(" ")).slice(0, 2).join(", ")}`);
          });
        }
        note("everyPartIsReachable", { at: label, ...named, ...reach, axe: serious, ok: named.role === "region" && named.name === "Ask Things" && named.live && reach.missed.length === 0 && serious.length === 0 });

        /* Escape closes it, and the keyboard is where it was. */
        await page.focus(FIELD);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        const escaped = await page.evaluate(() => ({
          seat: document.querySelector('[data-testid="seat"]')?.getAttribute("data-graview-seat") ?? null,
          on: document.activeElement === document.body ? "body" : (document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null),
        }));
        note("escapeReturnsFocus", { at: `${label} from the field`, ...escaped, ok: escaped.seat === "closed" && escaped.on !== "body" && escaped.on !== null });

        /* With no model given, an open question is told so — once, in plain words, with no note under it. */
        if (!chosen) {
          await openTheSeat(page);
          await ask(page, "should we repaint the hallway?");
          const told = await page.evaluate(() => {
            const last = [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')].at(-1);
            return { reply: (last?.textContent ?? "").slice(0, 160), note: Boolean(last?.querySelector('[data-testid="seat-answered-with-ai"]')) };
          });
          note("withoutAiAnOpenQuestionIsToldSo", { at: label, ...told, ok: NO_AI.test(told.reply) && !told.note && !new RegExp(RUNG_WORDS).test(told.reply) });
          /* And the person's menu offers no choice of it either. */
          await page.keyboard.press("Escape");
          if (size === "desk") {
            await page.click('[data-testid="profile-button"]').catch(() => {});
            await page.waitForTimeout(300);
            const menu = await choosers(page);
            note("noChoiceOfWhatAnswers", { at: `${label} the person's menu`, ...menu, ok: menu.controls.length === 0 && menu.words.length === 0 });
            await page.keyboard.press("Escape");
          }
        }
        } catch (error) {
          /* No field to open, or a step that never came: every claim this page holds fails, saying why. */
          const why = String(error).split("\n")[0].slice(0, 160);
          for (const claim of ["noMachineWordsInTheSeat", "atMostThreeActs", "thePageDoesNotMove", "everyPartIsReachable", "escapeReturnsFocus", "noChoiceOfWhatAnswers", ...(chosen ? [] : ["withoutAiAnOpenQuestionIsToldSo"]), ...(face === "scene" ? ["theFieldStaysClearOfCards"] : [])]) {
            note(claim, { at: `${where} ${face}${chosen ? " t-deposit" : ""}`, why, ok: false });
          }
        }
        await page.close();
      }
    }

    /* Find's last row asks; the conversation it starts crosses to Pages. */
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => report.pageErrors.push(`${ENGINE_NOW} ${where} find: ${String(error).slice(0, 200)}`));
      await visit(page, `/?${DAY}&fresh=1`);
      if (size === "phone") await page.click('[data-testid="app-find-open"]').catch(() => {});
      await page.click('[data-testid="find-box"]');
      await page.keyboard.type("what is overdue");
      await page.waitForTimeout(500);
      const row = await page.evaluate(() => document.querySelector('[data-testid="find-ask"]')?.textContent?.trim() ?? null);
      if (row) await page.click('[data-testid="find-ask"]');
      const asked = row
        ? await page
            .waitForFunction(() => document.querySelectorAll('[data-testid="seat-panel"] ol > li').length >= 2, undefined, { timeout: 20_000 })
            .then(() => turnsOf(page))
            .catch(() => [])
        : [];
      const seat = await page.evaluate(() => document.querySelector('[data-testid="seat"]')?.getAttribute("data-graview-seat") ?? null);
      note("findAsks", { at: where, row, seat, first: asked[0] ?? null, ok: row === "Ask: ‘what is overdue’" && seat === "open" && asked[0] === "what is overdue" });
      /* And Escape from there puts the keyboard back, not on the body. */
      await page.focus(FIELD);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const back = await page.evaluate(() => (document.activeElement === document.body ? "body" : (document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null)));
      note("escapeReturnsFocus", { at: `${where} after Find asked`, on: back, ok: back !== "body" && back !== null });

      /* Asked on the scene, the same turns on Pages. */
      await page.click('[data-graview-pick="t-deposit"]').catch(() => {});
      await page.waitForTimeout(400);
      await page.click(FIELD);
      await page.waitForSelector('[data-testid="seat-panel"]');
      await ask(page, "tell me about this");
      const onTheScene = await turnsOf(page);
      await page.goto(`${at("todo")}/pages/tasks/t-deposit?${DAY}`, { waitUntil: "load" });
      await page.waitForSelector('[data-testid="seat-panel"] ol > li', { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(600);
      const onPages = await turnsOf(page);
      note("theConversationSurvivesTheFaceSwitch", { at: `${where} whole page, scene to Pages`, onTheScene: onTheScene.length, onPages: onPages.length, ok: onTheScene.length >= 4 && JSON.stringify(onTheScene) === JSON.stringify(onPages) });
      await page.close();
    } catch (error) {
      const why = String(error).split("\n")[0].slice(0, 160);
      for (const claim of ["findAsks", "theConversationSurvivesTheFaceSwitch"]) {
        if (!(cases[claim] ?? []).some((one) => one.at.startsWith(where))) note(claim, { at: where, why, ok: false });
      }
    }

    /* On Pages, Find goes to the search page, whose last line asks the same seat. */
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => report.pageErrors.push(`${ENGINE_NOW} ${where} pages find: ${String(error).slice(0, 200)}`));
      await visit(page, `/pages/?${DAY}&fresh=1`);
      if (size === "phone") await page.click('[data-testid="app-find-open"]').catch(() => {});
      await page.fill('[data-testid="nav-find"]', "what is overdue");
      await page.waitForSelector('[data-testid="search-ask"]', { timeout: 15_000 });
      const row = (await page.textContent('[data-testid="search-ask"]'))?.trim() ?? null;
      await page.click('[data-testid="search-ask"]');
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="seat-panel"] ol > li').length >= 2, undefined, { timeout: 20_000 });
      const asked = await turnsOf(page);
      note("findAsks", { at: `${where} pages`, row, first: asked[0] ?? null, ok: row === "Ask: ‘what is overdue’" && asked[0] === "what is overdue" });
      await page.close();
    } catch (error) {
      note("findAsks", { at: `${where} pages`, why: String(error).split("\n")[0].slice(0, 160), ok: false });
    }

    /* The acts key opens the context menu at the card. */
    {
      const page = await context.newPage();
      await page.goto(`${at("todo")}/?${DAY}&fresh=1`, { waitUntil: "load" });
      await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
      await page.waitForTimeout(1600);
      const card = await page.evaluate(() => {
        const one = document.querySelector("[data-graview-view][aria-keyshortcuts]");
        one?.focus();
        return one?.getAttribute("data-graview-view") ?? null;
      });
      await page.keyboard.press("a");
      await page.waitForTimeout(600);
      const menu = await page.evaluate(() => ({
        open: document.querySelector('[data-testid="context-menu"]') !== null,
        inside: document.activeElement?.closest('[data-testid="context-menu"]') !== null,
      }));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const back = await page.evaluate(() => document.activeElement?.closest("[data-graview-view]")?.getAttribute("data-graview-view") ?? null);
      note("theActsKeyOpensTheMenu", { at: where, card, ...menu, back, ok: card !== null && menu.open && menu.inside && back === card });
      await page.close();
    }
    await context.close();
  }

  /* In an embed, switching face in place keeps the conversation. */
  for (const [size] of !host ? [] : QUICK ? [["desk"]] : [["desk"], ["phone"]]) {
    const context = await browser.newContext({ viewport: SIZES[size] });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.pageErrors.push(`${ENGINE_NOW} embed ${size}: ${String(error).slice(0, 200)}`));
    await page.goto(`${at("seat-host")}/`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 120_000 });
    await page.waitForSelector(FIELD, { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    let onTheScene = [];
    let onPages = [];
    if (await page.$(FIELD)) try {
      await page.click(FIELD);
      await page.waitForSelector('[data-testid="seat-panel"]');
      await ask(page, "what is here?");
      onTheScene = await turnsOf(page);
      await page.evaluate(() => window.__handle.setFace("pages"));
      await page.waitForTimeout(2000);
      await page.waitForSelector('[data-testid="seat-panel"] ol > li', { timeout: 30_000 }).catch(() => {});
      onPages = await turnsOf(page);
    } catch (error) {
      report.pageErrors.push(`${ENGINE_NOW} embed ${size}: ${String(error).split("\n")[0].slice(0, 160)}`);
    }
    note("theConversationSurvivesTheFaceSwitch", { at: `embed ${size}, scene to Pages in place`, onTheScene: onTheScene.length, onPages: onPages.length, ok: onTheScene.length >= 2 && JSON.stringify(onTheScene) === JSON.stringify(onPages) });
    await context.close();
  }

  if (!host) note("theConversationSurvivesTheFaceSwitch", { at: "embed", why: report.hostError, ok: false });
  await browser.close();
  browser = undefined;
  }

  for (const [claim, all] of Object.entries(cases)) {
    const failing = all.filter((one) => !one.ok);
    report.checks[claim] = { cases: all.length, failing, ok: failing.length === 0 };
  }
  report.passed = Object.values(report.checks).every((check) => check.ok) && report.pageErrors.length === 0;
} catch (error) {
  report.error = String(error?.stack ?? error).slice(0, 2000);
  for (const [claim, all] of Object.entries(cases)) {
    const failing = all.filter((one) => !one.ok);
    report.checks[claim] = { cases: all.length, failing, ok: failing.length === 0 };
  }
  report.passed = false;
} finally {
  await browser?.close();
  vite?.stop();
  host?.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/seat-guide.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const said = Object.entries(report.checks).map(([name, check]) => `${check.ok ? "ok  " : "FAIL"} ${name} (${check.cases})`).join("\n");
process.stdout.write(`${said}${report.error ? `\n${report.error}` : ""}${report.pageErrors.length ? `\npage errors: ${report.pageErrors.length}` : ""}\n\nwrote docs/seat-guide.json\n`);
process.exit(report.passed ? 0 : 1);
