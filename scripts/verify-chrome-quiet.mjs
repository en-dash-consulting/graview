#!/usr/bin/env node
/**
 * FEWER PILLS, AND NO NAME CUT OFF (FR-113, FR-117, FR-118).
 *
 * Nick built En Dash Org on Graview Cloud and said it plainly: too many
 * pills, and too much cut-off text, on every face. Cloud measured it on
 * 0.1.12 — the org app with one person and one skill, and Cloud's vendor
 * template with its example data — at a phone's size and a desk's, with
 * two definitions this harness keeps word for word:
 *
 *   a PILL is a visible element under 34 px tall, with a corner radius of
 *   at least half its height and a fill or a border;
 *   CUT OFF is a visible text leaf whose scrollWidth exceeds its
 *   clientWidth under `text-overflow: ellipsis`, `overflow: hidden` or a
 *   line clamp — screen-reader-only text (1 px) left out.
 *
 * Cloud's count missed the place tiles standing in the scene, cut by their
 * geometry rather than by CSS, so this measures that too: a text's own box
 * against every box that clips it (overflow hidden or clip, never a box
 * that scrolls), and an SVG text against its drawing.
 *
 * The two apps are documents, mounted the way Cloud mounts them — the embed
 * on a host's page, built with esbuild from the workspace's sources: the
 * org app (`scripts/fixtures/quiet/org.gdd.json`, mirroring the one Nick
 * made, eight places, a "Skills and levels" lens whose skill cards list
 * their strengths as rows) and Cloud's vendor template (CC0, copied from
 * Graview Cloud's templates with its example data).
 *
 * The four screens Cloud measured, in three engines, at 390×844 and
 * 1280×800, in both schemes:
 *
 *   the org app, desk, Graview face: at most 8 pills (FR-117), nothing cut;
 *   Vendors, desk, Graview face: nothing cut;
 *   Vendors, phone, Pages home: at most 8 pills, nothing cut;
 *   the org app, phone, "Skills and levels": "Lv 3" and "3 of 5" whole on
 *   both faces (FR-113), nothing cut;
 *   every place tile in the org app's scene says its whole name (FR-118);
 *   no card on a status board wears its own column's status (FR-117).
 *
 * And ONE PLACE SAYS HOW MANY PROBLEMS THERE ARE (FR-122). Cloud's vendor
 * template, fresh, breaks three rules, and its Pages home on a phone said
 * so three times above the fold: "3 problems" on the bar, "Problems 3" in
 * the page's tabs, "3 problems — see what is broken" under the headline.
 * Counted here as a person reads them — every visible text above the fold
 * that says the number and is about the problems — on the Pages home and
 * the Graview face, at a phone's size and a desk's: exactly once. The bar's
 * count keeps its accessible name, and the problems it opens are still
 * reached from the keyboard.
 *
 * And ONE APP BAR ON EVERY FACE (FR-131, FR-132). Nick, on a real app: the
 * title and the Scene/Pages toggle were ugly, bloated and broken under a
 * notification — two stacked bars said the app's name, the way into the
 * scene and the state of the rules twice each. On both faces, at a desk and
 * a phone: one bar — one row on a desk, two on a phone, the second the
 * places — one heading naming the app, nothing the bar says said again
 * above the fold, one Find box, the tools one size and named, no control
 * that says "Scene" or "Pages"; and the overview and a list one press on a
 * tab apart, by pointer and by keyboard.
 *
 * And NOTICES FLOAT, AND NEVER MOVE THE PAGE (FR-133). Nick, with an app
 * open in place on a desk: the top "is … broken when there's a
 * notification". The way back ("Take back “Mark done: Could Val lead…”")
 * opened a band of its own under the embed's strip, pushed the page down
 * and cut its sentence off. On the vendor template's Pages face and Graview
 * face, at 390×844 and 1280×800, a change is made, so the way back comes,
 * and the host says a toast with an Undo and a banner. Nothing on the page
 * moves: no layout shift is reported (Chromium's PerformanceObserver), and
 * in every engine the bar, the first heading and the first list item keep
 * their boxes to the pixel. Each notice is in the viewport, at the foot's
 * middle on a phone and its left on a desk (the banner at the top, under
 * the bar), over nothing at the foot and over no other notice, its whole
 * sentence read or wrapped (no text leaf cut, FR-118's measure), said
 * politely, and its act a real button the keyboard reaches without the
 * notice having taken the focus.
 *
 *   node scripts/verify-chrome-quiet.mjs [--engine=chromium|webkit|firefox] [--shots=<dir>] [--quick] [--notices]
 *
 * `--notices` measures only the notices (FR-133), for iterating on them.
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
/** `--shots=<dir>`: each of the four screens, for a person to look at. */
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
/** `--probe`: say every pill and every cut text, not only how many. */
const PROBE = process.argv.includes("--probe");
/** `--notices`: only the notices (FR-133). */
const ONLY_NOTICES = process.argv.includes("--notices");
/** What a notice says here: a sentence as long as a real change's, which must wrap on a phone rather than be cut. */
const LONG_VENDOR = "Could Val lead the Thursday tasting while Sam is away for the fortnight";
const ORG = resolve(repoRoot, "scripts/fixtures/quiet/org.gdd.json");
const ORG_SEED = resolve(repoRoot, "scripts/fixtures/quiet/org.seed.json");
const VENDORS = resolve(repoRoot, "scripts/fixtures/quiet/vendor-shortlist.template.json");
const ORG_PLACES = JSON.parse(readFileSync(ORG, "utf8")).lenses.map((lens) => lens.title);

/** A wide display face every engine here has on macOS, with wide fallbacks: an average letter well over the 7.1 px the marquee was estimated at. */
const WIDE_FONT = '"Arial Black", "Verdana", "DejaVu Sans", sans-serif';
/** Place names nineteen letters long: one line at the estimate's average letter, two in the wide face. */
const EDGE_NAMES = ["Where the work goes", "Who answers to whom", "What the work costs", "The lines held firm", "Strengths by person", "Skills by the level", "Who owns which part", "The handoff runways"];
const DESK = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
/** The most pills Cloud's brief allows on the two screens it named (FR-117). */
const MOST_PILLS = 8;

/** Cloud's four screens: which app, which face, where, at what size. */
const SCREENS = [
  { name: "org-desk-graview", doc: "org", face: "graview", viewport: DESK, pills: MOST_PILLS },
  { name: "vendors-desk-graview", doc: "vendors", face: "graview", viewport: DESK },
  { name: "vendors-phone-pages-home", doc: "vendors", face: "pages", viewport: PHONE, pills: MOST_PILLS },
  { name: "org-phone-skills-and-levels", doc: "org", face: "pages", viewport: PHONE, place: "Skills and levels" },
];

