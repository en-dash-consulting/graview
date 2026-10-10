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
 * And ONE APP BAR ON EVERY FACE (FR-131). Nick, on a real app: the title
 * and the Scene/Pages toggle were ugly, bloated and broken under a
 * notification — two stacked bars said the app's name, the way into the
 * scene and the state of the rules twice each. On both faces, at a desk and
 * a phone: one bar of one row, one heading naming the app, nothing the bar
 * says said again above the fold, one Find box, the tools one size and
 * named.
 *
 * And THE SCENE AND THE PAGES ARE TWO THINGS, AND THE PLACES ARE OUT OF THE
 * BAR (FR-137, FR-138, FR-136). Nick on 0.1.16, at a desk: "the new nav
 * kinda sucks, and i don't see a way to go to the scene vs pages anymore".
 * FR-132 had made the scene "Overview", one of the places laid along the
 * bar as tabs, and on Cloud's workshop app — two pictures named in
 * sentences ("What the workshop covers", "Email to Todd") beside three
 * kinds' lists — the tabs filled the bar's top edge and wrapped to a second
 * row. The claim that was to catch that, "at most one bar row on a desk",
 * measured the wrong boxes on the wrong app: it counted the distinct tops
 * of the bar's three regions (the app, the places, the tools), and a tab
 * that wraps inside the places' region moves no region's top — the region
 * only grows downward — and it ran on the org app and the vendor template
 * at 1280 px, whose short place names fit. So this measures every control
 * on the bar by its own box — the lines their middles stand on, how far
 * each stands from the bar's top edge, the bar's height — on a document
 * shaped like Cloud's (`scripts/fixtures/desk-bar/workshop.gdd.json`) and
 * on the same with thirty places, at 1000, 1024, 1280 (also at twice the
 * pixels) and 1440 px and on a phone: one row of at most 48 px, every
 * control on its middle line and none at the top edge; right after the
 * app's name a switch that says Scene and Pages and marks the one drawn,
 * reached from the keyboard; on Pages the place you are on as one control
 * — on a phone, the page's first line — whose list holds every place, each
 * two presses away by pointer and by keyboard, Escape giving the keyboard
 * back to the control; nothing calling the scene "the overview"; a
 * picture's page that does not repeat the places; and an app with a home
 * view opening on it, full width under the bar, not over the scene.
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
 * And THE SCENE HAS ITS PLACES IN THE BAR, AND THE PLACES STAND ON THE ROW
 * WHEN THERE IS ROOM (FR-144, FR-145). Nick on 0.1.17: "is there a way to
 * have a subnav on Scene like how there is for Pages … Might also be nice
 * to have some of them available with a More dropdown when screen real
 * estate allows". On Cloud's workshop, on both faces, at 1920, 1440, 1280,
 * 1024 and 390 px and in 480, 640 and 900 px boxes: one row of at most
 * 48 px, every control on its middle line, the place you are on said on
 * the row (or the phone's first line); four or more places standing at
 * 1920 on Pages, fewer at 1280, the one control at 390; the same after the
 * window is narrowed and widened again; every place reached in two presses
 * by pointer and keyboard (`pressPlace`, the recipe a host's harness
 * uses); and on the scene, a picture chosen from the bar moves the scene's
 * `in.view` and says it.
 *
 * And THE SCENE'S FIRST FRAME STANDS IN ITS BOX: the org app's city in a
 * 480 and a 640 px box, watched from the moment the address is asked for,
 * never draws a district past the box's edge (it used to fly in from a
 * desk's width).
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
import { arrangeByKeyboard, endClearsTheFoot, FIRST_RECORD_WITHIN, listHead } from "./lib/arranging-line.mjs";

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
/** `--boxes`: only the bar in boxes on a desk (the bar fits its box). */
const ONLY_BOXES = process.argv.includes("--boxes");
/** `--picks`: only a pick made the moment the place list opens (FR-140). */
const ONLY_PICKS = process.argv.includes("--picks");
/** `--standing`: only the places in the bar on both faces (FR-144, FR-145). */
const ONLY_STANDING = process.argv.includes("--standing");
/** What a notice says here: a sentence as long as a real change's, which must wrap on a phone rather than be cut. */
const LONG_VENDOR = "Could Val lead the Thursday tasting while Sam is away for the fortnight";
const ORG = resolve(repoRoot, "scripts/fixtures/quiet/org.gdd.json");
const ORG_SEED = resolve(repoRoot, "scripts/fixtures/quiet/org.seed.json");
const VENDORS = resolve(repoRoot, "scripts/fixtures/quiet/vendor-shortlist.template.json");
const ORG_PLACES = JSON.parse(readFileSync(ORG, "utf8")).lenses.map((lens) => lens.title);
/* Cloud's workshop app (FR-137, FR-138): three kinds and two pictures named in sentences. */
const WORKSHOP = resolve(repoRoot, "scripts/fixtures/desk-bar/workshop.gdd.json");
const WORKSHOP_SEED = resolve(repoRoot, "scripts/fixtures/desk-bar/workshop.seed.json");
/* The desk widths the bar is measured at: below, at and above the width Cloud's bar wrapped at. */
const DESKS = (QUICK ? [1024, 1280] : [1000, 1024, 1280, 1440]).map((width) => ({ width, height: 800 }));
/* The longest a bar may be, its rule included (FR-138). */
const BAR_MOST = 48;
/*
 * THE BAR FITS ITS BOX. graview.dev's landing page gives the garden a box
 * about 650 px wide on a 1440 desk, and on 0.1.17 the bar laid itself out
 * as a desk's: the app's name crushed to a letter a line down the side and
 * over the page under it, the place cut to "W… ▾", Find holding the room.
 * The boxes it is measured in, on a 1440 desk; then whole pages.
 */
const BOX_DESK = { width: 1440, height: 800 };
const BOXES = QUICK ? [360, 480, 640, 720] : [360, 480, 560, 640, 720, 900];
const BOX_PAGES = QUICK ? [390, 1440] : [390, 1024, 1280, 1440];
/* The names it is measured with: Cloud's workshop's four words, and one. */
const LONG_NAME = "Farm Bureau POM Workshop";
const SHORT_NAME = "Seedbed";
/* The boxes the one-word name is measured in too: those between a phone's bar and a desk's. */
const SHORT_BOXES = [480, 640, 720];
/* The fewest letters of the place's name the control shows, when the name is longer. */
const PLACE_LETTERS = 10;
/* Below this width of its own the bar is a phone's (`BAR_PHONE`): the place is the page's first line. */
const BAR_PHONE_WIDTH = 640;
/* Down to this box the bar is one row of at most 48 px. */
const ONE_ROW_FROM = 480;
/* FR-144, FR-145: the whole pages and the boxes (on a 1440 desk) the places in the bar are measured at, on both faces. */
const STANDING_PAGES = QUICK ? [1920, 1280, 390] : [1920, 1440, 1280, 1024, 390];
const STANDING_BOXES = QUICK ? [480, 900] : [480, 640, 900];
/* FR-140: the fresh pages a pick is made on at once, two picks each. */
const PICK_PAGES = 10;

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
<body><main><h1 style="position:absolute;left:-9999px">An app</h1><div id="app"></div><p data-host-under="">The host's page goes on under the box.</p></main><script type="module" src="/entry.js"></script></body></html>`;

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
        import workshop from ${JSON.stringify(WORKSHOP)};
        import workshopSeed from ${JSON.stringify(WORKSHOP_SEED)};
        const asked = new URLSearchParams(location.search);
        const isOrg = asked.get("doc") === "org";
        const isWorkshop = asked.get("doc") === "workshop";
        /*
         * Cloud's workshop — its home, three lists, two pictures and how the kinds connect — and the same with thirty places: twenty-three more pictures, each named in a
         * sentence; with "home=1", a home view of its own, as the one a chat wrote (FR-136).
         */
        const kinds = ["date", "decision", "deliverable"];
        let shop = workshop;
        if (asked.get("many") === "1") shop = { ...shop, lenses: [...shop.lenses, ...Array.from({ length: 23 }, (_, i) => ({ name: "blocks", title: "What the room said about the " + ["budget", "county", "pilot", "board", "season"][i % 5] + ", part " + (i + 1), on: kinds[i % 3], options: { blocks: [{ list: "all('" + kinds[i % 3] + "')", as: "row" }] } }))] };
        if (asked.get("home") === "1") shop = { ...shop, views: { ...shop.views, home: [{ headline: "This week at the workshop" }, { list: "all('deliverable')", as: "row" }] } };
        /*
         * In the wide face, the org's places are named at the edge of a line: nineteen
         * letters, one line at an average letter's width and two in a wide face, so a
         * room sized for the average runs short by a line a name.
         */
        const edgeNames = ${JSON.stringify(EDGE_NAMES)};
        let document_ = isWorkshop ? shop : isOrg && asked.get("font") === "wide" ? { ...org, lenses: org.lenses.map((lens, i) => ({ ...lens, title: edgeNames[i % edgeNames.length] })) } : isOrg ? org : vendors.document;
        /* The app under another name: a one-word name, or one long enough to give (the bar fits its box). */
        if (asked.get("name")) document_ = { ...document_, name: asked.get("name") };
        /* A box on the host's page, as graview.dev's landing page gives the garden: so wide, on a desk however wide. */
        if (asked.get("box")) document.getElementById("app").style.cssText = "position:relative;width:" + Number(asked.get("box")) + "px;height:560px;margin:24px auto 0";
        const compiled = compileDocumentWithoutCheck(document_, { today: () => "2026-10-02" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const withIds = (seed) => ({ nodes: seed.nodes, edges: seed.edges.map((edge, i) => ({ id: edge.id ?? "e" + i, ...edge })) });
        /* A brand whose body face is a wide display face: what the place tiles are measured in (FR-118). */
        const wide = asked.get("font") === "wide" ? { brand: { ...(compiled.app.brand ?? {}), name: compiled.app.name, typography: { body: ${JSON.stringify(WIDE_FONT)} } } } : {};
        window.__handle = mount(document.getElementById("app"), {
          ...wide,
          app: compiled.app,
          seed: withIds(isWorkshop ? workshopSeed : isOrg ? orgSeed : vendors.seed),
          /* "none": the face is the app's to choose — its home view, else the scene (FR-136). */
          ...(asked.get("face") === "none" ? {} : { face: asked.get("face") ?? "graview" }),
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          principal: { kind: "human", id: "u:owner", roles: ["owner"] },
          label: compiled.app.name,
          heading: asked.get("heading") ? Number(asked.get("heading")) : false,
          height: "100%",
          fonts: false,
          studio: false,
          bar: true,
          ...(asked.get("switch") ? { switch: asked.get("switch") } : {}),
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

/* The bar's measures, defined in every page the harness opens, for `theBar` and `theRow` to share. */
const BAR_HELPERS = `${[barControls, linesOf, theSwitch, saysOverview, placesSaid].map(String).join("\n")}\nObject.assign(window, { barControls, linesOf, theSwitch, saysOverview, placesSaid });`;
const host = await buildHost();
const errors = [];
const results = { standing: [], standingResized: [], standingPresses: [], heldAcross: [], quickPicks: [], boxes: [], boxSwitches: [], firstFrames: [], screens: [], tiles: [], skillRows: [], boards: [], marquees: [], problemCounts: [], problemsByKeyboard: [], notices: [], bars: [], switchPresses: [], deskBars: [], twoPresses: [], repeats: [], homes: [], workshopLists: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const open = async (query, viewport, extra = {}) => {
        const context = await browser.newContext({ viewport, colorScheme: scheme, ...extra });
        await context.addInitScript({ content: BAR_HELPERS });
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

      /*
       * ---- FR-140: the place list is ready when it opens. From the scene on a desk: Pages, the list, an entry, with no
       * pause between them — on a fresh page, while the routed face is still being fetched; then Scene and the same again,
       * which once handed the pick to the router of the last time Pages was drawn. Ten pages, twenty picks, in the first scheme.
       */
      /*
       * ---- FR-144, FR-145: the places in the bar, on both faces, at whole pages and in boxes; the same after a resize;
       * every place in two presses, and on the scene a picture from the bar moves `in.view`.
       */
      if (!ONLY_NOTICES && !ONLY_BOXES && !ONLY_PICKS) {
        const sizes = [...STANDING_PAGES.map((width) => ({ box: 0, viewport: width < 640 ? PHONE : { width, height: 800 } })), ...STANDING_BOXES.map((box) => ({ box, viewport: BOX_DESK }))];
        for (const face of ["pages", "graview"]) {
          const query = `doc=workshop&face=${face}&heading=1${face === "pages" ? `&path=${encodeURIComponent("/places/email-to-todd")}` : ""}`;
          for (const { box, viewport } of sizes) {
            const { page, close } = await open(`${query}${box ? `&box=${box}` : ""}`, viewport);
            const where = box ? `a ${box} px box` : `a ${viewport.width} px page`;
            const name = `${face === "pages" ? "pages" : "scene"}-${box ? `box${box}` : viewport.width}-${scheme}-${engine}`;
            if (SHOTS && (engine === "chromium" || engine === "webkit")) await page.screenshot({ path: join(SHOTS, `standing-${name}.png`), clip: { x: 0, y: 0, width: viewport.width, height: box ? 240 : 160 } });
            results.standing.push({ engine, scheme, face, box, width: viewport.width, where, ...(await page.evaluate(theRow)) });
            /* Every place, two presses each, by pointer and keyboard: at the widest page and a phone on both faces, and at 1024 on the scene, where its pictures fold. */
            if (!box && (viewport.width === 1920 || viewport === PHONE || (face === "graview" && viewport.width === 1024))) {
              const shot = SHOTS && (engine === "chromium" || engine === "webkit") ? join(SHOTS, `standing-${name}-list-open.png`) : null;
              /* FR-158: an entry held from before the list opened is the one pressed after it, at once. */
              results.heldAcross.push({ engine, scheme, face, where, ...(await heldAcrossTheOpen(page)) });
              results.standingPresses.push({ engine, scheme, face, where, places: face === "pages" ? 7 : 3, ...(await everyPlaceInTwoPresses(page, shot, face !== "pages")) });
            }
            await close();
          }
          /*
           * FR-158, as Cloud met it: the scene reached by the switch from Pages, its places opened at once and the
           * held entry pressed — on a phone and at 1024, where the scene's pictures fold into More.
           */
          if (face === "graview") {
            for (const viewport of [PHONE, { width: 1024, height: 800 }]) {
              const { page, close } = await open(`doc=workshop&face=pages&heading=1`, viewport);
              await page.locator('[data-testid="app-face-scene"]').click();
              await page.waitForFunction(() => document.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed") === "true", null, { timeout: 10_000 });
              results.heldAcross.push({ engine, scheme, face: "scene, from pages", where: `a ${viewport.width} px page`, ...(await heldAcrossTheOpen(page)) });
              await close();
            }
          }
          /* Narrowed and widened again: the row is the row a fresh page draws at each width. */
          if (!QUICK || face === "pages") {
            const { page, close } = await open(query, { width: 1920, height: 800 });
            const seen = [];
            for (const width of [1920, 1024, 1280, 1920]) {
              await page.setViewportSize({ width, height: 800 });
              await page.waitForTimeout(400);
              seen.push({ width, ...(await page.evaluate(theRow)) });
            }
            results.standingResized.push({ engine, scheme, face, seen });
            await close();
          }
        }
      }
      /*
       * ---- A LIST ARRANGES ON ONE QUIET LINE: Cloud's workshop's deliverables, as Cloud mounts them, at a desk and on a
       * phone — the first record near the top, the count said once on the line, no select; arranged by the address, every
       * way to arrange from the keyboard.
       */
      if (!ONLY_NOTICES && !ONLY_BOXES && !ONLY_PICKS && !ONLY_STANDING) {
        for (const viewport of [{ width: 1440, height: 900 }, PHONE]) {
          const { page, close } = await open(`doc=workshop&face=pages&heading=1&path=${encodeURIComponent("/deliverables")}`, viewport);
          const head = { ...(await listHead(page)), end: await endClearsTheFoot(page) };
          await close();
          // Arranged by its address (two deliverables are read, not arranged, until an address asks).
          let keys = null;
          if (viewport.width >= 1000) {
            const sorted = await open(`doc=workshop&face=pages&heading=1&path=${encodeURIComponent("/deliverables?sort=label")}`, viewport);
            keys = await arrangeByKeyboard(sorted.page, "arrange");
            await sorted.close();
          }
          results.workshopLists.push({ engine, scheme, width: viewport.width, ...head, ...(keys ? { keys } : {}) });
        }
      }
      if (ONLY_STANDING) continue;

      if (scheme === SCHEMES[0] && !ONLY_NOTICES && !ONLY_BOXES) {
        for (let trial = 0; trial < PICK_PAGES; trial++) {
          const { page, close } = await open("doc=vendors&face=graview", DESK);
          results.quickPicks.push({ engine, trial, first: true, ...(await pickAtOnce(page, "kind:vendor", "Vendors")) });
          await page.locator('[data-testid="app-face-scene"]').click();
          await page.waitForFunction(() => document.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed") === "true");
          results.quickPicks.push({ engine, trial, first: false, ...(await pickAtOnce(page, "home", "Home")) });
          await close();
        }
      }
      if (ONLY_PICKS) continue;

      /* ---- The bar fits its box: in boxes on a desk, and on whole pages, both faces, a long name and a short one */
      if (!ONLY_NOTICES) {
        /* The workshop with thirty places, on a picture's page whose name is as long as a sentence. */
        const longPlace = "/places/what-the-room-said-about-the-budget-part-1";
        const sizes = [...BOXES.map((box) => ({ box, viewport: BOX_DESK })), ...BOX_PAGES.map((width) => ({ box: 0, viewport: width < 640 ? PHONE : { width, height: 800 } }))];
        for (const face of ["graview", "pages"]) {
          for (const name of [LONG_NAME, SHORT_NAME]) {
            for (const { box, viewport } of sizes) {
              if (name === SHORT_NAME && !SHORT_BOXES.includes(box)) continue;
              const query = `doc=workshop&many=1&face=${face}&heading=1&name=${encodeURIComponent(name)}${box ? `&box=${box}` : ""}${face === "pages" ? `&path=${encodeURIComponent(longPlace)}` : ""}`;
              const { page, close } = await open(query, viewport);
              const where = box ? `a ${box} px box on a ${viewport.width} px desk` : `a ${viewport.width} px page`;
              if (SHOTS && engine === "chromium") await page.screenshot({ path: join(SHOTS, `box-${face}-${name === SHORT_NAME ? "short" : "long"}-${box ? `box${box}` : `page${viewport.width}`}-${scheme}.png`), clip: { x: 0, y: 0, width: viewport.width, height: 180 } });
              results.boxes.push({ engine, scheme, face, name, box, where, ...(await page.evaluate(theBarInItsBox)), find: await findInEveryForm(page) });
              await close();
            }
          }
        }
        /*
         * THE SCENE'S FIRST FRAME STANDS IN ITS BOX. Laid out before its box
         * was measured, the city flew in from as wide as a desk, and in a
         * 480 px box its first frames stood the districts hundreds of pixels
         * outside it. Watched from the moment the address is asked for: every
         * frame a district is drawn in, the furthest any stands past the box.
         */
        for (const box of [480, 640]) {
          const context = await browser.newContext({ viewport: BOX_DESK, colorScheme: scheme });
          await context.addInitScript({ content: BAR_HELPERS });
          const page = await context.newPage();
          await page.goto(`${at("quiet-host")}/?doc=org&face=graview&heading=1&box=${box}`, { waitUntil: "commit" });
          let frames = 0;
          let past = 0;
          for (let at = Date.now(); Date.now() - at < 4000; ) {
            const seen = await page.evaluate(() => {
              const root = document.querySelector("[data-graview-embed]");
              const plots = [...document.querySelectorAll("[data-graview-plot]")].map((plot) => plot.getBoundingClientRect()).filter((one) => one.width > 0);
              if (!root || plots.length === 0) return null;
              const edge = root.getBoundingClientRect();
              return Math.max(0, ...plots.map((one) => Math.max(edge.left - one.left, one.right - edge.right)));
            });
            if (seen !== null) {
              frames += 1;
              past = Math.max(past, Math.round(seen));
            }
            await page.waitForTimeout(40);
          }
          results.firstFrames.push({ engine, scheme, box, frames, past });
          await context.close();
        }
        /* The switch as marks alone, asked for by the host: on a desk's whole page and in a box, its words its names. */
        for (const face of ["graview", "pages"]) {
          for (const box of [0, 720]) {
            const { page, close } = await open(`doc=workshop&face=${face}&heading=1&switch=icons${box ? `&box=${box}` : ""}`, BOX_DESK);
            results.boxSwitches.push({ engine, scheme, face, where: box ? `a ${box} px box` : `a ${BOX_DESK.width} px page`, ...(await page.evaluate(theSwitchsWords)) });
            await close();
          }
        }
      }
      if (ONLY_BOXES) continue;

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
      /* ---- FR-137: the scene and a list are one press on the switch apart, from the pointer and the keyboard */
      for (const viewport of [DESK, PHONE]) {
        const { page, close } = await open("doc=vendors&face=pages", viewport);
        results.switchPresses.push({ engine, scheme, viewport: `${viewport.width}×${viewport.height}`, ...(await sceneAndBack(page)) });
        await close();
      }
      /* ---- FR-137, FR-138: Cloud's workshop and thirty places, at four desk widths (one at twice the pixels) and a phone */
      for (const many of [false, true]) {
        for (const viewport of [...DESKS, PHONE]) {
          for (const dpr of viewport.width === 1280 && !QUICK ? [1, 2] : [1]) {
            for (const face of ["pages", "graview"]) {
              const query = `doc=workshop${many ? "&many=1" : ""}&face=${face}&heading=1${face === "pages" ? `&path=${encodeURIComponent("/places/email-to-todd")}` : ""}`;
              const { page, close } = await open(query, viewport, { deviceScaleFactor: dpr });
              const phone = viewport === PHONE;
              results.deskBars.push({ engine, scheme, places: many ? 30 : 7, face, viewport: `${viewport.width}×${viewport.height}`, dpr, phone, ...(await page.evaluate(theRow)) });
              if (SHOTS && dpr === 1 && (engine === "chromium" || engine === "webkit")) await page.screenshot({ path: join(SHOTS, `desk-bar-${many ? "thirty" : "workshop"}-${face}-${viewport.width}-${scheme}-${engine}.png`) });
              if (face === "pages" && dpr === 1 && (viewport.width === 1280 || phone)) {
                /* Every place, two presses each, by the pointer; then by the keyboard. */
                results.twoPresses.push({ engine, scheme, places: many ? 30 : 7, viewport: `${viewport.width}×${viewport.height}`, ...(await everyPlaceInTwoPresses(page, SHOTS && (engine === "chromium" || engine === "webkit") ? join(SHOTS, `desk-bar-${many ? "thirty" : "workshop"}-list-open-${viewport.width}-${scheme}-${engine}.png`) : null)) });
              }
              await close();
            }
          }
        }
      }
      /* ---- FR-138: a picture's page keeps only its own links; the places are the bar's */
      {
        const { page, close } = await open(`doc=workshop&face=pages&path=${encodeURIComponent("/places/email-to-todd")}`, DESK);
        results.repeats.push({ engine, scheme, ...(await page.evaluate(placesRepeated)) });
        await close();
      }
      /* ---- FR-136: a home view is the front page on a desk, full width under the bar; without one nothing changes */
      for (const viewport of [...DESKS, PHONE]) {
        for (const home of [true, false]) {
          const { page, close } = await open(`doc=workshop&face=none&heading=1${home ? "&home=1" : ""}`, viewport);
          if (SHOTS && (engine === "chromium" || engine === "webkit") && viewport.width !== 1024) await page.screenshot({ path: join(SHOTS, `desk-bar-${home ? "home-view" : "no-home-view"}-${viewport.width}-${scheme}-${engine}.png`) });
          results.homes.push({ engine, scheme, home, viewport: `${viewport.width}×${viewport.height}`, ...(await page.evaluate(theHome)) });
          await close();
        }
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
  report.checks.oneBarRowOnADeskAndAPhone = {
    seen: results.bars.map(({ engine, scheme, doc, face, viewport, rows, placeLineUnderTheBar, bars }) => ({ engine, scheme, doc, face, viewport, rows, placeLineUnderTheBar, bars })),
    ok: results.bars.length === engines.length * SCHEMES.length * 8 && results.bars.every((one) => one.rows === 1 && one.bars === 1 && one.contentUnderTheBar && (!one.phone || one.face !== "pages" || one.placeLineUnderTheBar)),
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
  const switchSays = (one) => one.switch !== null && one.switch.scene.name === "Scene" && one.switch.pages.name === "Pages" && one.switch.scene.pressed === (one.face !== "pages") && one.switch.pages.pressed === (one.face === "pages") && one.switch.rightAfterTheName && (one.phone || (one.switch.width >= 110 && one.switch.width <= 190));
  report.checks.theSwitchSaysSceneAndPagesAndMarksTheOneDrawn = {
    seen: [...results.bars, ...results.deskBars].map(({ engine, scheme, doc, places, face, viewport, dpr, switch: said }) => ({ engine, scheme, doc: doc ?? `workshop, ${places} places`, face, viewport, ...(dpr ? { dpr } : {}), switch: said })),
    ok: results.bars.length > 0 && results.deskBars.length > 0 && [...results.bars, ...results.deskBars].every(switchSays),
  };
  report.checks.nothingCallsTheSceneTheOverview = {
    seen: [...results.bars, ...results.deskBars].filter((one) => one.saysOverview.length > 0).map(({ engine, scheme, doc, places, face, viewport, saysOverview }) => ({ engine, scheme, doc: doc ?? `workshop, ${places} places`, face, viewport, saysOverview })),
    ok: results.bars.length > 0 && results.deskBars.length > 0 && [...results.bars, ...results.deskBars].every((one) => one.saysOverview.length === 0),
  };
  report.checks.aPickMadeTheMomentTheListOpensGoesToItsPlace = {
    seen: results.quickPicks,
    ok: results.quickPicks.length === engines.length * PICK_PAGES * 2 && results.quickPicks.every((one) => one.landed),
  };
  report.checks.theSceneAndAListAreOnePressOnTheSwitchApart = {
    seen: results.switchPresses,
    ok: results.switchPresses.length === engines.length * SCHEMES.length * 2 && results.switchPresses.every((one) => one.toList && one.toScene && one.sceneMarked && one.backToTheList && one.pagesMarked && one.byKeyboard && !one.onBody),
  };
  const deskBarsAll = results.deskBars.length === engines.length * SCHEMES.length * 2 * (DESKS.length + 1 + (QUICK ? 0 : 1)) * 2;
  report.checks.theDeskBarIsOneRowOfAtMost48PxWithSevenOrThirtyPlaces = {
    seen: results.deskBars.map(({ engine, scheme, places, face, viewport, dpr, height, lines }) => ({ engine, scheme, places, face, viewport, dpr, height, lines })),
    ok: deskBarsAll && results.deskBars.every((one) => one.lines === 1 && one.height <= BAR_MOST),
  };
  report.checks.everyBarControlStandsOnTheRowsMiddleAndNoneTouchesTheTopEdge = {
    seen: results.deskBars.map(({ engine, scheme, places, face, viewport, dpr, off, nearestTheTop }) => ({ engine, scheme, places, face, viewport, dpr, nearestTheTop, ...(off.length > 0 ? { off } : {}) })),
    ok: deskBarsAll && results.deskBars.every((one) => one.off.length === 0 && one.nearestTheTop >= 4),
  };
  report.checks.thePlaceYouAreOnIsSaidOnTheRowOrThePhonesFirstLineOnBothFaces = {
    seen: results.deskBars.map(({ engine, scheme, places, face, viewport, dpr, place }) => ({ engine, scheme, places, face, viewport, dpr, place })),
    ok: deskBarsAll && results.deskBars.every((one) => one.place.said === (one.face === "pages" ? "Email to Todd" : "The whole thing") && (one.phone ? one.place.firstLine : one.place.onTheRow)),
  };
  report.checks.everyPlaceIsTwoPressesAwayByPointerAndKeyboard = {
    seen: results.twoPresses,
    ok:
      results.twoPresses.length === engines.length * SCHEMES.length * 4 &&
      results.twoPresses.every(twoPressesHeld),
  };
  report.checks.aPicturesPageDoesNotRepeatThePlaces = {
    seen: results.repeats,
    ok: results.repeats.length === engines.length * SCHEMES.length && results.repeats.every((one) => one.asList && one.repeated.length === 0),
  };
  report.checks.aHomeViewIsTheFrontPageFullWidthUnderTheBar = {
    seen: results.homes,
    ok: results.homes.length === engines.length * SCHEMES.length * (DESKS.length + 1) * 2 && results.homes.every((one) => (one.home ? one.face === "pages" && one.homeView && one.fullWidth && one.underTheBar && !one.floating && one.place === "Home" : ["scene", "graview"].includes(one.face) && !one.homeView)),
  };
  /* FR-144, FR-145 */
  const standing = results.standing;
  const standingAll = standing.length === engines.length * SCHEMES.length * 2 * (STANDING_PAGES.length + STANDING_BOXES.length);
  const standingAt = (face, width, box = 0) => standing.filter((one) => one.face === face && one.width === width && one.box === box);
  const whereStanding = ({ engine, scheme, face, where }) => ({ engine, scheme, face: face === "pages" ? "pages" : "scene", where });
  const noMoreAt1280 = standingAt("pages", 1280).every((one) => one.place.standing <= (standingAt("pages", 1920).find((wide) => wide.engine === one.engine && wide.scheme === one.scheme)?.place.standing ?? 0));
  const pressesAll = results.standingPresses.length === engines.length * SCHEMES.length * (2 + (STANDING_PAGES.includes(1024) ? 3 : 2));
  const STANDING_CHECKS = {
    theBarIsOneRowOfAtMost48PxEveryControlOnItsMiddleOnBothFacesAtEveryWidthAndBox: {
      seen: standing.map((one) => ({ ...whereStanding(one), height: one.height, lines: one.lines, ...(one.off.length > 0 ? { off: one.off } : {}) })),
      ok: standingAll && standing.every((one) => one.lines === 1 && one.height <= BAR_MOST && one.off.length === 0 && one.nearestTheTop >= 4),
    },
    thePlaceYouAreOnIsAlwaysSeenOnTheRowOrThePhonesFirstLine: {
      seen: standing.map((one) => ({ ...whereStanding(one), place: one.place })),
      ok: standingAll && standing.every((one) => one.place.said === (one.face === "pages" ? "Email to Todd" : "The whole thing") && one.place.seen && ((one.box || one.width) < BAR_PHONE_WIDTH ? one.place.firstLine : one.place.onTheRow)),
    },
    /*
     * RANKED (FR-145): the workshop's main places — Home, its three kinds and
     * its two pictures — stand at 1920, and Connections, which reads the
     * declaration rather than the work, folds into More however wide the row.
     */
    theMainPlacesStandOnPagesAndTheRestFoldIntoMore: {
      seen: [...standingAt("pages", 1920), ...standingAt("pages", 1280)].map((one) => ({ ...whereStanding(one), standing: one.place.standing, opener: one.place.opener })),
      ok: standingAll && standingAt("pages", 1920).every((one) => one.place.standing === 6 && one.place.opener === "More") && standingAt("pages", 1280).every((one) => one.place.standing >= 2 && one.place.opener === "More") && noMoreAt1280,
    },
    theScenesPicturesStandAt1920: {
      seen: standingAt("graview", 1920).map((one) => ({ ...whereStanding(one), standing: one.place.standing, opener: one.place.opener })),
      ok: standingAll && standingAt("graview", 1920).every((one) => one.place.standing === 3 && one.place.opener === null),
    },
    aPhoneAndANarrowBoxKeepTheOneControl: {
      seen: standing.filter((one) => one.width < BAR_PHONE_WIDTH || (one.box && one.box <= 640)).map((one) => ({ ...whereStanding(one), standing: one.place.standing, opener: one.place.opener })),
      ok: standingAll && standing.filter((one) => one.width < BAR_PHONE_WIDTH || (one.box && one.box <= 640)).every((one) => one.place.standing === 0 && one.place.opener === "one control"),
    },
    theRowIsTheSameAfterTheWindowIsNarrowedAndWidenedAgain: {
      seen: results.standingResized.map(({ engine, scheme, face, seen }) => ({ engine, scheme, face: face === "pages" ? "pages" : "scene", seen: seen.map(({ width, height, lines, place }) => ({ width, height, lines, standing: place.standing, opener: place.opener })) })),
      ok:
        results.standingResized.length === engines.length * SCHEMES.length * (QUICK ? 1 : 2) &&
        results.standingResized.every(({ seen }) => seen.every((one) => one.lines === 1 && one.height <= BAR_MOST && one.place.seen) && seen[0].place.standing === seen[3].place.standing && seen[0].place.opener === seen[3].place.opener && seen[1].place.standing <= seen[0].place.standing),
    },
    everyPlaceInTheBarIsTwoPressesAwayOnBothFacesByPointerAndKeyboard: {
      seen: results.standingPresses,
      ok: pressesAll && results.standingPresses.every(twoPressesHeld),
    },
    /*
     * THE LIST RENDERS ONCE AS IT OPENS (FR-158): an entry of the list held
     * from before it opened is still in the document after the press that
     * opens it, nothing of the list is replaced while it stands open, and the
     * held entry pressed at once — no wait — goes to its place. 0.1.20 drew
     * the list, then drew it again ranked, and a press between the two hit a
     * node no longer in the document.
     */
    anEntryHeldFromBeforeTheListOpenedIsTheOnePressedAfter: {
      seen: results.heldAcross,
      ok: results.heldAcross.length === results.standingPresses.length + engines.length * SCHEMES.length * 2 && results.heldAcross.some((one) => one.held) && results.heldAcross.every((one) => (one.opener === false || (one.held !== null && one.replaced === 0 && one.pressed && one.landed))),
    },
    aPictureChosenFromTheBarIsWhatTheSceneShows: {
      seen: results.standingPresses.filter((one) => one.face !== "pages").map(({ engine, scheme, where, inView }) => ({ engine, scheme, where, inView })),
      ok: pressesAll && results.standingPresses.filter((one) => one.face !== "pages").every((one) => one.inView.length === one.places && one.inView.every((seen) => seen.ok) && one.inView.some((seen) => seen.asked !== null)),
    },
  };
  if (!ONLY_NOTICES && !ONLY_BOXES && !ONLY_PICKS) Object.assign(report.checks, STANDING_CHECKS);
  if (!ONLY_NOTICES && !ONLY_BOXES && !ONLY_PICKS && !ONLY_STANDING) {
    report.checks.theWorkshopsListArrangesOnOneQuietLine = {
      within: FIRST_RECORD_WITHIN,
      seen: results.workshopLists,
      ok:
        results.workshopLists.length === engines.length * SCHEMES.length * 2 &&
        results.workshopLists.every((one) => one.fromTop !== null && one.fromTop <= (one.width >= 1000 ? FIRST_RECORD_WITHIN.desk : FIRST_RECORD_WITHIN.phone) && one.selects === 0 && !one.countedInAnEyebrow && one.count === "2 deliverables" && !one.scrolls && one.end.ok && (one.keys === undefined || one.keys.ok)),
    };
  }
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
  /* The bar fits its box */
  const boxes = results.boxes;
  const allBoxes = boxes.length === engines.length * SCHEMES.length * 2 * (BOXES.length + BOX_PAGES.length + BOXES.filter((box) => SHORT_BOXES.includes(box)).length);
  const whereOf = ({ engine, scheme, face, name, where }) => ({ engine, scheme, face, name, where });
  const BOX_CHECKS = {
    theAppsNameIsWholeWordsOnAtMostTwoLinesInEveryBox: {
      seen: boxes.map((one) => ({ ...whereOf(one), ...one.app })),
      ok: allBoxes && boxes.every((one) => one.app.lines >= 1 && one.app.lines <= 2 && one.app.width >= one.app.firstWord - 1 && one.app.whole),
    },
    theBarIsOneRowOfAtMost48PxInABoxDownTo480: {
      seen: boxes.map((one) => ({ ...whereOf(one), height: one.height, lines: one.lines })),
      ok: allBoxes && boxes.filter((one) => one.box === 0 || one.box >= ONE_ROW_FROM).every((one) => one.lines === 1 && one.height <= BAR_MOST),
    },
    nothingOnTheBarOverlapsThePageUnderIt: {
      seen: boxes.map((one) => ({ ...whereOf(one), ...(one.over.length > 0 ? { over: one.over } : {}), underTheBar: one.underTheBar })),
      ok: allBoxes && boxes.every((one) => one.over.length === 0 && one.underTheBar),
    },
    thePlaceShowsTenLettersOrItsWholeName: {
      seen: boxes.filter((one) => one.face === "pages").map((one) => ({ ...whereOf(one), place: one.place })),
      ok: allBoxes && boxes.filter((one) => one.face === "pages").every((one) => one.place !== null && one.place.shown >= Math.min(PLACE_LETTERS, one.place.length)),
    },
    findIsReachedByTheKeyboardAndItsShortcutInEveryForm: {
      seen: boxes.map((one) => ({ ...whereOf(one), find: one.find })),
      ok: allBoxes && boxes.every((one) => one.find.byTab && one.find.byShortcut && one.find.typed),
    },
    theScenesFirstFrameStandsInsideItsBox: {
      seen: results.firstFrames,
      ok: results.firstFrames.length === engines.length * SCHEMES.length * 2 && results.firstFrames.every((one) => one.frames > 0 && one.past <= 2),
    },
    theSwitchAskedForAsMarksSaysItsWordsAsNames: {
      seen: results.boxSwitches,
      ok: results.boxSwitches.length === engines.length * SCHEMES.length * 4 && results.boxSwitches.every((one) => one.names.join() === "Scene,Pages" && one.titles.join() === "Scene,Pages" && one.wordsDrawn === 0 && one.asked === "icons"),
    },
  };
  if (!ONLY_NOTICES) Object.assign(report.checks, BOX_CHECKS);
  if (ONLY_NOTICES) {
    for (const name of Object.keys(report.checks)) if (!/Notice|WayBack/.test(name)) delete report.checks[name];
  }
  if (ONLY_PICKS) {
    for (const name of Object.keys(report.checks)) if (name !== "aPickMadeTheMomentTheListOpensGoesToItsPlace") delete report.checks[name];
  }
  if (ONLY_BOXES) {
    for (const name of Object.keys(report.checks)) if (!(name in BOX_CHECKS)) delete report.checks[name];
  }
  if (ONLY_STANDING) {
    for (const name of Object.keys(report.checks)) if (!(name in STANDING_CHECKS)) delete report.checks[name];
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
  /* The bar's standing says the number, and names it in words (FR-131): "2 rules broken", or "1 rule broken in 3 places", whose number is the places. */
  const standing = [...document.querySelectorAll('button[data-testid="standing"]')].find((one) => /\d+ rules? broken/.test(one.getAttribute("aria-label") ?? ""));
  const told = standing?.getAttribute("aria-label")?.match(/(\d+) rules? broken(?: in (\d+) places)?/);
  const count = Number(told?.[2] ?? told?.[1] ?? 0);
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
  /* The lines the bar's controls stand on: each control's own middle, never a region's top (a region grows downward when what is in it wraps). */
  const row = header ? barControls(header) : [];
  const lines = linesOf(row.map((one) => one.box));
  const line = root?.querySelector("[data-graview-place-line]");
  const placeLineUnderTheBar = Boolean(header && shown(line) && Math.abs(line.getBoundingClientRect().top - header.getBoundingClientRect().bottom) <= 1);
  /* Rows of navigation over the content that are not the bar: a masthead, a nav of pages, a Find bar of the face's own, the old strip. */
  const others = root ? [...root.querySelectorAll('[data-testid="masthead"], [data-testid="shell-nav"], [data-testid="face-find-bar"], [data-testid="embed-faces"], [data-embed-strip]')].filter(shown) : [];
  const content = root?.querySelector("[data-embed-content]");
  /* The page under the bar — on a phone's Pages, under the place's line, which is the page's first. */
  const above = shown(line) ? line : header;
  const contentUnderTheBar = Boolean(above && content && Math.abs(content.getBoundingClientRect().top - above.getBoundingClientRect().bottom) <= 1);
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
  const tools = header ? [...header.querySelectorAll(".graview-bar-tools > *")].flatMap((one) => (one.matches("button, a, input") ? [one] : [...one.querySelectorAll("button, a, input")])).filter(shown).map((one) => ({ name: one.getAttribute("aria-label") ?? one.textContent.trim(), height: Math.round(one.getBoundingClientRect().height), named: Boolean((one.getAttribute("aria-label") ?? "").trim()) })) : [];
  return { rows: lines, placeLineUnderTheBar, bars: header ? 1 + others.length : others.length, contentUnderTheBar, headings, name, repeated, findBoxes, tools, switch: theSwitch(header), saysOverview: saysOverview(root) };
}

/** The bar's controls on its row — not the place list, which opens over the page — each with its box. */
function barControls(header) {
  const row = header.querySelector(".graview-bar-row") ?? header;
  return [...row.querySelectorAll("a, button, input")]
    .filter((one) => {
      if (one.closest("[hidden], .graview-bar-list")) return false;
      const box = one.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return false;
      const style = getComputedStyle(one);
      return style.display !== "none" && style.visibility !== "hidden";
    })
    .map((one) => ({ name: one.getAttribute("data-testid") ?? one.getAttribute("aria-label") ?? one.tagName.toLowerCase(), box: one.getBoundingClientRect() }));
}

/** How many lines boxes stand on: their middles, any two within 3 px one line. */
function linesOf(boxes) {
  const middles = boxes.map((box) => (box.top + box.bottom) / 2).sort((a, b) => a - b);
  let lines = 0;
  let last = -Infinity;
  for (const middle of middles) {
    if (middle - last > 3) lines += 1;
    last = middle;
  }
  return lines;
}

/** The switch (FR-137): its two buttons' accessible names and states, its width, and whether it stands right after the app's name. */
function theSwitch(header) {
  const group = header?.querySelector('[data-testid="app-faces"]');
  if (!group) return null;
  const face = (which) => {
    const button = group.querySelector(`[data-testid="app-face-${which}"]`);
    /* The accessible name: the words, which a phone draws for a reader's ear alone. */
    const name = (button?.getAttribute("aria-label") ?? button?.textContent ?? "").trim();
    return { name, pressed: button?.getAttribute("aria-pressed") === "true", button: button?.tagName.toLowerCase() ?? null };
  };
  const app = header.querySelector(".graview-bar-app");
  const between = app && group ? group.getBoundingClientRect().left - app.getBoundingClientRect().right : null;
  return { role: group.getAttribute("role"), label: group.getAttribute("aria-label"), scene: face("scene"), pages: face("pages"), width: Math.round(group.getBoundingClientRect().width), rightAfterTheName: between !== null && between >= 0 && between <= 24 && app.nextElementSibling === group };
}

/** Every word on the screen, and every control's name, that calls the scene "the overview" (FR-137). */
function saysOverview(root) {
  const said = [];
  if (!root) return said;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    const element = node.parentElement;
    if (!text || !element || !/\boverview\b/i.test(text) || element.closest("style, script, [hidden]")) continue;
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;
    said.push(text.slice(0, 60));
  }
  for (const control of root.querySelectorAll("a, button, [role=button], [role=tab]")) {
    const named = `${control.getAttribute("aria-label") ?? ""} ${control.getAttribute("title") ?? ""}`;
    if (/\boverview\b/i.test(named) && !control.closest("[hidden]")) said.push(named.trim().slice(0, 60));
  }
  return said;
}

/**
 * THE ROW, MEASURED CONTROL BY CONTROL (FR-138): the bar's height, rule
 * included; the lines its controls' middles stand on; each control that
 * stands off the row's middle, and how near the top edge the nearest
 * comes; the place control's words and where it stands; and the switch.
 */
function theRow() {
  const root = document.querySelector("[data-graview-embed]");
  const header = root?.querySelector("[data-graview-app-bar]");
  if (!header) return { height: null, lines: 0, off: ["no bar"], nearestTheTop: 0, place: { said: null }, switch: null, saysOverview: [] };
  const bar = header.getBoundingClientRect();
  const row = header.querySelector(".graview-bar-row")?.getBoundingClientRect() ?? bar;
  const controls = barControls(header);
  const middle = (row.top + row.bottom) / 2;
  const off = controls.filter((one) => Math.abs((one.box.top + one.box.bottom) / 2 - middle) > 1.5).map((one) => ({ name: one.name, by: Math.round(((one.box.top + one.box.bottom) / 2 - middle) * 10) / 10 }));
  return {
    height: Math.round(bar.height * 10) / 10,
    lines: linesOf(controls.map((one) => one.box)),
    off,
    nearestTheTop: Math.round(Math.min(...controls.map((one) => one.box.top - bar.top)) * 10) / 10,
    place: placesSaid(root, header),
    switch: theSwitch(header),
    saysOverview: saysOverview(root),
  };
}

/**
 * WHERE THE BAR SAYS THE READER IS, AND HOW ITS PLACES ARE DRAWN (FR-138,
 * FR-145): the words of the place you are on (`app-place-current`, on the
 * one control or on the place standing on the row) and whether a person
 * sees them on the row or on a phone's first line; how many places stand
 * on the row; whether "More" or the one control opens the rest.
 */
function placesSaid(root, header) {
  const said = root.querySelector('[data-testid="app-place-current"]');
  const line = root.querySelector("[data-graview-place-line]");
  const bar = header.getBoundingClientRect();
  const seen = (one) => {
    if (!one || one.closest("[hidden]")) return false;
    const box = one.getBoundingClientRect();
    return box.width > 1 && box.height > 1 && box.left >= 0 && box.right <= innerWidth + 0.5 && getComputedStyle(one).visibility !== "hidden";
  };
  const opener = root.querySelector('[data-testid="app-places-open"]');
  return {
    said: said?.textContent.trim() ?? null,
    seen: seen(said),
    onTheRow: Boolean(said && header.contains(said) && seen(said) && said.getBoundingClientRect().bottom <= bar.bottom + 0.5),
    firstLine: Boolean(said && line?.contains(said) && Math.abs(line.getBoundingClientRect().top - bar.bottom) <= 1),
    standing: [...root.querySelectorAll('[data-testid="app-places-standing"] [data-place-path]')].filter((one) => !one.closest('[data-testid="app-places"]') && seen(one)).length,
    opener: opener ? (opener.textContent.trim() === "More" ? "More" : "one control") : null,
  };
}

/**
 * HOW A HARNESS REACHES ANY PLACE IN THE BAR (FR-145), whatever the width:
 * each place is one element in the embed, `app-place-<key>` with its
 * `data-place-path`. When it stands on the row it is pressed; when it does
 * not, `app-places-open` — "More", or the one control — opens the list it
 * is in, and it is pressed there.
 */
async function pressPlace(page, selector) {
  const one = page.locator(`[data-graview-embed] ${selector}`).first();
  if (!(await one.isVisible().catch(() => false))) await page.locator('[data-testid="app-places-open"]').click();
  await one.click();
}

/**
 * A PICK MADE AT ONCE (FR-140): Pages, the place list and an entry pressed
 * one after another with no pause, then the routed face waited for — not a
 * timer, its own page: the place's heading (a list's) or the bar saying the
 * place with no list's heading under it (the home) — for up to 5 s.
 */
async function pickAtOnce(page, key, label) {
  await page.locator('[data-testid="app-face-pages"]').click();
  await pressPlace(page, `[data-testid="app-place-${key}"]`);
  const landed = await page
    .waitForFunction(
      ({ key, label }) => {
        const said = document.querySelector('[data-testid="app-place-current"]')?.textContent.trim();
        const heading = document.querySelector("[data-embed-content] h2")?.textContent.trim().toLowerCase();
        return key === "home" ? said === label && heading !== undefined && heading !== "vendors" : heading === label.toLowerCase();
      },
      { key, label },
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false);
  const at = await page.evaluate(() => ({ said: document.querySelector('[data-testid="app-place-current"]')?.textContent.trim() ?? null, heading: document.querySelector("[data-embed-content] h2")?.textContent.trim() ?? null }));
  return { asked: label, landed, ...at };
}

/**
 * THE BAR IN ITS BOX: the app's name — the lines it is drawn on, clipped
 * lines left out, its width against its first word's, and whether its
 * whole name is its title; the bar's height and the lines its controls
 * stand on; anything of the bar's drawn past its bottom edge, over the
 * page under it (a control, or a line of the name); whether the page
 * starts under the bar; and how many letters of the place's name the
 * place control shows.
 */
function theBarInItsBox() {
  const root = document.querySelector("[data-graview-embed]");
  const header = root?.querySelector("[data-graview-app-bar]");
  const name = header?.querySelector('[data-testid="app-name"]');
  if (!header || !name) return { app: { lines: 0, width: 0, firstWord: 1, whole: false }, height: null, lines: 0, over: ["no bar"], underTheBar: false, place: null };
  const bar = header.getBoundingClientRect();
  const said = name.textContent.trim();
  const nameBox = name.getBoundingClientRect();
  /* The boxes above the name that clip it: a line past them is not drawn. */
  const clips = [];
  for (let up = name; up && up !== header; up = up.parentElement) {
    const style = getComputedStyle(up);
    if (["hidden", "clip"].includes(style.overflowY) || ["hidden", "clip"].includes(style.overflowX)) clips.push(up.getBoundingClientRect());
  }
  const range = document.createRange();
  range.selectNodeContents(name);
  const drawn = [...range.getClientRects()].filter((rect) => rect.width > 0.5 && clips.every((clip) => rect.bottom > clip.top + 1 && rect.top < clip.bottom - 1 && rect.right > clip.left + 1 && rect.left < clip.right - 1));
  /* The first word, set alone in the name's own face. */
  const probe = document.createElement("span");
  const style = getComputedStyle(name);
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font};letter-spacing:${style.letterSpacing}`;
  probe.textContent = said.split(/\s+/)[0] ?? "";
  header.append(probe);
  const firstWord = probe.getBoundingClientRect().width;
  probe.remove();
  const title = header.querySelector('[data-testid="app-home"]')?.getAttribute("title") ?? "";
  const whole = said.length > 0 && title.startsWith(said);
  const over = [];
  for (const control of barControls(header)) if (control.box.bottom > bar.bottom + 0.5 || control.box.top < bar.top - 0.5) over.push({ what: control.name, by: Math.round(control.box.bottom - bar.bottom) });
  for (const rect of drawn) if (rect.bottom > bar.bottom + 0.5) over.push({ what: "the app's name", by: Math.round(rect.bottom - bar.bottom) });
  const line = root.querySelector("[data-graview-place-line]");
  const above = (line && line.getBoundingClientRect().height > 1 ? line : header).getBoundingClientRect();
  const content = root.querySelector("[data-embed-content]");
  const underTheBar = Boolean(content && content.getBoundingClientRect().top >= above.bottom - 1);
  const words = root.querySelector('[data-testid="app-place-current"]');
  let place = null;
  if (words && words.getBoundingClientRect().width > 1) {
    /* The letters drawn inside the control's own box, the ellipsis's room left out when it is cut. */
    const edge = words.getBoundingClientRect();
    const cut = words.scrollWidth > words.clientWidth + 1;
    const text = words.firstChild;
    const letter = document.createRange();
    let shown = 0;
    for (let at = 0; text && at < text.length; at++) {
      letter.setStart(text, at);
      letter.setEnd(text, at + 1);
      if (letter.getBoundingClientRect().right <= edge.right - (cut ? 12 : -1)) shown += 1;
      else break;
    }
    place = { said: words.textContent.trim(), length: words.textContent.trim().length, shown };
  }
  return { app: { said, lines: linesOf(drawn), width: Math.round(nameBox.width), firstWord: Math.round(firstWord), whole }, height: Math.round(bar.height * 10) / 10, lines: linesOf(barControls(header).map((one) => one.box)), over, underTheBar, place };
}

/**
 * FIND, IN EVERY FORM IT TAKES: reached by Tab from the way home (a box,
 * or the button that opens one, then Enter), then by its shortcut with
 * nothing focused, and typed into.
 */
async function findInEveryForm(page) {
  const isFind = () =>
    page.evaluate(() => {
      const at = document.activeElement;
      if (!at) return null;
      if (at.matches('input[type="search"]') && /^(Find anything|Narrow this list)$/.test(at.getAttribute("aria-label") ?? "")) return at.getBoundingClientRect().width >= 80 ? "box" : "squeezed";
      if (at.matches('[data-testid="app-find-open"]')) return "opener";
      return null;
    });
  await page.evaluate(() => document.querySelector('[data-testid="app-home"]')?.focus());
  let byTab = false;
  for (let press = 0; press < 12 && !byTab; press++) {
    await page.keyboard.press("Tab");
    const at = await isFind();
    if (at === "box") byTab = true;
    if (at === "opener") {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
      byTab = (await isFind()) === "box";
      break;
    }
  }
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(150);
  await page.keyboard.press("ControlOrMeta+k");
  await page.waitForTimeout(200);
  const byShortcut = (await isFind()) === "box";
  let typed = false;
  if (byShortcut) {
    await page.keyboard.type("bud");
    await page.waitForTimeout(150);
    typed = await page.evaluate(() => document.activeElement?.value === "bud");
  }
  return { byTab, byShortcut, typed };
}

/** The switch asked for as marks: its buttons' names and titles, how many draw their words, and what the bar says was asked. */
function theSwitchsWords() {
  const group = document.querySelector('[data-testid="app-faces"]');
  const buttons = [...(group?.querySelectorAll("button") ?? [])];
  const wordsDrawn = buttons.filter((button) => [...button.querySelectorAll("span")].some((span) => span.textContent.trim() && span.getBoundingClientRect().width > 4)).length;
  return {
    names: buttons.map((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim()),
    titles: buttons.map((button) => button.getAttribute("title")),
    wordsDrawn,
    asked: group?.getAttribute("data-switch") ?? null,
  };
}

/**
 * FROM A LIST TO THE SCENE AND BACK (FR-137): a list by the place control,
 * the scene by the switch — drawn under the same bar, Scene pressed — and
 * Pages again, back on the same list. Then by keyboard: Tab to Scene, Enter.
 */
async function sceneAndBack(page) {
  const face = () => page.evaluate(() => document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed"));
  const pressed = (which) => page.evaluate((which) => document.querySelector(`[data-testid="app-face-${which}"]`)?.getAttribute("aria-pressed") === "true", which);
  const heading = () => page.locator("main h2, [data-embed-content] h2").first().textContent().catch(() => "").then((text) => (text ?? "").trim().toLowerCase());
  const settle = () => page.waitForTimeout(1200);
  await pressPlace(page, '[data-testid="app-place-kind:vendor"]');
  await settle();
  const toList = (await face()) === "pages" && (await heading()) === "vendors";
  await page.locator('[data-testid="app-face-scene"]').click();
  await settle();
  const toScene = ["scene", "graview"].includes(await face());
  const sceneMarked = (await pressed("scene")) && !(await pressed("pages"));
  await page.locator('[data-testid="app-face-pages"]').click();
  await settle();
  const backToTheList = (await face()) === "pages" && (await heading()) === "vendors";
  const pagesMarked = await pressed("pages");
  /* By keyboard: from the list, Tab from the app's name to Scene, and Enter. */
  let byKeyboard = false;
  await page.locator('[data-testid="app-home"]').focus();
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "app-face-scene")) {
      await page.keyboard.press("Enter");
      await settle();
      byKeyboard = ["scene", "graview"].includes(await face());
      break;
    }
  }
  const onBody = await page.evaluate(() => document.activeElement === document.body);
  return { toList, toScene, sceneMarked, backToTheList, pagesMarked, byKeyboard, onBody };
}

/**
 * EVERY PLACE IN TWO PRESSES (FR-138, FR-145): each place the bar offers —
 * standing on the row, or in the list "More" or the one control opens —
 * pressed as a harness reaches it (`pressPlace`), each landing on its place
 * with the bar saying its name; on the scene (FR-144), with the scene's
 * `in.view` the picture's own, and none for the whole thing. Then by
 * keyboard: Tab from the app's name reaches the switch, every place
 * standing and the control that opens the rest; Enter opens the list with
 * the keyboard in it; Escape gives it back to the control; Tab walks every
 * entry; Enter on one goes there, and the keyboard is never left on the body.
 */
async function everyPlaceInTwoPresses(page, shot, scene = false) {
  const openList = async () => {
    if (await page.evaluate(() => document.querySelector('[data-testid="app-places"]')?.hasAttribute("hidden") === true)) await page.locator('[data-testid="app-places-open"]').click();
    await page.waitForTimeout(120);
  };
  await openList();
  if (shot) await page.screenshot({ path: shot });
  /* The list as tall as what it holds (or its most, scrolling): no room left between its groups or under them (WebKit stretched it to its most). */
  const snug = await page.evaluate(() => {
    const pane = document.querySelector('[data-testid="app-places"]');
    if (!pane || pane.hasAttribute("hidden")) return null;
    const box = pane.getBoundingClientRect();
    const groups = [...pane.querySelectorAll("[data-place-group]")].map((group) => group.getBoundingClientRect());
    const gaps = groups.slice(1).map((group, at) => group.top - groups[at].bottom);
    const under = pane.scrollHeight > pane.clientHeight + 1 ? 0 : box.bottom - (groups.at(-1)?.bottom ?? box.bottom);
    return gaps.every((gap) => gap <= 16) && under <= 16;
  });
  const entries = await page.evaluate(() => [...document.querySelectorAll("[data-graview-embed] [data-place-path]")].map((one) => ({ id: one.getAttribute("data-testid"), label: one.textContent.trim(), path: one.getAttribute("data-place-path") })));
  const order = ["home", "lists", "pictures"];
  const groupOf = (id) => (/^app-place-(home|scene:whole)$/.test(id) ? "home" : id.startsWith("app-place-kind:") ? "lists" : "pictures");
  const groups = [...new Set(entries.map((entry) => groupOf(entry.id)))].sort((x, y) => order.indexOf(x) - order.indexOf(y));
  await page.keyboard.press("Escape");
  const reached = [];
  const missed = [];
  const inView = [];
  for (const entry of entries) {
    await pressPlace(page, `[data-testid="${entry.id}"]`);
    const landed = await page
      .waitForFunction((label) => document.querySelector('[data-testid="app-place-current"]')?.textContent.trim() === label, entry.label, { timeout: 4000 })
      .then(() => true, () => false);
    if (scene) {
      /* The scene's view says the picture: its `in.view` is the one its path names, none for the whole thing. */
      await page.waitForTimeout(200);
      const where = await page.evaluate(() => ({ stop: window.__handle.where().stop ?? "", face: document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed") }));
      const asked = new URLSearchParams(entry.path.split("#")[1] ?? "").get("in.view");
      const shown = new URLSearchParams(where.stop.replace(/^#/, "")).get("in.view");
      inView.push({ label: entry.label, asked, shown, face: where.face, ok: shown === asked && where.face !== "pages" });
    }
    (landed ? reached : missed).push(entry.label);
  }
  /* By keyboard. */
  const active = () => page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? (document.activeElement === document.body ? "<body>" : document.activeElement?.tagName.toLowerCase()));
  const opener = await page.evaluate(() => document.querySelector('[data-testid="app-places-open"]') !== null);
  const keyboard = { opener, switchReached: false, controlReached: !opener, into: !opener, escapeBack: !opener, entriesByTab: 0, went: false, onBody: false };
  const seen = new Set();
  await page.locator('[data-testid="app-home"]').focus();
  for (let step = 0; step < entries.length + 10; step++) {
    await page.keyboard.press("Tab");
    const at = await active();
    if (at === "app-face-scene" || at === "app-face-pages") keyboard.switchReached = true;
    if (at?.startsWith("app-place-") && at !== "app-place-current") seen.add(at);
    if (at === "app-places-open") keyboard.controlReached = true;
    if (opener ? keyboard.controlReached : seen.size === entries.length) break;
  }
  if (opener && keyboard.controlReached) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    keyboard.into = await page.evaluate(() => document.querySelector('[data-testid="app-places"]')?.contains(document.activeElement) === true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    keyboard.escapeBack = (await active()) === "app-places-open";
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    for (let step = 0; step < entries.length + 2; step++) {
      const at = await active();
      if (at?.startsWith("app-place-") && at !== "app-place-current") seen.add(at);
      if (seen.size === entries.length) break;
      await page.keyboard.press("Tab");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  keyboard.entriesByTab = seen.size;
  /* Enter on a place goes there: the first, the home or the whole thing. */
  const target = entries[0];
  if (!(await page.locator(`[data-testid="${target.id}"]`).isVisible().catch(() => false))) {
    await page.locator('[data-testid="app-places-open"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
  }
  await page.locator(`[data-testid="${target.id}"]`).focus();
  await page.keyboard.press("Enter");
  keyboard.went = await page
    .waitForFunction((label) => document.querySelector('[data-testid="app-place-current"]')?.textContent.trim() === label, target.label, { timeout: 4000 })
    .then(() => true, () => false);
  await page.waitForTimeout(300);
  keyboard.onBody = (await active()) === "<body>";
  return { listed: entries.length, groups, snug, reached, missed, keyboard, ...(scene ? { inView } : {}) };
}

/**
 * AN ENTRY HELD ACROSS THE OPEN (FR-158): with the list closed, the last
 * entry in it is held as an element; then the control that opens it is
 * pressed and, with no pause, the held element is pressed — the way a
 * person on a slow phone taps the moment the list appears. Whether it was
 * still in the document, how many entries of the list were taken out of it
 * while it opened, whether the press reached the element, and whether the
 * bar then says the entry's place.
 */
async function heldAcrossTheOpen(page) {
  if (await page.evaluate(() => document.querySelector('[data-testid="app-places"]')?.hasAttribute("hidden") === false)) await page.keyboard.press("Escape");
  if (!(await page.locator('[data-testid="app-places-open"]').count())) return { held: null, opener: false };
  const held = (await page.$$('[data-graview-embed] [data-testid="app-places"] [data-place-path]')).at(-1);
  if (!held) return { held: null };
  const label = (await held.textContent())?.trim() ?? "";
  await page.evaluate(() => {
    const pane = document.querySelector('[data-testid="app-places"]');
    window.__replaced = 0;
    window.__replacing = new MutationObserver((records) => {
      for (const record of records) for (const node of record.removedNodes) if (node.nodeType === 1 && (node.matches("[data-place-path]") || node.querySelector("[data-place-path]"))) window.__replaced += 1;
    });
    window.__replacing.observe(pane, { childList: true, subtree: true });
  });
  await page.locator('[data-testid="app-places-open"]').click();
  /* Counted up to the held entry's own press: what that press then does (the place it goes to) is not the opening's. */
  await held.evaluate((one) => one.addEventListener("click", () => window.__replacing.disconnect(), { capture: true, once: true })).catch(() => undefined);
  let pressed = true;
  let refused = null;
  await held.click({ timeout: 3000 }).catch((error) => {
    pressed = false;
    refused = String(error.message ?? error).split("\n")[0];
  });
  const replaced = await page.evaluate(() => {
    window.__replacing.disconnect();
    return window.__replaced;
  });
  const landed = pressed && (await page.waitForFunction((label) => document.querySelector('[data-testid="app-place-current"]')?.textContent.trim() === label, label, { timeout: 4000 }).then(() => true, () => false));
  await held.dispose();
  return { held: label, replaced, pressed, landed, ...(refused ? { refused } : {}) };
}

/** Every place reached by pointer and keyboard, two presses at most, and the keyboard never left on the body (FR-138, FR-145). */
function twoPressesHeld(one) {
  return (
    one.listed === one.places &&
    one.snug !== false &&
    one.groups.join() === (one.face === "graview" ? "home,pictures" : "home,lists,pictures") &&
    one.reached.length === one.places &&
    one.missed.length === 0 &&
    one.keyboard.switchReached &&
    one.keyboard.controlReached &&
    one.keyboard.into &&
    one.keyboard.escapeBack &&
    one.keyboard.entriesByTab === one.places &&
    one.keyboard.went &&
    !one.keyboard.onBody
  );
}

/** What a picture's page says under its title that is another place's name, as a link or a button (FR-138). */
function placesRepeated() {
  const root = document.querySelector("[data-graview-embed]");
  const content = root?.querySelector("[data-embed-content]");
  const labels = new Set([...(root?.querySelectorAll('[data-testid="app-places"] [data-testid^="app-place-"]') ?? [])].map((one) => one.textContent.trim()));
  const repeated = [...(content?.querySelectorAll("a, button") ?? [])].map((one) => one.textContent.trim()).filter((words) => labels.has(words) || /overview/i.test(words));
  const asList = [...(content?.querySelectorAll("a") ?? [])].some((one) => /^All deliverables as a list/.test(one.textContent.trim()));
  return { repeated, asList };
}

/** Where the app opened, with a home view or without (FR-136): the face, the home view's box against the page's, and whether anything floats over the scene. */
function theHome() {
  const root = document.querySelector("[data-graview-embed]");
  const face = root?.getAttribute("data-graview-embed") ?? null;
  const header = root?.querySelector("[data-graview-app-bar]");
  const view = root?.querySelector('[data-testid="home-view"]');
  const content = root?.querySelector("[data-embed-content]");
  const box = view?.getBoundingClientRect();
  const page = content?.getBoundingClientRect();
  /* As wide as the page's column: the page's width less its gutters, up to the column's measure — never a card's 440 px. */
  const fullWidth = Boolean(box && page && box.width >= Math.min(page.width - 128, 1100));
  let floating = false;
  for (let up = view; up && up !== root; up = up.parentElement) if (["absolute", "fixed"].includes(getComputedStyle(up).position)) floating = true;
  const underTheBar = Boolean(box && header && box.top >= header.getBoundingClientRect().bottom);
  return { face, homeView: Boolean(view), width: box ? Math.round(box.width) : null, page: page ? Math.round(page.width) : null, fullWidth, floating, underTheBar, place: root?.querySelector('[data-testid="app-place-current"]')?.textContent.trim() ?? null };
}

/** The bar's Standing: its accessible name says the count, Tab reaches it, and Enter opens the problems it counts. */
async function problemsByKeyboard(page) {
  const named = await page.evaluate(() => {
    const standing = document.querySelector('button[data-testid="standing"]');
    return standing !== null && /\d+ rules? broken/.test(standing.getAttribute("aria-label") ?? standing.textContent ?? "");
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
    /* Beside a tall panel at the left of a desk's picture (the seat, open), "left" is its right edge. */
    const tallAtLeft = [...document.querySelectorAll("[data-graview-foot]")]
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
    const standing = [...document.querySelectorAll("[data-graview-foot]")].filter((one) => one !== dock && !dock?.contains(one));
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
 * Goes to a place IN THE SCENE: a picture in the place list opens its page
 * (FR-138), so the scene is sent to the place's stop, `#view=<as>`, the way
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
