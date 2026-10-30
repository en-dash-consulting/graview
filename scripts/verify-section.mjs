#!/usr/bin/env node
/**
 * MAKE THIS SECTION BETTER (Roadmap f-make-this-section-better), in a real
 * browser.
 *
 * A host page mounts the tasks the way Graview Cloud mounts an app — the
 * embed on the pages, at its own address under a base — with a worker view
 * of three named sections ("This week", "Doing", "Notes"), the host's views
 * kept in memory with revisions (`withMemoryRevisions(memoryViews())`), and a
 * fake host AI whose light and full slots answer each revision from the
 * prompt they were handed. A right-click inside a section names the menu
 * and outlines it; "Make “Doing” better" offers Just do it, Describe
 * changes… and Highlight area…; each revises that section alone into a
 * draft shown in place; a revision that drops styles is handed back once
 * and offered, or refused; Keep goes through the host's view door and one
 * Undo puts the view back; and a seat the host says may not change views is
 * offered none of it.
 *
 * Claims (docs/section.json):
 *   aSectionUnderTheCursorNamesTheMenuAndIsOutlined
 *   justDoItRevisesOnlyThatSectionAndShowsADraft
 *   describedChangesReviseThatSection
 *   aHighlightedAreaNamesWhatItCovers
 *   aRevisionThatDropsStylesIsRepairedOrRefused
 *   keepThenOneUndoRestoresTheView
 *   aSeatThatMayNotChangeViewsIsNotOffered
 *   aRevisionIsToldWithHowItEndedAndCanBeRated
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
const SHOTS = process.env.GRAVIEW_SECTION_SHOTS;
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let browser;
let host;
const reach = deadline({
  verdict: resolve(repoRoot, "docs/section.json"),
  report,
  cleanup: async () => {
    await browser?.close();
    host?.stop();
  },
});

const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const BASE = "/section";
const WEEK = { name: "week", title: "The week", attach: "task", cardinality: "many" };
/* Three sections, each with classes and rules of its own, and a wrapper that is no section's. */
const WEEK_SOURCE = `graview.style(\`
  .tk-home { display: grid; gap: 16px; }
  .tk-week { display: grid; gap: 8px; }
  .tk-days { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .tk-day { border: 1px solid var(--graview-edge); border-radius: 8px; padding: 8px; min-height: 60px; }
  .tk-doing { padding: 8px; border-left: 3px solid var(--graview-accent); }
  .tk-doing li { margin: 2px 0; }
  .tk-notes { padding: 8px; color: var(--graview-ink-muted); }
\`);
graview.onProps((props) => {
  const tasks = props.nodes.filter((node) => node.kind === "task");
  graview.render(graview.html\`<div class="tk-home">
    <section class="tk-week" aria-labelledby="tk-week-h"><h2 id="tk-week-h">This week</h2>
      <div class="tk-days"><div class="tk-day"><h3>Mon</h3></div><div class="tk-day"><h3>Tue</h3></div><div class="tk-day"><h3>Wed</h3></div></div>
    </section>
    <section class="tk-doing" aria-labelledby="tk-doing-h"><h2 id="tk-doing-h">Doing</h2>
      <ul>\${tasks.filter((task) => task.status === "doing").map((task) => graview.html\`<li data-key="\${task.id}">\${task.label}</li>\`)}</ul>
    </section>
    <section class="tk-notes" aria-labelledby="tk-notes-h"><h2 id="tk-notes-h">Notes</h2><p>\${tasks.length} tasks in all.</p></section>
  </div>\`);
});`;
const SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
    { id: "t3", kind: "task", label: "Print the flyers", status: "doing" },
  ],
  edges: [],
};

/*
 * THE FAKE HOST AI: a light slot and a full one, each answering from the
 * section it is handed — a class added and styled for Just do it, the
 * person's words drawn for Describe, what was pointed at drawn for
 * Highlight; "drop" answers first with the section's rules gone (the full
 * slot repairs it), and "break" never stops dropping them.
 */
