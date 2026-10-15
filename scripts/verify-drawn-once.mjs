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
 * And on a second document mounted the same way (Nick, 2026-10-15: a
 * hospital's systems review and The Beatles' records,
 * `scripts/fixtures/scene-cards/`): a module's card that scrolls says so at
 * the edge there is more past — its bottom edge, not a strip over its last
 * row, and no band across its middle once scrolled; its "+2 more" is a
 * button that opens every finding and closes again, by the keyboard and the
 * pointer; a chosen module's tie keeps its words until the tie or a card at
 * its end is reached, and then says them once, on no card's title; and an
 * album's own view, with the record's card under it, leaves that card whole
 * ("Who made it" and The Beatles' chip in it) in a frame that scrolls once.
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
/* The review (`scripts/fixtures/scene-cards/make.mjs`): a module with ten findings, an album by The Beatles. */
const REVIEW = resolve(repoRoot, "scripts/fixtures/scene-cards/review.gdd.json");
const REVIEW_SEED = resolve(repoRoot, "scripts/fixtures/scene-cards/review.seed.json");
const MODULE = "module:hospital-services";
const FINDINGS_IN_IT = JSON.parse(readFileSync(REVIEW_SEED, "utf8")).edges.filter((edge) => edge.kind === "in" && edge.to === MODULE).length;
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
        import workshopSeed from ${JSON.stringify(WORKSHOP_SEED)};
        import review from ${JSON.stringify(REVIEW)};
        import reviewSeed from ${JSON.stringify(REVIEW_SEED)};
        const asked = new URLSearchParams(location.search);
        /* "review": a hospital's systems review and a shelf of records, where the scene's cards and ties were reported (2026-10-15). */
        const reviewed = asked.get("doc") === "review";
        const seed = reviewed ? reviewSeed : workshopSeed;
        let document_ = reviewed ? review : workshop;
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
          /*
           * "sleeve": an album's own view, drawn as a worker view of one
           * record is (FR-149) — the view, then the record's own card under
           * it, stacked in a grid.
           */
          ...(asked.get("sleeve") === "1"
            ? {
                views: (_schema, registry) => {
                  const before = registry.lookup("album", { cardinality: "one", fidelity: "full" });
                  const sleeve = (props) => createElement("div", { "data-sleeve": "", style: { background: "var(--graview-panel)", border: "1px solid var(--graview-edge)", padding: 12 } },
                    createElement("strong", null, props.node ? props.node.title : ""),
                    ...Array.from({ length: 6 }, (_, i) => createElement("p", { key: i, style: { margin: "6px 0" } }, "Side one, track " + (i + 1))));
                  return registry.register("album", { cardinality: "one", fidelity: "full" }, (props) =>
                    createElement("div", { "data-worker-view-beside": "sleeve", style: { display: "grid", gap: 12, minWidth: 0 } }, createElement(sleeve, props), createElement(before, props)));
                },
              }
            : {}),
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
  // A district whose count is said twice: "4 4 tied".
  const countedTwice = [...document.querySelectorAll(".graview-kind-face")].filter(shown).flatMap((face) => {
    const said = leaves(face).map((leaf) => (leaf.textContent ?? "").trim());
    return said.filter((text) => /^\d+$/.test(text) && said.includes(`${text} tied`)).map((text) => `${text} ${text} tied`);
  });
  return {
    stop: window.__handle.where().stop,
    countedTwice,
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

/**
 * A RECORD'S CARD AT ITS EDGE, where the card scrolls: what is painted over
 * its rows, where its edge says there is more, and whether its heading and
 * its first fact stand clear of each other. Runs in the page.
 */
function cardEdge(id) {
  const panel = document.querySelector(`[data-graview-view="${CSS.escape(id)}"] [data-graview-primitive="panel"]`);
  const scroller = panel?.querySelector(":scope > .graview-scroll");
  if (!panel || !scroller) return null;
  const box = (el) => el.getBoundingClientRect();
  const panelBox = box(panel);
  const scrollerBox = box(scroller);
  const after = getComputedStyle(scroller, "::after").content;
  // What stands above the scroller in the card — its title and its description — must end where the scroller begins.
  const head = [...panel.children].filter((child) => child !== scroller && box(child).height > 0);
  const headBottom = Math.max(0, ...head.map((child) => box(child).bottom));
  const chips = [...scroller.querySelectorAll("[data-graview-pick]")];
  const last = chips[chips.length - 1];
  const lastBox = last ? box(last) : null;
  return {
    overflows: scroller.scrollHeight > scroller.clientHeight + 1,
    above: scroller.hasAttribute("data-graview-more-above"),
    below: scroller.hasAttribute("data-graview-more-below"),
    // A strip painted over the rows: the old fade, stuck to the bottom.
    paintedOverRows: after !== "none" && after !== "normal" && after !== "",
    // Shadows painted in the scroller's own ground, which a scrolled card showed as a band across its middle.
    paintedInGround: getComputedStyle(scroller).backgroundImage !== "none",
    // How far the scroller stops short of the card's own bottom edge.
    edgeGap: Math.round(panelBox.bottom - scrollerBox.bottom),
    headOverScroller: headBottom > scrollerBox.top + 1,
    lastChipWhole: lastBox ? lastBox.bottom <= scrollerBox.bottom + 1 && lastBox.top >= scrollerBox.top - 1 : null,
  };
}

/** "+N more" on a record's card: what it is, what it says, and how many chips its group shows. Runs in the page. */
function moreState(id) {
  const more = document.querySelector(`[data-graview-view="${CSS.escape(id)}"] [data-graview-more]`);
  if (!more) return { found: false };
  const group = more.parentElement;
  return {
    found: true,
    tag: more.tagName.toLowerCase(),
    expanded: more.getAttribute("aria-expanded"),
    controls: more.getAttribute("aria-controls") === group?.id,
    text: (more.textContent ?? "").trim(),
    chips: group ? group.querySelectorAll("[data-graview-pick]").length : 0,
  };
}

/**
 * A CHOSEN RECORD'S TIES AND THEIR WORDS: each set of words shown or not,
 * whether a shown one stands on a card's title (the strip at the top of
 * every card), and the ends of the ties, to reach for. Runs in the page.
 */
function tieWords() {
  const shown = (el) => getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width > 1;
  const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const titles = [...document.querySelectorAll("[data-graview-view]")].flatMap((host) => {
    const frame = [...host.children].find((child) => !child.classList.contains("graview-kind-tag"));
    if (!frame) return [];
    const box = frame.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return [];
    // The words that say the card's title: its first line of text.
    const leaf = [...frame.querySelectorAll("*")].find((el) => el.childElementCount === 0 && (el.textContent ?? "").trim().length > 0 && el.getBoundingClientRect().height > 0);
    const words = leaf ? leaf.getBoundingClientRect() : null;
    return words ? [{ id: host.getAttribute("data-graview-view"), box: { left: words.left, right: words.right, top: words.top, bottom: words.bottom } }] : [];
  });
  const labels = [...document.querySelectorAll("[data-graview-link-said]")].map((el) => {
    const box = el.getBoundingClientRect();
    return { text: (el.textContent ?? "").trim(), shown: shown(el), on: titles.filter((title) => overlaps(box, title.box)).map((title) => title.id) };
  });
  const ends = [...document.querySelectorAll("[data-graview-ties] circle")].map((circle) => {
    const box = circle.getBoundingClientRect();
    return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
  });
  return { labels, ends, lines: document.querySelectorAll("[data-graview-tie]").length };
}

/**
 * A RECORD'S OWN VIEW IN ITS FRAME, with the record's card under it: is
 * the card drawn whole (no scroll of its own, nothing cut), does the frame
 * keep above the relation band, and is the far record's chip in it seen
 * once the frame is scrolled. Runs in the page.
 */
function ownView(id) {
  const host = document.querySelector(`[data-graview-view="${CSS.escape(id)}"]`);
  const body = [...(host?.children ?? [])].find((child) => !child.classList.contains("graview-kind-tag"));
  const panel = body?.querySelector('[data-graview-primitive="panel"]');
  const scroller = panel?.querySelector(":scope > .graview-scroll");
  if (!body || !panel || !scroller) return null;
  const box = (el) => el.getBoundingClientRect();
  const bodyBox = box(body);
  const captions = [...document.querySelectorAll("[data-graview-relation]")].map((el) => box(el)).filter((one) => one.width > 1);
  const chip = panel.querySelector('[data-graview-pick="artist:the-beatles"]');
  const chipBox = chip ? box(chip) : null;
  return {
    panelCut: panel.scrollHeight > panel.clientHeight + 1,
    scrollerCut: scroller.scrollHeight > scroller.clientHeight + 1,
    panelHeight: Math.round(box(panel).height),
    bodyScrolls: body.scrollHeight > body.clientHeight + 1,
    bodyBottom: Math.round(bodyBox.bottom),
    captionTop: captions.length > 0 ? Math.round(Math.min(...captions.map((one) => one.top))) : null,
    chipSeen: Boolean(chipBox && chipBox.top >= bodyBox.top - 1 && chipBox.bottom <= bodyBox.bottom + 1),
  };
}

const host = await buildHost();
const errors = [];
const seen = { drawnOnce: [], declaredCardOnly: [], tallView: [], longName: [], cardEdge: [], more: [], tieWords: [], ownView: [] };
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
      /* The review, at a stop of its own. */
      const openAt = async (query, stop, viewport) => {
        const context = await browser.newContext({ viewport, colorScheme: scheme });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${scheme} ${query}${stop}: ${error.message}`));
        await page.goto(`${at("drawn-once-host")}/places/overview?${query}${stop}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await page.waitForTimeout(1800);
        return { page, close: () => context.close() };
      };
      const asks = { partId: PART.id, goal: PART.goal, summary: PART.summary, topics: TOPICS };
      for (const desk of QUICK ? [DESKS[0], DESKS[2]] : DESKS) {
        {
          const { page, close } = await open("", desk);
          const measured = await page.evaluate(measure, asks);
          /*
           * THE PANEL'S SENTENCES ARE THE CONTEXT MENU'S NOW: the scene's
           * selection draws no strip beside the picture (the seat floats at
           * the foot), so what is true about the record is read where it is
           * said — in the menu a right-click on the record opens.
           */
          if (measured.observations === null) {
            // The keyboard's right-click: the acts key on the record's own card.
            const focused = await page.evaluate((id) => {
              const card = document.querySelector(`[data-graview-view="${CSS.escape(id)}"]`);
              card?.focus({ preventScroll: true });
              return document.activeElement === card;
            }, PART.id);
            if (focused) {
              await page.keyboard.press("a");
              await page.waitForTimeout(600);
              measured.observations = await page.evaluate(() => document.querySelector('[data-testid="context-menu"] [data-testid="observations"]')?.textContent?.trim() ?? null);
              await page.keyboard.press("Escape");
              await page.waitForTimeout(200);
            }
          }
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
        /* ── the review: a card's edge, "+N more", a tie's words, a record's own view ── */
        const shot = async (page, name) => {
          if (SHOTS && engine === engines[0]) await page.screenshot({ path: join(SHOTS, `${engine}-${scheme}-${desk.width}-${name}.png`) });
        };
        {
          const { page, close } = await openAt("doc=review", `#focus=${MODULE}`, desk);
          const at = { engine, scheme, desk: desk.width };
          const top = await page.evaluate(cardEdge, MODULE);
          await shot(page, "card-edge");
          await page.evaluate((id) => {
            const scroller = document.querySelector(`[data-graview-view="${CSS.escape(id)}"] [data-graview-primitive="panel"] > .graview-scroll`);
            if (scroller) scroller.scrollTop = Math.round((scroller.scrollHeight - scroller.clientHeight) / 2);
          }, MODULE);
          await page.waitForTimeout(300);
          const middle = await page.evaluate(cardEdge, MODULE);
          await page.evaluate((id) => {
            const scroller = document.querySelector(`[data-graview-view="${CSS.escape(id)}"] [data-graview-primitive="panel"] > .graview-scroll`);
            if (scroller) scroller.scrollTop = scroller.scrollHeight;
          }, MODULE);
          await page.waitForTimeout(300);
          const end = await page.evaluate(cardEdge, MODULE);
          await shot(page, "card-edge-scrolled");
          seen.cardEdge.push({ ...at, top, middle, end });
          /* "+N more": a button, opened by the keyboard, closed again, and opened by the pointer. */
          const more = page.locator(`[data-graview-view="${MODULE}"] [data-graview-more]`).first();
          const moreAt = () => page.evaluate(moreState, MODULE);
          const closed = await moreAt();
          let opened = null;
          let closedAgain = null;
          let pressed = null;
          if (closed.found) {
            await more.focus();
            await page.keyboard.press("Enter");
            await page.waitForTimeout(300);
            opened = await moreAt();
            await shot(page, "more-open");
            await page.keyboard.press("Enter");
            await page.waitForTimeout(300);
            closedAgain = await moreAt();
            await more.click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(300);
            pressed = await moreAt();
          }
          seen.more.push({ ...at, closed, opened, closedAgain, pressed });
          await close();
        }
        {
          /* A module chosen in its district gone into: its tie to the findings, whose words wait. */
          const { page, close } = await openAt("doc=review", `#focus=aggregate:module&zoom=1&sel=${MODULE}`, desk);
          const rest = await page.evaluate(tieWords);
          await shot(page, "tie-at-rest");
          let reached = null;
          if (rest.ends.length > 0) {
            const [x, y] = rest.ends[0];
            await page.mouse.move(x, y);
            await page.waitForTimeout(400);
            reached = await page.evaluate(tieWords);
            await shot(page, "tie-reached");
          }
          await page.mouse.move(2, Math.round(desk.height / 2));
          await page.waitForTimeout(400);
          const left = await page.evaluate(tieWords);
          seen.tieWords.push({ engine, scheme, desk: desk.width, rest, reached, left });
          await close();
        }
        {
          const { page, close } = await openAt("doc=review&sleeve=1", "#focus=album:beatles-for-sale", desk);
          const before = await page.evaluate(ownView, "album:beatles-for-sale");
          await shot(page, "own-view");
          await page.evaluate((id) => {
            const host = document.querySelector(`[data-graview-view="${CSS.escape(id)}"]`);
            const body = [...(host?.children ?? [])].find((child) => !child.classList.contains("graview-kind-tag"));
            if (body) body.scrollTop = body.scrollHeight;
          }, "album:beatles-for-sale");
          await page.waitForTimeout(300);
          const scrolled = await page.evaluate(ownView, "album:beatles-for-sale");
          await shot(page, "own-view-scrolled");
          seen.ownView.push({ engine, scheme, desk: desk.width, before, scrolled });
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
report.checks.aDistrictSaysItsCountOnce = {
  seen: brief(seen.drawnOnce, ["countedTwice"]),
  ok: all(seen.drawnOnce, (one) => one.countedTwice.length === 0),
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
/*
 * THE REVIEW (Nick, 2026-10-15, on Graview Cloud). A module's card cut its
 * last row of findings under a fade and drew a dark band across its middle
 * once scrolled; "+2 more" did nothing; every tie said its words over the
 * cards; and an album's own view left the record's card under it cut to a
 * sliver after "Made by".
 */
report.checks.aCardsEdgeSaysThereIsMoreWithoutCoveringARow = {
  seen: seen.cardEdge,
  ok: all(seen.cardEdge, (one) => {
    const states = [one.top, one.middle, one.end];
    if (states.some((state) => state === null)) return false;
    return (
      one.top.overflows &&
      one.top.below &&
      !one.top.above &&
      one.middle.above &&
      one.end.above &&
      !one.end.below &&
      one.end.lastChipWhole === true &&
      states.every((state) => !state.paintedOverRows && !state.paintedInGround && !state.headOverScroller && Math.abs(state.edgeGap) <= 1)
    );
  }),
};
report.checks.moreOnACardIsAButtonThatOpensEveryChipAndClosesAgain = {
  seen: seen.more,
  ok: all(
    seen.more,
    (one) =>
      one.closed.found &&
      one.closed.tag === "button" &&
      one.closed.expanded === "false" &&
      one.closed.controls &&
      one.closed.text === `+${FINDINGS_IN_IT - 8} more` &&
      one.closed.chips === 8 &&
      one.opened?.expanded === "true" &&
      one.opened.chips === FINDINGS_IN_IT &&
      one.closedAgain?.expanded === "false" &&
      one.closedAgain.chips === 8 &&
      one.pressed?.expanded === "true" &&
      one.pressed.chips === FINDINGS_IN_IT,
  ),
};
report.checks.aTiesWordsWaitUntilItIsReachedAndStandOnNoTitle = {
  seen: seen.tieWords,
  ok: all(seen.tieWords, (one) => {
    const said = (state) => state.labels.map((label) => label.text);
    return (
      one.rest.lines > 0 &&
      one.rest.labels.length > 0 &&
      one.rest.labels.every((label) => !label.shown) &&
      one.reached !== null &&
      one.reached.labels.some((label) => label.shown) &&
      one.reached.labels.every((label) => !label.shown || label.on.length === 0) &&
      new Set(said(one.reached)).size === said(one.reached).length &&
      one.left.labels.every((label) => !label.shown)
    );
  }),
};
report.checks.aRecordsOwnViewLeavesTheRecordUnderItWhole = {
  seen: seen.ownView,
  ok: all(
    seen.ownView,
    (one) =>
      one.before !== null &&
      one.scrolled !== null &&
      !one.before.panelCut &&
      !one.before.scrollerCut &&
      one.scrolled.chipSeen &&
      (one.before.captionTop === null || one.before.bodyBottom <= one.before.captionTop),
  ),
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
