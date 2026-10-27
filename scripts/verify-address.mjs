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
 *   the switch's Scene is a step Back undoes, the scene at its own address
 *   (`<base>/places/overview`, FR-132) with its stop in the fragment, a
 *   reload of the scene stays on the scene, and the switch's Pages goes
 *   back to the page the reader was on (FR-137); a picture of the scene's
 *   chosen from the bar moves the scene's `in.view` and its address
 *   together, a step Back undoes (FR-144);
 *   from Up, a lens double-clicked on its district goes down into it — the
 *   kind in focus, that picture `in.view`, the address saying so — and Back
 *   returns to Up;
 *   from an address nothing lives at, the switch's Scene lands where the
 *   scene opens — at altitude, or where the declaration says — never on the
 *   empty view (FR-157);
 *   a link to a stop at the bare address still opens the scene, tidied to
 *   the scene's address; a host that mounts on the Graview lands there —
 *   unless the app has a home view, which it then opens on (FR-136);
 *   the overview's address alone — what a server hands back, never having
 *   seen a fragment — opens the overview at altitude, writes no fragment
 *   and stays there on a reload, and one that says where it stands is
 *   respected (FR-154);
 *   a seat that cannot see the scene's focused record resolves the stop in
 *   place, with no step Back would have to undo;
 *   the embed in an article never writes `history` and leaves `location` as
 *   it was, a seat change included;
 *   across a new declaration (`setApp`, FR-116), in an article and at an
 *   address: a place open on Pages stays open, the scene keeps its focus on a
 *   record, a reader on a kind the change removed lands on the home, and the
 *   article's history is never written;
 *   and a record a lens draws as a link answers the menu under the base
 *   (FR-189): a board's card links to `<base>/tasks/t1`, its menu —
 *   right-clicked at a desk, a finger resting on it on a phone — has Open,
 *   the task's acts and Move to ›, which moves it, and "Open in a new tab"
 *   keeps the base; a blocks lens's card, grouped by status, the same;
 *   and a view the host keeps (a script view registered by its manifest
 *   name, as Cloud's `propose_view` makes one) that `pages.order` and
 *   `pages.first` name as `view:to-do` is where the bare address opens,
 *   stands first among the Pages drop-down's lists, while a kind
 *   `pages.hide` names is out of the drop-down and still opens at its
 *   address (Roadmap q-custom-views-in-nav); a view of that app eighty
 *   entries long is a card on the Scene, held to its box and the window,
 *   at the content height its host measured, faded at its foot with Open —
 *   nothing in it scrolls — and Open lands on its place on Pages, where it
 *   flows whole, while a view that says `flows: false` keeps its place's
 *   frame and its preview keeps to its `scene.maxHeight` (Roadmap
 *   f-view-content-height); a view of one task eighty notes long is the
 *   same card — no longer the record in focus scrolling inside its box
 *   (FR-141) — and its Open lands on the task's page, while in the
 *   whole-page Shell, which has no Pages, Expand grows the card in place
 *   from its top to what it drew and Collapse takes it back (Roadmap
 *   f-scene-record-view-card);
 *   and views that say `bleed: true` — the home's, a record's — span the
 *   phone's width less its safe areas, where the page's 20px gutter stood
 *   either side of them, and are the column's width at a desk; a record
 *   page with a page slot and a view that does not replace the page draws
 *   the view, then the slot's blocks, then the facts, while one whose view
 *   replaces the page draws the view alone (Roadmap
 *   feature:views-on-phones-…-full-bleed,
 *   feature:page-slot-blocks-on-a-kind-with-a-record-view-…);
 *   a view whose content is wider than a phone (an SVG 640 wide in a box
 *   that scrolls sideways) never widens the page, on a place and a
 *   record's page; a place whose view says `bleed: true` spans the phone
 *   as the home does; where a view that bleeds did not draw, the page drawn
 *   in its stead keeps the column's gutters; a view that says `heading:
 *   "own"` is titled once, by itself; and a record's "Seen in" names each
 *   place once, past four the first three on a phone with a button for the rest
 *   (Roadmap f-view-place-min-width, f-bleed-on-places,
 *   f-fallback-lens-loses-gutter, f-place-header-repeats-view-title,
 *   f-seen-in-phone-length).
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
import { vacant } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ENGINES;
const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const PROPOSAL = resolve(repoRoot, "packages/core/tests/document/fixtures/lifelogics.gdd.json");
const PROPOSAL_SEED = resolve(repoRoot, "packages/core/tests/document/fixtures/lifelogics.seed.json");
/** Where the proposal is served under address routing, for the new declarations (FR-116). */
const SWAP_BASE = "/apps/a2";
/** Where the tasks are served with a blocks lens of cards beside the board (FR-189). */
const CARDS_BASE = "/apps/a3";
/** Cards grouped by where each task stands, as Cloud's Roadmap draws its features by stage. */
const BY_STATUS = { name: "blocks", title: "By status", on: "task", options: { blocks: [{ list: "all('task')", group: { by: "status" }, sort: "label", as: "card" }] } };
/** Where the tasks are served with a view the host keeps, ordered first and opened on, and the people kept off the places. */
const VIEWS_BASE = "/apps/a4";
const TO_DO = { name: "to-do", title: "To do", attach: "task", cardinality: "many" };
const TO_DO_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<ul class="to-do">\${props.nodes.map((task) => graview.html\`<li>\${task.label}</li>\`)}</ul>\`));`;
const VIEWS_PAGES = { order: ["view:to-do", "task"], first: "view:to-do", hide: ["person"] };
/** A view of the tasks far taller than a screen, and one that is a fixed canvas (Roadmap f-view-content-height). */
const THE_LOG = { name: "the-log", title: "The log", attach: "task", cardinality: "many" };
const THE_LOG_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<ol class="log">\${Array.from({ length: 80 }, (_, at) => graview.html\`<li>Entry \${at + 1} of the log</li>\`)}</ol>\`));`;
const THE_MAP = { name: "the-map", title: "The map", attach: "task", cardinality: "many", flows: false, scene: { maxHeight: 320 } };
/** A view of one task far taller than a screen (Roadmap f-scene-record-view-card): on the Scene, a card whose Open lands on the task's page. */
const NOTES = { name: "notes", attach: "task", cardinality: "one" };
const NOTES_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<ol class="notes">\${Array.from({ length: 80 }, (_, at) => graview.html\`<li>Note \${at + 1} on \${props.node ? props.node.label : ""}</li>\`)}</ol>\`));`;
/** The whole-page Shell, with no Pages beside it: the Scene has no page door, so a card is expanded in place. */
const SHELL_BASE = "/shell";
const THE_MAP_SOURCE =`graview.onProps((props) => graview.render(graview.html\`<div class="map" style="height:1200px">A map of \${props.nodes.length} tasks</div>\`));`;
/** Where the tasks are served with views that bleed to a phone's edges, and page slots beside a record's view. */
const FITTED_BASE = "/apps/a5";
/** A page slot on each kind: the task's under a view that sits above the page, the person's under one that replaces it. */
const FITTED_VIEWS = { task: { page: [{ headline: "Read the sources" }, { text: "Each source, in turn." }] }, person: { page: [{ headline: "Who they are" }] } };
/** What a phone's width cannot hold: a chart 640 wide in a box that scrolls sideways, and a row of tabs (Roadmap f-view-place-min-width). */
const WIDE_CONTENT = `<div class="scroller" style="overflow-x:auto"><svg width="640" height="40" style="min-width:640px"><rect width="640" height="40" fill="currentColor"></rect></svg></div><p class="tabs" style="white-space:nowrap">\${["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"].map((tab) => graview.html\`<button>Tab \${tab}</button>\`)}</p>`;
const HERO = { name: "hero", attach: "home", cardinality: "many", bleed: true };
const HERO_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<div class="hero">The things to do</div>\`));`;
const BRIEF = { name: "brief", attach: "task", cardinality: "one", bleed: true };
const BRIEF_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<p class="brief">\${props.node ? props.node.label : ""}</p>${WIDE_CONTENT}\`));`;
/** A place whose view draws its own heading, and wide content (Roadmap f-place-header-repeats-view-title). */
const WIDE = { name: "wide", title: "The wide", attach: "task", cardinality: "many", heading: "own" };
const WIDE_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<h2 class="own">The wide</h2>${WIDE_CONTENT}\`));`;
/** A place whose view bleeds (Roadmap f-bleed-on-places). */
const EDGE = { name: "edge", title: "The edge", attach: "task", cardinality: "many", bleed: true };
const EDGE_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<div class="edge">\${props.nodes.length} tasks</div>${WIDE_CONTENT}\`));`;
/** A place whose view bleeds and is refused before it starts — an act the app does not declare — so the kind's own face is drawn in its stead (Roadmap f-fallback-lens-loses-gutter). */
const BROKEN = { name: "broken", title: "The broken", attach: "task", cardinality: "many", bleed: true, acts: ["no-such-act"] };
/** A fifth place a task is seen in, so a phone's "Seen in" folds what is past the third (Roadmap f-seen-in-phone-length). */
const PLAIN = { name: "plain", title: "The plain", attach: "task", cardinality: "many" };
const CARD = { name: "card", attach: "person", cardinality: "one", replaces: "page" };
const CARD_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<p class="card">\${props.node ? props.node.label : ""}</p>\`));`;
/*
 * A DELETED HOME VIEW REGISTERED AFTER THE LIVE ONE (FR-202), as Graview
 * Cloud hands a page its deleted views so Restore works in place: in the
 * Eagles app the deleted `eagles-story` drew over the live `eagles-nest`.
 */
const HOMES_BASE = "/apps/a6";
const NEST = { name: "eagles-nest", attach: "home", cardinality: "many" };
const NEST_SOURCE = `graview.onProps(() => graview.render(graview.html\`<p class="nest">The nest, live</p>\`));`;
const STORY = { name: "eagles-story", attach: "home", cardinality: "many" };
const STORY_SOURCE = `graview.onProps(() => graview.render(graview.html\`<p class="story">The story, deleted this morning</p>\`));`;
const STORY_REMOVED = { name: "eagles-story", title: "The story", at: "2026-10-22T09:00:00.000Z", until: "2026-11-21T09:00:00.000Z" };
/*
 * A VISITOR'S FORM AS GRAVIEW CLOUD SERVES IT (FR-201): `@graview/embed/form`
 * over the app its host compiled, read with `appFrom` from
 * `@graview/core/compiled`, never the document compiler.
 */
const FORM_BASE = "/form";
const RSVP = resolve(repoRoot, "packages/core/tests/document/fixtures/rsvp.gdd.json");
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
        import { mount as mountForm } from "@graview/embed/form";
        import { appFrom, serializeCompiled } from "@graview/core/compiled";
        import { registerWorkerView } from "@graview/guest/host/views";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { Store } from "@graview/core";
        import tasks from ${JSON.stringify(TASKS)};
        import proposal from ${JSON.stringify(PROPOSAL)};
        import proposalSeed from ${JSON.stringify(PROPOSAL_SEED)};
        import rsvp from ${JSON.stringify(RSVP)};
        const compile = (document) => {
          const compiled = compileDocumentWithoutCheck(document, { today: () => "2026-09-01" });
          if (!compiled.ok) throw new Error("the document did not compile");
          return compiled.app;
        };
        const cards = location.pathname.startsWith("${CARDS_BASE}");
        const kept = location.pathname.startsWith("${VIEWS_BASE}");
        const fitted = location.pathname.startsWith("${FITTED_BASE}");
        const homes = location.pathname.startsWith("${HOMES_BASE}");
        const formPage = location.pathname.startsWith("${FORM_BASE}");
        const compiled = { app: compile(cards ? { ...tasks, lenses: [...tasks.lenses, ${JSON.stringify(BY_STATUS)}] } : kept ? { ...tasks, pages: ${JSON.stringify(VIEWS_PAGES)} } : fitted ? { ...tasks, pages: { first: "home" }, views: ${JSON.stringify(FITTED_VIEWS)} } : homes ? { ...tasks, pages: { first: "home" } } : tasks) };
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
            // As Cloud's shell mounts it: labeled with the app's name, its heading a page's h1.
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
        } else if (location.pathname.startsWith("${SHELL_BASE}")) {
          /*
           * THE WHOLE-PAGE SHELL, WITH NO PAGES (Roadmap f-scene-record-view-card):
           * the Scene alone, the task in focus, its view of one record kept by
           * its manifest — and no page door, so its card has no Open.
           */
          /* React and its DOM are CommonJS: a dynamic import hands them as the module's default. */
          const [{ registerDefaultViews, Shell }, { createViews, GraviewProvider }, { EMPTY_VIEW }, react, client] = await Promise.all([
            import("@graview/primitives"),
            import("@graview/react"),
            import("@graview/layout"),
            import("react"),
            import("react-dom/client"),
          ]);
          const createElement = react.createElement ?? react.default.createElement;
          const createRoot = client.createRoot ?? client.default.createRoot;
          const app = compiled.app;
          const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: ${JSON.stringify(SEED)} });
          const views = registerWorkerView(registerDefaultViews(app.schema, createViews(app.schema)), { manifest: ${JSON.stringify(NOTES)}, worker: { source: ${JSON.stringify(NOTES_SOURCE)} } });
          createRoot(document.getElementById("app")).render(
            createElement(GraviewProvider, { store, views, initialView: { ...EMPTY_VIEW, focusId: "t1" } }, createElement(Shell, { scheme: "light", onScheme: () => {}, syncUrl: false, remembers: false, renderer: "dom" })),
          );
          window.__ready = true;
        } else if (formPage) {
          /* The host compiled the form's app on its server and hands it to the page as JSON; the page reads it without compiling. */
          const handed = JSON.parse(JSON.stringify(serializeCompiled(compileDocumentWithoutCheck(rsvp))));
          const read = appFrom(handed);
          if (!read.ok) throw new Error("the compiled app could not be read");
          window.__handle = mountForm(document.getElementById("app"), { app: read.app, seed: { nodes: [], edges: [] }, form: "rsvp", principal: "form:tok-1", scheme: "light", fonts: false });
          window.__ready = true;
        } else {
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: ${JSON.stringify(SEED)},
          principal: { kind: "human", id: "p1", roles: ["owner"] },
          // As Cloud's shell: the Graview on a desk, the pages on a phone; the kept view's app on the pages at both.
          face: article || kept || fitted || homes ? "pages" : window.innerWidth < 768 ? "pages" : "graview",
          // A view the host keeps, registered by its manifest's name as Cloud registers a chat's view.
          ...(kept
            ? {
                views: (schema, registry) =>
                  [[${JSON.stringify(TO_DO)}, ${JSON.stringify(TO_DO_SOURCE)}], [${JSON.stringify(THE_LOG)}, ${JSON.stringify(THE_LOG_SOURCE)}], [${JSON.stringify(THE_MAP)}, ${JSON.stringify(THE_MAP_SOURCE)}], [${JSON.stringify(NOTES)}, ${JSON.stringify(NOTES_SOURCE)}]].reduce(
                    (views, [manifest, source]) => registerWorkerView(views, { manifest, worker: { source } }),
                    registry,
                  ),
              }
            : {}),
          // Kept views that bleed to a phone's edges, and a record view beside its kind's page slot or in place of it.
          ...(fitted
            ? {
                views: (schema, registry) =>
                  [[${JSON.stringify(HERO)}, ${JSON.stringify(HERO_SOURCE)}], [${JSON.stringify(BRIEF)}, ${JSON.stringify(BRIEF_SOURCE)}], [${JSON.stringify(CARD)}, ${JSON.stringify(CARD_SOURCE)}], [${JSON.stringify(WIDE)}, ${JSON.stringify(WIDE_SOURCE)}], [${JSON.stringify(EDGE)}, ${JSON.stringify(EDGE_SOURCE)}], [${JSON.stringify(BROKEN)}, ${JSON.stringify(EDGE_SOURCE)}], [${JSON.stringify(PLAIN)}, ${JSON.stringify(HERO_SOURCE)}]].reduce(
                    (views, [manifest, source]) => registerWorkerView(views, { manifest, worker: { source } }),
                    registry,
                  ),
              }
            : {}),
          // The live home first, the deleted one after it, and the host listing it deleted (FR-202).
          ...(homes
            ? {
                views: (schema, registry) =>
                  [[${JSON.stringify(NEST)}, ${JSON.stringify(NEST_SOURCE)}], [${JSON.stringify(STORY)}, ${JSON.stringify(STORY_SOURCE)}]].reduce(
                    (views, [manifest, source]) => registerWorkerView(views, { manifest, worker: { source } }),
                    registry,
                  ),
                keptViews: {
                  current: () => ({ hidden: [], removed: [${JSON.stringify(STORY_REMOVED)}], may: { views: true, lenses: false } }),
                  hide: () => {},
                  show: () => {},
                  remove: () => {},
                  restore: () => {},
                },
              }
            : {}),
          bar: true,
          label: "The tasks",
          heading: article ? 2 : 1,
          height: "100%",
          fonts: false,
          studio: false,
          onNavigate: (path, how) => window.__navigated.push([path, how]),
          ...(article ? {} : { routing: "address", basePath: cards ? "${CARDS_BASE}/" : kept ? "${VIEWS_BASE}/" : fitted ? "${FITTED_BASE}/" : homes ? "${HOMES_BASE}/" : "${BASE}/" }),
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
    // Every package draws with React's automatic runtime (its tsconfig's `react-jsx`), which esbuild does not read for a .tsx a plugin resolved: the visitor's form is one.
    jsx: "automatic",
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
    if ([BASE, SWAP_BASE, CARDS_BASE, VIEWS_BASE, FITTED_BASE, SHELL_BASE, HOMES_BASE, FORM_BASE].some((base) => path === base || path.startsWith(`${base}/`))) {
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
  await vacant(portFor("address-host"));
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
          scenePressed: document.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed") === "true",
          homeView: document.querySelector('[data-testid="home-view"]') !== null,
        }));
      const settled = async () => {
        await tab.waitForTimeout(600);
        return state();
      };
      /*
       * THE BOX A PLACE IS DRAWN IN: whether it flows with the page or is a
       * frame of its own, and every box from what the place drew up to the
       * place's own that scrolls inside itself — a nested scroller, under
       * the page's own, is what traps a thumb on a phone.
       */
      const placeFrame = (inner) =>
        tab.evaluate((inside) => {
          const lens = document.querySelector('[data-testid="place-lens"]');
          if (!lens) return null;
          const scrolls = (el) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY);
          const scrollers = [];
          for (let el = (inside && lens.querySelector(inside)) || lens; el; el = el === lens ? null : el.parentElement) {
            if (scrolls(el)) scrollers.push(el.getAttribute("data-testid") ?? el.tagName.toLowerCase());
          }
          return { flows: lens.hasAttribute("data-flows"), scrolls: scrolls(lens), height: lens.style.height || null, scrollers };
        }, inner ?? null);
      /*
       * A reload as the reader does it. Playwright's own reload in Firefox
       * adds an entry to the session history that no page wrote, so Back
       * after it lands on the same address: the page's own reload does not.
       */
      const reload = async () => {
        await Promise.all([tab.waitForEvent("load"), tab.evaluate(() => location.reload())]);
        await ready();
      };
      /* A control on the bar, as a person presses it: a place in the list the place control opens (FR-138). */
      const press = async (selector) => {
        const one = tab.locator(selector).first();
        if (!(await one.isVisible().catch(() => false))) await tab.click('[data-testid="app-places-open"]');
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
        // The switch's Scene, from the place: the scene at its own address, its stop in the fragment, and Back (FR-132, FR-137).
        await go(`${BASE}/places/the-board`);
        one.beforeToggle = await state();
        await press('[data-testid="app-face-scene"]');
        one.toScene = await settled();
        await reload();
        one.sceneReloaded = await state();
        await tab.goBack();
        one.toggleUndone = await settled();
        await tab.goForward();
        one.toggleRedone = await settled();
        // FR-144: a picture of the scene's, chosen from the bar — the scene's `in.view` and the address move together, and Back undoes it.
        await press('[data-testid="app-place-scene:whole"]');
        one.wholeFromTheBar = { ...(await settled()), said: await tab.evaluate(() => document.querySelector('[data-testid="app-place-current"]')?.textContent.trim() ?? null) };
        await press('[data-testid="app-place-scene:task:the-board"]');
        one.pictureFromTheBar = { ...(await settled()), said: await tab.evaluate(() => document.querySelector('[data-testid="app-place-current"]')?.textContent.trim() ?? null) };
        await tab.goBack();
        one.pictureUndone = { ...(await settled()), said: await tab.evaluate(() => document.querySelector('[data-testid="app-place-current"]')?.textContent.trim() ?? null) };
        await tab.goForward();
        await settled();
        // The switch's Pages: back to the page the reader was on (FR-137).
        await press('[data-testid="app-face-pages"]');
        one.backToPages = await settled();
        // FR-157: the switch's Scene from an address nothing lives at lands where the scene opens, never on the empty view.
        await go(`${BASE}/tasks/nobody`);
        one.nowhere = await state();
        await press('[data-testid="app-face-scene"]');
        one.sceneFromNowhere = { ...(await settled()), up: await tab.evaluate(() => document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true") };
        // A link to a stop at the bare address, written before the scene was a place, still opens it.
        await go(`${BASE}#focus=t2`);
        one.oldStop = await state();
        // A host that mounts on the Graview at the bare address lands on the scene's place.
        await go(BASE);
        one.bare = await state();
        /*
         * FR-154: THE OVERVIEW'S ADDRESS ALONE, as it comes back from a server
         * that never saw a fragment — a sign-in door, a stored link, a
         * bookmark, or typed — opens the overview at altitude, and stays there
         * on a reload; a fragment that says where it stands is respected.
         */
        const overview = async () => ({ ...(await settled()), up: await tab.evaluate(() => document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true") });
        await go(`${BASE}/places/overview`);
        one.overviewAlone = await overview();
        await reload();
        one.overviewAloneReloaded = await overview();
        // A load of its own: from the same address, a fragment alone is a step within the page, not an arrival.
        await tab.goto("about:blank");
        await go(`${BASE}/places/overview#focus=t2`);
        one.overviewWithAStop = await overview();
      } catch (error) {
        one.error = String(error?.message ?? error);
      }
      if (viewport.width >= 1024) {
        try {
          /*
           * A LENS DOUBLE-CLICKED FROM UP OPENS IT. From Up, the tasks'
           * district says its pictures under it; a double-click on one goes
           * down into it — the tasks in focus, on the ground, that picture
           * `in.view`, the address saying so — and Back returns to Up.
           */
          const scene = async () => ({
            ...(await state()),
            up: await tab.evaluate(() => document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true"),
          });
          await go(`${BASE}/places/overview#overview=1`);
          await tab.waitForTimeout(600);
          one.lensUp = await scene();
          // A district's showings come up when it is reached for: the keyboard reaches it here, as a hand's hover does.
          await tab.focus('[data-testid="showing-the-board"]', { timeout: 10_000 });
          await tab.dblclick('[data-testid="showing-the-board"]', { timeout: 10_000 });
          await tab.waitForTimeout(1200);
          one.lensDown = await scene();
          await tab.goBack();
          await tab.waitForTimeout(1200);
          one.lensBack = await scene();
        } catch (error) {
          one.lensError = String(error?.message ?? error);
        }
      }
      try {
        /*
         * A SEAT CHANGE IS NOT A STOP. On the scene focused on a task, the
         * host seats a viewer, who sees only their own tasks: the stop is
         * resolved where it stands — the address no longer names the task,
         * and no entry is pushed whose Back lands on an address this seat
         * cannot see.
         */
        await press('[data-testid="app-face-scene"]');
        await settled();
        await tab.evaluate(() => (location.hash = "#focus=t1"));
        one.seatBefore = await settled();
        await tab.evaluate(() => window.__handle.setSeat({ kind: "human", id: "p9", roles: ["viewer"] }));
        one.seatAfter = await settled();
      } catch (error) {
        one.seatError = String(error?.message ?? error);
      }
      try {
        // A host that mounts an app with a home view on the Graview, at the bare address: it opens on the home, the front page (FR-136).
        await go(`${SWAP_BASE}?face=graview&named=1`);
        one.homeFirst = await state();
      } catch (error) {
        one.error = String(error?.message ?? error);
      }
      try {
        /*
         * A RECORD DRAWN AS A LINK ANSWERS THE MENU UNDER THE BASE (FR-189).
         * A card's link is the record's address under the base; its menu is
         * the record's — Open, its acts, Move to › on a board — opened by a
         * right-click at a desk and by a finger resting on it on a phone,
         * where with no Move button the menu is the only way to move a card;
         * and a new tab opens under the base.
         */
        const phone = viewport.width < 768;
        const card = (id) => `[data-graview-face=pages] [data-graview-listed="${id}"] .graview-spec-item-link`;
        const menuOf = async (selector) => {
          await tab.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
          await tab.waitForTimeout(200);
          await tab.locator(selector).first().scrollIntoViewIfNeeded();
          if (phone) {
            // A finger resting on the card: a touch's pointerdown, held past the long press, then lifted.
            const box = await tab.locator(selector).first().boundingBox();
            const x = box.x + Math.min(24, box.width / 2);
            const y = box.y + Math.min(16, box.height / 2);
            const under = await tab.evaluate(
              ([at, x, y]) => {
                const target = document.querySelector(at);
                target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true, clientX: x, clientY: y }));
                const there = document.elementFromPoint(x, y);
                return there ? `${there.tagName.toLowerCase()}.${there.className}` : null;
              },
              [selector, x, y],
            );
            await tab.waitForTimeout(800);
            await tab.evaluate((at) => document.querySelector(at).dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", isPrimary: true })), selector);
            if (!(await tab.locator('[data-testid="context-menu"]').isVisible().catch(() => false))) throw new Error(`no menu after resting on ${selector} (under the finger: ${under})`);
          } else {
            await tab.click(selector, { button: "right", position: { x: 12, y: 8 } });
          }
          await tab.waitForSelector('[data-testid="context-menu"]', { timeout: 10_000 });
          await tab.waitForTimeout(400);
          return tab.evaluate(() => {
            const menu = document.querySelector('[data-testid="context-menu"]');
            return {
              title: menu?.querySelector("h2, h3, [data-testid='inspector-title']")?.textContent?.trim() ?? null,
              text: menu?.textContent ?? "",
              rows: [...(menu?.querySelectorAll("[data-menu-item]") ?? [])].map((row) => row.getAttribute("data-menu-item")),
              acts: [...(menu?.querySelectorAll("[data-affordance]:not([disabled])") ?? [])].map((button) => button.textContent.replace(/ …$/, "").trim()),
            };
          });
        };
        const newTab = async () => {
          await tab.evaluate(() => {
            window.__opened = null;
            window.open = (url) => ((window.__opened = String(url)), null);
          });
          await tab.click('[data-testid="context-menu"] [data-menu-item="open-in-a-new-tab"]');
          await tab.waitForTimeout(200);
          return tab.evaluate(() => window.__opened);
        };
        await go(`${BASE}/places/the-board`);
        one.boardFrame = await placeFrame('[data-testid="columns-lens"]');
        const boardCard = { href: await tab.getAttribute(card("t1"), "href") };
        boardCard.menu = await menuOf(card("t1"));
        boardCard.opened = await newTab();
        await menuOf(card("t1"));
        await tab.click('[data-testid="context-menu"] [data-menu-item="move-to"]');
        await tab.click('[data-testid="context-menu"] [data-move-to="done"]', { timeout: 10_000 });
        await tab.waitForTimeout(600);
        boardCard.movedTo = await tab.evaluate(() => document.querySelector('[data-graview-listed="t1"]')?.closest("[data-graview-column]")?.getAttribute("data-graview-column") ?? null);
        one.boardCard = boardCard;
        await go(`${CARDS_BASE}/places/by-status`);
        const blocksCard = { href: await tab.getAttribute(card("t2"), "href") };
        blocksCard.menu = await menuOf(card("t2"));
        blocksCard.opened = await newTab();
        one.blocksCard = blocksCard;
      } catch (error) {
        one.cardsError = String(error?.message ?? error);
      }
      /*
       * A VIEW THE HOST KEEPS, AS A NAV ENTRY (Roadmap q-custom-views-in-nav):
       * the bare address opens on it, the drop-down lists it first among the
       * lists, and the people `pages.hide` keeps off are not listed — and
       * still open at their address, where the bar names them.
       */
      try {
        const places = () =>
          tab.evaluate(() => {
            const list = document.querySelector('[data-testid="app-places"]');
            const entries = (within) => [...(within?.querySelectorAll("[data-place-path]") ?? [])].map((one) => one.getAttribute("data-place-path"));
            const nav = list?.closest("nav");
            return {
              all: [...new Set(entries(nav))],
              lists: entries(list?.querySelector('[data-place-group="lists"]')),
              current: document.querySelector('[data-testid="app-place-current"]')?.textContent?.trim() ?? null,
            };
          });
        await go(`${VIEWS_BASE}/`);
        const opened = await settled();
        await tab.waitForFunction(() => Boolean(document.querySelector('[data-worker-view="to-do"]')?.shadowRoot?.querySelector(".to-do li")), null, { timeout: 20_000 }).catch(() => null);
        const drawn = await tab.evaluate(() => [...(document.querySelector('[data-worker-view="to-do"]')?.shadowRoot?.querySelectorAll(".to-do li") ?? [])].map((li) => li.textContent));
        if (await tab.locator('[data-testid="app-places-open"]').isVisible().catch(() => false)) await tab.click('[data-testid="app-places-open"]');
        await tab.waitForTimeout(300);
        one.keptView = { opened, drawn, frame: await placeFrame('[data-worker-view="to-do"]'), places: await places() };
        await tab.keyboard.press("Escape");
        await go(`${VIEWS_BASE}/people`);
        const hiddenList = await settled();
        one.hiddenKind = { opened: hiddenList, places: await places() };
      } catch (error) {
        one.keptError = String(error?.message ?? error);
      }
      /*
       * A CUT CARD SAYS MORE AT ITS FOOT (FR-231): the word, its name, where
       * it goes, and that it stands at the body's foot on the fade's ground —
       * inside the fade's box, which ends in the card's own panel color.
       */
      const FOOT_OF = `(card) => {
        const foot = card.querySelector("[data-graview-preview-more]");
        if (!foot) return null;
        const body = card.querySelector("[data-graview-preview-body]")?.getBoundingClientRect();
        const fade = card.querySelector("[data-graview-preview-fade]")?.getBoundingClientRect();
        const at = foot.getBoundingClientRect();
        return {
          tag: foot.tagName.toLowerCase(),
          text: foot.textContent,
          name: foot.getAttribute("aria-label"),
          href: foot.getAttribute("href"),
          visible: at.height > 0 && at.width > 0,
          atFoot: body ? Math.round(at.bottom) <= Math.round(body.bottom) + 1 && at.top >= body.top : false,
          onFade: fade ? at.top >= fade.top - 1 && at.bottom <= fade.bottom + 1 : false,
          focusable: foot.tabIndex >= 0,
        };
      }`;
      /*
       * A TALL VIEW ON THE SCENE IS A CARD (Roadmap f-view-content-height):
       * the log, eighty entries, drawn as its place on the Scene — no taller
       * than the box the Scene gave it, inside the window, faded at its foot
       * with Open — at the content height its host measured, with nothing
       * between the view and the card that scrolls; Open lands on its place
       * on Pages, where it flows whole. The map says `flows: false` and
       * `scene.maxHeight`: its preview is held to that, and its place keeps
       * a frame.
       */
      try {
        const preview = (name) =>
          tab.evaluate(([name, footSource]) => {
            const footOf = new Function(`return ${footSource}`)();
            const card = document.querySelector(`[data-graview-preview="${name}"]`);
            const region = card?.querySelector("[data-worker-view]");
            if (!card || !region) return null;
            const box = card.getBoundingClientRect();
            const host = card.closest("[data-graview-view]")?.getBoundingClientRect();
            const bar = document.querySelector("header")?.getBoundingClientRect();
            const body = card.querySelector("[data-graview-preview-body]");
            const open = card.querySelector("[data-graview-preview-open]");
            const scrolls = (el) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY);
            const scrollers = [];
            for (let el = region; el && el !== card.parentElement; el = el.parentElement) if (scrolls(el)) scrollers.push(el.tagName.toLowerCase());
            for (const el of card.querySelectorAll("*")) if (scrolls(el)) scrollers.push(el.tagName.toLowerCase());
            return {
              height: Math.round(box.height),
              foot: footOf(card),
              top: Math.round(box.top),
              bottom: Math.round(box.bottom),
              hostHeight: host ? Math.round(host.height) : null,
              barBottom: bar ? Math.round(bar.bottom) : 0,
              window: innerHeight,
              measured: Number(region.getAttribute("data-graview-content-height") ?? NaN),
              told: Number(body?.getAttribute("data-graview-content-height") ?? NaN),
              shown: body?.clientHeight ?? null,
              more: body?.hasAttribute("data-graview-more") ?? false,
              fade: card.querySelector("[data-graview-preview-fade]") !== null,
              open: open ? { href: open.getAttribute("href"), name: open.getAttribute("aria-label"), visible: open.getBoundingClientRect().height > 0 } : null,
              scrollers,
            };
          }, [name, FOOT_OF]);
        const drawnOnScene = (name) => tab.waitForFunction((name) => Number(document.querySelector(`[data-graview-preview="${name}"] [data-worker-view]`)?.getAttribute("data-graview-content-height") ?? 0) > 0, name, { timeout: 20_000 });
        await go(`${VIEWS_BASE}/places/overview#focus=aggregate%3Atask&in.view=the-log`);
        await drawnOnScene("the-log");
        await tab.waitForTimeout(400);
        const log = await preview("the-log");
        await tab.click('[data-graview-preview="the-log"] [data-graview-preview-open]');
        const landed = await settled();
        await tab.waitForFunction(() => Boolean(document.querySelector('[data-worker-view="the-log"]')?.shadowRoot?.querySelector(".log li")), null, { timeout: 20_000 }).catch(() => null);
        const entries = await tab.evaluate(() => document.querySelector('[data-worker-view="the-log"]')?.shadowRoot?.querySelectorAll(".log li").length ?? 0);
        const logFrame = await placeFrame('[data-worker-view="the-log"]');
        /* FR-231: More, at the card's foot, lands where Open does. */
        await go(`${VIEWS_BASE}/places/overview#focus=aggregate%3Atask&in.view=the-log`);
        await drawnOnScene("the-log");
        await tab.waitForTimeout(400);
        await tab.click('[data-graview-preview="the-log"] [data-graview-preview-more]');
        const byMore = await settled();
        await tab.waitForFunction(() => Boolean(document.querySelector('[data-worker-view="the-log"]')?.shadowRoot?.querySelector(".log li")), null, { timeout: 20_000 }).catch(() => null);
        const byMoreEntries = await tab.evaluate(() => document.querySelector('[data-worker-view="the-log"]')?.shadowRoot?.querySelectorAll(".log li").length ?? 0);
        await go(`${VIEWS_BASE}/places/overview#focus=aggregate%3Atask&in.view=the-map`);
        await drawnOnScene("the-map");
        await tab.waitForTimeout(400);
        const map = await preview("the-map");
        await go(`${VIEWS_BASE}/places/the-map`);
        await tab.waitForFunction(() => Boolean(document.querySelector('[data-worker-view="the-map"]')?.shadowRoot?.querySelector(".map")), null, { timeout: 20_000 }).catch(() => null);
        one.tallView = { log, landed: { ...landed, entries, frame: logFrame }, byMore: { ...byMore, entries: byMoreEntries }, map, mapFrame: await placeFrame('[data-worker-view="the-map"]') };
      } catch (error) {
        one.tallError = String(error?.message ?? error);
      }
      /*
       * A TALL VIEW OF ONE RECORD ON THE SCENE IS THE SAME CARD (Roadmap
       * f-scene-record-view-card): the task's notes, eighty of them, with the
       * task's own fields under them — no taller than the box the Scene gave
       * it, inside the window, faded with Open, nothing in it scrolling — and
       * Open lands on the task's page. In the whole-page Shell, which has no
       * Pages, the card has no Open: Expand grows it in place to what it
       * drew, still scrolling nowhere, and Collapse takes it back.
       */
      try {
        const card = (name) =>
          tab.evaluate(([name, footSource]) => {
            const footOf = new Function(`return ${footSource}`)();
            const card = document.querySelector(`[data-graview-preview="${name}"]`);
            const region = card?.querySelector("[data-worker-view]");
            if (!card || !region) return null;
            const box = card.getBoundingClientRect();
            const host = card.closest("[data-graview-view]")?.getBoundingClientRect();
            const bar = document.querySelector("header")?.getBoundingClientRect();
            const body = card.querySelector("[data-graview-preview-body]");
            const drawn = card.querySelector("[data-graview-preview-drawn]");
            const open = card.querySelector("[data-graview-preview-open]");
            const expand = card.querySelector("[data-graview-preview-expand]");
            const scrolls = (el) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY);
            const scrollers = [];
            for (let el = region; el && el !== card.parentElement; el = el.parentElement) if (scrolls(el)) scrollers.push(el.tagName.toLowerCase());
            for (const el of card.querySelectorAll("*")) if (scrolls(el)) scrollers.push(el.tagName.toLowerCase());
            /* The layout's heights, not the drawn box: the Scene's plane may scale the card. */
            return {
              title: card.getAttribute("aria-label"),
              foot: footOf(card),
              height: Math.round(box.height),
              top: Math.round(box.top),
              bottom: Math.round(box.bottom),
              hostHeight: host ? Math.round(host.height) : null,
              barBottom: bar ? Math.round(bar.bottom) : 0,
              window: innerHeight,
              measured: Number(region.getAttribute("data-graview-content-height") ?? NaN),
              layoutHeight: card.offsetHeight,
              drawnHeight: drawn?.offsetHeight ?? null,
              shown: body?.clientHeight ?? null,
              more: body?.hasAttribute("data-graview-more") ?? false,
              fade: card.querySelector("[data-graview-preview-fade]") !== null,
              expanded: card.hasAttribute("data-graview-expanded"),
              open: open ? { href: open.getAttribute("href"), name: open.getAttribute("aria-label"), visible: open.getBoundingClientRect().height > 0 } : null,
              expand: expand ? { said: expand.textContent, pressed: expand.getAttribute("aria-expanded"), name: expand.getAttribute("aria-label") } : null,
              scrollers,
            };
          }, [name, FOOT_OF]);
        const drawnOnScene = (name) => tab.waitForFunction((name) => Number(document.querySelector(`[data-graview-preview="${name}"] [data-worker-view]`)?.getAttribute("data-graview-content-height") ?? 0) > 0, name, { timeout: 20_000 });
        await go(`${VIEWS_BASE}/places/overview#focus=t1&sel=t1`);
        await drawnOnScene("t1");
        await tab.waitForTimeout(400);
        const notes = await card("t1");
        await tab.click('[data-graview-preview="t1"] [data-graview-preview-open]');
        const landed = await settled();
        await tab.waitForFunction(() => Boolean(document.querySelector('[data-worker-view="notes"]')?.shadowRoot?.querySelector(".notes li")), null, { timeout: 20_000 }).catch(() => null);
        const entries = await tab.evaluate(() => document.querySelector('[data-worker-view="notes"]')?.shadowRoot?.querySelectorAll(".notes li").length ?? 0);
        /* The Shell, with no Pages: Expand, then Collapse. */
        await go(`${SHELL_BASE}/`);
        await drawnOnScene("t1");
        await tab.waitForTimeout(400);
        const before = await card("t1");
        await tab.click('[data-graview-preview="t1"] [data-graview-preview-expand]');
        await tab.waitForTimeout(400);
        const grown = await card("t1");
        await tab.click('[data-graview-preview="t1"] [data-graview-preview-expand]');
        await tab.waitForTimeout(400);
        const back = await card("t1");
        one.recordCard = { notes, landed: { ...landed, entries }, shell: { before, grown, back } };
      } catch (error) {
        one.recordError = String(error?.message ?? error);
      }
      /*
       * A VIEW DRAWN EDGE TO EDGE ON A PHONE (bleed), and a record page's
       * slot beside its view: the region each view draws in, against the
       * viewport less its safe areas and the column the page lays out in;
       * and where the slot's blocks stand between the view and the facts.
       */
      try {
        const drawnIn = (name) => tab.waitForFunction((view) => Boolean(document.querySelector(`[data-worker-view="${view}"]`)?.shadowRoot?.querySelector("div, p")), name, { timeout: 20_000 });
        const measure = (name) =>
          tab.evaluate((view) => {
            const region = document.querySelector(`[data-worker-view="${view}"]`);
            const main = region?.closest("[data-graview-page-main]");
            const box = region?.getBoundingClientRect();
            const style = main ? getComputedStyle(main) : null;
            const column = main && style ? main.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) : null;
            /* The safe areas, as the page's own env() reads them. */
            const probe = document.createElement("div");
            probe.style.cssText = "position:fixed;left:env(safe-area-inset-left,0px);right:env(safe-area-inset-right,0px);top:0;height:0";
            document.body.append(probe);
            const safe = probe.getBoundingClientRect();
            probe.remove();
            return {
              left: box ? Math.round(box.left) : null,
              width: box ? Math.round(box.width) : null,
              column: column === null ? null : Math.round(column),
              safeLeft: Math.round(safe.left),
              safeWidth: Math.round(safe.width),
              viewport: window.innerWidth,
              sideScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
            };
          }, name);
        await go(`${FITTED_BASE}/`);
        await drawnIn("hero");
        const home = await measure("hero");
        /* FR-216: where the home's view starts, against the top of the page under the bar, and the page's own top padding. */
        home.top = await tab.evaluate(() => {
          const region = document.querySelector('[data-worker-view="hero"]');
          const main = region?.closest("[data-graview-page-main]");
          const first = main?.querySelector('[data-testid="home-view"]');
          const top = main?.getBoundingClientRect().top ?? 0;
          /* What stands over the view inside the page, if anything: the app's line, said first. */
          const above = [...(first?.children ?? [])].filter((child) => !child.contains(region) && child.getBoundingClientRect().bottom <= region.getBoundingClientRect().top).map((child) => child.textContent?.trim() ?? "");
          return region && main && first ? { offset: Math.round(region.getBoundingClientRect().top - top), first: Math.round(first.getBoundingClientRect().top - top), padding: Math.round(parseFloat(getComputedStyle(main).paddingTop)), above } : null;
        });
        await go(`${FITTED_BASE}/tasks/t1`);
        await drawnIn("brief");
        await tab.waitForSelector('[data-graview-face=pages] [data-testid="record-fields"]', { timeout: 20_000 });
        const record = await measure("brief");
        const order = await tab.evaluate(() => {
          const top = (element) => (element ? Math.round(element.getBoundingClientRect().top) : null);
          const bottom = (element) => (element ? Math.round(element.getBoundingClientRect().bottom) : null);
          const view = document.querySelector('[data-worker-view="brief"]');
          const slot = document.querySelector('[data-graview-face=pages] [data-graview-spec="page"][data-graview-kind="task"]');
          const facts = document.querySelector('[data-graview-face=pages] [data-testid="record-fields"]');
          return { view: [top(view), bottom(view)], slot: [top(slot), bottom(slot)], facts: [top(facts), bottom(facts)], slotSays: slot?.textContent?.trim() ?? null };
        });
        await go(`${FITTED_BASE}/people/p1`);
        await drawnIn("card");
        const replaced = await tab.evaluate(() => ({
          drawn: document.querySelector('[data-worker-view="card"]')?.shadowRoot?.querySelector(".card")?.textContent ?? null,
          slot: document.querySelector('[data-graview-face=pages] [data-graview-spec="page"]') !== null,
          saysSlot: (document.querySelector("[data-graview-face=pages]")?.textContent ?? "").includes("Who they are"),
          facts: document.querySelector('[data-graview-face=pages] [data-testid="record-fields"]') !== null,
        }));
        /* A view's place on a phone (Roadmap f-view-place-min-width, f-bleed-on-places, f-fallback-lens-loses-gutter, f-place-header-repeats-view-title). */
        await go(`${FITTED_BASE}/places/the-wide`);
        await drawnIn("wide");
        const wide = await measure("wide");
        const heading = await tab.evaluate(() => {
          const title = document.querySelector("[data-graview-face=pages] [data-graview-page-title]");
          const box = title?.getBoundingClientRect();
          const own = document.querySelector('[data-worker-view="wide"]')?.shadowRoot?.querySelector("h2.own");
          return {
            title: title?.textContent?.trim() ?? null,
            titleDrawn: box ? box.width > 1 && box.height > 1 : null,
            own: own?.textContent?.trim() ?? null,
            count: document.querySelector('[data-testid="place-lede"]') !== null,
            asList: document.querySelector('[data-testid="place-as-list"]') !== null,
          };
        });
        await go(`${FITTED_BASE}/places/the-edge`);
        await drawnIn("edge");
        const edge = await measure("edge");
        const edgeTitled = await tab.evaluate(() => {
          const box = document.querySelector("[data-graview-face=pages] [data-graview-page-title]")?.getBoundingClientRect();
          return { titleDrawn: box ? box.width > 1 && box.height > 1 : null, count: document.querySelector('[data-testid="place-lede"]') !== null };
        });
        await go(`${FITTED_BASE}/places/the-broken`);
        await tab.waitForSelector("[data-graview-bleed] > [data-worker-view-fallback]", { timeout: 20_000 });
        await tab.waitForTimeout(300);
        const fallback = await tab.evaluate(() => {
          const slot = document.querySelector("[data-graview-bleed]");
          const main = slot?.closest("[data-graview-page-main]");
          const box = slot?.getBoundingClientRect();
          const style = main ? getComputedStyle(main) : null;
          const inner = main && style ? main.getBoundingClientRect().left + parseFloat(style.paddingLeft) : null;
          const column = main && style ? main.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) : null;
          return {
            drawn: document.querySelector('[data-worker-view-place="broken"]') === null && (slot?.textContent ?? "").trim() !== "",
            left: box ? Math.round(box.left) : null,
            width: box ? Math.round(box.width) : null,
            columnLeft: inner === null ? null : Math.round(inner),
            column: column === null ? null : Math.round(column),
            sideScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        /* Seen in on a record's page (Roadmap f-seen-in-phone-length): each place once, the first three on a phone. */
        await go(`${FITTED_BASE}/tasks/t1`);
        await drawnIn("brief");
        const seenIn = await tab.evaluate(() => {
          const row = document.querySelector('[data-graview-face=pages] [data-testid="seen-in"]');
          const shown = (element) => element.getClientRects().length > 0;
          const links = row ? [...row.querySelectorAll("a")] : [];
          const more = row?.querySelector("button[data-graview-seen-more]");
          return {
            places: links.length,
            shown: links.filter(shown).map((link) => link.textContent?.trim() ?? ""),
            toScene: links.filter((link) => (link.getAttribute("href") ?? "").includes("#view=")).length,
            more: more && shown(more) ? more.textContent?.trim() ?? "" : null,
            height: row ? Math.round(row.getBoundingClientRect().height) : null,
          };
        });
        if (seenIn.more) {
          await tab.click('[data-testid="seen-in"] button[data-graview-seen-more]');
          await tab.waitForTimeout(200);
          seenIn.opened = await tab.evaluate(() => ({
            shown: [...document.querySelectorAll('[data-testid="seen-in"] a')].filter((link) => link.getClientRects().length > 0).length,
            keyboardOnAPlace: document.activeElement !== null && document.activeElement === document.querySelectorAll('[data-testid="seen-in"] a')[3],
          }));
        }
        one.fitted = { home, record, order, replaced, wide, heading, edge, edgeTitled, fallback, seenIn };
      } catch (error) {
        one.fittedError = String(error?.message ?? error);
      }
      /*
       * A DELETED HOME VIEW NEVER DRAWS (FR-202): registered after the live
       * one, and listed by the host as deleted, the home draws the live one.
       */
      try {
        await go(`${HOMES_BASE}/`);
        await tab.waitForFunction(() => Boolean(document.querySelector("[data-worker-view]")?.shadowRoot?.querySelector("p")), null, { timeout: 20_000 }).catch(() => null);
        await tab.waitForTimeout(400);
        one.homes = await tab.evaluate(() => ({
          drawn: [...document.querySelectorAll("[data-worker-view]")].map((view) => view.getAttribute("data-worker-view")),
          says: [...document.querySelectorAll("[data-worker-view]")].map((view) => view.shadowRoot?.textContent?.trim() ?? ""),
        }));
      } catch (error) {
        one.homesError = String(error?.message ?? error);
      }
      /*
       * A VISITOR'S FORM OVER A COMPILED APP (FR-201) still refuses an answer
       * that does not fit, in words, and lands one that does.
       */
      try {
        await go(`${FORM_BASE}/`);
        await tab.waitForSelector('[data-graview-embed="form"] form', { timeout: 20_000 });
        const guests = () => tab.evaluate(() => window.__handle.store.snapshot().nodes.filter((node) => node.kind === "guest").map((node) => node.name));
        await tab.fill('[data-graview-embed="form"] input[name="name"]', "Ada Lovelace");
        await tab.selectOption('[data-graview-embed="form"] select[name="coming"]', "yes");
        await tab.fill('[data-graview-embed="form"] input[name="email"]', "not an address");
        // The browser's own check would stop the press before the form judged it: the form's own refusal is what is asked.
        await tab.evaluate(() => {
          const form = document.querySelector('[data-graview-embed="form"] form');
          form.noValidate = true;
          form.requestSubmit();
        });
        await tab.waitForTimeout(300);
        const refused = { said: (await tab.textContent('[data-testid="refused"]').catch(() => null))?.trim() ?? null, guests: await guests() };
        await tab.fill('[data-graview-embed="form"] input[name="email"]', "ada@example.com");
        await tab.click('[data-graview-embed="form"] [data-graview-part="submit"]');
        await tab.waitForSelector('[data-graview-embed="form"] [role="status"]', { timeout: 10_000 });
        const answered = { said: (await tab.textContent('[data-graview-embed="form"] [role="status"]'))?.trim() ?? null, guests: await guests() };
        const scripts = await tab.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /\.js$/.test(entry.name)).length);
        one.form = { title: await tab.textContent('[data-graview-embed="form"] h1'), refused, answered, scripts };
      } catch (error) {
        one.formError = String(error?.message ?? error);
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
        await reader.click('[data-testid="app-face-scene"]');
        await reader.waitForTimeout(800);
        await reader.click('[data-testid="app-home"]');
        await reader.waitForTimeout(600);
        quiet.after = await where();
        // A seat change on the scene, in the article: still the article's history, never written.
        await reader.click('[data-testid="app-face-scene"]');
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

  const stopOf = (hash) => new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
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
        toScene.scenePressed &&
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
  /* FR-144: the scene's picture, from the bar, is the scene's `in.view` and its address at once. */
  const inView = (state) => new URLSearchParams(String(state?.hash ?? "").replace(/^#/, "")).get("in.view");
  report.checks.aScenePictureChosenFromTheBarMovesInViewAndTheAddress = {
    seen: Object.fromEntries(Object.entries(pick("pictureFromTheBar")).map(([name, seen]) => [name, { whole: results[name].wholeFromTheBar, chosen: seen, back: results[name].pictureUndone }])),
    ok: every(
      ({ wholeFromTheBar, pictureFromTheBar, pictureUndone }) =>
        wholeFromTheBar.face !== "pages" &&
        wholeFromTheBar.said === "The whole thing" &&
        inView(wholeFromTheBar) === null &&
        pictureFromTheBar.face !== "pages" &&
        pictureFromTheBar.path === `${BASE}/places/overview` &&
        inView(pictureFromTheBar) === "the-board" &&
        pictureFromTheBar.said === "The board" &&
        pictureFromTheBar.pushes === wholeFromTheBar.pushes + 1 &&
        pictureUndone.face !== "pages" &&
        pictureUndone.path === `${BASE}/places/overview` &&
        inView(pictureUndone) === null &&
        pictureUndone.said === "The whole thing",
    ),
  };
  /* FR-132: the scene is a place, at its own address, its stop riding on it. */
  report.checks.theOverviewsAddressIsItsPlaceWithItsStopOnIt = {
    seen: Object.fromEntries(Object.entries(pick("toScene")).map(([name, seen]) => [name, { scene: seen, reloaded: results[name].sceneReloaded }])),
    ok: every(({ toScene, sceneReloaded }) => toScene.path === `${BASE}/places/overview` && toScene.fragment && sceneReloaded.path === `${BASE}/places/overview` && sceneReloaded.face !== "pages" && sceneReloaded.scenePressed),
  };
  /* FR-157: from a page that is nothing, the switch's Scene lands where the declaration says the app opens (`pages.first`: the board), not on the empty view. */
  report.checks.theSceneFromAnAddressNothingLivesAtLandsWhereTheSceneOpens = {
    seen: Object.fromEntries(Object.entries(pick("sceneFromNowhere")).map(([name, seen]) => [name, { page: results[name].nowhere, scene: seen }])),
    ok: every(
      ({ nowhere, sceneFromNowhere }) =>
        nowhere.face === "pages" &&
        nowhere.heading === "Nothing lives at this address." &&
        sceneFromNowhere.face === "scene" &&
        sceneFromNowhere.path === `${BASE}/places/overview` &&
        stopOf(sceneFromNowhere.hash).get("focus") === "aggregate:task" &&
        stopOf(sceneFromNowhere.hash).get("in.view") === "the-board" &&
        sceneFromNowhere.scenePressed &&
        !sceneFromNowhere.up,
    ),
  };
  report.checks.aLinkToAStopWrittenBeforeTheSceneWasAPlaceStillOpensIt = {
    seen: pick("oldStop"),
    ok: every(({ oldStop }) => oldStop.face === "scene" && oldStop.path === `${BASE}/places/overview` && fromStop(oldStop.hash) === "t2" && oldStop.scenePressed),
  };
  report.checks.aHostThatMountsOnTheGraviewLandsOnTheScenesAddress = {
    seen: Object.fromEntries(Object.entries(results).filter(([name]) => !name.endsWith("article") && name.includes("1440")).map(([name, one]) => [name, one.error ? { error: one.error } : one.bare])),
    ok: Object.entries(results)
      .filter(([name]) => !name.endsWith("article") && name.includes("1440"))
      .every(([, one]) => !one.error && one.bare.face === "graview" && one.bare.path === `${BASE}/places/overview` && one.bare.scenePressed),
  };
  /* FR-154: the overview's address alone is the overview at altitude, written without a fragment; one that says where it stands is respected. */
  const alone = (seen) => seen.face === "graview" && seen.up && seen.scenePressed && seen.path === `${BASE}/places/overview` && !seen.fragment && seen.pushes === 0;
  report.checks.theOverviewsAddressAloneOpensItAtAltitude = {
    seen: Object.fromEntries(Object.entries(pick("overviewAlone")).map(([name, seen]) => [name, { alone: seen, reloaded: results[name].overviewAloneReloaded, withAStop: results[name].overviewWithAStop, bare: results[name].bare }])),
    ok: every(
      ({ overviewAlone, overviewAloneReloaded, overviewWithAStop, bare }) =>
        alone(overviewAlone) &&
        alone(overviewAloneReloaded) &&
        overviewWithAStop.face === "scene" &&
        overviewWithAStop.path === `${BASE}/places/overview` &&
        fromStop(overviewWithAStop.hash) === "t2" &&
        !overviewWithAStop.up &&
        (bare.face !== "graview" || !bare.fragment),
    ),
  };
  /* FR-136: the same host, the same face, an app with a home view: it opens on the home, full page, at the bare address. */
  report.checks.anAppWithAHomeViewOpensOnItAtTheBareAddress = {
    seen: Object.fromEntries(Object.entries(results).filter(([name]) => !name.endsWith("article")).map(([name, one]) => [name, one.error ? { error: one.error } : one.homeFirst])),
    ok: Object.entries(results)
      .filter(([name]) => !name.endsWith("article"))
      .every(([, one]) => !one.error && one.homeFirst.face === "pages" && one.homeFirst.homeView && one.homeFirst.path.replace(/\/$/, "") === SWAP_BASE && !one.homeFirst.scenePressed),
  };
  /* From Up, a lens double-clicked goes down into it, the address says so, and Back returns to Up. */
  const desks = Object.entries(results).filter(([name]) => !name.endsWith("article") && name.includes("1440"));
  report.checks.aLensDoubleClickedFromUpOpensItAndBackReturnsUp = {
    seen: Object.fromEntries(desks.map(([name, one]) => [name, one.lensError ? { error: one.lensError } : { up: one.lensUp, down: one.lensDown, back: one.lensBack }])),
    ok:
      desks.length === engines.length &&
      desks.every(
        ([, { lensError, lensUp, lensDown, lensBack }]) =>
          !lensError &&
          lensUp.up &&
          !lensDown.up &&
          lensDown.face !== "pages" &&
          lensDown.path === `${BASE}/places/overview` &&
          stopOf(lensDown.hash).get("focus") === "aggregate:task" &&
          stopOf(lensDown.hash).get("in.view") === "the-board" &&
          stopOf(lensDown.hash).get("overview") === null &&
          lensBack.up &&
          lensBack.path === `${BASE}/places/overview`,
      ),
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
  /* FR-189: a record a lens draws as a link is that record to the menu, under the base, at a desk and on a phone. */
  const pagesAt = Object.entries(results).filter(([name]) => !name.endsWith("article"));
  const cardsSeen = (key) => Object.fromEntries(pagesAt.map(([name, one]) => [name, one.cardsError ? { error: one.cardsError } : one[key]]));
  const cardsHold = (test) => pagesAt.length === engines.length * SIZES.length && pagesAt.every(([, one]) => !one.cardsError && test(one));
  report.checks.aBoardsCardLinksUnderTheBaseAndItsMenuMovesIt = {
    seen: cardsSeen("boardCard"),
    ok: cardsHold(
      ({ boardCard }) =>
        boardCard.href === `${BASE}/tasks/t1` &&
        boardCard.menu.text.includes("Write the brief") &&
        ["open", "open-in-a-new-tab", "move-to"].every((row) => boardCard.menu.rows.includes(row)) &&
        boardCard.menu.acts.includes("Assign") &&
        boardCard.movedTo === "done",
    ),
  };
  report.checks.aBlocksLensCardLinksUnderTheBaseAndItsMenuListsItsActs = {
    seen: cardsSeen("blocksCard"),
    ok: cardsHold(
      ({ blocksCard }) =>
        blocksCard.href === `${CARDS_BASE}/tasks/t2` &&
        blocksCard.menu.text.includes("Book the hall") &&
        ["open", "open-in-a-new-tab"].every((row) => blocksCard.menu.rows.includes(row)) &&
        ["Set the status", "Assign"].every((name) => blocksCard.menu.acts.includes(name)),
    ),
  };
  report.checks.openInANewTabKeepsTheBase = {
    seen: Object.fromEntries(pagesAt.map(([name, one]) => [name, one.cardsError ? { error: one.cardsError } : { board: one.boardCard?.opened, blocks: one.blocksCard?.opened }])),
    ok: cardsHold(({ boardCard, blocksCard }) => boardCard.opened === `${BASE}/tasks/t1` && blocksCard.opened === `${CARDS_BASE}/tasks/t2`),
  };
  /* Roadmap q-custom-views-in-nav: a view the host keeps, ordered first, opens first and stands in the drop-down; a hidden kind leaves it and keeps its address. */
  const keptSeen = (key) => Object.fromEntries(pagesAt.map(([name, one]) => [name, one.keptError ? { error: one.keptError } : one[key]]));
  const keptHold = (test) => pagesAt.length === engines.length * SIZES.length && pagesAt.every(([, one]) => !one.keptError && test(one));
  report.checks.aRegisteredViewOrderedFirstOpensFirstAndStandsInTheDropDown = {
    seen: keptSeen("keptView"),
    ok: keptHold(({ keptView }) => keptView.opened.path === `${VIEWS_BASE}/places/to-do` && keptView.opened.pushes === 0 && keptView.drawn.includes("Write the brief") && keptView.places.all.filter((path) => path !== "/")[0] === "/places/to-do" && keptView.places.current === "To do"),
  };
  /*
   * Roadmap f-view-places-flow: a titled view's place flows with the page —
   * no box between the view and the page scrolls inside itself — while a
   * board keeps its frame, most of the window tall, that scrolls the board.
   */
  report.checks.aTitledViewsPlaceFlowsWithThePageWhileABoardKeepsItsFrame = {
    seen: Object.fromEntries(pagesAt.map(([name, one]) => [name, one.keptError || one.cardsError ? { error: one.keptError ?? one.cardsError } : { view: one.keptView.frame, board: one.boardFrame }])),
    ok: keptHold(({ keptView, boardFrame, cardsError }) => !cardsError && keptView.frame?.flows === true && !keptView.frame.scrolls && keptView.frame.height === null && keptView.frame.scrollers.length === 0 && boardFrame?.flows === false && boardFrame.scrolls && boardFrame.height !== null),
  };
  /*
   * Roadmap f-view-content-height: a worker view far taller than a screen is
   * drawn on the Scene as a card held to the box the Scene gave it and to
   * the window, at the content height its host measured, faded with Open —
   * nothing in it scrolls — and Open lands on its place, flowing whole.
   */
  const tallSeen = Object.fromEntries(pagesAt.map(([name, one]) => [name, one.tallError ? { error: one.tallError } : one.tallView]));
  const tallHold = (test) => pagesAt.length === engines.length * SIZES.length && pagesAt.every(([, one]) => !one.tallError && one.tallView?.log && one.tallView?.map && test(one.tallView));
  report.checks.aTallViewOnTheSceneIsDrawnBoundedWithOpenAndOpenLandsOnItsPlace = {
    seen: tallSeen,
    ok: tallHold(
      ({ log, landed }) =>
        log.measured > log.window &&
        log.told === log.measured &&
        log.height <= log.hostHeight &&
        log.top >= log.barBottom &&
        log.bottom <= log.window &&
        log.shown < log.measured &&
        log.more &&
        log.fade &&
        log.scrollers.length === 0 &&
        log.open?.visible === true &&
        log.open.href === `${VIEWS_BASE}/places/the-log` &&
        log.open.name === "Open The log" &&
        landed.path === `${VIEWS_BASE}/places/the-log` &&
        landed.face === "pages" &&
        landed.heading === "The log" &&
        landed.entries === 80 &&
        landed.frame?.flows === true &&
        landed.frame.scrollers.length === 0,
    ),
  };
  report.checks.aViewThatSaysFlowsFalseKeepsItsFrameAndItsScenePreviewKeepsToItsMaxHeight = {
    seen: tallSeen,
    ok: tallHold(({ map, mapFrame }) => map.shown <= 320 && map.more && map.scrollers.length === 0 && mapFrame?.flows === false && mapFrame.scrolls && mapFrame.height !== null),
  };
  /*
   * Roadmap f-scene-record-view-card: a worker view of one record, far taller
   * than a screen, is the same card on the Scene — no longer the record in
   * focus scrolling inside its box (FR-141) — and Open lands on the record's
   * page; with no page door (the whole-page Shell), Expand grows it in place.
   */
  const recordSeen = Object.fromEntries(pagesAt.map(([name, one]) => [name, one.recordError ? { error: one.recordError } : one.recordCard]));
  const recordHold = (test) => pagesAt.length === engines.length * SIZES.length && pagesAt.every(([, one]) => !one.recordError && one.recordCard?.notes && one.recordCard.shell.before && test(one.recordCard));
  report.checks.aTallRecordViewOnTheSceneIsACardWhoseOpenLandsOnTheRecordsPage = {
    seen: recordSeen,
    ok: recordHold(
      ({ notes, landed }) =>
        // The embed names what it holds under its own name ("The tasks · …"), so no two landmarks share one.
        notes.title?.endsWith("Write the brief") &&
        notes.measured > notes.window &&
        notes.height <= notes.hostHeight &&
        notes.top >= notes.barBottom &&
        notes.bottom <= notes.window &&
        notes.shown < notes.drawnHeight &&
        notes.more &&
        notes.fade &&
        notes.scrollers.length === 0 &&
        notes.expand === null &&
        notes.open?.visible === true &&
        notes.open.href === `${VIEWS_BASE}/tasks/t1` &&
        notes.open.name === "Open Write the brief" &&
        landed.path === `${VIEWS_BASE}/tasks/t1` &&
        landed.face === "pages" &&
        landed.heading === "Write the brief" &&
        landed.entries === 80,
    ),
  };
  /*
   * FR-231 (Roadmap f-scene-preview-card-scrolls): a card cut at its foot
   * says so there — a visible, focusable More on the fade's ground, named
   * for the card — and More lands where Open does: the place, the record's
   * page; in the Shell, with no pages, it is a press that grows the card,
   * and gone once the card holds it all.
   */
  report.checks.aCutSceneCardSaysMoreAtItsFootAndMoreLandsWhereOpenDoes = {
    seen: Object.fromEntries(pagesAt.map(([name, one]) => [name, { log: one.tallView?.log?.foot ?? one.tallError ?? null, byMore: one.tallView?.byMore ?? null, record: one.recordCard?.notes?.foot ?? one.recordError ?? null, shell: { before: one.recordCard?.shell?.before?.foot ?? null, grown: one.recordCard?.shell?.grown?.foot ?? null } }])),
    ok:
      tallHold(
        ({ log, byMore }) =>
          log.foot?.visible === true &&
          log.foot.text === "More" &&
          log.foot.name === "More of The log" &&
          log.foot.tag === "a" &&
          log.foot.focusable &&
          log.foot.atFoot &&
          log.foot.onFade &&
          log.foot.href === `${VIEWS_BASE}/places/the-log` &&
          byMore?.path === `${VIEWS_BASE}/places/the-log` &&
          byMore.face === "pages" &&
          byMore.heading === "The log" &&
          byMore.entries === 80,
      ) &&
      recordHold(
        ({ notes, shell: { before, grown } }) =>
          notes.foot?.visible === true &&
          notes.foot.name === "More of Write the brief" &&
          notes.foot.atFoot &&
          notes.foot.onFade &&
          notes.foot.href === `${VIEWS_BASE}/tasks/t1` &&
          before.foot?.tag === "button" &&
          before.foot.visible === true &&
          before.foot.name === "More of Write the brief" &&
          grown.foot === null,
      ),
  };
  report.checks.withNoPageDoorExpandGrowsTheRecordsCardInPlace = {
    seen: Object.fromEntries(Object.entries(recordSeen).map(([name, seen]) => [name, seen?.shell ?? seen])),
    ok: recordHold(
      ({ shell: { before, grown, back } }) =>
        before.open === null &&
        before.expand?.said === "Expand" &&
        before.expand.pressed === "false" &&
        before.more &&
        grown.expanded &&
        grown.expand?.said === "Collapse" &&
        grown.expand.pressed === "true" &&
        grown.layoutHeight > before.layoutHeight &&
        grown.top === before.top &&
        grown.shown >= grown.drawnHeight - 1 &&
        grown.drawnHeight >= grown.measured &&
        !grown.more &&
        !grown.fade &&
        grown.scrollers.length === 0 &&
        !back.expanded &&
        back.more &&
        back.layoutHeight === before.layoutHeight,
    ),
  };
  report.checks.aHiddenKindIsNotInTheDropDownAndStillOpensAtItsAddress = {
    seen: { list: keptSeen("keptView"), atItsAddress: keptSeen("hiddenKind") },
    ok: keptHold(({ keptView, hiddenKind }) => !keptView.places.all.includes("/people") && hiddenKind.opened.path === `${VIEWS_BASE}/people` && /^people$/i.test(hiddenKind.opened.heading ?? "") && hiddenKind.places.current === "People"),
  };
  /* Roadmap feature:views-on-phones-…-full-bleed: a view that says bleed spans a phone's width less its safe areas, and is the column's width at a desk. */
  const fittedSeen = Object.fromEntries(pagesAt.map(([name, one]) => [name, one.fittedError ? { error: one.fittedError } : one.fitted]));
  const fittedHold = (test) => pagesAt.length === engines.length * SIZES.length && pagesAt.every(([name, one]) => !one.fittedError && test(one.fitted, name));
  const spans = (box, name) => (/×844$/.test(name) ? box.left === box.safeLeft && box.width === box.safeWidth : box.width === box.column) && !box.sideScroll;
  report.checks.aViewThatBleedsSpansAPhoneLessItsSafeAreasAndTheColumnAtADesk = {
    seen: fittedSeen,
    ok: fittedHold((fitted, name) => spans(fitted.home, name) && spans(fitted.record, name)),
  };
  /* FR-216: a home view that bleeds starts right under the bar on a phone, and the page keeps its top spacing at a desk. */
  report.checks.aHomeViewThatBleedsStartsUnderTheBarOnAPhoneAndKeepsItsSpacingAtADesk = {
    seen: fittedSeen,
    ok: fittedHold(({ home }, name) => home.top !== null && home.top !== undefined && (/×844$/.test(name) ? home.top.first === 0 && home.top.padding === 0 && (home.top.offset === 0 || (home.top.above.length > 0 && home.top.above.every((said) => said !== ""))) : home.top.padding >= 32 && home.top.first >= home.top.padding)),
  };
  /* Roadmap feature:page-slot-blocks-on-a-kind-with-a-record-view-…: the view, then the slot's blocks, then the facts; a view that replaces the page draws alone. */
  report.checks.aRecordPagesSlotIsDrawnUnderItsViewAndAboveTheFacts = {
    seen: fittedSeen,
    ok: fittedHold(({ order }) => /Read the sources/.test(order.slotSays ?? "") && /Each source/.test(order.slotSays ?? "") && order.slot[0] >= order.view[1] && order.facts[0] >= order.slot[1]),
  };
  report.checks.aViewThatReplacesThePageDrawsAloneAndItsSlotIsNot = {
    seen: fittedSeen,
    ok: fittedHold(({ replaced }) => replaced.drawn === "Ada" && !replaced.slot && !replaced.saysSlot && !replaced.facts),
  };
  /* Roadmap f-view-place-min-width: a view's wide content scrolls inside it; its place is the column's width, and the page never scrolls sideways. */
  report.checks.aViewsWideContentNeverWidensThePageOnAPhone = {
    seen: fittedSeen,
    ok: fittedHold(({ wide, record }, name) => wide.width === wide.column && !wide.sideScroll && (/×844$/.test(name) ? record.width === record.safeWidth : record.width === record.column) && !record.sideScroll),
  };
  /* Roadmap f-bleed-on-places: a place whose view says bleed spans a phone less its safe areas, as the home does, and is the column's width at a desk. */
  report.checks.aPlaceDeclaredBleedDrawsEdgeToEdge = {
    seen: fittedSeen,
    ok: fittedHold(({ edge }, name) => spans(edge, name)),
  };
  /* Roadmap f-fallback-lens-loses-gutter: where a view that bleeds did not draw, what is drawn in its stead stands in the column, inside the gutter. */
  report.checks.aFallbackPageKeepsItsGutters = {
    seen: fittedSeen,
    ok: fittedHold(({ fallback }) => fallback.drawn && fallback.left === fallback.columnLeft && fallback.width === fallback.column && !fallback.sideScroll),
  };
  /* Roadmap f-place-header-repeats-view-title: a view that draws its own heading is titled once, by itself; the way to the list stays; any other place keeps its title and count. */
  report.checks.aCustomPageViewsHeadingIsSaidOnce = {
    seen: fittedSeen,
    ok: fittedHold(({ heading, edgeTitled }) => heading.title === "The wide" && heading.titleDrawn === false && heading.own === "The wide" && !heading.count && heading.asList && edgeTitled.titleDrawn === true && edgeTitled.count),
  };
  /* Roadmap f-seen-in-phone-length: each place one link, none to the scene beside it; on a phone the first three and a button for the rest, which opens them with the keyboard on the first; at a desk, all. */
  report.checks.seenInNamesEachPlaceOnceOnAPhone = {
    seen: fittedSeen,
    ok: fittedHold(({ seenIn }, name) =>
      seenIn.places > 4 &&
      seenIn.toScene === 0 &&
      new Set(seenIn.shown).size === seenIn.shown.length &&
      (/×844$/.test(name)
        ? seenIn.shown.length === 3 && seenIn.more === `${seenIn.places - 3} more` && seenIn.opened?.shown === seenIn.places && seenIn.opened?.keyboardOnAPlace === true
        : seenIn.shown.length === seenIn.places && seenIn.more === null),
    ),
  };
  /* FR-202: a home view the host lists as deleted is never drawn, though it registered after the live one. */
  const homesSeen = Object.fromEntries(pagesAt.map(([name, one]) => [name, one.homesError ? { error: one.homesError } : one.homes]));
  report.checks.aDeletedHomeViewNeverDrawsOverTheLiveOne = {
    seen: homesSeen,
    ok: pagesAt.length === engines.length * SIZES.length && pagesAt.every(([, one]) => !one.homesError && one.homes.drawn.includes("eagles-nest") && !one.homes.drawn.includes("eagles-story") && one.homes.says.some((said) => said.includes("The nest, live")) && !one.homes.says.some((said) => said.includes("deleted"))),
  };
  /* FR-201: a visitor's form read from a compiled app refuses an answer that does not fit and lands one that does. */
  const formSeen = Object.fromEntries(pagesAt.map(([name, one]) => [name, one.formError ? { error: one.formError } : one.form]));
  report.checks.aVisitorsFormOverACompiledAppRefusesAndAnswersAsBefore = {
    seen: formSeen,
    ok:
      pagesAt.length === engines.length * SIZES.length &&
      pagesAt.every(
        ([, one]) =>
          !one.formError &&
          one.form.title === "RSVP" &&
          /email/i.test(one.form.refused.said ?? "") &&
          one.form.refused.guests.length === 0 &&
          one.form.answered.guests.join() === "Ada Lovelace" &&
          /Received/.test(one.form.answered.said ?? ""),
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
