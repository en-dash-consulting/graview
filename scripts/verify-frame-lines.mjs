#!/usr/bin/env node
/**
 * A VIEW DRAWN WHERE THE PAGE CANNOT READ HAS ITS LINES TO THE CITY
 * (Graview HQ feature:f-one-face-lines-from-frame-views).
 *
 * At Nearby the one face draws a line from each record a page shows to
 * that record's building. A built-in page's records are read off its own
 * marks; a worker view draws in a shadow root and a frame guest in a
 * document of another origin, so the page floated beside the city tied to
 * nothing. Now the element each is drawn in holds its records' boxes,
 * judged by its host, and the face carries them through that element's
 * box every frame. Held here, on a roadmap's pages over its city:
 *
 *   · a worker view's `data-record` cards each have their line, its end
 *     within 2 px of the card's box, and a card naming no record has none;
 *   · scrolling the page keeps every line on its card, every frame;
 *   · a frame guest's `data-record` rows have their lines, within 2 px of
 *     each row as the frame draws it, and scrolling the frame's own list
 *     keeps them on the rows in sight and drops the rows scrolled away;
 *   · scrolling the page keeps the frame's lines on its rows, every frame;
 *   · a record page drawn by a view that names no record of its own still
 *     has its one line, from the view to the record it is about;
 *   · Connected does not repeat a record a view already shows.
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

/* ── the app ─────────────────────────────────────────────────────────── */

const FEATURES = ["Printable boards", "Shared drafts", "Weekly digest", "Offline pages", "Bulk edit", "Saved filters", "Public forms", "Calendar sync"];
const SEED = {
  nodes: [
    ...FEATURES.map((name, at) => ({ id: `f${at + 1}`, kind: "feature", name, stage: ["idea", "planned", "building", "shipped"][at % 4], area: ["pages", "scene", "core", "cloud"][at % 4], summary: `What ${name.toLowerCase()} would do.` })),
    { id: "r1", kind: "request", name: "Let me print a board", status: "planned", summary: "Asked twice." },
    { id: "r2", kind: "request", name: "Work without a connection", status: "new", summary: "On a train." },
    { id: "p1", kind: "person", name: "Ada Brennan" },
  ],
  edges: [
    { kind: "became", from: "r1", to: "f1" },
    { kind: "votes", from: "p1", to: "r1" },
    { kind: "votes", from: "p1", to: "r2" },
  ],
};

/* A worker view over every feature: tall cards, each marked with its record, and one marked with no record at all. */
const BOARD = {
  manifest: { name: "feature-board", title: "Feature board", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] } },
  source: `graview.style(".card{display:block;box-sizing:border-box;height:132px;margin:0 0 12px;padding:12px;border:1px solid var(--graview-edge);border-radius:8px} h3{margin:0 0 6px;font-size:1rem}");
graview.onProps((props) => graview.render(graview.html\`<div id="cards">\${props.nodes.map((node) => graview.html\`<div class="card" data-record=\${node.id} id=\${"card-" + node.id}><h3>\${node.label}</h3><p>\${node.summary ?? ""}</p></div>\`)}<div class="card" data-record="nobody-here" id="card-nobody"><h3>Not a record</h3></div></div>\`));`,
};
/* A worker view that is a feature's whole page and names no record: the page still has its one line, to the feature. */
const NOTE = {
  manifest: { name: "feature-note", title: "Feature note", attach: "feature", cardinality: "one", replaces: "page", reads: { kinds: ["feature"] } },
  source: `graview.onProps((props) => graview.render(graview.html\`<p id="note" style="margin:0;padding:24px 12px;font-size:1.1rem">A note on \${props.node.label}, drawn by a view.</p>\`));`,
};

/* A worker view that is a person's whole page and shows one of the two requests they voted for: Connected says the other, not that one. */
const VOTER = {
  manifest: { name: "voter", title: "Voter", attach: "person", cardinality: "one", replaces: "page", reads: { kinds: ["person"] } },
  source: `graview.onProps((props) => graview.render(graview.html\`<h2 style="margin:0 0 8px">\${props.node.label}</h2><a id="voted" data-record="r1">The request they voted for first</a>\`));`,
};