const FAKE_AI = () => {
  const prompts = (window.__sectionPrompts = []);
  const answer = (slot) => async ({ prompt }) => {
    const asked = JSON.parse(prompt);
    prompts.push({ slot, ...asked });
    const markup = String(asked.markup);
    const rules = (asked.rules ?? []).join("\n");
    const said = String(asked.asked ?? "");
    const open = markup.indexOf(">") + 1;
    const close = markup.lastIndexOf("</");
    const drawIn = (extra) => markup.slice(0, open) + extra + markup.slice(open, close) + markup.slice(close);
    const repairing = Array.isArray(asked.what_broke);
    if (/\bbreak\b/.test(said) || (/\bdrop\b/.test(said) && !repairing))
      return { text: JSON.stringify({ markup: drawIn('<p class="tk-dropped">dropped</p>'), css: ".tk-dropped { font-weight: 600; }", said: "Dropped the old rules." }) };
    if (asked.pointed_at) return { text: JSON.stringify({ markup: drawIn(`<p class="tk-pointed">${asked.pointed_at[0]}</p>`), css: `${rules}\n.tk-pointed { font-style: italic; }`, said: `Changed ${asked.pointed_at[0]}.` }) };
    if (said.startsWith("Make this section better")) return { text: JSON.stringify({ markup: markup.replace(/class="(tk-[a-z]+)"/, 'class="$1 tk-better"'), css: `${rules}\n.tk-better { box-shadow: 0 0 0 2px var(--graview-accent); }`, said: "Gave it a clearer edge." }) };
    return { text: JSON.stringify({ markup: drawIn(`<p class="tk-said">${said}</p>`), css: `${rules}\n.tk-said { font-weight: 600; }`, said: `Said “${said}” in it.` }) };
  };
  window.__sectionAi = { name: "fake", light: { model: "fake-light", think: answer("light") }, thinking: { model: "fake-full", think: answer("thinking") } };
};

async function serveHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-section-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { registerWorkerView } from "@graview/guest/host/views";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { memoryViews, withMemoryRevisions } from "@graview/core";
        import { memoryTold } from "@graview/core/told";
        import tasks from ${JSON.stringify(TASKS)};
        const visitor = new URLSearchParams(location.search).get("visitor") === "1";
        const compiled = compileDocumentWithoutCheck(tasks, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const keptViews = withMemoryRevisions(memoryViews({ may: { views: !visitor, lenses: false } }));
        window.__keeper = keptViews;
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: ${JSON.stringify(SEED)},
          principal: { kind: "human", id: "p1", roles: ["owner"] },
          face: "pages",
          views: (schema, registry) => registerWorkerView(registry, { manifest: ${JSON.stringify(WEEK)}, worker: { source: ${JSON.stringify(WEEK_SOURCE)} } }),
          keptViews,
          bar: true,
          label: "The tasks",
          heading: 1,
          height: "100%",
          fonts: false,
          studio: false,
          routing: "address",
          basePath: "${BASE}/",
          ai: { ...window.__sectionAi, told: (window.__told = memoryTold()) },
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
  await vacant(portFor("section-host"));
  await new Promise((ready) => server.listen(portFor("section-host"), ready));
  return { stop: () => (server.close(), rmSync(out, { recursive: true, force: true })) };
}

const URL_OF = (query = "") => `http://localhost:${portFor("section-host")}${BASE}/places/the-week${query}`;
const MENU = '[data-testid="context-menu"]';
const CARD = '[data-testid="section-card"]';

