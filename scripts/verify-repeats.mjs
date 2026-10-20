#!/usr/bin/env node
/**
 * A DATE THAT REPEATS: A WEEKLY PRACTICE.
 *
 * A date field declared `"repeats": true` keeps its first occurrence and,
 * beside it, how it repeats; the occurrences are worked out, never stored.
 * The app is a running club's document mounted the way Cloud mounts one
 * (`scripts/fixtures/repeats/club.gdd.json`): "Tuesday run" every Tuesday at
 * six since Sep 1, the Oct 13 one skipped, and a one-off "Club dinner" on
 * Oct 24. The page's clock is held at noon on Wednesday, Oct 21, 2026.
 *
 * At desk width, in three engines and both schemes, it asks:
 *
 *   the kind's stop opens on a calendar of October that draws the practice
 *   on every Tuesday the grid shows — each marked as a repeat, the skipped
 *   one left out — and the dinner once; the stop counts the practice among
 *   what falls in the next seven days, by its next occurrence; the record's
 *   page says "Every Tuesday at 6:00 PM, next Oct 27"; and its control
 *   beside the date changes how it repeats, said back in words as it is
 *   chosen, and kept by the act that writes it.
 *
 *   node scripts/verify-repeats.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
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
import { vacant } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const SCHEMES = QUICK ? ["light"] : ["light", "dark"];
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const CLUB = resolve(repoRoot, "scripts/fixtures/repeats/club.gdd.json");
const CLUB_SEED = resolve(repoRoot, "scripts/fixtures/repeats/club.seed.json");
const DESK = { width: 1280, height: 900 };
/** Noon on a Wednesday, where the page is: the next Tuesday is Oct 27. */
const NOW = new Date(2026, 9, 21, 12, 0, 0);

