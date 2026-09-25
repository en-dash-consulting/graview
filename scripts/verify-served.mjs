#!/usr/bin/env node
/**
 * WHERE IS MY DATA — driven the way somebody self-hosting would ask it.
 *
 * The store behind HTTP with the op log as the wire: one browser makes a
 * change, another sees it, the server is stopped and started, and the
 * roster is still there. The data is a folder this script reads with
 * `readFileSync`, because a persistence story whose proof needs a debugger
 * is not the story.
 *
 *   node scripts/verify-served.mjs [--engine=chromium|webkit|firefox]
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const DATA = resolve(repoRoot, "apps/rota/data");
const PORT = 5196;
const SERVER = `http://localhost:${PORT}`;

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };

/** The store's own server, started the way a person would start it. */
function startServer() {
  const child = spawn(
    "node",
    [
      "packages/graview/dist/cli.js",
      "serve",
      "apps/rota/dist/domain/app.js",
      "--data",
      "apps/rota/data",
      "--seed",
      "apps/rota/src/data/example.json",
      "--port",
      String(PORT),
    ],
    { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("the store server did not start")), 30_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes(SERVER)) {
        clearTimeout(timer);
        ready(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`the store server exited with ${code}`));
    });
  });
}
const stopServer = (child) => {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
};

const logLines = () => {
  const path = join(DATA, "rota", "log.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
};

rmSync(DATA, { recursive: true, force: true });
const app = await serving("rota", 5195, repoRoot);
let server = await startServer();
let browser;

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const open = async (page, as) => {
    await page.goto(`http://localhost:5195/?today=2026-09-14&server=${SERVER}&as=${as}`, { waitUntil: "load" });
    await page.waitForFunction(() => "__rotaReady" in window, null, { timeout: 60_000 });
    await page.waitForTimeout(1000);
  };

  /* ------------------------------------ the data is a folder you can open */
  const onDisk = {
    files: ["snapshot.json", "log.jsonl", "meta.json"].filter((name) => existsSync(join(DATA, "rota", name))),
    version: JSON.parse(readFileSync(join(DATA, "rota", "meta.json"), "utf8")).version,
    nodes: JSON.parse(readFileSync(join(DATA, "rota", "snapshot.json"), "utf8")).nodes.length,
  };
  report.checks.theDataIsAFolderYouCanOpen = {
    ...onDisk,
    // `log.jsonl` only exists once something has happened, which is honest.
    ok: onDisk.files.includes("snapshot.json") && onDisk.files.includes("meta.json") && onDisk.version === 3,
  };

  /* ---------------------------- one browser acts, another one sees it */
  const one = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const two = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  one.on("pageerror", (error) => errors.push(error.message));
  two.on("pageerror", (error) => errors.push(error.message));
  await open(one, "user-jo");
  await open(two, "user-ada");

  const covered = (page) =>
    page.evaluate(() =>
      document.querySelector('[data-graview-view="s-fri-repair"]') === null
        ? null
        : (document.querySelector('[data-graview-view="s-fri-repair"]')?.textContent ?? ""),
    );
  // Through the interface: select the uncovered shift and take its repair.
  await one.goto(`http://localhost:5195/pages/shifts/s-fri-repair?today=2026-09-14&server=${SERVER}&as=user-jo`, {
    waitUntil: "networkidle",
  });
  await one.waitForSelector('[data-testid="record-violations"] [data-graview-repair]', { timeout: 20_000 });
  await one.locator('[data-testid="record-violations"] [data-graview-repair="cover"]').first().click();
  await one.waitForSelector("[data-testid^=form-]", { timeout: 10_000 });
  await one.selectOption("[data-testid^=form-] select", { index: 1 });
  await one.click("[data-testid^=form-] button[type=submit]");
  await one.waitForTimeout(1500);

  const wrote = logLines();
  report.checks.aChangeMadeInABrowserLandsOnDisk = {
    lines: wrote.length,
    intent: wrote.at(-1)?.intent ?? null,
    author: wrote.at(-1)?.author?.id ?? null,
    ok: wrote.length === 1 && String(wrote[0].intent).includes("covers") && wrote[0].author.id === "user-jo",
  };

  /*
   * The other browser, which never heard about it directly — and asked of
   * ITSELF rather than of the server. "Did the server record it" and "did
   * the other person find out" are different questions, and only the second
   * one is what two browsers seeing each other means.
   */
  await two.waitForFunction(
    () => (window.__rotaOps?.() ?? []).length > 0,
    null,
    { timeout: 15_000 },
  ).catch(() => {});
  const heard = await two.evaluate(() => window.__rotaOps?.() ?? []);
  report.checks.theOtherBrowserSeesIt = {
    heard,
    ok: heard.length === 1 && String(heard[0]).includes("covers"),
  };

  /* ------------------------------- stop it, start it, and it is all there */
  stopServer(server);
  await new Promise((settle) => setTimeout(settle, 800));
  server = await startServer();
  const after = await (await fetch(`${SERVER}/graview/state`)).json();
  report.checks.stopItStartItAndItIsAllThere = {
    nodes: after.snapshot.nodes.length,
    edges: after.snapshot.edges.length,
    log: after.log.length,
    version: after.version,
    ok: after.log.length === 1 && after.version === 3 && after.snapshot.edges.length === 18,
  };

  /* ------------------------------ the policy judges there too, in its words */
  const refused = await fetch(`${SERVER}/graview/ops`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-graview-seat": "user-sam", "x-graview-roles": "viewer" },
    body: JSON.stringify({ calls: [{ name: "cover", args: { shiftId: "s-sun-clean", volunteerId: "v-ada" } }] }),
  });
  const said = await refused.json();
  report.checks.theSamePolicyJudgesOnTheServer = {
    status: refused.status,
    said: said.error,
    ok: refused.status === 409 && String(said.error).includes("coordinator"),
  };

  /* --------------------------------------- and it says where it keeps it */
  const health = await (await fetch(`${SERVER}/graview/health`)).json();
  report.checks.itSaysWhereTheDataIs = {
    adapter: health.adapter,
    // Relative, so the verdict does not record whose machine it ran on.
    where: relative(repoRoot, health.where),
    ok: health.ok === true && health.adapter === "file" && String(health.where).endsWith("apps/rota/data"),
  };

  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error).slice(0, 1200);
  report.passed = false;
} finally {
  await browser?.close();
  stopServer(server);
  app.stop();
}

writeFileSync(resolve(repoRoot, "docs/served.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/served.json\n`);
process.exit(report.passed ? 0 : 1);
