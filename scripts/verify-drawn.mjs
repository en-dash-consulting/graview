#!/usr/bin/env node
/**
 * THE PAGE SAYS WHEN A PLACE HAS DRAWN AND SETTLED (FR-188), held to what
 * a person sees.
 *
 * Graview Cloud pictures a place headless (describe_place's picture) and
 * waited on a guess: its opening frame gone, the network quiet, then 600
 * ms. The embed's root now wears `data-graview-drawn` once the place has
 * drawn and settled, and `onDrawn(place)` is told. Here the app is mounted
 * as Cloud mounts one (the page IS the app, address routing, a compiled
 * document) with what makes a guess wrong: a face its bundle fetches as it
 * is drawn, a font that comes 1.5 s late and changes every line's width, a
 * home drawn by a worker view whose image comes 1.2 s late without a size
 * of its own, and a view of a kind that fails. At a phone in dark and a
 * desk in light it asks:
 *
 *   the root says it once the home has drawn; when it does, the slow font
 *   has loaded, the view has drawn its words and its image has come; and
 *   nothing on the page moves after it, for a second and a half;
 *
 *   a move to another place takes it off before that place has drawn, and
 *   the place puts it back, its path the value, once it settles;
 *
 *   a view that fails counts as settled, with what is drawn in its place
 *   (the kind's own face, as Cloud registers a view);
 *
 *   `onDrawn` is told each place as `where()` says it; and the scene says
 *   it too, once, as its camera settles.
 *
 * And a page opened on a view proposed and not kept (FR-187, `draftView`,
 * `?draft=<name>`): a home that revises the kept one, a board of the
 * features, a card on a feature's page, each pictured where it attaches
 * once the page says it has drawn, marked "Draft — <title> · Not kept"
 * where a person sees it, the kept home drawn nowhere beside its draft, a
 * draft that is stopped saying why in its place, and nothing of any of
 * them kept: the store unwritten, the host's keeper asked nothing, and the
 * same address opened again without it drawing none.
 *
 * And what the build left out at first, each held the same way:
 *
 *   a frame guest (`guestView`, a sandboxed iframe) that draws a second
 *   after it is handed its props holds the signal back until it has drawn
 *   and asked for its height, and one that never says it is ready counts
 *   as settled once its time is up (`data-guest-view-failed="silent"`);
 *
 *   the pages alone (`@graview/embed/pages`, `?alone=1`) say it, after the
 *   same late font and image, and draw a draft where it attaches;
 *
 *   `handle.setDraftView` swaps one draft for another in place, on both
 *   mounts: the attribute off in the call, back once the new draft has
 *   drawn its words, the root and the store the same;
 *
 *   under a base path, as Cloud serves an app (`/a/<app>`), a draft is
 *   drawn at its place and the root says the place's path within the app.
 *
 * And the place menu as Cloud keeps it (`?tidy=1`: a keeper that holds
 * what is hidden, and hands each change to a declared lens or a kind's list
 * back as a new app, as Cloud does): a kind's list, a declared lens and a
 * view the host keeps, each hidden from the place menu while it is the
 * place open, leave the bar's row and drop-down at once, the page staying
 * where it is; the drop-down's Hidden lists them, and Show puts them back
 * (Roadmap f-hidden-view-leaves-the-bar).
 *
 *   node scripts/verify-drawn.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>] [--probe]
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
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
const FONT = resolve(repoRoot, "packages/primitives/fonts/montserrat-latin.woff2");
const SCREENS = [
  { name: "phone", width: 390, height: 844, scheme: "dark" },
  ...(QUICK ? [] : [{ name: "desk", width: 1280, height: 800, scheme: "light" }]),
];
/* How late the font and the image come: long past Cloud's guess, which is network idle and 600 ms. */
const FONT_LATE_MS = 1_500;
const IMAGE_LATE_MS = 1_200;
/* How long the page is watched after it says it has drawn. */
const STILL_MS = 1_500;

/* ── the app ─────────────────────────────────────────────────────────── */

const SEED = {
  nodes: [
    { id: "f1", kind: "feature", name: "Printable boards", stage: "building", area: "pages", summary: "A board printed as it is drawn." },
    { id: "f2", kind: "feature", name: "Shared drafts", stage: "planned", area: "core", summary: "Two people on one draft." },
    { id: "f3", kind: "feature", name: "Weekly digest", stage: "idea", area: "cloud", summary: "What changed, once a week." },
    { id: "r1", kind: "request", name: "Let me print a board", status: "planned", summary: "Asked twice." },
  ],
  edges: [{ kind: "became", from: "r1", to: "f1" }],
};

