#!/usr/bin/env node
/**
 * THE FRAMEWORK'S OWN MARKUP PASSES AXE.
 *
 * Graview Cloud's accessibility pass (its `scripts/a11y.mjs`) runs axe-core
 * over every app it hosts, and from 0.1.18 on it found 48 nodes inside
 * `#graview-app` — the framework's markup — on every release, and tolerated
 * them as somebody else's. Nothing here ran axe on a hosted app, so nothing
 * here said so.
 *
 * This runs the same pass: axe-core with the same tags (WCAG 2.0, 2.1 and
 * 2.2 A and AA, and best practice), at a desk (1280×800) and a phone
 * (390×844), in light and in dark, on both faces, over
 *
 *   Cloud's two shapes of app, mounted the way Cloud mounts them: the embed
 *   over a compiled document inside `#graview-app` on a host's page that
 *   brings its own `<main>`, language and title and nothing else (the
 *   vendor template and the workshop). As Cloud does, what is inside
 *   `#graview-app` is the framework's, and so is whether the page says
 *   what it is (`page-has-heading-one`): every word on the page is the
 *   framework's to write.
 *
 *   a first look (`firstLook`) on Cloud's vendor app, on both faces, with
 *   each of its hints open in turn: axe holds with a hint open, each hint
 *   stands beside its control and never on it, inside the screen, the
 *   keyboard on it; on a phone at twice the text size it still fits; and
 *   Escape ends it with the keyboard given back.
 *
 *   a status board on Cloud's vendor app (the Pages face, at its place): at
 *   rest, with a card carried by the keyboard, with its menu's "Move to ›"
 *   open, and after a card is dragged — a move by the keyboard, the menu
 *   and a pointer, each scanned (Roadmap f-board-move-without-buttons).
 *
 *   the example apps (todo, seedbed, rota, discography, the desk), whole:
 *   every node on their pages is this repository's.
 *
 *   worker views as a host draws them (Roadmap f-view-a11y-audit): Threat
 *   Watch's home (scripts/fixtures/threat-app.ts) and the guest sandbox's
 *   offers views, one in a frame of its own. `auditView`
 *   (`@graview/guest/audit`) runs over each drawing in the browser — the
 *   ring and the words measured, light and dark — and over the framework's
 *   markup around it, which must pass; Tab is walked into each view and out
 *   again; a framed place is a box named for it that Tab reaches; and what
 *   axe finds inside a view, the audit finds too. What a view drew is its
 *   author's, so axe's nodes inside it are set beside the audit's, not
 *   counted against the framework.
 *
 * A screen holds when axe finds nothing. The verdict names each rule that
 * fired, how many nodes, and where.
 *
 *   node scripts/verify-a11y.mjs [--quick] [--only=vendors,todo]
 *
 * `--quick` scans the desk in light and the phone in dark only.
 */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving, vacant } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const ONLY = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length).split(",").filter(Boolean);
/** Cloud's tags, exactly. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const VIEWPORTS = { desk: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const SCHEMES = ["light", "dark"];
const SWEEP = QUICK
  ? [["desk", "light"], ["phone", "dark"]]
  : Object.keys(VIEWPORTS).flatMap((size) => SCHEMES.map((scheme) => [size, scheme]));
const ROOT = "#graview-app";
/** Rules about the whole page that Cloud holds the framework to: every word on its shell is the framework's. */
const DOCUMENT_RULES = new Set(["page-has-heading-one"]);
const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");

const VENDORS = resolve(repoRoot, "scripts/fixtures/quiet/vendor-shortlist.template.json");
const WORKSHOP = resolve(repoRoot, "scripts/fixtures/desk-bar/workshop.gdd.json");
const WORKSHOP_SEED = resolve(repoRoot, "scripts/fixtures/desk-bar/workshop.seed.json");

