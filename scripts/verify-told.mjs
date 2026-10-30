#!/usr/bin/env node
/**
 * WHAT PEOPLE TELL GRAVIEW IS KEPT, RATED, SEEN IN THE STUDIO, AND SUGGESTED
 * BACK (Roadmap f-menu-learns) — driven in a real browser against the todo
 * app, its host's AI a fake one handed in before the page loads: a Fast
 * slot that decides over the graph as Jev would, a Thinking slot, and a
 * host that keeps tellings in the page (`HostAi.told`), read back by the
 * harness.
 *
 * Right-click a list, type "mark these done", Enter: the card answers with
 * the act over the list's tasks, previewed, and a telling is kept with what
 * it did; accepted, it says so, and an undo says that too — never a 👎.
 * 👍 and 👎 sit at the card's foot, named "This was right" and "This was
 * wrong"; a 👎 asks "What should it have done?" and keeps the answer. The
 * Studio lists every telling an owner may see, says what is teaching the
 * system, and an owner excludes one. Typing in the menu offers what worked
 * before, re-aimed at what the menu is on, and choosing it previews it on
 * the card like any plan; somebody else's is offered only once two other
 * people's agree; and a telling about a record the viewer cannot see is
 * never offered to them.
 *
 *   node scripts/verify-told.mjs [--engine=chromium|webkit|firefox]
 */
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { serving, vacant } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const VERDICT = resolve(repoRoot, "docs/told.json");

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let app;
let browser;
let toldHost;
const reach = deadline({
  verdict: VERDICT,
  report,
  cleanup: async () => {
    await browser?.close();
    app?.stop();
    toldHost?.stop();
  },
});
app = await serving("todo", portFor("todo"), repoRoot);

/*
 * AN APP WHOSE SIGHT KEEPS ITS PEOPLE FROM A MEMBER, mounted the way Graview
 * Cloud mounts one: the tasks document on the pages, everybody seeing the
 * tasks and only an owner the people, the reader a member, the host's AI
 * the fake one below.
 */
const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const HOST_BASE = "/told";
async function serveToldHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-told-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import tasks from ${JSON.stringify(TASKS)};
        const document0 = { ...tasks, policy: { grants: [{ roles: ["owner", "viewer"], mutations: "*" }], sees: [{ roles: "*", kinds: ["task"] }, { roles: ["owner"], kinds: ["person"] }] } };
        const compiled = compileDocumentWithoutCheck(document0, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: { nodes: [{ id: "t1", kind: "task", label: "Write the brief", status: "todo" }, { id: "t2", kind: "task", label: "Book the hall", status: "todo" }, { id: "p-nick", kind: "person", label: "Nick" }], edges: [] },
          principal: { kind: "human", id: "m1", roles: ["viewer"] },
          face: "pages",
          bar: true,
          label: "The tasks",
          heading: 1,
          height: "100%",
          fonts: false,
          studio: false,
          routing: "address",
          basePath: "${HOST_BASE}/",
          ai: window.__todoAi,
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
    if (path === HOST_BASE || path.startsWith(`${HOST_BASE}/`)) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(page);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await vacant(portFor("told-host"));
  await new Promise((ready) => server.listen(portFor("told-host"), ready));
  return { stop: () => (server.close(), rmSync(out, { recursive: true, force: true })) };
}
toldHost = await serveToldHost();

const MENU = '[data-testid="context-menu"]';
const CARD = '[data-testid="quick-ask"]';
const DAY = "today=2026-09-01";

/*
 * THE HOST'S AI, FAKED: the Fast slot reads "these" on a list as the tasks
 * it holds and "mark … done" as "Mark it done" over each, sure — so no
 * model writes a word — and keeps every state it was handed; the host keeps
 * tellings in `__told`, as a host's store would.
 */
