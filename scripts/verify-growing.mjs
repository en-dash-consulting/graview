#!/usr/bin/env node
/**
 * A LIST AND ITS CARDS STAY USABLE AS AN APP GROWS.
 *
 * Nick, on the Graview Roadmap app (Graview Cloud, which draws the routed
 * face): on its Requests, "Filter" opened one long menu listing every
 * record at the far end of every relation — "The feature it became" alone
 * was ninety feature names, wrapping, in a popover that ran off the
 * screen; a row's "1 vote" was cut off at the right edge of a desk, and
 * "0 votes" was drawn as a badge. On its "Up next", each card printed its
 * whole thirty-line summary, so a row of cards was a wall of text in a box
 * of its own to scroll.
 *
 * The app is a document mounted as Cloud mounts one (the embed over a
 * compiled document, `scripts/fixtures/growing/roadmap.gdd.json`), seeded
 * here with a hundred and twenty features — a third of them with a
 * summary thirty lines long — sixty requests, forty-five of them tied to
 * the feature they became, and twenty people who voted. At a desk and a
 * phone it asks:
 *
 *   the requests' status stands over the list as chips with counts, and
 *   one press narrows the list to that status, shown as a removable chip
 *   beside the count; Filter opens short — every heading closed, no
 *   feature named — opaque, held to the window, its own scroll under a
 *   box that stays at its top, and a sheet along a phone's foot; the
 *   relation to many features is left out by default and offered by the
 *   feature's stage instead, which narrows to the right requests; a
 *   relation with more than eight records at its far end is found by
 *   typing (at most eight matches); with `pages.lists.request.filters`
 *   naming the relation, a feature is found and kept in a few keystrokes;
 *
 *   a row's vote badge is whole inside its row and the window, and a
 *   count of nothing is no badge;
 *
 *   on "Up next" a card's summary is three lines at most, the cards in a
 *   row keep their own heights, the cards are no box to scroll of their
 *   own, and a list cut by its limit says "See all 120 features", which
 *   goes to the features; a feature's row says its summary in one line,
 *   and its page says it whole;
 *
 *   and (`?lists=3`) a custom home that links to its lists instead of a
 *   lens per link (Roadmap f-navigate-filters, f-hidden-lenses): a worker
 *   view's `<a data-place="features" data-filter="stage:building">` lands
 *   on the features narrowed, at an address that says so; its
 *   `graview.navigate({ place: "up-next", section: "Every feature" })`
 *   lands on that heading, which has the keyboard; a filter on a field the
 *   kind does not have goes nowhere and says why; a shared address opens
 *   the list narrowed at its section; and "Up next", kept off the lists
 *   (`hidden`), is on neither the bar nor the page list, and is still
 *   drawn at its address.
 *
 *   node scripts/verify-growing.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>] [--probe]
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
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const PROBE = process.argv.includes("--probe");
const ROADMAP = resolve(repoRoot, "scripts/fixtures/growing/roadmap.gdd.json");
const SCREENS = [
  { name: "desk", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
];

/* ── the seed: grown, and the same every run ─────────────────────────── */

const ADJECTIVES = ["Quiet", "Shared", "Offline", "Nested", "Faster", "Printable", "Weekly", "Private", "Bulk", "Gentle", "Signed", "Live"];
const NOUNS = ["calendars", "exports", "drafts", "comments", "reminders", "imports", "boards", "receipts", "invites", "searches"];
const STAGES = ["idea", "planned", "building", "shipped"];
const AREAS = ["pages", "scene", "core", "cloud"];
const STATUSES = ["new", "considering", "planned", "declined", "done"];
const LONG = (name) =>
  Array.from({ length: 6 }, (_, at) =>
    [`${name}, part ${at + 1}: what it is for and who asked for it first.`, "It changes what a person meets on the page, so it is written down here in full before anyone starts.", "The open questions follow, each with who owns it.", "Then what done looks like, and how we will know a person can use it."].join(" "),
  ).join("\n\n");
const SHORT = (name) => `${name} lets a person do the thing without leaving the page. It was asked for twice this month, and it touches the list and the record alike.`;

const features = [];
for (const [a, adjective] of ADJECTIVES.entries()) {
  for (const [n, noun] of NOUNS.entries()) {
    const index = features.length;
    const name = `${adjective} ${noun}`;
    // A third thirty lines long, a third a sentence, a third three lines: cards side by side that hold different amounts.
    features.push({ id: `f${String(index).padStart(3, "0")}`, kind: "feature", name, stage: STAGES[index % 4], area: AREAS[(a + n) % 4], summary: index % 3 === 0 ? LONG(name) : index % 3 === 1 ? `${name}, asked for twice.` : SHORT(name) });
  }
}
const requests = Array.from({ length: 60 }, (_, at) => ({
  id: `r${String(at).padStart(2, "0")}`,
  kind: "request",
  // Every seventh as long as a request a person types into a form, its badges beside it all the same.
  name: `Let me ${["share", "print", "export", "undo", "sign", "schedule"][at % 6]} ${NOUNS[at % 10]} ${["from a phone", "for a team", "in bulk", "on a desk", "by email"][at % 5]}${at % 7 === 0 ? " without losing what the rest of the team already wrote, and say who changed it" : ""}`,
  status: STATUSES[at % 5],
  summary: `Asked on the forum: ${SHORT("This")}`,
}));
const people = Array.from({ length: 20 }, (_, at) => ({ id: `p${String(at).padStart(2, "0")}`, kind: "person", name: `${["Ada", "Ben", "Cleo", "Dev", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jun"][at % 10]} ${["Okafor", "Lindqvist"][Math.floor(at / 10)]}` }));
const edges = [];
// Forty-five requests became a feature; a feature may answer more than one.
for (const [at, request] of requests.entries()) if (at % 4 !== 3) edges.push({ kind: "became", from: request.id, to: features[(at * 7) % features.length].id });
// A request's votes: none, one, two or three.
for (const [at, request] of requests.entries()) for (let voter = 0; voter < at % 4; voter++) edges.push({ kind: "votes", from: people[(at + voter) % people.length].id, to: request.id });
const SEED = { nodes: [...features, ...requests, ...people], edges };