/** Cloud's shell, as far as the framework can see it: a page with a main, a language and a title, and the app in `#graview-app`. */
const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>An app on a host's page</title>
<style>html,body{margin:0;height:100%}#graview-app{position:relative;height:100vh}</style></head>
<body><main><div id="graview-app"></div></main><script>window.PACKAGES = __PACKAGES__; window.NOTES = __NOTES__;</script><script type="module" src="/entry.js"></script></body></html>`;
/** A plain view's source as a chat writes it, put on the host's page as the guest sandbox does. */
const inline = (file) => JSON.stringify(readFileSync(resolve(repoRoot, file), "utf8")).replace(/<\/script/gi, "<\\/script");

async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-a11y-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import vendors from ${JSON.stringify(VENDORS)};
        import workshop from ${JSON.stringify(WORKSHOP)};
        import workshopSeed from ${JSON.stringify(WORKSHOP_SEED)};
        import { registerWorkerView } from "@graview/guest/host/views";
        import { auditView } from "@graview/guest/audit";
        import { sam, threatApp, threatSeed, WATCH_JS, WATCH_MANIFEST } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/threat-app.ts"))};
        import { lin, offersApp, offersSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/offers-app.ts"))};
        const asked = new URLSearchParams(location.search);
        /* An audit of what is drawn under a selector — a view's shadow root, or the framework's own markup — as plain data. */
        window.__audit = (selector, options = {}) => {
          const at = document.querySelector(selector);
          return at ? JSON.parse(JSON.stringify(auditView(at.shadowRoot ?? at, options))) : null;
        };
        const doc = asked.get("doc");
        if (doc === "threat" || doc === "offers") {
          /*
           * A WORKER VIEW AS A HOST DRAWS IT (Roadmap f-view-a11y-audit): Threat
           * Watch's home, and the offers fixture's two views — "What we heard" in
           * a frame of its own (flows: false), "The packages" flowing with the page.
           */
          const threat = doc === "threat";
          const notes = { manifest: { name: "notes", title: "What we heard", attach: "signal", cardinality: "many", flows: false }, worker: { source: window.NOTES } };
          const packages = { manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } }, worker: { source: window.PACKAGES } };
          window.__handle = mount(document.getElementById("graview-app"), {
            app: threat ? threatApp : offersApp,
            seed: threat ? threatSeed : offersSeed,
            principal: threat ? sam : lin,
            face: asked.get("face") ?? "pages",
            ...(asked.get("path") ? { path: asked.get("path") } : {}),
            label: threat ? "Threat Watch" : "Offers",
            heading: 1,
            height: "100%",
            fonts: false,
            studio: false,
            views: (schema, registry) => (threat ? registerWorkerView(registry, { manifest: WATCH_MANIFEST, worker: { source: WATCH_JS } }) : registerWorkerView(registerWorkerView(registry, notes), packages)),
          });
          window.__handle.drawn().then(() => { window.__ready = true; });
        } else {
        const isWorkshop = doc === "workshop";
        const compiled = compileDocumentWithoutCheck(isWorkshop ? workshop : vendors.document, { today: () => "2026-10-02" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const seed = isWorkshop ? workshopSeed : vendors.seed;
        window.__handle = mount(document.getElementById("graview-app"), {
          app: compiled.app,
          seed: { nodes: seed.nodes, edges: seed.edges.map((edge, i) => ({ id: edge.id ?? "e" + i, ...edge })) },
          face: asked.get("face") ?? "graview",
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          // A first look, as Cloud turns it on for a new app: shown whatever this browser remembers.
          ...(asked.get("firstLook") ? { firstLook: { seen: false } } : {}),
          principal: { kind: "human", id: "u:owner", roles: ["owner"] },
          label: compiled.app.name,
          // As Cloud mounts it: the page IS the app, so its name is the page's one level-one heading.
          heading: 1,
          height: "100%",
          fonts: false,
          studio: false,
          bar: true,
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
  writeFileSync(join(out, "index.html"), HOST_PAGE.replace("__PACKAGES__", () => inline("scripts/fixtures/views/packages.js")).replace("__NOTES__", () => inline("scripts/fixtures/views/notes.js")));
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
  await vacant(portFor("a11y-host"));
  await new Promise((ready) => host.listen(portFor("a11y-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** The screens: Cloud's two shapes of app on its shell, then the examples whole, each on both faces. */
const hosted = (doc) =>
  ["graview", "pages"].map((face) => ({ name: `${doc} · ${face}`, group: doc, url: () => `${at("a11y-host")}/?doc=${doc}&face=${face}`, hosted: true }));
const example = (app, paths) =>
  paths.map((path) => ({ name: `${app} · ${path}`, group: app, app, url: () => `${at(app)}${path}${path.includes("?") ? "&" : "?"}today=2026-09-01`, hosted: false }));
/** The first look's screens: Cloud's vendor app on both faces, each hint opened in turn. */
const firstLook = ["scene", "pages"].map((face) => ({ name: `vendors · first look · ${face}`, group: "first-look", url: () => `${at("a11y-host")}/?doc=vendors&face=${face}&firstLook=1`, hosted: true, firstLook: true }));
/** A status board, moved three ways with axe run at each (Roadmap f-board-move-without-buttons). */
const board = { name: "vendors · a board moved", group: "board", url: () => `${at("a11y-host")}/?doc=vendors&face=pages&path=${encodeURIComponent("/places/vendors-by-status")}`, hosted: true, board: true };
/**
 * WORKER VIEWS AS A HOST DRAWS THEM, each audited in the browser by
 * `auditView` (Roadmap f-view-a11y-audit) with the selectors it hears a
 * click on, the framework's markup around it audited as the framework's,
 * and Tab walked through it. What a view drew is its author's: axe's word
 * on it is set beside the audit's, not counted against the framework.
 */
const viewAt = (doc, path) => () => `${at("a11y-host")}/?doc=${doc}&face=pages&path=${encodeURIComponent(path)}`;
const VIEWS = [
  { name: "threat watch · home", group: "views", url: viewAt("threat", "/"), hosted: true, view: { host: '[data-worker-view="watch"]', clicked: ["[data-only-critical]", "[data-more]"] } },
  { name: "offers · what we heard, framed", group: "views", url: viewAt("offers", "/places/what-we-heard"), hosted: true, view: { host: '[data-worker-view="notes"]', clicked: ["button[data-go]"], framed: "What we heard" } },
  { name: "offers · the packages", group: "views", url: viewAt("offers", "/places/the-packages"), hosted: true, view: { host: '[data-worker-view="packages"]', clicked: [] } },
];
/** What Threat Watch's drawing is owed, as its headless run says it (a-drawn-views-accessibility-is-audited.test.ts): each card a link around a button, each "More" a disclosure with no state. */
const THREAT_OWES = ['nested-interactive @ [data-key="threat:phishing"]', 'nested-interactive @ [data-key="threat:vpn"]', 'toggle-state @ [data-key="threat:phishing"] > button.more', 'toggle-state @ [data-key="threat:vpn"] > button.more'];
/** Axe's rules, by the audit's rule that judges the same thing. */
const AXE_AS_AUDIT = {
  "nested-interactive": "nested-interactive",
  "button-name": "name",
  "link-name": "name",
  label: "name",
  "select-name": "name",
  "input-button-name": "name",
  "aria-command-name": "name",
  "aria-toggle-field-name": "name",
  "aria-input-field-name": "name",
  "image-alt": "img-alt",
  "svg-img-alt": "svg-name",
  "role-img-alt": "svg-name",
  "scrollable-region-focusable": "scroll-region",
  "color-contrast": "contrast",
  "aria-required-attr": "toggle-state",
  "aria-valid-attr-value": "toggle-state",
};

const SCREENS = [
  ...hosted("vendors"),
  ...firstLook,
  board,
  ...hosted("workshop"),
  ...example("todo", ["/", "/pages", "/pages/tasks", "/pages/tasks/t-deposit", "/pages/problems", "/pages/search?q=the"]),
  ...example("seedbed", ["/", "/pages"]),
  ...example("rota", ["/", "/pages"]),
  ...example("discography", ["/", "/pages"]),
  ...example("launcher", ["/"]),
  ...VIEWS,
].filter((screen) => !ONLY || ONLY.includes(screen.group));

/** Ready: the hosted embed says it drew; an example says it is ready (`__<app>Ready`). Then the scene settles. */
async function ready(page, screen) {
  await page.waitForFunction(
    (hosted) => (hosted ? window.__ready === true : Object.keys(window).some((key) => /^__\w*Ready$/.test(key))),
    screen.hosted,
    { timeout: 60_000 },
  );
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1200);
}

/** The hint open now, and where it stands against its control and the screen; null when none is open. */
const hintNow = (page) =>
  page.evaluate(() => {
    const hint = document.querySelector('[data-testid="first-look"]');
    if (!hint) return null;
    const anchor = hint.getAttribute("data-first-look-anchor");
    const found = {
      faces: '[data-testid="app-faces"]',
      problems: '[data-testid="standing"], [data-testid="standing-link"]',
      activity: '[data-testid="activity-button"]',
      ask: '[data-testid="app-find"], [data-testid="app-find-open"]',
      find: '[data-testid="app-find"], [data-testid="app-find-open"]',
      profile: '[data-testid="profile-button"]',
      home: '[data-testid="app-home"]',
    }[anchor];
    const control = [...document.querySelectorAll(found)].find((one) => one.getBoundingClientRect().width > 1);
    const h = hint.getBoundingClientRect();
    const c = control?.getBoundingClientRect();
    const covers = !c || (h.left < c.right && h.right > c.left && h.top < c.bottom && h.bottom > c.top);
    const width = document.documentElement.clientWidth;
    const height = innerHeight;
    return {
      anchor,
      covers,
      fits: h.left >= 0 && h.top >= 0 && h.right <= width + 0.5 && h.bottom <= height + 0.5 && hint.scrollWidth <= hint.clientWidth + 1,
      keyboardOn: hint.contains(document.activeElement),
      title: hint.querySelector('[data-testid="first-look-title"]')?.textContent ?? "",
    };
  });

/** Waits for the first hint; null when none came. */
async function firstHint(page) {
  try {
    await page.waitForSelector('[data-testid="first-look"]', { timeout: 15_000 });
  } catch {
    return null;
  }
  await page.waitForTimeout(150);
  return hintNow(page);
}

/** axe over the page; each node marked as inside the framework's root or not. */
async function scan(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(
    async ([tags, root]) => {
      const result = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
      const host = document.querySelector(root);
      return result.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => {
          const last = n.target[n.target.length - 1];
          const el = typeof last === "string" ? document.querySelector(last) : null;
          return {
            target: n.target.join(" "),
            html: n.html.slice(0, 200),
            summary: (n.failureSummary ?? "").split("\n").slice(0, 3).join(" ").slice(0, 300),
            inRoot: Boolean(el && host && el !== host && host.contains(el)),
            /* Inside a shadow root: a worker view's drawing, its author's. */
            inView: n.target.some(Array.isArray),
          };
        }),
      }));
    },
    [TAGS, ROOT],
  );
}

/**
 * A CARD MOVED THREE WAYS, axe run at each: at rest; carried by the keyboard
 * (Space, then Right) with its slot held open; with its menu's "Move to ›"
 * open; and after a drag onto another column. Says which steps it reached.
 */
async function boardMoves(page) {
  const scans = [...(await scan(page))];
  const CARD = "#graview-app [data-testid='columns-lens'] [data-graview-listed][draggable='true']";
  const steps = { card: false, carried: false, dropped: false, menu: false, dragged: false };
  const link = page.locator(`${CARD} .graview-spec-item-link`).first();
  if ((await link.count()) === 0) return { scans, steps };
  steps.card = true;
  const said = () => page.evaluate(() => document.querySelector('[data-testid="columns-announce"]')?.textContent ?? "");
  await link.focus();
  await page.keyboard.press(" ");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  steps.carried = / \d+ of \d+\.$/.test(await said()) && (await page.locator('[data-testid="columns-slot"]').count()) > 0;
  scans.push(...(await scan(page)));
  await page.keyboard.press(" ");
  await page.waitForTimeout(500);
  steps.dropped = (await said()).includes("dropped in");
  await page.keyboard.press("Shift+F10");
  await page.waitForTimeout(800);
  const row = page.locator('[data-testid="context-menu"] [data-menu-item="move-to"]');
  if ((await row.count()) > 0) {
    await row.click();
    await page.waitForTimeout(200);
    steps.menu = (await page.locator('[data-testid="context-menu"] [data-move-to]').count()) > 0;
    scans.push(...(await scan(page)));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  const drag = await page.evaluate((selector) => {
    const first = document.querySelector(selector);
    const from = first?.closest("[data-graview-column]")?.getAttribute("data-graview-column");
    const to = [...document.querySelectorAll("#graview-app [data-graview-column]")].map((column) => column.getAttribute("data-graview-column")).find((value) => value && value !== from);
    return first && to ? { id: first.getAttribute("data-graview-listed"), to } : null;
  }, CARD);
  if (drag) {
    const before = await page.evaluate(() => document.querySelector('[data-testid="columns-said"]')?.textContent ?? "");
    await page.dragAndDrop(`#graview-app [data-graview-listed="${drag.id}"]`, `#graview-app [data-graview-column="${drag.to}"]`).catch(() => {});
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => document.querySelector('[data-testid="columns-said"]')?.textContent ?? "");
    steps.dragged = after.startsWith("Moved") && after !== before;
    scans.push(...(await scan(page)));
  }
  return { scans, steps };
}

