#!/usr/bin/env node
/**
 * A RECORD THAT LINKS ANOTHER APP, NAMED BY THE HOST (FR-171).
 *
 * Graview Cloud asked for a scenario in one app to point at a house in
 * another. The first step is an `app-link` field, which keeps the other
 * app's address, and a host's `resolveApp(address, viewer)`, which says
 * what that app is called for whoever is looking. The app is a document
 * mounted the way Cloud mounts one — the embed on a host's page that is the
 * app, built with esbuild from the workspace's sources
 * (`scripts/fixtures/app-links/scenarios.gdd.json`): scenarios that link
 * `@nick/house`, `@ana/flat` and an https address, a card that shows the
 * link (`{"field": "house"}`), and a place that lists the scenarios as
 * cards. The host's resolver is a stub: the house is "12 Elm Street" to
 * its owner and refused to a guest; the flat is refused to everyone; an
 * https address is no app it knows.
 *
 * At desk width (1280), on the routed face and the scene, in three engines
 * and both schemes, it asks:
 *
 *   the record's page draws the house as the host names it — its icon,
 *   name and home headline — linked to where it opens, and never says its
 *   address; following the link opens it; a refused viewer sees "linked app
 *   (no access)" and nothing of the app, its address included; without a
 *   resolver the address is drawn plainly, a link only when it is an
 *   absolute http(s) address, opened apart; the list's rows and the place's
 *   cards name each app, and the host is asked once per address however
 *   many records link it; the scene's record panel draws it as the page
 *   does; where an act may write it, a control beside it changes it and the
 *   new address is asked about.
 *
 *   node scripts/verify-app-links.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
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
/** `--shots=<dir>`: each screen, for a person to look at. */
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const SCENARIOS = resolve(repoRoot, "scripts/fixtures/app-links/scenarios.gdd.json");
const SCENARIOS_SEED = resolve(repoRoot, "scripts/fixtures/app-links/scenarios.seed.json");
const DESK = { width: 1280, height: 800 };

