#!/usr/bin/env node
/**
 * A DECLARED LENS DRAWS, AND THE HOME IS ARRANGED AS DECLARED (FR-79, FR-80).
 *
 * Graview Cloud's chat rebuilds an app's interface as data: lenses with
 * titles, and a `pages` arrangement. Before, a document's lenses drew
 * nothing and `pages` was never compiled. This mounts the embed the way a
 * host does — a page of the host's own, built with esbuild from the
 * workspace's sources — over a DOCUMENT and nothing else: one lens of each
 * type the framework ships (`packages/core/tests/document/fixtures/
 * every-lens.gdd.json`), three kinds ordered, one hidden, a lens named
 * first. No view is registered by the host. Then it asks the browser:
 *
 *   every declared lens is a picture, by its title, in the list the bar's
 *   place control opens (FR-138), and a drive-in on its kind's district on
 *   the Graview face; the scene opens on the place `pages.first` names;
 *   on the Pages face, every lens has its page at /places/<as>, the face
 *   opens on the first place, the home's kinds follow `pages.order` less
 *   the hidden kind, and the hidden kind is still reached by link, by the
 *   nav and by search.
 *
 * And a status board (FR-97, `tasks.gdd.json`): its columns on both faces,
 * a card moved by the keyboard and by a drag (the act, run as the owner)
 * and undone; a viewer without the act offered no move; each column a
 * region announced by the lens's title first (FR-109).
 *
 * And a coverage over a path (FR-111, `org-strengths.gdd.json`): people by
 * skills through a strength record. Choosing Ryan × SEO selects what the
 * cell joins and draws to Ryan's row and SEO's column, on both faces, at a
 * desk and a phone — and nothing is drawn to the strengths' district.
 *
 * And a record page is read under a page's budget (`changes.gdd.json`): a
 * change of 98 tasks lists every one of them on both faces, where a card's
 * allowance said "—" for each list on its page.
 *
 * And money is said as money (`money.gdd.json`, the app's currency USD): a
 * deal's amount marked `"format": "money"` reads "$10,000" — never a bare
 * 10000 — on its record page, its list's rows, its board's cards, the
 * scene's record and the kind's table, with its percent, duration and
 * measure said as declared; the form to add one shows "$" beside its
 * amount and takes "$1,250.50" as written.
 *
 * And a review app as a Cloud author built it (`review.gdd.json`): a home
 * the declaration draws beside `pages.first: "This week"` — the visit lands
 * on This week, and a press on Home draws the home at "/"; a finding's card
 * says its kind's glance and nothing after it, and a risk's says whose
 * "high" is ("Impact: high"); and a place titled "Root causes" beside the
 * root causes' list is one "Root causes" on the bar, the list "All root
 * causes" and still at /root-causes.
 * And blocks lay out as written (`blocks-layout.gdd.json`, a review app's
 * home), at a desk and a phone: a headline inside a column of a row group is
 * a section heading, and the app's line is said once; a row group lays its
 * text and its columns side by side, wrapping on a phone; a list drawn as
 * rows gives each record the list's width and its whole name; badges that
 * follow one another sit on one line, on a card and on a record's page.
 * And the Beatles' discography as it was built in a chat (Oct 15,
 * `beatles.gdd.json`): a career calendar spans its releases, 1962 to 2023,
 * though it opens on 1970 with thirty years; "Songs by genre" with no genre
 * says so rather than listing songs; "Releases by era" lists its releases
 * oldest first, as its `sort` says; and the home's 158 songs, grouped by
 * writer, draw 100 and "Show 58 more", which draws the rest under their
 * writers.
 *
 *   node scripts/verify-declared.mjs [--engine=chromium|webkit|firefox]
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const DOCUMENT = resolve(repoRoot, "packages/core/tests/document/fixtures/every-lens.gdd.json");
const TITLES = JSON.parse(readFileSync(DOCUMENT, "utf8")).lenses.map((lens) => lens.title);
/** LifeLogics' front page and four lenses, rebuilt as data (FR-81, FR-82), and the seed it is drawn over. */
const LIFELOGICS = resolve(repoRoot, "packages/core/tests/document/fixtures/lifelogics.gdd.json");
const LIFELOGICS_SEED = resolve(repoRoot, "packages/core/tests/document/fixtures/lifelogics.seed.json");
const LENSES = JSON.parse(readFileSync(LIFELOGICS, "utf8")).lenses.map((lens) => lens.title);
/** A status board (FR-97): tasks by status, moved by the act that sets it; an owner who may run it, a viewer who may not and sees only their own. */
const TASKS = resolve(repoRoot, "packages/core/tests/document/fixtures/tasks.gdd.json");
const TASKS_SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing" },
    { id: "t3", kind: "task", label: "Order the chairs", status: "todo" },
    { id: "t4", kind: "task", label: "Send the invitations", status: "done" },
    { id: "p1", kind: "person", label: "Ada" },
    { id: "p2", kind: "person", label: "Grace" },
  ],
  edges: [
    { id: "e1", kind: "assigned-to", from: "t1", to: "p2" },
    { id: "e2", kind: "assigned-to", from: "t2", to: "p2" },
  ],
};
/** People by skills, through a strength (FR-111): the Strengths lens, as Graview Cloud's org app declares it. */
const STRENGTHS = resolve(repoRoot, "packages/core/tests/document/fixtures/org-strengths.gdd.json");
const STRENGTHS_SEED = resolve(repoRoot, "packages/core/tests/document/fixtures/org-strengths.seed.json");
/** A change of 98 tasks, 60 still open (`resolveFor`'s page budget): the page lists them all. */
const CHANGES = resolve(repoRoot, "packages/core/tests/document/fixtures/changes.gdd.json");
/** Deals in dollars (the money bug found on a Cloud app, Oct 13): an amount, a margin, an effort, a weight and a fee in euros. */
const MONEY = resolve(repoRoot, "packages/core/tests/document/fixtures/money.gdd.json");
/** A code review's findings (the review app built as a document on CLI 0.1.29): a drawn home and `pages.first` beside it, a place named as a list, glances. */
const REVIEW = resolve(repoRoot, "packages/core/tests/document/fixtures/review.gdd.json");
const REVIEW_SEED = resolve(repoRoot, "packages/core/tests/document/fixtures/review.seed.json");
/** A review app's home and places, as the blocks were found to lay out wrong (Oct 15): nested headlines, row groups, rows, badges. */
const LAYOUT = resolve(repoRoot, "packages/core/tests/document/fixtures/blocks-layout.gdd.json");
const LAYOUT_SEED = resolve(repoRoot, "packages/core/tests/document/fixtures/blocks-layout.seed.json");
/** The Beatles' discography (Oct 15): its lenses told a horizon and an order, and a home listing every song by writer. */
const BEATLES = resolve(repoRoot, "packages/core/tests/document/fixtures/beatles.gdd.json");
const BEATLES_SEED = resolve(repoRoot, "packages/core/tests/document/fixtures/beatles.seed.json");
const MONEY_SEED = {
  nodes: [
    { id: "d1", kind: "deal", name: "Acme rebrand", amount: 10000, margin: 0.125, effort: 90, weight: 12.5, fee: 1250.5, stage: "won" },
    { id: "d2", kind: "deal", name: "Harbor signage", amount: 4250.75, stage: "lead" },
  ],
  edges: [],
};
const CHANGES_SEED = {
  nodes: [
    { id: "c1", kind: "change", label: "Move the blocks" },
    ...Array.from({ length: 98 }, (_, i) => ({ id: `t${i + 1}`, kind: "task", label: `Task ${String(i + 1).padStart(2, "0")}`, status: i < 60 ? "open" : "done" })),
  ],
  edges: Array.from({ length: 98 }, (_, i) => ({ id: `e${i + 1}`, kind: "has", from: "c1", to: `t${i + 1}` })),
};
const SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const SCHEMES = ["light", "dark"];
/** `--shots=<dir>`: a screenshot of every page the front-page claims open, for a person to look at. */
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const report = { at: new Date().toISOString(), engine: ENGINE, document: "packages/core/tests/document/fixtures/every-lens.gdd.json", checks: {} };