const FAKE_AI = () => {
  window.__fastStates = [];
  window.__told = [...(window.__toldSeed ?? [])];
  const sure = (question, choice, chance = 0.92) => {
    const names = Object.keys(question.criteria);
    return { type: "choice", choice, confidence: chance, probabilities: Object.fromEntries(names.map((name) => [name, name === choice ? chance : (1 - chance) / Math.max(1, names.length - 1)])) };
  };
  window.__todoAi = {
    name: "fake",
    fast: {
      model: "fake-fast",
      decide: async (state, questions) => {
        window.__fastStates.push(JSON.parse(JSON.stringify(state)));
        const answers = {};
        for (const [key, question] of Object.entries(questions)) {
          if (question.type !== "choice") continue;
          const names = Object.keys(question.criteria);
          if (key === "reading") answers[key] = sure(question, /\b(these|all|them|each|everything)\b/i.test(String(state.said ?? "")) ? "held" : "itself");
          else if (key === "act") answers[key] = sure(question, names.find((name) => /^held:finish$/.test(name)) ?? "none");
          else if (key === "person" || key === "need") answers[key] = sure(question, "none");
          else if (key === "row") answers[key] = sure(question, "none", 0.5);
          else answers[key] = sure(question, names[0], 0.5);
        }
        return { answers, usage: { inputTokens: 10, outputTokens: 1 } };
      },
    },
    thinking: { model: "fake-thinking", think: async () => ({ text: JSON.stringify({ answer: "It is a list of tasks." }) }) },
    told: {
      add: (telling) => void window.__told.push(telling),
      change: (id, change) => {
        window.__told = window.__told.map((one) => {
          if (one.id !== id) return one;
          const next = { ...one };
          for (const [key, value] of Object.entries(change)) {
            if (key === "outcome" && (one.outcome === "accepted" ? value !== "undone" : one.outcome === "undone" || ((one.outcome === "declined" || one.outcome === "abandoned") && value === "abandoned"))) continue;
            if (value === null) delete next[key];
            else next[key] = value;
          }
          if (next.rating !== "down") delete next.should;
          return next;
        });
      },
      remove: (id) => void (window.__told = window.__told.filter((one) => one.id !== id)),
      list: () => window.__told,
    },
  };
};
/* The store itself, handed to the watch as it opens. */
const KEEP_THE_STORE = () => {
  const watch = (window.__graviewWatch ??= {});
  const handed = watch.store;
  watch.store = (store) => {
    handed?.(store);
    (window.__toldStores ??= []).push(store);
  };
};

/** A telling as a host kept it, for a seed. */
const seed = (id, by, extra = {}) => ({
  id,
  at: "2026-08-30T10:00:00.000Z",
  by: { kind: "human", id: by },
  words: "mark these done",
  target: { on: "record", kind: "list", id: "today" },
  reading: { which: "held", kind: "task", records: ["t-deposit", "t-quote", "t-book"] },
  decided: { type: "act", act: "finish", records: 3 },
  slot: "graph",
  outcome: "accepted",
  rating: "up",
  conversation: id,
  ...extra,
});

