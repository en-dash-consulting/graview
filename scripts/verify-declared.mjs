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
 *   on the Graview face, every declared lens is a pill by its title and a
 *   drive-in on its kind's district, and pressing a pill draws the lens;
 *   the scene opens on the place `pages.first` names;
 *   on the Pages face, every lens has its page at /places/<as>, the face
 *   opens on the first place, the home's kinds follow `pages.order` less
 *   the hidden kind, and the hidden kind is still reached by link, by the
 *   nav and by search.
 *
 * And a status board (FR-97, `tasks.gdd.json`): its columns on both faces,
 * a card moved by the keyboard and by a drag (the act, run as the owner)
 * and undone; a viewer without the act offered no move.
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
        const asked = new URLSearchParams(location.search);
        const proposal = asked.get("doc") === "lifelogics";
        const board = asked.get("doc") === "tasks";
        const compiled = compileDocumentWithoutCheck(proposal ? lifelogics : board ? tasks : hall, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: proposal ? lifelogicsSeed : board ? ${JSON.stringify(TASKS_SEED)} : ${JSON.stringify(SEED)},
          face: asked.get("face") ?? "scene",
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          principal: proposal
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
  /** The places the bar names, pills and the menu's options alike. */
  const placesOnTheBar = (page) =>
    page.evaluate(() => [
      ...[...document.querySelectorAll('[data-testid="places"] button[data-testid^="place-"]')].map((pill) => pill.textContent?.trim() ?? ""),
      ...[...document.querySelectorAll('[data-testid="places-more"] option')].map((option) => option.textContent?.trim() ?? "").filter((text) => text && !/^more/i.test(text)),
    ]);

  /* ---- FR-79 on the Graview face: every lens a pill, and a drive-in from altitude */
  {
    const page = await open("face=graview");
    const pills = await placesOnTheBar(page);
    const marquees = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="drive-in-"] .graview-drive-in-thumb-press')].map((press) => press.getAttribute("aria-label") ?? ""),
    );
    await page.close();
    report.checks.everyDeclaredLensIsAPillOnTheGraviewFace = { titles: TITLES, pills, ok: TITLES.every((title) => pills.includes(title)) };
    report.checks.everyDeclaredLensIsADriveInFromAltitude = {
      marquees,
      ok: TITLES.every((title) => marquees.some((label) => label.endsWith(`: ${title}`) || label.includes(title))),
    };
  }

  /* ---- FR-80 on the scene: it opens on the place pages.first names; FR-79: each pill draws its lens */
  {
    const page = await open("face=scene");
    const opened = await page.evaluate(() => ({
      pressed: [...document.querySelectorAll('[data-testid="places"] button[aria-pressed="true"]')].map((pill) => pill.textContent?.trim()),
      hash: location.hash,
    }));
    report.checks.theSceneOpensOnTheFirstPlace = { ...opened, ok: opened.pressed.includes("The floor") };
    const drawn = {};
    for (const title of TITLES) {
      const pill = page.locator('[data-testid="places"] button[data-testid^="place-"]', { hasText: title }).first();
      if ((await pill.count()) === 0) {
        drawn[title] = { pill: false };
        continue;
      }
      await pill.click();
      await page.waitForTimeout(900);
      drawn[title] = await page.evaluate((wanted) => {
        const pressed = document.querySelector('[data-testid="places"] button[aria-pressed="true"]')?.textContent?.trim() ?? null;
        // The lens draws under its own title, in the scene's focused card.
        const titled = [...document.querySelectorAll(".graview-ground *")].some((element) => element.childElementCount === 0 && element.textContent?.trim() === wanted);
        return { pressed, titled };
      }, title);
    }
    await page.close();
    report.checks.pressingEachPillDrawsItsLens = { drawn, ok: TITLES.every((title) => drawn[title]?.pressed === title && drawn[title]?.titled) };
  }

  /* ---- FR-79 on the Pages face: each lens at /places/<as> */
  {
    const pages = {};
    for (const title of TITLES) {
      const as = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const page = await open(`face=pages&path=${encodeURIComponent(`/places/${as}`)}`, { width: 1280, height: 900 });
      pages[title] = await page.evaluate(() => ({
        heading: document.querySelector("[data-graview-embed] h1")?.textContent?.trim() ?? null,
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
    const opened = await page.evaluate(() => document.querySelector("[data-graview-embed] h1")?.textContent?.trim() ?? null);
    report.checks.thePagesFaceOpensOnTheFirstPlace = { opened, ok: opened?.includes("The floor") === true };
    await page.click('[data-testid="masthead"]');
    await page.waitForTimeout(600);
    const home = await page.evaluate(() => ({
      kinds: [...document.querySelectorAll('[data-testid="kinds"] li a')].map((link) => link.getAttribute("href")),
      nav: [...document.querySelectorAll('[data-testid="shell-nav"] a')].map((link) => link.getAttribute("href")),
      gallery: [...document.querySelectorAll(".graview-gallery-card")].map((card) => card.getAttribute("href")),
    }));
    report.checks.theHomeFollowsTheDeclaredOrderLessTheHiddenKind = {
      ...home,
      ok:
        JSON.stringify(home.kinds) === JSON.stringify(["/volunteers", "/seats", "/shifts", "/members"]) &&
        // The pictures by their kind's place in the order — the seats' first — and no card for the hidden rooms.
        home.gallery[0] === "/places/the-floor" &&
        !home.gallery.includes("/rooms") &&
        JSON.stringify(home.nav.filter((href) => ["/volunteers", "/seats", "/shifts", "/rooms", "/members"].includes(href))) === JSON.stringify(["/volunteers", "/seats", "/shifts", "/rooms", "/members"]),
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
        // The Graview face at ground level, and from altitude: the home view is the landing over the picture.
        for (const [face, into] of [["scene", scene], ["graview", city]]) {
          page = await open(`doc=lifelogics&face=${face}`, size, scheme);
          await page.waitForSelector('[data-testid="home-landing"] .graview-spec-headline', { timeout: 15_000 }).catch(() => {});
          into[at] = await drawn(page, '[data-testid="home-landing"]');
          await shoot(page, `front-${face}-${size.width}-${scheme}`);
          await page.close();
        }
      }
    }
    report.checks.theFrontPageMadeOfDataIsTheHomeOnThePagesFace = { pages, ok: Object.values(pages).every((seen) => frontOk(seen, "h1")) };
    report.checks.theFrontPageMadeOfDataIsTheLandingOnTheGraviewFace = {
      scene,
      city,
      ok: [...Object.values(scene), ...Object.values(city)].every((seen) => frontOk(seen, "h2")),
    };
  }

  {
    // A listed record is a link: on the routed face to its page; on the picture, to the record itself.
    let page = await open("doc=lifelogics&face=pages", SIZES[0]);
    await page.waitForSelector('[data-graview-listed="pkg-start"] .graview-spec-item-link', { timeout: 15_000 });
    await page.click('[data-graview-listed="pkg-start"] .graview-spec-item-link');
    await page.waitForTimeout(500);
    const followed = await page.evaluate(() => document.querySelector("[data-graview-embed] h1")?.textContent?.trim() ?? null);
    await page.close();
    page = await open("doc=lifelogics&face=scene", SIZES[0]);
    await page.waitForSelector('[data-testid="home-landing"] [data-graview-listed="pkg-start"] .graview-spec-item-link', { timeout: 15_000 });
    await page.click('[data-testid="home-landing"] [data-graview-listed="pkg-start"] .graview-spec-item-link');
    await page.waitForTimeout(900);
    const picked = await page.evaluate(() => ({
      selected: [...document.querySelectorAll("[data-graview-view][data-graview-selected]")].map((view) => view.getAttribute("data-graview-view")),
      landing: document.querySelector('[data-testid="home-landing"]') !== null,
    }));
    await page.close();
    report.checks.aListedRecordIsALinkOnBothFaces = { followed, picked, ok: followed === "The small start" && !picked.landing && picked.selected.includes("pkg-start") };
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
          const pill = page.locator('[data-testid="places"] button[data-testid^="place-"]', { hasText: title }).first();
          let onPicture = { pill: false };
          if ((await pill.count()) > 0 && (await pill.isVisible())) {
            await pill.click();
            await page.waitForTimeout(900);
            onPicture = { pill: true, ...(await drawn(page, ".graview-ground .graview-spec-place")) };
          } else {
            // A narrow bar keeps its places in a menu; the place is its stop, as a host would set it.
            await page.evaluate((stop) => window.__handle.setStop(stop), `#view=${as}`);
            await page.waitForTimeout(1200);
            onPicture = { pill: false, menu: true, ...(await drawn(page, ".graview-ground .graview-spec-place")) };
          }
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
          moves: board ? board.querySelectorAll('[data-testid="columns-move"]').length : 0,
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
          // The keyboard: the card's Move button, Enter opens the columns it may go to, Enter on the first (Doing) moves it.
          const button = page.locator(`${within} [data-columns-move="t1"] > button`);
          let keyboard = { reached: false };
          if ((await button.count()) > 0) {
            await button.focus();
            await page.keyboard.press("Enter");
            await page.waitForTimeout(150);
            const offered = await page.evaluate((selector) => [...document.querySelectorAll(`${selector} [data-columns-move="t1"] [role="menuitem"]`)].map((item) => item.textContent), within);
            const focusedFirst = await page.evaluate(() => document.activeElement?.getAttribute("role") === "menuitem" && document.activeElement?.textContent === "Doing");
            await page.keyboard.press("Enter");
            await page.waitForTimeout(400);
            const after = await columnsOf(page, within);
            const kept = await page.evaluate(() => document.activeElement?.closest("[data-columns-move]")?.getAttribute("data-columns-move") ?? document.activeElement?.tagName ?? null);
            const said = await page.evaluate((selector) => document.querySelector(`${selector} [data-testid="columns-said"]`)?.textContent ?? "", within);
            // Undo, by the keyboard too: the board's own Undo, focused and pressed.
            await page.locator(`${within} [data-testid="columns-undo"]`).focus();
            await page.keyboard.press("Enter");
            await page.waitForTimeout(400);
            const undone = await columnsOf(page, within);
            keyboard = { reached: true, offered, focusedFirst, after: after.columns, kept, said, undone: undone.columns };
          }
          await shoot(page, `board-${face}-${size.width}-${scheme}`);
          await page.close();
          boards[at] = { before, keyboard };
          const viewer = await open(`${query}&as=viewer`, size, scheme);
          await viewer.waitForSelector(`${within} [data-graview-column]`, { timeout: 15_000 }).catch(() => {});
          viewers[at] = await columnsOf(viewer, within);
          await viewer.close();
        }
      }
    }
    report.checks.aStatusBoardDrawsOnBothFacesInTheFieldsOrder = {
      boards: Object.fromEntries(Object.entries(boards).map(([at, board]) => [at, board.before])),
      ok: Object.values(boards).every(({ before }) => before.present && JSON.stringify(before.columns) === STARTS && before.moves === 4 && !before.spills),
    };
    report.checks.aCardMovedByTheKeyboardIsTheActAndUndoPutsItBack = {
      boards: Object.fromEntries(Object.entries(boards).map(([at, board]) => [at, board.keyboard])),
      ok: Object.values(boards).every(
        ({ keyboard }) =>
          keyboard.reached &&
          JSON.stringify(keyboard.offered) === JSON.stringify(["Doing", "Done"]) &&
          keyboard.focusedFirst &&
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