/**
 * TAB THROUGH THE PAGE (WCAG 2.1.2): from the top, one Tab at a time, until
 * the keyboard has gone into the view and out of it again — never held in
 * it — or 300 presses. Says whether a framed place's region took it too.
 */
async function tabWalk(page, host) {
  await page.evaluate(() => document.activeElement?.blur?.());
  let entered = false;
  let left = false;
  let stops = 0;
  let frame = false;
  for (let press = 0; press < 300 && !left; press++) {
    await page.keyboard.press("Tab");
    const now = await page.evaluate((selector) => {
      const active = document.activeElement;
      return { inView: active !== null && active === document.querySelector(selector), frame: active?.getAttribute?.("data-testid") === "place-lens" };
    }, host);
    if (now.frame) frame = true;
    if (now.inView) {
      entered = true;
      stops++;
    } else if (entered) left = true;
  }
  return { entered, left, stops, frame };
}

/** A worker view audited where it is drawn: its drawing, the framework's markup around it, its frame, and Tab through it. */
async function auditTheView(page, view) {
  await page.waitForFunction((host) => Boolean(document.querySelector(host)?.shadowRoot?.querySelector("[data-graview-view-root] *")), view.host, { timeout: 30_000 });
  await page.waitForTimeout(300);
  const drawing = await page.evaluate(([host, clicked]) => window.__audit(host, { clicked }), [view.host, view.clicked]);
  /* And not handed what it hears a click on: the host kept it on the region, as the view's runtime said it (0.1.48). */
  const learned = await page.evaluate((host) => window.__audit(host), view.host);
  const chrome = await page.evaluate(() => window.__audit("#graview-app", { chrome: true }));
  const frame = view.framed
    ? await page.evaluate(() => {
        const box = document.querySelector('[data-testid="place-lens"]');
        return box && { role: box.getAttribute("role"), label: box.getAttribute("aria-label"), tabIndex: box.tabIndex };
      })
    : null;
  const walk = await tabWalk(page, view.host);
  /* The measured rules' control: faint words and a button whose ring is taken away, laid on the same page, are each found. */
  const control = await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "a11y-control";
    box.innerHTML = '<style>#a11y-control .bare:focus-visible{outline:none}</style><p style="color:#c4c4c4;background:#fff;margin:0">Faint words</p><button type="button" class="bare" style="background:#fff;color:#000">No ring</button>';
    document.body.append(box);
    const said = window.__audit("#a11y-control");
    box.remove();
    return said.problems.map((problem) => problem.rule);
  });
  return { drawing, learned, chrome, frame, walk, control };
}

