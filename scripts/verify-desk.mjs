#!/usr/bin/env node
/**
 * THE FRONT DOOR, WALKED.
 *
 * The desk surveyed two demos against eleven capabilities read from their
 * declarations — the three lens starters, an entity-bound lens, rules as
 * nodes, field roles, an edge to any kind, a mutation for any kind,
 * repairs, a kind with no custom view and a persistence adapter, the last
 * two true by assertion. That is the framework of six months ago. It said
 * nothing about the routed face, places, seats and policy, the agent seat,
 * the installation and profiles, brand and kit, remembering and
 * migrations, the embed, the checker, modules, the horizon or the studio —
 * which is what a person opening the launcher for the first time needs to
 * be shown.
 *
 * So: the list is the platform's, in the order a person meets it, and every
 * entry NAMES WHERE IT IS SHOWN. This walks that: it opens each capability's
 * stop in its demo and asks the demo whether it is there.
 *
 *   node scripts/verify-desk.mjs [--engine=chromium|webkit|firefox]
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, movedIn, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };

const { APPS, CAPABILITIES } = await import(
  pathToFileURL(resolve(repoRoot, "apps/launcher/dist/domain/survey.js")).href
);
const READY = { todo: "__todoReady", rota: "__rotaReady", seedbed: "__seedbedReady" };

/*
 * AND THE STORE SERVER, because one capability's stop is the roster opened
 * from a folder on a server — "data in a folder you can open" cannot be
 * shown by a stop that has nothing to open.
 */
const store = spawn(
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
    String(portFor("served")),
  ],
  { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], detached: true },
);
await new Promise((ready, fail) => {
  const timer = setTimeout(() => fail(new Error("the store server did not start")), 30_000);
  store.stdout.on("data", (chunk) => {
    if (String(chunk).includes(at("served"))) {
      clearTimeout(timer);
      ready(undefined);
    }
  });
  store.on("exit", (code) => {
    clearTimeout(timer);
    fail(new Error(`the store server exited with ${code}`));
  });
});

