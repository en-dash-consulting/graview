#!/usr/bin/env node
/**
 * A PHONE TO CALL, A PLACE TO MAP AND A LENGTH OF TIME, each a field type.
 *
 * Templates held all three as strings: a phone that was not a link to
 * call, an address that was not a link to a map, and lengths of time that
 * could not be added up. The app is a document mounted the way Cloud mounts
 * one — the embed on a host's page that is the app, built with esbuild from
 * the workspace's sources (`scripts/fixtures/field-types/rehearsals.gdd.json`):
 * a choir's rehearsals, each with who to call (`phone`), where it is
 * (`place`) and how long it runs (`duration`), a season whose computed
 * fields add up its rehearsals' lengths, a card that shows all three and a
 * place that lists the rehearsals as cards.
 *
 * At desk width (1280), on the routed face and the scene, in three engines
 * and both schemes, it asks:
 *
 *   a record's page says the phone grouped as a US reader reads it, as a
 *   tel: link that calls it, and the place as a link that opens the
 *   reader's maps app in a tab of its own (noopener), each a target at
 *   least 24 pixels; the duration is said "1 h 30 min", never "90";
 *   a season's sum of its rehearsals' durations is said as a duration, and
 *   so is what is left of the time it planned;
 *   a duration changed in place is typed "2h 15m" and kept as 135 minutes;
 *   the form that adds a rehearsal asks for the phone in a tel box and the
 *   duration in words, and sends the minutes;
 *   the place's cards link the phone and the place, and say the duration;
 *   the scene's record panel links them as the page does.
 *
 *   node scripts/verify-field-types.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
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
const REHEARSALS = resolve(repoRoot, "scripts/fixtures/field-types/rehearsals.gdd.json");
const REHEARSALS_SEED = resolve(repoRoot, "scripts/fixtures/field-types/rehearsals.seed.json");
const DESK = { width: 1280, height: 800 };
/** Where a place opens: Apple's Maps on Apple's platforms, Google's universal Maps address elsewhere. */
const MAPS = /^https:\/\/(?:maps\.apple\.com\/\?q=|www\.google\.com\/maps\/search\/\?api=1&query=)/;

