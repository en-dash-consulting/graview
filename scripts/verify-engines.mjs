#!/usr/bin/env node
/**
 * The DOM path is a citizen of every browser — proven, not assumed.
 *
 * Every harness verdict used to be a one-browser verdict. This runs the core
 * subset — audit, direct manipulation, the pages face at phone width, one
 * survey pass — against Chromium, WebKit and Firefox, and writes per-engine
 * verdicts into one JSON. iOS Safari is the mobile browser and the pages
 * face exists for mobile, so WebKit here is a launch gate, not polish.
 *
 * Two more things are VERIFIED rather than assumed, because each is a claim
 * about an engine we do not ship in:
 *
 *  - The altitude morph rides a registered `@property`. Where that is
 *    unsupported (Firefox before 128 — ESR-class engines), the transition
 *    must degrade to a clean cut, not a broken half-state. Firefox is
 *    launched with the feature turned OFF and the cut is measured.
 *
 *  - The local-AI rung needs WebGPU (or Chrome's Prompt API). In an engine
 *    with neither, the chat must answer from the graph and the header must
 *    say why. Firefox is launched with WebGPU off and the fallback driven.
 *
 *   node scripts/verify-engines.mjs [--engines=chromium,webkit,firefox]
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox } from "playwright";
import { ENGINES } from "./lib/engine.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chosen =
  process.argv
    .find((a) => a.startsWith("--engines="))
    ?.slice("--engines=".length)
    .split(",")
    .filter(Boolean) ?? ENGINES;

const say = (line) => process.stdout.write(`${line}\n`);

/** Runs one harness to completion, streaming nothing, returning its exit code. */
function run(args) {
  return new Promise((done) => {
    const child = spawn("node", args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    const keep = (chunk) => {
      tail = (tail + String(chunk)).slice(-2000);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    child.on("exit", (code) => done({ code: code ?? 1, tail }));
  });
}

/*
 * A child's report file is deleted BEFORE the child runs and required
 * AFTER: a harness that crashed before its write must fail this engine's
 * cell rather than crash the matrix or, worse, hand the previous engine's
 * report over as this one's.
 */
const clearReport = (file) => rmSync(resolve(repoRoot, file), { force: true });
const readReport = (file) =>
  existsSync(resolve(repoRoot, file))
    ? JSON.parse(readFileSync(resolve(repoRoot, file), "utf8"))
    : null;

function startVite(name, port) {
  const child = spawn("npx", ["vite"], {
    cwd: resolve(repoRoot, `apps/${name}`),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start")), 60_000);
    child.stdout.on("data", (c) => {
      if (String(c).includes(String(port))) {
        clearTimeout(timer);
        ready(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`vite exited with ${code}`));
    });
  });
}

const stopVite = (child) => {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
};

/* ------------------------------------------------- the per-engine matrix */

/*
 * A stale vite holding a port fails the FIRST harness that wants it, which
 * then reads as an engine failure. Refusing to start is the honest version:
 * the matrix's verdicts must never depend on what a crashed earlier run
 * left behind.
 */
const { createServer } = await import("node:net");
for (const port of [5190, 5191, 5192, 5193, 5194]) {
  await new Promise((free, taken) => {
    const probe = createServer();
    probe.once("error", () =>
      taken(new Error(`Port ${port} is already held — kill the stale dev server first (pkill -f vite).`)),
    );
    probe.once("listening", () => probe.close(free));
    probe.listen(port, "127.0.0.1");
  });
}

const matrix = { at: new Date().toISOString(), engines: {}, degradation: null, capability: null };

for (const engine of chosen) {
  say(`\n=== ${engine} ===`);
  const results = {};

  say(`  audit-ui …`);
  clearReport("docs/audit.json");
  const audit = await run(["scripts/audit-ui.mjs", `--engine=${engine}`]);
  const auditReport = readReport("docs/audit.json");
  const auditErrors = (auditReport?.screens ?? [])
    .filter((s) => s.error)
    .map((s) => `${s.app}/${s.state}: ${s.error}`);
  results.audit = auditReport
    ? {
        ok: audit.code === 0 && auditErrors.length === 0,
        screens: auditReport.screens.length,
        ...(auditErrors.length > 0 ? { errors: auditErrors } : {}),
      }
    : { ok: false, error: `audit wrote no report — ${audit.tail.slice(-300)}` };
  say(`  audit: ${results.audit.ok ? "ok" : "FAIL"} (${results.audit.screens ?? "no"} screens)`);

  say(`  verify-pages (390×844 first) …`);
  clearReport("docs/pages-face.json");
  const pages = await run(["scripts/verify-pages.mjs", `--engine=${engine}`]);
  const pagesReport = readReport("docs/pages-face.json");
  const flatChecks = JSON.stringify(pagesReport?.checks ?? {});
  results.pages = pagesReport
    ? {
        ok: pages.code === 0 && !flatChecks.includes("false"),
        ...(pagesReport.error ? { error: pagesReport.error } : {}),
      }
    : { ok: false, error: `pages wrote no report — ${pages.tail.slice(-300)}` };
  say(`  pages: ${results.pages.ok ? "ok" : "FAIL"}`);

  say(`  survey-ui (one pass, todo) …`);
  clearReport("docs/survey.json");
  const survey = await run(["scripts/survey-ui.mjs", "todo", `--engine=${engine}`]);
  const surveyReport = readReport("docs/survey.json");
  // The exit code AND the shots: a survey that photographed nothing, or
  // errored per shot, must not read as an engine holding.
  const shotErrors = (surveyReport?.shots ?? [])
    .filter((shot) => shot.error)
    .map((shot) => `${shot.app}/${shot.state}/${shot.scheme}: ${shot.error}`);
  results.survey = surveyReport
    ? {
        ok: survey.code === 0 && shotErrors.length === 0 && surveyReport.shots.length > 0,
        shots: surveyReport.shots.length,
        ...(shotErrors.length > 0 ? { errors: shotErrors.slice(0, 5) } : {}),
      }
    : { ok: false, error: `survey wrote no report — ${survey.tail.slice(-300)}` };
  say(`  survey: ${results.survey.ok ? "ok" : "FAIL"}`);

  matrix.engines[engine] = results;
}

/* --------------------------- degradation: the morph must cut, not break */

async function verifyAltitudeCut() {
  const vite = await startVite("todo", 5193);
  // ESR-class Firefox: registered custom properties OFF. The morph cannot
  // interpolate; the check is that it lands, instantly and completely.
  const browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: { "layout.css.properties-and-values.enabled": false },
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    const unsupported = await page.evaluate(() => typeof globalThis.CSSPropertyRule === "undefined");
    await page.click('[data-testid="overview"]');
    // Sample INSIDE the 640ms transition window: with @property off there
    // is no transition, so the grid must already be gone — a clean cut.
    await page.waitForTimeout(250);
    const cut = await page.evaluate(() => {
      const ground = document.querySelector(".graview-ground");
      if (!ground) return { grid: "missing" };
      // The control's mark rides the same property, so it must cut too:
      // the wings already gone, the label already the way back down.
      const control = document.querySelector('[data-testid="overview"]');
      const wing = control?.querySelector(".graview-altitude-mark-wing");
      return {
        grid: getComputedStyle(ground, "::before").opacity,
        altitude: getComputedStyle(ground).getPropertyValue("--graview-altitude").trim(),
        overview: document.querySelector("[data-graview-altitude]") !== null,
        markWing: wing ? getComputedStyle(wing).opacity : "missing",
        controlLabel: control?.textContent.trim() ?? null,
      };
    });
    return {
      ok:
        unsupported &&
        cut.grid === "0" &&
        cut.overview &&
        cut.markWing === "0" &&
        cut.controlLabel === "Focus" &&
        errors.length === 0,
      registeredPropertiesDisabled: unsupported,
      gridOpacityAt250ms: cut.grid,
      markWingOpacityAt250ms: cut.markWing,
      controlLabelAt250ms: cut.controlLabel,
      overviewReached: cut.overview,
      ...(errors.length > 0 ? { pageErrors: errors.slice(0, 5) } : {}),
    };
  } finally {
    await browser.close();
    stopVite(vite);
  }
}

/* -------------------- capability: no WebGPU, no Prompt API, graph answers */

async function verifyLocalFallback() {
  const vite = await startVite("todo", 5193);
  // An engine with neither Chrome's Prompt API nor WebGPU: Firefox with
  // WebGPU explicitly off, so the verdict does not ride a default that
  // shifts under us when Firefox ships WebGPU on this platform.
  const browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: { "dom.webgpu.enabled": false },
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
    // The person chose the local rung; this browser cannot run it.
    await page.addInitScript(() => {
      localStorage.setItem("graview:intelligence", JSON.stringify({ source: "local" }));
    });
    await page.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    const engineFacts = await page.evaluate(() => ({
      webgpu: "gpu" in navigator,
      promptApi: "LanguageModel" in globalThis,
    }));
    await page.click('[data-testid="chat"]');
    await page.fill('[aria-label="Message the seat"]', "what is here?");
    await page.press('[aria-label="Message the seat"]', "Enter");
    // The graph floor answers while the rung tries to warm; the warm-up
    // fails fast (no WebGPU) and the header says why.
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="chat-panel"] ol li').length >= 2,
      null,
      { timeout: 20_000 },
    );
    await page.waitForFunction(
      () => {
        const source = document.querySelector('[data-testid="chat-source"]');
        return source !== null && /graph answering/.test(source.textContent ?? "");
      },
      null,
      { timeout: 20_000 },
    );
    const header = await page.evaluate(() => {
      const source = document.querySelector('[data-testid="chat-source"]');
      return { text: source?.textContent ?? "", title: source?.getAttribute("title") ?? "" };
    });
    const answered = await page.evaluate(
      () => document.querySelector('[data-testid="chat-panel"] ol li:last-child')?.textContent ?? "",
    );
    return {
      ok:
        !engineFacts.webgpu &&
        !engineFacts.promptApi &&
        /graph answering/.test(header.text) &&
        /WebGPU/.test(header.text + header.title) &&
        answered.length > 0,
      engineFacts,
      header,
      answeredFromGraph: answered.slice(0, 120),
    };
  } finally {
    await browser.close();
    stopVite(vite);
  }
}