/* A frame guest on a request's page: what it became and what it might become, rows marked with their records in a list that scrolls. */
const FRAME_ROWS = ["f1", "f2", "f3", "f4", "f5", "f6", "nobody-here"];
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
    row.textContent = id === "nobody-here" ? "Not a record" : "Feature " + id.slice(1);
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
        const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: ${JSON.stringify(SEED)}, ...(app.policy ? { policy: app.policy } : {}) });
        const board = ${JSON.stringify(BOARD)};
        const note = ${JSON.stringify(NOTE)};
        const voter = ${JSON.stringify(VOTER)};
        let views = registerDefaultViews(app.schema, createViews(app.schema));
        views = registerWorkerView(views, { manifest: board.manifest, worker: { source: board.source } });
        views = registerWorkerView(views, { manifest: note.manifest, worker: { source: note.source } });
        views = registerWorkerView(views, { manifest: voter.manifest, worker: { source: voter.source } });
        views = views.register("request", { cardinality: "one", fidelity: "full" }, guestView({ url: "/frame.html", name: "request-card", title: "What this might become" }));
        createRoot(document.getElementById("app")).render(
          createElement(PagesApp, { context: { store, app, principal: { kind: "human", id: "u:owner", roles: ["owner"] }, views, sceneUnderPages: true } }),
        );`,
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

/** Open a page and go to Nearby, once what is on it has drawn. */
async function nearby(page, path, drawn) {
  await page.goto(`${at("frame-lines-host")}${path}`, { waitUntil: "load" });
  await page.waitForSelector("[data-graview-one-place]", { timeout: 60_000 });
  await page.waitForFunction(drawn, null, { timeout: 30_000 });
  await page.locator('[data-testid="altitude-stop-1"]').first().click();
  await restAt(page, 1);
  await page.waitForTimeout(300);
}

/** The lines drawn now: each one's record and the middle of the part it leaves from. */
const linesNow = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-graview-line]")].map((g) => {
      const [x, y] = (g.getAttribute("data-graview-line-part") ?? "NaN,NaN").split(",").map(Number);
      return { key: g.getAttribute("data-graview-line"), on: g.getAttribute("data-graview-line-on"), part: { x, y } };
    }),
  );

const within = (point, box, near = NEAR) => point.x >= box.left - near && point.x <= box.right + near && point.y >= box.top - near && point.y <= box.bottom + near;
const round = (box) => box && Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Number(Number(value).toFixed(2))]));

/** The board's cards as the page sees them, in the window's pixels, and what of each is in sight on the panel. */
const cardsNow = (page) =>
  page.evaluate(() => {
    const region = document.querySelector('[data-worker-view="feature-board"]');
    const port = region?.closest("[data-graview-one-place]")?.getBoundingClientRect();
    return [...(region?.shadowRoot?.querySelectorAll("[data-record]") ?? [])].map((card) => {
      const r = card.getBoundingClientRect();
      const mid = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      return { id: card.getAttribute("data-record"), box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, inSight: Boolean(port && mid.y >= port.top && mid.y <= port.bottom && mid.x >= port.left && mid.x <= port.right) };
    });
  });

/** Every frame from now: each line's part, and each card's box, read after the face has drawn that frame. */
const record = (page) =>
  page.evaluate(() => {
    window.__frames = [];
    window.__stop = false;
    const tick = () => {
      if (window.__stop) return;
      requestAnimationFrame(tick);
      const region = document.querySelector('[data-worker-view="feature-board"]');
      const frame = document.querySelector('iframe[data-guest-view="request-card"]');
      const cards = Object.fromEntries([...(region?.shadowRoot?.querySelectorAll("[data-record]") ?? [])].map((card) => {
        const r = card.getBoundingClientRect();
        return [card.getAttribute("data-record"), { left: r.left, top: r.top, right: r.right, bottom: r.bottom }];
      }));
      const f = frame?.getBoundingClientRect();
      window.__frames.push({
        lines: [...document.querySelectorAll("[data-graview-line]")].map((g) => {
          const [x, y] = (g.getAttribute("data-graview-line-part") ?? "NaN,NaN").split(",").map(Number);
          return { key: g.getAttribute("data-graview-line"), part: { x, y } };
        }),
        cards,
        frame: f ? { left: f.left, top: f.top } : null,
      });
    };
    requestAnimationFrame(tick);
  });
const stopRecording = (page) => page.evaluate(() => ((window.__stop = true), window.__frames ?? []));

/** Wheel the panel the page is in, over the element named, a few steps. */
async function wheelOver(page, selector, steps, by) {
  const box = await page.locator(selector).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, Math.min(box.y + 40, DESK.height - 60));
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, by);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
}

/** The scroll of the panel the page is in, read off the element that scrolls. */
const pageScroll = (page, selector) =>
  page.evaluate((selector) => {
    for (let at = document.querySelector(selector); at; at = at.parentElement) if (at.scrollTop > 0) return at.scrollTop;
    return document.scrollingElement?.scrollTop ?? 0;
  }, selector);

/* ── the claims' drives ──────────────────────────────────────────────── */

async function workerCards(page, where) {
  await nearby(page, "/places/feature-board", () => (document.querySelector('[data-worker-view="feature-board"]')?.shadowRoot?.querySelectorAll("[data-record]").length ?? 0) > 3);
  const cards = await cardsNow(page);
  const lines = await linesNow(page);
  const inSight = cards.filter((card) => card.inSight && card.id !== "nobody-here");
  const misses = inSight.map((card) => {
    const line = lines.find((one) => one.key === card.id);
    return { id: card.id, line: Boolean(line), on: line?.on ?? null, near: line ? within(line.part, card.box) : false, part: line ? round(line.part) : null, box: round(card.box) };
  });
  const stray = lines.filter((line) => line.key === "nobody-here");
  return { where, cards: cards.length, inSight: inSight.length, misses: misses.filter((one) => !one.line || !one.near), noLineForWhatIsNoRecord: stray.length === 0, ok: inSight.length >= 2 && misses.every((one) => one.line && one.near) && stray.length === 0 };
}

async function workerScroll(page, where) {
  await nearby(page, "/places/feature-board", () => (document.querySelector('[data-worker-view="feature-board"]')?.shadowRoot?.querySelectorAll("[data-record]").length ?? 0) > 3);
  const before = new Set((await linesNow(page)).map((line) => line.key));
  await record(page);
  await wheelOver(page, '[data-worker-view="feature-board"]', 6, 120);
  const frames = await stopRecording(page);
  const scrolled = await pageScroll(page, '[data-worker-view="feature-board"]');
  let worst = 0;
  let counted = 0;
  const examples = [];
  for (const frame of frames) {
    for (const line of frame.lines) {
      const card = frame.cards[line.key];
      if (!card) continue;
      counted++;
      const dx = Math.max(card.left - line.part.x, 0, line.part.x - card.right);
      const dy = Math.max(card.top - line.part.y, 0, line.part.y - card.bottom);
      const miss = Math.hypot(dx, dy);
      if (miss > worst) worst = miss;
      if (miss > NEAR && examples.length < 4) examples.push({ key: line.key, miss: Number(miss.toFixed(2)), part: round(line.part), card: round(card) });
    }
  }
  const after = new Set((await linesNow(page)).map((line) => line.key));
  const cards = await cardsNow(page);
  const lines = await linesNow(page);
  const settled = cards.filter((card) => card.inSight && card.id !== "nobody-here").every((card) => lines.some((line) => line.key === card.id && within(line.part, card.box)));
  return { where, frames: frames.length, counted, worst: Number(worst.toFixed(2)), examples, scrolled, before: [...before], after: [...after], settled, ok: frames.length > 10 && counted > 0 && worst <= NEAR && scrolled > 0 && settled };
}

/** The frame's rows as its own document draws them, in the window's pixels: the frame's box, and what of each row is in sight in its list. */
async function rowsNow(page) {
  const frameBox = await page.evaluate(() => {
    const r = document.querySelector('iframe[data-guest-view="request-card"]')?.getBoundingClientRect();
    const port = document.querySelector('iframe[data-guest-view="request-card"]')?.closest("[data-graview-one-place]")?.getBoundingClientRect();
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

const frameDrawn = () => document.querySelector('iframe[data-guest-view="request-card"]')?.hasAttribute("data-guest-view-drawn") ?? false;

/** Every row of the frame in sight has its line on it; no line leaves the frame for a row scrolled out of its list, nor for a row naming no record. */
function rowsHeld({ frameBox, rows }, lines) {
  const shown = rows.filter((row) => row.inSight && row.id !== "nobody-here");
  const missing = shown.filter((row) => !lines.some((line) => line.key === row.id && within(line.part, row.box))).map((row) => ({ id: row.id, box: round(row.box), line: lines.find((line) => line.key === row.id)?.part ?? null }));
  const hiddenIds = new Set(rows.filter((row) => !row.shown).map((row) => row.id));
  // The page's own parts may name the same record (r1 became f1): only a line leaving from inside the frame is the frame's.
  const fromFrame = (line) => frameBox && within(line.part, frameBox, 0);
  const strays = lines.filter((line) => fromFrame(line) && (line.key === "nobody-here" || (hiddenIds.has(line.key) && !shown.some((row) => row.id === line.key)))).map((line) => line.key);
  return { shown: shown.map((row) => row.id), missing, strays, ok: shown.length >= 2 && missing.length === 0 && strays.length === 0 };
}

async function frameRows(page, where) {
  await nearby(page, "/requests/r1", frameDrawn);
  await page.waitForTimeout(300);
  const now = await rowsNow(page);
  const held = rowsHeld(now, await linesNow(page));
  return { where, rows: now.rows.length, ...held };
}

async function frameScroll(page, where) {
  await nearby(page, "/requests/r1", frameDrawn);
  await page.waitForTimeout(300);
  const guest = page.frames().find((one) => one.url().endsWith("/frame.html"));
  const before = rowsHeld(await rowsNow(page), await linesNow(page));
  // Its own list scrolled, as a person would with a wheel over it: the rows in sight now have the lines.
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
  const local = (await rowsNow(page)).rows.map((row) => ({ ...row }));
  const frameAt = await page.evaluate(() => {
    const r = document.querySelector('iframe[data-guest-view="request-card"]').getBoundingClientRect();
    return { left: r.left, top: r.top };
  });
  await record(page);
  await wheelOver(page, '[data-testid="one-place-bar"] ~ * [data-graview-one-place], [data-graview-one-place]', 4, 80);
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
  return { where, before, inFrame, toItsEnd, pageScrolled: { frames: frames.length, moved, counted, worst: Number(worst.toFixed(2)), examples }, ok: before.ok && inFrame.ok && toItsEnd.ok && counted > 0 && worst <= NEAR && JSON.stringify(inFrame.shown) !== JSON.stringify(before.shown) };
}

async function quietRecordPage(page, where) {
  await nearby(page, "/features/f2", () => document.querySelector('[data-worker-view="feature-note"]')?.hasAttribute("data-worker-view-drawn") ?? false);
  const view = await page.evaluate(() => {
    const region = document.querySelector('[data-worker-view="feature-note"]');
    const r = region?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  });
  const lines = await linesNow(page);
  const line = lines.find((one) => one.key === "f2");
  return { where, view: round(view), line: line ? { on: line.on, part: round(line.part) } : null, ok: Boolean(view && line && line.on === "building" && within(line.part, view)) };
}

async function connected(page, where) {
  await nearby(page, "/people/p1", () => document.querySelector('[data-worker-view="voter"]')?.hasAttribute("data-worker-view-drawn") ?? false);
  await page.waitForTimeout(500);
  const said = await page.evaluate(() => [...document.querySelectorAll("[data-graview-connected] [data-graview-record]")].map((row) => row.getAttribute("data-graview-record")));
  const view = await page.evaluate(() => {
    const r = document.querySelector('[data-worker-view="voter"]')?.shadowRoot?.getElementById("voted")?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  });
  const lines = await linesNow(page);
  const fromView = lines.find((line) => line.key === "r1");
  // The view shows r1: Connected says r2 alone, and r1's line leaves from the view's link to it.
  return { where, connected: said, r1: fromView ? round(fromView.part) : null, r2: lines.some((line) => line.key === "r2"), ok: said.includes("r2") && !said.includes("r1") && Boolean(view && fromView && within(fromView.part, view)) };
}

/* ── the run ─────────────────────────────────────────────────────────── */

const report = { at: new Date().toISOString(), engines, checks: {} };
const errors = [];
const seen = { cards: [], cardsScroll: [], rows: [], rowsScroll: [], quiet: [], connected: [] };
let host;
let browser;
try {
  host = await buildHost();
  for (const engine of engines) {
    browser = await launchEngine(engine);
    for (const [list, drive] of [
      [seen.cards, workerCards],
      [seen.cardsScroll, workerScroll],
      [seen.rows, frameRows],
      [seen.rowsScroll, frameScroll],
      [seen.quiet, quietRecordPage],
      [seen.connected, connected],
    ]) {
      const context = await browser.newContext({ viewport: DESK });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${engine}: ${error.message}`));
      const where = { engine, device: "desk 1440×900" };
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
  const every = (list) => list.length > 0 && list.every((one) => one.ok);
  report.checks.aWorkerViewsRecordsHaveLinesWithinTwoPixelsOfTheirBoxes = { held: seen.cards, ok: every(seen.cards) };
  report.checks.scrollingThePageKeepsAWorkerViewsLinesOnItsRecordsEveryFrame = { held: seen.cardsScroll, ok: every(seen.cardsScroll) };
  report.checks.aFrameGuestsRecordsHaveLinesWithinTwoPixelsOfTheirBoxes = { held: seen.rows, ok: every(seen.rows) };
  report.checks.scrollingTheFrameOrThePageKeepsItsLinesOnItsRecords = { held: seen.rowsScroll, ok: every(seen.rowsScroll) };
  report.checks.aRecordPageDrawnByAViewThatNamesNoRecordHasItsOneLine = { held: seen.quiet, ok: every(seen.quiet) };
  report.checks.connectedDoesNotRepeatWhatAFrameShows = { held: seen.connected, ok: every(seen.connected) };
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
