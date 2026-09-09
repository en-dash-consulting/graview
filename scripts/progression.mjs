#!/usr/bin/env node
/**
 * The garden, grown a chapter at a time — photographed.
 *
 * `apps/seedbed/src/domain/chapters.ts` is the progression the docs and the
 * marketing page teach from: one example, seven chapters, each a real
 * declaration with the seed it has earned. This opens every chapter in a
 * browser at the stop it names, in both schemes, and writes what it saw —
 * the check's verdict, what Standing says, what the districts say — so a
 * page built from these pictures cannot drift from the framework.
 *
 *   node scripts/progression.mjs [--engine=chromium|webkit|firefox] [--keep-vite]
 *
 * Writes docs/progression/NN-slug-{light,dark}.png and docs/progression.json.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const out = resolve(repoRoot, "docs/progression");
mkdirSync(out, { recursive: true });
const port = 5194;

// The chapters themselves, from the compiled app: the same objects the page opens.
const { CHAPTERS } = await import(pathToFileURL(resolve(repoRoot, "apps/seedbed/dist/domain/chapters.js")).href);
const { checkApp } = await import(pathToFileURL(resolve(repoRoot, "packages/core/dist/index.js")).href);
const { aggregateId } = await import(pathToFileURL(resolve(repoRoot, "packages/layout/dist/index.js")).href);

function startVite() {
  const child = spawn("npx", ["vite"], { cwd: resolve(repoRoot, "apps/seedbed"), stdio: ["ignore", "pipe", "pipe"], detached: true });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start")), 60_000);
    child.stdout.on("data", (chunk) => { if (String(chunk).includes(String(port))) { clearTimeout(timer); ready(child); } });
    child.on("exit", (code) => { clearTimeout(timer); fail(new Error(`vite exited with ${code}`)); });
  });
}

const report = { at: new Date().toISOString(), engine: engineName(), chapters: [] };
let vite;
let browser;
try {
  vite = await startVite();
  browser = await launchEngine(engineName(), { headless: true });
  for (const chapter of CHAPTERS) {
    const check = checkApp(chapter.app);
    const entry = {
      n: chapter.n,
      slug: chapter.slug,
      title: chapter.title,
      claim: chapter.claim,
      adds: chapter.adds,
      kinds: [...chapter.app.schema.kinds],
      mutations: (chapter.app.mutations ?? []).map((m) => m.name),
      invariants: (chapter.app.invariants ?? []).map((i) => i.name),
      check: { ok: check.ok, errors: check.errors, warnings: check.warnings, findings: check.findings.map((f) => f.code) },
      pictures: {},
      errors: [],
    };
    // A fresh context per chapter: what one chapter remembered must not leak into the next.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => entry.errors.push(String(error.message ?? error)));
    page.on("console", (message) => { if (message.type() === "error") entry.errors.push(message.text()); });
    for (const scheme of ["light", "dark"]) {
      const remember = chapter.remembers ? "&remember=1" : "";
      // A stop may name an aggregate by kind; the id is the layout's to mint.
      const stop = chapter.stop.replace(/agg:([a-z-]+)/g, (_, kind) => aggregateId(kind));
      await page.goto(`http://localhost:${port}/?chapter=${chapter.n}&theme=${scheme}${remember}${stop}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 30_000 });
      await page.waitForTimeout(900);
      if (chapter.drive === "activity") {
        if (chapter.seat && scheme === "light" && chapter.seed.nodes.length === 0) {
          // The seat plants the starter garden: the picture is what it did.
          await page.click('[data-testid="activity-button"]');
          await page.waitForTimeout(300);
          await page.click('[data-testid="agent-starter"]');
          await page.waitForTimeout(2200);
        } else {
          await page.click('[data-testid="activity-button"]');
          await page.waitForTimeout(400);
        }
      }
      if (chapter.drive === "select-plot") {
        await page.click('[data-graview-view="kind:plot"]');
        await page.waitForTimeout(500);
      }
      const file = `${String(chapter.n).padStart(2, "0")}-${chapter.slug}-${scheme}.png`;
      await page.screenshot({ path: resolve(out, file) });
      entry.pictures[scheme] = `docs/progression/${file}`;
      if (scheme === "light") {
        entry.saw = await page.evaluate(() => ({
          standing: document.querySelector('[data-testid="standing"]')?.textContent?.trim() ?? null,
          districts: [...document.querySelectorAll('[data-graview-view^="kind:"]')].map((el) => el.textContent?.trim().replace(/\s+/g, " ") ?? ""),
          trail: document.querySelector("header")?.textContent?.trim().replace(/\s+/g, " ").slice(0, 160) ?? null,
          withheld: document.querySelector('[data-testid="withheld"]')?.textContent?.trim() ?? null,
          activity: [...document.querySelectorAll('[data-testid="diff-log"] li')].map((li) => li.textContent?.trim().replace(/\s+/g, " ") ?? "").slice(0, 6),
          remembered: document.querySelector('[data-testid="remembered"]')?.textContent?.trim() ?? null,
          wordmark: document.querySelector("header h1")?.textContent?.trim() ?? null,
          focused: document.querySelector('[data-graview-plane="0"]')?.textContent?.trim().replace(/\s+/g, " ").slice(0, 200) ?? null,
        }));
      }
    }
    await context.close();
    report.chapters.push(entry);
    process.stdout.write(`${entry.n} ${entry.slug}: check ${check.ok ? "ok" : "FAILED"} · ${entry.saw?.standing ?? ""} · ${entry.errors.length} console errors\n`);
  }
} catch (error) {
  report.error = String(error?.stack ?? error).slice(0, 4000);
  process.stdout.write(`${report.error}\n`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (vite && !process.argv.includes("--keep-vite")) { try { process.kill(-vite.pid, "SIGTERM"); } catch {} }
}
report.verdict = {
  everyChapterChecksClean: report.chapters.length === CHAPTERS.length && report.chapters.every((c) => c.check.ok),
  everyChapterRenderedWithoutErrors: report.chapters.every((c) => c.errors.length === 0 && c.pictures.light && c.pictures.dark),
  theRuleFiresInChapterThree: /1 problem|1 /.test(report.chapters[2]?.saw?.standing ?? ""),
  theHorizonShowsInChapterFour: (report.chapters[3]?.saw?.districts ?? []).some((d) => /past/.test(d)),
  theSeatPlantedInChapterFive: (report.chapters[4]?.saw?.activity ?? []).length > 0,
  itRemembersInChapterSix: /Remembered/.test(report.chapters[5]?.saw?.remembered ?? ""),
  aGardenerIsRefusedInChapterSeven: (report.chapters[6]?.saw?.withheld ?? "") !== "",
  theBrandArrivesInChapterEight: report.chapters[6]?.saw?.wordmark === "Graview" && report.chapters[7]?.saw?.wordmark === "Seedbed",
  theLensShowsWhoTendsWhatInChapterNine: /June/.test(report.chapters[8]?.saw?.focused ?? "") && /Plot 2/.test(report.chapters[8]?.saw?.focused ?? ""),
  theMigrationIsInTheLogInChapterTen: (report.chapters[9]?.saw?.activity ?? []).some((line) => /agreement|migration/i.test(line)),
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;
writeFileSync(resolve(repoRoot, "docs/progression.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n`);
process.exit(report.passed ? 0 : 1);