/** The live view's region and the draft's, read through their shadow roots. */
const read = (page) =>
  page.evaluate(() => {
    const place = document.querySelector('[data-worker-view-place="week"]');
    const live = place?.querySelector(':scope > [data-worker-view="week"]');
    const draft = place?.querySelector("[data-graview-section-draft] [data-worker-view]");
    const sections = (region) =>
      region?.shadowRoot
        ? Object.fromEntries([...region.shadowRoot.querySelectorAll('[data-graview-view-root] :is(section, [data-graview-as="section"])')].map((one) => [(one.querySelector("h2")?.textContent ?? "").trim().split(/\s+/)[0], { classes: one.getAttribute("class"), html: one.innerHTML }]))
        : null;
    return { liveShown: live ? getComputedStyle(live).display !== "none" : false, live: sections(live), draft: sections(draft), draftCss: draft ? [...draft.shadowRoot.querySelectorAll("style")].map((style) => style.textContent).join("\n") : null };
  });

/** A point inside a section of the live view, by its heading's words. */
const pointIn = (page, heading) =>
  page.evaluate((heading) => {
    const region = document.querySelector('[data-worker-view-place="week"] > [data-worker-view="week"]');
    const title = [...region.shadowRoot.querySelectorAll("h2")].find((one) => one.textContent.trim() === heading);
    const section = title.parentElement;
    const inner = section.querySelector("li, p, .tk-day") ?? title;
    const box = inner.getBoundingClientRect();
    return { x: Math.round(box.left + Math.min(12, box.width / 2)), y: Math.round(box.top + box.height / 2) };
  }, heading);

