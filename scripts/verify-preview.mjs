#!/usr/bin/env node
/**
 * A DOCUMENT AND A SEED, LOOKED AT WITH NO PRODUCT (`graview preview`,
 * `graview shots`).
 *
 * `graview serve` was the store and drew nothing, so n-dx built a product
 * only to see its projection, and proved every change with hand-written
 * Playwright screenshots. This runs the built command line the way a
 * stranger runs it — `graview preview <document> --seed <snapshot>` over
 * Graview Cloud's org document, no product, no vite — and asks a browser:
 *
 *   the routed face draws the home, says the seed's records, and lists a
 *   kind's records at its own address;
 *   the scene draws the graph's districts at the overview's address, and a
 *   reload stays there;
 *   a change another seat makes on the served store reaches the open page,
 *   live, and the command's store holds it;
 *   `graview shots` writes a PNG for each named place, and refuses a place
 *   the app has not got, naming the ones it has.
 *
 *   node scripts/verify-preview.mjs [--engine=chromium|webkit|firefox]
 *
 * Writes docs/preview.json.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";
import { seatHeaders } from "../packages/ship/dist/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");
const DOCUMENT = "packages/core/tests/document/fixtures/org.gdd.json";
const SEED = "packages/core/tests/document/fixtures/org.seed.json";
const seed = JSON.parse(readFileSync(resolve(repoRoot, SEED), "utf8"));
const person = seed.nodes.find((node) => node.kind === "person");
const report = { at: new Date().toISOString(), engine: ENGINE, document: DOCUMENT, seed: SEED, checks: {} };

if (!existsSync(resolve(repoRoot, "packages/graview/dist/preview/index.html"))) {
  process.stderr.write("verify-preview: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

await vacant(portFor("preview"), portFor("preview-shots"));
const server = spawn(process.execPath, [CLI, "preview", DOCUMENT, "--seed", SEED, "--port", String(portFor("preview"))], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
let said = "";
server.stdout.on("data", (chunk) => (said += chunk));
server.stderr.on("data", (chunk) => (said += chunk));
const base = at("preview");
const started = Date.now();
for (;;) {
  try {
    if ((await fetch(`${base}/graview/health`)).ok) break;
  } catch {
    // not listening yet
  }
  if (Date.now() - started > 30_000 || server.exitCode !== null) {
    process.stderr.write(`verify-preview: graview preview did not start:\n${said}\n`);
    server.kill();
    process.exit(1);
  }
  await new Promise((ready) => setTimeout(ready, 200));
}
report.said = said.trim().split("\n");

let browser;
const errors = [];
const shotsDir = mkdtempSync(join(tmpdir(), "graview-shots-"));
try {
  browser = await launchEngine(ENGINE);
  const open = async (path, viewport = { width: 1280, height: 900 }) => {
    const page = await browser.newPage({ viewport, colorScheme: "light" });
    page.on("pageerror", (error) => errors.push(`${path}: ${error.message}`));
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true || typeof window.__graviewFailed === "string", null, { timeout: 60_000 });
    await page.waitForTimeout(800);
    return page;
  };

  /* ---- the routed face: the home, and a kind's list at its own address */
  {
    const page = await open("/");
    const home = await page.evaluate(() => ({
      failed: window.__graviewFailed ?? null,
      title: document.title,
      bar: document.querySelector('[data-testid="app-face-scene"]') !== null,
      text: document.body.innerText,
    }));
    await page.close();
    report.checks.thePagesFaceDrawsTheHome = { failed: home.failed, title: home.title, bar: home.bar, ok: !home.failed && home.title === "En Dash Org" && home.bar && home.text.includes(person.name) };
    const list = await open("/people");
    const listed = await list.evaluate(() => ({ heading: document.querySelector("[data-graview-page-title]")?.textContent?.trim() ?? null, text: document.body.innerText }));
    await list.close();
    report.checks.aKindsRecordsAreListedAtItsAddress = { heading: listed.heading, ok: listed.heading === "People" && listed.text.includes(person.name) };
  }

  /* ---- the scene: the overview's address draws the districts, and a reload stays */
  {
    const page = await open("/places/overview");
    const drawn = () =>
      page.evaluate(() => ({
        sceneOn: document.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed") === "true",
        districts: document.querySelectorAll(".graview-ground *").length,
        path: location.pathname,
      }));
    const first = await drawn();
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true, null, { timeout: 60_000 });
    await page.waitForTimeout(800);
    const again = await drawn();
    await page.close();
    report.checks.theSceneDrawsTheGraphAtTheOverviewsAddress = { first, again, ok: first.sceneOn && first.districts > 10 && again.sceneOn && again.path === "/places/overview" };
  }

  /* ---- the store is the served one: a change another seat makes on the served store reaches the open page, live */
  {
    const page = await open("/people");
    const { principal } = await (await fetch(`${base}/graview/document`)).json();
    const sent = await fetch(`${base}/graview/ops`, {
      method: "POST",
      headers: { "content-type": "application/json", ...seatHeaders({ ...principal, id: "someone-else" }) },
      body: JSON.stringify({ calls: [{ name: "add-person", args: { name: "Grace Hopper", role: "Visiting" } }] }),
    });
    const arrived = await page
      .waitForFunction(() => document.body.innerText.includes("Grace Hopper"), null, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    await page.close();
    const state = await (await fetch(`${base}/graview/state`, { headers: seatHeaders(principal) })).json();
    report.checks.aChangeOnTheServedStoreReachesThePage = { status: sent.status, arrived, nodes: state.snapshot?.nodes?.length, ok: sent.ok && arrived && state.snapshot?.nodes?.length === seed.nodes.length + 1 };
  }

  /* ---- graview shots: a PNG a place, and a place it has not got refused by name */
  {
    const run = (places) =>
      spawnSync(process.execPath, [CLI, "shots", DOCUMENT, "--seed", SEED, "--places", places, "--out", shotsDir, "--port", String(portFor("preview-shots"))], { cwd: repoRoot, encoding: "utf8", timeout: 180_000 });
    const taken = run("home,overview,people");
    const files = ["home", "overview", "people"].map((name) => join(shotsDir, `${name}-light-1280.png`));
    const pngs = files.map((file) => existsSync(file) && statSync(file).size > 10_000 && readFileSync(file).subarray(1, 4).toString() === "PNG");
    report.checks.shotsWritesAPngForEachNamedPlace = { status: taken.status, said: taken.stdout.trim().split("\n").at(-1), pngs, ok: taken.status === 0 && pngs.every(Boolean) };
    const refused = run("nowhere");
    report.checks.shotsRefusesAPlaceTheAppHasNot = { status: refused.status, said: refused.stderr.trim(), ok: refused.status === 2 && refused.stderr.includes('no place called "nowhere"') && refused.stderr.includes("people") };
  }

  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  server.kill();
  rmSync(shotsDir, { recursive: true, force: true });
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/preview.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/preview.json\n");
process.exit(report.passed ? 0 : 1);
