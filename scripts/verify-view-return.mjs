#!/usr/bin/env node
/**
 * A CUSTOM PAGE DOES NOT FLASH IN AS A PERSON GOES BACK TO IT
 * (Graview HQ hq:feature:f-custom-pages-do-not-flash).
 *
 * On Graview Cloud a page drawn by a view of the app's own came in after
 * its page did, on every visit, and again on going back to one just left:
 * the view was taken down as its page was left, and returned to by a new
 * worker, what it keeps for its viewer asked of the host again, and a frame
 * loaded again. Held here, frame by frame, on a roadmap's pages at the
 * routed face and the one face, each view's code and frame, and what a view
 * keeps, taking LATE_MS to arrive as a host's do:
 *
 *   · going back to a visited custom page — a place, a record's page, the
 *     home — no frame is blank and none shows something in its stead;
 *   · nor to a frame's its host said may be kept, whose page is not asked for again, where the engine
 *     can move a frame without loading it (`Element.moveBefore`); where it
 *     cannot, it is drawn anew and drawn;
 *   · what a person typed, how far the view was scrolled and, going back
 *     with the keyboard in a field, the keyboard, are as they were;
 *   · a record changed while the page was away is drawn as it is now with
 *     no blank frame, and a press made before that is drawn is applied
 *     once it is, where its control asks for the same thing, and never
 *     where the row is another record's by then;
 *   · a record gone while away is nowhere on the page gone back to;
 *   · for another seat, and once the view is taken away, it is not the one
 *     kept;
 *   · a view that spins falls back within its budget, the first visit and
 *     the next;
 *   · a first visit come to by a pointer or the keyboard waits for nothing
 *     fetched, its view's code and what it keeps asked once, as a press's are
 *     from its pointer going down; idleness fetches the code of a few places
 *     and nobody's values, and a page asked to save data nothing at all;
 *   · a return is drawn within RETURN_MS, and what a first visit took is said.
 *
 *   node scripts/verify-view-return.mjs [--engine=chromium|webkit|firefox] [--quick] [--measure]
 *
 * Writes docs/view-return.json.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
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
const MEASURE = process.argv.includes("--measure");
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const ROADMAP = resolve(repoRoot, "scripts/fixtures/growing/roadmap.gdd.json");
/* How long a view's code, and a frame's page, take to arrive. */
const LATE_MS = 120;
const SLOW = Math.max(1, Number(process.env["GRAVIEW_SLOW"] ?? 1));
/* The most a return may take to be drawn, from the move. */
const RETURN_MS = 120 * SLOW;
/* The most a first visit whose view was fetched ahead may take: a worker started and drawn, nothing fetched. */
const FIRST_MS = 100 * SLOW;

const SEED = {
  nodes: [
    ...["Printable boards", "Shared drafts", "Weekly digest", "Offline pages"].map((name, i) => ({ id: `f${i + 1}`, kind: "feature", name, stage: ["idea", "planned", "building", "shipped"][i], area: ["pages", "scene", "core", "cloud"][i], summary: `What ${name.toLowerCase()} would do.` })),
    ...["Let me print a board", "Work without a connection"].map((name, i) => ({ id: `r${i + 1}`, kind: "request", name, status: "new", summary: "Asked." })),
    { id: "p1", kind: "person", name: "Ada Brennan" },
  ],
  edges: [{ kind: "became", from: "r1", to: "f1" }],
};

