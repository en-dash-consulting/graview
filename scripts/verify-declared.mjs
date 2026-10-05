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
        const compiled = compileDocumentWithoutCheck(hall, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const asked = new URLSearchParams(location.search);
        window.__handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed: ${JSON.stringify(SEED)},
          face: asked.get("face") ?? "scene",
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          principal: { kind: "human", id: "m1", roles: ["keeper"] },
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
  const open = async (query, viewport = { width: 1600, height: 1000 }) => {
    const page = await browser.newPage({ viewport });
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