const report = { at: new Date().toISOString(), engines, schemes: SCHEMES, width: DESK.width, checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The running club</title>
<style>body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#f7f7f4;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the page IS the app, as Cloud's shell mounts it. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-repeats-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import club from ${JSON.stringify(CLUB)};
        import seed from ${JSON.stringify(CLUB_SEED)};
        const query = new URLSearchParams(location.search);
        const compiled = compileDocumentWithoutCheck(club);
        if (!compiled.ok) {
          window.__failed = compiled.findings.map((finding) => finding.message).join("; ");
          window.__ready = true;
        } else {
          window.__handle = mount(document.getElementById("app"), {
            app: compiled.app,
            seed,
            face: query.get("face") === "graview" ? "graview" : "pages",
            routing: "address",
            principal: { kind: "human", id: "u:coach", roles: ["coach"] },
            label: compiled.app.name,
            heading: 1,
            height: "100dvh",
            fonts: false,
            studio: false,
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
    response.writeHead(200, { "content-type": script ? "text/javascript" : "text/html" });
    response.end(readFileSync(script ? file : join(out, "index.html")));
  });
  await vacant(portFor("repeats-host"));
  await new Promise((ready) => host.listen(portFor("repeats-host"), ready));
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

const host = await buildHost();
const errors = [];
const seen = { calendar: [], soon: [], said: [], changed: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const where = { engine, scheme, width: DESK.width };
      const open = async (path, query) => {
        const context = await browser.newContext({ viewport: DESK, colorScheme: scheme });
        const page = await context.newPage();
        await page.clock.setFixedTime(NOW);
        page.on("pageerror", (error) => errors.push(`${engine} ${scheme} ${path}?${query}: ${error.message}`));
        await page.goto(`${at("repeats-host")}${path}?${query}`, { waitUntil: "load" });
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
      const attempt = async (list, path, query, run) => {
        const { page, close } = await open(path, query);
        try {
          list.push({ ...where, ...(await run(page)) });
        } catch (error) {
          list.push({ ...where, error: String(error.message ?? error).split("\n")[0] });
        }
        await close();
      };

      /* THE KIND'S STOP: a calendar of October, the practice on each Tuesday, and what falls in the next seven days. */
      await attempt(seen.calendar, "/places/overview", "face=graview#focus=aggregate:practice", async (page) => {
        await page.waitForSelector('[data-testid="kind-stop"]', { timeout: 20_000 });
        await until(page, () => page.evaluate(() => document.querySelectorAll('[data-testid="kind-stop"] [data-calendar-entry]').length > 0));
        const drawn = await page.evaluate(() => {
          const stop = document.querySelector('[data-testid="kind-stop"]');
          const entries = [...stop.querySelectorAll("[data-calendar-entry]")];
          return {
            range: stop.querySelector('[data-testid="calendar"]')?.getAttribute("data-calendar-range") ?? null,
            repeats: entries.filter((one) => one.getAttribute("data-calendar-entry") === "tuesdays").map((one) => ({ on: one.getAttribute("data-calendar-repeat"), title: one.getAttribute("title"), draggable: one.getAttribute("draggable") })),
            dinner: entries.filter((one) => one.getAttribute("data-calendar-entry") === "dinner").map((one) => one.getAttribute("data-calendar-in")),
            soon: stop.querySelector('[data-testid="kind-stop-dates"]')?.textContent?.trim() ?? null,
          };
        });
        await shot(page, "stop");
        // The same stop as a table: the practice's row says how it repeats and the next one.
        await page.locator('[data-testid="kind-stop"]').getByRole("button", { name: "Table", exact: true }).click();
        await until(page, () => page.evaluate(() => document.querySelector('[data-testid="kind-stop-table"]') !== null));
        const row = await page.evaluate(() => [...document.querySelectorAll('[data-testid="kind-stop-table"] tbody tr')].map((one) => one.textContent ?? "").find((text) => text.includes("Tuesday run")) ?? null);
        seen.soon.push({ ...where, soon: drawn.soon, row });
        return drawn;
      });

      /* THE RECORD'S PAGE: how it repeats and the next one, in words; and the control beside it changes how. */
      await attempt(seen.said, "/practices/tuesdays", "face=pages", async (page) => {
        const facts = '[data-testid="record-fields"]';
        await page.waitForSelector(facts, { timeout: 20_000 });
        const said = await page.evaluate((facts) => document.querySelector(facts)?.textContent ?? "", facts);
        const open = page.locator(`${facts} [data-graview-repeat-open="startsAt"]`);
        await open.waitFor({ timeout: 10_000 });
        await open.click();
        await page.waitForSelector('[data-graview-repeat="startsAtRepeat"]', { timeout: 10_000 });
        const before = await page.evaluate(() => document.querySelector("[data-graview-repeat-said]")?.textContent ?? null);
        await page.getByRole("group", { name: "On" }).getByLabel("Thu").check();
        const chosen = await page.evaluate(() => document.querySelector("[data-graview-repeat-said]")?.textContent ?? null);
        const labeled = await page.evaluate(() => {
          const set = document.querySelector('[data-graview-repeat="startsAtRepeat"]');
          return [...set.querySelectorAll("input, select")].every((control) => control.labels?.length > 0 || control.getAttribute("aria-label"));
        });
        await shot(page, "picker");
        await page.locator('[data-graview-repeat-keep="startsAt"]').click();
        const kept = await until(page, () => page.evaluate((facts) => (document.querySelector(facts)?.textContent ?? "").includes("Every Tuesday and Thursday at 6:00 PM, next Oct 22"), facts));
        seen.changed.push({ ...where, before, chosen, labeled, kept });
        return { said: said.includes("Every Tuesday at 6:00 PM, next Oct 27") };
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
const TUESDAYS = ["2026-09-29", "2026-10-06", "2026-10-20", "2026-10-27", "2026-11-03"];

report.checks.theCalendarDrawsEachOccurrenceOfAWeeklyPracticeMarkedAndLeavesOutTheSkippedOne = {
  seen: seen.calendar,
  ok: all(seen.calendar, (one) => one.range === "month" && JSON.stringify(one.repeats.map((entry) => entry.on)) === JSON.stringify(TUESDAYS) && one.repeats.every((entry) => entry.title?.endsWith("· repeats") && entry.draggable === "false") && JSON.stringify(one.dinner) === JSON.stringify(["2026-10-24"])),
};
report.checks.theKindsStopCountsAPracticeByItsNextOccurrenceAndSaysIt = {
  seen: seen.soon,
  ok: all(seen.soon, (one) => /^2\s+in the next 7 days by starts$/.test(one.soon ?? "") && (one.row ?? "").includes("Every Tuesday at 6:00 PM, next Oct 27")),
};
report.checks.theRecordSaysHowItRepeatsAndTheNextOne = { seen: seen.said, ok: all(seen.said, (one) => one.said) };
report.checks.theControlBesideTheDateChangesHowItRepeatsSaidInWords = {
  seen: seen.changed,
  ok: all(seen.changed, (one) => one.before === "Every Tuesday at 6:00 PM" && one.chosen === "Every Tuesday and Thursday at 6:00 PM" && one.labeled && one.kept),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/repeats.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/repeats.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