say(`\n=== degradation: altitude morph without @property (Firefox, feature off) ===`);
matrix.degradation = await verifyAltitudeCut();
say(`  ${matrix.degradation.ok ? "ok — clean cut" : `FAIL ${JSON.stringify(matrix.degradation)}`}`);

say(`\n=== capability: local rung without WebGPU/Prompt API (Firefox, WebGPU off) ===`);
matrix.capability = await verifyLocalFallback();
say(`  ${matrix.capability.ok ? "ok — graph answered, header says why" : `FAIL ${JSON.stringify(matrix.capability)}`}`);

/* ------------------------------------------------------------ the verdict */

const engineOk = Object.values(matrix.engines).every((results) =>
  Object.values(results).every((r) => r.ok),
);
matrix.passed = engineOk && matrix.degradation.ok && matrix.capability.ok;

writeFileSync(resolve(repoRoot, "docs/engine-matrix.json"), `${JSON.stringify(matrix, null, 2)}\n`);
say(`\nwrote docs/engine-matrix.json`);
for (const [engine, results] of Object.entries(matrix.engines)) {
  say(
    `${engine.padEnd(9)} ${Object.entries(results)
      .map(([name, r]) => `${name}:${r.ok ? "ok" : "FAIL"}`)
      .join("  ")}`,
  );
}
say(`degradation:${matrix.degradation.ok ? "ok" : "FAIL"}  capability:${matrix.capability.ok ? "ok" : "FAIL"}`);
say(matrix.passed ? "\nevery engine holds" : "\nAN ENGINE DOES NOT HOLD");
process.exit(matrix.passed ? 0 : 1);