/* Each view draws its records' labels, so what stands is read as words. */
const draws = (lead) => `graview.style("li{padding:6px 0} #box{height:120px;overflow:auto} #tall{height:600px} p{margin:8px 0}");
graview.onProps((props) => graview.render(graview.html\`<h2 id="lead">${lead}</h2><p><input id="words" aria-label="Words"></p><ul>\${(props.nodes ?? [props.node]).map((node) => graview.html\`<li>\${node.label}</li>\`)}</ul><div id="box"><div id="tall">A long part</div></div>\`));`;
const VIEWS = {
  alpha: { manifest: { name: "alpha", title: "Alpha board", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] } }, source: draws("Alpha drawn") },
  beta: { manifest: { name: "beta", title: "Beta board", attach: "request", cardinality: "many", reads: { kinds: ["request"] } }, source: draws("Beta drawn") },
  page: { manifest: { name: "feature-page", title: "Feature page", attach: "feature", cardinality: "one", replaces: "page", reads: { kinds: ["feature"] } }, source: draws("Record drawn") },
  home: { manifest: { name: "front", title: "The front", attach: "home", cardinality: "many", reads: { kinds: ["feature"] } }, source: draws("Home drawn") },
  /* Slow over each push after the first, so a press lands before what changed is drawn; a row for each feature not shipped yet. */
  slow: { manifest: { name: "slow", title: "Slow board", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] }, acts: [{ act: "edit-feature", as: "retitle", constants: { summary: "Pressed" } }] }, source: `graview.style("li{height:60px}");
let drawn = 0;
graview.onProps((props) => {
  if (drawn++ > 0) for (const from = Date.now(); Date.now() - from < 400; ) {}
  graview.render(graview.html\`<h2 id="lead">Slow drawn</h2><ul>\${props.nodes.filter((node) => node.stage !== "shipped").map((node) => graview.html\`<li><button data-act="retitle" data-record=\${node.id} style="width:200px;height:40px">\${node.label}</button></li>\`)}</ul>\`);
});` },
  spins: { manifest: { name: "spins", title: "Spins", attach: "feature", cardinality: "many", reads: { kinds: ["feature"] } }, source: `graview.onProps(() => { for (;;) {} });` },
};

