#!/usr/bin/env node
/**
 * A VIEW DRAWN WHERE THE PAGE CANNOT READ HAS ITS LINES TO THE CITY
 * (Graview HQ feature:f-one-face-lines-from-frame-views, brief
 * b-cloud-2026-11-13-connected-under-a-view).
 *
 * At Nearby the one face draws a line from each record a page shows to
 * that record's building. A worker view draws in a shadow root and a frame
 * guest in a document of another origin, so the page floated beside the
 * city tied to nothing. Held here, on a roadmap's pages over its city:
 *
 *   · a worker view's `data-record` cards each have their line, its end
 *     within 2 px of the card's box, and a card naming no record has none;
 *     scrolling the page keeps every line on its card, every frame; and so
 *     does a move to the City and back, every frame;
 *   · going to a record and back at Nearby, the lines come back;
 *   · a frame guest's `data-record` rows have their lines within 2 px of
 *     each row; scrolling the frame's own list keeps them on the rows in
 *     sight, and scrolling the page keeps them on, every frame;
 *   · a seat that cannot see a record a frame marks gets no line to it;
 *   · a record page drawn by a view that names no record still has its one
 *     line, from the view to the record it is about;
 *   · a tall view that is a record's whole page: what the record is
 *     connected to is said in the first window, its pills have their lines
 *     when scrolled to, and every line at Nearby ends inside the window;
 *   · a deep, wide view is measured within a budget;
 *   · at Nearby each line starts on its own card, on the edge that faces
 *     the city, never on the page's edge;
 *   · many lines into one district are one line into it with their count,
 *     each part's own short line meeting it at the page's edge;
 *   · inside the panel no line crosses another pill or row: each runs
 *     through the gaps between the rows to the panel's edge.
 *
 *   node scripts/verify-frame-lines.mjs [--engine=chromium|webkit|firefox]   (Chromium by default)
 *
 * Writes docs/frame-lines.json.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ["chromium"];
const DESK = { width: 1440, height: 900 };
const ROADMAP = resolve(repoRoot, "scripts/fixtures/growing/roadmap.gdd.json");
/** How far a line's end may be from the element it leaves from. */
const NEAR = 2;
/** The most one measure of a deep, wide view may take, in milliseconds. */
const DEEP_MS = Number(process.env["GRAVIEW_SLOW"] ?? 1) > 1 ? 8 : 2;

/* ── the app ─────────────────────────────────────────────────────────── */

const FEATURES = ["Printable boards", "Shared drafts", "Weekly digest", "Offline pages", "Bulk edit", "Saved filters", "Public forms", "Calendar sync"];
const REQUESTS = ["Let me print a board", "Work without a connection", "Print in color", "A board on the wall", "Export a board", "Board as a poster", "Print one week", "Print the backlog"];
const SEED = {
  nodes: [
    ...FEATURES.map((name, at) => ({ id: `f${at + 1}`, kind: "feature", name, stage: ["idea", "planned", "building", "shipped"][at % 4], area: ["pages", "scene", "core", "cloud"][at % 4], summary: `What ${name.toLowerCase()} would do.` })),
    ...REQUESTS.map((name, at) => ({ id: `r${at + 1}`, kind: "request", name, status: "new", summary: "Asked." })),
    { id: "p1", kind: "person", name: "Ada Brennan" },
  ],
  edges: [
    { kind: "became", from: "r1", to: "f1" },
    ...REQUESTS.map((_, at) => ({ kind: "became", from: `r${at + 1}`, to: "f3" })),
    { kind: "votes", from: "p1", to: "r1" },
  ],
};
/* Two seats: the owner sees everything; a reader sees features and requests, and nobody's people. */
const SIGHT = [
  { roles: "*", kinds: ["feature", "request"] },
  { roles: ["owner"], kinds: ["person"] },
];

/* A worker view over every feature: tall cards, each marked with its record, and one marked with no record at all. */
const BOARD = {
  manifest: { name: "feature-board", title: "Feature board", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] } },
  source: `graview.style(".card{display:block;box-sizing:border-box;height:132px;margin:0 0 12px;padding:12px;border:1px solid var(--graview-edge);border-radius:8px} h3{margin:0 0 6px;font-size:1rem} #card-f2{transition:transform 900ms linear} #cards:hover #card-f2{transform:translate(-60px, 50px)}");
graview.onProps((props) => graview.render(graview.html\`<div id="cards">\${props.nodes.map((node) => graview.html\`<div class="card" data-record=\${node.id} id=\${"card-" + node.id}><h3>\${node.label}</h3><p>\${node.summary ?? ""}</p></div>\`)}<div class="card" data-record="nobody-here" id="card-nobody"><h3>Not a record</h3></div></div>\`));`,
};
/*
 * A worker view that is a feature's whole page, as Deep Time's period pages are: a long story, then a
 * pill for each request that became the feature. On a feature nothing became, it marks nothing at all.
 */
