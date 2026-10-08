#!/usr/bin/env node
/**
 * A SELECTED RECORD IS DRAWN ONCE (FR-141), SAID IN THE DECLARATION'S WORDS
 * (FR-142), AND A DISTRICT'S BOX HOLDS ITS NAME (FR-143).
 *
 * Nick, on 0.1.17, in Graview Cloud's "Farm Bureau POM Workshop": "the main
 * bug i'm talking about is how it's rendered twice". One workshop part,
 * "Ongoing support", and four topics tied to it (`partOf`); at a desk, Down
 * in its district with it selected
 * (`/places/overview#focus=segment:ongoing-support&zoom=1&sel=…`), the
 * record was drawn twice, overlapping, and its ties a third time: the
 * kind's declared page bare behind, its title cut off under the app bar;
 * the framework's record in front saying the goal and the four topics
 * again; the topics' own cards under both. The seat's panel said
 * `Holds 4 of 4 "partOf" — most of them`, and the district's box at the
 * bottom had "WORKSHOP PARTS" half out of its top.
 *
 * The app is a document mounted the way Cloud mounts one — the embed on a
 * host's page that is the app (address routing), built with esbuild from
 * the workspace's sources — modeled on the workshop's
 * (`scripts/fixtures/drawn-once/workshop.gdd.json`): a part's declared card
 * and page each say its goal and list what it covers, a topic's row says
 * its name and why it matters. At 1280, 1440 and 1920 wide, in three
 * engines and both schemes, it asks:
 *
 *   the goal and the summary each appear once in the scene; each topic
 *   once in the record's frame; no heading in the frame stands over
 *   nothing; the frame overlaps no other card, no caption and not the bar;
 *   its title stands below the bar inside the window; the panel says the
 *   relation in its words ("Covers: all 4 topics"), never `partOf` or
 *   "most"; the district's name is inside its box, at the workshop's name
 *   and at a much longer one (whole on hover where it is cut);
 *
 * and, for every kind and every app: the same part with only a declared
 * card is drawn once by the framework's record, and a view of the host's
 * own taller than its box (as a worker view can be) keeps to the box.
 *
 *   node scripts/verify-drawn-once.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
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
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const SCHEMES = QUICK ? ["light"] : ["light", "dark"];
/** `--shots=<dir>`: the reproduction at each width, for a person to look at. */
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const WORKSHOP = resolve(repoRoot, "scripts/fixtures/drawn-once/workshop.gdd.json");
const WORKSHOP_SEED = resolve(repoRoot, "scripts/fixtures/drawn-once/workshop.seed.json");
const SEED = JSON.parse(readFileSync(WORKSHOP_SEED, "utf8"));
const PART = SEED.nodes.find((node) => node.id === "segment:ongoing-support");
const TOPICS = SEED.nodes.filter((node) => node.kind === "topic").map((node) => node.title);
/** Where Nick stood: Down in the part's district, the part selected. */
const STOP = "#focus=segment:ongoing-support&zoom=1&sel=segment:ongoing-support";
const DESKS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 938 },
];
/** A kind's plural far longer than any box holds it in, near the forty letters a document allows. */
const LONG_PLURAL = "Workshop parts and follow-up sessions";