/* An image the app holds, by the path add_image answers: 360 × 240, with no size said, so its arrival moves what is under it. */
const IMAGE_PATH = `/graview/assets/${"a".repeat(64)}.png`;
const HOME_MANIFEST = { name: "front", title: "The front", attach: "home", cardinality: "many", reads: { kinds: ["feature"] } };
const HOME_SOURCE = `graview.style(".lead{font-size:1.5rem;margin:0 0 8px} img{display:block;max-width:100%} li{padding:4px 0}");
graview.onProps((props) => graview.render(graview.html\`<h2 class="lead">What we are making</h2>
<img id="picture" src="${IMAGE_PATH}" alt="The roadmap, drawn">
<ul id="features">\${props.nodes.map((node) => graview.html\`<li>\${node.label}</li>\`)}</ul>
<p><a id="to-features" data-place="features">Every feature</a></p>\`));`;
/* A view of the features that draws past what it may (here, ten things) and is stopped: counted as settled, with what is drawn in its place. */
const BROKEN_MANIFEST = { name: "broken-board", title: "Broken board", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] } };
const BROKEN_SOURCE = `graview.onProps((props) => graview.render(graview.html\`<ul>\${Array.from({ length: 40 }, (_, at) => graview.html\`<li>\${at}</li>\`)}</ul>\`));`;

/*
 * VIEWS PROPOSED AND NOT KEPT (FR-187), handed as `mount`'s `draftView` by `?draft=<name>`: the home a
 * chat proposes in place of the kept one of its name, a board of the features at its place, a card on
 * a feature's page, and a board that draws past what it may and is stopped.
 */
const STAGE_SOURCE = `graview.style(".stages{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} .stage{border:1px solid var(--graview-edge);border-radius:8px;padding:8px} h3{margin:0 0 4px;font-size:.875rem}");
graview.onProps((props) => graview.render(graview.html\`<div class="stages" id="stages">\${["idea", "planned", "building"].map((stage) => graview.html\`<section class="stage"><h3>\${stage}</h3>\${props.nodes.filter((node) => node.stage === stage).map((node) => graview.html\`<p>\${node.label}</p>\`)}</section>\`)}</div>\`));`;
const DRAFTS = {
  home: { manifest: HOME_MANIFEST, source: `graview.onProps((props) => graview.render(graview.html\`<h2 id="proposed">The front, proposed</h2><ul>\${props.nodes.map((node) => graview.html\`<li>\${node.label}</li>\`)}</ul>\`));`, words: "The front, proposed", address: "/" },
  board: { manifest: { name: "stage-board", title: "Stage board", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] } }, source: STAGE_SOURCE, words: "Printable boards", address: "/places/stage-board" },
  record: { manifest: { name: "feature-card", title: "Feature card", attach: "feature", cardinality: "one", reads: { kinds: ["feature"] } }, source: `graview.onProps((props) => graview.render(graview.html\`<p id="card">\${props.node.label}: \${props.node.stage}</p>\`));`, words: "Printable boards: building", address: "/features/f1" },
  stopped: { manifest: { name: "stage-board", title: "Stage board", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] } }, source: STAGE_SOURCE, limits: { maxNodes: 4 }, words: null, address: "/places/stage-board" },
};

/* A draft that revises the stage board, handed in place of it with `setDraftView`: the same place, other words. */
const REVISED = { manifest: { name: "stage-board", title: "Stage board", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] } }, source: `graview.onProps((props) => graview.render(graview.html\`<ol id="revised">\${props.nodes.map((node) => graview.html\`<li>Revised: \${node.label}</li>\`)}</ol>\`));`, words: "Revised: Printable boards" };
/* Where Cloud serves an app: the page is the app, under a base. */
const BASE = "/a/roadmap";

/*
 * FRAME GUESTS (FR-188): a guest that draws a second after it is handed its props, then asks for its height,
 * and one that never says it is ready. Each is plain HTML speaking the frame protocol by hand.
 */
