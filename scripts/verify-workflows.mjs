#!/usr/bin/env node
/**
 * AN APP'S WORKFLOWS ON THE SCENE'S MAP (Roadmap f-jobs-declared).
 *
 * A workflow is the app's own actor at work on some districts. The app is
 * a household's document mounted the way Cloud mounts one
 * (`packages/core/tests/document/fixtures/workflows.gdd.json`): routines,
 * plan items, a week of events and grocery lists, and three workflows —
 * "Fill out next week's events" (an act over the routines, making events),
 * "Keep events in step with plan items" (a model reading plan items and
 * events, proposing an event's edit) and "Set aside done grocery lists",
 * paused. The host hands a log of runs: the first ran two hours before the
 * page's clock and made 28 events; the others never ran.
 *
 * From altitude, at desk width, in three engines and both schemes, it asks:
 *
 *   each workflow stands on the map, wired solid to the districts it
 *   writes and dashed to those it only reads; none stands on a district's
 *   ground; the paused one is drawn dimmed and says "Paused"; each says
 *   its last run in words ("Last ran 2 hours ago: made 28", "Has not run
 *   yet"); and a screen reader is told what each is, what it reads and
 *   writes, by what the kinds are called, and how its last run went.
 *
 *   node scripts/verify-workflows.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
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
const HOUSEHOLD = resolve(repoRoot, "packages/core/tests/document/fixtures/workflows.gdd.json");
const DESK = { width: 1440, height: 900 };
/** Eight in the evening on Sunday, Oct 25, 2026, where the page is: the first workflow ran at six. */
const NOW = new Date(2026, 9, 25, 20, 0, 0);
const RAN = new Date(2026, 9, 25, 18, 0, 0).toISOString();

const SEED = {
  nodes: [
    { id: "r1", kind: "routine", name: "Swim practice", active: true },
    { id: "r2", kind: "routine", name: "Piano lesson", active: true },
    { id: "p1", kind: "plan-item", name: "Dentist", date: "2026-10-28" },
    { id: "p2", kind: "plan-item", name: "Book club", date: "2026-10-30" },
    { id: "e1", kind: "event", name: "Swim practice", date: "2026-10-26" },
    { id: "e2", kind: "event", name: "Dentist", date: "2026-10-28" },
    { id: "e3", kind: "event", name: "Piano lesson", date: "2026-10-29" },
    { id: "g1", kind: "grocery-list", name: "Saturday shop", status: "done" },
    { id: "g2", kind: "grocery-list", name: "Midweek top-up", status: "open" },
  ],
  edges: [{ id: "x1", kind: "for-plan", from: "e2", to: "p1" }],
};

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The household</title>
<style>body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#f7f7f4;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the page IS the app, as Cloud's shell mounts it, handed the host's log of runs. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-workflows-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import household from ${JSON.stringify(HOUSEHOLD)};
        const compiled = compileDocumentWithoutCheck(household);
        /* The host's log: the newest run of each workflow, as a WorkflowLog's last(name) answers it. */
        const runs = {
          "next-weeks-events": { id: "workflow:next-weeks-events:1", workflow: "next-weeks-events", trigger: { kind: "schedule", at: ${JSON.stringify(RAN)} }, started: ${JSON.stringify(RAN)}, finished: ${JSON.stringify(RAN)}, outcome: "ok", dry: false, made: Array.from({ length: 28 }, (_, i) => "made-" + i), changed: [], archived: [], suggested: [], heldBack: [], through: 0, specHash: "h", notes: [] },
        };
        if (!compiled.ok) {
          window.__failed = compiled.findings.map((finding) => finding.message).join("; ");
          window.__ready = true;
        } else {
          window.__handle = mount(document.getElementById("app"), {
            app: compiled.app,
            seed: ${JSON.stringify(SEED)},
            face: "graview",
            principal: { kind: "human", id: "u:owner", roles: ["owner"] },
            workflowRuns: { last: (name) => runs[name] },
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
  await vacant(portFor("workflows-host"));
  await new Promise((ready) => host.listen(portFor("workflows-host"), ready));
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
const seen = [];
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const where = { engine, scheme, width: DESK.width };
      const context = await browser.newContext({ viewport: DESK, colorScheme: scheme });
      const page = await context.newPage();
      await page.clock.setFixedTime(NOW);
      page.on("pageerror", (error) => errors.push(`${engine} ${scheme}: ${error.message}`));
      try {
        await page.goto(`${at("workflows-host")}/`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        const failed = await page.evaluate(() => window.__failed ?? null);
        if (failed) errors.push(`${engine} ${scheme}: the document did not compile: ${failed}`);
        const drawn = await until(page, () => page.evaluate(() => document.querySelectorAll("[data-graview-workflow]").length === 3), 20_000);
        // Let the city's tween land before reading where things stand.
        await page.waitForTimeout(900);
        const read = await page.evaluate(() => {
          const nodes = [...document.querySelectorAll("[data-graview-workflow]")];
          const wires = [...document.querySelectorAll("[data-graview-workflow-wire]")].map((wire) => ({ wire: wire.getAttribute("data-graview-workflow-wire"), way: wire.getAttribute("data-wire") }));
          const spots = [...document.querySelectorAll(".graview-workflow-spot")].map((spot) => {
            const box = spot.getBoundingClientRect();
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            // What ground the spot stands on: a district's tile under it, if any.
            const under = document.elementsFromPoint(x, y).filter((element) => element.classList?.contains("graview-plot-tile")).length;
            return { x: Math.round(x), y: Math.round(y), onGround: under > 0, inWindow: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight };
          });
          return {
            wires,
            spots,
            nodes: nodes.map((node) => ({
              name: node.getAttribute("data-graview-workflow"),
              status: node.getAttribute("data-graview-workflow-status"),
              beside: node.getAttribute("data-graview-workflow-beside"),
              text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
              lines: [...node.querySelectorAll("span")].map((line) => line.textContent ?? ""),
              label: node.getAttribute("aria-label") ?? "",
              role: node.getAttribute("role"),
              opacity: Number(getComputedStyle(node).opacity),
            })),
          };
        });
        if (SHOTS && engine === engines[0]) {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `${engine}-${scheme}-map.png`) });
        }
        seen.push({ ...where, drawn, ...read });
      } catch (error) {
        seen.push({ ...where, error: String(error.message ?? error).split("\n")[0] });
      }
      await context.close();
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  host.stop();
}

