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
 *   node scripts/verify-chrome-quiet.mjs [--engine=chromium|webkit|firefox] [--shots=<dir>] [--quick]
 */
import { createServer } from "node:http";
import { pressPlace } from "./lib/places.mjs";
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
const ORG = resolve(repoRoot, "scripts/fixtures/quiet/org.gdd.json");
const ORG_SEED = resolve(repoRoot, "scripts/fixtures/quiet/org.seed.json");
const VENDORS = resolve(repoRoot, "scripts/fixtures/quiet/vendor-shortlist.template.json");
const ORG_PLACES = JSON.parse(readFileSync(ORG, "utf8")).lenses.map((lens) => lens.title);

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
        const compiled = compileDocumentWithoutCheck(isOrg ? org : vendors.document, { today: () => "2026-10-02" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const withIds = (seed) => ({ nodes: seed.nodes, edges: seed.edges.map((edge, i) => ({ id: edge.id ?? "e" + i, ...edge })) });
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: withIds(isOrg ? orgSeed : vendors.seed),
          face: asked.get("face") ?? "graview",
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          principal: { kind: "human", id: "u:owner", roles: ["owner"] },
          label: compiled.app.name,
          heading: false,
          height: "100%",
          fonts: false,
          studio: false,
          toggle: true,
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
  const alpha = (colour) => {
    if (!colour || colour === "transparent") return 0;
    const match = colour.match(/rgba?\(([^)]+)\)/);
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
const results = { screens: [], tiles: [], skillRows: [], boards: [] };
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
  report.checks.aSkillRowKeepsItsLevelAndProgressWholeOnBothFaces = { seen: results.skillRows, ok: results.skillRows.length === engines.length * SCHEMES.length * 2 && results.skillRows.every((one) => one.badge === "Lv 3" && one.badgeWhole && one.progress === "3 of 5" && one.progressWhole) };
  report.checks.noBoardCardWearsItsOwnColumnsStatus = { seen: results.boards, ok: results.boards.length > 0 && results.boards.every((one) => one.columns >= 3 && one.worn.length === 0) };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  host.stop();
}

/** Goes to a place on the Graview face the way a person does: by its tab on the bar. Throws if the bar does not name it. */
async function goToPlace(page, title) {
  await pressPlace(page, title);
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