/*
 * `graview view check --audit --browser` (0.1.48): the command a view's
 * author runs lays what the view drew out in Chromium and runs every rule
 * there — the ring, contrast and Tab through and out — not only the rules a
 * drawing alone answers.
 */
function viewCheckInABrowser() {
  const fixtures = resolve(repoRoot, "packages/core/tests/document/fixtures");
  const run = spawnSync(
    process.execPath,
    [
      resolve(repoRoot, "packages/graview/dist/cli.js"),
      "view",
      "check",
      resolve(repoRoot, "scripts/fixtures/view-check-browser.js"),
      "--app",
      join(fixtures, "lifelogics.gdd.json"),
      "--manifest",
      resolve(repoRoot, "packages/guest/tests/fixtures/lifelogics/packages.manifest.json"),
      "--seed",
      join(fixtures, "lifelogics.seed.json"),
      "--audit",
      "--browser",
      "--json",
    ],
    { cwd: repoRoot, encoding: "utf8", timeout: 120_000 },
  );
  try {
    return { status: run.status, audit: JSON.parse(run.stdout).audit ?? null, stderr: run.stderr.slice(0, 500) };
  } catch {
    return { status: run.status, audit: null, stderr: `${run.stderr}`.slice(0, 500), stdout: `${run.stdout}`.slice(0, 500) };
  }
}
const viewCheck = viewCheckInABrowser();
const EVERY_RULE = ["keyboard", "role", "name", "toggle-state", "nested-interactive", "img-alt", "svg-name", "scroll-region", "focus-visible", "contrast", "keyboard-trap"];