const PERIOD = {
  manifest: { name: "feature-period", title: "Feature period", attach: "feature", cardinality: "one", replaces: "page", reads: { kinds: ["feature", "request"], edges: ["became"] } },
  source: `graview.style(".story{margin:0 0 14px;line-height:1.6;min-height:120px} .pill{display:inline-block;margin:4px;padding:6px 10px;border:1px solid var(--graview-edge);border-radius:999px}");
graview.onProps((props) => {
  const node = props.node;
  const became = props.edges.filter((edge) => edge.kind === "became" && edge.to === node.id).map((edge) => props.nodes.find((one) => one.id === edge.from)).filter(Boolean);
  const story = Array.from({ length: became.length > 0 ? 14 : 1 }, (_, at) => graview.html\`<p class="story">Part \${at + 1} of the story of \${node.label}, told at length so the page is tall.</p>\`);
  graview.render(graview.html\`<article id="period"><h2>\${node.label}</h2>\${story}<div id="pills">\${became.map((one) => graview.html\`<a class="pill" data-record=\${one.id} id=\${"pill-" + one.id}>\${one.label}</a>\`)}</div></article>\`);
});`,
};
/* A worker view of every request whose first row moves of itself, forever: its line stays on it every frame. */
const MOTION = {
  manifest: { name: "request-motion", title: "Request motion", attach: "request", cardinality: "many", reads: { kinds: ["request"] } },
  source: `graview.style("@keyframes bob{from{transform:translateY(0)}to{transform:translateY(60px)}} .row{display:block;height:48px;margin:6px 0;padding:8px;border:1px solid var(--graview-edge);border-radius:6px} #row-r1{animation:bob 700ms ease-in-out infinite alternate}");
graview.onProps((props) => graview.render(graview.html\`<div id="rows">\${props.nodes.slice(0, 4).map((node) => graview.html\`<div class="row" data-record=\${node.id} id=\${"row-" + node.id}>\${node.label}</div>\`)}</div>\`));`,
};
/* A worker view of every person, deep and wide: what one measure of it costs. */
const DEEP = {
  manifest: { name: "deep-view", title: "Deep view", attach: "person", cardinality: "many", reads: { kinds: ["feature"] } },
  source: `graview.onProps((props) => {
  const ids = props.nodes.filter((node) => node.kind === "feature").map((node) => node.id);
  const marks = Array.from({ length: 400 }, (_, at) => graview.html\`<span data-record=\${ids[at % ids.length]} style="display:inline-block;width:10px;height:10px">.</span>\`);
  let inner = graview.html\`<div id="marks">\${marks}</div>\`;
  for (let depth = 0; depth < 50; depth++) inner = graview.html\`<div style="overflow:hidden;padding:1px">\${inner}</div>\`;
  graview.render(inner);
});`,
};

/* A frame guest on a request's page: features and a person, rows marked with their records in a list that scrolls. */
const FRAME_ROWS = ["f1", "f2", "p1", "f3", "f4", "f5", "f6", "nobody-here"];
const guestPage = (client) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:15px system-ui,sans-serif;color:#222;background:#fff}
h3{margin:0;padding:10px 12px;font-size:1rem}
#list{height:220px;overflow:auto;margin:0 12px 12px;border:1px solid #aaa;border-radius:6px}
.row{box-sizing:border-box;height:64px;margin:6px;padding:10px;border-radius:6px;background:#e8e8e2}
</style></head><body><h3 id="title">What this might become</h3><div id="list"></div>
<script>${client}</script>
<script>
const guest = GraviewGuest.connect();
const list = document.getElementById("list");
guest.subscribe(() => {
  if (list.childElementCount) return;
  for (const id of ${JSON.stringify(FRAME_ROWS)}) {
    const row = document.createElement("div");
    row.className = "row";
    row.id = "row-" + id;
    row.setAttribute("data-record", id);
    row.textContent = id === "nobody-here" ? "Not a record" : "Row " + id;
    list.appendChild(row);
  }
  guest.size(300);
});
</script></body></html>`;

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The roadmap</title>
<style>body{margin:0;background:#f6f6f2;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-frame-lines-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { createRoot } from "react-dom/client";
        import { Store } from "@graview/core";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { createViews } from "@graview/react/provider";
        import { registerDefaultViews } from "@graview/primitives/pages";
        import { guestView } from "@graview/guest/host";
        import { registerWorkerView } from "@graview/guest/host/views";
        import { PagesApp } from "@graview/pages";
        import roadmap from ${JSON.stringify(ROADMAP)};
        const compiled = compileDocumentWithoutCheck(roadmap, { today: () => "2026-11-12" });
        if (!compiled.ok) throw new Error(compiled.findings.map((finding) => finding.message).join("; "));
        const app = compiled.app;
        const policy = { ...(app.policy ?? {}), sees: ${JSON.stringify(SIGHT)} };
        const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: ${JSON.stringify(SEED)}, policy });
        const seat = new URLSearchParams(location.search).get("seat") === "reader" ? { kind: "human", id: "u:reader", roles: ["reader"] } : { kind: "human", id: "u:owner", roles: ["owner"] };
        let views = registerDefaultViews(app.schema, createViews(app.schema));
        for (const one of [${JSON.stringify(BOARD)}, ${JSON.stringify(PERIOD)}, ${JSON.stringify(DEEP)}, ${JSON.stringify(MOTION)}]) views = registerWorkerView(views, { manifest: one.manifest, worker: { source: one.source } });
        views = views.register("request", { cardinality: "one", fidelity: "full" }, guestView({ url: "/frame.html", name: "request-card", title: "What this might become", reads: { kinds: ["feature", "person"] } }));
        createRoot(document.getElementById("app")).render(createElement(PagesApp, { context: { store, app, principal: seat, views, sceneUnderPages: true } }));`,
      resolveDir: resolve(repoRoot, "packages/pages"),
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
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const frame = guestPage(readFileSync(resolve(repoRoot, "packages/guest/client.js"), "utf8").replace(/<\/script/gi, "<\\/script"));
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    if (path === "/frame.html") return (response.writeHead(200, { "content-type": "text/html" }), response.end(frame));
    const name = path.replace(/^\/+/, "") || "index.html";
    const file = join(out, name);
    const script = name.endsWith(".js");
    if (!file.startsWith(out) || (script && !existsSync(file))) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": script ? "text/javascript" : "text/html" });
    response.end(readFileSync(script ? file : join(out, "index.html")));
  });
  await vacant(portFor("frame-lines-host"));
  await new Promise((ready) => host.listen(portFor("frame-lines-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/* ── in the page ─────────────────────────────────────────────────────── */

async function restAt(page, level, timeout = 15_000) {
  await page.waitForFunction(
    (want) => {
      const sheet = document.querySelector("[data-graview-one-place]");
      const city = document.querySelector('[data-testid="one-place-city"]');
      const now = Number(city?.getAttribute("data-graview-altitude-now") ?? (want === 0 ? 0 : -1));
      return Number(sheet?.getAttribute("data-graview-one-place")) === want && Math.abs(now - want) < 0.002;
    },
    level,
    { timeout },
  );
  await page.waitForTimeout(300);
}

const goLevel = async (page, level) => {
  await page.locator(`[data-testid="altitude-stop-${level}"]`).first().click();
  await restAt(page, level);
};

/** Open a page and go to Nearby, once what is on it has drawn. */
async function nearby(page, path, drawn) {
  await page.goto(`${at("frame-lines-host")}${path}`, { waitUntil: "load" });
  await page.waitForSelector("[data-graview-one-place]", { timeout: 60_000 });
  await page.waitForFunction(drawn, null, { timeout: 30_000 });
  await goLevel(page, 1);
  await page.waitForTimeout(300);
}

/** The lines drawn now: each one's record, the middle of the part it leaves from and where on it the line starts, where it leaves the page, its far end, whether it points past the city's side, and the district it is gathered into with how many. */
const linesNow = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-graview-line]")].map((g) => {
      const pair = (name) => (g.getAttribute(name) ?? "NaN,NaN").split(",").map(Number);
      const [x, y] = pair("data-graview-line-part");
      const [tx, ty] = pair("data-graview-line-to");
      const [sx, sy] = pair("data-graview-line-start");
      const [fx, fy] = pair("data-graview-line-from");
      const count = g.getAttribute("data-graview-line-count");
      return { key: g.getAttribute("data-graview-line"), on: g.getAttribute("data-graview-line-on"), part: { x, y }, start: { x: sx, y: sy }, from: { x: fx, y: fy }, to: { x: tx, y: ty }, under: g.hasAttribute("data-graview-line-under"), gathered: g.getAttribute("data-graview-line-gathered"), count: count === null ? null : Number(count) };
    }),
  );