const screens = SCHEMES.length * engines.length;
const all = (holds) => seen.length === screens && seen.every((one) => !one.error && one.drawn && holds(one));
const node = (one, name) => one.nodes.find((each) => each.name === name);
const wired = (one) => JSON.stringify(one.wires.map((wire) => `${wire.wire}=${wire.way}`).sort());
const WIRES = JSON.stringify(
  ["next-weeks-events:event=writes", "next-weeks-events:routine=reads", "keep-events-in-step:event=writes", "keep-events-in-step:plan-item=reads", "set-aside-done-lists:grocery-list=writes"].sort(),
);

const report = { at: new Date().toISOString(), engines, schemes: SCHEMES, width: DESK.width, document: "packages/core/tests/document/fixtures/workflows.gdd.json", checks: {} };
report.checks.eachWorkflowStandsBesideTheDistrictItWritesWiredToWhatItReadsAndWrites = {
  seen: seen.map(({ nodes, wires, ...rest }) => ({ ...rest, beside: nodes?.map((one) => `${one.name}→${one.beside}`), wires: wires && wired({ wires }) })),
  ok: all((one) => one.nodes.length === 3 && node(one, "next-weeks-events")?.beside === "event" && node(one, "keep-events-in-step")?.beside === "event" && node(one, "set-aside-done-lists")?.beside === "grocery-list" && wired(one) === WIRES),
};
report.checks.noWorkflowStandsOnADistrictsGround = {
  seen: seen.map(({ spots, engine, scheme }) => ({ engine, scheme, spots })),
  ok: all((one) => one.spots.length === 3 && one.spots.every((spot) => !spot.onGround && spot.inWindow)),
};
report.checks.aPausedWorkflowIsDrawnDimmedAndSaysSo = {
  seen: seen.map(({ nodes, engine, scheme }) => ({ engine, scheme, nodes: nodes?.map(({ name, status, opacity, lines }) => ({ name, status, opacity, lines })) })),
  ok: all((one) => {
    const paused = node(one, "set-aside-done-lists");
    const active = node(one, "next-weeks-events");
    return paused?.status === "paused" && paused.opacity <= 0.6 && paused.text.includes("Paused") && active?.status === "active" && active.opacity === 1 && !active.text.includes("Paused");
  }),
};
report.checks.aWorkflowSaysItsLastRunInWords = {
  seen: seen.map(({ nodes, engine, scheme }) => ({ engine, scheme, lines: nodes?.map(({ name, lines }) => ({ name, lines })) })),
  ok: all(
    (one) =>
      JSON.stringify(node(one, "next-weeks-events")?.lines) === JSON.stringify(["Fill out next week's events", "Last ran 2 hours ago: made 28"]) &&
      JSON.stringify(node(one, "keep-events-in-step")?.lines) === JSON.stringify(["Keep events in step with plan items", "Has not run yet"]) &&
      JSON.stringify(node(one, "set-aside-done-lists")?.lines) === JSON.stringify(["Set aside done grocery lists", "Paused · Has not run yet"]),
  ),
};
report.checks.aScreenReaderIsToldWhatEachWorkflowReadsWritesAndDid = {
  seen: seen.map(({ nodes, engine, scheme }) => ({ engine, scheme, labels: nodes?.map(({ role, label }) => ({ role, label })) })),
  ok: all(
    (one) =>
      node(one, "next-weeks-events")?.role === "group" &&
      node(one, "next-weeks-events")?.label === "Workflow: Fill out next week's events. Reads routines; writes events. Last ran 2 hours ago: made 28." &&
      node(one, "set-aside-done-lists")?.label === "Workflow: Set aside done grocery lists, paused. Reads grocery lists; writes grocery lists. Has not run yet.",
  ),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/workflows.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/workflows.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