async function fresh({ as, told = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((seeded) => (window.__toldSeed = seeded), told);
  await context.addInitScript(FAKE_AI);
  await context.addInitScript(KEEP_THE_STORE);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${at("todo")}/pages/lists?${DAY}&fresh=1${as ? `&as=${as}` : ""}`, { waitUntil: "load" });
  await page.waitForSelector('[data-graview-record="week"]', { timeout: 60_000 });
  await page.waitForTimeout(500);
  return { context, page };
}

/** The menu opened on a list's row, the words typed into it. */
async function typed(page, list, words) {
  await page.click(`[data-graview-record="${list}"]`, { button: "right" });
  await page.waitForSelector(MENU, { timeout: 10_000 });
  await page.waitForTimeout(250);
  await page.keyboard.type(words, { delay: 20 });
  // The tellings are read once the menu is typed in, and the Fast slot ranks at rest.
  await page.waitForTimeout(900);
  return page.evaluate(() => ({
    suggested: [...document.querySelectorAll("[data-told-suggestion]")].map((row) => ({ id: row.getAttribute("data-told-suggestion"), text: (row.textContent ?? "").replace(/[↵]/g, "").trim() })),
    rows: [...document.querySelectorAll('[data-testid="context-menu"] [data-menu-item]')].map((row) => row.getAttribute("data-menu-item")),
  }));
}

const toldNow = (page) => page.evaluate(() => window.__told);
const tasksDone = (page, ids) => page.evaluate((ids) => {
  const store = (window.__toldStores ?? []).find((one) => one.schema.kinds.includes("task"));
  return ids.map((id) => store?.graph.getNode(id)?.done === true);
}, ids);

const errors = [];
try {
  browser = await launchEngine(ENGINE);

  /* ─────────── a telling is kept with what it did and how it ended ─────────── */
  reach("aTellingIsKeptWithWhatItDidAndHowItEnded");
  {
    const { context, page } = await fresh();
    await typed(page, "week", "mark these done");
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid="ai-ghost"]', { timeout: 20_000 });
    await page.waitForTimeout(300);
    const previewed = (await toldNow(page)).at(-1);
    await page.click('[data-testid="ghost-accept"]');
    await page.waitForTimeout(400);
    const accepted = (await toldNow(page)).at(-1);
    await page.click('[data-testid="ghost-undo"]');
    await page.waitForTimeout(400);
    const undone = (await toldNow(page)).at(-1);
    report.checks.aTellingIsKeptWithWhatItDidAndHowItEnded = {
      previewed,
      accepted: accepted?.outcome,
      undone: { outcome: undone?.outcome, rating: undone?.rating ?? null },
      ok:
        previewed?.words === "mark these done" &&
        previewed.target?.kind === "list" &&
        previewed.target?.id === "week" &&
        previewed.reading?.which === "held" &&
        previewed.reading?.kind === "task" &&
        previewed.decided?.type === "act" &&
        previewed.decided?.act === "finish" &&
        previewed.decided?.records > 0 &&
        previewed.slot === "graph" &&
        typeof previewed.ms === "number" &&
        previewed.outcome === "previewed" &&
        previewed.by?.id === "user-nora" &&
        accepted?.outcome === "accepted" &&
        undone?.outcome === "undone" &&
        undone?.rating === undefined,
    };
    await context.close();
  }

  /* ─────────── a 👎 asks what it should have done, and keeps it ─────────── */
  reach("aThumbsDownAsksWhatItShouldHaveDoneAndKeepsIt");
  {
    const { context, page } = await fresh();
    await typed(page, "today", "mark these done");
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid="quick-ask-wrong"]', { timeout: 20_000 });
    const names = await page.evaluate(() => [...document.querySelectorAll('[data-testid="quick-ask-rating"] button')].map((button) => button.getAttribute("aria-label")));
    // From the keyboard: the 👎 focused and pressed with Enter.
    await page.focus('[data-testid="quick-ask-wrong"]');
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid="quick-ask-should"]', { timeout: 5000 });
    const asks = await page.evaluate(() => document.querySelector('[data-testid="quick-ask-should"]')?.labels?.[0]?.textContent?.trim() ?? null);
    await page.focus('[data-testid="quick-ask-should"]');
    await page.keyboard.type("Only the ones due today", { delay: 10 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const down = (await toldNow(page)).at(-1);
    // Changed while the card is open.
    await page.click('[data-testid="quick-ask-right"]');
    await page.waitForTimeout(300);
    const up = (await toldNow(page)).at(-1);
    report.checks.aThumbsDownAsksWhatItShouldHaveDoneAndKeepsIt = {
      names,
      asks,
      down: { rating: down?.rating, should: down?.should },
      up: { rating: up?.rating, should: up?.should ?? null },
      ok: names.join("|") === "This was right|This was wrong" && /^What should it have done\?/.test(asks ?? "") && down?.rating === "down" && down?.should === "Only the ones due today" && up?.rating === "up" && up?.should === undefined,
    };
    await context.close();
  }

  /* ─────────── the Studio shows what Graview has been told ─────────── */
  reach("theStudioShowsWhatGraviewHasBeenToldAndAnOwnerCanExcludeOne");
  {
    const told = [seed("tl-a", "user-nora"), seed("tl-b", "user-sam", { words: "finish the week", rating: undefined, outcome: "declined" })];
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((seeded) => (window.__toldSeed = seeded), told);
    await context.addInitScript(FAKE_AI);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`${at("todo")}/?${DAY}&fresh=1`, { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    await page.waitForTimeout(800);
    const shown = await page.evaluate(() => {
      const pane = document.querySelector('[data-testid="profile"]');
      return pane !== null && !pane.hasAttribute("hidden");
    });
    if (!shown) await page.click('[data-testid="profile-button"]');
    await page.click('[data-testid="studio-place"]');
    await page.waitForSelector('[data-testid="studio"]', { timeout: 20_000 });
    await page.click('[data-testid="told-open"]');
    await page.waitForSelector('[data-testid="told-entry"]', { timeout: 10_000 });
    const listed = await page.evaluate(() => ({
      teaching: document.querySelector('[data-testid="told-teaching"]')?.textContent?.trim(),
      entries: [...document.querySelectorAll('[data-testid="told-entry"]')].map((entry) => ({ id: entry.getAttribute("data-telling"), text: entry.textContent })),
    }));
    await page.selectOption('[data-testid="told-filter-rating"]', "up");
    await page.waitForTimeout(200);
    const filtered = await page.evaluate(() => [...document.querySelectorAll('[data-testid="told-entry"]')].map((entry) => entry.getAttribute("data-telling")));
    await page.click('[data-telling="tl-a"] [data-testid="told-exclude"]');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ kept: window.__told.find((one) => one.id === "tl-a"), teaching: document.querySelector('[data-testid="told-teaching"]')?.textContent?.trim() }));
    report.checks.theStudioShowsWhatGraviewHasBeenToldAndAnOwnerCanExcludeOne = {
      listed,
      filtered,
      excluded: after.kept?.excluded === true,
      teachingAfter: after.teaching,
      ok:
        listed.entries.length === 2 &&
        listed.teaching === "Suggestions come from 1 rated telling in this app." &&
        listed.entries.some((one) => /mark these done/.test(one.text) && /Mark it done, over 3 records/.test(one.text) && /Accepted/.test(one.text)) &&
        filtered.join() === "tl-a" &&
        after.kept?.excluded === true &&
        /^Nothing told here teaches/.test(after.teaching ?? ""),
    };
    await context.close();
  }

  /* ─────────── what worked before is suggested, and still previewed ─────────── */
  reach("aSimilarTellingThatWorkedIsSuggestedAndStillPreviewed");
  {
    const { context, page } = await fresh({ told: [seed("tl-mine", "user-nora")] });
    const menu = await typed(page, "week", "mark the");
    const row = menu.suggested[0];
    const weekTasks = await page.evaluate(() => {
      const store = (window.__toldStores ?? []).find((one) => one.schema.kinds.includes("task"));
      return store ? store.graph.out("week").filter((one) => one.kind === "task").map((one) => one.id) : [];
    });
    const before = await tasksDone(page, weekTasks);
    if (row) await page.click(`[data-told-suggestion="${row.id}"]`);
    await page.waitForSelector('[data-testid="ai-ghost"]', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const card = await page.evaluate(() => ({ asked: document.querySelector('[data-testid="quick-answer-asked"]')?.textContent?.trim(), ghost: document.querySelector('[data-testid="ai-ghost"]') !== null }));
    const done = await tasksDone(page, weekTasks);
    const newest = (await toldNow(page)).at(-1);
    const examples = await page.evaluate(() => window.__fastStates.filter((state) => Array.isArray(state.workedBefore)).map((state) => state.workedBefore));
    report.checks.aSimilarTellingThatWorkedIsSuggestedAndStillPreviewed = {
      suggested: menu.suggested,
      card,
      nothingAppliedYet: done.join() === before.join(),
      newest: { id: newest?.id, examples: newest?.examples },
      examplesGiven: examples.length,
      ok:
        menu.suggested.length === 1 &&
        row.text === `Mark the ${weekTasks.length} tasks in This week done, like last time` &&
        card.asked === "“mark these done”" &&
        card.ghost &&
        weekTasks.length > 0 &&
        done.join() === before.join() &&
        newest?.id !== "tl-mine" &&
        (newest?.examples ?? []).includes("tl-mine") &&
        examples.length > 0,
    };
    await context.close();
  }

  /* ─────────── another person's is not suggested until enough agree ─────────── */
  reach("anotherPersonsTellingIsNotSuggestedUntilEnoughAgree");
  {
    const one = await fresh({ told: [seed("tl-x", "user-x")] });
    const alone = await typed(one.page, "week", "mark the");
    await one.context.close();
    const two = await fresh({ told: [seed("tl-x", "user-x"), seed("tl-y", "user-y", { words: "mark all of them done" })] });
    const agreed = await typed(two.page, "week", "mark the");
    await two.context.close();
    report.checks.anotherPersonsTellingIsNotSuggestedUntilEnoughAgree = {
      alone: alone.suggested,
      agreed: agreed.suggested,
      ok: alone.suggested.length === 0 && agreed.suggested.length === 1,
    };
  }

  /* ─────────── a viewer never sees a telling about a record they cannot see ─────────── */
  reach("aViewerNeverSeesATellingAboutARecordTheyCannotSee");
  {
    /* A member who sees the tasks and no person: their own telling that named Nick is never offered back to them. */
    const telling = (id, extra = {}) => ({ ...seed(id, "m1"), words: "mark this done", target: { on: "record", kind: "task", id: "t2" }, reading: { which: "itself", kind: "task", records: ["t2"] }, decided: { type: "act", act: "set-status", records: 1 }, ...extra });
    const onHost = async (told) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript((seeded) => (window.__toldSeed = seeded), told);
      await context.addInitScript(FAKE_AI);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(`http://localhost:${portFor("told-host")}${HOST_BASE}/tasks`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await page.waitForSelector('[data-graview-record="t1"]', { timeout: 30_000 });
      await page.waitForTimeout(400);
      const said = await typed(page, "t1", "mark this");
      await context.close();
      return said.suggested;
    };
    const naming = await onHost([telling("tl-named", { people: ["p-nick"] })]);
    const plain = await onHost([telling("tl-plain")]);
    report.checks.aViewerNeverSeesATellingAboutARecordTheyCannotSee = {
      namingAPersonTheySeeNot: naming,
      namingNobody: plain,
      ok: naming.length === 0 && plain.length === 1,
    };
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
  toldHost?.stop();
}

writeFileSync(VERDICT, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(Object.fromEntries(Object.entries(report.checks).map(([name, check]) => [name, check.ok])), null, 1)}\n${report.error ? `\n${report.error}` : ""}\n\nwrote docs/told.json\n`);
process.exit(report.passed ? 0 : 1);