const within = (point, box, near = NEAR) => point.x >= box.left - near && point.x <= box.right + near && point.y >= box.top - near && point.y <= box.bottom + near;
const round = (box) => box && Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Number(Number(value).toFixed(2))]));

/** A worker view's marked elements as the page sees them, in the window's pixels, and whether each one's middle is in sight on the panel. */
const marksNow = (page, view) =>
  page.evaluate((view) => {
    const region = document.querySelector(`[data-worker-view="${view}"]`);
    const port = region?.closest("[data-graview-one-place]")?.getBoundingClientRect();
    return [...(region?.shadowRoot?.querySelectorAll("[data-record]") ?? [])].map((card) => {
      const r = card.getBoundingClientRect();
      const mid = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      return { id: card.getAttribute("data-record"), box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, inSight: Boolean(port && mid.y >= port.top && mid.y <= port.bottom && mid.x >= port.left && mid.x <= port.right) };
    });
  }, view);

/** Every mark in sight has its line on it, and nothing marked "nobody-here" has one. */
function marksHeld(marks, lines) {
  const inSight = marks.filter((mark) => mark.inSight && mark.id !== "nobody-here");
  const missing = inSight.filter((mark) => !lines.some((line) => line.key === mark.id && within(line.part, mark.box))).map((mark) => ({ id: mark.id, box: round(mark.box), line: lines.find((line) => line.key === mark.id)?.part ?? null }));
  return { inSight: inSight.map((mark) => mark.id), missing, stray: lines.filter((line) => line.key === "nobody-here").length, ok: inSight.length >= 2 && missing.length === 0 && !lines.some((line) => line.key === "nobody-here") };
}

/** Every frame from now: each line's part, and each worker view mark's box, read after the face has drawn that frame. */
const record = (page, view) =>
  page.evaluate((view) => {
    window.__frames = [];
    window.__stop = false;
    const tick = () => {
      if (window.__stop) return;
      requestAnimationFrame(tick);
      const region = view ? document.querySelector(`[data-worker-view="${view}"]`) : null;
      const frame = document.querySelector('iframe[data-guest-view="request-card"]');
      const marks = Object.fromEntries([...(region?.shadowRoot?.querySelectorAll("[data-record]") ?? [])].map((card) => {
        const r = card.getBoundingClientRect();
        return [card.getAttribute("data-record"), { left: r.left, top: r.top, right: r.right, bottom: r.bottom }];
      }));
      const f = frame?.getBoundingClientRect();
      const svg = document.querySelector('[data-testid="one-place-lines"]');
      window.__frames.push({
        opacity: Number(svg ? getComputedStyle(svg).opacity : 0),
        altitude: Number(document.querySelector('[data-testid="one-place-city"]')?.getAttribute("data-graview-altitude-now") ?? 0),
        lines: [...document.querySelectorAll("[data-graview-line]")].map((g) => {
          const [x, y] = (g.getAttribute("data-graview-line-part") ?? "NaN,NaN").split(",").map(Number);
          return { key: g.getAttribute("data-graview-line"), part: { x, y } };
        }),
        marks,
        frame: f ? { left: f.left, top: f.top } : null,
      });
    };
    requestAnimationFrame(tick);
  }, view);
const stopRecording = (page) => page.evaluate(() => ((window.__stop = true), window.__frames ?? []));

/** Every line on its worker view mark, every frame recorded while the lines are drawn. */
function everyFrameOnMarks(frames) {
  let worst = 0;
  let counted = 0;
  const examples = [];
  for (const frame of frames) {
    if (frame.opacity < 0.05) continue;
    for (const line of frame.lines) {
      const mark = frame.marks[line.key];
      if (!mark) continue;
      counted++;
      const miss = Math.hypot(Math.max(mark.left - line.part.x, 0, line.part.x - mark.right), Math.max(mark.top - line.part.y, 0, line.part.y - mark.bottom));
      if (miss > worst) worst = miss;
      if (miss > NEAR && examples.length < 4) examples.push({ key: line.key, miss: Number(miss.toFixed(2)), altitude: frame.altitude });
    }
  }
  return { frames: frames.length, counted, worst: Number(worst.toFixed(2)), examples };
}