/** An audit's structural problems, as `rule @ at`, sorted: what two audits of one drawing must agree on. */
const said = (audit) => (audit?.problems ?? []).filter((problem) => !["focus-visible", "contrast"].includes(problem.rule)).map((problem) => `${problem.rule} @ ${problem.at}`).sort();

/** What each view screen's audit said, and what axe said inside the view. */
const viewAudits = [];
const viewAxe = [];

const servers = [];
/** What each board screen reached, step by step. */
const boards = [];
/** What each first-look screen found, hint by hint. */
const hints = [];
const largeText = [];
const escapes = [];
let host;
let browser;
const findings = [];
const scanned = [];
const errors = [];
try {
  if (SCREENS.some((screen) => screen.hosted)) host = await buildHost();
  for (const app of new Set(SCREENS.filter((screen) => screen.app).map((screen) => screen.app))) {
    servers.push(await serving(app, portFor(app), repoRoot));
  }
  browser = await launchEngine("chromium");
  for (const screen of SCREENS) {
    for (const [size, scheme] of SWEEP) {
      const context = await browser.newContext({ viewport: VIEWPORTS[size], colorScheme: scheme });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${screen.name} · ${size} · ${scheme}: ${error.message}`));
      const label = `${screen.name} · ${size} · ${scheme}`;
      try {
        await page.goto(screen.url(), { waitUntil: "load" });
        await ready(page, screen);
        /*
         * With a first look: every hint opened in turn, axe run with each
         * open, and Next pressed until Done.
         */
        const scans = [];
        if (screen.firstLook) {
          let shown = await firstHint(page);
          if (!shown) errors.push(`${label}: no first look was shown`);
          for (let turn = 0; shown && turn < 8; turn++) {
            hints.push({ screen: label, ...shown });
            scans.push(...(await scan(page)));
            const pressed = await page.evaluate(() => {
              const button = document.querySelector('[data-testid="first-look-next"], [data-testid="first-look-done"]');
              const done = button?.getAttribute("data-testid") === "first-look-done";
              button?.click();
              return done;
            });
            await page.waitForTimeout(200);
            shown = pressed ? null : await hintNow(page);
          }
        }
        if (screen.board) {
          const moved = await boardMoves(page);
          scans.push(...moved.scans);
          boards.push({ screen: label, ...moved.steps });
        }
        const violations = screen.firstLook || screen.board ? scans : await scan(page);
        let count = 0;
        if (screen.view) {
          for (const v of violations) for (const node of v.nodes) if (node.inView) viewAxe.push({ screen: label, rule: v.rule, target: node.target, html: node.html });
          viewAudits.push({ screen: label, framed: screen.view.framed ?? null, threat: screen.name.startsWith("threat"), ...(await auditTheView(page, screen.view)) });
        }
        for (const v of violations) {
          for (const node of v.nodes) {
            if (screen.view && node.inView) continue;
            // On a host's page, only what the framework drew is the framework's (Cloud's attribution, exactly).
            if (screen.hosted && !node.inRoot && !DOCUMENT_RULES.has(v.rule)) continue;
            findings.push({ screen: label, rule: v.rule, impact: v.impact, help: v.help, target: node.target, html: node.html, summary: node.summary });
            count++;
          }
        }
        scanned.push({ screen: label, nodes: count });
      } catch (error) {
        errors.push(`${label}: ${error.message.split("\n")[0]}`);
      }
      await context.close();
    }
    /*
     * A PHONE AT THE LARGEST TEXT: the first look again, the page's text at
     * twice its size, each hint inside the screen; and Escape ends it with
     * the keyboard back in the app, not on <body>.
     */
    if (screen.firstLook) {
      const label = `${screen.name} · phone · largest text`;
      const context = await browser.newContext({ viewport: VIEWPORTS.phone, colorScheme: "light" });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.style.fontSize = "200%";
        });
      });
      try {
        await page.goto(screen.url(), { waitUntil: "load" });
        await ready(page, screen);
        let shown = await firstHint(page);
        if (!shown) errors.push(`${label}: no first look was shown`);
        for (let turn = 0; shown && turn < 8; turn++) {
          largeText.push({ screen: label, ...shown });
          const pressed = await page.evaluate(() => {
            const button = document.querySelector('[data-testid="first-look-next"], [data-testid="first-look-done"]');
            const done = button?.getAttribute("data-testid") === "first-look-done";
            button?.click();
            return done;
          });
          await page.waitForTimeout(200);
          shown = pressed ? null : await hintNow(page);
        }
        // Again, and ended with Escape.
        await page.goto(screen.url(), { waitUntil: "load" });
        await ready(page, screen);
        if (await firstHint(page)) {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          escapes.push({
            screen: label,
            ...(await page.evaluate(() => ({
              gone: document.querySelector('[data-testid="first-look"]') === null,
              keyboardInApp: document.activeElement !== null && document.activeElement !== document.body && document.querySelector("#graview-app").contains(document.activeElement),
            }))),
          });
        }
      } catch (error) {
        errors.push(`${label}: ${error.message.split("\n")[0]}`);
      }
      await context.close();
    }
  }
} finally {
  await browser?.close().catch(() => undefined);
  host?.stop();
  for (const server of servers) server.stop();
}

/** By rule: how many nodes, on which screens, and a few of them. */
const byRule = {};
for (const finding of findings) {
  const rule = (byRule[finding.rule] ??= { impact: finding.impact, help: finding.help, nodes: 0, screens: [], samples: [] });
  rule.nodes++;
  if (!rule.screens.includes(finding.screen)) rule.screens.push(finding.screen);
  if (rule.samples.length < 6 && !rule.samples.some((sample) => sample.target === finding.target)) {
    rule.samples.push({ target: finding.target, html: finding.html, summary: finding.summary });
  }
}
const hostedFindings = findings.filter((finding) => SCREENS.find((screen) => finding.screen.startsWith(`${screen.name} ·`))?.hosted);

const checks = {
  theFrameworksMarkupOnAHostsPagePassesAxe: {
    nodes: hostedFindings.length,
    rules: [...new Set(hostedFindings.map((finding) => finding.rule))],
    ok: scanned.length > 0 && hostedFindings.length === 0,
  },
  everyExampleAppPassesAxeOnBothFaces: {
    nodes: findings.length - hostedFindings.length,
    rules: [...new Set(findings.filter((finding) => !hostedFindings.includes(finding)).map((finding) => finding.rule))],
    ok: scanned.length > 0 && findings.length === hostedFindings.length,
  },
  aFirstLookPassesAxeWithEachHintOpen: {
    hints: hints.length,
    nodes: findings.filter((finding) => finding.screen.includes("first look")).length,
    ok: SCREENS.every((screen) => !screen.firstLook) || (hints.length > 0 && findings.every((finding) => !finding.screen.includes("first look"))),
  },
  aFirstLookPointsAtTheSwitchAndTheProblemsOnBothFaces: {
    faces: [...new Set(hints.map((hint) => hint.screen.replace(/ · (desk|phone).*/, "")))].map((screen) => ({ screen, anchors: [...new Set(hints.filter((hint) => hint.screen.startsWith(screen)).map((hint) => hint.anchor))] })),
    ok: SCREENS.every((screen) => !screen.firstLook) || SCREENS.filter((screen) => screen.firstLook).every((screen) => ["faces", "problems"].every((anchor) => hints.some((hint) => hint.screen.startsWith(screen.name) && hint.anchor === anchor))),
  },
  aHintNeverCoversItsControl: { covering: [...hints, ...largeText].filter((hint) => hint.covers).map((hint) => `${hint.screen} · ${hint.anchor}`), ok: [...hints, ...largeText].every((hint) => !hint.covers) },
  aHintFitsTheScreenAtDeskAndPhoneWidths: { over: hints.filter((hint) => !hint.fits).map((hint) => `${hint.screen} · ${hint.anchor}`), ok: hints.every((hint) => hint.fits) },
  aHintFitsAPhoneAtTheLargestText: {
    hints: largeText.length,
    over: largeText.filter((hint) => !hint.fits).map((hint) => `${hint.screen} · ${hint.anchor}`),
    ok: SCREENS.every((screen) => !screen.firstLook) || (largeText.length > 0 && largeText.every((hint) => hint.fits)),
  },
  theKeyboardIsOnEachHintAsItOpens: { off: hints.filter((hint) => !hint.keyboardOn).map((hint) => `${hint.screen} · ${hint.anchor}`), ok: hints.every((hint) => hint.keyboardOn) },
  escapeEndsTheFirstLookAndGivesTheKeyboardBack: {
    escapes,
    ok: SCREENS.every((screen) => !screen.firstLook) || (escapes.length === SCREENS.filter((screen) => screen.firstLook).length && escapes.every((one) => one.gone && one.keyboardInApp)),
  },
  aBoardMovedByTheKeyboardItsMenuAndAPointerPassesAxe: {
    boards,
    nodes: findings.filter((finding) => finding.screen.includes("a board moved")).length,
    ok: SCREENS.every((screen) => !screen.board) || (boards.length > 0 && boards.every((one) => one.card && one.carried && one.dropped && one.menu && one.dragged) && findings.every((finding) => !finding.screen.includes("a board moved"))),
  },
  /* A worker view audited where the host draws it (Roadmap f-view-a11y-audit). */
  aViewIsAuditedInTheBrowserWithItsRingAndItsWords: {
    audited: viewAudits.length,
    ran: [...new Set(viewAudits.flatMap((one) => one.drawing?.ran ?? []))],
    measured: viewAudits.map((one) => ({ screen: one.screen, ...(one.drawing?.measured ?? {}) })),
    ok: !SCREENS.some((screen) => screen.view) || (viewAudits.length === SCREENS.filter((screen) => screen.view).length * SWEEP.length && viewAudits.every((one) => one.drawing && ["focus-visible", "contrast"].every((rule) => one.drawing.ran.includes(rule) && one.drawing.measured[rule] > 0))),
  },
  theHostsRingAndTheViewsWordsMeasureInLightAndDark: {
    problems: viewAudits.flatMap((one) => (one.drawing?.problems ?? []).filter((problem) => problem.rule === "focus-visible" || problem.rule === "contrast").map((problem) => `${one.screen}: ${problem.rule} @ ${problem.at} — ${problem.says}`)),
    unmeasured: viewAudits.map((one) => ({ screen: one.screen, ...(one.drawing?.unmeasured ?? {}) })),
    ok: viewAudits.every((one) => one.drawing && one.drawing.problems.every((problem) => problem.rule !== "focus-visible" && problem.rule !== "contrast")),
  },
  theMeasuredRulesFindFaintWordsAndARingTakenAway: {
    found: [...new Set(viewAudits.map((one) => (one.control ?? []).join(", ")))],
    ok: viewAudits.every((one) => ["contrast", "focus-visible"].every((rule) => one.control?.includes(rule))),
  },
  threatWatchIsAuditedOnThePageAsItIsHeadless: {
    owes: THREAT_OWES,
    said: [...new Set(viewAudits.filter((one) => one.threat).map((one) => (one.drawing?.problems ?? []).filter((problem) => !["focus-visible", "contrast"].includes(problem.rule)).map((problem) => `${problem.rule} @ ${problem.at}`).join(" | ")))],
    ok: !SCREENS.some((screen) => screen.name.startsWith("threat")) || (viewAudits.some((one) => one.threat) && viewAudits.filter((one) => one.threat).every((one) => JSON.stringify((one.drawing?.problems ?? []).filter((problem) => !["focus-visible", "contrast"].includes(problem.rule)).map((problem) => `${problem.rule} @ ${problem.at}`).sort()) === JSON.stringify([...THREAT_OWES].sort()))),
  },
  aPageAuditLearnsFromTheHostWhatTheViewHearsAClickOn: {
    differ: viewAudits
      .filter((one) => JSON.stringify(said(one.learned)) !== JSON.stringify(said(one.drawing)))
      .map((one) => ({ screen: one.screen, handed: said(one.drawing), learned: said(one.learned) })),
    ok: viewAudits.length > 0 && viewAudits.every((one) => one.learned && JSON.stringify(said(one.learned)) === JSON.stringify(said(one.drawing))),
  },
  graviewViewCheckBrowserRunsEveryRule: {
    status: viewCheck.status,
    ran: viewCheck.audit?.ran ?? null,
    skipped: viewCheck.audit?.skipped ?? null,
    measured: viewCheck.audit?.measured ?? null,
    found: (viewCheck.audit?.problems ?? []).map((problem) => `${problem.rule} @ ${problem.at}`),
    ...(viewCheck.audit ? {} : { stderr: viewCheck.stderr }),
    ok:
      viewCheck.status === 1 &&
      Boolean(viewCheck.audit) &&
      EVERY_RULE.every((rule) => viewCheck.audit.ran.includes(rule)) &&
      viewCheck.audit.skipped.length === 0 &&
      viewCheck.audit.measured["focus-visible"] >= 2 &&
      viewCheck.audit.measured["keyboard-trap"] >= 2 &&
      ["contrast @ p.faint", "keyboard @ div.more"].every((one) => viewCheck.audit.problems.some((problem) => `${problem.rule} @ ${problem.at}` === one)) &&
      viewCheck.audit.problems.every((problem) => problem.rule !== "keyboard-trap" && problem.rule !== "focus-visible"),
  },
  theFrameworksMarkupAroundAViewPassesTheAudit: {
    problems: viewAudits.flatMap((one) => (one.chrome?.problems ?? []).map((problem) => `${one.screen}: ${problem.rule} @ ${problem.at} — ${problem.says}`)).slice(0, 40),
    ok: viewAudits.every((one) => one.chrome && one.chrome.problems.length === 0),
  },
  aFramedPlaceIsABoxNamedForItThatTheKeyboardReaches: {
    frames: viewAudits.filter((one) => one.framed).map((one) => ({ screen: one.screen, ...one.frame, reached: one.walk.frame })),
    ok: viewAudits.filter((one) => one.framed).every((one) => one.frame?.role === "group" && one.frame.label?.endsWith(one.framed) && one.frame.tabIndex === 0 && one.walk.frame),
  },
  tabGoesIntoAViewAndOutAgain: {
    walks: viewAudits.map((one) => ({ screen: one.screen, ...one.walk })),
    ok: viewAudits.every((one) => !one.walk.entered || one.walk.left) && viewAudits.filter((one) => one.threat).every((one) => one.walk.entered),
  },
  theAuditFindsWhatAxeFindsInAView: {
    missed: viewAxe.filter((found) => AXE_AS_AUDIT[found.rule] && !viewAudits.find((one) => one.screen === found.screen)?.drawing?.problems.some((problem) => problem.rule === AXE_AS_AUDIT[found.rule])).map((found) => `${found.screen}: ${found.rule} ${found.html.slice(0, 80)}`),
    axeAlone: [...new Set(viewAxe.filter((found) => !AXE_AS_AUDIT[found.rule]).map((found) => found.rule))],
    ok: viewAxe.every((found) => !AXE_AS_AUDIT[found.rule] || viewAudits.find((one) => one.screen === found.screen)?.drawing?.problems.some((problem) => problem.rule === AXE_AS_AUDIT[found.rule])),
  },
  everyScreenWasScanned: { scanned: scanned.length, expected: SCREENS.length * SWEEP.length, ok: scanned.length === SCREENS.length * SWEEP.length },
  noPageThrew: { errors, ok: errors.length === 0 },
};
const report = {
  at: new Date().toISOString(),
  tags: TAGS,
  sweep: SWEEP.map(([size, scheme]) => `${size} ${scheme}`),
  checks,
  byRule,
  scanned,
  firstLook: { hints, largeText },
  views: viewAudits.map((one) => ({ screen: one.screen, problems: one.drawing?.problems ?? null, skipped: one.drawing?.skipped ?? null, unmeasured: one.drawing?.unmeasured ?? null })),
  viewAxe,
  passed: Object.values(checks).every((check) => check.ok),
};
writeFileSync(resolve(repoRoot, "docs/a11y.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
for (const [rule, seen] of Object.entries(byRule)) process.stdout.write(`     ${rule} (${seen.impact}): ${seen.nodes} node(s) on ${seen.screens.length} screen(s)\n`);
process.stdout.write(`${findings.length} node(s) over ${scanned.length} screen(s)\n`);
process.exit(report.passed ? 0 : 1);