async function openMenuOn(page, heading) {
  if (await page.$(MENU)) await page.keyboard.press("Escape");
  const { x, y } = await pointIn(page, heading);
  await page.mouse.click(x, y, { button: "right" });
  await page.waitForSelector(MENU, { timeout: 10_000 });
}

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${ENGINE}-${name}.png`) });
}

async function ready(page, query = "") {
  await page.goto(URL_OF(query));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector('[data-worker-view-place="week"] > [data-worker-view="week"]')?.shadowRoot?.querySelector("h2"), null, { timeout: 30_000 });
}

/** Opens "Make “<heading>” better" and presses one of its rows. */
async function choose(page, heading, item) {
  await openMenuOn(page, heading);
  await page.click(`${MENU} [data-menu-item="${item}"]`);
}

const settled = (page, phase) => page.waitForSelector(`${CARD}[data-section-phase="${phase}"]`, { timeout: 30_000 });

try {
  host = await serveHost();
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(FAKE_AI);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);

  reach("aSectionUnderTheCursorNamesTheMenuAndIsOutlined");
  {
    await openMenuOn(page, "Doing");
    const seen = await page.evaluate(() => {
      const menu = document.querySelector('[data-testid="context-menu"]');
      const outline = document.querySelector('[data-testid="section-outline"]');
      const region = document.querySelector('[data-worker-view-place="week"] > [data-worker-view="week"]');
      const section = [...region.shadowRoot.querySelectorAll("h2")].find((one) => one.textContent.trim() === "Doing").parentElement.getBoundingClientRect();
      const box = outline?.getBoundingClientRect();
      return {
        title: menu?.querySelector("strong")?.textContent ?? null,
        heading: menu?.querySelector('[data-menu-section="make-better"]')?.textContent ?? null,
        rows: [...(menu?.querySelectorAll('[data-menu-section="make-better"] [data-menu-item]') ?? [])].map((row) => row.getAttribute("data-menu-item")),
        outline: box ? { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height) } : null,
        section: { left: Math.round(section.left), top: Math.round(section.top), width: Math.round(section.width), height: Math.round(section.height) },
      };
    });
    await shot(page, "menu-on-a-section");
    const around = seen.outline && Math.abs(seen.outline.left - (seen.section.left - 3)) <= 2 && Math.abs(seen.outline.width - (seen.section.width + 6)) <= 2 && Math.abs(seen.outline.height - (seen.section.height + 6)) <= 2;
    report.checks.aSectionUnderTheCursorNamesTheMenuAndIsOutlined = {
      ...seen,
      ok: seen.title === "Doing" && /Make “Doing” better/.test(seen.heading ?? "") && seen.rows.join() === "section-just-do-it,section-describe,section-highlight" && around === true,
    };
    await page.keyboard.press("Escape");
  }

  reach("justDoItRevisesOnlyThatSectionAndShowsADraft");
  {
    const before = await read(page);
    await choose(page, "Doing", "section-just-do-it");
    await settled(page, "draft");
    const after = await read(page);
    const asked = await page.evaluate(() => window.__sectionPrompts.at(-1));
    await shot(page, "just-do-it-draft");
    const card = await page.textContent(CARD);
    const others = ["This", "Notes"].every((name) => after.draft?.[name]?.html === before.live?.[name]?.html && after.draft?.[name]?.classes === before.live?.[name]?.classes);
    report.checks.justDoItRevisesOnlyThatSectionAndShowsADraft = {
      slot: asked?.slot,
      askedOnlyTheSection: asked?.markup?.startsWith('<section class="tk-doing"') && !asked.markup.includes("tk-notes"),
      draftDoing: after.draft?.Doing?.classes,
      othersUnchanged: others,
      liveHiddenUnderTheDraft: after.liveShown === false,
      card,
      ok: asked?.slot === "light" && asked.markup.startsWith('<section class="tk-doing"') && !asked.markup.includes("tk-notes") && after.draft?.Doing?.classes === "tk-doing tk-better" && others && after.liveShown === false && /Draft/.test(card ?? "") && /Keep/.test(card ?? ""),
    };
    await page.click('[data-testid="section-discard"]');
    await page.waitForSelector(CARD, { state: "detached" });
    const discarded = await read(page);
    report.checks.justDoItRevisesOnlyThatSectionAndShowsADraft.discardPutsItAway = discarded.draft === null && discarded.liveShown === true;
    report.checks.justDoItRevisesOnlyThatSectionAndShowsADraft.ok &&= discarded.draft === null && discarded.liveShown === true;
  }

  reach("describedChangesReviseThatSection");
  {
    await choose(page, "Notes", "section-describe");
    await settled(page, "asking");
    const placeholder = await page.getAttribute('[data-testid="section-words"]', "placeholder");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    await page.keyboard.type("say how many are done");
    await page.keyboard.press("Enter");
    await settled(page, "draft");
    const after = await read(page);
    const asked = await page.evaluate(() => window.__sectionPrompts.at(-1));
    await shot(page, "described-draft");
    report.checks.describedChangesReviseThatSection = {
      placeholder,
      focused,
      asked: asked?.asked,
      drawn: after.draft?.Notes?.html ?? null,
      ok: placeholder === "What should change?" && focused === "section-words" && asked?.asked === "say how many are done" && asked?.section === "Notes" && /tk-said[^>]*>say how many are done/.test(after.draft?.Notes?.html ?? "") && after.draft?.Doing?.html === after.live?.Doing?.html,
    };
    await page.click('[data-testid="section-discard"]');
    await page.waitForSelector(CARD, { state: "detached" });
  }

  reach("aHighlightedAreaNamesWhatItCovers");
  {
    await choose(page, "This week", "section-highlight");
    await page.waitForSelector('[data-testid="section-highlighter"]', { timeout: 10_000 });
    const days = await page.evaluate(() => {
      const region = document.querySelector('[data-worker-view-place="week"] > [data-worker-view="week"]');
      const boxes = [...region.shadowRoot.querySelectorAll(".tk-day")].map((day) => day.getBoundingClientRect());
      return { left: Math.min(...boxes.map((box) => box.left)), top: Math.min(...boxes.map((box) => box.top)), right: Math.max(...boxes.map((box) => box.right)), bottom: Math.max(...boxes.map((box) => box.bottom)) };
    });
    await page.mouse.move(days.left - 4, days.top - 4);
    await page.mouse.down();
    await page.mouse.move((days.left + days.right) / 2, (days.top + days.bottom) / 2, { steps: 4 });
    await page.mouse.move(days.right + 4, days.bottom + 4, { steps: 4 });
    await shot(page, "highlight-drag");
    await page.mouse.up();
    await settled(page, "asking");
    const pointed = await page.textContent('[data-testid="section-pointed"]');
    const placeholder = await page.getAttribute('[data-testid="section-words"]', "placeholder");
    await shot(page, "highlight-card");
    await page.keyboard.type("make them taller");
    await page.keyboard.press("Enter");
    await settled(page, "draft");
    const asked = await page.evaluate(() => window.__sectionPrompts.at(-1));
    const after = await read(page);
    report.checks.aHighlightedAreaNamesWhatItCovers = {
      pointed,
      placeholder,
      askedAbout: asked?.pointed_at,
      drawn: after.draft?.This?.html?.includes("tk-pointed") ?? false,
      ok: pointed === "You pointed at the three day columns." && placeholder === "What should change here?" && asked?.pointed_at?.[0] === "the three day columns" && asked?.section === "This week" && (after.draft?.This?.html?.includes("tk-pointed") ?? false),
    };
    await page.click('[data-testid="section-discard"]');
    await page.waitForSelector(CARD, { state: "detached" });
  }

  reach("aRevisionThatDropsStylesIsRepairedOrRefused");
  {
    const from = await page.evaluate(() => window.__sectionPrompts.length);
    await choose(page, "Doing", "section-describe");
    await settled(page, "asking");
    await page.keyboard.type("drop the old look");
    await page.keyboard.press("Enter");
    await settled(page, "draft");
    const repaired = await page.evaluate((from) => window.__sectionPrompts.slice(from), from);
    const notes = await page.$$eval('[data-testid="section-note"]', (all) => all.map((one) => one.textContent));
    await page.click('[data-testid="section-discard"]');
    await page.waitForSelector(CARD, { state: "detached" });
    const from2 = await page.evaluate(() => window.__sectionPrompts.length);
    await choose(page, "Doing", "section-describe");
    await settled(page, "asking");
    await page.keyboard.type("break it");
    await page.keyboard.press("Enter");
    await settled(page, "refused");
    const refused = await page.textContent('[data-testid="section-status"]');
    const tries = await page.evaluate((from) => window.__sectionPrompts.slice(from).length, from2);
    const left = await read(page);
    await shot(page, "refused");
    report.checks.aRevisionThatDropsStylesIsRepairedOrRefused = {
      repairedBy: repaired.map((one) => one.slot),
      handedBack: repaired[1]?.what_broke ?? null,
      notes,
      refused,
      tries,
      noDraftLeft: left.draft === null && left.liveShown === true,
      ok:
        repaired.map((one) => one.slot).join() === "light,thinking" &&
        (repaired[1]?.what_broke ?? []).some((one) => /tk-doing/.test(one) && /no rule styles it/.test(one)) &&
        notes.some((note) => /Repaired once/.test(note)) &&
        /^It could not be revised without breaking the view: .*tk-doing/.test(refused ?? "") &&
        tries === 2 &&
        left.draft === null &&
        left.liveShown === true,
    };
    await page.keyboard.press("Escape");
    await page.waitForSelector(CARD, { state: "detached" });
  }

  reach("keepThenOneUndoRestoresTheView");
  {
    const before = await read(page);
    await choose(page, "Doing", "section-just-do-it");
    await settled(page, "draft");
    await page.click('[data-testid="section-keep"]');
    await settled(page, "kept");
    await page.waitForFunction(() => document.querySelector('[data-worker-view-place="week"] > [data-worker-view="week"]')?.shadowRoot?.querySelector(".tk-better"), null, { timeout: 10_000 });
    const kept = await read(page);
    const said = await page.textContent('[data-testid="section-status"]');
    const keeper = await page.evaluate(() => window.__keeper.revised("week") ?? null);
    await shot(page, "kept");
    await page.click('[data-testid="section-undo"]');
    await settled(page, "undone");
    await page.waitForFunction(() => {
      const shadow = document.querySelector('[data-worker-view-place="week"] > [data-worker-view="week"]')?.shadowRoot;
      return shadow?.querySelector(".tk-doing") && !shadow.querySelector(".tk-better");
    }, null, { timeout: 10_000 });
    const back = await read(page);
    const keeperAfter = await page.evaluate(() => window.__keeper.revised("week") ?? null);
    report.checks.keepThenOneUndoRestoresTheView = {
      keptDoing: kept.live?.Doing?.classes,
      said,
      hostKept: typeof keeper === "string" && keeper.includes("tk-better"),
      backDoing: back.live?.Doing?.classes,
      hostAfterUndo: keeperAfter,
      ok:
        kept.live?.Doing?.classes === "tk-doing tk-better" &&
        kept.draft === null &&
        said === "Kept. Kept until this page reloads." &&
        typeof keeper === "string" &&
        keeper.includes("tk-better") &&
        back.live?.Doing?.classes === "tk-doing" &&
        back.live?.Doing?.html === before.live?.Doing?.html &&
        keeperAfter === null,
    };
    await page.keyboard.press("Escape");
  }

  reach("aRevisionIsToldWithHowItEndedAndCanBeRated");
  {
    const tellings = () => page.evaluate(() => window.__told.list().map((one) => ({ words: one.words, decided: one.decided, outcome: one.outcome, rating: one.rating ?? null, target: one.target, slot: one.slot ?? null })));
    const before = (await tellings()).length;
    await choose(page, "Notes", "section-just-do-it");
    await settled(page, "draft");
    await page.waitForSelector(`${CARD} [aria-label="This was right"]`, { timeout: 10_000 });
    const offered = (await tellings()).at(-1);
    await page.click(`${CARD} [aria-label="This was right"]`);
    await page.waitForFunction(() => window.__told.list().at(-1)?.rating === "up", null, { timeout: 5_000 });
    await shot(page, "rated");
    await page.click('[data-testid="section-discard"]');
    await page.waitForSelector(CARD, { state: "detached" });
    await page.waitForFunction(() => window.__told.list().at(-1)?.outcome === "declined", null, { timeout: 5_000 });
    const all = await tellings();
    // The kept-then-undone revision of the claim before, and the refused one, were kept too.
    const outcomes = all.map((one) => one.outcome);
    report.checks.aRevisionIsToldWithHowItEndedAndCanBeRated = {
      offered,
      last: all.at(-1),
      outcomes,
      ok:
        before > 0 &&
        offered?.outcome === "previewed" &&
        offered?.decided?.type === "view" &&
        offered?.decided?.section === "Notes" &&
        offered?.target?.on === "place" &&
        offered?.target?.place === "week" &&
        offered?.slot === "light" &&
        all.at(-1)?.rating === "up" &&
        all.at(-1)?.outcome === "declined" &&
        outcomes.includes("undone") &&
        outcomes.includes("abandoned"),
    };
  }

  reach("aSeatThatMayNotChangeViewsIsNotOffered");
  {
    const visitor = await context.newPage();
    visitor.on("pageerror", (error) => errors.push(error.message));
    await ready(visitor, "?visitor=1");
    await openMenuOn(visitor, "Doing");
    const seen = await visitor.evaluate(() => {
      const menu = document.querySelector('[data-testid="context-menu"]');
      return { title: menu?.querySelector("strong")?.textContent ?? null, offered: menu?.querySelector('[data-menu-section="make-better"]') !== null, rows: [...(menu?.querySelectorAll("[data-menu-item]") ?? [])].map((row) => row.getAttribute("data-menu-item")) };
    });
    await shot(visitor, "visitor-menu");
    report.checks.aSeatThatMayNotChangeViewsIsNotOffered = { ...seen, ok: seen.title === "Doing" && seen.offered === false && !seen.rows.some((row) => row?.startsWith("section-")) };
    await visitor.close();
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
  host?.stop();
}

writeFileSync(resolve(repoRoot, "docs/section.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/section.json\n`);
process.exit(report.passed ? 0 : 1);