const report = { at: new Date().toISOString(), engines, schemes: SCHEMES, desks: DESKS, checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The workshop</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the page IS the app, as Cloud's shell mounts it. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-drawn-once-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { createElement } from "react";
        import workshop from ${JSON.stringify(WORKSHOP)};
        import seed from ${JSON.stringify(WORKSHOP_SEED)};
        const asked = new URLSearchParams(location.search);
        let document_ = workshop;
        /* "card": the part declares only its card — the framework's record draws it in focus. */
        if (asked.get("slots") === "card") document_ = { ...document_, views: { ...document_.views, segment: { card: document_.views.segment.card } } };
        /* "long": a plural no district's box holds at its own size. */
        if (asked.get("long") === "1") document_ = { ...document_, kinds: { ...document_.kinds, segment: { ...document_.kinds.segment, plural: ${JSON.stringify(LONG_PLURAL)} } } };
        const compiled = compileDocumentWithoutCheck(document_, { today: () => "2026-10-08" });
        if (!compiled.ok) throw new Error("the document did not compile");
        /* "tall": a view of the host's own at the part's record, taller than any box — as a worker view can be. */
        const tall = (props) => createElement("div", { "data-tall-view": "", style: { background: "var(--graview-panel)", border: "1px solid var(--graview-edge)", padding: 12 } },
          createElement("strong", { "data-tall-title": "" }, props.node ? props.node.title : ""),
          ...Array.from({ length: 40 }, (_, i) => createElement("p", { key: i, style: { margin: "6px 0" } }, "A line of a view taller than its box, " + (i + 1))));
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed,
          face: "graview",
          routing: "address",
          principal: { kind: "human", id: "u:owner", roles: ["owner"] },
          label: compiled.app.name,
          heading: 1,
          height: "100dvh",
          fonts: false,
          studio: false,
          ...(asked.get("tall") === "1" ? { views: (_schema, registry) => registry.register("segment", { cardinality: "one", fidelity: "full" }, tall) } : {}),
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
    // Every address that is no script is the one page, as a host whose page is the app answers it.
    response.writeHead(200, { "content-type": script ? "text/javascript" : "text/html" });
    response.end(readFileSync(script ? file : join(out, "index.html")));
  });
  await new Promise((ready) => host.listen(portFor("drawn-once-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/**
 * What the page shows, measured in it: the selected record's frame, every
 * other card, the captions, the bar, the panel's sentences and the
 * district's name. Runs in the page.
 */
function measure({ partId, goal, summary, topics }) {
  const shown = (element) => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return false;
    for (let at = element; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const rect = (element) => {
    const box = element.getBoundingClientRect();
    return { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom) };
  };
  const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  /** Text leaves a person can see, under a root. */
  const leaves = (root) => [...root.querySelectorAll("*")].filter((element) => element.childElementCount === 0 && (element.textContent ?? "").trim().length > 0 && shown(element));
  const count = (root, words) => leaves(root).filter((leaf) => (leaf.textContent ?? "").includes(words)).length;
  const bar = document.querySelector('[data-testid="app-bar"]');
  const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
  const ground = document.querySelector(".graview-ground") ?? document.body;
  const host = document.querySelector(`[data-graview-view="${CSS.escape(partId)}"]`);
  /** The frame: what the host draws, less the kind's tag astride its edge. */
  const frameOf = (one) => [...(one?.children ?? [])].find((child) => !child.classList.contains("graview-kind-tag") && shown(child));
  const frame = frameOf(host);
  const frameBox = frame ? rect(frame) : null;
  const others = [...document.querySelectorAll("[data-graview-view]")]
    .filter((one) => one !== host && Number(one.getAttribute("data-graview-plane")) >= 1)
    .map((one) => ({ id: one.getAttribute("data-graview-view"), frame: frameOf(one) }))
    .filter((one) => one.frame)
    .map((one) => ({ id: one.id, box: rect(one.frame) }));
  const captions = [...document.querySelectorAll("[data-graview-relation]")].filter(shown).map((one) => ({ text: one.textContent.trim(), box: rect(one) }));
  // The frame's title: the first words it shows, which must be the record's own heading.
  const titleLeaf = frame ? leaves(frame).find((leaf) => !leaf.closest(".graview-kind-tag")) : undefined;
  const titleBox = titleLeaf ? rect(titleLeaf) : null;
  const titleHit = titleBox ? document.elementFromPoint((titleBox.left + titleBox.right) / 2, (titleBox.top + titleBox.bottom) / 2) : null;
  // Headings in the frame with nothing under them: a heading whose section holds no other words.
  const headings = frame ? [...frame.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(shown) : [];
  const emptyHeadings = headings
    .filter((heading) => {
      const section = heading.parentElement;
      const rest = section ? (section.textContent ?? "").replace(heading.textContent ?? "", "").trim() : "";
      return rest.length === 0;
    })
    .map((heading) => heading.textContent.trim());
  const saidCovers = frame ? leaves(frame).filter((leaf) => /^covers$/i.test((leaf.textContent ?? "").trim())).length : 0;
  const observations = document.querySelector('[data-testid="observations"]');
  const district = [...document.querySelectorAll("[data-graview-district-name], .graview-kind-face > span, .graview-kind-face > div > span")]
    .filter((one) => /workshop parts/i.test(one.textContent ?? ""))
    .find(shown);
  const face = district?.closest(".graview-kind-face");
  const nameBox = district ? rect(district) : null;
  const faceBox = face ? rect(face) : null;
  const words = district?.firstElementChild ?? district;
  return {
    stop: window.__handle.where().stop,
    frame: frameBox,
    barBottom: Math.round(barBottom),
    window: { width: innerWidth, height: innerHeight },
    goalSaid: count(ground, goal),
    summarySaid: count(ground, summary),
    topicsInFrame: Object.fromEntries(topics.map((topic) => [topic, frame ? count(frame, topic) : 0])),
    emptyHeadings,
    saidCovers,
    overlapped: frameBox ? others.filter((one) => overlaps(frameBox, one.box)).map((one) => one.id) : [],
    captionsUnder: frameBox ? captions.filter((one) => overlaps(frameBox, one.box)).map((one) => one.text) : [],
    overTheBar: frameBox ? frameBox.top < barBottom - 1 : true,
    title: titleLeaf ? (titleLeaf.textContent ?? "").trim() : null,
    titleBox,
    titleSeen: Boolean(titleBox && titleBox.top >= barBottom - 1 && titleBox.bottom <= innerHeight + 1 && titleHit && frame?.contains(titleHit)),
    frameInWindow: Boolean(frameBox && frameBox.top >= barBottom - 1 && frameBox.bottom <= innerHeight + 1),
    observations: observations ? (observations.textContent ?? "").trim() : null,
    district: district
      ? {
          name: (district.textContent ?? "").trim(),
          nameBox,
          faceBox,
          inside: Boolean(faceBox && nameBox && nameBox.left >= faceBox.left - 1 && nameBox.right <= faceBox.right + 1 && nameBox.top >= faceBox.top - 1 && nameBox.bottom <= faceBox.bottom + 1),
          lines: words ? Math.round(words.getBoundingClientRect().height / parseFloat(getComputedStyle(district).lineHeight || "19")) : null,
          whole: district.scrollWidth <= district.clientWidth + 1,
          hover: district.getAttribute("title") ?? null,
        }
      : null,
  };
}

const host = await buildHost();
const errors = [];
const seen = { drawnOnce: [], declaredCardOnly: [], tallView: [], longName: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const open = async (query, viewport) => {
        const context = await browser.newContext({ viewport, colorScheme: scheme });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${scheme} ${query}: ${error.message}`));
        await page.goto(`${at("drawn-once-host")}/places/overview${query ? `?${query}` : ""}${STOP}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await page.waitForFunction((part) => document.querySelector(`[data-graview-view="${CSS.escape(part)}"]`) !== null, PART.id, { timeout: 30_000 });
        await page.waitForTimeout(1800);
        return { page, close: () => context.close() };
      };
      const asks = { partId: PART.id, goal: PART.goal, summary: PART.summary, topics: TOPICS };
      for (const desk of QUICK ? [DESKS[0], DESKS[2]] : DESKS) {
        {
          const { page, close } = await open("", desk);
          const measured = await page.evaluate(measure, asks);
          seen.drawnOnce.push({ engine, scheme, desk: desk.width, ...measured });
          if (SHOTS && engine === engines[0]) {
            mkdirSync(SHOTS, { recursive: true });
            await page.screenshot({ path: join(SHOTS, `${engine}-${scheme}-${desk.width}.png`) });
          }
          await close();
        }
        {
          const { page, close } = await open("slots=card", desk);
          seen.declaredCardOnly.push({ engine, scheme, desk: desk.width, ...(await page.evaluate(measure, asks)) });
          await close();
        }
        {
          const { page, close } = await open("tall=1", desk);
          seen.tallView.push({ engine, scheme, desk: desk.width, ...(await page.evaluate(measure, asks)) });
          await close();
        }
        {
          const { page, close } = await open("long=1", desk);
          const measured = await page.evaluate(measure, asks);
          seen.longName.push({ engine, scheme, desk: desk.width, district: measured.district });
          if (SHOTS && engine === engines[0] && scheme === SCHEMES[0]) await page.screenshot({ path: join(SHOTS, `${engine}-${scheme}-${desk.width}-long-name.png`) });
          await close();
        }
      }
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  host.stop();
}

const desksPer = (QUICK ? 2 : DESKS.length) * SCHEMES.length * engines.length;
const all = (list, held) => list.length === desksPer && list.every(held);
const brief = (list, keys) => list.map((one) => Object.fromEntries([["engine", one.engine], ["scheme", one.scheme], ["desk", one.desk], ...keys.map((key) => [key, one[key]])]));

report.checks.theGoalAndTheSummaryAreSaidOnce = {
  seen: brief(seen.drawnOnce, ["goalSaid", "summarySaid"]),
  ok: all(seen.drawnOnce, (one) => one.goalSaid === 1 && one.summarySaid === 1),
};
report.checks.eachTopicIsListedOnceInTheRecord = {
  seen: brief(seen.drawnOnce, ["topicsInFrame"]),
  ok: all(seen.drawnOnce, (one) => Object.values(one.topicsInFrame).every((times) => times === 1)),
};
report.checks.noHeadingInTheRecordStandsOverNothing = {
  seen: brief(seen.drawnOnce, ["emptyHeadings", "saidCovers"]),
  ok: all(seen.drawnOnce, (one) => one.emptyHeadings.length === 0 && one.saidCovers <= 1),
};
report.checks.theRecordCoversNoOtherCardNoCaptionAndNotTheBar = {
  seen: brief(seen.drawnOnce, ["frame", "overlapped", "captionsUnder", "overTheBar"]),
  ok: all(seen.drawnOnce, (one) => one.frame !== null && one.overlapped.length === 0 && one.captionsUnder.length === 0 && !one.overTheBar),
};
report.checks.theRecordsTitleStandsFirstBelowTheBar = {
  seen: brief(seen.drawnOnce, ["title", "titleBox", "barBottom", "titleSeen", "frameInWindow"]),
  ok: all(seen.drawnOnce, (one) => one.title === PART.title && one.titleSeen && one.frameInWindow),
};
report.checks.thePanelSaysTheRelationInItsWords = {
  seen: brief(seen.drawnOnce, ["observations"]),
  ok: all(seen.drawnOnce, (one) => typeof one.observations === "string" && /covers/i.test(one.observations) && /all 4 topics/.test(one.observations) && !/partOf|most/.test(one.observations)),
};
report.checks.theDistrictsBoxHoldsItsName = {
  seen: brief(seen.drawnOnce, ["district"]),
  ok: all(seen.drawnOnce, (one) => one.district !== null && one.district.inside && one.district.lines === 1),
};
report.checks.aLongerNameStaysInItsBoxAndIsWholeOnHover = {
  seen: seen.longName,
  ok: all(seen.longName, (one) => one.district !== null && one.district.inside && one.district.lines === 1 && (one.district.whole || one.district.hover === LONG_PLURAL)),
};
report.checks.aPartWithOnlyItsCardIsDrawnOnceByTheRecord = {
  seen: brief(seen.declaredCardOnly, ["goalSaid", "summarySaid", "topicsInFrame", "emptyHeadings", "overlapped", "overTheBar", "title"]),
  ok: all(
    seen.declaredCardOnly,
    (one) => one.goalSaid === 1 && one.summarySaid === 1 && Object.values(one.topicsInFrame).every((times) => times === 1) && one.emptyHeadings.length === 0 && one.overlapped.length === 0 && !one.overTheBar && one.title === PART.title,
  ),
};
report.checks.aViewTallerThanItsBoxKeepsToIt = {
  seen: brief(seen.tallView, ["frame", "overlapped", "captionsUnder", "overTheBar", "title", "titleSeen"]),
  ok: all(seen.tallView, (one) => one.frame !== null && one.overlapped.length === 0 && one.captionsUnder.length === 0 && !one.overTheBar && one.title === PART.title && one.titleSeen),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/drawn-once.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/drawn-once.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