/** Wheel the page over the element named, a few steps. */
async function wheelOver(page, selector, steps, by) {
  const box = await page.locator(selector).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, Math.min(box.y + 40, DESK.height - 60));
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, by);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
}

const pageScroll = (page, selector) =>
  page.evaluate((selector) => {
    for (let at = document.querySelector(selector); at; at = at.parentElement) if (at.scrollTop > 0) return at.scrollTop;
    return document.scrollingElement?.scrollTop ?? 0;
  }, selector);

const boardDrawn = () => (document.querySelector('[data-worker-view="feature-board"]')?.shadowRoot?.querySelectorAll("[data-record]").length ?? 0) > 3;
const frameDrawn = () => document.querySelector('iframe[data-guest-view="request-card"]')?.hasAttribute("data-guest-view-drawn") ?? false;
const periodDrawn = () => document.querySelector('[data-worker-view="feature-period"]')?.hasAttribute("data-worker-view-drawn") ?? false;

/* ── the claims' drives ──────────────────────────────────────────────── */

async function workerCards(page, where) {
  await nearby(page, "/places/feature-board", boardDrawn);
  return { where, ...marksHeld(await marksNow(page, "feature-board"), await linesNow(page)) };
}

async function workerScroll(page, where) {
  await nearby(page, "/places/feature-board", boardDrawn);
  await record(page, "feature-board");
  await wheelOver(page, '[data-worker-view="feature-board"]', 6, 120);
  const measured = everyFrameOnMarks(await stopRecording(page));
  const scrolled = await pageScroll(page, '[data-worker-view="feature-board"]');
  const settled = marksHeld(await marksNow(page, "feature-board"), await linesNow(page));
  return { where, ...measured, scrolled, settled, ok: measured.frames > 10 && measured.counted > 0 && measured.worst <= NEAR && scrolled > 0 && settled.ok };
}

async function levelMove(page, where) {
  await nearby(page, "/places/feature-board", boardDrawn);
  await record(page, "feature-board");
  await goLevel(page, 2);
  await goLevel(page, 1);
  const frames = await stopRecording(page);
  const measured = everyFrameOnMarks(frames);
  const moving = frames.filter((frame) => frame.altitude > 1.01 && frame.altitude < 1.99 && frame.opacity >= 0.05).length;
  const settled = marksHeld(await marksNow(page, "feature-board"), await linesNow(page));
  return { where, ...measured, framesDrawnBetweenLevels: moving, settled, ok: measured.counted > 0 && measured.worst <= NEAR && moving > 2 && settled.ok };
}

async function awayAndBack(page, where) {
  await nearby(page, "/places/feature-board", boardDrawn);
  const before = marksHeld(await marksNow(page, "feature-board"), await linesNow(page));
  await page.locator('[data-worker-view="feature-board"]').locator("#card-f1 h3").click();
  await page.waitForFunction(() => location.pathname.endsWith("/features/f1"), null, { timeout: 15_000 });
  await page.waitForFunction(periodDrawn, null, { timeout: 30_000 });
  await restAt(page, 1);
  const there = (await linesNow(page)).map((line) => line.key);
  await page.goBack();
  await page.waitForFunction(() => location.pathname.endsWith("/places/feature-board"), null, { timeout: 15_000 });
  await page.waitForFunction(boardDrawn, null, { timeout: 30_000 });
  await restAt(page, 1);
  await page.waitForTimeout(400);
  const after = marksHeld(await marksNow(page, "feature-board"), await linesNow(page));
  return { where, before, there, after, ok: before.ok && there.includes("r1") && after.ok };
}

/** The frame's rows as its own document draws them, in the window's pixels. */
async function rowsNow(page) {
  const frameBox = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-guest-view="request-card"]');
    const r = frame?.getBoundingClientRect();
    const port = frame?.closest("[data-graview-one-place]")?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, port: port ? { top: port.top, bottom: port.bottom } : null } : null;
  });
  const guest = page.frames().find((one) => one.url().endsWith("/frame.html"));
  if (!frameBox || !guest) return { frameBox, rows: [] };
  const rows = await guest.evaluate(() => {
    const list = document.getElementById("list").getBoundingClientRect();
    return [...document.querySelectorAll("[data-record]")].map((row) => {
      const r = row.getBoundingClientRect();
      const top = Math.max(r.top, list.top);
      const bottom = Math.min(r.bottom, list.bottom);
      return { id: row.getAttribute("data-record"), box: { left: r.left, top, right: r.right, bottom }, shown: bottom - top >= 1 };
    });
  });
  return {
    frameBox,
    rows: rows.map((row) => {
      const box = { left: row.box.left + frameBox.left, top: row.box.top + frameBox.top, right: row.box.right + frameBox.left, bottom: row.box.bottom + frameBox.top };
      const mid = (box.top + box.bottom) / 2;
      return { ...row, box, inSight: row.shown && (!frameBox.port || (mid >= frameBox.port.top && mid <= frameBox.port.bottom)) };
    }),
  };
}

/** Every row of the frame in sight that the seat may see has its line on it; no line leaves the frame for a row out of sight, one naming no record, or one the seat cannot see. */
function rowsHeld({ frameBox, rows }, lines, unseen = []) {
  const shown = rows.filter((row) => row.inSight && row.id !== "nobody-here" && !unseen.includes(row.id));
  const missing = shown.filter((row) => !lines.some((line) => line.key === row.id && within(line.part, row.box))).map((row) => ({ id: row.id, box: round(row.box), line: lines.find((line) => line.key === row.id)?.part ?? null }));
  const hiddenIds = new Set(rows.filter((row) => !row.shown).map((row) => row.id));
  // The page's own parts may name the same record (r1 became f1): only a line leaving from inside the frame is the frame's.
  const fromFrame = (line) => frameBox && within(line.part, frameBox, 0);
  const strays = lines.filter((line) => fromFrame(line) && (line.key === "nobody-here" || unseen.includes(line.key) || (hiddenIds.has(line.key) && !shown.some((row) => row.id === line.key)))).map((line) => line.key);
  return { shown: shown.map((row) => row.id), missing, strays, ok: shown.length >= 2 && missing.length === 0 && strays.length === 0 };
}

