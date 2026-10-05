#!/usr/bin/env node
/**
 * THE EMBED'S CHROME, AS ONE FAMILY (FR-72, FR-75 – FR-78).
 *
 * Graview Cloud's staging found it: on a hosted app the profile menu opened
 * UNDER the seat's rail and could not be read. Each surface had picked its
 * own `z-index` in one stacking context. This drives every popover in the
 * framework's registry (`POPOVERS` in `@graview/react`) — not a list kept
 * here — on the embed's Graview and pages faces and on the whole-page
 * Shell, at a desk's width and a phone's, with the seat open, and asks the
 * browser what is actually under the middle of each pane and under its
 * last row.
 *
 * The embed is mounted the way a host mounts it: a page of the host's own
 * (a header, the app, a footer), built with esbuild from the workspace's
 * sources, serving the todo app's declaration and seed.
 *
 *   node scripts/verify-chrome.mjs [--engine=chromium|webkit|firefox] [--quick]
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const QUICK = process.argv.includes("--quick");
const { POPOVERS } = await import(resolve(repoRoot, "packages/react/dist/popover.js"));

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
const SIZES = QUICK ? [{ width: 1440, height: 900 }] : [{ width: 1440, height: 900 }, { width: 390, height: 844 }];

/** The host's page: its own header and footer around the element the embed owns. */
const HOST_PAGE = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}header,footer{padding:8px 16px}#app{position:relative;height:calc(100vh - 80px)}</style></head>
<body><header><a href="/apps">Your apps</a></header><main><h1 style="position:absolute;left:-9999px">${title}</h1><div id="app"></div></main><footer>Hosted elsewhere</footer>
<script type="module" src="/entry.js"></script></body></html>`;

/** Builds the host's page: the embed over the todo app, as a product's bundler would. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-chrome-host-"));
  const todo = resolve(repoRoot, "apps/todo/src/index.ts");
  const seed = resolve(repoRoot, "apps/todo/src/data/example.json");
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { todoApp } from ${JSON.stringify(todo)};
        import seed from ${JSON.stringify(seed)};
        const asked = new URLSearchParams(location.search);
        const options = {
          app: todoApp,
          seed,
          face: asked.get("face") ?? "graview",
          principal: { kind: "human", id: "user-nora", roles: ["keeper"] },
          label: "Things",
          heading: false,
          height: "100%",
          fonts: false,
          studio: false,
        };
        window.__handle = mount(document.getElementById("app"), options);
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
  writeFileSync(join(out, "index.html"), HOST_PAGE("Things, on a host's page"));
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
  await new Promise((ready) => host.listen(portFor("chrome-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** Opens the seat if it is put away (a phone's sheet starts shut). */
async function openTheSeat(page) {
  const shut = await page.evaluate(() => document.querySelector('[data-testid="companion"]')?.getAttribute("data-graview-companion") ?? null);
  if (shut === null || shut === "open") return shut;
  await page.click('[data-testid="companion-dock"]');
  await page.waitForTimeout(300);
  return page.evaluate(() => document.querySelector('[data-testid="companion"]')?.getAttribute("data-graview-companion") ?? null);
}

/** Opens one popover of the registry the way a person would; false when nothing here opens it. */
async function openOne(page, entry) {
  if (entry.opens === "context-menu") {
    const card = await page.evaluate(() => {
      for (const element of document.querySelectorAll(".graview-ground [data-graview-view]")) {
        const box = element.getBoundingClientRect();
        if (box.width < 20 || box.height < 20) continue;
        const x = box.left + box.width / 2;
        const y = box.top + Math.min(box.height / 2, 20);
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        if (element.contains(document.elementFromPoint(x, y))) return { x, y };
      }
      return null;
    });
    if (!card) return false;
    await page.mouse.click(card.x, card.y, { button: "right" });
  } else {
    const trigger = page.locator(`[data-testid="${entry.trigger}"]:visible`).first();
    if ((await trigger.count()) === 0 || !(await trigger.isEnabled())) return false;
    try {
      if (entry.opens === "typing") {
        await trigger.click({ timeout: 3000 });
        await page.keyboard.type("a");
      } else await trigger.click({ timeout: 3000 });
    } catch {
      return false;
    }
  }
  try {
    await page.waitForSelector(`[data-testid="${entry.pane}"]:not([hidden])`, { timeout: 3000 });
    await page.waitForTimeout(150);
    return true;
  } catch {
    return false;
  }
}

/** What is under the pane's middle and under its last row, and whether it stands in the top layer. */
function standing(page, pane) {
  return page.evaluate((testId) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    if (!element) return null;
    const inside = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      return { at: hit ? `${hit.tagName.toLowerCase()}${hit.getAttribute("data-testid") ? `[${hit.getAttribute("data-testid")}]` : ""}` : null, inside: hit !== null && element.contains(hit) };
    };
    const box = element.getBoundingClientRect();
    const centre = inside(box.left + box.width / 2, box.top + box.height / 2);
    const rows = [...element.querySelectorAll("li, button, a, input, select, [role=option], [role=menuitem], fieldset")].filter((row) => row.getBoundingClientRect().height > 0);
    const last = rows.at(-1);
    last?.scrollIntoView({ block: "nearest" });
    const lastBox = last?.getBoundingClientRect();
    const lastRow = lastBox ? inside(lastBox.left + Math.min(lastBox.width / 2, 40), lastBox.top + lastBox.height / 2) : { at: null, inside: true };
    const view = { width: document.documentElement.clientWidth, height: innerHeight };
    const after = element.getBoundingClientRect();
    return {
      topLayer: (() => {
        try {
          return element.matches(":popover-open");
        } catch {
          return false;
        }
      })(),
      centre,
      lastRow,
      inTheViewport: after.left >= -1 && after.top >= -1 && after.right <= view.width + 1 && after.bottom <= view.height + 1,
      box: [Math.round(after.left), Math.round(after.top), Math.round(after.width), Math.round(after.height)],
    };
  }, pane);
}

/** Closes whatever is open: Escape, then a press on the trigger if it stayed. */
async function closeAll(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  const still = await page.evaluate(() => [...document.querySelectorAll("[popover]")].filter((one) => one.matches(":popover-open")).length);
  if (still > 0) {
    await page.mouse.click(2, 2);
    await page.waitForTimeout(120);
  }
}

/** Every popover of the registry this page draws, opened and asked of the browser. */
async function everyPopoverOn(page, where, size, seen) {
  const results = {};
  for (const [name, entry] of Object.entries(POPOVERS)) {
    if (!(await openOne(page, entry))) {
      results[name] = { drawn: false };
      continue;
    }
    const said = await standing(page, entry.pane);
    const ok = said !== null && said.topLayer && said.centre.inside && said.lastRow.inside && said.inTheViewport;
    results[name] = { drawn: true, ...said, ok };
    (seen[name] ??= []).push(`${where} ${size.width}×${size.height}`);
    await closeAll(page);
  }
  return results;
}

let browser;
const todo = await serving("todo", portFor("todo"), repoRoot);
const host = await buildHost();
try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const errors = [];
  const seen = {};
  const faces = {};
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: size });
    page.on("pageerror", (error) => errors.push(error.message));
    const places = [
      { where: "the embed's Graview", url: `${at("chrome-host")}/?face=graview`, ready: () => page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 }) },
      { where: "the embed's pages", url: `${at("chrome-host")}/?face=pages`, ready: () => page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 }) },
      { where: "the Shell", url: `${at("todo")}/?today=2026-09-01&fresh=1`, ready: () => page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 }) },
    ];
    for (const place of places) {
      await page.goto(place.url, { waitUntil: "load" });
      await place.ready();
      await page.waitForTimeout(900);
      const seat = await openTheSeat(page);
      faces[`${place.where} ${size.width}×${size.height}`] = { seat, popovers: await everyPopoverOn(page, place.where, size, seen) };
    }
    await page.close();
  }

  /* ---- FR-76: every popover drawn stands over everything, middle and last row */
  const failures = Object.entries(faces).flatMap(([where, one]) =>
    Object.entries(one.popovers)
      .filter(([, said]) => said.drawn && !said.ok)
      .map(([name, said]) => `${name} on ${where}: ${JSON.stringify(said)}`),
  );
  report.checks.everyPopoverStandsOverEverythingWithTheSeatOpen = { faces, failures, ok: failures.length === 0 };
  /* Every popover a face draws was opened somewhere: the registry is the list, so a new one is driven without anybody adding it here. */
  const unseen = Object.entries(POPOVERS)
    .filter(([name, entry]) => entry.drawn.some((face) => face === "shell" || face === "embed") && !seen[name])
    .map(([name]) => name);
  report.checks.everyPopoverAFaceDrawsWasOpened = { seen, unseen, quick: QUICK, ok: unseen.length === 0 || QUICK };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  todo.stop();
  host.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/chrome.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/chrome.json\n");
process.exit(report.passed ? 0 : 1);