const report = { at: new Date().toISOString(), engines, schemes: SCHEMES, definitions: "pill: visible, under 34 px tall, corner radius ≥ half its height, a fill or a border; cut off: a visible text leaf, scrollWidth > clientWidth under ellipsis, overflow hidden or a line clamp, or its text box past a box that clips it", checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>An app, on a host's page</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}#app{position:relative;height:100vh}</style></head>
<body><main><h1 style="position:absolute;left:-9999px">An app</h1><div id="app"></div></main><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the embed over either document, as Cloud's shell mounts it. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-quiet-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import org from ${JSON.stringify(ORG)};
        import orgSeed from ${JSON.stringify(ORG_SEED)};
        import vendors from ${JSON.stringify(VENDORS)};
        const asked = new URLSearchParams(location.search);
        const isOrg = asked.get("doc") === "org";
        /*
         * In the wide face, the org's places are named at the edge of a line: nineteen
         * letters, one line at an average letter's width and two in a wide face, so a
         * room sized for the average runs short by a line a name.
         */
        const edgeNames = ${JSON.stringify(EDGE_NAMES)};
        const document_ = isOrg && asked.get("font") === "wide" ? { ...org, lenses: org.lenses.map((lens, i) => ({ ...lens, title: edgeNames[i % edgeNames.length] })) } : isOrg ? org : vendors.document;
        const compiled = compileDocumentWithoutCheck(document_, { today: () => "2026-10-02" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const withIds = (seed) => ({ nodes: seed.nodes, edges: seed.edges.map((edge, i) => ({ id: edge.id ?? "e" + i, ...edge })) });
        /* A brand whose body face is a wide display face: what the place tiles are measured in (FR-118). */
        const wide = asked.get("font") === "wide" ? { brand: { ...(compiled.app.brand ?? {}), name: compiled.app.name, typography: { body: ${JSON.stringify(WIDE_FONT)} } } } : {};
        window.__handle = mount(document.getElementById("app"), {
          ...wide,
          app: compiled.app,
          seed: withIds(isOrg ? orgSeed : vendors.seed),
          face: asked.get("face") ?? "graview",
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          principal: { kind: "human", id: "u:owner", roles: ["owner"] },
          label: compiled.app.name,
          heading: asked.get("heading") ? Number(asked.get("heading")) : false,
          height: "100%",
          fonts: false,
          studio: false,
          bar: true,
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
    if (!file.startsWith(out) || !existsSync(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
    response.end(readFileSync(file));
  });
  await new Promise((ready) => host.listen(portFor("quiet-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/**
 * Cloud's two counts, and the geometric one, measured in the page. Runs as
 * one function so every engine measures with the same words.
 */
function measure() {
  const elements = [];
  const walk = (root) => {
    for (const element of root.querySelectorAll("*")) {
      elements.push(element);
      if (element.shadowRoot) walk(element.shadowRoot);
    }
  };
  walk(document);
  const seen = (element) => {
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return false;
    /* Anywhere on the page, scrolled to or not, as a person scrolling it meets it — but not off the page's own sides. */
    if (box.right <= 0 || box.left >= innerWidth) return false;
    if (typeof element.checkVisibility === "function" && !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
    /*
     * NOT WHERE NOTHING CAN REACH IT: wholly outside a box above it that
     * clips (a sheet put away below the frame), or fixed off the screen. A
     * box that scrolls is reachable — a person scrolls to it.
     */
    let reach = box;
    for (let up = element.parentElement ?? element.parentNode?.host; up && up !== document.documentElement; up = up.parentElement ?? up.parentNode?.host) {
      const clip = getComputedStyle(up);
      if (clip.position === "fixed" && (reach.bottom <= 0 || reach.top >= innerHeight)) return false;
      const clipsX = ["hidden", "clip"].includes(clip.overflowX);
      const clipsY = ["hidden", "clip"].includes(clip.overflowY);
      const scrolls = ["auto", "scroll"].includes(clip.overflowX) || ["auto", "scroll"].includes(clip.overflowY);
      if (!clipsX && !clipsY && !scrolls) continue;
      const edge = up.getBoundingClientRect();
      if (edge.width < 1 || edge.height < 1) return false;
      if (clipsX && (reach.right <= edge.left || reach.left >= edge.right)) return false;
      if (clipsY && (reach.bottom <= edge.top || reach.top >= edge.bottom)) return false;
      /* Inside a box that scrolls, what matters from here up is whether the scroller itself can be seen. */
      if (scrolls) reach = edge;
    }
    return true;
  };
  const alpha = (color) => {
    if (!color || color === "transparent") return 0;
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return 1;
    const parts = match[1].split(/[ ,/]+/).filter(Boolean);
    return parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
  };
  const say = (element) => (element.getAttribute("aria-label") || element.textContent || element.getAttribute("title") || element.tagName).trim().replace(/\s+/g, " ").slice(0, 60);
  const pills = [];
  for (const element of elements) {
    if (element instanceof SVGElement || !seen(element)) continue;
    const box = element.getBoundingClientRect();
    if (box.height >= 34) continue;
    const style = getComputedStyle(element);
    const radius = Math.min(...["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"].map((side) => {
      const value = style[side];
      if (value.endsWith("%")) return (Number.parseFloat(value) / 100) * Math.min(box.width, box.height);
      return Number.parseFloat(value) || 0;
    }));
    if (radius < box.height / 2 - 0.5) continue;
    const filled = alpha(style.backgroundColor) > 0 || (style.backgroundImage && style.backgroundImage !== "none");
    const bordered = ["Top", "Right", "Bottom", "Left"].some((side) => Number.parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none" && alpha(style[`border${side}Color`]) > 0);
    if (!filled && !bordered) continue;
    pills.push({ say: say(element), tag: element.tagName.toLowerCase(), part: element.getAttribute("data-graview-part") ?? element.getAttribute("data-testid") ?? "", width: Math.round(box.width), height: Math.round(box.height), at: `${Math.round(box.left)},${Math.round(box.top)}`, ...(element.closest("[data-testid]") ? { in: element.closest("[data-testid]")?.parentElement?.closest("[data-testid]")?.getAttribute("data-testid") } : {}) });
  }
  /* A text leaf: an element with text of its own. */
  const ownText = (element) => [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim() !== "");
  const cut = [];
  for (const element of elements) {
    if (element instanceof SVGElement || !ownText(element) || !seen(element)) continue;
    const box = element.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue;
    const style = getComputedStyle(element);
    const clamped = style.webkitLineClamp && style.webkitLineClamp !== "none";
    const clipping = style.textOverflow === "ellipsis" || style.overflowX === "hidden" || style.overflowX === "clip" || clamped;
    if (!clipping) continue;
    const wide = element.scrollWidth > element.clientWidth + 1;
    const tall = clamped && element.scrollHeight > element.clientHeight + 1;
    if (wide || tall) cut.push({ say: element.textContent.trim().replace(/\s+/g, " ").slice(0, 60), how: wide ? `${element.clientWidth} of ${element.scrollWidth} px` : `clamped, ${element.clientHeight} of ${element.scrollHeight} px`, by: "css" });
  }
  /*
   * CUT BY GEOMETRY: a text's own box against each box above it that clips
   * (overflow hidden or clip — a box that scrolls is not cutting, only
   * holding more) and is not the scene itself, whose edge is where a
   * person pans. SVG text against its drawing.
   */
  const scene = (element) => element.matches?.(".graview-ground, .graview-scene, [data-graview-scene], [data-testid='scene']") || element.getBoundingClientRect().width > innerWidth * 0.6;
  const cutByGeometry = [];
  const range = document.createRange();
  for (const element of elements) {
    if (!ownText(element) || !seen(element)) continue;
    let text = null;
    if (element instanceof SVGElement) {
      if (element.tagName.toLowerCase() !== "text") continue;
      text = element.getBoundingClientRect();
    } else {
      const node = [...element.childNodes].find((one) => one.nodeType === 3 && one.textContent.trim() !== "");
      range.selectNodeContents(node);
      text = range.getBoundingClientRect();
    }
    if (text.width < 1) continue;
    for (let up = element.parentElement ?? element.parentNode?.host; up && up !== document.body; up = up.parentElement ?? up.parentNode?.host) {
      const style = getComputedStyle(up);
      const svgRoot = up.tagName?.toLowerCase() === "svg";
      /* Each axis on its own: an axis that scrolls holds more than it shows, and cuts nothing. */
      const clipsX = svgRoot ? style.overflow !== "visible" : ["hidden", "clip"].includes(style.overflowX);
      const clipsY = svgRoot ? style.overflow !== "visible" : ["hidden", "clip"].includes(style.overflowY);
      if (!clipsX && !clipsY) continue;
      if (scene(up)) break;
      const box = up.getBoundingClientRect();
      const past = Math.max(clipsX ? box.left - text.left : 0, clipsX ? text.right - box.right : 0, clipsY ? box.top - text.top : 0, clipsY ? text.bottom - box.bottom : 0);
      if (past > 2 && text.right > box.left && text.left < box.right && text.bottom > box.top && text.top < box.bottom) {
        cutByGeometry.push({ say: element.textContent.trim().replace(/\s+/g, " ").slice(0, 60), how: `${Math.round(past)} px past ${up.getAttribute("data-graview-part") ?? up.getAttribute("data-testid") ?? up.className?.baseVal ?? up.className ?? up.tagName}`, by: "geometry" });
        break;
      }
    }
  }
  return { pills, cut, cutByGeometry };
}

const host = await buildHost();
const errors = [];
const results = { screens: [], tiles: [], skillRows: [], boards: [], marquees: [], problemCounts: [], problemsByKeyboard: [], notices: [], bars: [], overviewPresses: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const open = async (query, viewport) => {
        const context = await browser.newContext({ viewport, colorScheme: scheme });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${scheme} ${query}: ${error.message}`));
        await page.goto(`${at("quiet-host")}/?${query}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        await page.waitForTimeout(1200);
        return { page, close: () => context.close() };
      };
      /** A place's address on the Pages face, read from its own link on the home. */
      const placePath = async (page, title) =>
        page.evaluate((title) => {
          const links = [...document.querySelectorAll("a[href*='/places/']")];
          /* By the words a person reads on it — not the picture drawn inside a gallery card, which is hidden from them. */
          const said = (one) => [...one.querySelectorAll("span, h2, h3")].some((leaf) => !leaf.closest('[aria-hidden="true"]') && leaf.textContent.trim() === title) || one.textContent.trim() === title;
          const link = links.find(said);
          return link ? new URL(link.getAttribute("href"), location.href).pathname.replace(/^.*(\/places\/)/, "$1") : null;
        }, title);

      /* ---- FR-133: notices float over the page and never move it */
      for (const face of ["pages", "graview"]) {
        for (const viewport of [PHONE, DESK]) {
          const { page, close } = await open(`doc=vendors&face=${face}`, viewport);
          results.notices.push({ engine, scheme, face, viewport: `${viewport.width}×${viewport.height}`, ...(await noticesFloat(page, face, engine, `${face}-${viewport.width}-${scheme}`)) });
          await close();
        }
      }
      if (ONLY_NOTICES) continue;

      /* ---- the four screens Cloud measured */
      for (const screen of SCREENS) {
        let query = `doc=${screen.doc}&face=${screen.face}`;
        if (screen.place) {
          const home = await open(query, screen.viewport);
          const path = await placePath(home.page, screen.place);
          await home.close();
          query += `&path=${encodeURIComponent(path ?? "/")}`;
        }
        const { page, close } = await open(query, screen.viewport);
        /* The screen asked for, and not the home it fell back to: the place's name is its heading. */
        const shown = screen.place ? await page.evaluate((title) => [...document.querySelectorAll("h1, h2")].some((heading) => heading.textContent.trim() === title), screen.place) : true;
        const measured = await page.evaluate(measure);
        if (SHOTS && engine === "chromium") {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `${screen.name}-${scheme}.png`) });
        }
        /* FR-113 on this face: each strength row's badge and progress whole. */
        if (screen.place === "Skills and levels") results.skillRows.push({ engine, scheme, face: "pages", ...(await skillRow(page)) });
        await close();
        results.screens.push({
          engine,
          scheme,
          screen: screen.name,
          shown,
          pills: measured.pills.length,
          most: screen.pills ?? null,
          cut: measured.cut.length + measured.cutByGeometry.length,
          ...(PROBE || measured.cut.length + measured.cutByGeometry.length > 0 ? { cutOff: [...measured.cut, ...measured.cutByGeometry] } : {}),
          ...(PROBE || (screen.pills && measured.pills.length > screen.pills) ? { pillsSeen: measured.pills } : {}),
        });
      }

      /* ---- FR-113 on the Graview face: the skill card's rows, at a phone's width */
      {
        const { page, close } = await open("doc=org&face=graview", PHONE);
        await goToPlace(page, "Skills and levels");
        results.skillRows.push({ engine, scheme, face: "graview", ...(await skillRow(page)) });
        if (SHOTS && engine === "chromium") await page.screenshot({ path: join(SHOTS, `org-phone-skills-and-levels-graview-${scheme}.png`) });
        await close();
      }

      /* ---- FR-118: every place tile in the org app's scene says its whole name */
      for (const viewport of [DESK, PHONE]) {
        const { page, close } = await open("doc=org&face=graview", viewport);
        const tiles = await page.evaluate((places) => {
          const said = [];
          for (const tile of document.querySelectorAll('[data-testid^="drive-in-"] .graview-drive-in-thumb')) {
            const box = tile.getBoundingClientRect();
            if (box.width < 2 || box.height < 2) continue;
            /* On the screen: a tile panned off it says its name when it is panned to. */
            if (box.right <= 0 || box.left >= innerWidth || box.bottom <= 0 || box.top >= innerHeight) continue;
            const label = tile.querySelector(".graview-drive-in-thumb-press")?.getAttribute("aria-label") ?? "";
            const title = label.replace(/^[^:]*:\s*/, "");
            /* What a person can read: a text leaf in the tile that says the whole name, cut by nothing above it. */
            const leaves = [...tile.querySelectorAll("*")].filter((one) => [...one.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()));
            const range = document.createRange();
            const whole = leaves.some((leaf) => {
              if (leaf.textContent.trim() !== title) return false;
              const style = getComputedStyle(leaf);
              if (style.visibility === "hidden" || style.display === "none" || leaf.getBoundingClientRect().width <= 1) return false;
              if (leaf.scrollWidth > leaf.clientWidth + 1 && (style.textOverflow === "ellipsis" || style.overflowX !== "visible")) return false;
              if (leaf.scrollHeight > leaf.clientHeight + 1 && style.webkitLineClamp && style.webkitLineClamp !== "none") return false;
              range.selectNodeContents(leaf);
              const text = range.getBoundingClientRect();
              for (let up = leaf.parentElement; up && up.getBoundingClientRect().width < innerWidth * 0.6; up = up.parentElement) {
                const clip = getComputedStyle(up);
                if (!["hidden", "clip"].includes(clip.overflowX) && !["hidden", "clip"].includes(clip.overflowY)) continue;
                const edge = up.getBoundingClientRect();
                if (text.left < edge.left - 1 || text.right > edge.right + 1 || text.top < edge.top - 1 || text.bottom > edge.bottom + 1) return false;
              }
              /* Drawn at a size a person reads: a line at least 9 px tall on the screen. */
              return text.height >= 9;
            });
            said.push({ title, whole, width: Math.round(box.width) });
          }
          return said;
        }, ORG_PLACES);
        results.tiles.push({ engine, scheme, viewport: `${viewport.width}×${viewport.height}`, tiles });
        await close();
      }

      /*
       * ---- FR-118: a district's names keep to the room the city made for them, in a wide brand face.
       * The room under a signpost is sized before the names are drawn; sized for an average
       * letter, a wider face ran the column past its district into the one below. Each
       * marquee's foot stays inside its own district, and no name stands on another's.
       */
      for (const font of ["", "wide"]) {
        const { page, close } = await open(`doc=org&face=graview${font ? `&font=${font}` : ""}`, DESK);
        await page.evaluate(() => document.fonts?.ready);
        await page.waitForTimeout(600);
        const marquees = await page.evaluate(() => {
          const box = (el) => {
            const b = el.getBoundingClientRect();
            return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
          };
          const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
          const drawn = [...document.querySelectorAll('[data-testid^="drive-in-"]')].filter((el) => el.getBoundingClientRect().height > 2);
          const names = drawn.flatMap((el) => [...el.querySelectorAll(".graview-drive-in-thumb-title")].map((title) => ({ owner: el, title: title.textContent.trim(), box: box(title) })));
          return {
            font: getComputedStyle(drawn[0]?.querySelector(".graview-drive-in-thumb-title") ?? document.body).fontFamily,
            seen: drawn.map((el) => {
              const card = el.closest("[data-graview-view]");
              const marquee = box(el.querySelector(".graview-drive-in-marquee") ?? el);
              const district = card ? box(card) : null;
              const mine = names.filter((name) => name.owner === el);
              return {
                district: el.getAttribute("data-testid"),
                names: mine.length,
                /* The column's foot against its district's: past it is the next district's ground. */
                over: district ? Math.round(marquee.bottom - district.bottom) : null,
                /* Names of this marquee that stand on a name of another one. */
                onAnother: mine.filter((name) => names.some((other) => other.owner !== el && meets(name.box, other.box))).map((name) => name.title),
              };
            }),
          };
        });
        results.marquees.push({ engine, scheme, font: font || "default", ...marquees });
        await close();
      }

      /* ---- FR-117: no card on a status board wears its own column's status */
      for (const face of ["graview", "pages"]) {
        const viewport = DESK;
        let query = `doc=vendors&face=${face}`;
        const first = await open(query, viewport);
        if (face === "pages") {
          const path = await placePath(first.page, "Vendors by status");
          await first.close();
          query += `&path=${encodeURIComponent(path ?? "/")}`;
        }
        const { page, close } = face === "pages" ? await open(query, viewport) : first;
        if (face === "graview") await goToPlace(page, "Vendors by status");
        const worn = await page.evaluate(() => {
          const columns = [...document.querySelectorAll(".graview-columns-column")];
          const said = [];
          for (const column of columns) {
            const heading = column.querySelector(".graview-columns-heading");
            const count = heading?.querySelector(".graview-columns-count")?.textContent ?? "";
            const name = (heading?.textContent ?? "").replace(count, "").trim().toLowerCase();
            for (const badge of column.querySelectorAll(".graview-spec-badge")) {
              const text = badge.textContent.trim().toLowerCase();
              if (text && name && text === name) said.push({ column: name, badge: text });
            }
          }
          return { columns: columns.length, worn: said };
        });
        results.boards.push({ engine, scheme, face, ...worn });
        await close();
      }

      /* ---- FR-122: the number of problems, said once above the fold */
      for (const face of ["pages", "graview"]) {
        for (const viewport of [PHONE, DESK]) {
          const { page, close } = await open(`doc=vendors&face=${face}`, viewport);
          if (SHOTS && engine === "chromium") await page.screenshot({ path: join(SHOTS, `vendors-${face}-${viewport.width}-problems-${scheme}.png`) });
          results.problemCounts.push({ engine, scheme, face, viewport: `${viewport.width}×${viewport.height}`, ...(await page.evaluate(problemCountSaid)) });
          await close();
        }
      }
      /* ---- FR-131: one bar, one heading naming the app, nothing said twice — both faces, a desk and a phone */
      for (const face of ["graview", "pages"]) {
        for (const viewport of [DESK, PHONE]) {
          for (const doc of ["vendors", "org"]) {
            const { page, close } = await open(`doc=${doc}&face=${face}&heading=1`, viewport);
            if (SHOTS) await page.screenshot({ path: join(SHOTS, `bar-${doc}-${face}-${viewport.width}-${scheme}-${engine}.png`) });
            results.bars.push({ engine, scheme, doc, face, viewport: `${viewport.width}×${viewport.height}`, phone: viewport === PHONE, ...(await page.evaluate(theBar)) });
            await close();
          }
        }
      }
      /* ---- FR-132: the overview and a list are one press on a tab apart, from the pointer and the keyboard */
      for (const viewport of [DESK, PHONE]) {
        const { page, close } = await open("doc=vendors&face=pages", viewport);
        results.overviewPresses.push({ engine, scheme, viewport: `${viewport.width}×${viewport.height}`, ...(await overviewAndBack(page)) });
        await close();
      }
      /* ---- FR-122: the bar's count still opens the problems, from the keyboard alone */
      {
        const { page, close } = await open("doc=vendors&face=pages", PHONE);
        results.problemsByKeyboard.push({ engine, scheme, ...(await problemsByKeyboard(page)) });
        await close();
      }
    }
    await browser.close();
    browser = null;
  }

  const screen = (name) => results.screens.filter((one) => one.screen === name);
  report.checks.theOrgAppsDeskGraviewFaceHasAtMostEightPills = { seen: screen("org-desk-graview").map(({ engine, scheme, pills, pillsSeen }) => ({ engine, scheme, pills, ...(pillsSeen ? { pillsSeen } : {}) })), ok: screen("org-desk-graview").every((one) => one.pills <= MOST_PILLS) };
  report.checks.theVendorTemplatesPhonePagesHomeHasAtMostEightPills = { seen: screen("vendors-phone-pages-home").map(({ engine, scheme, pills, pillsSeen }) => ({ engine, scheme, pills, ...(pillsSeen ? { pillsSeen } : {}) })), ok: screen("vendors-phone-pages-home").every((one) => one.pills <= MOST_PILLS) };
  report.checks.noTextIsCutOffOnTheFourScreens = { seen: results.screens.map(({ engine, scheme, screen, shown, pills, cut, cutOff }) => ({ engine, scheme, screen, shown, pills, cut, ...(cutOff ? { cutOff } : {}) })), ok: results.screens.length === engines.length * SCHEMES.length * SCREENS.length && results.screens.every((one) => one.shown && one.cut === 0) };
  report.checks.everyPlaceTileInTheOrgScenesSaysItsWholeName = {
    seen: results.tiles,
    ok: results.tiles.length > 0 && results.tiles.every((one) => (one.viewport.startsWith(`${DESK.width}`) ? one.tiles.length >= ORG_PLACES.length : one.tiles.length > 0) && one.tiles.every((tile) => tile.whole)),
  };
  report.checks.aDistrictsNamesKeepToTheirRoomInAWideBrandFace = {
    seen: results.marquees,
    ok:
      results.marquees.length === engines.length * SCHEMES.length * 2 &&
      results.marquees.every(
        (one) =>
          one.seen.length > 0 &&
          one.seen.reduce((sum, marquee) => sum + marquee.names, 0) >= ORG_PLACES.length &&
          one.seen.every((marquee) => marquee.names > 0 && marquee.over !== null && marquee.over <= 1 && marquee.onAnother.length === 0),
      ),
  };
  report.checks.aSkillRowKeepsItsLevelAndProgressWholeOnBothFaces = { seen: results.skillRows, ok: results.skillRows.length === engines.length * SCHEMES.length * 2 && results.skillRows.every((one) => one.badge === "Lv 3" && one.badgeWhole && one.progress === "3 of 5" && one.progressWhole) };
  report.checks.noBoardCardWearsItsOwnColumnsStatus = { seen: results.boards, ok: results.boards.length > 0 && results.boards.every((one) => one.columns >= 3 && one.worn.length === 0) };
  report.checks.theProblemCountIsSaidOnceAboveTheFold = {
    seen: results.problemCounts,
    ok: results.problemCounts.length === engines.length * SCHEMES.length * 4 && results.problemCounts.every((one) => one.count > 0 && one.said.length === 1),
  };
  report.checks.theBarsProblemCountIsNamedAndOpensFromTheKeyboard = {
    seen: results.problemsByKeyboard,
    ok: results.problemsByKeyboard.length === engines.length * SCHEMES.length && results.problemsByKeyboard.every((one) => one.named && one.reached && one.opened),
  };
  const bar = (one) => one.rows === (one.phone ? 2 : 1) && (!one.phone || one.secondRowIsThePlaces);
  report.checks.atMostOneBarRowOnADeskAndTwoOnAPhone = {
    seen: results.bars.map(({ engine, scheme, doc, face, viewport, rows, secondRowIsThePlaces, bars }) => ({ engine, scheme, doc, face, viewport, rows, secondRowIsThePlaces, bars })),
    ok: results.bars.length === engines.length * SCHEMES.length * 8 && results.bars.every((one) => bar(one) && one.bars === 1 && one.contentUnderTheBar),
  };
  report.checks.oneHeadingNamesTheAppOnBothFaces = {
    seen: results.bars.map(({ engine, scheme, doc, face, viewport, headings, name }) => ({ engine, scheme, doc, face, viewport, name, headings })),
    ok: results.bars.length > 0 && results.bars.every((one) => one.headings.length === 1 && one.headings[0] === one.name),
  };
  report.checks.noTextIsRepeatedBetweenTheBarAndThePage = {
    seen: results.bars.map(({ engine, scheme, doc, face, viewport, repeated, findBoxes }) => ({ engine, scheme, doc, face, viewport, repeated, findBoxes })),
    ok: results.bars.length > 0 && results.bars.every((one) => one.repeated.length === 0 && one.findBoxes === 1),
  };
  report.checks.theBarsToolsAreOneSizeAndNamed = {
    seen: results.bars.map(({ engine, scheme, doc, face, viewport, tools }) => ({ engine, scheme, doc, face, viewport, tools })),
    ok: results.bars.length > 0 && results.bars.every((one) => one.tools.length >= 3 && one.tools.every((tool) => tool.height >= 28 && tool.height <= 32 && tool.named)),
  };
  report.checks.noControlSaysSceneOrPages = {
    seen: results.bars.filter((one) => one.saysSceneOrPages.length > 0).map(({ engine, scheme, doc, face, viewport, saysSceneOrPages }) => ({ engine, scheme, doc, face, viewport, saysSceneOrPages })),
    ok: results.bars.length > 0 && results.bars.every((one) => one.saysSceneOrPages.length === 0),
  };
  report.checks.theOverviewAndAListAreOnePressApart = {
    seen: results.overviewPresses,
    ok: results.overviewPresses.length === engines.length * SCHEMES.length * 2 && results.overviewPresses.every((one) => one.toOverview && one.overviewMarked && one.toList && one.listMarked && one.backToOverview && one.byKeyboard),
  };
  /* FR-133 */
  const notices = results.notices;
  const allNotices = notices.length === engines.length * SCHEMES.length * 4;
  report.checks.aNoticeMovesNothingOnThePage = {
    seen: notices.map(({ engine, scheme, face, viewport, moved, shift, shifted, kept }) => ({ engine, scheme, face, viewport, moved, shift, ...(shifted.length > 0 ? { shifted } : {}), kept })),
    ok: allNotices && notices.every((one) => one.kept.bar === true && one.kept.heading !== false && one.kept.item === true && one.moved <= 0.5 && (one.shift === null || one.shift === 0)),
  };
  report.checks.theWayBackComesOnThePagesFace = {
    seen: notices.filter((one) => one.face === "pages").map(({ engine, scheme, viewport, wayBack }) => ({ engine, scheme, viewport, wayBack })),
    ok: allNotices && notices.filter((one) => one.face === "pages").every((one) => one.wayBack !== null && one.wayBack.fixed && one.wayBack.whole),
  };
  report.checks.aNoticeStandsAtTheFootsMiddleOnAPhoneAndItsLeftOnADesk = {
    seen: notices.map(({ engine, scheme, face, viewport, placed }) => ({ engine, scheme, face, viewport, placed })),
    ok: allNotices && notices.every((one) => one.placed.length >= 2 && one.placed.every((notice) => notice.inView && notice.where === notice.asked)),
  };
  report.checks.noNoticeCoversAnotherOrWhatStandsAtTheFoot = {
    seen: notices.map(({ engine, scheme, face, viewport, covers }) => ({ engine, scheme, face, viewport, covers })),
    ok: allNotices && notices.every((one) => one.covers.length === 0),
  };
  report.checks.aNoticesWholeSentenceIsReadOrWrapped = {
    seen: notices.map(({ engine, scheme, face, viewport, cut, lines }) => ({ engine, scheme, face, viewport, cut, lines })),
    ok: allNotices && notices.every((one) => one.cut.length === 0),
  };
  report.checks.aNoticeIsSaidPolitelyAndItsActIsAButtonTheKeyboardReaches = {
    seen: notices.map(({ engine, scheme, face, viewport, said, act }) => ({ engine, scheme, face, viewport, said, act })),
    ok: allNotices && notices.every((one) => one.said.polite && one.said.wayBack !== false && one.act.button && one.act.focusStayed && one.act.reached),
  };
  if (ONLY_NOTICES) {
    for (const name of Object.keys(report.checks)) if (!/Notice|WayBack/.test(name)) delete report.checks[name];
  }
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  host.stop();
}

/**
 * How many times the page says the number of problems where a person sees
 * it without scrolling (FR-122). The number is the one the bar's Standing
 * says; a text says it when it holds that number, standing alone, and is
 * about the problems — its own words name them, or it is inside the control
 * or link that leads to them.
 */
function problemCountSaid() {
  /* The bar's standing says the number, and names it in words (FR-131). */
  const standing = [...document.querySelectorAll('button[data-testid="standing"]')].find((one) => /\d+ problems?/.test(one.getAttribute("aria-label") ?? ""));
  const count = Number(standing?.getAttribute("aria-label")?.match(/(\d+) problems?/)?.[1] ?? 0);
  const said = [];
  if (count === 0) return { count, said };
  const number = new RegExp(`(^|\\D)${count}(\\D|$)`);
  const shown = (element) => {
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return false;
    if (box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) return false;
    if (typeof element.checkVisibility === "function" && !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    for (let up = element.parentElement; up && up !== document.documentElement; up = up.parentElement) {
      const style = getComputedStyle(up);
      const boxes = ["hidden", "clip", "auto", "scroll"];
      if (!boxes.includes(style.overflowX) && !boxes.includes(style.overflowY)) continue;
      const edge = up.getBoundingClientRect();
      if (box.bottom <= edge.top || box.top >= edge.bottom || box.right <= edge.left || box.left >= edge.right) return false;
    }
    return true;
  };
  const leadsToProblems = 'a[href$="/problems"], a[href*="/problems?"], button[data-testid="standing"]';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    const element = node.parentElement;
    if (!text || !element || !number.test(text) || !shown(element)) continue;
    const leading = element.closest("a, button") ?? element;
    if (/problem/i.test(text) || element.closest(leadsToProblems) !== null) said.push({ text: leading.textContent.trim().replace(/\s+/g, " ").slice(0, 80), where: leading.getAttribute("data-testid") ?? leading.tagName.toLowerCase() });
  }
  return { count, said };
}

/**
 * THE ONE BAR, AS A PERSON SEES IT (FR-131): how many rows it stands in —
 * the distinct tops of the app, the places and the tools — and whether the
 * second, on a phone, is the places; how many bars there are above the
 * face (the app bar, and anything else that is a row of navigation over the
 * content); the headings in the embed; the texts the bar says that the page
 * says again above the fold; how many Find boxes are on the screen; the
 * tools' heights and names; and any control that says "Scene" or "Pages".
 */
function theBar() {
  const root = document.querySelector("[data-graview-embed]");
  const header = root?.querySelector("[data-graview-app-bar]");
  const shown = (element) => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const parts = header ? [".graview-bar-app", ".graview-bar-places", ".graview-bar-tools"].map((selector) => header.querySelector(selector)).filter(shown) : [];
  const tops = [...new Set(parts.map((part) => Math.round(part.getBoundingClientRect().top / 4)))].sort((a, b) => a - b);
  const places = header?.querySelector(".graview-bar-places");
  const secondRowIsThePlaces = tops.length === 2 && shown(places) && Math.round(places.getBoundingClientRect().top / 4) === tops[1];
  /* Rows of navigation over the content that are not the bar: a masthead, a nav of pages, a Find bar of the face's own, the old strip. */
  const others = root ? [...root.querySelectorAll('[data-testid="masthead"], [data-testid="shell-nav"], [data-testid="face-find-bar"], [data-testid="embed-faces"], [data-embed-strip]')].filter(shown) : [];
  const content = root?.querySelector("[data-embed-content]");
  const contentUnderTheBar = Boolean(header && content && Math.abs(content.getBoundingClientRect().top - header.getBoundingClientRect().bottom) <= 1);
  const headings = root ? [...root.querySelectorAll("h1")].filter((one) => !one.closest("[hidden]")).map((one) => one.textContent.trim()) : [];
  const name = header?.querySelector('[data-testid="app-name"]')?.textContent.trim() ?? "";
  /* The bar's own words — the app's name, and a line under it — said again on the screen outside the bar. */
  const said = new Set([name, ...[...(header?.querySelectorAll("[data-testid='app-subtitle']") ?? [])].map((one) => one.textContent.trim())].filter(Boolean));
  const repeated = [];
  const walker = document.createTreeWalker(root ?? document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    const element = node.parentElement;
    if (!text || !element || header?.contains(element) || !said.has(text) || !shown(element)) continue;
    const box = element.getBoundingClientRect();
    if (box.top >= innerHeight || box.bottom <= 0) continue;
    if (element.closest('[aria-hidden="true"]')) continue;
    repeated.push({ text, where: element.closest("[data-testid]")?.getAttribute("data-testid") ?? element.tagName.toLowerCase() });
  }
  /* Find boxes of the app's own — a lens may carry a box for its own words, which is the picture's, not the bar's. */
  const findBoxes = [...document.querySelectorAll('input[type="search"]')].filter((one) => shown(one) && (header?.contains(one) || /^(Find anything|Narrow this list)$/.test(one.getAttribute("aria-label") ?? ""))).length + (shown(header?.querySelector('[data-testid="app-find-open"]')) ? 1 : 0);
  const tools = header ? [...header.querySelectorAll('.graview-bar-tools > *')].flatMap((one) => (one.matches("button, a, input") ? [one] : [...one.querySelectorAll("button, a, input")])).filter(shown).map((one) => ({ name: one.getAttribute("aria-label") ?? one.textContent.trim(), height: Math.round(one.getBoundingClientRect().height), named: Boolean((one.getAttribute("aria-label") ?? "").trim()) })) : [];
  const saysSceneOrPages = root ? [...root.querySelectorAll("button, a, [role=tab], [role=button]")].filter(shown).map((one) => (one.getAttribute("aria-label") ?? one.textContent ?? "").trim()).filter((words) => /\b(scene|pages)\b/i.test(words)) : [];
  return { rows: tops.length, secondRowIsThePlaces, bars: header ? 1 + others.length : others.length, contentUnderTheBar, headings, name, repeated, findBoxes, tools, saysSceneOrPages };
}

/**
 * FROM A LIST TO THE OVERVIEW AND BACK, ONE PRESS EACH (FR-132): the
 * overview's tab draws the scene under the same bar and is marked; a kind's
 * tab draws its list and is marked; the overview's tab again. Then the same
 * by keyboard: Tab to the overview's tab, Enter.
 */
async function overviewAndBack(page) {
  const face = () => page.evaluate(() => document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed"));
  const marked = (key) => page.evaluate((key) => document.querySelector(`[data-testid="app-place-${key}"]`)?.getAttribute("aria-current") === "page", key);
  const tab = (key) => page.locator(`[data-testid="app-place-${key}"]`).first();
  const press = async (key) => {
    const one = tab(key);
    if (!(await one.isVisible().catch(() => false))) {
      await page.locator('[data-testid="app-places-more"]').click();
      await page.waitForTimeout(150);
    }
    await one.click();
    await page.waitForTimeout(1200);
  };
  await press("overview");
  const toOverview = ["scene", "graview"].includes(await face());
  const overviewMarked = await marked("overview");
  await press("kind:vendor");
  const toList = (await face()) === "pages" && (await page.locator("main h2, [data-embed-content] h2").first().textContent().catch(() => "")).trim().toLowerCase() === "vendors";
  const listMarked = await marked("kind:vendor");
  await press("overview");
  const backToOverview = ["scene", "graview"].includes(await face());
  /* By keyboard: from the list, Tab to the overview's tab and press Enter. */
  await press("kind:vendor");
  let byKeyboard = false;
  await page.locator('[data-testid="app-home"]').focus();
  for (let step = 0; step < 20; step++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "app-place-overview")) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1200);
      byKeyboard = ["scene", "graview"].includes(await face());
      break;
    }
  }
  return { toOverview, overviewMarked, toList, listMarked, backToOverview, byKeyboard };
}

/** The bar's Standing: its accessible name says the count, Tab reaches it, and Enter opens the problems it counts. */
async function problemsByKeyboard(page) {
  const named = await page.evaluate(() => {
    const standing = document.querySelector('button[data-testid="standing"]');
    return standing !== null && /\d+ problems?/.test(standing.getAttribute("aria-label") ?? standing.textContent ?? "");
  });
  let reached = false;
  for (let step = 0; step < 60 && !reached; step++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "standing");
  }
  if (reached) await page.keyboard.press("Enter");
  const opened = reached && (await page.waitForSelector('[data-testid="problems"] li', { timeout: 5000 }).then(() => true, () => false));
  return { named, reached, opened };
}

/**
 * NOTICES FLOAT, AND NEVER MOVE THE PAGE (FR-133). The page's boxes before
 * and after a change (which brings the way back, on the Pages face), a toast
 * with an Undo and a banner; the layout shift Chromium reports in between;
 * and each notice: where it stands, what it covers, whether its sentence is
 * whole, whether it was said, and whether its act is a button the keyboard
 * reaches without the focus having moved.
 */
async function noticesFloat(page, face, engine, shot) {
  /*
   * The change first, and the page let settle: what a change does to the
   * page is the change's, not its notice's. The way back it brings is held
   * out of sight while the page is measured, then let come with the toast
   * and the banner — so whatever moves after that is a notice's doing.
   */
  await page.evaluate((name) => {
    window.__handle.store.apply({ name: "add-vendor", args: { name } }, { author: { kind: "human", id: "u:owner", roles: ["owner"] } });
  }, LONG_VENDOR);
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => {
    const dock = document.querySelector('[data-testid="face-undo-dock"]');
    if (dock) {
      window.__dockDisplay = dock.style.display;
      dock.style.display = "none";
    }
    /* The layout shifts from here on, as Chromium reports them; null where the engine reports none. */
    window.__shifts = null;
    try {
      if (PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) {
        window.__shifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            /* What moved, by its test id or its tag: a person reading the verdict needs to know what jumped. */
            const moved = (entry.sources ?? []).map((source) => {
              const node = source.node?.nodeType === 1 ? source.node : source.node?.parentElement;
              const named = node?.closest?.("[data-testid]");
              return `${node?.tagName?.toLowerCase() ?? "?"}${named ? ` in ${named.getAttribute("data-testid")}` : ""}`;
            });
            window.__shifts.push({ value: entry.value, moved });
          }
        }).observe({ type: "layout-shift" });
      }
    } catch {
      window.__shifts = null;
    }
    const shown = (element) => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.height > 1 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
    };
    const content = document.querySelector("[data-embed-content]") ?? document.body;
    const heading = [...content.querySelectorAll("h1, h2, h3, [role=heading]")].find(shown) ?? null;
    const item = [...content.querySelectorAll("li, [role=listitem], [data-graview-view]")].find(shown) ?? null;
    const bar = document.querySelector("[data-graview-app-bar]");
    for (const [name, element] of [["bar", bar], ["heading", heading], ["item", item]]) element?.setAttribute("data-notices-watch", name);
    const field = document.createElement("input");
    field.setAttribute("aria-label", "The host's own field");
    field.setAttribute("data-notices-field", "");
    field.style.cssText = "position:fixed;left:-200px;top:0;width:100px";
    /* First on the page, so Tab goes forward from it into the embed in every engine (Firefox does not wrap back from the end). */
    document.body.insertBefore(field, document.body.firstChild);
    field.focus();
    const boxes = {};
    for (const element of document.querySelectorAll("[data-notices-watch]")) {
      const box = element.getBoundingClientRect();
      boxes[element.getAttribute("data-notices-watch")] = { left: box.left, top: box.top, width: box.width, height: box.height };
    }
    return boxes;
  });
  await page.waitForTimeout(100);
  await page.evaluate((name) => {
    const dock = document.querySelector('[data-testid="face-undo-dock"]');
    if (dock) dock.style.display = window.__dockDisplay;
    window.__handle.notify({ kind: "toast", sentence: `Saved “${name}” to the shortlist, with its quote and its date`, action: { label: "Undo", onSelect: () => {} } });
    window.__handle.notify({ kind: "banner", sentence: "Offline — changes will be sent when you reconnect.", tone: "warn" });
  }, LONG_VENDOR);
  await page.waitForTimeout(700);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, `notices-${engine}-${shot}.png`) });
  }
  const after = await page.evaluate((face) => {
    const boxes = {};
    for (const element of document.querySelectorAll("[data-notices-watch]")) {
      const box = element.getBoundingClientRect();
      boxes[element.getAttribute("data-notices-watch")] = { left: box.left, top: box.top, width: box.width, height: box.height };
    }
    const shift = window.__shifts === null ? null : Math.round(window.__shifts.reduce((sum, one) => sum + one.value, 0) * 10000) / 10000;
    const shifted = window.__shifts === null ? [] : [...new Set(window.__shifts.flatMap((one) => one.moved))];
    const view = { width: document.documentElement.clientWidth, height: innerHeight };
    const anchor = (document.querySelector("[data-embed-content]") ?? document.body).getBoundingClientRect();
    const narrow = Math.min(view.width, anchor.right) - Math.max(0, anchor.left) < 640;
    const middle = (Math.max(0, anchor.left) + Math.min(view.width, anchor.right)) / 2;
    const dock = document.querySelector('[data-testid="face-undo-dock"]');
    const dockShown = dock !== null && dock.getBoundingClientRect().height > 1;
    /* Each notice a person sees: the toast's and the banner's cards, and the way back. */
    const notices = [
      ...[...document.querySelectorAll('[data-testid="notices-toasts"] [data-testid="notice"]')].map((element) => ({ name: "toast", element, at: "foot" })),
      ...[...document.querySelectorAll('[data-testid="notices-banners"] [data-testid="notice"]')].map((element) => ({ name: "banner", element, at: "top" })),
      ...(dockShown ? [{ name: "the way back", element: dock.querySelector('[data-testid="page-undo"]'), at: "foot" }] : []),
    ];
    /* Beside a tall panel at the left of a desk's picture (the seat), "left" is its right edge. */
    const tallAtLeft = [...document.querySelectorAll("[data-graview-foot], [data-testid='companion']")]
      .map((one) => one.getBoundingClientRect())
      .filter((one) => one.height > (anchor.bottom - anchor.top) * 0.4 && one.left <= anchor.left + 20 && one.width > 0)
      .reduce((edge, one) => Math.max(edge, one.right), Math.max(0, anchor.left));
    const placed = notices.map(({ name, element, at }) => {
      const box = element.getBoundingClientRect();
      const center = box.left + box.width / 2;
      const asked = at === "top" ? "top middle" : narrow ? "foot middle" : "foot left";
      const where =
        at === "top"
          ? box.top >= anchor.top - 1 && box.top <= anchor.top + 24 && Math.abs(center - middle) <= 3 ? "top middle" : `at ${Math.round(box.left)},${Math.round(box.top)}`
          : box.bottom > view.height * 0.5 && narrow && Math.abs(center - middle) <= 3
            ? "foot middle"
            : box.bottom > view.height * 0.5 && !narrow && box.left >= tallAtLeft && box.left <= tallAtLeft + 24
              ? "foot left"
              : `at ${Math.round(box.left)},${Math.round(box.top)}`;
      return { name, asked, where, box: { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height) }, inView: box.left >= 0 && box.top >= 0 && box.right <= view.width + 0.5 && box.bottom <= view.height + 0.5 };
    });
    /* What covers what: a notice over another, or over a control at the foot. */
    const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const covers = [];
    const rects = notices.map(({ name, element }) => ({ name, box: element.getBoundingClientRect(), element }));
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (meets(rects[i].box, rects[j].box)) covers.push(`${rects[i].name} over ${rects[j].name}`);
    const standing = [...document.querySelectorAll("[data-graview-foot], [data-testid='companion'], [data-testid='page-ask']")].filter((one) => one !== dock && !dock?.contains(one));
    for (const { name, box, element } of rects) {
      for (const one of standing) {
        if (one.contains(element)) continue;
        const other = one.getBoundingClientRect();
        if (other.width > 0 && other.height > 0 && meets(box, other)) covers.push(`${name} over ${one.getAttribute("data-testid") ?? one.className}`);
      }
    }
    /* FR-118's measure: a text leaf in a notice cut by CSS or by a box that clips it. */
    const cut = [];
    const lines = {};
    const range = document.createRange();
    for (const { name, element } of notices) {
      for (const leaf of [element, ...element.querySelectorAll("*")]) {
        if (![...leaf.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) continue;
        const style = getComputedStyle(leaf);
        const clamped = style.webkitLineClamp && style.webkitLineClamp !== "none";
        const clips = style.textOverflow === "ellipsis" || ["hidden", "clip"].includes(style.overflowX) || clamped;
        if (clips && (leaf.scrollWidth > leaf.clientWidth + 1 || (clamped && leaf.scrollHeight > leaf.clientHeight + 1))) cut.push({ notice: name, say: leaf.textContent.trim().slice(0, 60) });
        range.selectNodeContents(leaf);
        const text = range.getBoundingClientRect();
        for (let up = leaf.parentElement; up && up !== document.body; up = up.parentElement) {
          const clip = getComputedStyle(up);
          if (!["hidden", "clip"].includes(clip.overflowX) && !["hidden", "clip"].includes(clip.overflowY)) continue;
          const edge = up.getBoundingClientRect();
          if (text.left < edge.left - 2 || text.right > edge.right + 2 || text.top < edge.top - 2 || text.bottom > edge.bottom + 2) {
            cut.push({ notice: name, say: leaf.textContent.trim().slice(0, 60), by: "geometry" });
            break;
          }
        }
        if (leaf.textContent.trim().length > 30) lines[name] = Math.round(text.height / Number.parseFloat(style.lineHeight || "20"));
      }
    }
    const toastAct = document.querySelector('[data-testid="notices-toasts"] [data-testid="notice-action"]');
    const polite = document.querySelector('[data-testid="notices-said"]');
    const wayBackSaid = [...document.querySelectorAll('[role="status"]')].some((one) => one.textContent.includes("Take back"));
    const wayBack = dockShown
      ? (() => {
          const button = dock.querySelector('[data-testid="page-undo"]');
          return { fixed: getComputedStyle(dock).position === "fixed", whole: (button?.title ?? "").includes("Take back") && (button?.textContent ?? "").includes("Could Val lead"), text: button?.textContent ?? "" };
        })()
      : null;
    return {
      boxes,
      shift,
      shifted,
      placed,
      covers,
      cut,
      lines,
      wayBack: face === "pages" ? wayBack : undefined,
      said: { polite: polite?.getAttribute("aria-live") === "polite" && polite.textContent.length > 0, wayBack: face === "pages" ? wayBackSaid : null },
      act: { button: toastAct?.tagName === "BUTTON", focusStayed: document.activeElement?.hasAttribute("data-notices-field") === true },
    };
  }, face);
  /* The act, from the keyboard: Tab from the host's field until the toast's Undo has the focus. */
  let reached = false;
  for (let step = 0; step < 80 && !reached; step++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.closest('[data-testid="notices-toasts"]') !== null && document.activeElement?.getAttribute("data-testid") === "notice-action");
  }
  const kept = {};
  let moved = 0;
  for (const name of ["bar", "heading", "item"]) {
    const a = before[name];
    const b = after.boxes[name];
    /* The Graview face draws no heading in its picture: there, a heading not drawn before or after is not one that moved. */
    if (a === undefined && b === undefined && name === "heading" && face === "graview") {
      kept[name] = "none drawn";
      continue;
    }
    kept[name] = a !== undefined && b !== undefined && ["left", "top", "width", "height"].every((side) => Math.abs(a[side] - b[side]) <= 0.5);
    if (a && b) moved = Math.max(moved, ...["left", "top", "width", "height"].map((side) => Math.abs(a[side] - b[side])));
  }
  const { boxes: _boxes, ...rest } = after;
  return { ...rest, kept, moved: Math.round(moved * 100) / 100, act: { ...after.act, reached }, ...(face === "pages" ? {} : { wayBack: undefined }) };
}

