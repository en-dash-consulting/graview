#!/usr/bin/env node
/**
 * A HOST THAT OWNS THE PAGE GIVES THE ROUTED FACE THE ADDRESS BAR (FR-106).
 *
 * Graview Cloud's page IS the app, and the embed's routed face ran on a
 * memory router: a place could not be linked, reloaded or shared. This
 * mounts the embed the way Cloud's shell does — `mount` over a compiled
 * document, the Graview on a desk and the pages on a phone, the app bar
 * on — with `routing: "address"` under a base path of the host's own
 * (`/apps/a1/`), on a server that answers every address under it with the
 * one page. And the same embed in somebody else's article, on the default
 * memory routing. Then it asks each engine, at a desk and a phone:
 *
 *   loading <base>/places/the-board opens that place;
 *   opening a record from the list changes the address, one entry a step;
 *   Back returns to the list, and to the place before it;
 *   a reload stays on the record;
 *   a deep link to a record opens it;
 *   the overview's tab is a step Back undoes, the scene at the overview's
 *   own address (`<base>/places/overview`) with its stop in the fragment,
 *   and a reload of the scene stays on the scene (FR-132);
 *   a link to a stop at the bare address still opens the scene, tidied to
 *   the overview's address; a host that mounts on the Graview lands there;
 *   a seat that cannot see the scene's focused record resolves the stop in
 *   place, with no step Back would have to undo;
 *   the embed in an article never writes `history` and leaves `location` as
 *   it was, a seat change included;
 *   and across a new declaration (`setApp`, FR-116), in an article and at an
 *   address: a place open on Pages stays open, the scene keeps its focus on a
 *   record, a reader on a kind the change removed lands on the home, and the
 *   article's history is never written.
 *
 *   node scripts/verify-address.mjs [--engine=chromium|webkit|firefox]   (all three by default)
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ENGINES;
const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const PROPOSAL = resolve(repoRoot, "packages/core/tests/document/fixtures/lifelogics.gdd.json");
const PROPOSAL_SEED = resolve(repoRoot, "packages/core/tests/document/fixtures/lifelogics.seed.json");
/** Where the proposal is served under address routing, for the new declarations (FR-116). */
const SWAP_BASE = "/apps/a2";
const SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
    { id: "p1", kind: "person", label: "Ada" },
  ],
  edges: [],
};
const BASE = "/apps/a1";
const SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const report = { at: new Date().toISOString(), engines, base: `${BASE}/`, checks: {} };