/** The seed: something on every kind, so every lens has members to draw. */
const SEED = {
  nodes: [
    { id: "s1", kind: "shift", label: "Monday door", day: "mon", from: 540, until: 720, on: "2026-09-07" },
    { id: "s2", kind: "shift", label: "Friday bar", day: "fri", from: 1080, until: 1320, on: "2026-09-11" },
    { id: "v1", kind: "volunteer", label: "Ada" },
    { id: "v2", kind: "volunteer", label: "Grace" },
    { id: "seat-1", kind: "seat", label: "Front left", x: 0.2, y: 0.3 },
    { id: "seat-2", kind: "seat", label: "Back right", x: 0.8, y: 0.7 },
    { id: "r1", kind: "room", label: "The cellar" },
    { id: "m1", kind: "member", label: "Nora" },
  ],
  edges: [
    { id: "e1", kind: "covered-by", from: "s1", to: "v1" },
    { id: "e2", kind: "taken-by", from: "seat-1", to: "v2" },
  ],
};

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The hall, on a host's page</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}#app{position:relative;height:100vh}</style></head>
<body><main><h1 style="position:absolute;left:-9999px">The hall</h1><div id="app"></div></main><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the embed over the compiled document, and no view of the host's own. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-declared-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import hall from ${JSON.stringify(DOCUMENT)};
        import lifelogics from ${JSON.stringify(LIFELOGICS)};
        import lifelogicsSeed from ${JSON.stringify(LIFELOGICS_SEED)};
        import tasks from ${JSON.stringify(TASKS)};
        import strengths from ${JSON.stringify(STRENGTHS)};
        import strengthsSeed from ${JSON.stringify(STRENGTHS_SEED)};
        import changes from ${JSON.stringify(CHANGES)};
        import money from ${JSON.stringify(MONEY)};
        import review from ${JSON.stringify(REVIEW)};
        import reviewSeed from ${JSON.stringify(REVIEW_SEED)};
        const asked = new URLSearchParams(location.search);
        const reviewed = asked.get("doc") === "review";
        import layout from ${JSON.stringify(LAYOUT)};
        import layoutSeed from ${JSON.stringify(LAYOUT_SEED)};
        const laidOut = asked.get("doc") === "layout";
        import beatles from ${JSON.stringify(BEATLES)};
        import beatlesSeed from ${JSON.stringify(BEATLES_SEED)};
        const fab = asked.get("doc") === "beatles";
        const discography = {
          ...beatles,
          views: { home: [{ headline: "The songs" }, { list: "all('song')", sort: "name", as: "row", group: "writtenBy" }] },
          lenses: beatles.lenses.map((lens) =>
            lens.title === "Releases by year" ? { ...lens, options: { range: "years", horizon: { years: 30, title: "The career" }, today: "1970-04-10" } }
            : lens.title === "Releases by era" ? { ...lens, options: { sort: { by: "released" } } }
            : lens),
        };
        const proposal = asked.get("doc") === "lifelogics";
        const board = asked.get("doc") === "tasks";
        const org = asked.get("doc") === "strengths";
        const changed = asked.get("doc") === "changes";
        const dollars = asked.get("doc") === "money";
        const compiled = compileDocumentWithoutCheck(fab ? discography : laidOut ? layout : proposal ? lifelogics : board ? tasks : org ? strengths : changed ? changes : dollars ? money : reviewed ? review : hall, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: fab ? beatlesSeed : laidOut ? layoutSeed : proposal ? lifelogicsSeed : board ? ${JSON.stringify(TASKS_SEED)} : org ? strengthsSeed : changed ? ${JSON.stringify(CHANGES_SEED)} : dollars ? ${JSON.stringify(MONEY_SEED)} : reviewed ? reviewSeed : ${JSON.stringify(SEED)},
          /* "none": the app's to choose — its home view, else the scene (FR-136). */
          ...(asked.get("face") === "none" ? {} : { face: asked.get("face") ?? "scene" }),
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          principal: proposal || org || changed || dollars || reviewed || laidOut || fab
            ? { kind: "human", id: "u:owner", roles: ["owner"] }
            : board
              ? asked.get("as") === "viewer" ? { kind: "human", id: "p2", roles: ["viewer"] } : { kind: "human", id: "p1", roles: ["owner"] }
              : { kind: "human", id: "m1", roles: ["keeper"] },
          label: "The hall",
          heading: false,
          height: "100%",
          fonts: false,
          studio: false,
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
  await new Promise((ready) => host.listen(portFor("declared-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

const host = await buildHost();
let browser;
const errors = [];
try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const open = async (query, viewport = { width: 1600, height: 1000 }, colorScheme = "light") => {
    const page = await browser.newPage({ viewport, colorScheme });
    page.on("pageerror", (error) => errors.push(`${query}: ${error.message}`));
    await page.goto(`${at("declared-host")}/?${query}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
    await page.waitForTimeout(1200);
    return page;
  };
  /** The pictures among the bar's places on Pages (FR-138): standing on the row, or in the list "More" or the place control opens (FR-145). */
  const picturesInThePlaceList = (page) =>
    page.evaluate(() => [...document.querySelectorAll('[data-graview-embed] [data-place-path][data-testid^="app-place-place:"]')].map((entry) => entry.textContent?.trim() ?? ""));
  /** The scene sent to a place's stop, the way a link to it does: a picture in the place list is its page (FR-138). */
  const toPlace = async (page, as) => {
    await page.evaluate((stop) => window.__handle.setStop(stop), `#view=${as}`);
    await page.waitForTimeout(1200);
  };

  /* ---- FR-79: every lens a picture in the place list, and a drive-in from altitude on the Graview face */
  {
    const listed = await open("face=pages");
    const pictures = await picturesInThePlaceList(listed);
    await listed.close();
    const page = await open("face=graview");
    const marquees = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="drive-in-"] .graview-drive-in-thumb-press')].map((press) => press.getAttribute("aria-label") ?? ""),
    );
    await page.close();
    report.checks.everyDeclaredLensIsAPictureInThePlaceList = { titles: TITLES, pictures, ok: TITLES.every((title) => pictures.includes(title)) };
    report.checks.everyDeclaredLensIsADriveInFromAltitude = {
      marquees,
      ok: TITLES.every((title) => marquees.some((label) => label.endsWith(`: ${title}`) || label.includes(title))),
    };
  }

  /* ---- FR-80 on the scene: it opens on the place pages.first names; FR-79: each place's stop draws its lens */
  {
    const page = await open("face=scene");
    const opened = await page.evaluate(() => ({ stop: window.__handle.where().stop, scenePressed: document.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed") === "true" }));
    report.checks.theSceneOpensOnTheFirstPlace = { ...opened, ok: opened.stop.includes("view=the-floor") && opened.scenePressed };
    const drawn = {};
    for (const title of TITLES) {
      const as = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await toPlace(page, as);
      drawn[title] = await page.evaluate((wanted) => {
        // The lens draws under its own title, in the scene's focused card.
        const titled = [...document.querySelectorAll(".graview-ground *")].some((element) => element.childElementCount === 0 && element.textContent?.trim() === wanted);
        return { stop: window.__handle.where().stop, titled };
      }, title);
    }
    await page.close();
    report.checks.eachPlacesStopDrawsItsLensInTheScene = { drawn, ok: TITLES.every((title) => drawn[title]?.titled) };
  }

  /* ---- FR-79 on the Pages face: each lens at /places/<as> */
  {
    const pages = {};
    for (const title of TITLES) {
      const as = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const page = await open(`face=pages&path=${encodeURIComponent(`/places/${as}`)}`, { width: 1280, height: 900 });
      pages[title] = await page.evaluate(() => ({
        heading: document.querySelector("[data-graview-page-title]")?.textContent?.trim() ?? null,
        lens: document.querySelector('[data-testid="place-lens"]') !== null,
        drawn: (document.querySelector('[data-testid="place-lens"]')?.querySelectorAll("*").length ?? 0) > 3,
      }));
      await page.close();
    }
    report.checks.everyDeclaredLensHasItsPageOnThePagesFace = { pages, ok: TITLES.every((title) => pages[title]?.heading?.includes(title) && pages[title].lens && pages[title].drawn) };
  }

  /* ---- FR-80 on the Pages face: it opens on the first place; the home is in order; the hidden kind stays reachable */
  {
    const page = await open("face=pages", { width: 1280, height: 900 });
    const opened = await page.evaluate(() => document.querySelector("[data-graview-page-title]")?.textContent?.trim() ?? null);
    report.checks.thePagesFaceOpensOnTheFirstPlace = { opened, ok: opened?.includes("The floor") === true };
    await page.click('[data-testid="app-home"]');
    await page.waitForTimeout(600);
    const home = await page.evaluate(() => ({
      kinds: [...document.querySelectorAll('[data-testid="kinds"] li a')].map((link) => link.getAttribute("href")),
      /* Every place the bar offers, standing or in the list (FR-145): on the home, the first stand and the rest follow in the order. */
      nav: [...document.querySelectorAll("[data-graview-embed] [data-place-path]")].map((tab) => tab.getAttribute("data-place-path")),
      gallery: [...document.querySelectorAll(".graview-gallery-card")].map((card) => card.getAttribute("href")),
    }));
    report.checks.theHomeFollowsTheDeclaredOrderLessTheHiddenKind = {
      ...home,
      ok:
        JSON.stringify(home.kinds) === JSON.stringify(["/volunteers", "/seats", "/shifts", "/members"]) &&
        // The pictures by their kind's place in the order — the seats' first — and no card for the hidden rooms.
        home.gallery[0] === "/places/the-floor" &&
        !home.gallery.includes("/rooms") &&
        // The kinds in the declared order; the hidden rooms still reached from the bar, folded into More with what supports the rest (FR-145, ranked).
        JSON.stringify(home.nav.filter((href) => ["/volunteers", "/seats", "/shifts", "/members"].includes(href))) === JSON.stringify(["/volunteers", "/seats", "/shifts", "/members"]) &&
        home.nav.includes("/rooms"),
    };
    await page.close();
    const listed = await open(`face=pages&path=${encodeURIComponent("/rooms")}`, { width: 1280, height: 900 });
    const byLink = await listed.evaluate(() => document.body.textContent?.includes("The cellar") ?? false);
    await listed.close();
    const searched = await open(`face=pages&path=${encodeURIComponent("/search?q=cellar")}`, { width: 1280, height: 900 });
    const bySearch = await searched.evaluate(() => document.body.textContent?.includes("The cellar") ?? false);
    await searched.close();
    report.checks.theHiddenKindIsReachedByLinkNavAndSearch = { byLink, byNav: home.nav.includes("/rooms"), bySearch, ok: byLink && bySearch && home.nav.includes("/rooms") };
  }

  /*
   * ---- FR-81, FR-82: LifeLogics' front page and four lenses, as data, on both faces,
   * at a desk and a phone, in both schemes. The document is the only thing
   * the host hands over: no view, no page, no component of its own.
   */
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shoot = async (page, name) => {
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
  };
  /** What a drawing of blocks shows: its headings, its figures, the records it lists, and whether anything spills sideways. */
  const drawn = (page, within) =>
    page.evaluate((selector) => {
      const root = document.querySelector(selector);
      const embed = document.querySelector("[data-graview-embed]");
      return {
        present: root !== null,
        headings: root ? [...root.querySelectorAll(".graview-spec-headline, .graview-spec-list-heading")].map((h) => `${h.tagName.toLowerCase()} ${h.textContent?.trim()}`) : [],
        figures: root ? [...root.querySelectorAll(".graview-spec-number-value")].map((f) => f.textContent?.trim()) : [],
        listed: root ? [...root.querySelectorAll("[data-graview-listed]")].map((li) => li.getAttribute("data-graview-listed")) : [],
        links: root ? root.querySelectorAll(".graview-spec-item-link").length : 0,
        // Nothing wider than the page: the embed's box and the document alike.
        spills: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || (embed ? embed.scrollWidth > embed.clientWidth + 1 : false),
        fits: root ? root.getBoundingClientRect().right <= document.documentElement.clientWidth + 1 && root.getBoundingClientRect().left >= -1 : false,
      };
    }, within);
  const FRONT = { headline: "A small start, on three fronts.", figure: "$21,000", card: "pkg-start" };
  const frontOk = (seen, level) =>
    seen.present &&
    seen.headings.includes(`${level} ${FRONT.headline}`) &&
    seen.figures.includes(FRONT.figure) &&
    seen.listed.includes(FRONT.card) &&
    seen.links >= seen.listed.length &&
    !seen.spills &&
    seen.fits;

  {
    const pages = {};
    const scene = {};
    const city = {};
    for (const size of SIZES) {
      for (const scheme of SCHEMES) {
        const at = `${size.width}×${size.height} ${scheme}`;
        // The routed face: the home view is the home's body, its first headline the page's h1.
        let page = await open("doc=lifelogics&face=pages", size, scheme);
        await page.waitForSelector('[data-testid="home-view"] .graview-spec-headline', { timeout: 15_000 }).catch(() => {});
        pages[at] = await drawn(page, '[data-testid="home-view"]');
        await shoot(page, `front-pages-${size.width}-${scheme}`);
        await page.close();
        // Named no face, the app opens on it — at a desk as on a phone (FR-136).
        page = await open("doc=lifelogics&face=none", size, scheme);
        await page.waitForSelector('[data-testid="home-view"] .graview-spec-headline', { timeout: 15_000 }).catch(() => {});
        city[at] = { face: await page.evaluate(() => document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed")), ...(await drawn(page, '[data-testid="home-view"]')) };
        await shoot(page, `front-opening-${size.width}-${scheme}`);
        await page.close();
        // The Graview face at ground level, and from altitude: nothing floats over the picture; the home is a press on Pages away.
        for (const face of ["scene", "graview"]) {
          page = await open(`doc=lifelogics&face=${face}`, size, scheme);
          scene[`${at} ${face}`] = await page.evaluate(() => ({ over: document.querySelector('[data-testid="home-view"], [data-testid="home-landing"]') !== null }));
          await shoot(page, `front-${face}-${size.width}-${scheme}`);
          await page.close();
        }
      }
    }
    // Its first headline is said under the app's name on the bar, which is the page's h1 (FR-131).
    report.checks.theFrontPageMadeOfDataIsTheHomeOnThePagesFace = { pages, ok: Object.values(pages).every((seen) => frontOk(seen, "h2")) };
    report.checks.theFrontPageMadeOfDataIsWhereTheAppOpensAndNothingFloatsOverTheScene = {
      opening: city,
      scene,
      ok: Object.values(city).every((seen) => seen.face === "pages" && frontOk(seen, "h2")) && Object.values(scene).every((seen) => !seen.over),
    };
  }

  {
    // A listed record on the front page is a link to its page.
    const page = await open("doc=lifelogics&face=pages", SIZES[0]);
    await page.waitForSelector('[data-graview-listed="pkg-start"] .graview-spec-item-link', { timeout: 15_000 });
    await page.click('[data-graview-listed="pkg-start"] .graview-spec-item-link');
    await page.waitForTimeout(500);
    const followed = await page.evaluate(() => document.querySelector("[data-graview-page-title]")?.textContent?.trim() ?? null);
    await page.close();
    report.checks.aListedRecordOnTheFrontPageIsALinkToItsPage = { followed, ok: followed === "The small start" };
  }

  {
    // Each of the four lenses: a page of its own on the routed face, and a pill that draws it on the picture, at both sizes.
    const lenses = {};
    for (const title of LENSES) {
      const as = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      for (const size of SIZES) {
        for (const scheme of SCHEMES) {
          const at = `${title} ${size.width}×${size.height} ${scheme}`;
          let page = await open(`doc=lifelogics&face=pages&path=${encodeURIComponent(`/places/${as}`)}`, size, scheme);
          await page.waitForSelector('[data-testid="place-lens"] [data-graview-listed]', { timeout: 15_000 }).catch(() => {});
          const onPage = await drawn(page, '[data-testid="place-lens"]');
          await shoot(page, `lens-${as}-pages-${size.width}-${scheme}`);
          await page.close();
          page = await open("doc=lifelogics&face=scene", size, scheme);
          // The place in the scene is its stop, as a link to it says (FR-132).
          await toPlace(page, as);
          const onPicture = await drawn(page, ".graview-ground .graview-spec-place");
          await shoot(page, `lens-${as}-scene-${size.width}-${scheme}`);
          await page.close();
          lenses[at] = { onPage, onPicture };
        }
      }
    }
    report.checks.theFourLensesMadeOfDataDrawOnBothFaces = {
      lenses,
      ok: Object.values(lenses).every(({ onPage, onPicture }) => onPage.present && onPage.listed.length > 0 && !onPage.spills && onPicture.present && onPicture.listed.length > 0),
    };
  }

  {
    // FR-82: a package's page lists its offers as rows; a note's row on its list names the offers that answer it.
    let page = await open(`doc=lifelogics&face=pages&path=${encodeURIComponent("/packages/pkg-whole")}`, SIZES[1]);
    await page.waitForSelector("[data-graview-listed]", { timeout: 15_000 }).catch(() => {});
    const pack = await drawn(page, "main");
    await page.close();
    page = await open(`doc=lifelogics&face=pages&path=${encodeURIComponent("/what-we-heard")}`, SIZES[1]);
    await page.waitForSelector('[data-graview-spec="row"][data-graview-kind="signal"]', { timeout: 15_000 }).catch(() => {});
    const note = await page.evaluate(() => {
      const row = [...document.querySelectorAll('[data-graview-spec="row"][data-graview-kind="signal"]')].find((one) => one.textContent?.includes("Start with a pilot"));
      return { listed: row ? [...row.querySelectorAll("[data-graview-listed]")].map((li) => li.getAttribute("data-graview-listed")) : [], spills: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    await page.close();
    report.checks.aPackageListsItsOffersAndANoteTheOffersThatAnswerIt = {
      pack: pack.listed,
      note: note.listed,
      ok: JSON.stringify(pack.listed) === JSON.stringify(["offer-workshop", "offer-analysis", "offer-suite", "offer-advice"]) && JSON.stringify(note.listed) === JSON.stringify(["offer-workshop", "offer-analysis"]) && !pack.spills && !note.spills,
    };
  }

  {
    /*
     * FR-97: a status board, on both faces, at a desk and a phone, in both
     * schemes. Its columns in the field's order; a card moved with the
     * keyboard is the act, run as the owner, and its Undo puts it back; a
     * viewer whose policy has no such act is offered no move, and sees only
     * their own tasks, counted.
     */
    const columnsOf = (page, within) =>
      page.evaluate((selector) => {
        const board = document.querySelector(selector);
        return {
          present: board !== null,
          columns: board ? [...board.querySelectorAll("[data-graview-column]")].map((column) => [column.getAttribute("data-graview-column"), column.querySelector('[data-testid="columns-count"]')?.textContent?.trim(), [...column.querySelectorAll("[data-graview-listed]")].map((card) => card.getAttribute("data-graview-listed")).sort()]) : [],
          // A card that moves is one that drags (Roadmap f-board-move-without-buttons): no Move… button stands under it.
          moves: board ? board.querySelectorAll('[data-graview-listed][draggable="true"]').length : 0,
          buttons: board ? board.querySelectorAll('[data-testid="columns-move"]').length : 0,
          spills: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      }, within);
    const STARTS = JSON.stringify([["todo", "2", ["t1", "t3"]], ["doing", "1", ["t2"]], ["done", "1", ["t4"]]]);
    const MOVED = JSON.stringify([["todo", "1", ["t3"]], ["doing", "2", ["t1", "t2"]], ["done", "1", ["t4"]]]);
    const THEIRS = JSON.stringify([["todo", "1", ["t1"]], ["doing", "1", ["t2"]], ["done", "0", []]]);
    const boards = {};
    const viewers = {};
    for (const size of SIZES) {
      for (const scheme of SCHEMES) {
        for (const [face, query, within] of [
          ["pages", `doc=tasks&face=pages&path=${encodeURIComponent("/places/the-board")}`, '[data-testid="place-lens"] [data-testid="columns-lens"]'],
          ["scene", "doc=tasks&face=scene", '.graview-ground [data-testid="columns-lens"]'],
        ]) {
          const at = `${face} ${size.width}×${size.height} ${scheme}`;
          const page = await open(query, size, scheme);
          await page.waitForSelector(`${within} [data-graview-column]`, { timeout: 15_000 }).catch(() => {});
          const before = await columnsOf(page, within);
          // FR-109: each column is a region named by its lens first, as a screen reader on a phone announces it — asked by role, so the name is the one computed.
          const regions = page.locator(within).getByRole("region");
          const named = {
            names: await regions.evaluateAll((all) => all.filter((one) => one.hasAttribute("data-graview-column")).map((one) => one.getAttribute("aria-label"))),
            found: await page.locator(within).getByRole("region", { name: "The board · Todo, 2", exact: true }).count(),
          };
          // The keyboard carries the card: Space on it picks it up, Right carries it to Doing, Space drops it — the act — each step said.
          const card = page.locator(`${within} [data-graview-listed="t1"] .graview-spec-item-link`);
          let keyboard = { reached: false };
          if ((await card.count()) > 0) {
            await card.focus();
            await page.keyboard.press(" ");
            await page.waitForTimeout(150);
            const pickedUp = await page.evaluate((selector) => document.querySelector(`${selector} [data-testid="columns-announce"]`)?.textContent ?? "", within);
            await page.keyboard.press("ArrowRight");
            await page.waitForTimeout(150);
            const carried = await page.evaluate((selector) => document.querySelector(`${selector} [data-testid="columns-announce"]`)?.textContent ?? "", within);
            await page.keyboard.press(" ");
            await page.waitForTimeout(400);
            const after = await columnsOf(page, within);
            const kept = await page.evaluate(() => document.activeElement?.closest("[data-graview-listed]")?.getAttribute("data-graview-listed") ?? document.activeElement?.tagName ?? null);
            const said = await page.evaluate((selector) => document.querySelector(`${selector} [data-testid="columns-said"]`)?.textContent ?? "", within);
            // Undo, by the keyboard too: the board's own Undo, focused and pressed.
            await page.locator(`${within} [data-testid="columns-undo"]`).focus();
            await page.keyboard.press("Enter");
            await page.waitForTimeout(400);
            const undone = await columnsOf(page, within);
            keyboard = { reached: true, pickedUp, carried, after: after.columns, kept, said, undone: undone.columns };
          }
          await shoot(page, `board-${face}-${size.width}-${scheme}`);
          await page.close();
          boards[at] = { before, keyboard, named };
          const viewer = await open(`${query}&as=viewer`, size, scheme);
          await viewer.waitForSelector(`${within} [data-graview-column]`, { timeout: 15_000 }).catch(() => {});
          viewers[at] = await columnsOf(viewer, within);
          await viewer.close();
        }
      }
    }
    report.checks.aStatusBoardDrawsOnBothFacesInTheFieldsOrder = {
      boards: Object.fromEntries(Object.entries(boards).map(([at, board]) => [at, board.before])),
      ok: Object.values(boards).every(({ before }) => before.present && JSON.stringify(before.columns) === STARTS && before.moves === 4 && before.buttons === 0 && !before.spills),
    };
    report.checks.aColumnIsAnnouncedByItsLensFirst = {
      boards: Object.fromEntries(Object.entries(boards).map(([at, board]) => [at, board.named])),
      ok: Object.values(boards).every(({ named }) => JSON.stringify(named.names) === JSON.stringify(["The board · Todo, 2", "The board · Doing, 1", "The board · Done, 1"]) && named.found === 1),
    };
    report.checks.aCardCarriedByTheKeyboardIsTheActAndUndoPutsItBack = {
      boards: Object.fromEntries(Object.entries(boards).map(([at, board]) => [at, board.keyboard])),
      ok: Object.values(boards).every(
        ({ keyboard }) =>
          keyboard.reached &&
          keyboard.pickedUp.startsWith("Write the brief, picked up. Todo, 1 of 2.") &&
          keyboard.carried === "Doing, 1 of 2." &&
          JSON.stringify(keyboard.after) === MOVED &&
          keyboard.kept === "t1" &&
          keyboard.said.includes("Moved “Write the brief” to Doing.") &&
          JSON.stringify(keyboard.undone) === STARTS,
      ),
    };
    report.checks.aViewerWithoutTheActSeesNoMoveAndOnlyTheirOwnCounted = {
      viewers,
      ok: Object.values(viewers).every((seen) => seen.present && seen.moves === 0 && JSON.stringify(seen.columns) === THEIRS && !seen.spills),
    };

    // Dragging a card onto a column is the same act; on the routed face, at a desk.
    const page = await open(`doc=tasks&face=pages&path=${encodeURIComponent("/places/the-board")}`, SIZES[0]);
    const within = '[data-testid="place-lens"] [data-testid="columns-lens"]';
    await page.waitForSelector(`${within} [data-graview-column]`, { timeout: 15_000 }).catch(() => {});
    let dragged = { tried: false };
    try {
      await page.dragAndDrop(`${within} [data-graview-listed="t3"]`, `${within} [data-graview-column="done"]`);
      await page.waitForTimeout(400);
      dragged = { tried: true, ...(await columnsOf(page, within)) };
    } catch (error) {
      dragged = { tried: true, error: String(error) };
    }
    await page.close();
    report.checks.aCardDraggedOntoAColumnIsTheSameAct = {
      dragged,
      ok: JSON.stringify(dragged.columns) === JSON.stringify([["todo", "1", ["t1"]], ["doing", "1", ["t2"]], ["done", "2", ["t3", "t4"]]]),
    };

    // From altitude, the board is a drive-in on its kind's district, as every declared place is.
    const city = await open("doc=tasks&face=graview");
    const marquees = await city.evaluate(() => [...document.querySelectorAll('[data-testid^="drive-in-"] .graview-drive-in-thumb-press')].map((press) => press.getAttribute("aria-label") ?? ""));
    await city.close();
    report.checks.aStatusBoardIsADriveInFromAltitude = { marquees, ok: marquees.some((label) => label.includes("The board")) };
  }

  {
    /*
     * FR-111: a coverage cell over a path selects what it joins. The
     * Strengths lens crosses people with skills through a strength record;
     * choosing Ryan × SEO drew its line to the strengths' district. Now it
     * selects Ryan, SEO and the strength, and the lens draws from the cell
     * to Ryan's name and SEO's head — each line ending on the drawing it
     * names. A phone's grid is stacked, its column's name inside the cell:
     * there the line is Ryan's, and the chosen cell itself says SEO.
     */
    const chosen = {};
    for (const size of SIZES) {
      for (const [face, query, within] of [
        ["scene", "doc=strengths&face=scene", ".graview-ground"],
        ["pages", `doc=strengths&face=pages&path=${encodeURIComponent("/places/strengths")}`, '[data-testid="place-lens"]'],
      ]) {
        const at = `${face} ${size.width}×${size.height}`;
        const page = await open(query, size);
        const cell = page.locator(`${within} [data-graview-joins]`).first();
        if ((await cell.count()) === 0) {
          chosen[at] = { cell: false };
          await page.close();
          continue;
        }
        const joins = JSON.parse((await cell.getAttribute("data-graview-joins")) ?? "[]");
        await cell.click();
        await page.waitForTimeout(900);
        chosen[at] = await page.evaluate(({ selector, joins }) => {
          const root = document.querySelector(selector);
          const shape = root?.querySelector("[data-coverage-shape]")?.getAttribute("data-coverage-shape") ?? null;
          const drawingOf = (id) => [...(root?.querySelectorAll("[data-graview-pick]") ?? [])].find((el) => el.getAttribute("data-graview-pick") === id && !el.closest("[data-graview-mark]"));
          const lines = [...(root?.querySelectorAll("[data-coverage-join-to]") ?? [])].map((line) => {
            const id = line.getAttribute("data-coverage-join-to");
            const end = line.querySelector("circle")?.getBoundingClientRect();
            const to = drawingOf(id)?.getBoundingClientRect();
            const x = end ? end.left + end.width / 2 : NaN;
            const y = end ? end.top + end.height / 2 : NaN;
            // The line ends ON the drawing of the thing it names.
            const lands = to ? x >= to.left - 3 && x <= to.right + 3 && y >= to.top - 3 && y <= to.bottom + 3 : false;
            return { id, lands };
          });
          const emphasis = (id) => drawingOf(id)?.getAttribute("data-graview-emphasis") ?? null;
          const cell = [...(root?.querySelectorAll("[data-graview-joins]") ?? [])].find((el) => el.getAttribute("data-graview-joins") === JSON.stringify(joins));
          return {
            joins,
            shape,
            lines,
            ryan: emphasis("p-ryan"),
            seo: emphasis("sk-seo"),
            val: emphasis("p-val"),
            cellSays: cell?.textContent?.trim() ?? "",
            proxies: document.querySelectorAll("[data-graview-tie-proxy]").length,
            heading: document.querySelector("[data-graview-page-title]")?.textContent?.trim() ?? null,
          };
        }, { selector: within, joins });
        await shoot(page, `strengths-${face}-${size.width}`);
        await page.close();
      }
    }
    const reaches = (seen, id) => seen.lines?.some((line) => line.id === id && line.lands);
    report.checks.aCoverageCellOverAPathSelectsWhatItJoins = {
      chosen,
      ok: Object.entries(chosen).every(
        ([at, seen]) =>
          JSON.stringify(seen.joins) === JSON.stringify(["p-ryan", "sk-seo", "st-ryan-seo"]) &&
          seen.ryan === "lit" &&
          seen.val === "dimmed" &&
          reaches(seen, "p-ryan") &&
          (seen.shape === "stacked" ? seen.cellSays.includes("SEO") : reaches(seen, "sk-seo") && seen.seo === "lit") &&
          (!at.startsWith("pages") || seen.heading === "Strengths"),
      ),
    };
    report.checks.aChosenCellDrawsNothingToADistrict = { proxies: Object.fromEntries(Object.entries(chosen).map(([at, seen]) => [at, seen.proxies])), ok: Object.values(chosen).every((seen) => seen.proxies === 0) };
  }

  {
    /*
     * A RECORD PAGE IS READ UNDER A PAGE'S BUDGET. A change's page lists its
     * open tasks and its done ones; with 98 tasks, a card's allowance of 500
     * steps said "—" for both lists. Drawn once, a page is read under a
     * page's (`resolveFor`, PAGE_BUDGET): every task is listed, on the
     * routed face and in the scene's record.
     */
    const pages = await open(`doc=changes&face=pages&path=${encodeURIComponent("/changes/c1")}`, { width: 1280, height: 900 });
    await pages.waitForSelector("[data-graview-listed]", { timeout: 15_000 }).catch(() => {});
    const routed = await pages.evaluate(() => {
      const spec = document.querySelector('[data-graview-spec="page"][data-graview-kind="change"]');
      return { listed: spec ? new Set([...spec.querySelectorAll("[data-graview-listed]")].map((li) => li.getAttribute("data-graview-listed"))).size : 0, dashes: spec ? [...spec.querySelectorAll(".graview-spec-text")].filter((p) => p.textContent?.trim() === "—").length : -1 };
    });
    await pages.close();
    const scene = await open("doc=changes&face=scene", { width: 1440, height: 900 });
    await scene.evaluate(() => window.__handle.setStop("#focus=c1"));
    await scene.waitForSelector('[data-graview-spec="page"][data-graview-kind="change"] [data-graview-listed]', { timeout: 15_000 }).catch(() => {});
    const pictured = await scene.evaluate(() => {
      const spec = document.querySelector('[data-graview-spec="page"][data-graview-kind="change"]');
      return { listed: spec ? new Set([...spec.querySelectorAll("[data-graview-listed]")].map((li) => li.getAttribute("data-graview-listed"))).size : 0, dashes: spec ? [...spec.querySelectorAll(".graview-spec-text")].filter((p) => p.textContent?.trim() === "—").length : -1 };
    });
    await scene.close();
    report.checks.aRecordPageListsEveryRecordUnderAPagesBudget = { routed, scene: pictured, ok: routed.listed === 98 && routed.dashes === 0 && pictured.listed === 98 && pictured.dashes === 0 };
  }

  /*
   * ---- Money is said as money on every default face (the Cloud bug, Oct 13). The
   * deal's amount is a number marked "format": "money" in an app whose
   * currency is USD: it read 10000 on the record page, the list, the
   * table and the form.
   */
  {
    const bare = /(^|[^\d,.$€])10000([^\d,.]|$)/;
    const facts = { amount: "$10,000", margin: "13%", effort: "1 h 30 min", weight: "12.5 kg", fee: "€1,250.50" };
    const read = (page, selector) => page.evaluate((within) => [...document.querySelectorAll(within)].map((element) => element.textContent ?? "").join(" | "), selector);
    const record = await open(`doc=money&face=pages&path=${encodeURIComponent("/deals/d1")}`, { width: 1280, height: 900 });
    const recordText = await read(record, "main");
    await record.close();
    report.checks.aMoneyFieldIsSaidAsMoneyOnItsRecordPage = { said: Object.fromEntries(Object.entries(facts).map(([key, words]) => [key, recordText.includes(words)])), bare: bare.test(recordText), ok: Object.values(facts).every((words) => recordText.includes(words)) && !bare.test(recordText) };

    const list = await open(`doc=money&face=pages&path=${encodeURIComponent("/deals")}`, { width: 1280, height: 900 });
    const listText = await read(list, "main");
    await list.close();
    report.checks.aMoneyFieldIsSaidAsMoneyInItsListsRows = { dollars: listText.includes("$10,000"), cents: listText.includes("$4,250.75"), bare: bare.test(listText), ok: listText.includes("$10,000") && listText.includes("$4,250.75") && !bare.test(listText) };

    const board = await open(`doc=money&face=pages&path=${encodeURIComponent("/places/the-pipeline")}`, { width: 1280, height: 900 });
    await board.waitForSelector('[data-testid="place-lens"]', { timeout: 15_000 }).catch(() => {});
    const boardText = await read(board, '[data-testid="place-lens"]');
    await board.close();
    report.checks.aMoneyFieldIsSaidAsMoneyOnItsBoardsCards = { dollars: boardText.includes("$10,000"), bare: bare.test(boardText), ok: boardText.includes("$10,000") && !bare.test(boardText) };

    const scene = await open("doc=money&face=scene", { width: 1440, height: 900 });
    await scene.evaluate(() => window.__handle.setStop("#focus=d1"));
    await scene.waitForTimeout(1200);
    const sceneText = await scene.evaluate(() => document.querySelector("[data-graview-embed]")?.textContent ?? "");
    await scene.close();
    report.checks.aMoneyFieldIsSaidAsMoneyInTheScenesRecord = { dollars: sceneText.includes("$10,000"), bare: bare.test(sceneText), ok: sceneText.includes("$10,000") && !bare.test(sceneText) };

    // The form: "$" beside the amount, a suggestion in the reader's figures, and "$1,250.50" taken as written.
    const form = await open(`doc=money&face=pages&path=${encodeURIComponent("/deals")}`, { width: 1280, height: 900 });
    if (!(await form.locator('[data-testid="form-add-deal"]').isVisible().catch(() => false))) await form.click('[data-testid="act-open-add-deal"]').catch(() => {});
    await form.waitForSelector('[data-testid="form-add-deal"] input[name="amount"]', { timeout: 10_000 }).catch(() => {});
    const box = await form.evaluate(() => {
      const input = document.querySelector('[data-testid="form-add-deal"] input[name="amount"]');
      const field = input?.closest('[data-graview-part="field"]');
      return { type: input?.getAttribute("type") ?? null, mode: input?.getAttribute("inputmode") ?? null, placeholder: input?.getAttribute("placeholder") ?? null, symbol: field?.querySelector('[data-graview-part="amount-symbol"]')?.textContent ?? null };
    });
    let made = false;
    // A number box cannot take "$1,250.50" at all: the claim fails without typing into it.
    if (box.type === "text") {
      await form.fill('[data-testid="form-add-deal"] input[name="name"]', "Pier lighting");
      await form.fill('[data-testid="form-add-deal"] input[name="amount"]', "$1,250.50");
      await form.click('[data-testid="form-add-deal"] button[type="submit"]');
      await form.waitForTimeout(800);
      // The deal made, said back as the amount it was written as: on its page, or its row in the list.
      made = await form.evaluate(() => {
        const text = document.querySelector("main")?.textContent ?? "";
        return text.includes("Pier lighting") && text.includes("$1,250.50") ? "said" : null;
      });
    }
    await form.close();
    report.checks.aMoneyFormShowsItsCurrencyAndTakesAnAmountAsWritten = { box, made, ok: box.type === "text" && box.mode === "decimal" && box.symbol === "$" && box.placeholder === "1,250.00" && made === "said" };
  }

  /*
   * ---- A review app, as a Cloud author built it (CLI 0.1.29): a home the
   * declaration draws and `pages.first` naming another place; a place
   * titled as a kind's list is; cards that say their glance and no more.
   */
  {
    /* `pages.first` picks where a visit lands; the drawn home stays Home, one press away. */
    const page = await open("doc=review&face=none", { width: 1280, height: 900 });
    const landed = await page.evaluate(() => window.__handle.where());
    await page.click('[data-testid="app-home"]');
    await page.waitForTimeout(1200);
    const home = await page.evaluate(() => ({
      where: window.__handle.where(),
      headline: document.querySelector("[data-graview-embed] .graview-spec-headline")?.textContent?.trim() ?? null,
    }));
    report.checks.theDrawnHomeIsHomeWhenPagesFirstNamesAnotherPlace = {
      landed,
      home,
      ok: (landed.path.includes("this-week") || landed.stop.includes("this-week")) && home.where.face === "pages" && home.where.path === "/" && home.headline === "Two findings, worst first",
    };

    /* A card says its kind's glance exactly, and a choice another chip shares says whose it is. */
    const findingText = await page.evaluate(() => document.querySelector('[data-graview-embed] [data-graview-listed="f1"]')?.textContent ?? "");
    report.checks.aCardSaysItsGlanceAndNothingMore = {
      findingText,
      ok: findingText.includes("Critical") && findingText.includes("Security") && !/\bHigh\b/.test(findingText) && !/confidence/i.test(findingText),
    };
    const riskText = await page.evaluate(() => document.querySelector('[data-graview-embed] [data-graview-listed="r1"]')?.textContent ?? "");
    report.checks.aChoiceAnotherChipSharesSaysItsField = {
      riskText,
      ok: riskText.includes("Likelihood: low") && riskText.includes("Impact: high") && riskText.includes("Billing") && !riskText.includes("Area:"),
    };

    /* One "Root causes" on the bar: the place stands, and the kind's list is still reached, as "All root causes" and at its address. */
    const bar = await page.evaluate(() =>
      [...document.querySelectorAll("[data-graview-embed] [data-place-path]")].map((entry) => ({ path: entry.getAttribute("data-place-path"), text: entry.textContent?.trim() ?? "" })),
    );
    await page.close();
    const listPage = await open(`doc=review&face=pages&path=${encodeURIComponent("/root-causes")}`, { width: 1280, height: 900 });
    const byLink = await listPage.evaluate(() => document.querySelector("main")?.textContent?.includes("No owner for logging") ?? false);
    await listPage.close();
    const named = bar.filter((entry) => entry.text === "Root causes");
    report.checks.aPlaceNamedAsAListIsOnTheBarOnce = {
      bar,
      byLink,
      ok: named.length === 1 && named[0].path === "/places/root-causes" && bar.some((entry) => entry.path === "/root-causes" && entry.text === "All root causes") && byLink,
    };
  }

  /*
   * ---- Blocks lay out as written (a review app built with `graview preview`, Oct 15).
   * The review's home: a headline, a row of four stat tiles, a row of four
   * toned lines, a row of two columns each headed by a headline over two
   * meters, and every finding as a row; its findings' cards and pages wear
   * three badges. Measured at a desk and a phone.
   */
  {
    const home = {};
    const rows = {};
    const listed = {};
    const badges = {};
    for (const size of SIZES) {
      const at = `${size.width}×${size.height}`;
      const page = await open(`doc=layout&face=pages&path=${encodeURIComponent("/")}`, size);
      await page.waitForSelector('[data-testid="home-view"] .graview-spec-headline', { timeout: 15_000 }).catch(() => {});
      await shoot(page, `layout-home-${size.width}`);
      const seen = await page.evaluate(() => {
        const view = document.querySelector('[data-testid="home-view"]');
        const box = (element) => element.getBoundingClientRect();
        const groups = view ? [...view.querySelectorAll('.graview-spec-home > .graview-spec-group[data-direction="row"]')] : [];
        /** How a row group's blocks stand: their tops and lefts, and whether any spills past the group. */
        const laid = (group) => {
          if (!group) return null;
          const outer = box(group);
          const parts = [...group.children].map(box);
          return { tops: parts.map((r) => Math.round(r.top)), lefts: parts.map((r) => Math.round(r.left)), widths: parts.map((r) => Math.round(r.width)), spills: parts.some((r) => r.right > outer.right + 1 || r.left < outer.left - 1) };
        };
        const list = view?.querySelector('.graview-spec-list[data-as="row"]');
        return {
          headlines: view ? [...view.querySelectorAll(".graview-spec-headline")].map((h) => `${h.tagName.toLowerCase()} ${h.getAttribute("data-level")} ${h.textContent?.trim()}`) : [],
          lines: [...document.querySelectorAll('[data-testid="app-subtitle"]')].length,
          texts: laid(groups[1]),
          columns: laid(groups[2]),
          list: list
            ? {
                width: Math.round(box(list).width),
                rows: [...list.children].map((li) => {
                  const title = li.querySelector(".graview-spec-title");
                  return {
                    width: Math.round(box(li).width),
                    chip: li.querySelector('[data-graview-primitive="chip"]') !== null,
                    whole: title ? title.textContent === li.querySelector("a")?.getAttribute("aria-label") && title.scrollWidth <= title.clientWidth + 1 : false,
                  };
                }),
              }
            : null,
          spills: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      await page.close();
      home[at] = { headlines: seen.headlines, lines: seen.lines };
      rows[at] = { texts: seen.texts, columns: seen.columns, spills: seen.spills };
      listed[at] = seen.list;
      // Badges on a card (the every-finding place) and on a record's page.
      const one = {};
      for (const [where, path, within] of [
        ["card", "/places/every-finding", '[data-graview-listed="f1"] [data-graview-spec="card"]'],
        ["page", "/findings/f3", '[data-graview-spec="page"][data-graview-kind="finding"]'],
      ]) {
        const shown = await open(`doc=layout&face=pages&path=${encodeURIComponent(path)}`, size);
        await shown.waitForSelector(`${within} .graview-spec-badge`, { timeout: 15_000 }).catch(() => {});
        one[where] = await shown.evaluate((selector) => [...document.querySelectorAll(`${selector} .graview-spec-badge`)].map((badge) => Math.round(badge.getBoundingClientRect().top)), within);
        await shoot(shown, `layout-badges-${where}-${size.width}`);
        await shown.close();
      }
      badges[at] = one;
    }
    const desk = `${SIZES[0].width}×${SIZES[0].height}`;
    const oneLine = (tops) => tops.length > 1 && Math.max(...tops) - Math.min(...tops) <= 4;
    report.checks.aNestedHeadlineIsASectionHeadingAndTheAppsLineIsSaidOnce = {
      home,
      ok: Object.values(home).every(
        (seen) => seen.lines === 1 && seen.headlines.filter((h) => / 1 /.test(h)).length === 1 && seen.headlines.some((h) => h.startsWith("h3 2 Where the problems are")) && seen.headlines.some((h) => h.startsWith("h3 2 When they are planned")),
      ),
    };
    report.checks.aRowGroupLaysTextAndColumnsSideBySideAndWrapsOnAPhone = {
      rows,
      ok:
        // At a desk, the four lines on one line and the two columns side by side…
        oneLine(rows[desk]?.texts?.tops ?? []) &&
        oneLine(rows[desk]?.columns?.tops ?? []) &&
        new Set(rows[desk]?.columns?.lefts ?? []).size === 2 &&
        // …and nowhere does anything spill past its row or the page.
        Object.values(rows).every((seen) => seen.texts && seen.columns && !seen.texts.spills && !seen.columns.spills && !seen.spills),
    };
    report.checks.aListOfRowsGivesEachRecordTheListsWidthAndItsWholeName = {
      listed,
      ok: Object.values(listed).every((list) => list && list.rows.length === 4 && list.rows.every((row) => !row.chip && row.whole && row.width >= list.width - 2)),
    };
    report.checks.badgesThatFollowOneAnotherSitOnOneLineOnACardAndAPage = {
      badges,
      ok: Object.values(badges).every((seen) => seen.card?.length === 3 && oneLine(seen.card) && seen.page?.length === 3 && oneLine(seen.page)),
    };
  }

  /* ---- The Beatles (Oct 15): a career's years, a coverage with nothing to cross, an order told, a list past a page */
  {
    const text = async (path, selector) => {
      const page = await open(`doc=beatles&face=pages&path=${encodeURIComponent(path)}`);
      await page.waitForSelector(selector, { timeout: 20_000 }).catch(() => {});
      return page;
    };
    const years = await text("/places/releases-by-year", "[data-graview-embed] main");
    await years.waitForFunction(() => /The career · \d{4}/.test(document.body.textContent ?? ""), null, { timeout: 15_000 }).catch(() => {});
    const career = await years.evaluate(() => document.body.textContent ?? "");
    await years.close();
    report.checks.aCareerCalendarSpansItsRecordsFirstToLast = { span: /The career · \d{4}–\d{4}/.exec(career)?.[0] ?? career.slice(0, 400), ok: career.includes("The career · 1962–2023") };

    const genres = await text("/places/songs-by-genre", "[data-coverage-unlinked]");
    const unlinked = await genres.evaluate(() => ({ said: document.querySelector("[data-coverage-unlinked]")?.textContent ?? null, songs: [...document.querySelectorAll('[data-graview-pick^="song-"]')].length }));
    await genres.close();
    report.checks.aCoverageWithNothingLinkedSaysSoAndListsNoRows = { ...unlinked, ok: unlinked.said === "No genres yet: link songs to genres." && unlinked.songs === 0 };

    const eras = await text("/places/releases-by-era", '[data-graview-pick^="release-"]');
    const order = await eras.evaluate(() => [...new Set([...document.querySelectorAll('[data-graview-pick^="release-"]')].map((one) => one.getAttribute("data-graview-pick")))]);
    await eras.close();
    report.checks.aCoverageListsItsRowsInTheOrderItIsTold = { first: order.slice(0, 4), last: order.at(-1), ok: order.slice(0, 3).join() === "release-love-me-do,release-please-please-me,release-with-the-beatles" && order.at(-1) === "release-now-and-then" };

    const home = await text("/", "[data-graview-show-more]");
    const before = await home.evaluate(() => ({ listed: document.querySelectorAll("[data-graview-listed]").length, button: document.querySelector("[data-graview-show-more]")?.textContent ?? null }));
    await home.click("[data-graview-show-more]").catch(() => {});
    await home.waitForTimeout(600);
    const after = await home.evaluate(() => ({
      listed: document.querySelectorAll("[data-graview-listed]").length,
      button: document.querySelector("[data-graview-show-more]") !== null,
      headings: [...document.querySelectorAll(".graview-spec-list-heading")].map((heading) => heading.textContent),
      focus: document.activeElement?.tagName ?? null,
    }));
    await home.close();
    report.checks.aListPastAPageShowsTheRestWhenAskedUnderTheRecordsTheyAreLinkedTo = {
      before,
      after,
      ok: before.listed === 100 && before.button === "Show 58 more" && after.listed === 158 && !after.button && after.headings.join() === "Harrison,Lennon,McCartney,Starkey",
    };
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

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/declared.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/declared.json\n");
process.exit(report.passed ? 0 : 1);