/**
 * Goes to a place IN THE SCENE: the bar's tab for a picture opens its page
 * (FR-132), so the scene is sent to the place's stop, `#view=<as>`, the way
 * a link to it does.
 */
async function goToPlace(page, title) {
  const as = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await page.evaluate((as) => {
    window.__handle.setFace("scene");
    window.__handle.setStop(`#view=${as}`);
  }, as);
  // The pointer off the bar, so no tab is drawn hovered in a screenshot.
  await page.mouse.move(2, (page.viewportSize()?.height ?? 800) - 2);
  await page.waitForTimeout(1500);
}

/** The first strength row's badge and progress label, and whether each is drawn whole. */
async function skillRow(page) {
  return page.evaluate(() => {
    const whole = (element) => {
      if (!element) return false;
      const box = element.getBoundingClientRect();
      if (box.width < 2) return false;
      for (let up = element; up && up !== document.body; up = up.parentElement) {
        if (up.scrollWidth > up.clientWidth + 1 && getComputedStyle(up).overflowX !== "visible" && up.contains(element) && up.textContent.length < 80) return false;
      }
      return element.scrollWidth <= element.clientWidth + 1;
    };
    const rows = [...document.querySelectorAll(".graview-spec-badge")].filter((badge) => /^Lv /.test(badge.textContent.trim()));
    const badge = rows[0] ?? null;
    const row = badge?.closest(".graview-spec-row") ?? null;
    const progress = row ? [...row.querySelectorAll(".graview-spec-progress .graview-spec-value")].find((one) => /\d+ of \d+/.test(one.textContent)) ?? null : null;
    return {
      badge: badge?.textContent.trim() ?? null,
      badgeWhole: whole(badge),
      progress: progress?.textContent.trim().match(/\d+ of \d+/)?.[0] ?? null,
      progressWhole: whole(progress),
    };
  });
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/chrome-quiet.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/chrome-quiet.json\n");
process.exit(report.passed ? 0 : 1);