const desk = await serving("launcher", portFor("launcher"), repoRoot);
const demos = Object.fromEntries(
  await Promise.all(
    APPS.map(async (entry) => [entry.id, await serving(entry.id, portFor(entry.id), repoRoot)]),
  ),
);
let browser;

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  /* ----------------------- the list is the platform's, in onboarding order */
  await page.goto(`${at("launcher")}/?theme=light`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("[data-graview-view]") !== null, null, {
    timeout: 40_000,
  });
  await page.waitForTimeout(1200);
  const listed = CAPABILITIES.map((one) => one.id);
  const wanted = [
    "cap-rules-as-nodes",
    "cap-repairs",
    "cap-horizon",
    "cap-calendar",
    "cap-routed-face",
    "cap-own-design",
    "cap-policy",
    "cap-installation",
    "cap-profile",
    "cap-brand",
    "cap-kit",
    "cap-embed",
    "cap-migration",
    "cap-server-persistence",
    "cap-intelligence",
    "cap-modules",
    "cap-studio",
  ];
  report.checks.theListIsThePlatforms = {
    listed: listed.length,
    missing: wanted.filter((id) => !listed.includes(id)),
    // Declare it → look at it → lenses → the routed face → who may do what
    // → brand and embed → remember and ship → the agent and the studio.
    order: listed.slice(0, 5),
    ok: wanted.every((id) => listed.includes(id)) && listed[0] === "cap-rules-as-nodes",
  };

  /* ---------------------------- every capability names where it is shown */
  const homeless = CAPABILITIES.filter((one) => !one.shownIn || !one.stop);
  const unknown = CAPABILITIES.filter((one) => one.shownIn && !APPS.some((entry) => entry.id === one.shownIn));
  report.checks.everyCapabilityNamesWhereItIsShown = {
    homeless: homeless.map((one) => one.id),
    unknown: unknown.map((one) => one.id),
    ok: homeless.length === 0 && unknown.length === 0,
  };

  /* -------------------------------- and pressing one opens the demo there */
  /*
   * The stop is the address the APP understands, so the demo is asked
   * whether it arrived rather than the desk being asked whether it sent.
   * A stop that no longer names anything is the failure worth catching:
   * a front door whose handles come off in your hand.
   */
  const walked = {};
  for (const capability of CAPABILITIES) {
    const entry = APPS.find((one) => one.id === capability.shownIn);
    if (!entry) continue;
    const stop = capability.stop.startsWith("/") || capability.stop.startsWith("?")
      ? capability.stop
      : `/${capability.stop}`;
    const url = `${at(entry.id)}${movedIn(stop)}`;
    try {
      await page.goto(url, { waitUntil: "load" });
      if (!stop.startsWith("/pages") && !stop.startsWith("/embed")) {
        await page.waitForFunction((flag) => flag in window, READY[entry.id], { timeout: 40_000 });
      }
      await page.waitForTimeout(700);
      walked[capability.id] = await page.evaluate(() => ({
        // Something was drawn, and nothing went wrong on the way.
        drew:
          document.querySelectorAll("[data-graview-view], [data-graview-embed], main, [data-testid=records]")
            .length > 0,
        title: document.title.slice(0, 40),
      }));
    } catch (error) {
      walked[capability.id] = { drew: false, why: String(error).slice(0, 120) };
    }
  }
  const broken = Object.entries(walked).filter(([, seen]) => !seen.drew);
  report.checks.pressingACapabilityOpensTheDemoThere = {
    walked: Object.keys(walked).length,
    broken: broken.map(([id, seen]) => `${id}: ${seen.why ?? "drew nothing"}`),
    ok: broken.length === 0,
  };

  /* ---------------------- a capability no demo shows is a problem, with a repair */
  const { createLauncherStore } = await import(
    pathToFileURL(resolve(repoRoot, "apps/launcher/dist/domain/app.js")).href
  );
  const store = createLauncherStore();
  const unearned = store
    .violations()
    .filter((one) => one.invariant === "every-capability-is-earned");
  report.checks.aCapabilityNobodyShowsIsAProblem = {
    open: unearned.map((one) => one.message),
    repairs: unearned.flatMap((one) => one.repairs.map((repair) => repair.mutation)),
    // Either everything is earned, or the ones that are not say so and name
    // the act that would settle it. Both are correct; silence is not.
    ok: unearned.every((one) => one.repairs.length > 0),
  };

  /* ------------------------------- every demo it ships is listed, with a way in */
  report.checks.everyDemoIsListedWithItsCommand = {
    apps: APPS.map((entry) => `${entry.label} :${entry.port} (${entry.command})`),
    ok: APPS.length === 3 && APPS.every((entry) => entry.command && entry.port),
  };

  /* ------------------------- every example wears Graview's icon in its tab */
  /*
   * The tab is the one place an example stands among a person's other
   * tabs, and it was a blank page: no icon, and a title that did not say
   * whose example it was. Each page links the micro mark — an SVG that
   * turns white in a dark scheme, an ICO and a touch icon — and each link
   * is asked for, so a link to nothing is caught as well as no link.
   */
  const tabs = {};
  for (const id of ["launcher", ...APPS.map((entry) => entry.id)]) {
    await page.goto(`${at(id)}/`, { waitUntil: "load" });
    const head = await page.evaluate(() => ({
      title: document.title,
      icons: [...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')].map((link) => ({
        rel: link.getAttribute("rel"),
        type: link.getAttribute("type"),
        href: link.href,
      })),
    }));
    const fetched = [];
    for (const icon of head.icons) {
      const answer = await page.request.get(icon.href);
      const type = answer.headers()["content-type"] ?? "";
      fetched.push({ href: new URL(icon.href).pathname, status: answer.status(), image: /^image\//.test(type) || /icon/.test(type) });
    }
    tabs[id] = {
      title: head.title,
      svg: head.icons.some((icon) => icon.rel === "icon" && icon.type === "image/svg+xml"),
      ico: head.icons.some((icon) => icon.rel === "icon" && icon.href.endsWith(".ico")),
      touch: head.icons.some((icon) => icon.rel === "apple-touch-icon"),
      fetched,
    };
  }
  report.checks.everyExampleWearsGraviewsIconInItsTab = {
    tabs,
    ok: Object.entries(tabs).every(
      ([id, tab]) =>
        tab.svg &&
        tab.ico &&
        tab.touch &&
        tab.fetched.every((one) => one.status === 200 && one.image) &&
        (id === "launcher" ? /Graview/.test(tab.title) : / — a Graview example$/.test(tab.title)),
    ),
  };

  /* -------------- and signs itself quietly, in the person's menu, not the bar */
  /*
   * The kit's rule: an app leads with its own name and mark; a Graview
   * signature, where there is one, is secondary. So the bar says "Rota",
   * and "Built with Graview" is one line at the foot of the person's menu,
   * a link named "Graview" to graview.dev — on the scene and on the pages.
   */
  const signed = {};
  for (const [face, path] of [["scene", "/?theme=light"], ["pages", "/pages/?theme=light"]]) {
    await page.goto(`${at("rota")}${path}`, { waitUntil: "load" });
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 40_000 });
    const before = await page.evaluate(() => ({
      barName: document.querySelector('[data-testid="app-bar"] [data-testid="app-name"]')?.textContent?.trim() ?? null,
      barSaysGraview: /Graview/.test(document.querySelector('[data-testid="app-bar"] [data-testid="app-name"]')?.textContent ?? ""),
      shown: [...document.querySelectorAll('[data-testid="graview-signature"]')].some((one) => one.getClientRects().length > 0),
    }));
    await page.click('[data-testid="profile-button"]');
    const line = page.locator('[data-testid="graview-signature"]');
    await line.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    const link = line.getByRole("link", { name: "Graview", exact: true });
    signed[face] = {
      ...before,
      line: (await line.count()) > 0 ? (await line.innerText()).replace(/\s+/g, " ").trim() : null,
      named: (await link.count()) === 1,
      href: (await link.count()) === 1 ? await link.getAttribute("href") : null,
    };
    await page.keyboard.press("Escape");
  }
  report.checks.theExamplesSignThemselvesQuietlyInThePersonsMenu = {
    signed,
    ok: Object.values(signed).every(
      (one) => one.barName !== null && !one.barSaysGraview && !one.shown && one.line === "Built with Graview" && one.named && one.href === "https://graview.dev",
    ),
  };

  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error).slice(0, 1200);
  report.passed = false;
} finally {
  await browser?.close();
  desk.stop();
  for (const served of Object.values(demos)) served.stop();
  try {
    process.kill(-store.pid, "SIGTERM");
  } catch {
    store.kill("SIGTERM");
  }
}

writeFileSync(resolve(repoRoot, "docs/desk.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/desk.json\n`);
process.exit(report.passed ? 0 : 1);
