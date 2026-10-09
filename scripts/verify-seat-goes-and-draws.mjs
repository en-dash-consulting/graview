#!/usr/bin/env node
/**
 * THE SEAT TAKES YOU WHERE YOU ASK, AND DRAWS A VIEW YOU CAN KEEP AS A LENS —
 * held to its claims in a real browser, on both faces.
 *
 * Asked for a place, a record, a kind narrowed by a date, what is wrong or
 * what a thing is, the seat moves the app there, through the addresses and
 * stops a person could have walked to; asked for a way of seeing, it draws
 * one in place of the picture, which can be changed by asking, kept as a
 * lens and taken back. This drives todo and seedbed on the scene and on
 * Pages, and Cloud's workshop document through the embed, whose host writes
 * a kept lens into the document it holds, and asks:
 *
 *   landsWhereAsked         "go to The week", "go to Pay the deposit",
 *                           "tasks due this week", "what's wrong" and
 *                           "tell me about Book the van" land on the right
 *                           place: the scene's stop, Pages' address
 *   saidInASentence         each move is said: "Went to …"
 *   backUndoes              Back walks out of a move to where the reader was
 *   hiddenNeverResolves     a member asking for Nora (a user they may not
 *                           see) is told what an absent name is told, and
 *                           nothing moves
 *   noModelCall             none of it asks anything of a model: no request
 *                           leaves the page's own server
 *   aDraftAppearsQuickly    "Show tasks as a board by day" (todo) and "Show
 *                           plantings as a board by status" (seedbed): the
 *                           drawn view is on screen within two seconds
 *   refiningReplaces        "as a calendar" replaces the draft: one frame,
 *                           now a calendar
 *   aFailedDraftKeepsTheLastGood
 *                           "group by notes" says why in one line, and the
 *                           calendar stays
 *   keptLensIsAPlace        kept, the lens is the place the reader stands in
 *                           and in the place list after a reload (todo,
 *                           "Your lenses"); its edit passes graview check;
 *                           on the workshop the host wrote it into the
 *                           document, which compiles
 *   takeBackRemovesIt       Take back takes the place away, and the host
 *                           (workshop) is handed the remove-lens edit
 *   aDrawnCalendarOpensOnTheStoresDay
 *                           "as a calendar" on todo, pinned to 1 September
 *                           2026, opens on that month, not the clock's
 *   theRoutedFaceWearsTheOneBar
 *                           todo's own design on Pages, at its own address,
 *                           stands under the one app bar as it does in an
 *                           embed: one bar holding the one Find, at most one
 *                           way to the scene and no capsule of it, "Remembered
 *                           in this browser" at the foot, nothing sideways
 *   aPhonesSheetYieldsToTheDrawnView
 *                           on a phone the open sheet, once a view is drawn,
 *                           keeps only the latest answer's lines over the
 *                           field: at most 30% of the screen, that answer
 *                           whole
 *   nothingWritesButDeclaredActs
 *                           drawing, changing, failing and discarding a
 *                           draft adds nothing to the op log
 *   whoIsWorkingIsTheGraphsToAnswer
 *                           on rota, pinned to Monday 14 September 2026,
 *                           "who's working thursday" is answered with no
 *                           model: "On Thursday 17 Sep: Ada Nowak is
 *                           working.", her name a press, no "Answered with
 *                           AI" under it, nothing asked of any server but
 *                           the page's own; and the app goes to Thursday's
 *                           shifts
 *
 *   node scripts/verify-seat-goes-and-draws.mjs [--engine=chromium|webkit|firefox] [--quick]
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const RUN = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const report = { at: new Date().toISOString(), engines: RUN, quick: QUICK, checks: {}, pageErrors: [] };
let ENGINE_NOW = RUN[0];

const SIZES = { desk: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const COMBOS = [["desk", "light"], ["phone", "dark"]];
const DAY = "today=2026-09-01";
/** How long a first draft may take to stand on screen, from the press of Enter. */
const QUICKLY_MS = 2000;