const GUEST_LATE_MS = 1_000;
const GUEST_LATE = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font:16px system-ui"><p>Waiting…</p><script>
addEventListener("message", (event) => {
  const hello = event.data;
  if (!hello || hello.graview !== "host-hello" || !event.ports[0]) return;
  const port = event.ports[0];
  let drawn = false;
  port.onmessage = (message) => {
    if (!message.data || message.data.type !== "props" || drawn) return;
    drawn = true;
    setTimeout(() => {
      document.body.innerHTML = '<h3 id="drawn" style="margin:0 0 8px">A card drawn late</h3><div style="height:180px;background:#5a5a5a"></div>';
      window.__drewAt = performance.timeOrigin + performance.now();
      port.postMessage({ type: "size", nonce: hello.nonce, height: document.documentElement.scrollHeight });
    }, ${GUEST_LATE_MS});
  };
});
parent.postMessage({ graview: "guest-ready", protocol: 1 }, "*");
</script></body></html>`;
const GUEST_SILENT = `<!doctype html><html><head><meta charset="utf-8"></head><body><p>Never ready.</p></body></html>`;
const GUEST_READY_MS = 1_500;

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The roadmap</title>
<style>
@font-face{font-family:"Late Face";src:url(/late-face.woff2) format("woff2");font-display:swap}
body{margin:0;background:#f6f6f2;color:#222}
[data-graview-embed],[data-graview-embed] *{font-family:"Late Face",system-ui,sans-serif!important}
</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** A PNG of one color, as small as a PNG of that size can be. */
function png(width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x5a)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** The host's page, mounting the roadmap as Cloud's shell mounts an app, with the two views. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-drawn-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { mount as mountPages } from "@graview/embed/pages";
        import { guestView } from "@graview/guest/host";
        import { registerWorkerView } from "@graview/guest/host/views";
        import { compileDocumentWithoutCheck, editDocument } from "@graview/core/document";
        import { memoryViews } from "@graview/core";
        import roadmap from ${JSON.stringify(ROADMAP)};
        const seed = ${JSON.stringify(SEED)};
        window.__drawn = [];
        const drafts = ${JSON.stringify(DRAFTS)};
        const params = new URLSearchParams(location.search);
        const asked = drafts[params.get("draft") ?? ""];
        // The pages alone (?alone=1), under Cloud's base (?base=1), with a frame guest on a feature's page (?guest=late|silent).
        const alone = params.has("alone");
        const based = params.has("base") ? { basePath: ${JSON.stringify(BASE)} } : {};
        const guest = params.get("guest");
        const revised = ${JSON.stringify(REVISED)};
        window.__revise = () => window.__handle.setDraftView({ manifest: revised.manifest, source: revised.source, author: "Proposed by Claude" });
        const framed = (registry) =>
          guest === "late" ? registry.register("feature", { cardinality: "one", fidelity: "full" }, guestView({ url: "/guest-late.html", name: "late-card", title: "Late card" }))
          : guest === "silent" ? registry.register("feature", { cardinality: "one", fidelity: "full" }, guestView({ url: "/guest-silent.html", name: "silent-card", title: "Silent card", limits: { readyMs: ${GUEST_READY_MS} } }))
          : registry;
        // The host's keeper, writing down every ask: a draft must ask it nothing.
        window.__keptAsked = [];
        const asks = { current: () => ({ hidden: [], removed: [], may: { views: true, lenses: true } }), hide: (name) => void window.__keptAsked.push("hide " + name), show: (name) => void window.__keptAsked.push("show " + name), remove: (name) => void window.__keptAsked.push("remove " + name), restore: (name) => void window.__keptAsked.push("restore " + name) };
        // The place menu as Cloud keeps it (?tidy=1): what is hidden held, and a change to the declaration handed back as a new app.
        const tidy = params.has("tidy");
        let declared = roadmap;
        const keptViews = !tidy ? asks : memoryViews({
          may: { views: true, lenses: true },
          declaration: {
            change: (edit) => {
              const edited = editDocument(declared, [edit]);
              if (!edited.ok) throw new Error(edited.findings.map((finding) => finding.message).join("; "));
              declared = edited.document;
              const next = compileDocumentWithoutCheck(declared, { today: () => "2026-10-19" });
              if (next.ok) window.__handle.setApp(next.app, window.__handle.store);
            },
            restore: () => undefined,
          },
        });
        const stageBoard = { manifest: ${JSON.stringify(DRAFTS.board.manifest)}, worker: { source: ${JSON.stringify(STAGE_SOURCE)} } };
        const home = { manifest: ${JSON.stringify(HOME_MANIFEST)}, worker: { source: ${JSON.stringify(HOME_SOURCE)} }, asset: (path) => path };
        window.__failures = [];
        const broken = { manifest: ${JSON.stringify(BROKEN_MANIFEST)}, worker: { source: ${JSON.stringify(BROKEN_SOURCE)} }, limits: { maxNodes: 10 }, onFailure: (reason) => window.__failures.push(reason) };
        const compiled = compileDocumentWithoutCheck(roadmap, { today: () => "2026-10-19" });
        if (!compiled.ok) window.__failed = compiled.findings.map((finding) => finding.message).join("; ");
        else
          window.__handle = (alone ? mountPages : mount)(document.getElementById("app"), {
            app: compiled.app,
            seed,
            ...(alone ? {} : { face: "pages", studio: false }),
            routing: "address",
            ...based,
            principal: { kind: "human", id: "u:owner", roles: ["owner"] },
            label: compiled.app.name,
            heading: 1,
            height: "100dvh",
            fonts: false,
            views: (schema, registry) => framed(tidy ? registerWorkerView(registerWorkerView(registry, home), stageBoard) : registerWorkerView(registerWorkerView(registry, home), broken)),
            onDrawn: (place) => window.__drawn.push({ ...place, at: performance.now() }),
            keptViews,
            ...(asked ? { draftView: { manifest: asked.manifest, source: asked.source, author: "Proposed by Claude", ...(asked.limits ? { limits: asked.limits } : {}) } } : {}),
          });`,
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
    // Every package's JSX is React's own runtime, whichever tsconfig esbuild finds for a file.
    jsx: "automatic",
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const image = png(360, 240);
  const font = readFileSync(FONT);
  const later = (ms, then) => setTimeout(then, ms);
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    if (path === IMAGE_PATH) return later(IMAGE_LATE_MS, () => (response.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" }), response.end(image)));
    if (path === "/guest-late.html" || path === "/guest-silent.html") return (response.writeHead(200, { "content-type": "text/html" }), response.end(path === "/guest-late.html" ? GUEST_LATE : GUEST_SILENT));
    if (path === "/late-face.woff2") return later(FONT_LATE_MS, () => (response.writeHead(200, { "content-type": "font/woff2", "cache-control": "no-store" }), response.end(font)));
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
  await vacant(portFor("drawn-host"));
  await new Promise((ready) => host.listen(portFor("drawn-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/* ── what is read in the page ─────────────────────────────────────────── */

/*
 * Before any of the page's own scripts: every change of the root's
 * attribute, with what stood on the page at that moment — the place's
 * address, the fonts, the view's words and image, and where everything was.
 */
function instrument() {
  const rects = () => {
    const root = document.querySelector("[data-graview-embed]");
    if (!root) return [];
    const all = [...root.querySelectorAll("*")];
    for (const view of root.querySelectorAll("[data-worker-view]")) if (view.shadowRoot) all.push(...view.shadowRoot.querySelectorAll("*"));
    return all.slice(0, 1500).map((element) => {
      const box = element.getBoundingClientRect();
      return [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)];
    });
  };
  // What a person reads there: the text, not the sheets drawn beside it.
  const words = (element) => {
    if (!element) return "";
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, { acceptNode: (node) => (node.parentElement?.closest("style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let said = "";
    while (walker.nextNode() && said.length < 400) said += ` ${walker.currentNode.nodeValue}`;
    return said.replace(/\s+/g, " ").trim();
  };
  const seenNow = () => {
    const root = document.querySelector("[data-graview-embed]");
    const region = root?.querySelector('[data-worker-view="front"]');
    const picture = region?.shadowRoot?.querySelector("#picture");
    const frame = root?.querySelector("iframe[data-guest-view]");
    const draft = root?.querySelector("[data-graview-draft-view]");
    return {
      address: location.pathname,
      atAbs: performance.timeOrigin + performance.now(),
      frame: frame ? { drawn: frame.hasAttribute("data-guest-view-drawn"), failed: frame.getAttribute("data-guest-view-failed"), height: Math.round(frame.getBoundingClientRect().height) } : null,
      draft: draft ? { line: draft.querySelector('[data-testid="draft-view-line"]')?.textContent ?? null, words: words(draft.querySelector("[data-worker-view]")?.shadowRoot ?? null) } : null,
      fonts: document.fonts?.status,
      lateFace: document.fonts ? [...document.fonts].some((face) => face.family.replace(/"/g, "") === "Late Face" && face.status === "loaded") : null,
      busy: Boolean(root?.querySelector('[aria-busy="true"]')),
      viewWords: region?.shadowRoot?.querySelector("#features")?.textContent ?? null,
      picture: picture ? { complete: picture.complete, width: picture.naturalWidth } : null,
      failures: [...(window.__failures ?? [])],
      brokenStillDrawn: Boolean(root?.querySelector('[data-worker-view-place="broken-board"]')),
      text: words(root?.querySelector("[data-embed-content]")),
    };
  };
  window.__rects = rects;
  window.__seenNow = seenNow;
  window.__marks = [];
  const watch = () =>
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.attributeName !== "data-graview-drawn") continue;
        const value = record.target.getAttribute("data-graview-drawn");
        window.__marks.push({ value, at: performance.now(), seen: seenNow(), rects: value === null ? null : rects() });
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-graview-drawn"] });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
}

/** Every element that moved or changed size between two readings, by more than a pixel. */
const movedBetween = (before, after) => {
  if (!before || !after) return { compared: 0, moved: -1, grew: 0 };
  let moved = 0;
  const n = Math.min(before.length, after.length);
  for (let at = 0; at < n; at++) if (before[at].some((value, i) => Math.abs(value - after[at][i]) > 1)) moved++;
  return { compared: n, moved, grew: after.length - before.length };
};

/* ── the run ──────────────────────────────────────────────────────────── */

const report = { at: new Date().toISOString(), engines, screens: SCREENS, late: { fontMs: FONT_LATE_MS, imageMs: IMAGE_LATE_MS }, checks: {} };
const host = await buildHost();
const errors = [];
const seen = { home: [], still: [], move: [], failed: [], told: [], scene: [], drafts: [], gone: [], frames: [], silent: [], alone: [], aloneDraft: [], swaps: [], based: [], tidied: [] };
/* What the place menu hides while it is the place open: a kind's list, a declared lens, a view the host keeps. */
const TIDIED = [
  { name: "list", path: "/features", label: "Features", item: "hide-list" },
  { name: "lens", path: "/places/up-next", label: "Up next", item: "hide-view" },
  { name: "view", path: "/places/stage-board", label: "Stage board", item: "hide-view" },
];
/* Whether the bar offers a place by its name — on its row or in its drop-down; the drop-down's Hidden and Recently deleted are not offers. */
const offers = (page, label) =>
  page.evaluate(
    (label) => [...document.querySelectorAll("[data-graview-embed] [data-place-path]")].filter((entry) => !entry.closest('[data-place-group="hidden"],[data-place-group="removed"]')).some((entry) => entry.textContent?.trim() === label),
    label,
  );
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const screen of SCREENS) {
      const label = `${engine} ${screen.name}`;
      const open = async (path) => {
        const context = await browser.newContext({ viewport: { width: screen.width, height: screen.height }, colorScheme: screen.scheme, reducedMotion: "reduce" });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${label} ${path}: ${error.message}`));
        await page.addInitScript(instrument);
        const started = Date.now();
        await page.goto(`${at("drawn-host")}${path}`, { waitUntil: "load" });
        const failed = await page.evaluate(() => window.__failed ?? null);
        if (failed) errors.push(`${label}: the document did not compile: ${failed}`);
        return { page, started, close: () => context.close() };
      };
      const said = (page, value) => page.waitForFunction((value) => window.__marks.some((mark) => mark.value === value), value, { timeout: 20_000 }).then(() => true, () => false);
      const shot = async (page, name) => {
        if (!SHOTS || engine !== engines[0]) return;
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: join(SHOTS, `${engine}-${screen.name}-${name}.png`) });
      };
      {
        // The home: the face fetched, the late font, the view and its late image.
        const { page, started, close } = await open("/");
        const drawn = await said(page, "/");
        const mark = await page.evaluate(() => window.__marks.find((one) => one.value === "/") ?? null);
        seen.home.push({ engine, screen: screen.name, drawn, afterMs: drawn ? Date.now() - started : null, seen: mark?.seen ?? null });
        await page.waitForTimeout(STILL_MS);
        const after = await page.evaluate(() => window.__rects());
        seen.still.push({ engine, screen: screen.name, ...movedBetween(mark?.rects, after), stillSaid: await page.evaluate(() => document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-drawn")) });
        await shot(page, "home");
        // A press on the view's link: off before the features have drawn, and back once they have.
        const before = await page.evaluate(() => window.__marks.length);
        await page.locator('[data-worker-view="front"]').locator("#to-features").click();
        const back = await said(page, "/features");
        const marks = await page.evaluate((from) => window.__marks.slice(from).map((one) => ({ value: one.value, at: Math.round(one.at), address: one.seen.address, busy: one.seen.busy, text: one.seen.text })), before);
        seen.move.push({ engine, screen: screen.name, back, marks });
        seen.told.push({ engine, screen: screen.name, told: await page.evaluate(() => window.__drawn.map(({ face, path }) => ({ face, path }))) });
        await shot(page, "features");
        await close();
      }
      {
        // The scene, which settles as its camera does: said well before a place that never stops moving would be (10 s).
        const { page, started, close } = await open("/places/overview");
        const drawn = await said(page, "/places/overview");
        const afterMs = drawn ? Date.now() - started : null;
        await page.waitForTimeout(STILL_MS);
        const marks = await page.evaluate(() => window.__marks.map((one) => one.value));
        seen.scene.push({ engine, screen: screen.name, drawn, afterMs, marks });
        await shot(page, "scene");
        await close();
      }
      {
        // A place drawn by a view that fails.
        const { page, close } = await open("/places/broken-board");
        const drawn = await said(page, "/places/broken-board");
        const mark = await page.evaluate(() => window.__marks.find((one) => one.value === "/places/broken-board") ?? null);
        seen.failed.push({ engine, screen: screen.name, drawn, seen: mark?.seen ?? null });
        await shot(page, "failed");
        await close();
      }
      for (const [name, draft] of Object.entries(DRAFTS)) {
        // A view proposed and not kept, pictured where it attaches once the page says it has drawn (FR-187).
        const { page, close } = await open(`${draft.address}?draft=${name}`);
        // The place's path with its search, as `where()` says it.
        const drawn = await said(page, `${draft.address}?draft=${name}`);
        const ops = await page.evaluate(() => window.__handle.store.log.all().length);
        const look = await page.evaluate((viewName) => {
          const root = document.querySelector("[data-graview-embed]");
          const mark = root?.querySelector(`[data-graview-draft-view="${viewName}"]`);
          const line = mark?.querySelector('[data-testid="draft-view-line"]');
          const box = line?.getBoundingClientRect();
          const region = mark?.querySelector("[data-worker-view]");
          return {
            scheme: root?.getAttribute("data-graview-scheme"),
            marked: Boolean(mark),
            label: mark?.getAttribute("aria-label") ?? null,
            line: line?.textContent ?? null,
            lineShown: Boolean(box && box.height > 0 && box.top >= 0 && box.bottom <= innerHeight),
            places: root?.querySelectorAll(`[data-worker-view-place="${viewName}"]`).length ?? 0,
            words: region?.shadowRoot ? [...region.shadowRoot.querySelectorAll("*")].filter((element) => element.localName !== "style" && element.children.length === 0).map((element) => element.textContent).join(" ").replace(/\s+/g, " ").trim().slice(0, 300) : null,
            stopped: region?.getAttribute("data-worker-view-failed") ?? null,
            plainFace: Boolean(region?.shadowRoot?.querySelector("[data-graview-fallback]")),
            keptWords: (root?.querySelector('[data-worker-view="front"]')?.shadowRoot?.textContent ?? "").includes("What we are making"),
          };
        }, draft.manifest.name);
        const picture = await page.screenshot({ type: "png" });
        if (SHOTS && engine === engines[0]) {
          mkdirSync(SHOTS, { recursive: true });
          writeFileSync(join(SHOTS, `${engine}-${screen.name}-draft-${name}.png`), picture);
        }
        const asked = await page.evaluate(() => window.__keptAsked);
        const after = await page.evaluate(() => window.__handle.store.log.all().length);
        seen.drafts.push({ engine, screen: screen.name, name, address: draft.address, drawn, ...look, pictureBytes: picture.length, keptAsked: asked, wrote: after - ops });
        await close();
        // The same address, handed no draft: nothing of it was kept.
        const next = await open(draft.address);
        await said(next.page, draft.address);
        seen.gone.push({ engine, screen: screen.name, name, ...(await next.page.evaluate(() => ({ drafts: document.querySelectorAll("[data-graview-draft-view]").length, keptHome: (document.querySelector('[data-worker-view="front"]')?.shadowRoot?.textContent ?? "").includes("What we are making") }))) });
        await next.close();
      }
      {
        // A frame guest that draws a second after it is handed its props (FR-188).
        const address = "/features/f1?guest=late";
        const { page, close } = await open(address);
        const drawn = await said(page, address);
        const mark = await page.evaluate((value) => window.__marks.find((one) => one.value === value) ?? null, address);
        const guestFrame = page.frames().find((frame) => frame.url().endsWith("/guest-late.html"));
        const drewAt = guestFrame ? await guestFrame.evaluate(() => window.__drewAt ?? null).catch(() => null) : null;
        const words = guestFrame ? await guestFrame.evaluate(() => document.getElementById("drawn")?.textContent ?? null).catch(() => null) : null;
        seen.frames.push({ engine, screen: screen.name, drawn, frame: mark?.seen.frame ?? null, markAt: mark ? Math.round(mark.seen.atAbs) : null, drewAt: drewAt === null ? null : Math.round(drewAt), words });
        await shot(page, "frame-guest");
        await close();
      }
      {
        // A frame guest that never says it is ready: settled once its time is up.
        const address = "/features/f1?guest=silent";
        const { page, started, close } = await open(address);
        const drawn = await said(page, address);
        const mark = await page.evaluate((value) => window.__marks.find((one) => one.value === value) ?? null, address);
        seen.silent.push({ engine, screen: screen.name, drawn, afterMs: drawn ? Date.now() - started : null, frame: mark?.seen.frame ?? null });
        await close();
      }
      {
        // The pages alone: the home, after the late font and the view's late image.
        const { page, close } = await open("/?alone=1");
        const drawn = await said(page, "/?alone=1");
        const mark = await page.evaluate(() => window.__marks.find((one) => one.value === "/?alone=1") ?? null);
        const embed = await page.evaluate(() => document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed"));
        seen.alone.push({ engine, screen: screen.name, drawn, embed, seen: mark?.seen ?? null });
        await shot(page, "alone");
        await close();
      }
      for (const [mounting, alone] of [["whole", ""], ["alone", "&alone=1"]]) {
        // A draft swapped in place on each mount (setDraftView), and a draft under Cloud's base.
        const address = `/places/stage-board?draft=board${alone}`;
        const { page, close } = await open(address);
        const drawn = await said(page, address);
        if (alone) {
          const mark = await page.evaluate((value) => window.__marks.find((one) => one.value === value) ?? null, address);
          seen.aloneDraft.push({ engine, screen: screen.name, drawn, draft: mark?.seen.draft ?? null });
        }
        const before = await page.evaluate(() => {
          window.__storeBefore = window.__handle.store;
          document.querySelector("[data-graview-embed]")?.setAttribute("data-harness-root", "same");
          return window.__marks.length;
        });
        const offInTheCall = await page.evaluate(() => {
          window.__revise();
          return document.querySelector("[data-graview-embed]")?.hasAttribute("data-graview-drawn") ?? null;
        });
        const back = await page.waitForFunction((from) => window.__marks.slice(from).some((mark) => mark.value !== null), before, { timeout: 20_000 }).then(() => true, () => false);
        const after = await page.evaluate((from) => ({
          marks: window.__marks.slice(from).map((one) => ({ value: one.value, draft: one.seen.draft })),
          sameRoot: document.querySelector("[data-graview-embed]")?.getAttribute("data-harness-root") === "same",
          sameStore: window.__handle.store === window.__storeBefore,
        }), before);
        seen.swaps.push({ engine, screen: screen.name, mounting, address, drawn, offInTheCall, back, ...after });
        await shot(page, `swapped-${mounting}`);
        await close();
        const underBase = `${BASE}/places/stage-board?draft=board&base=1${alone}`;
        const based = await open(underBase);
        const value = `/places/stage-board?draft=board&base=1${alone}`;
        const basedDrawn = await said(based.page, value);
        const basedMark = await based.page.evaluate((value) => window.__marks.find((one) => one.value === value) ?? null, value);
        seen.based.push({ engine, screen: screen.name, mounting, drawn: basedDrawn, address: basedMark?.seen.address ?? null, draft: basedMark?.seen.draft ?? null });
        await based.close();
      }
      for (const tidied of TIDIED) {
        // Hidden from the place menu while it is the place open (Roadmap f-hidden-view-leaves-the-bar).
        const address = `${tidied.path}?tidy=1`;
        const { page, close } = await open(address);
        const drawn = await said(page, address);
        const before = await offers(page, tidied.label);
        const standing = page.locator('[data-testid="app-places-standing"] [aria-current="page"]');
        const stands = (await standing.count()) > 0 && (await standing.first().isVisible());
        await (stands ? standing.first() : page.locator('[data-testid="app-places-open"]').first()).click({ button: "right" });
        const row = page.locator(`[data-testid="context-menu"] [data-menu-item="${tidied.item}"]`);
        const offered = await row.waitFor({ timeout: 10_000 }).then(() => true, () => false);
        let left = false;
        let still = null;
        let named = null;
        let inFoot = false;
        let back = false;
        if (offered) {
          await row.click();
          left = await page.waitForFunction((label) => ![...document.querySelectorAll("[data-graview-embed] [data-place-path]")].filter((entry) => !entry.closest('[data-place-group="hidden"],[data-place-group="removed"]')).some((entry) => entry.textContent?.trim() === label), tidied.label, { timeout: 5_000 }).then(() => true, () => false);
          still = await page.evaluate(() => location.pathname);
          named = await page.locator('[data-testid="app-places-open"]').first().textContent();
          await shot(page, `hidden-${tidied.name}`);
          await page.locator('[data-testid="app-places-open"]').first().click();
          const foot = page.locator('[data-place-group="hidden"] li', { hasText: tidied.label });
          inFoot = await foot.first().waitFor({ timeout: 5_000 }).then(() => true, () => false);
          if (inFoot) {
            await foot.first().locator("button").click();
            back = await page.waitForFunction((label) => [...document.querySelectorAll("[data-graview-embed] [data-place-path]")].filter((entry) => !entry.closest('[data-place-group="hidden"],[data-place-group="removed"]')).some((entry) => entry.textContent?.trim() === label), tidied.label, { timeout: 5_000 }).then(() => true, () => false);
          }
        }
        seen.tidied.push({ engine, screen: screen.name, name: tidied.name, drawn, before, stands, offered, left, still, named: named?.trim() ?? null, inFoot, back });
        await close();
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

report.checks.theRootSaysDrawnOnceThePlaceSettles = {
  seen: seen.home.map(({ engine, screen, drawn, afterMs }) => ({ engine, screen, drawn, afterMs })),
  ok: every(seen.home, (one) => one.drawn),
};
report.checks.whenItIsSaidTheLateFontTheViewsWordsAndItsLateImageAreThere = {
  seen: seen.home.map(({ engine, screen, seen: at }) => ({ engine, screen, ...at })),
  ok: every(seen.home, (one) => one.seen && one.seen.fonts === "loaded" && one.seen.lateFace === true && !one.seen.busy && /Printable boards/.test(one.seen.viewWords ?? "") && one.seen.picture?.complete === true && one.seen.picture.width === 360),
};
report.checks.nothingMovesAfterItIsSaid = {
  seen: seen.still,
  ok: every(seen.still, (one) => one.compared > 20 && one.moved === 0 && one.grew === 0 && one.stillSaid === "/"),
};
report.checks.aMoveTakesItOffAndTheNextPlacePutsItBackOnceItSettles = {
  seen: seen.move,
  ok: every(seen.move, (one) => one.back && one.marks.length === 2 && one.marks[0].value === null && one.marks[1].value === "/features" && one.marks[1].address === "/features" && !one.marks[1].busy && one.marks[1].at - one.marks[0].at >= 200 && /Printable boards/.test(one.marks[1].text)),
};
report.checks.aViewThatFailsCountsAsSettledWithWhatIsDrawnInItsPlace = {
  seen: seen.failed,
  ok: every(seen.failed, (one) => one.drawn && one.seen?.failures.includes("nodes") && !one.seen.brokenStillDrawn && !one.seen.busy && /Printable boards/.test(one.seen.text)),
};
report.checks.onDrawnIsToldEachPlaceAsWhereSaysIt = {
  seen: seen.told,
  ok: every(seen.told, (one) => one.told.length === 2 && one.told[0].face === "pages" && one.told[0].path === "/" && one.told[1].path === "/features"),
};
report.checks.theSceneSaysItOnceItsCameraSettles = {
  seen: seen.scene,
  ok: every(seen.scene, (one) => one.drawn && one.afterMs < 8_000 && one.marks.join() === "/places/overview"),
};
const drafted = (name) => seen.drafts.filter((one) => one.name === name);
const everyDraft = (names, held) => names.every((name) => every(drafted(name), held));
report.checks.aProposedViewIsPicturedWhereItAttachesBeforeItIsKept = {
  seen: seen.drafts.filter((one) => one.name !== "stopped").map(({ engine, screen, name, address, drawn, scheme, words, pictureBytes }) => ({ engine, screen, name, address, drawn, scheme, words, pictureBytes })),
  ok: everyDraft(["home", "board", "record"], (one) => one.drawn && one.places === 1 && one.words?.includes(DRAFTS[one.name].words) && one.pictureBytes > 10_000 && one.scheme === SCREENS.find((screen) => screen.name === one.screen).scheme),
};
report.checks.theDraftIsMarkedAsADraftWhereAPersonSeesIt = {
  seen: seen.drafts.map(({ engine, screen, name, marked, label, line, lineShown }) => ({ engine, screen, name, marked, label, line, lineShown })),
  ok: everyDraft(Object.keys(DRAFTS), (one) => one.marked && one.label === `Draft: ${DRAFTS[one.name].manifest.title}` && one.line === `Draft — ${DRAFTS[one.name].manifest.title}·Not kept` && one.lineShown),
};
report.checks.theDraftStandsInForTheKeptViewOfItsName = {
  seen: drafted("home").map(({ engine, screen, places, keptWords, words }) => ({ engine, screen, places, keptWords, words })),
  ok: every(drafted("home"), (one) => one.places === 1 && !one.keptWords && one.words?.includes("The front, proposed")),
};
report.checks.aDraftThatIsStoppedSaysWhyInItsPlace = {
  seen: drafted("stopped").map(({ engine, screen, drawn, stopped, plainFace, words }) => ({ engine, screen, drawn, stopped, plainFace, words })),
  ok: every(drafted("stopped"), (one) => one.drawn && one.stopped === "nodes" && one.plainFace && /This view was stopped/.test(one.words ?? "")),
};
report.checks.nothingOfADraftIsKept = {
  seen: { drafts: seen.drafts.map(({ engine, screen, name, keptAsked, wrote }) => ({ engine, screen, name, keptAsked, wrote })), after: seen.gone },
  ok: everyDraft(Object.keys(DRAFTS), (one) => one.keptAsked.length === 0 && one.wrote === 0) && seen.gone.length >= runs * Object.keys(DRAFTS).length && seen.gone.every((one) => one.drafts === 0 && (one.name !== "home" || one.keptHome)),
};
report.checks.aFrameGuestHoldsTheSignalUntilItHasDrawn = {
  seen: seen.frames,
  ok: every(seen.frames, (one) => one.drawn && one.frame?.drawn === true && one.frame.height >= 180 && one.words === "A card drawn late" && one.drewAt !== null && one.markAt !== null && one.markAt >= one.drewAt),
};
report.checks.aFrameGuestThatNeverSaysReadyCountsAsSettled = {
  seen: seen.silent,
  ok: every(seen.silent, (one) => one.drawn && one.frame?.failed === "silent" && one.frame.drawn === false && one.afterMs < 8_000),
};
report.checks.thePagesAloneSayItOnceThePlaceSettles = {
  seen: seen.alone.map(({ engine, screen, drawn, embed, seen: at }) => ({ engine, screen, drawn, embed, ...(at ? { fonts: at.fonts, lateFace: at.lateFace, viewWords: at.viewWords, picture: at.picture, busy: at.busy } : {}) })),
  ok: every(seen.alone, (one) => one.drawn && one.embed === "pages" && one.seen && one.seen.lateFace === true && !one.seen.busy && /Printable boards/.test(one.seen.viewWords ?? "") && one.seen.picture?.complete === true && one.seen.picture.width === 360),
};
report.checks.thePagesAloneDrawADraftWhereItAttaches = {
  seen: seen.aloneDraft,
  ok: every(seen.aloneDraft, (one) => one.drawn && one.draft?.line === `Draft — ${DRAFTS.board.manifest.title}·Not kept` && one.draft.words.includes(DRAFTS.board.words)),
};
const swapped = (mounting) => seen.swaps.filter((one) => one.mounting === mounting);
report.checks.aDraftSwappedInPlaceIsSaidDrawnOnceTheNewOneHas = {
  seen: seen.swaps,
  ok: ["whole", "alone"].every((mounting) => every(swapped(mounting), (one) => one.drawn && one.offInTheCall === false && one.back && one.marks.length === 2 && one.marks[0].value === null && one.marks[1].value === one.address && one.marks[1].draft?.line === `Draft — ${REVISED.manifest.title}·Not kept` && one.marks[1].draft.words.includes(REVISED.words) && one.sameRoot && one.sameStore)),
};
const basedOn = (mounting) => seen.based.filter((one) => one.mounting === mounting);
report.checks.aDraftUnderABasePathIsDrawnAtItsPlace = {
  seen: seen.based,
  ok: ["whole", "alone"].every((mounting) => every(basedOn(mounting), (one) => one.drawn && one.address === `${BASE}/places/stage-board` && one.draft?.line === `Draft — ${DRAFTS.board.manifest.title}·Not kept` && one.draft.words.includes(DRAFTS.board.words))),
};
report.checks.aViewHiddenFromThePlaceMenuLeavesTheBarAndComesBackOnShow = {
  seen: seen.tidied,
  ok: TIDIED.every((tidied) => every(seen.tidied.filter((one) => one.name === tidied.name), (one) => one.drawn && one.before && one.offered && one.left && one.still === tidied.path && one.inFoot && one.back)),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/drawn.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/drawn.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