const report = { at: new Date().toISOString(), engines, schemes: SCHEMES, width: DESK.width, checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rehearsals</title>
<style>body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#f7f7f4;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the page IS the app, as Cloud's shell mounts it, said in en-US. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-field-types-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import rehearsals from ${JSON.stringify(REHEARSALS)};
        import seed from ${JSON.stringify(REHEARSALS_SEED)};
        const query = new URLSearchParams(location.search);
        const compiled = compileDocumentWithoutCheck(rehearsals, { today: () => "2026-10-13" });
        if (!compiled.ok) {
          window.__failed = compiled.findings.map((finding) => finding.message).join("; ");
          window.__ready = true;
        } else {
          window.__handle = mount(document.getElementById("app"), {
            app: compiled.app,
            seed,
            face: query.get("face") === "graview" ? "graview" : "pages",
            routing: "address",
            principal: { kind: "human", id: "u:owner", roles: ["owner"] },
            label: compiled.app.name,
            heading: 1,
            height: "100dvh",
            fonts: false,
            studio: false,
            locale: "en-US",
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
  await new Promise((ready) => host.listen(portFor("field-types-host"), ready));
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

/** Every phone and place link drawn under `scope`: its words, where it leads, how it opens, and its size. */
function linksIn(scope) {
  return [...document.querySelectorAll(`${scope} a[href^="tel:"], ${scope} a[href^="https://maps.apple.com/"], ${scope} a[href^="https://www.google.com/maps/"]`)].map((one) => {
    const box = one.getBoundingClientRect();
    return {
      field: one.getAttribute("data-graview-link"),
      text: one.textContent,
      label: one.getAttribute("aria-label"),
      href: one.getAttribute("href"),
      target: one.getAttribute("target"),
      rel: one.getAttribute("rel"),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  });
}
const textOf = (page, scope) => page.evaluate((scope) => document.querySelector(scope)?.textContent ?? "", scope);
const isCall = (link, href) => Boolean(link) && link.href === href && link.target === null && link.height >= 24 && link.width >= 24;
const isMap = (link, place) => Boolean(link) && MAPS.test(link.href) && decodeURIComponent(link.href).endsWith(place) && link.target === "_blank" && /noopener/.test(link.rel ?? "") && link.height >= 24 && link.width >= 24;

const host = await buildHost();
const errors = [];
const seen = { record: [], season: [], changed: [], form: [], cards: [], scene: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const where = { engine, scheme, width: DESK.width };
      const open = async (path, query) => {
        const context = await browser.newContext({ viewport: DESK, colorScheme: scheme, locale: "en-US" });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${scheme} ${path}?${query}: ${error.message}`));
        await page.goto(`${at("field-types-host")}${path}?${query}`, { waitUntil: "load" });
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

      /* A RECORD'S PAGE: the phone grouped and called, the place mapped, the duration said. */
      await attempt(seen.record, "/rehearsals/first", "face=pages", async (page) => {
        await until(page, () => page.evaluate((facts) => document.querySelectorAll(`${facts} a[data-graview-link]`).length >= 2, facts));
        const said = await textOf(page, facts);
        await shot(page, "record");
        return { links: await page.evaluate(linksIn, facts), saysGrouped: said.includes("(555) 123-4567"), saysDuration: said.includes("1 h 30 min"), saysMinutes: /\b90\b/.test(said) };
      });

      /* A SEASON: its rehearsals' durations added up, and what is left of the time it planned. */
      await attempt(seen.season, "/seasons/autumn", "face=pages", async (page) => {
        await until(page, () => textOf(page, facts).then((said) => said.includes("Time rehearsed")));
        const facts_ = await page.evaluate((facts) => Object.fromEntries([...document.querySelectorAll(`${facts} dt`)].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent ?? ""])), facts);
        await shot(page, "season");
        return { facts: facts_ };
      });

      /* CHANGED IN PLACE: typed as a person says it, kept as minutes. */
      await attempt(seen.changed, "/rehearsals/sectional", "face=pages", async (page) => {
        await page.locator(`${facts} button[data-graview-editable][data-graview-field="length"]`).click();
        const input = page.locator(`${facts} input[data-graview-field="length"]`);
        const type = await input.getAttribute("type");
        await input.fill("2h 15m");
        await input.press("Enter");
        const kept = await until(page, () => page.evaluate(() => window.__handle.store.graph.getNode("sectional")?.length === 135));
        const said = await until(page, () => textOf(page, facts).then((said) => said.includes("2 h 15 min")));
        return { type, kept, said };
      });

      /* THE FORM THAT ADDS ONE: a tel box for the phone, words for the duration, minutes sent. */
      await attempt(seen.form, "/rehearsals", "face=pages", async (page) => {
        await page.getByRole("button", { name: /add a rehearsal/i }).first().click();
        const form = page.locator("form").filter({ has: page.locator('input[name="contact"]') }).first();
        await form.waitFor({ timeout: 10_000 });
        // The opened form puts the keyboard in its first box; typing before it has would land there.
        await until(page, () => page.evaluate(() => document.activeElement?.getAttribute("name") === "name"), 3_000);
        await page.waitForTimeout(200);
        const phoneType = await form.locator('input[name="contact"]').getAttribute("type");
        const durationType = await form.locator('input[name="length"]').getAttribute("type");
        await form.locator('input[name="name"]').fill("Concert warm-up");
        await form.locator('input[name="contact"]').fill("(555) 987-6543");
        await form.locator('input[name="venue"]').fill("Riverside Church");
        await form.locator('input[name="length"]').fill("1:15");
        await shot(page, "form");
        await form.locator('button[type="submit"]').click();
        const made = await until(page, () => page.evaluate(() => window.__handle.store.graph.allNodes().some((node) => node.name === "Concert warm-up" && node.length === 75 && node.contact === "(555) 987-6543")));
        return { phoneType, durationType, made };
      });

      /* THE PLACE'S CARDS: each phone a call, each place a map, each duration said. */
      await attempt(seen.cards, "/places/the-calendar", "face=pages", async (page) => {
        await until(page, () => page.evaluate(() => document.querySelectorAll(".graview-spec-field a").length >= 5));
        const cards = await page.evaluate(linksIn, "body");
        const said = await page.evaluate(() => [...document.querySelectorAll(".graview-spec-field")].map((one) => one.textContent));
        await shot(page, "cards");
        return { cards, said };
      });

      /* THE SCENE: the record's panel links them as the page does. */
      await attempt(seen.scene, "/places/overview", "face=graview#focus=first", async (page) => {
        await until(page, () => page.evaluate(() => document.querySelectorAll("[data-graview-fields] a[data-graview-link]").length >= 2), 20_000);
        const links = await page.evaluate(linksIn, "[data-graview-fields]");
        const said = await textOf(page, "[data-graview-fields]");
        await shot(page, "scene");
        return { links, saysDuration: said.includes("1 h 30 min") };
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
const VENUE = "St. Mark's Hall, 12 Elm Street, Springfield";

report.checks.aRecordsPhoneIsGroupedAndCallsIt = {
  seen: seen.record,
  ok: all(seen.record, (one) => one.saysGrouped && isCall(one.links.find((link) => link.field === "contact"), "tel:5551234567")),
};
report.checks.aRecordsPlaceOpensTheReadersMapsAppApart = {
  seen: seen.record,
  ok: all(seen.record, (one) => isMap(one.links.find((link) => link.field === "venue"), VENUE)),
};
report.checks.aDurationIsSaidInHoursAndMinutes = {
  seen: seen.record,
  ok: all(seen.record, (one) => one.saysDuration && !one.saysMinutes),
};
report.checks.aSumOfDurationsIsSaidAsADuration = {
  seen: seen.season,
  ok: all(seen.season, (one) => one.facts["Time rehearsed"] === "2 h 15 min" && one.facts["Time to spare"] === "7 h 45 min" && one.facts["Time planned"]?.includes("10 h") && one.facts["Rehearsals"] === "2"),
};
report.checks.aDurationChangedInPlaceIsTypedAsWordsAndKeptAsMinutes = {
  seen: seen.changed,
  ok: all(seen.changed, (one) => one.type === "text" && one.kept && one.said),
};
report.checks.theFormAsksForAPhoneAndADurationAsThemselves = {
  seen: seen.form,
  ok: all(seen.form, (one) => one.phoneType === "tel" && one.durationType === "text" && one.made),
};
report.checks.thePlacesCardsCallMapAndSayADuration = {
  seen: seen.cards,
  ok: all(
    seen.cards,
    (one) =>
      one.cards.some((link) => isCall(link, "tel:5551234567") && link.text === "(555) 123-4567") &&
      one.cards.some((link) => isCall(link, "tel:+442079460958") && link.text === "+44 20 7946 0958") &&
      one.cards.filter((link) => MAPS.test(link.href ?? "") && link.target === "_blank" && /noopener/.test(link.rel ?? "")).length === 3 &&
      ["1 h 30 min", "45 min", "2 h 30 min"].every((duration) => one.said.some((text) => text.includes(duration))),
  ),
};
report.checks.theScenesRecordPanelLinksThemAsThePageDoes = {
  seen: seen.scene,
  ok: all(seen.scene, (one) => one.saysDuration && isCall(one.links.find((link) => link.field === "contact"), "tel:5551234567") && isMap(one.links.find((link) => link.field === "venue"), VENUE)),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/field-types.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/field-types.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