const cases = {};
const note = (claim, one) => (cases[claim] ??= []).push({ engine: ENGINE_NOW, ...one });

const WORKSHOP = resolve(repoRoot, "scripts/fixtures/desk-bar/workshop.gdd.json");
const WORKSHOP_SEED = resolve(repoRoot, "scripts/fixtures/desk-bar/workshop.seed.json");

/* ------------------------------------------------------------- the host page */

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The workshop, on a host's page</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/**
 * Cloud's workshop, mounted by a host that holds its document and writes a
 * kept lens into it — `keepLens` from `@graview/tools/keep`, the host's own
 * import, never the hosted page's — answering `{ kept: true }` when it did.
 */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-seat-draw-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { keepLens, takeBackLens } from "@graview/tools/keep";
        import workshop from ${JSON.stringify(WORKSHOP)};
        import seed from ${JSON.stringify(WORKSHOP_SEED)};
        const asked = new URLSearchParams(location.search);
        const compiled = compileDocumentWithoutCheck(workshop, { today: () => "2026-10-08" });
        window.__doc = workshop;
        window.__keeps = [];
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed,
          face: asked.get("face") === "pages" ? "pages" : "graview",
          principal: { kind: "human", id: "u:owner", roles: ["owner"] },
          label: compiled.app.name,
          heading: 1,
          height: "100dvh",
          fonts: false,
          studio: false,
          async onKeepLens(edit) {
            const result = edit.op === "add-lens" ? await keepLens({ document: window.__doc }, edit) : await takeBackLens({ document: window.__doc }, edit);
            if (result.ok) window.__doc = result.document;
            window.__keeps.push({ op: edit.op, title: edit.title, ok: result.ok, failed: result.ok ? null : result.failed, place: result.ok ? (result.place?.title ?? null) : null, lenses: (window.__doc.lenses ?? []).map((lens) => lens.title) });
            return { kept: result.ok };
          },
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
    const script = path.endsWith(".js");
    if (!file.startsWith(out) || (script && !existsSync(file))) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": script ? "text/javascript" : "text/html" });
    response.end(readFileSync(script ? file : join(out, "index.html")));
  });
  await new Promise((ready) => host.listen(portFor("seat-draw-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** graview check, in Node, over the lens a todo reader kept: `keepLens` against the declaration in code. */
async function buildChecker() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-seat-draw-check-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { keepLens } from "@graview/tools/keep";
        import { todoApp } from ${JSON.stringify(resolve(repoRoot, "apps/todo/src/domain/app.ts"))};
        export async function checkTodo(edit) {
          const result = await keepLens({ app: todoApp }, { op: "add-lens", ...edit });
          return result.ok ? { ok: true, place: result.place?.title ?? null } : { ok: false, failed: result.failed };
        }`,
      resolveDir: resolve(repoRoot, "packages/tools"),
      loader: "js",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: join(out, "check.mjs"),
    packages: "bundle",
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  const module = await import(pathToFileURL(join(out, "check.mjs")).href);
  rmSync(out, { recursive: true, force: true });
  return module;
}

/* ------------------------------------------------------------------ helpers */

const FIELD = '[data-testid="seat-field"]';

/** Opens a page of an app (or the host) and waits for its ask field. */
async function visit(page, url, ready) {
  await page.goto(url, { waitUntil: "load" });
  if (ready) await page.waitForFunction(ready, undefined, { timeout: 120_000 });
  await page.waitForSelector(FIELD, { timeout: 60_000 });
  await page.waitForTimeout(1200);
}

const turnCount = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="seat-panel"] ol > li').length);
const lastSaid = (page) =>
  page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')];
    const li = all[all.length - 1];
    return li?.querySelector("p")?.textContent?.trim() ?? li?.textContent?.trim() ?? null;
  });

/** Asks, and waits for the answer. */
async function ask(page, words) {
  if ((await page.getAttribute('[data-testid="seat"]', "data-graview-seat")) !== "open") {
    await page.click(FIELD);
    await page.waitForSelector('[data-testid="seat-panel"]', { timeout: 30_000 });
  }
  const before = await turnCount(page);
  await page.fill(FIELD, words);
  await page.press(FIELD, "Enter");
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="seat-panel"] ol > li').length >= n + 2, before, { timeout: 20_000 });
  await page.waitForTimeout(600);
  return lastSaid(page);
}

const where = (page) => page.evaluate(() => ({ path: location.pathname, search: location.search, hash: decodeURIComponent(location.hash) }));

/** Requests that leave the page's own server: a model asked. */
function watchRequests(page) {
  const out = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // The page's own server, and the app's typeface (a stylesheet the page asks for as it loads, not a question asked of anything).
    if (!["localhost", "127.0.0.1", "fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname) && url.protocol.startsWith("http")) out.push(url.host);
  });
  return out;
}

/** The five asks, and where each must land on each face. */
const ASKS = [
  { words: "go to The week", scene: (at) => at.hash.includes("in.view=the-week"), pages: (at) => at.path.endsWith("/places/the-week") },
  { words: "go to Pay the deposit", scene: (at) => at.hash.includes("focus=t-deposit"), pages: (at) => at.path.endsWith("/tasks/t-deposit") },
  { words: "tasks due this week", scene: (at) => at.hash.includes("focus=aggregate:task") && at.hash.includes("in.filter=due:after:2026-08-30"), pages: (at) => at.path.endsWith("/tasks") && decodeURIComponent(at.search).includes("due:after:2026-08-30") },
  { words: "what's wrong", scene: async (_, page) => page.evaluate(() => document.querySelector('[data-testid="problems"]') !== null), pages: (at) => at.path.endsWith("/problems") },
  { words: "tell me about Book the van", scene: (at) => at.hash.includes("focus=t-book"), pages: (at) => at.path.endsWith("/tasks/t-book") },
];

/** Draws, changes, fails and keeps a view; says how each went. */
async function drawAndKeep(page, { label, first, refine, fail, ops }) {
  const before = ops ? await ops() : null;
  await page.click(FIELD).catch(() => {});
  await page.waitForSelector('[data-testid="seat-panel"]', { timeout: 30_000 });
  await page.fill(FIELD, first);
  const pressed = Date.now();
  await page.press(FIELD, "Enter");
  const shown = await page.waitForSelector('[data-testid="draft-frame"] [data-testid="draft-lens"]', { timeout: 15_000 }).then(() => Date.now() - pressed).catch(() => null);
  note("aDraftAppearsQuickly", { at: label, ms: shown, ok: shown !== null && shown < QUICKLY_MS });
  await page.waitForTimeout(800);
  /* On a phone the open sheet yields to the view it drew: the latest answer's lines over the field, the rest is the view. */
  const sheet = await page.evaluate(() => {
    const seat = document.querySelector('[data-testid="seat"]');
    if (seat?.getAttribute("data-graview-seat-shape") !== "phone") return null;
    const box = (seat.parentElement ?? document.body).getBoundingClientRect();
    const own = seat.getBoundingClientRect();
    const said = [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')].pop();
    const body = document.querySelector('[data-testid="seat-body"]')?.getBoundingClientRect();
    const latest = said?.getBoundingClientRect();
    return { share: Math.round((own.height / Math.min(box.height, window.innerHeight)) * 100) / 100, yields: document.querySelector("[data-graview-seat-yields]") !== null, latestWhole: latest && body ? latest.top >= body.top - 1 && latest.bottom <= body.bottom + 1 : false };
  });
  if (sheet) note("aPhonesSheetYieldsToTheDrawnView", { at: label, ...sheet, ok: sheet.yields && sheet.share <= 0.3 && sheet.latestWhole });
  const drawn = await page.getAttribute('[data-testid="draft-lens"]', "data-graview-draft").catch(() => null);
  await ask(page, refine.words);
  const refined = await page.evaluate(() => ({ frames: document.querySelectorAll('[data-testid="draft-frame"]').length, lens: document.querySelector('[data-testid="draft-lens"]')?.getAttribute("data-graview-draft") ?? null }));
  note("refiningReplaces", { at: label, drawn, ...refined, ok: drawn !== null && refined.frames === 1 && refined.lens === refine.lens && refined.lens !== drawn });
  /* Todo is pinned to 1 September 2026 (`?today=`): a calendar drawn there opens on that month, with "Book the van" (due that day) in it. */
  if (refine.lens === "calendar" && /^todo /.test(label)) {
    const opened = await page.evaluate(() => document.querySelector('[data-testid="draft-lens"] [data-graview-pick="t-book"]') !== null);
    note("aDrawnCalendarOpensOnTheStoresDay", { at: label, bookTheVanInView: opened, ok: opened });
  }
  const said = await ask(page, fail);
  const failed = await page.evaluate(() => ({ note: document.querySelector('[data-testid="draft-note"]')?.textContent?.trim() ?? null, lens: document.querySelector('[data-testid="draft-lens"]')?.getAttribute("data-graview-draft") ?? null }));
  note("aFailedDraftKeepsTheLastGood", { at: label, said, ...failed, ok: failed.note !== null && /^Couldn't/.test(failed.note) && failed.lens === refine.lens });
  if (ops) {
    const after = await ops();
    note("nothingWritesButDeclaredActs", { at: `${label} drawn, changed, failed`, before, after, ok: before === after });
  }
}

/* --------------------------------------------------------------------- run */

let browser;
const servers = [];
let host;
let checker;
try {
  servers.push(await serving("todo", portFor("todo"), repoRoot));
  servers.push(await serving("seedbed", portFor("seedbed"), repoRoot));
  servers.push(await serving("rota", portFor("rota"), repoRoot));
  host = await buildHost().catch((error) => {
    report.hostError = String(error).split("\n")[0].slice(0, 200);
    return null;
  });
  checker = await buildChecker().catch((error) => {
    report.checkerError = String(error).split("\n")[0].slice(0, 200);
    return null;
  });
  for (const engine of RUN) {
    ENGINE_NOW = engine;
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const [size, scheme] of COMBOS) {
      const context = await browser.newContext({ viewport: SIZES[size], colorScheme: scheme });
      for (const face of ["scene", "pages"]) {
        const label = `${size} ${scheme} ${face}`;
        const base = face === "scene" ? `${at("todo")}/` : `${at("todo")}/pages/`;
        const ready = face === "scene" ? () => "__todoReady" in window : undefined;

        /* The five asks, each landing; Back out of the first. */
        try {
          const page = await context.newPage();
          page.on("pageerror", (error) => report.pageErrors.push(`${ENGINE_NOW} ${label}: ${String(error).slice(0, 200)}`));
          const left = watchRequests(page);
          await visit(page, `${base}?${DAY}&fresh=1`, ready);
          for (const [index, one] of ASKS.entries()) {
            const was = await where(page);
            const said = await ask(page, one.words);
            const now = await where(page);
            const landed = await one[face](now, page);
            note("landsWhereAsked", { at: `${label}: ${one.words}`, now: `${now.path}${now.search}${now.hash}`, ok: landed === true });
            note("saidInASentence", { at: `${label}: ${one.words}`, said: said?.slice(0, 100) ?? null, ok: typeof said === "string" && /^Went to /.test(said) });
            if (index === 0) {
              await page.goBack();
              await page.waitForTimeout(700);
              const back = await where(page);
              note("backUndoes", { at: label, was: `${was.path}${was.hash}`, back: `${back.path}${back.hash}`, ok: back.path === was.path && back.hash === was.hash });
            }
          }
          note("noModelCall", { at: label, left: [...new Set(left)], ok: left.length === 0 });
          await page.close();
        } catch (error) {
          note("landsWhereAsked", { at: label, why: String(error).split("\n")[0].slice(0, 160), ok: false });
        }

        /* Who is working on a named day: the graph's to answer, on the rota, with no model. */
        try {
          const page = await context.newPage();
          page.on("pageerror", (error) => report.pageErrors.push(`${ENGINE_NOW} rota ${label}: ${String(error).slice(0, 200)}`));
          const left = watchRequests(page);
          const rota = face === "scene" ? `${at("rota")}/` : `${at("rota")}/pages/`;
          await visit(page, `${rota}?today=2026-09-14&fresh=1`, face === "scene" ? () => "__rotaReady" in window : undefined);
          const said = await ask(page, "who's working thursday");
          const turn = await page.evaluate(() => {
            const li = [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')].at(-1);
            return {
              picks: [...(li?.querySelectorAll("[data-chat-pick]") ?? [])].map((press) => press.textContent?.trim()),
              withAi: Boolean(li?.querySelector('[data-testid="seat-answered-with-ai"]')),
            };
          });
          const now = await where(page);
          const thursday = `${decodeURIComponent(now.search)}${now.hash}`.includes("on:after:2026-09-16");
          note("whoIsWorkingIsTheGraphsToAnswer", {
            at: `rota ${label}`,
            said: said?.slice(0, 120) ?? null,
            ...turn,
            landed: `${now.path}${now.search}${now.hash}`.slice(0, 160),
            left: [...new Set(left)],
            ok: typeof said === "string" && said.startsWith("On Thursday 17 Sep: Ada Nowak is working.") && turn.picks.includes("Ada Nowak") && !turn.withAi && left.length === 0 && thursday,
          });
          await page.close();
        } catch (error) {
          note("whoIsWorkingIsTheGraphsToAnswer", { at: `rota ${label}`, why: String(error).split("\n")[0].slice(0, 160), ok: false });
        }

        /* The todo design's pages under the one bar: what the embed's pages face wears, at the app's own address. */
        if (face === "pages") {
          try {
            const page = await context.newPage();
            await visit(page, `${base}tasks/t-deposit?${DAY}`, ready);
            const chrome = await page.evaluate(() => {
              const bars = document.querySelectorAll("[data-graview-app-bar]");
              const scene = [...document.querySelectorAll("a, button")].filter((one) => /In the scene/.test(one.textContent ?? ""));
              const remembered = document.querySelector('[data-testid="remembered"]');
              return {
                bars: bars.length,
                sceneLinks: scene.length,
                capsules: scene.filter((one) => parseFloat(getComputedStyle(one).borderTopLeftRadius) >= 12).length,
                findsOutsideTheBar: [...document.querySelectorAll('input[type="search"]')].filter((one) => !bars[0]?.contains(one)).length,
                rememberedAtTheFoot: remembered === null || remembered.closest("footer") !== null,
                sideways: document.documentElement.scrollWidth - window.innerWidth,
              };
            });
            note("theRoutedFaceWearsTheOneBar", { at: label, ...chrome, ok: chrome.bars === 1 && chrome.sceneLinks <= 1 && chrome.capsules === 0 && chrome.findsOutsideTheBar === 0 && chrome.rememberedAtTheFoot && chrome.sideways <= 0 });
            await page.close();
          } catch (error) {
            note("theRoutedFaceWearsTheOneBar", { at: label, why: String(error).split("\n")[0].slice(0, 160), ok: false });
          }
        }

        /* A member asks for somebody they may not see. */
        try {
          const page = await context.newPage();
          await visit(page, `${base}?${DAY}&fresh=1&as=user-sam`, ready);
          const was = await where(page);
          const hidden = await ask(page, "go to Nora");
          const absent = await ask(page, "go to Zebedee");
          const now = await where(page);
          note("hiddenNeverResolves", { at: label, hidden, absent, ok: hidden === "Nothing by that name here." && hidden === absent && now.path === was.path && now.hash === was.hash });
          await page.close();
        } catch (error) {
          note("hiddenNeverResolves", { at: label, why: String(error).split("\n")[0].slice(0, 160), ok: false });
        }

        /* Draw, change, fail, keep, reload, take back: todo's "Your lenses". */
        try {
          const page = await context.newPage();
          page.on("pageerror", (error) => report.pageErrors.push(`${ENGINE_NOW} ${label} draft: ${String(error).slice(0, 200)}`));
          const left = watchRequests(page);
          await visit(page, `${base}?${DAY}&fresh=1`, ready);
          await page.evaluate(() => localStorage.removeItem("graview:lenses:Things"));
          await drawAndKeep(page, { label: `todo ${label}`, first: "Show tasks as a board by day", refine: { words: "as a calendar", lens: "calendar" }, fail: "group by notes" });
          await page.click('[data-testid="draft-keep"]');
          await page.waitForSelector('[data-testid="draft-frame"]', { state: "detached", timeout: 10_000 });
          await page.waitForTimeout(1000);
          const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("graview:lenses:Things") ?? "[]"));
          const title = kept[0]?.title ?? null;
          const there = await where(page);
          const standing = face === "scene" ? there.hash.includes(`in.view=${(title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`) : there.path.endsWith(`/places/${(title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
          await page.reload({ waitUntil: "load" });
          if (ready) await page.waitForFunction(ready, undefined, { timeout: 120_000 });
          await page.waitForTimeout(1500);
          const listed = await page.evaluate((name) => {
            const nav = document.querySelector('[data-testid="app-bar"] nav, [data-testid="app-place-line"] nav') ?? document.querySelector("nav");
            return (nav?.textContent ?? "").includes(name);
          }, title ?? "\u0000");
          const checked = checker && kept[0] ? await checker.checkTodo(kept[0]) : { ok: false, failed: report.checkerError ?? "nothing kept" };
          note("keptLensIsAPlace", { at: `todo ${label}`, title, there: `${there.path}${there.hash}`, standing, listed, checked, ok: title !== null && standing && listed && checked.ok === true });
          /* Take back: from the notice on the scene, from the conversation on Pages. */
          await page.click(FIELD);
          await page.waitForSelector('[data-testid="seat-panel"]');
          const turn = await page.$('[data-testid="seat-take-back"]');
          if (turn) await turn.click();
          await page.waitForTimeout(1000);
          const after = await page.evaluate(() => localStorage.getItem("graview:lenses:Things"));
          const gone = await page.evaluate((name) => !((document.querySelector('[data-testid="app-bar"] nav, [data-testid="app-place-line"] nav') ?? document.querySelector("nav"))?.textContent ?? "").includes(name), title ?? "\u0000");
          note("takeBackRemovesIt", { at: `todo ${label}`, pressed: turn !== null, after, gone, ok: turn !== null && after === null && gone });
          note("noModelCall", { at: `todo ${label} drawing`, left: [...new Set(left)], ok: left.length === 0 });
          await page.close();
        } catch (error) {
          for (const claim of ["keptLensIsAPlace", "takeBackRemovesIt"]) note(claim, { at: `todo ${label}`, why: String(error).split("\n")[0].slice(0, 160), ok: false });
        }

        /* Seedbed: a first draft, quickly. */
        if (size === "desk") {
          try {
            const page = await context.newPage();
            await visit(page, `${at("seedbed")}/${face === "pages" ? "pages/" : ""}?fresh=1`, face === "scene" ? () => "__seedbedReady" in window : undefined);
            await page.click(FIELD);
            await page.waitForSelector('[data-testid="seat-panel"]');
            await page.fill(FIELD, "Show plantings as a board by status");
            const pressed = Date.now();
            await page.press(FIELD, "Enter");
            const shown = await page.waitForSelector('[data-testid="draft-lens"]', { timeout: 15_000 }).then(() => Date.now() - pressed).catch(() => null);
            note("aDraftAppearsQuickly", { at: `seedbed ${label}`, ms: shown, ok: shown !== null && shown < QUICKLY_MS });
            await page.close();
          } catch (error) {
            note("aDraftAppearsQuickly", { at: `seedbed ${label}`, why: String(error).split("\n")[0].slice(0, 160), ok: false });
          }
        }
      }

      /* Cloud's workshop: the host writes the kept lens into its document. */
      for (const face of host ? ["graview", "pages"] : []) {
        const label = `workshop ${size} ${scheme} ${face}`;
        try {
          const page = await context.newPage();
          page.on("pageerror", (error) => report.pageErrors.push(`${ENGINE_NOW} ${label}: ${String(error).slice(0, 200)}`));
          await page.goto(`${at("seat-draw-host")}/?face=${face}`, { waitUntil: "load" });
          await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 120_000 });
          await page.waitForSelector(FIELD, { timeout: 60_000 });
          await page.waitForTimeout(1000);
          const ops = () => page.evaluate(() => window.__handle.store.log.length);
          await drawAndKeep(page, { label, first: "a board of decisions by status", refine: { words: "as a list", lens: "blocks" }, fail: "group by name", ops });
          // The seat put away first: the keeping is said in a notice, with Take back.
          await page.focus(FIELD);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          await page.click('[data-testid="draft-keep"]');
          await page.waitForFunction(() => window.__keeps.length >= 1, undefined, { timeout: 15_000 });
          await page.waitForTimeout(1000);
          const keeps = await page.evaluate(() => window.__keeps);
          const kept = keeps[0];
          const current = await page.evaluate(() => document.querySelector('[data-testid="app-place-current"]')?.textContent?.trim() ?? document.querySelector('[data-testid="app-bar"]')?.textContent ?? "");
          note("keptLensIsAPlace", { at: label, kept, current: current.slice(0, 80), ok: kept?.ok === true && kept.place === kept.title && kept.lenses.includes(kept.title) && current.includes(kept.title) });
          /* Take back, from the notice. */
          const notice = page.locator("[data-testid=\"notice-action\"]", { hasText: "Take back" }).first();
          const pressed = await notice.isVisible().catch(() => false);
          if (pressed) await notice.click();
          await page.waitForFunction(() => window.__keeps.length >= 2, undefined, { timeout: 15_000 }).catch(() => {});
          const back = await page.evaluate(() => window.__keeps[1] ?? null);
          note("takeBackRemovesIt", { at: label, notice: pressed, back, ok: pressed && back?.op === "remove-lens" && back.ok === true && !back.lenses.includes(kept?.title) });
          /* Discarding writes nothing either: draw again and put it away. */
          const before = await ops();
          await ask(page, "a board of decisions by status");
          await page.click('[data-testid="draft-discard"]').catch(() => {});
          await page.waitForTimeout(500);
          note("nothingWritesButDeclaredActs", { at: `${label} kept and discarded`, before, after: await ops(), ok: before === (await ops()) });
          await page.close();
        } catch (error) {
          for (const claim of ["keptLensIsAPlace", "takeBackRemovesIt"]) note(claim, { at: label, why: String(error).split("\n")[0].slice(0, 160), ok: false });
        }
      }
      if (!host) note("keptLensIsAPlace", { at: "workshop", why: report.hostError, ok: false });
      await context.close();
    }
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
  for (const server of servers) server.stop();
  host?.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/seat-goes-and-draws.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const said = Object.entries(report.checks).map(([name, check]) => `${check.ok ? "ok  " : "FAIL"} ${name} (${check.cases})`).join("\n");
process.stdout.write(`${said}${report.error ? `\n${report.error}` : ""}${report.pageErrors.length ? `\npage errors: ${report.pageErrors.length}` : ""}\n\nwrote docs/seat-goes-and-draws.json\n`);
process.exit(report.passed ? 0 : 1);