async function frameRows(page, where) {
  await nearby(page, "/requests/r1", frameDrawn);
  await page.waitForTimeout(300);
  const now = await rowsNow(page);
  const held = rowsHeld(now, await linesNow(page));
  return { where, rows: now.rows.length, ...held, ok: held.ok && held.shown.includes("p1") };
}

async function frameScroll(page, where) {
  await nearby(page, "/requests/r1", frameDrawn);
  await page.waitForTimeout(300);
  const guest = page.frames().find((one) => one.url().endsWith("/frame.html"));
  const before = rowsHeld(await rowsNow(page), await linesNow(page));
  // Its own list scrolled: the rows in sight now have the lines.
  await guest.evaluate(() => {
    document.getElementById("list").scrollTop = 150;
  });
  await page.waitForTimeout(400);
  const inFrame = rowsHeld(await rowsNow(page), await linesNow(page));
  await guest.evaluate(() => {
    document.getElementById("list").scrollTop = 1_000;
  });
  await page.waitForTimeout(400);
  const toItsEnd = rowsHeld(await rowsNow(page), await linesNow(page));
  // The page scrolled under it: read every frame, each line on its row as the frame's box carries it then.
  const local = (await rowsNow(page)).rows;
  const frameAt = await page.evaluate(() => {
    const r = document.querySelector('iframe[data-guest-view="request-card"]').getBoundingClientRect();
    return { left: r.left, top: r.top };
  });
  await record(page, null);
  await wheelOver(page, "[data-graview-one-place]", 4, 80);
  const frames = await stopRecording(page);
  let worst = 0;
  let counted = 0;
  const examples = [];
  for (const frame of frames) {
    if (!frame.frame) continue;
    const dx = frame.frame.left - frameAt.left;
    const dy = frame.frame.top - frameAt.top;
    for (const line of frame.lines) {
      const row = local.find((one) => one.id === line.key && one.shown);
      if (!row) continue;
      counted++;
      const box = { left: row.box.left + dx, right: row.box.right + dx, top: row.box.top + dy, bottom: row.box.bottom + dy };
      const miss = Math.hypot(Math.max(box.left - line.part.x, 0, line.part.x - box.right), Math.max(box.top - line.part.y, 0, line.part.y - box.bottom));
      if (miss > worst) worst = miss;
      if (miss > NEAR && examples.length < 4) examples.push({ key: line.key, miss: Number(miss.toFixed(2)) });
    }
  }
  const moved = frames.length > 1 && frames.some((frame) => frame.frame && Math.abs(frame.frame.top - frameAt.top) > 4);
  return { where, before, inFrame, toItsEnd, pageScrolled: { frames: frames.length, moved, counted, worst: Number(worst.toFixed(2)), examples }, ok: before.ok && inFrame.ok && toItsEnd.ok && moved && counted > 0 && worst <= NEAR && JSON.stringify(inFrame.shown) !== JSON.stringify(before.shown) };
}

async function unseenRow(page, where) {
  await page.goto(`${at("frame-lines-host")}/requests/r1?seat=reader`, { waitUntil: "load" });
  await page.waitForSelector("[data-graview-one-place]", { timeout: 60_000 });
  await page.waitForFunction(frameDrawn, null, { timeout: 30_000 });
  await goLevel(page, 1);
  await page.waitForTimeout(400);
  const now = await rowsNow(page);
  const lines = await linesNow(page);
  const held = rowsHeld(now, lines, ["p1"]);
  return { where, ...held, p1: lines.some((line) => line.key === "p1"), ok: held.ok && !lines.some((line) => line.key === "p1") && now.rows.some((row) => row.id === "p1" && row.inSight) };
}

async function quietRecordPage(page, where) {
  await nearby(page, "/features/f2", periodDrawn);
  const view = await page.evaluate(() => {
    const r = document.querySelector('[data-worker-view="feature-period"]')?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  });
  const lines = await linesNow(page);
  const line = lines.find((one) => one.key === "f2");
  return { where, view: round(view), line: line ? { on: line.on, part: round(line.part) } : null, ok: Boolean(view && line && line.on === "building" && within(line.part, view)) };
}

/** A tall view that is the record's whole page: what it is connected to is said in the first window; and every line ends inside the window. */
async function tallPage(page, where) {
  await nearby(page, "/features/f3", periodDrawn);
  const said = await page.evaluate(() => {
    const top = document.querySelector('[data-testid="one-place-bar"]')?.getBoundingClientRect().bottom ?? 0;
    return [...document.querySelectorAll("[data-graview-connected] [data-graview-record]")].map((chip) => {
      const r = chip.getBoundingClientRect();
      return { id: chip.getAttribute("data-graview-record"), inFirstWindow: r.top >= top - 1 && r.bottom <= innerHeight + 1 && r.height > 0 };
    });
  });
  const connected = Array.from({ length: 8 }, (_, at) => `r${at + 1}`);
  const missing = connected.filter((id) => !said.some((one) => one.id === id && one.inFirstWindow));
  const lines = await linesNow(page);
  const out = lines.filter((line) => line.under || line.to.x < 0 || line.to.y < 0 || line.to.x > DESK.width || line.to.y > DESK.height).map((line) => line.key);
  return { where, said: said.length, missing, lines: lines.length, linesPastTheWindow: out, ok: missing.length === 0 && lines.length >= 8 && out.length === 0 };
}

async function tallPills(page, where) {
  await nearby(page, "/features/f3", periodDrawn);
  await wheelOver(page, '[data-worker-view="feature-period"]', 20, 200);
  const held = marksHeld(await marksNow(page, "feature-period"), await linesNow(page));
  const lines = await linesNow(page);
  const out = lines.filter((line) => line.under || line.to.x < 0 || line.to.y < 0 || line.to.x > DESK.width || line.to.y > DESK.height).map((line) => line.key);
  return { where, ...held, linesPastTheWindow: out, ok: held.ok && out.length === 0 };
}