const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>A host's page</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}#app{position:relative;height:100vh}article #app{height:640px}</style></head>
<body>${body}<script type="module" src="/entry.js"></script></body></html>`;
/** The hosted app: the page is the app, as Cloud's is. */
const APP_PAGE = page(`<div id="app"></div>`);
/** Somebody else's article, with the app as a picture in it. */
const ARTICLE_PAGE = page(`<main><article><h1>An article</h1><p>Before the picture.</p><div id="app"></div><p>After it.</p></article></main>`);

async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-address-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { Store } from "@graview/core";
        import tasks from ${JSON.stringify(TASKS)};
        import proposal from ${JSON.stringify(PROPOSAL)};
        import proposalSeed from ${JSON.stringify(PROPOSAL_SEED)};
        const compile = (document) => {
          const compiled = compileDocumentWithoutCheck(document, { today: () => "2026-09-01" });
          if (!compiled.ok) throw new Error("the document did not compile");
          return compiled.app;
        };
        const compiled = { app: compile(tasks) };
        const article = location.pathname.startsWith("/article");
        window.__navigated = [];
        /*
         * A NEW DECLARATION UNDER THE READER (FR-116): the proposal, then the
         * same with its views changed (a new home block, a new place), or with
         * a kind taken away — each with a store of its own, as a chat's change
         * hands the host a new compiled app and a new store.
         */
        const swapping = location.pathname.startsWith("/swap") || location.pathname.startsWith("${SWAP_BASE}");
        if (swapping) {
          const mentions = (value, word) => JSON.stringify(value).includes(word);
          const changed = {
            // A chat's set-name (FR-128): the same app, called something else.
            renamed: (d) => ({ ...d, name: "A proposal, renamed" }),
            views: (d) => ({ ...d, views: { ...d.views, home: [{ headline: "A changed home" }, ...d.views.home] }, lenses: [...d.lenses, { name: "blocks", title: "The parties", on: "party", options: { blocks: [{ headline: "Who is in it" }] } }] }),
            "no-questions": (d) => {
              const { question: _q, ...kinds } = d.kinds;
              const { question: _v, ...views } = d.views;
              return {
                ...d,
                kinds,
                pages: { ...d.pages, order: d.pages.order.filter((kind) => kind !== "question") },
                lenses: d.lenses.filter((lens) => lens.on !== "question"),
                views: { ...views, home: views.home.filter((block) => !mentions(block, "question")) },
                policy: { ...d.policy, sees: d.policy.sees.map((sees) => ({ ...sees, kinds: sees.kinds.filter((kind) => kind !== "question") })) },
              };
            },
          };
          const storeFor = (app) => {
            const kinds = app.schema.kinds;
            const nodes = proposalSeed.nodes.filter((node) => kinds.includes(node.kind));
            const ids = new Set(nodes.map((node) => node.id));
            return new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes, edges: proposalSeed.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) } });
          };
          const first = compile(proposal);
          const asked = new URLSearchParams(location.search);
          window.__handle = mount(document.getElementById("app"), {
            app: first,
            store: storeFor(first),
            principal: { kind: "human", id: "owner", roles: ["owner"] },
            face: asked.get("face") ?? "pages",
            ...(asked.get("path") ? { path: asked.get("path") } : {}),
            ...(asked.get("stop") ? { stop: asked.get("stop") } : {}),
            // As Cloud's shell mounts it: labelled with the app's name, its heading a page's h1.
            ...(asked.get("named") ? { label: first.name, heading: 1 } : {}),
            bar: true,
            height: "100%",
            fonts: false,
            studio: false,
            ...(location.pathname.startsWith("/swap") ? {} : { routing: "address", basePath: "${SWAP_BASE}/" }),
          });
          window.__swap = (which) => {
            const app = compile(changed[which](proposal));
            window.__handle.setApp(app, storeFor(app));
            return window.__handle.drawn();
          };
          window.__handle.drawn().then(() => { window.__ready = true; });
        } else {
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: ${JSON.stringify(SEED)},
          principal: { kind: "human", id: "p1", roles: ["owner"] },
          // As Cloud's shell: the Graview on a desk, the pages on a phone.
          face: article ? "pages" : window.innerWidth < 768 ? "pages" : "graview",
          bar: true,
          label: "The tasks",
          heading: article ? 2 : 1,
          height: "100%",
          fonts: false,
          studio: false,
          onNavigate: (path, how) => window.__navigated.push([path, how]),
          ...(article ? {} : { routing: "address", basePath: "${BASE}/" }),
        });
        window.__handle.drawn().then(() => { window.__ready = true; });
        }`,
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
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const file = join(out, path.replace(/^\/+/, ""));
    if (path.endsWith(".js") && file.startsWith(out) && existsSync(file)) {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(readFileSync(file));
      return;
    }
    // Every address under the base is the one page, as a host that owns the page answers it.
    if (path === BASE || path.startsWith(`${BASE}/`) || path === SWAP_BASE || path.startsWith(`${SWAP_BASE}/`)) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(APP_PAGE);
      return;
    }
    if (path === "/article.html" || path === "/swap.html") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(ARTICLE_PAGE);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((ready) => host.listen(portFor("address-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

const host = await buildHost();
const errors = [];
const results = {};
/** What each engine saw across a new declaration (FR-116). */
const swaps = {};
/** The focus a stop names. */
const fromStop = (stop) => new URLSearchParams(String(stop ?? "").replace(/^#/, "")).get("focus");
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const viewport of SIZES) {
      const where = `${engine} ${viewport.width}×${viewport.height}`;
      const context = await browser.newContext({ viewport });
      /* Every write the page makes to the history: a step Back would undo is a push. */
      await context.addInitScript(() => {
        window.__writes = [];
        for (const name of ["pushState", "replaceState"]) {
          const original = history[name].bind(history);
          history[name] = (...args) => {
            window.__writes.push([name, String(args[2] ?? "")]);
            return original(...args);
          };
        }
      });
      const tab = await context.newPage();
      tab.on("pageerror", (error) => errors.push(`${where}: ${error.message}`));
      const ready = async () => {
        await tab.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await tab.waitForTimeout(500);
      };
      const go = async (path) => {
        await tab.goto(`${at("address-host")}${path}`, { waitUntil: "load" });
        await ready();
      };
      const state = () =>
        tab.evaluate(() => ({
          path: location.pathname,
          hash: location.hash,
          fragment: location.href.includes("#"),
          length: history.length,
          pushes: window.__writes.filter(([name]) => name === "pushState").length,
          replaces: window.__writes.filter(([name]) => name === "replaceState").length,
          face: document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed") ?? null,
          heading: (document.querySelector("[data-graview-face=pages] [data-graview-page-title]") ?? document.querySelector("[data-graview-face=pages] :is(h1, h2, h3, h4)"))?.textContent?.trim() ?? null,
          place: document.querySelector('[data-testid="place-lens"]') !== null,
          overviewMarked: document.querySelector('[data-testid="app-place-overview"]')?.getAttribute("aria-current") === "page",
        }));
      const settled = async () => {
        await tab.waitForTimeout(600);
        return state();
      };
      /*
       * A reload as the reader does it. Playwright's own reload in Firefox
       * adds an entry to the session history that no page wrote, so Back
       * after it lands on the same address: the page's own reload does not.
       */
      const reload = async () => {
        await Promise.all([tab.waitForEvent("load"), tab.evaluate(() => location.reload())]);
        await ready();
      };
      /* A tab on the bar, as a person presses it: under "More" when the row could not hold it. */
      const press = async (selector) => {
        const one = tab.locator(selector).first();
        if (!(await one.isVisible().catch(() => false))) await tab.click('[data-testid="app-places-more"]');
        await one.click();
      };
      const follow = async (href) => {
        await tab.click(`[data-graview-face=pages] a[href="${href}"]`, { timeout: 10_000 });
        return settled();
      };
      const one = {};
      results[where] = one;
      try {
        // A place, by its address.
        await go(`${BASE}/places/the-board`);
        one.place = await state();
        // Opening a record: to the list by its address, then the record by its link.
        one.list = await follow(`${BASE}/tasks`);
        one.record = await follow(`${BASE}/tasks/t1`);
        // Back, twice: the list, then the place.
        await tab.goBack();
        one.backToList = await settled();
        await tab.goBack();
        one.backToPlace = await settled();
        await tab.goForward();
        await tab.goForward();
        one.forwardToRecord = await settled();
        one.told = await tab.evaluate(() => window.__navigated);
        // A reload stays put.
        await reload();
        one.reloaded = await state();
        // A deep link to a record.
        await go(`${BASE}/tasks/t2`);
        one.deep = await state();
        // The overview's tab, from the place: the scene at its own address, its stop in the fragment, and Back (FR-132).
        await go(`${BASE}/places/the-board`);
        one.beforeToggle = await state();
        await press('[data-testid="app-place-overview"]');
        one.toScene = await settled();
        await reload();
        one.sceneReloaded = await state();
        await tab.goBack();
        one.toggleUndone = await settled();
        await tab.goForward();
        one.toggleRedone = await settled();
        await press('[data-place-path="/places/the-board"]');
        one.backToPages = await settled();
        // A link to a stop at the bare address, written before the scene was a place, still opens it.
        await go(`${BASE}#focus=t2`);
        one.oldStop = await state();
        // A host that mounts on the Graview at the bare address lands on the overview's place.
        await go(BASE);
        one.bare = await state();
      } catch (error) {
        one.error = String(error?.message ?? error);
      }
      try {
        /*
         * A SEAT CHANGE IS NOT A STOP. On the scene focused on a task, the
         * host seats a viewer, who sees only their own tasks: the stop is
         * resolved where it stands — the address no longer names the task,
         * and no entry is pushed whose Back lands on an address this seat
         * cannot see.
         */
        await press('[data-testid="app-place-overview"]');
        await settled();
        await tab.evaluate(() => (location.hash = "#focus=t1"));
        one.seatBefore = await settled();
        await tab.evaluate(() => window.__handle.setSeat({ kind: "human", id: "p9", roles: ["viewer"] }));
        one.seatAfter = await settled();
      } catch (error) {
        one.seatError = String(error?.message ?? error);
      }
      await context.close();

      // Somebody else's article: the history and the address are the article's, never the embed's.
      const article = await browser.newContext({ viewport });
      await article.addInitScript(() => {
        window.__writes = [];
        for (const name of ["pushState", "replaceState"]) {
          const original = history[name].bind(history);
          history[name] = (...args) => {
            window.__writes.push([name, String(args[2] ?? "")]);
            return original(...args);
          };
        }
      });
      const reader = await article.newPage();
      reader.on("pageerror", (error) => errors.push(`${where} article: ${error.message}`));
      const quiet = {};
      results[`${where} article`] = quiet;
      try {
        await reader.goto(`${at("address-host")}/article.html?from=somewhere#the-picture`, { waitUntil: "load" });
        await reader.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await reader.waitForTimeout(500);
        const where = () => reader.evaluate(() => ({ href: location.href, length: history.length, writes: window.__writes.length, heading: (document.querySelector("[data-graview-face=pages] [data-graview-page-title]") ?? document.querySelector("[data-graview-face=pages] :is(h1, h2, h3, h4)"))?.textContent?.trim() ?? null }));
        quiet.before = await where();
        await reader.click('[data-graview-face=pages] a[href="/tasks"]', { timeout: 10_000 });
        await reader.waitForTimeout(400);
        await reader.click('[data-graview-face=pages] a[href="/tasks/t1"]', { timeout: 10_000 });
        await reader.waitForTimeout(400);
        quiet.onRecord = await where();
        await reader.click('[data-testid="app-place-overview"]');
        await reader.waitForTimeout(800);
        await reader.click('[data-testid="app-home"]');
        await reader.waitForTimeout(600);
        quiet.after = await where();
        // A seat change on the scene, in the article: still the article's history, never written.
        await reader.click('[data-testid="app-place-overview"]');
        await reader.waitForTimeout(800);
        await reader.evaluate(() => window.__handle.setSeat({ kind: "human", id: "p9", roles: ["viewer"] }));
        await reader.waitForTimeout(600);
        quiet.reseated = await where();
        quiet.writes = await reader.evaluate(() => window.__writes);
      } catch (error) {
        quiet.error = String(error?.message ?? error);
      }
      await article.close();
    }

    /*
     * A NEW DECLARATION UNDER THE READER (FR-116), at a desk: the reader on
     * a place, on the scene focused on a record, on a kind the change takes
     * away — in an article (memory routing) and on a page that is the app
     * (address routing). `setApp` hands over the new app and store.
     */
    const swapped = {};
    swaps[engine] = swapped;
    try {
      const context = await browser.newContext({ viewport: SIZES[0] });
      await context.addInitScript(() => {
        window.__writes = [];
        for (const name of ["pushState", "replaceState"]) {
          const original = history[name].bind(history);
          history[name] = (...args) => {
            window.__writes.push([name, String(args[2] ?? "")]);
            return original(...args);
          };
        }
      });
      const tab = await context.newPage();
      tab.on("pageerror", (error) => errors.push(`${engine} swap: ${error.message}`));
      const look = () =>
        tab.evaluate(() => ({
          href: location.href,
          path: location.pathname,
          hash: location.hash,
          length: history.length,
          writes: window.__writes.length,
          face: document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed") ?? null,
          heading: (document.querySelector("[data-graview-face=pages] [data-graview-page-title]") ?? document.querySelector("[data-graview-face=pages] :is(h1, h2, h3, h4)"))?.textContent?.trim() ?? null,
          focused: document.querySelector('[data-graview-plane="0"]')?.dataset.graviewView ?? null,
          where: window.__handle.where(),
        }));
      const open = async (address) => {
        await tab.goto(`${at("address-host")}${address}`, { waitUntil: "load" });
        await tab.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await tab.waitForTimeout(600);
        return look();
      };
      const change = async (which) => {
        await tab.evaluate((name) => window.__swap(name), which);
        await tab.waitForTimeout(800);
        return look();
      };
      const pair = async (address, which) => {
        const before = await open(address);
        const after = await change(which);
        return { before, after };
      };
      swapped.placeInArticle = await pair(`/swap.html?face=pages&path=${encodeURIComponent("/places/the-packages")}`, "views");
      swapped.placeAtAddress = await pair(`${SWAP_BASE}/places/the-packages`, "views");
      swapped.focusInArticle = await pair(`/swap.html?face=scene&stop=${encodeURIComponent("#focus=pkg-start")}`, "views");
      swapped.focusAtAddress = await pair(`${SWAP_BASE}#focus=pkg-start`, "views");
      swapped.goneInArticle = await pair(`/swap.html?face=pages&path=${encodeURIComponent("/open-questions")}`, "no-questions");
      swapped.goneAtAddress = await pair(`${SWAP_BASE}/open-questions`, "no-questions");
      /* What the embed says it is called, on every surface that says it: its region, the workbench's heading, and the wordmark. */
      const called = () =>
        tab.evaluate(() => {
          const embed = document.querySelector("section[data-graview-embed]");
          const says = (name) => [...embed.querySelectorAll("a, span, h1, p")].filter((one) => one.textContent.trim() === name && one.children.length <= 1).length;
          // The app's name is the bar's heading (FR-131).
          const heading = embed.querySelector("[data-graview-app-bar] h1");
          return {
            face: embed.getAttribute("data-graview-embed"),
            region: embed.getAttribute("aria-label"),
            heading: heading?.textContent ?? null,
            landmarks: [...embed.querySelectorAll("nav[aria-label], main[aria-label], [role=region][aria-label]")].map((one) => one.getAttribute("aria-label")),
            old: says("A proposal"),
            renamed: says("A proposal, renamed"),
            sameDocument: window.__sameDocument === true,
          };
        });
      for (const [key, address] of [["renamedOnPages", "/swap.html?face=pages&named=1"], ["renamedOnScene", "/swap.html?face=scene&named=1"]]) {
        await open(address);
        const before = await called();
        await tab.evaluate(() => (window.__sameDocument = true));
        await tab.evaluate((name) => window.__swap(name), "renamed");
        await tab.waitForTimeout(800);
        swapped[key] = { before, after: await called() };
      }
      await context.close();
    } catch (error) {
      swapped.error = String(error?.message ?? error);
    }
    await browser.close();
    browser = undefined;
  }

  // FR-116: what each engine saw across a new declaration.
  const swapsOk = (test) => Object.keys(swaps).length === engines.length && Object.values(swaps).every((one) => !one.error && test(one));
  const memoryQuiet = ({ before, after }) => after.writes === 0 && after.href === before.href && after.length === before.length;
  report.checks.aPlaceOnPagesIsStillOpenAfterANewDeclaration = {
    seen: Object.fromEntries(Object.entries(swaps).map(([name, one]) => [name, one.error ? { error: one.error } : { article: one.placeInArticle, address: one.placeAtAddress }])),
    ok: swapsOk(({ placeInArticle, placeAtAddress }) =>
      [placeInArticle, placeAtAddress].every(({ before, after }) => before.heading === "The packages" && after.heading === "The packages" && after.face === "pages" && after.where.path === "/places/the-packages") &&
      placeAtAddress.after.path === `${SWAP_BASE}/places/the-packages` &&
      placeAtAddress.after.length === placeAtAddress.before.length,
    ),
  };
  report.checks.theSceneFocusedOnARecordKeepsItsFocus = {
    seen: Object.fromEntries(Object.entries(swaps).map(([name, one]) => [name, one.error ? { error: one.error } : { article: one.focusInArticle, address: one.focusAtAddress }])),
    ok: swapsOk(({ focusInArticle, focusAtAddress }) =>
      [focusInArticle, focusAtAddress].every(({ before, after }) => before.focused === "pkg-start" && after.focused === "pkg-start" && after.face === "scene" && fromStop(after.where.stop) === "pkg-start") &&
      fromStop(focusAtAddress.after.hash) === "pkg-start",
    ),
  };
  report.checks.aReaderOnAKindTheChangeRemovedLandsOnTheHome = {
    seen: Object.fromEntries(Object.entries(swaps).map(([name, one]) => [name, one.error ? { error: one.error } : { article: one.goneInArticle, address: one.goneAtAddress }])),
    ok: swapsOk(({ goneInArticle, goneAtAddress }) =>
      [goneInArticle, goneAtAddress].every(({ before, after }) => before.heading === "Open questions" && after.face === "pages" && after.where.path === "/" && after.heading !== null && after.heading !== "Open questions") &&
      goneAtAddress.after.path === SWAP_BASE &&
      goneAtAddress.after.length === goneAtAddress.before.length,
    ),
  };
  // FR-128: a renamed app says its new name, on both faces, with no reload.
  report.checks.aRenamedAppSaysItsNewNameOnBothFacesWithoutAReload = {
    seen: Object.fromEntries(Object.entries(swaps).map(([name, one]) => [name, one.error ? { error: one.error } : { pages: one.renamedOnPages, scene: one.renamedOnScene }])),
    ok: swapsOk(({ renamedOnPages, renamedOnScene }) =>
      [renamedOnPages, renamedOnScene].every(({ before, after }) => before.region === "A proposal" && before.old > 0 && after.sameDocument && after.region === "A proposal, renamed" && after.old === 0 && after.renamed > 0 && after.landmarks.every((name) => !name.startsWith("A proposal ·"))) &&
      renamedOnPages.after.face === "pages" &&
      renamedOnScene.after.face !== "pages" &&
      renamedOnScene.before.heading === "A proposal" &&
      renamedOnScene.after.heading === "A proposal, renamed",
    ),
  };
  report.checks.inMemoryRoutingANewDeclarationTouchesNoHistory = {
    seen: Object.fromEntries(Object.entries(swaps).map(([name, one]) => [name, one.error ? { error: one.error } : { place: one.placeInArticle?.after, focus: one.focusInArticle?.after, gone: one.goneInArticle?.after }])),
    ok: swapsOk((one) => [one.placeInArticle, one.focusInArticle, one.goneInArticle].every(memoryQuiet)),
  };

  const every = (test) => Object.entries(results).filter(([name]) => !name.endsWith("article")).every(([, one]) => !one.error && test(one));
  const pick = (key) => Object.fromEntries(Object.entries(results).filter(([name]) => !name.endsWith("article")).map(([name, one]) => [name, one.error ? { error: one.error } : one[key]]));
  report.checks.loadingAPlaceAddressOpensThatPlace = { seen: pick("place"), ok: every(({ place }) => place.face === "pages" && place.place && place.heading === "The board" && place.path === `${BASE}/places/the-board`) };
  report.checks.openingARecordChangesTheAddress = {
    seen: pick("record"),
    ok: every(({ place, list, record }) => list.path === `${BASE}/tasks` && record.path === `${BASE}/tasks/t1` && record.heading === "Write the brief" && list.length === place.length + 1 && record.length === list.length + 1),
  };
  report.checks.backReturnsToWhereYouWere = {
    seen: Object.fromEntries(Object.entries(pick("backToList")).map(([name, seen]) => [name, { list: seen, place: results[name].backToPlace, forward: results[name].forwardToRecord }])),
    ok: every(({ backToList, backToPlace, forwardToRecord }) => backToList.path === `${BASE}/tasks` && /^tasks$/i.test(backToList.heading ?? "") && backToPlace.path === `${BASE}/places/the-board` && backToPlace.place && forwardToRecord.heading === "Write the brief"),
  };
  report.checks.aReloadStaysPut = { seen: pick("reloaded"), ok: every(({ reloaded, forwardToRecord }) => reloaded.length === forwardToRecord.length && reloaded.path === `${BASE}/tasks/t1` && reloaded.face === "pages" && reloaded.heading === "Write the brief") };
  report.checks.aDeepLinkToARecordOpensIt = { seen: pick("deep"), ok: every(({ deep }) => deep.face === "pages" && deep.heading === "Book the hall") };
  report.checks.theOverviewsTabIsAStepBackUndoes = {
    seen: Object.fromEntries(Object.entries(pick("toScene")).map(([name, seen]) => [name, { before: results[name].beforeToggle, scene: seen, reloaded: results[name].sceneReloaded, undone: results[name].toggleUndone, redone: results[name].toggleRedone, pages: results[name].backToPages }])),
    ok: every(
      ({ beforeToggle, toScene, sceneReloaded, toggleUndone, toggleRedone, backToPages }) =>
        toScene.face !== "pages" &&
        toScene.overviewMarked &&
        toScene.fragment &&
        toScene.length === beforeToggle.length + 1 &&
        sceneReloaded.face !== "pages" &&
        sceneReloaded.hash === toScene.hash &&
        toggleUndone.face === "pages" &&
        toggleUndone.path === `${BASE}/places/the-board` &&
        toggleUndone.place &&
        toggleRedone.face !== "pages" &&
        toggleRedone.hash === toScene.hash &&
        backToPages.face === "pages" &&
        backToPages.path === `${BASE}/places/the-board` &&
        !backToPages.fragment,
    ),
  };
  /* FR-132: the scene is a place, at its own address, its stop riding on it. */
  report.checks.theOverviewsAddressIsItsPlaceWithItsStopOnIt = {
    seen: Object.fromEntries(Object.entries(pick("toScene")).map(([name, seen]) => [name, { scene: seen, reloaded: results[name].sceneReloaded }])),
    ok: every(({ toScene, sceneReloaded }) => toScene.path === `${BASE}/places/overview` && toScene.fragment && sceneReloaded.path === `${BASE}/places/overview` && sceneReloaded.face !== "pages" && sceneReloaded.overviewMarked),
  };
  report.checks.aLinkToAStopWrittenBeforeTheSceneWasAPlaceStillOpensIt = {
    seen: pick("oldStop"),
    ok: every(({ oldStop }) => oldStop.face === "scene" && oldStop.path === `${BASE}/places/overview` && fromStop(oldStop.hash) === "t2" && oldStop.overviewMarked),
  };
  report.checks.aHostThatMountsOnTheGraviewLandsOnTheOverview = {
    seen: Object.fromEntries(Object.entries(results).filter(([name]) => !name.endsWith("article") && name.includes("1440")).map(([name, one]) => [name, one.error ? { error: one.error } : one.bare])),
    ok: Object.entries(results)
      .filter(([name]) => !name.endsWith("article") && name.includes("1440"))
      .every(([, one]) => !one.error && one.bare.face === "graview" && one.bare.path === `${BASE}/places/overview` && one.bare.overviewMarked),
  };
  report.checks.aHostThatKeepsItsOwnHistoryIsToldEachPage = {
    seen: pick("told"),
    ok: every(({ told }) => told.some(([path, how]) => path === "/tasks/t1" && how === "push") && told.some(([path, how]) => path === "/tasks" && how === "pop") && told.some(([path, how]) => path === "/places/the-board" && how === "pop")),
  };
  report.checks.aSeatThatCannotSeeTheFocusResolvesTheStopWithoutAStep = {
    seen: Object.fromEntries(Object.entries(results).filter(([name]) => !name.endsWith("article")).map(([name, one]) => [name, one.seatError ? { error: one.seatError } : { before: one.seatBefore, after: one.seatAfter }])),
    ok: Object.entries(results)
      .filter(([name]) => !name.endsWith("article"))
      .every(
        ([, { seatError, seatBefore, seatAfter }]) =>
          !seatError &&
          seatBefore.face !== "pages" &&
          fromStop(seatBefore.hash) === "t1" &&
          seatAfter.face !== "pages" &&
          seatAfter.path === `${BASE}/places/overview` &&
          fromStop(seatAfter.hash) !== "t1" &&
          seatAfter.length === seatBefore.length &&
          seatAfter.pushes === seatBefore.pushes,
      ),
  };
  const articles = Object.entries(results).filter(([name]) => name.endsWith("article"));
  report.checks.anEmbedInAnArticleNeverTouchesTheAddressOrTheHistory = {
    seen: Object.fromEntries(articles),
    ok:
      articles.length === engines.length * SIZES.length &&
      articles.every(
        ([, quiet]) =>
          !quiet.error &&
          quiet.onRecord.heading === "Write the brief" &&
          quiet.writes.length === 0 &&
          [quiet.onRecord, quiet.after, quiet.reseated].every((seen) => seen.href === quiet.before.href && seen.length === quiet.before.length),
      ),
  };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  host.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/address.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/address.json\n");
process.exit(report.passed ? 0 : 1);