const guestPage = (client) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:15px system-ui;background:#fff;color:#222}</style></head><body><h3 id="title">The frame</h3><p><input id="words" aria-label="Words"></p><ul id="list"></ul>
<script>${client}</script><script>
const guest = GraviewGuest.connect();
guest.subscribe(() => {
  const props = guest.props;
  document.getElementById("list").innerHTML = (props && props.nodes ? props.nodes : []).map((node) => "<li>" + node.label + "</li>").join("");
  if (!window.sized) guest.size(320);
  window.sized = true;
});
</script></body></html>`;

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The roadmap</title>
<style>body{margin:0;background:#f6f6f2;color:#222}</style></head><body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-view-return-"));
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
        const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: ${JSON.stringify(SEED)}, policy: app.policy });
        const params = new URLSearchParams(location.search);
        let seat = { kind: "human", id: "u:owner", roles: ["owner"] };
        window.__store = store;
        window.__owner = seat;
        const kept = {};
        const viewerState = { read: (view) => ((window.__reads ??= []).push(view), new Promise((done) => setTimeout(() => done({ ...kept[view] }), ${LATE_MS}))), write: async (view, key, value) => (((kept[view] ??= {})[key] = value), { ok: true }) };
        window.__failures = [];
        const given = ${JSON.stringify(Object.fromEntries(Object.entries(VIEWS).map(([key, one]) => [key, one.manifest])))};
        const make = (without = []) => {
          let views = registerDefaultViews(app.schema, createViews(app.schema));
          for (const [key, manifest] of Object.entries(given)) {
            if (without.includes(key)) continue;
            views = registerWorkerView(views, { manifest, worker: () => fetch("/code/" + key).then((answer) => answer.text()).then((source) => ({ source })), limits: { pushMs: key === "spins" ? 400 : 3000 }, onFailure: (reason) => window.__failures.push({ name: manifest.name, reason, at: performance.now() }) });
          }
          return views.register("person", { cardinality: "many", fidelity: "full" }, guestView({ url: "/frame.html", name: "framed", title: "Framed", keeps: true }), { title: "Framed", lens: "view" });
        };
        let views = make();
        const root = createRoot(document.getElementById("app"));
        const draw = () => root.render(createElement(PagesApp, { context: { store, app, principal: seat, views, viewerState, ...(params.has("one") ? { sceneUnderPages: true } : {}) } }));
        window.__seat = (next) => { seat = next; draw(); };
        window.__without = (names) => { views = make(names); draw(); };
        draw();`,
      resolveDir: resolve(repoRoot, "packages/pages"),
      loader: "js",
    },
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    outdir: out,
    entryNames: "entry",
    define: { "process.env.NODE_ENV": '"production"' },
    jsx: "automatic",
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const frame = guestPage(readFileSync(resolve(repoRoot, "packages/guest/client.js"), "utf8").replace(/<\/script/gi, "<\\/script"));
  const counts = { frame: 0, code: {} };
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const late = (type, body) => setTimeout(() => (response.writeHead(200, { "content-type": type, "cache-control": "no-store" }), response.end(body)), LATE_MS);
    if (path === "/frame.html") return (counts.frame += 1), late("text/html", frame);
    if (path.startsWith("/code/")) counts.code[path.slice("/code/".length)] = (counts.code[path.slice("/code/".length)] ?? 0) + 1;
    if (path.startsWith("/code/")) return late("text/javascript", VIEWS[path.slice("/code/".length)]?.source ?? "");
    const name = path.replace(/^\/+/, "") || "index.html";
    const file = join(out, name);
    const script = name.endsWith(".js");
    if (!file.startsWith(out) || (script && !existsSync(file))) return response.writeHead(404), response.end();
    response.writeHead(200, { "content-type": script ? "text/javascript" : "text/html" });
    response.end(readFileSync(script ? file : join(out, "index.html")));
  });
  await vacant(portFor("view-return-host"));
  await new Promise((ready) => host.listen(portFor("view-return-host"), ready));
  return { counts, stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/* ── in the page ─────────────────────────────────────────────────────── */

/* What stands at each frame from a move: the old page, a blank place, what is drawn in a view's stead, or the view's drawing. */
function instrument() {
  const wordsOf = (region) => [...(region.shadowRoot?.querySelectorAll("h2, li, h3") ?? [])].map((one) => one.textContent).join("|");
  window.__look = (want) => {
    const holder = want.frame ? document.querySelector('[data-guest="framed"]') : document.querySelector(`[data-worker-view-place="${want.name}"]`);
    if (!holder) return document.querySelector("[data-worker-view-fallback], [data-worker-view-fell-back]") ? "instead" : "other";
    const box = holder.getBoundingClientRect();
    const hidden = getComputedStyle(holder).visibility === "hidden" || box.height < 20;
    if (want.frame) {
      const frame = holder.querySelector("iframe");
      return frame?.hasAttribute("data-guest-view-drawn") && !hidden ? "drawn" : "blank";
    }
    const region = holder.querySelector("[data-worker-view]");
    if (!region || hidden) return "blank";
    if (region.shadowRoot?.querySelector("[data-graview-fallback]")) return "instead";
    return wordsOf(region).includes(want.words) ? "drawn" : "blank";
  };
  /* The same, from a person's own press on a link: from its click. */
  window.__pressed = (want, ms = 2500) =>
    new Promise((done) => {
      addEventListener("click", () => {
        const frames = [];
        const began = performance.now();
        let until = ms;
        const see = () => {
          const now = performance.now() - began;
          const what = window.__look(want);
          if (frames.at(-1)?.what !== what) frames.push({ what, from: Math.round(now), frames: 1 });
          else frames.at(-1).frames += 1;
          if (what === "drawn" && until === ms) until = now + 200;
          if (now < until) requestAnimationFrame(see);
          else done({ frames, drawnAt: frames.find((one) => one.what === "drawn")?.from ?? null, reads: [...(window.__reads ?? [])] });
        };
        requestAnimationFrame(see);
      }, { once: true, capture: true });
    });
  window.__go = (path, want, ms = 2500) =>
    new Promise((done) => {
      const frames = [];
      const began = performance.now();
      history.pushState({}, "", path);
      dispatchEvent(new PopStateEvent("popstate", { state: {} }));
      let until = ms;
      const see = () => {
        const now = performance.now() - began;
        const what = window.__look(want);
        if (frames.at(-1)?.what !== what) frames.push({ what, from: Math.round(now), frames: 1 });
        else frames.at(-1).frames += 1;
        if (what === "drawn" && until === ms) until = now + 250;
        if (now < until) requestAnimationFrame(see);
        else done({ frames, drawnAt: frames.find((one) => one.what === "drawn")?.from ?? null });
      };
      requestAnimationFrame(see);
    });
}

const PLACES = {
  alpha: { path: "/places/alpha-board", name: "alpha", words: "Alpha drawn" },
  beta: { path: "/places/beta-board", name: "beta", words: "Beta drawn" },
  record: { path: "/features/f1", name: "feature-page", words: "Record drawn" },
  home: { path: "/", name: "front", words: "Home drawn" },
  frame: { path: "/places/framed", frame: true },
};
PLACES.slow = { path: "/places/slow-board", name: "slow", words: "Slow drawn" };
PLACES.spins = { path: "/places/spins", name: "spins", words: "never" };
const go = (page, place) => page.evaluate(([path, want]) => window.__go(path, want), [PLACES[place].path, PLACES[place]]);

const blankless = (frames) => frames.some((one) => one.what === "drawn") && frames.every((one) => one.what === "drawn" || one.what === "other");
const report = { at: new Date().toISOString(), engines, lateMs: LATE_MS, returnMs: RETURN_MS, slow: SLOW, movesFrames: {}, moves: [], checks: {} };
const errors = [];
const seen = {
  whatWasTypedAndScrolledAndTheKeyboardAreAsTheyWere: [],
  aRecordChangedWhileAwayIsDrawnAsItIsNowWithNoBlankFrame: [],
  aPressMadeBeforeTheChangeIsDrawnIsAppliedOnceItIs: [],
  aPressOnARowThatIsAnotherRecordsByThenIsNotApplied: [],
  aRecordGoneWhileAwayIsNowhereOnThePageGoneBackTo: [],
  anotherSeatAndAViewTakenAwayNeverStandWithTheDrawingKept: [],
  aViewThatSpinsFallsBackWithinItsBudgetEachVisit: [],
  aFirstVisitComeToByAPointerOrTheKeyboardWaitsForNothingFetched: [],
  aPressHasTheHeadStartOfItsPointerGoingDown: [],
  aPageAskedToSaveDataFetchesNothingAhead: [],
  idlenessFetchesTheCodeOfAFewPlacesAndNobodysValues: [],
  aViewsCodeAndWhatItKeepsAreAskedOnceForAVisit: [],
};
const region = (name) => `document.querySelector('[data-worker-view-place="${name}"] [data-worker-view]')`;
const inView = (page, name, body) => page.evaluate(`(() => { const region = ${region(name)}; const root = region?.shadowRoot; return (${body}); })()`);
const host = await buildHost();
let browser;
let before = {};
/* The views whose code was asked for since. */
const idled = (now, then) => Object.keys(now).filter((name) => now[name] > (then[name] ?? 0));
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: true });
    for (const face of ["pages", "one"]) {
      const label = `${engine} ${face}`;
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
      page.on("console", (m) => MEASURE && process.stdout.write(`  [${m.text()}]\n`));
      await page.addInitScript(instrument);
      await page.goto(`${at("view-return-host")}/problems?${face}`, { waitUntil: "load" });
      await page.waitForTimeout(2500);
      for (const [move, place] of [["first", "alpha"], ["first", "beta"], ["return", "alpha"], ["return", "beta"], ["first", "record"], ["first", "home"], ["return", "record"], ["return", "home"], ["first", "frame"], ["via", "alpha"], ["return", "frame"]]) {
        const before = host.counts.frame;
        const seen = await go(page, place);
        report.moves.push({ engine, face, move, place, drawnAt: seen.drawnAt, frames: seen.frames, ...(place === "frame" ? { loads: host.counts.frame - before } : {}) });
        if (MEASURE) process.stdout.write(`${label} ${move} ${place}: ${seen.frames.map((one) => `${one.what}@${one.from}(${one.frames})`).join(" ")}${place === "frame" ? ` loads ${host.counts.frame - before}` : ""}\n`);
      }
      report.movesFrames[engine] = await page.evaluate(() => typeof Element.prototype.moveBefore === "function");
      const held = (name, what) => seen[name].push({ engine, face, ...what });

      /* What was typed, how far it was scrolled, the keyboard: left and gone back to as the browser's own Back goes. */
      await go(page, "alpha");
      await page.locator('[data-worker-view-place="alpha"] #words').click();
      await page.keyboard.type("half a thought");
      await inView(page, "alpha", "(root.querySelector('#box').scrollTop = 120, 1)");
      await go(page, "beta");
      await page.evaluate((want) => {
        window.__back = [];
        const see = () => (window.__back.push(window.__look(want)), window.__back.length < 30 && requestAnimationFrame(see));
        addEventListener("popstate", () => requestAnimationFrame(see), { once: true });
        history.back();
      }, PLACES.alpha);
      await page.waitForTimeout(600);
      const asItWas = await inView(page, "alpha", "{ value: root.querySelector('#words').value, scrolled: root.querySelector('#box').scrollTop }");
      /* The keyboard never left the field: Back from the keyboard, with the view the page it goes back from. */
      await page.locator('[data-worker-view-place="alpha"] #words').click();
      await page.evaluate(() => (history.pushState({}, "", "/places/beta-board"), dispatchEvent(new PopStateEvent("popstate", { state: {} }))));
      await page.waitForTimeout(400);
      await page.evaluate(() => history.back());
      await page.waitForTimeout(600);
      const keyboard = await inView(page, "alpha", "root.activeElement?.id ?? null");
      held("whatWasTypedAndScrolledAndTheKeyboardAreAsTheyWere", { ...asItWas, keyboard, frames: [...new Set(await page.evaluate(() => window.__back))], ok: asItWas.value === "half a thought" && asItWas.scrolled === 120 && keyboard === "words" });

      /* A record changed while away. */
      const edit = (args) => page.evaluate((args) => void window.__store.applyAll([{ name: "edit-feature", args }], { author: window.__owner }), args);
      await go(page, "beta");
      await edit({ id: "f2", name: "Drafts for two" });
      const changed = await go(page, "alpha");
      await page.waitForTimeout(300);
      const words = await inView(page, "alpha", "root.textContent");
      held("aRecordChangedWhileAwayIsDrawnAsItIsNowWithNoBlankFrame", { frames: changed.frames, ok: blankless(changed.frames) && words.includes("Drafts for two") && !words.includes("Shared drafts") });

      /* A press made before what changed is drawn: on the same control, and on a row that is another record's by then. */
      const press = async (change, record) => {
        await go(page, "slow");
        await page.waitForTimeout(700);
        const button = page.locator(`[data-worker-view-place="slow"] [data-record="${record}"]`);
        const box = await button.boundingBox();
        await go(page, "beta");
        await edit(change);
        await page.evaluate((path) => (history.pushState({}, "", path), dispatchEvent(new PopStateEvent("popstate", { state: {} }))), PLACES.slow.path);
        await page.waitForFunction(`${region("slow")} !== null`);
        const stood = await inView(page, "slow", `root.querySelector('[data-record="${record}"]') !== null`);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        const atOnce = await page.evaluate(() => ["f1", "f2", "f3"].map((id) => window.__store.graph.getNode(id)?.summary));
        await page.waitForTimeout(1800);
        const after = await page.evaluate(() => ["f1", "f2", "f3"].map((id) => window.__store.graph.getNode(id)?.summary));
        return { stood, atOnce, after };
      };
      const same = await press({ id: "f1", name: "Boards in print" }, "f1");
      held("aPressMadeBeforeTheChangeIsDrawnIsAppliedOnceItIs", { ...same, ok: same.stood && same.after[0] === "Pressed" && same.after[1] !== "Pressed" });
      await edit({ id: "f1", summary: "Again" });
      const other = await press({ id: "f1", stage: "shipped" }, "f1");
      held("aPressOnARowThatIsAnotherRecordsByThenIsNotApplied", { ...other, ok: other.stood && !other.after.slice(1).includes("Pressed") && other.after[0] !== "Pressed" });

      /* A record gone while away. */
      await go(page, "alpha");
      await go(page, "beta");
      await page.evaluate(() => void window.__store.applyAll([{ name: "remove-feature", args: { id: "f4" } }], { author: window.__owner }));
      const gone = await go(page, "alpha");
      const left = await inView(page, "alpha", "root.textContent");
      held("aRecordGoneWhileAwayIsNowhereOnThePageGoneBackTo", { frames: gone.frames, left: left.includes("Offline pages"), ok: gone.drawnAt !== null && !left.includes("Offline pages") });

      /* Another seat; and the view taken away. */
      await inView(page, "alpha", "(region.__kept = 'owner', 1)");
      await go(page, "beta");
      await page.evaluate(() => window.__seat({ kind: "human", id: "u:other", roles: ["owner"] }));
      await page.waitForTimeout(100);
      const seat = await go(page, "alpha");
      const seatKept = await inView(page, "alpha", "region.__kept ?? null");
      await inView(page, "alpha", "(region.__kept = 'other', 1)");
      await go(page, "beta");
      await page.evaluate(() => window.__without(["alpha"]));
      await page.waitForTimeout(100);
      await page.evaluate(() => window.__without([]));
      const again = await go(page, "alpha");
      const viewKept = await inView(page, "alpha", "region.__kept ?? null");
      held("anotherSeatAndAViewTakenAwayNeverStandWithTheDrawingKept", { seatKept, viewKept, ok: seatKept === null && viewKept === null && seat.drawnAt !== null && again.drawnAt !== null });

      /* A view that spins. */
      for (const visit of ["first", "again"]) {
        const failures = await page.evaluate(() => window.__failures.filter((one) => one.name === "spins").length);
        const began = Date.now();
        await page.evaluate((path) => (history.pushState({}, "", path), dispatchEvent(new PopStateEvent("popstate", { state: {} }))), PLACES.spins.path);
        const fell = await page.waitForFunction((was) => window.__failures.filter((one) => one.name === "spins").length > was && document.querySelector("[data-worker-view-fallback]") !== null, failures, { timeout: 10_000 * SLOW }).then(() => true, () => false);
        held("aViewThatSpinsFallsBackWithinItsBudgetEachVisit", { visit, ms: Date.now() - began, ok: fell && Date.now() - began < 5_000 * SLOW });
        await go(page, "beta");
      }
      await context.close();
      before = { ...host.counts.code };

      /* FIRST VISITS: each in a page of its own, from a page that draws none of the views, by the bar. */
      for (const how of ["cold", "idle", "pointer", "press", "keyboard"]) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${label} ${how}: ${error.message}`));
        await page.addInitScript(instrument);
        /* Cold: the person asked to save data, so nothing is fetched ahead. Idleness is let run only where it is measured. */
        await page.addInitScript((how) => {
          if (how === "cold") Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
          if (how !== "idle") window.requestIdleCallback = () => 0;
        }, how);
        await page.goto(`${at("view-return-host")}/problems?${face}`, { waitUntil: "load" });
        const link = page.locator('[data-place-path="/places/alpha-board"]').first();
        await page.waitForSelector('[data-testid="app-places-open"], [data-place-path="/places/alpha-board"]');
        await page.waitForTimeout(1200);
        if (how !== "idle" && !(await link.isVisible())) await page.locator('[data-testid="app-places-open"]').first().click();
        if (how !== "idle") await link.waitFor();
        /* Still, and away from every link: what the place drawn under the pointer would begin is begun by nothing but this. */
        await page.mouse.move(2, 790);
        await page.waitForTimeout(how === "idle" ? 3500 : 1500);
        const code = before;
        const since = () => Object.entries(host.counts.code).flatMap(([name, n]) => (n - (code[name] ?? 0) > 0 ? [[name, n - (code[name] ?? 0)]] : []));
        if (how === "idle") {
          const values = await page.evaluate(() => window.__reads ?? []);
          const codes = idled(host.counts.code, before);
          held("idlenessFetchesTheCodeOfAFewPlacesAndNobodysValues", { values, codes, ok: values.length === 0 && codes.length <= 4 && codes.length > 0 });
          if (!(await link.isVisible())) await page.locator('[data-testid="app-places-open"]').first().click();
          await link.waitFor();
        }
        const box = await link.boundingBox();
        const [x, y] = [box.x + Math.min(30, box.width / 2), box.y + Math.min(12, box.height / 2)];
        const watched = page.evaluate((want) => window.__pressed(want), PLACES.alpha);
        if (how === "pointer" || how === "cold") {
          await page.mouse.move(x, y);
          await page.waitForTimeout(350);
          if (how === "cold") held("aPageAskedToSaveDataFetchesNothingAhead", { fetched: since(), reads: await page.evaluate(() => window.__reads ?? []), ok: since().length === 0 && (await page.evaluate(() => (window.__reads ?? []).length)) === 0 });
          await page.mouse.down();
          await page.mouse.up();
        } else if (how === "press") {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.waitForTimeout(90);
          await page.mouse.up();
        } else if (how === "keyboard") {
          await link.focus();
          await page.waitForTimeout(350);
          await page.keyboard.press("Enter");
        } else {
          await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest("a").click(), [x, y]);
        }
        const first = await watched;
        await page.waitForTimeout(200);
        const blank = first.frames.filter((one) => one.what === "blank").reduce((sum, one) => sum + one.frames, 0);
        report.moves.push({ engine, face, move: `first, ${how}`, place: "alpha", drawnAt: first.drawnAt, blank, frames: first.frames });
        if (MEASURE) process.stdout.write(`${label} first ${how}: ${first.frames.map((one) => `${one.what}@${one.from}(${one.frames})`).join(" ")}\n`);
        if (how === "pointer" || how === "keyboard") held("aFirstVisitComeToByAPointerOrTheKeyboardWaitsForNothingFetched", { how, drawnAt: first.drawnAt, blank, ok: first.drawnAt !== null && first.drawnAt <= FIRST_MS });
        if (how === "press") held("aPressHasTheHeadStartOfItsPointerGoingDown", { drawnAt: first.drawnAt, blank, ok: first.drawnAt !== null && first.drawnAt <= LATE_MS + FIRST_MS - 60 });
        if (how !== "cold" && how !== "idle") held("aViewsCodeAndWhatItKeepsAreAskedOnceForAVisit", { how, code: since().filter(([name]) => name === "alpha"), reads: await page.evaluate(() => window.__reads), ok: since().some(([name, n]) => name === "alpha" && n === 1) && (await page.evaluate(() => window.__reads.filter((one) => one === "alpha").length)) === 1 });
        before = { ...host.counts.code };
        await context.close();
      }
    }
    await browser.close();
    browser = undefined;
  }
} catch (error) {
  report.error = String(error?.stack ?? error);
  process.stdout.write(`${report.error}\n`);
} finally {
  await browser?.close();
  host.stop();
}

const say = (label, list) => ({ held: list, ok: list.length > 0 && list.every((one) => one.ok) });
const returns = report.moves.filter((one) => one.move === "return");
const c = report.checks;
c.goingBackToAVisitedCustomPageShowsNoBlankOrFallbackFrame = say("return", returns.filter((one) => one.place !== "frame").map((one) => ({ ...one, ok: blankless(one.frames) })));
c.goingBackToAFramesPageLoadsItNoMoreWhereTheEngineMovesFramesAndIsDrawnEverywhere = say("frame", returns.filter((one) => one.place === "frame").map((one) => ({ ...one, ok: report.movesFrames[one.engine] ? one.loads === 0 && blankless(one.frames) : one.drawnAt !== null })));
c.aReturnIsDrawnInTime = { budgetMs: RETURN_MS, ...say("time", returns.filter((one) => one.place !== "frame").map((one) => ({ engine: one.engine, face: one.face, place: one.place, drawnAt: one.drawnAt, ok: one.drawnAt !== null && one.drawnAt <= RETURN_MS }))) };
for (const [name, list] of Object.entries(seen)) c[name] = say(name, list);
c.noPageThrew = { errors, ok: errors.length === 0 };
report.passed = !report.error && Object.values(c).every((one) => one.ok);
writeFileSync(resolve(repoRoot, "docs/view-return.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(c)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n${check.ok ? "" : `     ${JSON.stringify((check.held ?? check.errors).filter((one) => one.ok !== true)).slice(0, 1500)}\n`}`);
process.stdout.write("wrote docs/view-return.json\n");
process.exit(report.passed ? 0 : 1);