async function transitioning(page, where) {
  await nearby(page, "/places/feature-board", boardDrawn);
  await record(page, "feature-board");
  // The pointer over the cards: the second slides away under its transition, its line with it.
  const box = await page.locator('[data-worker-view="feature-board"]').locator("#card-f3").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.waitForTimeout(1_200);
  const frames = await stopRecording(page);
  const measured = everyFrameOnMarks(frames);
  const moved = frames.map((frame) => frame.marks.f2?.left).filter((x) => x !== undefined);
  const traveled = moved.length > 1 ? Math.abs(moved.at(-1) - moved[0]) : 0;
  const between = new Set(moved.map((x) => Math.round(x))).size;
  return { where, ...measured, traveled: Number(traveled.toFixed(1)), positionsSeen: between, ok: measured.counted > 0 && measured.worst <= NEAR && traveled > 40 && between > 5 };
}

async function animating(page, where) {
  await nearby(page, "/places/request-motion", () => (document.querySelector('[data-worker-view="request-motion"]')?.shadowRoot?.querySelectorAll("[data-record]").length ?? 0) >= 2);
  await record(page, "request-motion");
  await page.waitForTimeout(1_500);
  const frames = await stopRecording(page);
  const measured = everyFrameOnMarks(frames);
  const tops = frames.map((frame) => frame.marks.r1?.top).filter((y) => y !== undefined);
  const traveled = tops.length > 1 ? Math.max(...tops) - Math.min(...tops) : 0;
  const onIt = frames.filter((frame) => frame.lines.some((line) => line.key === "r1")).length;
  return { where, ...measured, traveled: Number(traveled.toFixed(1)), framesWithItsLine: onIt, ok: measured.counted > 0 && measured.worst <= NEAR && traveled > 40 && onIt > frames.length / 2 };
}

/* A little zoom out with the hand over the city, at a Nearby that stands back: it settles at Nearby, not the City. */
async function smallZoomOut(page, where) {
  await nearby(page, "/features/f3", periodDrawn);
  await page.mouse.move(200, 400);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 30);
  await page.keyboard.up("Control");
  await page.waitForTimeout(1_500);
  const level = await page.evaluate(() => ({ sheet: Number(document.querySelector("[data-graview-one-place]")?.getAttribute("data-graview-one-place")), altitude: Number(document.querySelector('[data-testid="one-place-city"]')?.getAttribute("data-graview-altitude-now")) }));
  return { where, ...level, ok: level.sheet === 1 && Math.abs(level.altitude - 1) < 0.01 };
}

/* Where the city's side cannot hold what a page is connected to (a phone), the record's own building is in it, and every line ends in that side or, its end under the page, points toward it from the page's edge. */
async function outOfSight(page, where) {
  await nearby(page, "/features/f3", periodDrawn);
  const lines = await linesNow(page);
  const size = page.viewportSize();
  const own = await page.evaluate(() => {
    const r = document.querySelector('[data-graview-building="f3"]')?.getBoundingClientRect();
    const panel = document.querySelector("[data-graview-one-place]")?.getBoundingClientRect();
    return r && panel ? { building: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, panel: { left: panel.left, top: panel.top, right: panel.right, bottom: panel.bottom } } : null;
  });
  const pointed = lines.filter((line) => line.under).length;
  const b = own?.building;
  const p = own?.panel;
  const clear = b && p && (b.right <= p.left + 2 || b.left >= p.right - 2 || b.bottom <= p.top + 2 || b.top >= p.bottom - 2);
  const ownInSight = Boolean(b && clear && b.top >= 0 && b.left >= 0 && b.right <= size.width && b.bottom <= size.height);
  const side = own?.panel ? { left: 0, top: 0, right: own.panel.left, bottom: size.height } : { left: 0, top: 0, right: size.width, bottom: size.height };
  const astray = lines.filter((line) => !line.under && !within(line.to, side, 0)).map((line) => line.key);
  return { where, lines: lines.length, pointed, own, ownInSight, astray, ends: lines.map((line) => ({ key: line.key, on: line.on, to: round(line.to), under: line.under })), ok: lines.length > 0 && astray.length === 0 && ownInSight };
}

/* At Nearby each line starts on its own card, on the card's edge facing the city: never on the page's edge, away from what it is for. */
async function leavesFromItsCard(page, where) {
  await nearby(page, "/places/feature-board", boardDrawn);
  const marks = (await marksNow(page, "feature-board")).filter((mark) => mark.inSight && mark.id !== "nobody-here");
  const lines = await linesNow(page);
  const panel = await page.evaluate(() => {
    const r = document.querySelector("[data-graview-one-place]")?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  });
  const astray = marks
    .map((mark) => ({ mark, line: lines.find((one) => one.key === mark.id) }))
    .filter(({ mark, line }) => !line || !within(line.start, mark.box) || !panel || Math.abs(line.start.x - panel.left) < 4)
    .map(({ mark, line }) => ({ id: mark.id, box: round(mark.box), start: line ? round(line.start) : null }));
  return { where, cards: marks.length, panelLeft: panel?.left ?? null, astray, ok: marks.length >= 2 && astray.length === 0 };
}