const report = { at: new Date().toISOString(), engines, schemes: SCHEMES, width: DESK.width, checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Purchase scenarios</title>
<style>body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#f7f7f4;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the page IS the app, as Cloud's shell mounts it, with a resolver of the host's own. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-app-links-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import scenarios from ${JSON.stringify(SCENARIOS)};
        import seed from ${JSON.stringify(SCENARIOS_SEED)};
        const query = new URLSearchParams(location.search);
        /* The host's apps, as it would say them to each viewer: the house is its owner's, the flat nobody's here. */
        window.__asked = [];
        const resolveApp = async (address, viewer) => {
          window.__asked.push(address + " for " + (viewer.id ?? viewer.kind));
          await new Promise((done) => setTimeout(done, 60));
          if (address === "@nick/house") return viewer.id === "u:owner" ? { name: "12 Elm Street", icon: "🏠", headline: "3 bedrooms · offer accepted", href: "/apps/nick/house" } : { denied: true };
          if (address === "@ana/flat") return { denied: true };
          return null;
        };
        const compiled = compileDocumentWithoutCheck(scenarios, { today: () => "2026-10-12" });
        if (!compiled.ok) {
          window.__failed = compiled.findings.map((finding) => finding.message).join("; ");
          window.__ready = true;
        } else if (location.pathname.startsWith("/apps/")) {
          /* Where a linked app opens: another app, on the same host. */
          document.getElementById("app").textContent = "The app at " + location.pathname;
          window.__ready = true;
        } else {
          const guest = query.get("as") === "guest";
          window.__handle = mount(document.getElementById("app"), {
            app: compiled.app,
            seed,
            face: query.get("face") === "graview" ? "graview" : "pages",
            routing: "address",
            principal: guest ? { kind: "human", id: "u:guest", roles: ["guest"] } : { kind: "human", id: "u:owner", roles: ["owner"] },
            label: compiled.app.name,
            heading: 1,
            height: "100dvh",
            fonts: false,
            studio: false,
            /* "resolver=0": a host that names no other app. */
            ...(query.get("resolver") === "0" ? {} : { resolveApp }),
          });
          window.__handle.drawn().then(() => { window.__ready = true; });
        }`,
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
  await new Promise((ready) => host.listen(portFor("app-links-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

async function until(page, check, timeout = 10_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > end) return false;
    await page.waitForTimeout(100);
  }
}

/** Every app-link drawn under `scope`: its state, its words, where it opens and how. */
function linksIn(scope) {
  return [...document.querySelectorAll(`${scope} [data-graview-app-link]`)].map((one) => ({
    state: one.getAttribute("data-graview-app-state"),
    text: one.textContent,
    tag: one.tagName.toLowerCase(),
    href: one.getAttribute("href"),
    target: one.getAttribute("target"),
    name: one.querySelector("[data-graview-app-name]")?.textContent ?? null,
    headline: one.querySelector("[data-graview-app-headline]")?.textContent ?? null,
    icon: Boolean(one.querySelector("[data-graview-app-icon]")),
  }));
}
/** Whether every app-link under `scope` has had its answer. */
const settled = (page, scope) => page.evaluate((scope) => document.querySelectorAll(`${scope} [data-graview-app-link]`).length > 0 && !document.querySelector(`${scope} [data-graview-app-state="asking"]`), scope);

const host = await buildHost();
const errors = [];
const seen = { found: [], opened: [], denied: [], guest: [], plain: [], rows: [], cards: [], scene: [], change: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const where = { engine, scheme, width: DESK.width };
      const open = async (path, query) => {
        const context = await browser.newContext({ viewport: DESK, colorScheme: scheme });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${scheme} ${path}?${query}: ${error.message}`));
        await page.goto(`${at("app-links-host")}${path}?${query}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        const failed = await page.evaluate(() => window.__failed ?? null);
        if (failed) errors.push(`${engine} ${scheme} ${path}?${query}: the document did not compile: ${failed}`);
        return { page, close: () => context.close() };
      };
      const shot = async (page, name) => {
        if (!SHOTS || engine !== engines[0]) return;
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: join(SHOTS, `${engine}-${scheme}-${name}.png`), fullPage: true });
      };
      const facts = '[data-testid="record-fields"]';
      const attempt = async (list, path, query, run) => {
        const { page, close } = await open(path, query);
        try {
          list.push({ ...where, ...(await run(page)) });
        } catch (error) {
          list.push({ ...where, error: String(error.message ?? error).split("\n")[0] });
        }
        await close();
      };

      /* GRANTED: the house as the host names it, and the link opens it. */
      await attempt(seen.found, "/scenarios/outright", "face=pages", async (page) => {
        await until(page, () => settled(page, facts));
        const [link] = await page.evaluate(linksIn, facts);
        const said = await page.evaluate((facts) => document.querySelector(facts)?.textContent ?? "", facts);
        const change = await page.locator(`${facts} button[data-graview-editable][data-graview-field="house"]`).count();
        await shot(page, "found");
        await page.locator(`${facts} a[data-graview-app-link]`).first().click();
        const opened = await until(page, () => page.evaluate(() => location.pathname === "/apps/nick/house" && document.body.textContent.includes("The app at /apps/nick/house")));
        seen.opened.push({ ...where, opened });
        return { link, saysAddress: said.includes("@nick/house"), change };
      });

      /* REFUSED: the flat, to everyone; nothing of it said. */
      await attempt(seen.denied, "/scenarios/flat", "face=pages", async (page) => {
        await until(page, () => settled(page, facts));
        const [link] = await page.evaluate(linksIn, facts);
        await shot(page, "denied");
        return { link, saysAddress: (await page.evaluate(() => document.body.textContent)).includes("@ana/flat") };
      });

      /* REFUSED TO THIS VIEWER: the owner's house, to a guest. */
      await attempt(seen.guest, "/scenarios/outright", "face=pages&as=guest", async (page) => {
        await until(page, () => settled(page, facts));
        const [link] = await page.evaluate(linksIn, facts);
        const body = await page.evaluate(() => document.body.textContent);
        return { link, saysAnyOfIt: body.includes("12 Elm Street") || body.includes("offer accepted") || body.includes("@nick/house") };
      });

      /* WITHOUT A RESOLVER: the address, plainly; an https address a link of its own. */
      await attempt(seen.plain, "/scenarios/outright", "face=pages&resolver=0", async (page) => {
        await until(page, () => settled(page, facts));
        const [named] = await page.evaluate(linksIn, facts);
        await page.evaluate(() => window.__handle.setPath("/scenarios/listing"));
        await until(page, () => page.evaluate((facts) => document.querySelector(`${facts} [data-graview-app-link]`)?.textContent?.startsWith("https://") ?? false, facts));
        const [web] = await page.evaluate(linksIn, facts);
        await shot(page, "plain");
        return { named, web };
      });

      /* THE LIST'S ROWS, then THE PLACE'S CARDS: each app named, and each address asked about once. */
      await attempt(seen.rows, "/scenarios", "face=pages", async (page) => {
        await until(page, () => settled(page, "body"));
        const rows = await page.evaluate(linksIn, "body");
        await shot(page, "rows");
        await page.evaluate(() => window.__handle.setPath("/places/the-plans"));
        await until(page, () => page.evaluate(() => document.querySelectorAll(".graview-spec-field [data-graview-app-link]").length >= 4 && !document.querySelector('[data-graview-app-state="asking"]')));
        const cards = await page.evaluate(linksIn, ".graview-spec-field");
        // Followed without leaving the card's own link underneath it.
        const onTop = await page.evaluate(() => {
          const link = document.querySelector('.graview-spec-field a[data-graview-app-link]');
          if (!link) return false;
          const box = link.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + Math.min(10, box.width / 2), box.top + box.height / 2);
          return Boolean(hit && link.contains(hit));
        });
        seen.cards.push({ ...where, cards, onTop });
        await shot(page, "cards");
        return { rows, asked: await page.evaluate(() => window.__asked) };
      });

      /* THE SCENE: the record's panel, at desk width, draws it as the page does. */
      await attempt(seen.scene, "/places/overview", "face=graview#focus=outright", async (page) => {
        await until(page, () => settled(page, "[data-graview-fields]"), 20_000);
        const links = await page.evaluate(linksIn, "[data-graview-fields]");
        await shot(page, "scene");
        return { links };
      });

      /* CHANGED IN PLACE: the control beside the link takes another address, and the host is asked about it. */
      await attempt(seen.change, "/scenarios/mortgage", "face=pages", async (page) => {
        await until(page, () => settled(page, facts));
        await page.locator(`${facts} button[data-graview-editable][data-graview-field="house"]`).click();
        const input = page.locator(`${facts} input`).first();
        await input.fill("@nick/barn");
        await input.press("Enter");
        const kept = await until(page, () => page.evaluate(() => window.__handle.store.graph.getNode("mortgage")?.house === "@nick/barn"));
        // The house's answer was already drawn: wait for the new address's, not for any.
        await until(page, () => page.evaluate((facts) => document.querySelector(`${facts} [data-graview-app-link]`)?.getAttribute("data-graview-app-state") === "plain", facts));
        const [link] = await page.evaluate(linksIn, facts);
        return { kept, link, asked: await page.evaluate(() => window.__asked.filter((one) => one.startsWith("@nick/barn"))) };
      });
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  host.stop();
}

const screens = SCHEMES.length * engines.length;
const all = (list, holds) => list.length === screens && list.every((one) => !one.error && holds(one));
const HOUSE = { state: "found", tag: "a", href: "/apps/nick/house", name: "12 Elm Street", icon: true };
const isHouse = (link, headline) => Boolean(link) && Object.entries(HOUSE).every(([key, value]) => link[key] === value) && link.headline === headline;
const noAccess = (link) => link?.state === "denied" && link.text === "linked app (no access)" && link.tag !== "a" && link.href === null;

report.checks.theRecordDrawsTheAppTheHostNamesNotItsAddress = {
  seen: seen.found,
  ok: all(seen.found, (one) => isHouse(one.link, "3 bedrooms · offer accepted") && !one.saysAddress),
};
report.checks.followingTheLinkOpensTheApp = { seen: seen.opened, ok: all(seen.opened, (one) => one.opened) };
report.checks.aRefusedAppIsSaidAsNoAccessAndNothingOfIt = {
  seen: seen.denied,
  ok: all(seen.denied, (one) => noAccess(one.link) && !one.saysAddress),
};
report.checks.anAppRefusedToThisViewerIsSaidAsNoAccess = {
  seen: seen.guest,
  ok: all(seen.guest, (one) => noAccess(one.link) && !one.saysAnyOfIt),
};
report.checks.withoutAResolverTheAddressIsDrawnPlainly = {
  seen: seen.plain,
  ok: all(seen.plain, (one) => one.named?.state === "plain" && one.named.tag === "span" && one.named.text === "@nick/house" && one.web?.tag === "a" && one.web.href === "https://example.com/listing/12" && one.web.target === "_blank"),
};
report.checks.theListsRowsNameEachAppAskingOncePerAddress = {
  seen: seen.rows,
  ok: all(seen.rows, (one) => {
    const states = one.rows.map((link) => link.state).sort();
    const asked = [...new Set(one.asked)].length === one.asked.length;
    return JSON.stringify(states) === JSON.stringify(["denied", "found", "found", "plain"]) && one.rows.filter((link) => link.state === "found").every((link) => isHouse(link, null)) && asked;
  }),
};
report.checks.thePlacesCardsNameEachAppAboveTheCardsOwnLink = {
  seen: seen.cards,
  ok: all(seen.cards, (one) => one.cards.filter((link) => link.state === "found").length === 2 && one.cards.some(noAccess) && one.onTop),
};
report.checks.theScenesRecordPanelDrawsItAsThePageDoes = {
  seen: seen.scene,
  ok: all(seen.scene, (one) => isHouse(one.links[0], "3 bedrooms · offer accepted")),
};
report.checks.aControlBesideItChangesTheAddressAndTheHostIsAsked = {
  seen: seen.change,
  ok: all(seen.change, (one) => one.kept && one.link?.state === "plain" && one.link.text === "@nick/barn" && one.asked.length === 1),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/app-links.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/app-links.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