/** What the seed says each claim should find. */
const stageOf = new Map(features.map((feature) => [feature.id, feature.stage]));
const becameBuilding = requests.filter((request) => edges.some((edge) => edge.kind === "became" && edge.from === request.id && stageOf.get(edge.to) === "building")).length;
const considering = requests.filter((request) => request.status === "considering").length;
const answering = (featureId) => edges.filter((edge) => edge.kind === "became" && edge.to === featureId).length;
// A feature some request became, to find by typing: the first one two requests answer, else any.
const WANTED = features.find((feature) => answering(feature.id) >= 2) ?? features.find((feature) => answering(feature.id) >= 1);
const LONGEST = features[0];

const report = {
  at: new Date().toISOString(),
  engines,
  screens: SCREENS,
  expected: { features: features.length, requests: requests.length, people: people.length, becameBuilding, considering, wanted: WANTED.name, answeringWanted: answering(WANTED.id) },
  checks: {},
};

/*
 * `?lists=2`: the roadmap as Nick prioritizes it. Features work out a rank
 * (three a request that became one) and their list opens by it, highest
 * first, ties by name; requests open grouped by status, the open ones in
 * the order they are worked through, done and declined last and shut.
 */
const ORDER = ["planned", "considering", "new"];
const CLOSED = ["done", "declined"];
const ORDERED = `(roadmap) => ({
  ...roadmap,
  kinds: { ...roadmap.kinds, feature: { ...roadmap.kinds.feature, computed: { rank: { expr: "count(in('became')) * 3", label: "Rank" } } } },
  pages: { lists: {
    feature: { sort: { by: "rank", direction: "desc", then: "name" } },
    request: { group: { by: "status", order: ${JSON.stringify(ORDER)}, closed: ${JSON.stringify(CLOSED)} } },
  } },
})`;
const byStatus = (status) => requests.filter((request) => request.status === status);
const ranked = [...features]
  .sort((a, b) => answering(b.id) - answering(a.id) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
  .map((feature) => feature.id);

/*
 * `?lists=3`: the roadmap's custom home, a worker view that links to its
 * lists narrowed rather than to a lens per link, and "Up next" kept off
 * the lists — the link target such a home would have needed.
 */
const HOME_MANIFEST = { name: "roadmap-home", title: "The roadmap", attach: "home", cardinality: "many", reads: { kinds: ["feature"] } };
const HOME_SOURCE = `graview.render(graview.html\`<h2>What we are making</h2>
<p><a id="building" data-place="features" data-filter="stage:building">Being built</a></p>
<p><button id="section" type="button">Every feature</button> <button id="wrong" type="button">By a field it lacks</button></p>\`);
graview.on("click", "#section", () => graview.navigate({ place: "up-next", section: "Every feature" }));
graview.on("click", "#wrong", () => graview.navigate({ place: "features", where: { stag: "building" } }));`;
const HIDDEN = `(roadmap) => ({ ...roadmap, lenses: roadmap.lenses.map((lens) => (lens.title === "Up next" ? { ...lens, hidden: true } : lens)) })`;
const building = features.filter((feature) => feature.stage === "building").length;
const shipped = features.filter((feature) => feature.stage === "shipped").length;

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The roadmap</title>
<style>body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#f6f6f2;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the page IS the app, as Cloud's shell mounts it. `?lists=1` names what the requests' list filters by. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-growing-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { registerWorkerView } from "@graview/guest/host/views";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import roadmap from ${JSON.stringify(ROADMAP)};
        const seed = ${JSON.stringify(SEED)};
        const asked = new URLSearchParams(location.search);
        const document_ =
          asked.get("lists") === "1"
            ? { ...roadmap, pages: { lists: { request: { filters: ["status", "became", "became.stage"] } } } }
            : asked.get("lists") === "2"
              ? (${ORDERED})(roadmap)
              : asked.get("lists") === "3"
                ? (${HIDDEN})(roadmap)
                : roadmap;
        window.__problems = [];
        const home = { manifest: ${JSON.stringify(HOME_MANIFEST)}, worker: { source: ${JSON.stringify(HOME_SOURCE)} }, onProblem: (said) => window.__problems.push(said) };
        const compiled = compileDocumentWithoutCheck(document_, { today: () => "2026-10-12" });
        if (!compiled.ok) {
          window.__failed = compiled.findings.map((finding) => finding.message).join("; ");
          window.__ready = true;
        } else {
          window.__handle = mount(document.getElementById("app"), {
            app: compiled.app,
            seed,
            face: "pages",
            routing: "address",
            principal: { kind: "human", id: "u:owner", roles: ["owner"] },
            label: compiled.app.name,
            heading: 1,
            height: "100dvh",
            fonts: false,
            studio: false,
            ...(asked.get("lists") === "3" ? { views: (schema, registry) => registerWorkerView(registry, home) } : {}),
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
  await vacant(portFor("growing-host"));
  await new Promise((ready) => host.listen(portFor("growing-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/* ── what is measured in the page ─────────────────────────────────────── */

/** The list's head: its count, its chips and what is on. Runs in the page. */
function listState() {
  const shown = (element) => element && element.getBoundingClientRect().width > 1 && getComputedStyle(element).visibility !== "hidden";
  const chips = [...document.querySelectorAll('[data-testid="arrange-chip"]')].filter(shown);
  return {
    count: document.querySelector('[data-testid="arrange-count"]')?.textContent?.trim() ?? null,
    chips: chips.map((chip) => ({ value: chip.getAttribute("data-value"), words: chip.textContent?.trim(), pressed: chip.getAttribute("aria-pressed") === "true" })),
    on: [...document.querySelectorAll('[data-testid="arrange-condition"]')].filter(shown).map((one) => one.textContent?.replace("×", "").trim()),
    rows: document.querySelectorAll('[data-testid="records"] [data-testid="record-row"], [data-testid="records"] > li').length,
    pageScrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
}

/** Where what is on stands: each condition's chip beside the count, on the line's first row. Runs in the page. */
function onBesideTheCount() {
  const count = document.querySelector('[data-testid="arrange-count"]')?.getBoundingClientRect();
  const token = document.querySelector('[data-testid="arrange-condition"]')?.getBoundingClientRect();
  if (!count || !token) return false;
  return token.left >= count.right - 1 && Math.abs(token.top + token.height / 2 - (count.top + count.height / 2)) < 16;
}

/** The Filter list as drawn. Runs in the page. */
function paneState(names) {
  const pane = document.querySelector('[data-testid="arrange-list"]');
  if (!pane) return { open: false };
  const box = pane.getBoundingClientRect();
  const style = getComputedStyle(pane);
  const find = pane.querySelector('[data-testid="arrange-filter-find"]')?.closest("label")?.getBoundingClientRect() ?? null;
  const headings = [...pane.querySelectorAll('[data-testid="arrange-section"]')];
  const text = pane.textContent ?? "";
  // Opaque: the color it is laid over is solid, and nothing shows through.
  const color = style.backgroundColor;
  const alpha = /rgba?\(([^)]+)\)/.exec(color)?.[1].split(",").map(Number)[3];
  return {
    open: true,
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), height: Math.round(box.height) },
    view: { width: document.documentElement.clientWidth, height: innerHeight },
    opaque: alpha === undefined || alpha === 1,
    scrolls: pane.scrollHeight > pane.clientHeight + 1 && (style.overflowY === "auto" || style.overflowY === "scroll"),
    findTop: find ? Math.round(find.top - box.top) : null,
    headings: headings.map((heading) => ({ key: heading.getAttribute("data-key"), open: heading.getAttribute("aria-expanded") === "true" })),
    entries: pane.querySelectorAll(".graview-arrange-item").length,
    farNamed: names.filter((name) => text.includes(name)).length,
  };
}

/** The request rows' badges: each whole inside its row and the window, and none saying a count of nothing. Runs in the page. */
function badges() {
  const rows = [...document.querySelectorAll('[data-testid="records"] [data-testid="record-row"]')];
  const out = { rows: rows.length, badges: 0, cut: [], zero: 0, votes: 0 };
  for (const row of rows) {
    const rowBox = row.getBoundingClientRect();
    for (const badge of row.querySelectorAll(".graview-spec-badge")) {
      out.badges++;
      const box = badge.getBoundingClientRect();
      const words = (badge.textContent ?? "").trim();
      if (/^0(\s|$)/.test(words)) out.zero++;
      if (/vote/.test(words)) out.votes++;
      if (box.right > rowBox.right + 1 || box.right > document.documentElement.clientWidth + 1 || badge.scrollWidth > badge.clientWidth + 1) out.cut.push(words);
    }
  }
  return out;
}

/** "Up next": its cards and the lists' ways to the rest. Runs in the page. */
function cards() {
  const lineOf = (element) => parseFloat(getComputedStyle(element).lineHeight) || parseFloat(getComputedStyle(element).fontSize) * 1.45;
  const items = [...document.querySelectorAll('.graview-spec-list[data-as="card"] > .graview-spec-item')];
  const texts = items.map((item) => item.querySelector(".graview-spec-card .graview-spec-text")).filter(Boolean);
  const tallest = Math.max(0, ...texts.map((text) => text.getBoundingClientRect().height / lineOf(text)));
  // Each card as tall as what it holds: cards side by side that hold different amounts are different heights.
  const rows = new Map();
  for (const item of items) {
    const card = item.querySelector(".graview-spec-card");
    if (!card) continue;
    const box = card.getBoundingClientRect();
    const top = Math.round(item.getBoundingClientRect().top);
    rows.set(top, [...(rows.get(top) ?? []), Math.round(box.height)]);
  }
  const sideBySide = [...rows.values()].filter((heights) => heights.length > 1);
  const mixed = sideBySide.filter((heights) => Math.max(...heights) - Math.min(...heights) > 4).length;
  const alignment = getComputedStyle(document.querySelector('.graview-spec-list[data-as="card"]') ?? document.body).alignItems;
  // What scrolls, between a card and the page: the page's own scroller at most.
  const list = document.querySelector('.graview-spec-list[data-as="card"]');
  const scrollers = [];
  for (let at = list?.parentElement; at && at !== document.documentElement; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (/(auto|scroll)/.test(style.overflowY) && at.scrollHeight > at.clientHeight + 1) scrollers.push(at.getAttribute("data-testid") ?? at.tagName.toLowerCase());
  }
  const lens = document.querySelector('[data-testid="place-lens"]');
  const lensStyle = lens ? getComputedStyle(lens) : null;
  return {
    cards: items.length,
    texts: texts.length,
    mostLines: Math.round(tallest * 10) / 10,
    sideBySide: sideBySide.length,
    mixed,
    alignment,
    scrollers,
    lensScrolls: Boolean(lens && /(auto|scroll)/.test(lensStyle.overflowY) && lens.scrollHeight > lens.clientHeight + 1),
    seeAll: [...document.querySelectorAll('[data-testid="see-all"]')].map((link) => ({ words: link.textContent?.trim(), href: link.getAttribute("href") })),
    pageScrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
}

/** The features' rows: a summary in one line. Runs in the page. */
function rowLines() {
  const texts = [...document.querySelectorAll('[data-testid="records"] .graview-spec-row .graview-spec-text')];
  const lines = texts.map((text) => text.getBoundingClientRect().height / (parseFloat(getComputedStyle(text).lineHeight) || 20));
  return { texts: texts.length, mostLines: Math.round(Math.max(0, ...lines) * 10) / 10 };
}

/** A feature's page: its summary whole, every paragraph shown and nothing clamped. Runs in the page. */
function wholeSummary(first) {
  const holder = [...document.querySelectorAll('[data-testid="record-fields"] dd')].find((dd) => (dd.textContent ?? "").includes(first));
  if (!holder) return { found: false };
  const paragraphs = [...holder.querySelectorAll("p")].filter((p) => p.getBoundingClientRect().height > 2).length;
  return { found: true, paragraphs, clipped: holder.scrollHeight > holder.clientHeight + 1 };
}

/** A list drawn in groups: each group's heading, whether it is shut, its toggle, and the records in it. Runs in the page. */
function groupState() {
  return [...document.querySelectorAll('[data-testid="list-group"]')].map((section) => {
    const toggle = section.querySelector('[data-testid="list-group-toggle"]');
    const controlled = toggle ? document.getElementById(toggle.getAttribute("aria-controls") ?? "") : null;
    const box = toggle?.getBoundingClientRect();
    return {
      head: (section.querySelector("h2")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      shut: section.getAttribute("data-closed") === "shut",
      toggle: toggle ? { button: toggle.tagName === "BUTTON", expanded: toggle.getAttribute("aria-expanded"), controls: Boolean(controlled), height: Math.round(box.height), focused: document.activeElement === toggle } : null,
      rows: [...section.querySelectorAll("li a")].filter((a) => a.getBoundingClientRect().height > 0).map((a) => /\/requests\/([^/?#]+)/.exec(a.getAttribute("href") ?? "")?.[1]).filter(Boolean),
    };
  });
}

/** A list's records, in the order drawn. Runs in the page. */
function drawnOrder(kindPath) {
  return [...document.querySelectorAll('[data-testid="records"] li a')].map((a) => new RegExp(`/${kindPath}/([^/?#]+)`).exec(a.getAttribute("href") ?? "")?.[1]).filter(Boolean);
}

/* ── the run ──────────────────────────────────────────────────────────── */

const host = await buildHost();
const errors = [];
const seen = { chips: [], pane: [], typed: [], via: [], named: [], badges: [], cards: [], seeAll: [], rows: [], page: [], grouped: [], opened: [], resorted: [], ranked: [], narrowed: [], section: [], refused: [], shared: [], hidden: [] };
const featureNames = features.map((feature) => feature.name);
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const screen of SCREENS) {
      const viewport = { width: screen.width, height: screen.height };
      const label = `${engine} ${screen.name}`;
      const open = async (path, query = "") => {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${label} ${path}: ${error.message}`));
        await page.goto(`${at("growing-host")}${path}${query ? `?${query}` : ""}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        const failed = await page.evaluate(() => window.__failed ?? null);
        if (failed) errors.push(`${label} ${path}: the document did not compile: ${failed}`);
        await page.waitForTimeout(800);
        return { page, close: () => context.close() };
      };
      const shot = async (page, name, fullPage = false) => {
        if (!SHOTS || engine !== engines[0]) return;
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: join(SHOTS, `${engine}-${screen.name}-${name}.png`), fullPage });
      };
      const openFilter = async (page) => {
        const word = (await page.locator('button[data-testid="arrange-add"]').isVisible().catch(() => false)) ? "add" : "all";
        await page.click(`button[data-testid="arrange-${word}"]`);
        await page.waitForSelector('[data-testid="arrange-list"] [data-testid="arrange-section"]', { timeout: 10_000 });
        await page.waitForTimeout(200);
      };
      const settle = () => new Promise((done) => setTimeout(done, 400));

      /* The requests, as they come: chips, badges, Filter. */
      {
        const { page, close } = await open("/requests");
        const before = await page.evaluate(listState);
        seen.badges.push({ engine, screen: screen.name, ...(await page.evaluate(badges)) });
        await shot(page, "requests");
        // One press of a status chip.
        const chip = page.locator('[data-testid="arrange-chip"][data-value="status:considering"]');
        const chipWords = (await chip.count()) > 0 ? (await chip.textContent())?.trim() : null;
        if ((await chip.count()) > 0) await chip.click();
        await settle();
        const after = await page.evaluate(listState);
        const beside = await page.evaluate(onBesideTheCount);
        await shot(page, "requests-considering");
        // Taken off by its own ×.
        const remove = page.locator('[data-testid="arrange-condition"] button').first();
        if ((await remove.count()) > 0) await remove.click();
        await settle();
        const removed = await page.evaluate(listState);
        seen.chips.push({ engine, screen: screen.name, before: { count: before.count, chips: before.chips.map((one) => one.words) }, chipWords, after: { count: after.count, on: after.on, pressed: after.chips.filter((one) => one.pressed).map((one) => one.value) }, beside, removed: { count: removed.count, on: removed.on } });

        // Filter opens short.
        await openFilter(page);
        const closed = await page.evaluate(paneState, featureNames);
        await shot(page, "filter");
        // Every heading opened: the list scrolls in itself, its box at its top.
        for (const key of (closed.headings ?? []).map((one) => one.key)) {
          const heading = page.locator(`[data-testid="arrange-list"] [data-testid="arrange-section"][data-key="${key}"][aria-expanded="false"]`);
          if ((await heading.count()) > 0) await heading.click();
        }
        await page.evaluate(() => {
          const pane = document.querySelector('[data-testid="arrange-list"]');
          if (pane) pane.scrollTop = pane.scrollHeight;
        });
        await page.waitForTimeout(150);
        const opened = await page.evaluate(paneState, featureNames);
        await shot(page, "filter-opened");
        seen.pane.push({ engine, screen: screen.name, closed, opened });

        // A relation with twenty people at its far end is found by typing.
        await page.keyboard.press("Escape");
        await openFilter(page);
        const votes = page.locator('[data-testid="arrange-list"] [data-testid="arrange-section"][data-key="votes"]');
        let typed = { section: (await votes.count()) > 0 };
        if (typed.section) {
          await votes.click();
          const box = page.locator('[data-testid="arrange-far-find"][data-key="votes"]');
          typed.box = (await box.count()) > 0;
          // The people listed, apart from "anything" and "nothing".
          const people = '[data-testid="arrange-list"] [data-section="votes"] .graview-arrange-item:not([data-value$=":*"]):not([data-value$=":none"])';
          const listedBefore = await page.locator(people).count();
          if (typed.box) await box.pressSequentially("Okaf");
          await page.waitForTimeout(150);
          const listed = await page.locator(people).count();
          typed = { ...typed, listedBefore, listed };
        }
        seen.typed.push({ engine, screen: screen.name, ...typed });

        // The relation to many features is offered by what the feature is: its stage.
        await page.keyboard.press("Escape");
        await openFilter(page);
        const via = page.locator('[data-testid="arrange-list"] [data-testid="arrange-section"][data-key="became.stage"]');
        const offeredBecame = (await page.locator('[data-testid="arrange-list"] [data-testid="arrange-section"][data-key="became"]').count()) > 0;
        let viaSeen = { section: (await via.count()) > 0, offeredBecame };
        if (viaSeen.section) {
          await via.click();
          await page.click('[data-testid="arrange-list"] [data-value="became.stage:building"]');
          await settle();
          const state = await page.evaluate(listState);
          viaSeen = { ...viaSeen, count: state.count, on: state.on };
        }
        seen.via.push({ engine, screen: screen.name, ...viaSeen });
        seen.page.push({ engine, screen: screen.name, where: "requests", sideways: before.pageScrollsSideways || after.pageScrollsSideways });
        await close();
      }

      /* The declaration names the relation: a feature found and kept in a few keystrokes. */
      {
        const { page, close } = await open("/requests", "lists=1");
        await openFilter(page);
        const closed = await page.evaluate(paneState, featureNames);
        const word = WANTED.name.slice(0, 6);
        await page.locator('[data-testid="arrange-filter-find"]').pressSequentially(word);
        await page.waitForTimeout(200);
        const matches = await page.locator('[data-testid="arrange-list"] [data-section="became"] .graview-arrange-item').count();
        const match = page.locator(`[data-testid="arrange-list"] [data-section="became"] [data-value="became:${WANTED.id}"]`);
        const found = (await match.count()) > 0;
        await shot(page, "filter-found");
        if (found) await match.click();
        await settle();
        const state = await page.evaluate(listState);
        seen.named.push({ engine, screen: screen.name, headings: closed.headings?.map((one) => one.key), keystrokes: word.length, matches, found, count: state.count, on: state.on });
        await close();
      }

      /* The declaration opens the lists: requests grouped by status with done and declined shut last; features by their rank. */
      {
        const { page, close } = await open("/requests", "lists=2");
        const groups = await page.evaluate(groupState);
        await shot(page, "requests-grouped", true);
        seen.grouped.push({ engine, screen: screen.name, groups: groups.map((group) => ({ ...group, rows: group.rows.length })) });
        // The first shut group, reached and opened from the keyboard.
        const toggle = page.locator('[data-testid="list-group-toggle"]').first();
        await toggle.focus();
        await page.keyboard.press("Enter");
        await settle();
        const after = await page.evaluate(groupState);
        const search = await page.evaluate(() => location.search);
        await shot(page, "requests-done-opened");
        seen.opened.push({ engine, screen: screen.name, done: after.find((group) => group.head.includes("done")), declined: after.find((group) => group.head.includes("declined")), search });
        await close();

        // A person sorts it another way (the address the arranging line writes): the groups stand, the closed ones last.
        const resorted = await open("/requests", "lists=2&sort=label:desc&group=status");
        const regrouped = await resorted.page.evaluate(groupState);
        const names = new Map(requests.map((request) => [request.id, request.name]));
        const planned = regrouped[0]?.rows.map((id) => names.get(id)) ?? [];
        seen.resorted.push({ engine, screen: screen.name, heads: regrouped.map((group) => group.head), shut: regrouped.map((group) => group.shut), plannedFirst: planned.slice(0, 3), descending: planned.every((name, at) => at === 0 || planned[at - 1].localeCompare(name, undefined, { numeric: true, sensitivity: "base" }) >= 0) });
        await resorted.close();

        const featuresList = await open("/features", "lists=2");
        const order = await featuresList.page.evaluate(drawnOrder, "features");
        await shot(featuresList.page, "features-ranked");
        seen.ranked.push({ engine, screen: screen.name, first: order.slice(0, 8), expected: ranked.slice(0, 8), rows: order.length });
        await featuresList.close();
      }

      /* "Up next": cards at a glance, no box of their own, and the way to the rest. */
      {
        const { page, close } = await open("/places/up-next");
        const measured = await page.evaluate(cards);
        await shot(page, "up-next", true);
        let went = null;
        const all = page.locator('[data-testid="see-all"]', { hasText: "See all" }).first();
        if ((await all.count()) > 0) {
          await all.click();
          await settle();
          went = { path: await page.evaluate(() => location.pathname), count: (await page.evaluate(listState)).count };
        }
        seen.cards.push({ engine, screen: screen.name, ...measured });
        seen.seeAll.push({ engine, screen: screen.name, links: measured.seeAll, went });
        seen.page.push({ engine, screen: screen.name, where: "up-next", sideways: measured.pageScrollsSideways });
        await close();
      }

      /* The features: a summary in one line on a row, whole on the page. */
      {
        const { page, close } = await open("/features");
        const rows = await page.evaluate(rowLines);
        const state = await page.evaluate(listState);
        await shot(page, "features");
        await close();
        const record = await open(`/features/${LONGEST.id}`);
        const whole = await record.page.evaluate(wholeSummary, LONGEST.summary.slice(0, 40));
        await shot(record.page, "feature-page", true);
        await record.close();
        seen.rows.push({ engine, screen: screen.name, ...rows, chips: [...new Set(state.chips.map((one) => one.value.split(":")[0]))], whole });
        seen.page.push({ engine, screen: screen.name, where: "features", sideways: state.pageScrollsSideways });
      }
      /* A custom home's links: to a list narrowed, to a section, refused for a field the kind lacks; and a lens kept off the lists. */
      {
        const homeDrawn = (page) => page.waitForFunction(() => Boolean(document.querySelector("[data-worker-view]")?.shadowRoot?.querySelector("#building")), null, { timeout: 30_000 }).then(() => true, () => false);
        const where = (page) => page.evaluate(() => ({ path: `${location.pathname}${location.search}${location.hash}`, focused: (document.activeElement?.textContent ?? "").trim(), top: Math.round(document.activeElement?.getBoundingClientRect().top ?? -1), height: innerHeight }));
        {
          const { page, close } = await open("/", "lists=3");
          const drawn = await homeDrawn(page);
          const bar = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="app-place-"]')].map((one) => one.getAttribute("data-testid")));
          await page.locator("#building").click();
          await page.waitForTimeout(800);
          seen.narrowed.push({ engine, screen: screen.name, drawn, ...(await where(page)), count: (await page.evaluate(listState)).count });
          seen.hidden.push({ engine, screen: screen.name, bar });
          await close();
        }
        {
          const { page, close } = await open("/", "lists=3");
          await homeDrawn(page);
          await page.locator("#section").click();
          await page.waitForTimeout(1_200);
          seen.section.push({ engine, screen: screen.name, ...(await where(page)), title: await page.evaluate(() => document.querySelector("[data-graview-page-title]")?.textContent?.trim() ?? null) });
          await shot(page, "navigate-section");
          await close();
        }
        {
          const { page, close } = await open("/", "lists=3");
          await homeDrawn(page);
          await page.locator("#wrong").click();
          await page.waitForTimeout(600);
          seen.refused.push({ engine, screen: screen.name, ...(await where(page)), problems: await page.evaluate(() => window.__problems) });
          await close();
        }
        {
          const { page, close } = await open("/places", "lists=3");
          const listed = await page.evaluate(() => (document.querySelector('[data-testid="places"]')?.textContent ?? "").includes("Up next"));
          await close();
          seen.hidden.at(-1).pageList = listed;
        }
        {
          // A shared address: the list narrowed, at its section, with nothing pressed.
          const context = await browser.newContext({ viewport });
          const page = await context.newPage();
          page.on("pageerror", (error) => errors.push(`${label} shared: ${error.message}`));
          await page.goto(`${at("growing-host")}/features?filter=stage%3Ashipped&lists=3#features`, { waitUntil: "load" });
          await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
          await page.waitForTimeout(1_200);
          seen.shared.push({ engine, screen: screen.name, ...(await where(page)), count: (await page.evaluate(listState)).count });
          await context.close();
        }
      }
      if (PROBE) process.stdout.write(`${label}: ${JSON.stringify(Object.fromEntries(Object.entries(seen).map(([key, list]) => [key, list.at(-1)])))}\n`);
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  host.stop();
}

const runs = SCREENS.length * engines.length;
const every = (list, held) => list.length > 0 && list.length >= runs && list.every(held);

report.checks.aStatusIsAChipWithItsCountAndOnePressNarrows = {
  seen: seen.chips,
  ok: every(seen.chips, (one) => one.before.count === `${requests.length} requests` && one.chipWords === `Considering${considering}` && one.after.count === `${considering} of ${requests.length} requests` && one.after.pressed.join() === "status:considering"),
};
report.checks.whatIsOnIsARemovableChipBesideTheCount = {
  seen: seen.chips.map((one) => ({ engine: one.engine, screen: one.screen, on: one.after.on, beside: one.beside, removed: one.removed })),
  ok: every(seen.chips, (one) => one.after.on.length === 1 && one.beside && one.removed.on.length === 0 && one.removed.count === `${requests.length} requests`),
};
report.checks.filterOpensShortEveryHeadingClosedAndNoFeatureNamed = {
  seen: seen.pane.map((one) => ({ engine: one.engine, screen: one.screen, height: one.closed.box?.height, headings: one.closed.headings, entries: one.closed.entries, farNamed: one.closed.farNamed })),
  ok: every(seen.pane, (one) => one.closed.open && one.closed.headings.length > 1 && one.closed.headings.every((heading) => !heading.open) && one.closed.entries === 0 && one.closed.farNamed === 0 && one.closed.box.height <= 360),
};
report.checks.theFilterListIsOpaqueHeldToTheWindowAndScrollsInItselfUnderItsFindBox = {
  seen: seen.pane.map((one) => ({ engine: one.engine, screen: one.screen, opaque: one.opened.opaque, box: one.opened.box, view: one.opened.view, scrolls: one.opened.scrolls, findTop: one.opened.findTop })),
  ok: every(seen.pane, (one) => one.opened.opaque && one.opened.scrolls && one.opened.box.bottom <= one.opened.view.height + 1 && one.opened.box.top >= -1 && one.opened.findTop !== null && Math.abs(one.opened.findTop) <= 2),
};
const phones = seen.pane.filter((one) => one.screen === "phone");
report.checks.onAPhoneTheFilterListIsASheetAlongTheFoot = {
  seen: phones.map((one) => ({ engine: one.engine, box: one.closed.box, view: one.closed.view })),
  ok: phones.length === engines.length && phones.every((one) => one.closed.box.left <= 1 && Math.abs(one.closed.box.right - one.closed.view.width) <= 1 && Math.abs(one.closed.box.bottom - one.closed.view.height) <= 1),
};
report.checks.aRelationWithManyAtItsFarEndIsFoundByTypingAtMostEight = {
  seen: seen.typed,
  ok: every(seen.typed, (one) => one.section && one.box && one.listedBefore === 0 && one.listed > 0 && one.listed <= 8),
};
report.checks.theRelationToManyFeaturesIsOfferedByTheirStageAndNarrowsRight = {
  seen: seen.via,
  ok: every(seen.via, (one) => one.section && !one.offeredBecame && one.count === `${becameBuilding} of ${requests.length} requests` && one.on?.length === 1),
};
report.checks.aNamedRelationFindsAFeatureInAFewKeystrokes = {
  seen: seen.named,
  ok: every(seen.named, (one) => one.headings?.join() === "became,became.stage" && one.keystrokes <= 6 && one.found && one.matches <= 8 && one.count === `${answering(WANTED.id)} of ${requests.length} requests`),
};
report.checks.aRowsBadgesAreWholeAndACountOfNothingIsNoBadge = {
  seen: seen.badges,
  ok: every(seen.badges, (one) => one.rows > 0 && one.cut.length === 0 && one.zero === 0 && one.votes > 0),
};
report.checks.aCardsSummaryIsThreeLinesAtMostAndCardsKeepTheirHeights = {
  seen: seen.cards.map((one) => ({ engine: one.engine, screen: one.screen, cards: one.cards, texts: one.texts, mostLines: one.mostLines, sideBySide: one.sideBySide, mixed: one.mixed, alignment: one.alignment })),
  // On a phone the cards stand one to a row; at a desk, a row of cards holding different amounts is different heights.
  ok: every(seen.cards, (one) => one.cards === 15 && one.texts === 15 && one.mostLines <= 3.2 && /start/.test(one.alignment) && (one.screen === "phone" || one.mixed > 0)),
};
report.checks.aListOfCardsIsNoBoxToScrollOfItsOwn = {
  seen: seen.cards.map((one) => ({ engine: one.engine, screen: one.screen, scrollers: one.scrollers, lensScrolls: one.lensScrolls })),
  ok: every(seen.cards, (one) => !one.lensScrolls && one.scrollers.length <= 1 && !one.scrollers.includes("place-lens")),
};
report.checks.aListCutByItsLimitSaysSeeAllAndGoesThere = {
  seen: seen.seeAll,
  ok: every(seen.seeAll, (one) => one.links.some((link) => link.words === `See all ${features.length} features`) && one.went?.path === "/features" && one.went?.count === `${features.length} features`),
};
report.checks.aRowSaysTheSummaryInOneLineAndThePageSaysItWhole = {
  seen: seen.rows,
  ok: every(seen.rows, (one) => one.texts > 0 && one.mostLines <= 1.2 && one.whole.found && one.whole.paragraphs === 6 && !one.whole.clipped),
};
report.checks.theFeaturesStageAndAreaStandAsChips = {
  seen: seen.rows.map((one) => ({ engine: one.engine, screen: one.screen, chips: one.chips })),
  ok: every(seen.rows, (one) => one.chips.join() === "stage,area"),
};
const heads = (status, shut) => (shut ? `▸${status} · ${byStatus(status).length} requests` : `${status} ${byStatus(status).length}`);
report.checks.aDeclaredListOpensItsGroupsInOrderWithDoneAndDeclinedShutLast = {
  seen: seen.grouped,
  ok: every(seen.grouped, (one) =>
    one.groups.map((group) => group.head).join("|") === [...ORDER.map((status) => heads(status, false)), ...CLOSED.map((status) => heads(status, true))].join("|") &&
    one.groups.slice(0, ORDER.length).every((group, at) => !group.shut && group.rows === byStatus(ORDER[at]).length) &&
    one.groups.slice(ORDER.length).every((group) => group.shut && group.rows === 0 && group.toggle?.button && group.toggle.expanded === "false" && group.toggle.controls && group.toggle.height >= 24),
  ),
};
report.checks.aShutGroupOpensFromTheKeyboardAndTheAddressKeepsIt = {
  seen: seen.opened,
  ok: every(seen.opened, (one) =>
    one.done?.toggle?.expanded === "true" && one.done.toggle.focused && one.done.rows.length === byStatus("done").length && one.declined?.shut === true && /[?&]open=done(&|$)/.test(one.search),
  ),
};
report.checks.aPersonsOwnOrderKeepsTheDeclaredGroupsAndTheClosedLast = {
  seen: seen.resorted,
  ok: every(seen.resorted, (one) => one.heads[0] === heads("planned", false) && one.shut.join() === "false,false,false,true,true" && one.descending),
};
report.checks.featuresOpenByTheRankTheyWorkOutThenByName = {
  seen: seen.ranked,
  ok: every(seen.ranked, (one) => one.rows === features.length && one.first.join() === one.expected.join()),
};
report.checks.aViewsLinkToAListNarrowedLandsOnItNarrowedAtAnAddressThatSaysSo = {
  seen: seen.narrowed,
  ok: every(seen.narrowed, (one) => one.drawn && one.path === "/features?filter=stage%3Abuilding" && one.count === `${building} of ${features.length} features`),
};
report.checks.aViewsNavigateToASectionLandsOnItsHeadingWithTheKeyboard = {
  seen: seen.section,
  ok: every(seen.section, (one) => one.path === "/places/up-next#every-feature" && one.title === "Up next" && one.focused === "Every feature" && one.top >= 0 && one.top < one.height),
};
report.checks.aFilterOnAFieldTheKindLacksGoesNowhereAndSaysWhy = {
  seen: seen.refused,
  ok: every(seen.refused, (one) => one.path === "/?lists=3" && one.problems.some((said) => /^The filter on "features" goes nowhere: Features have no field "stag" to filter by; they filter by name, stage, area/.test(said))),
};
report.checks.aSharedAddressOpensTheListNarrowedAtItsSection = {
  seen: seen.shared,
  ok: every(seen.shared, (one) => one.count === `${shipped} of ${features.length} features` && one.focused === "Features"),
};
report.checks.aLensKeptOffTheListsIsOnNeitherTheBarNorThePageListAndIsReachedAtItsAddress = {
  seen: seen.hidden.map((one, index) => ({ ...one, reached: seen.section[index]?.title ?? null })),
  ok: every(seen.hidden, (one, index) => one.bar.some((key) => key === "app-place-kind:feature") && !one.bar.some((key) => /up-next/.test(key)) && one.pageList === false && seen.section[index]?.title === "Up next"),
};
report.checks.noPageScrollsSideways ={ seen: seen.page, ok: seen.page.length > 0 && seen.page.every((one) => !one.sideways) };
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/growing.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/growing.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