/* Many lines into one district gather: a feature's page shows eight requests, and their lines come to one line into the requests' district with the count on it, each pill's own short line meeting it at the page's edge. */
async function gatheredIntoOne(page, where) {
  await nearby(page, "/features/f3", periodDrawn);
  await wheelOver(page, '[data-worker-view="feature-period"]', 20, 200);
  await page.waitForTimeout(300);
  const lines = await linesNow(page);
  const into = lines.filter((line) => line.gathered === "kind:request");
  const leads = into.filter((line) => line.count !== null);
  const meet = new Set(into.map((line) => `${Math.round(line.from.x)},${Math.round(line.from.y)}`));
  const ends = new Set(into.map((line) => `${Math.round(line.to.x)},${Math.round(line.to.y)}`));
  const ring = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="one-place-ring"][data-graview-to="kind:request"]');
    return el ? { says: el.textContent.trim(), label: el.getAttribute("aria-label"), shown: el.style.display !== "none" && el.getBoundingClientRect().width > 0 } : null;
  });
  const own = lines.filter((line) => line.key.startsWith("r") && !line.gathered).map((line) => line.key);
  return { where, gathered: into.length, counts: leads.map((line) => line.count), meetAt: meet.size, endAt: ends.size, ring, alone: own, ok: into.length >= 4 && leads.length === 1 && leads[0].count === into.length && meet.size === 1 && ends.size === 1 && own.length === 0 && Boolean(ring && ring.shown && ring.says === String(into.length)) };
}

/*
 * INSIDE THE PANEL A LINE CROSSES NO ONE ELSE'S WORDS: a feature's page
 * shows eight requests as pills that wrap into rows, and each pill's line
 * runs from it to the panel's edge through the gaps between the rows,
 * never across another pill (Graview Cloud's Deep Time, where a row's later
 * pills struck through the earlier ones).
 */
async function crossesNoOtherPill(page, where) {
  await nearby(page, "/features/f3", periodDrawn);
  await wheelOver(page, '[data-worker-view="feature-period"]', 20, 200);
  await page.waitForTimeout(300);
  const drawn = await page.evaluate(() => {
    const region = document.querySelector('[data-worker-view="feature-period"]');
    const panel = document.querySelector("[data-graview-one-place]")?.getBoundingClientRect();
    const pills = [...(region?.shadowRoot?.querySelectorAll("[data-record]") ?? [])].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute("data-record"), x: r.left, y: r.top, width: r.width, height: r.height };
    }).filter((one) => panel && one.y + one.height > panel.top && one.y < panel.bottom);
    // Each straight piece of each line's path, as drawn: M and L points (the curve beyond the panel's edge is the city's).
    const crossings = [];
    let pieces = 0;
    for (const g of document.querySelectorAll("[data-graview-line]")) {
      const key = g.getAttribute("data-graview-line");
      const d = g.querySelector("path")?.getAttribute("d") ?? "";
      const points = [];
      for (const [, cmd, rest] of d.matchAll(/([MLQ])([^MLQ]*)/g)) {
        const nums = rest.trim().split(/[ ,]+/).map(Number);
        if (cmd === "Q") break;
        points.push({ cmd, x: nums[0], y: nums[1] });
      }
      for (let i = 1; i < points.length; i++) {
        if (points[i].cmd !== "L") continue;
        const a = points[i - 1];
        const b = points[i];
        pieces++;
        for (const pill of pills) {
          if (pill.id === key) continue;
          // Sampled along the piece: any point well inside another pill's box is a crossing.
          for (let t = 0; t <= 1; t += 0.02) {
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            if (x > pill.x + 1 && x < pill.x + pill.width - 1 && y > pill.y + 1 && y < pill.y + pill.height - 1) {
              crossings.push(`${key} across ${pill.id}`);
              break;
            }
          }
        }
      }
    }
    const rows = new Set(pills.map((one) => Math.round(one.y))).size;
    return { pills: pills.length, rows, pieces, crossings: [...new Set(crossings)] };
  });
  return { where, ...drawn, ok: drawn.pills >= 4 && drawn.rows >= 2 && drawn.pieces > 0 && drawn.crossings.length === 0 };
}

/* At Nearby the person moves the camera by hand; then the frame shows one more record: the camera stays where they left it. */
async function panKept(page, where) {
  await nearby(page, "/requests/r1", frameDrawn);
  await page.waitForTimeout(400);
  const camera = () =>
    page.evaluate(() => {
      const city = document.querySelector('[data-testid="one-place-city"]');
      const plots = city?.querySelector(".graview-plots > g, .graview-plots");
      const building = city?.querySelector('[data-graview-building="r1"]')?.getBoundingClientRect();
      return { zoom: city?.getAttribute("data-graview-camera-zoom") ?? null, transform: plots?.getAttribute("transform") ?? null, r1: building ? { x: Math.round(building.left), y: Math.round(building.top) } : null };
    });
  const before = await camera();
  await page.mouse.move(260, 520);
  await page.mouse.down();
  await page.mouse.move(320, 560, { steps: 8 });
  await page.mouse.move(380, 600, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  const panned = await camera();
  const guest = page.frames().find((one) => one.url().endsWith("/frame.html"));
  await guest.evaluate(() => {
    const row = document.createElement("div");
    row.className = "row";
    row.setAttribute("data-record", "f7");
    row.textContent = "Row f7";
    document.getElementById("list").prepend(row);
  });
  await page.waitForTimeout(1_800);
  const after = await camera();
  const lines = await linesNow(page);
  const moved = JSON.stringify(panned) !== JSON.stringify(before);
  return { where, before, panned, after, f7: lines.some((line) => line.key === "f7"), ok: moved && JSON.stringify(after) === JSON.stringify(panned) };
}

async function deepView(page, where) {
  await page.goto(`${at("frame-lines-host")}/places/deep-view`, { waitUntil: "load" });
  await page.waitForFunction(() => (document.querySelector('[data-worker-view="deep-view"]')?.shadowRoot?.querySelectorAll("[data-record]").length ?? 0) >= 400, null, { timeout: 30_000 });
  return {
    where,
    ...(await page.evaluate(async () => {
      const region = document.querySelector('[data-worker-view="deep-view"]');
      const held = region[Symbol.for("graview.record-boxes")];
      const first = held.boxes().length;
      const cold = [];
      for (let at = 0; at < 7; at++) {
        // Something in the view moved: the next read measures it again.
        region.shadowRoot.querySelector("#marks").setAttribute("data-moved", String(at));
        await new Promise((done) => setTimeout(done, 0));
        const start = performance.now();
        held.boxes();
        cold.push(performance.now() - start);
      }
      const start = performance.now();
      for (let at = 0; at < 60; at++) held.boxes();
      const warm = (performance.now() - start) / 60;
      cold.sort((a, b) => a - b);
      return { boxes: first, coldMedianMs: Number(cold[3].toFixed(3)), coldWorstMs: Number(cold[6].toFixed(3)), warmMs: Number(warm.toFixed(3)) };
    })),
  };
}

/* ── the run ─────────────────────────────────────────────────────────── */

const report = { at: new Date().toISOString(), engines, checks: {} };
const errors = [];
const seen = { cards: [], cardsScroll: [], levelMove: [], awayAndBack: [], rows: [], rowsScroll: [], unseen: [], quiet: [], tall: [], pills: [], deep: [], transition: [], animation: [], zoomOut: [], outOfSight: [], panKept: [], startsOnCard: [], gathered: [], noOtherPill: [] };
let host;
let browser;
try {
  host = await buildHost();
  for (const engine of engines) {
    browser = await launchEngine(engine);
    for (const [list, drive, options] of [
      [seen.cards, workerCards],
      [seen.cardsScroll, workerScroll],
      [seen.levelMove, levelMove],
      [seen.awayAndBack, awayAndBack],
      [seen.rows, frameRows],
      [seen.rowsScroll, frameScroll],
      [seen.unseen, unseenRow],
      [seen.quiet, quietRecordPage],
      [seen.tall, tallPage],
      [seen.pills, tallPills],
      [seen.deep, deepView],
      [seen.transition, transitioning],
      [seen.animation, animating],
      [seen.zoomOut, smallZoomOut],
      [seen.panKept, panKept],
      [seen.startsOnCard, leavesFromItsCard],
      [seen.gathered, gatheredIntoOne],
      [seen.noOtherPill, crossesNoOtherPill],
      [seen.outOfSight, outOfSight, { viewport: { width: 610, height: 360 } }],
    ]) {
      const context = await browser.newContext(options ?? { viewport: DESK });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${engine}: ${error.message}`));
      const where = { engine, device: options ? `${options.viewport.width}×${options.viewport.height}` : "desk 1440×900" };
      try {
        list.push(await drive(page, where));
      } catch (error) {
        list.push({ where, ok: false, error: String(error?.message ?? error) });
      }
      await context.close().catch(() => {});
    }
    await browser.close();
    browser = undefined;
  }
  for (const run of seen.deep) run.ok = run.boxes > 0 && run.coldMedianMs <= DEEP_MS && run.warmMs <= 0.5;
  const every = (list) => list.length > 0 && list.every((one) => one.ok);
  report.checks.aWorkerViewsRecordsHaveLinesWithinTwoPixelsOfTheirBoxes = { held: seen.cards, ok: every(seen.cards) };
  report.checks.scrollingThePageKeepsAWorkerViewsLinesOnItsRecordsEveryFrame = { held: seen.cardsScroll, ok: every(seen.cardsScroll) };
  report.checks.aMoveToTheCityAndBackKeepsAWorkerViewsLinesOnItsRecordsEveryFrame = { held: seen.levelMove, ok: every(seen.levelMove) };
  report.checks.goingToARecordAndBackAtNearbyBringsTheLinesBack = { held: seen.awayAndBack, ok: every(seen.awayAndBack) };
  report.checks.aFrameGuestsRecordsHaveLinesWithinTwoPixelsOfTheirBoxes = { held: seen.rows, ok: every(seen.rows) };
  report.checks.scrollingTheFrameKeepsItsLinesOnItsRowsAndScrollingThePageEveryFrame = { held: seen.rowsScroll, ok: every(seen.rowsScroll) };
  report.checks.aSeatThatCannotSeeAMarkedRecordGetsNoLineToIt = { held: seen.unseen, ok: every(seen.unseen) };
  report.checks.aRecordPageDrawnByAViewThatNamesNoRecordHasItsOneLine = { held: seen.quiet, ok: every(seen.quiet) };
  report.checks.onATallViewThatIsTheWholePageItsConnectedRecordsAreInTheFirstWindowAndEveryLineEndsInIt = { held: seen.tall, ok: every(seen.tall) };
  report.checks.aTallViewsOwnPillsHaveTheirLinesWhenScrolledTo = { held: seen.pills, ok: every(seen.pills) };
  report.checks.aDeepWideViewIsMeasuredWithinItsBudget = { budgetMs: DEEP_MS, held: seen.deep, ok: every(seen.deep) };
  report.checks.aWorkerViewsRecordMovingUnderATransitionKeepsItsLineOnItEveryFrame = { held: seen.transition, ok: every(seen.transition) };
  report.checks.aWorkerViewsRecordUnderAnEndlessAnimationKeepsItsLineOnItEveryFrame = { held: seen.animation, ok: every(seen.animation) };
  report.checks.aLittleZoomOutAtANearbyThatStandsBackSettlesAtNearby = { held: seen.zoomOut, ok: every(seen.zoomOut) };
  report.checks.whereTheCitysSideCannotHoldItAllTheRecordsBuildingIsInSightAndEveryLineEndsThereOrPointsTowardIt = { held: seen.outOfSight, ok: every(seen.outOfSight) };
  report.checks.aCameraMovedByHandAtNearbyStaysWhereItWasLeftWhenAViewShowsMore = { held: seen.panKept, ok: every(seen.panKept) };
  report.checks.atNearbyEachLineStartsOnItsOwnCardNotOnThePagesEdge = { held: seen.startsOnCard, ok: every(seen.startsOnCard) };
  report.checks.manyLinesIntoOneDistrictGatherIntoOneLineWithItsCount = { held: seen.gathered, ok: every(seen.gathered) };
  report.checks.insideThePanelNoLineCrossesAnotherPillOrRow = { held: seen.noOtherPill, ok: every(seen.noOtherPill) };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  host?.stop();
}

writeFileSync(resolve(repoRoot, "docs/frame-lines.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/frame-lines.json\n");
process.exit(report.passed ? 0 : 1);
