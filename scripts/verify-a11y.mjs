#!/usr/bin/env node
/**
 * THE FRAMEWORK'S OWN MARKUP PASSES AXE.
 *
 * Graview Cloud's accessibility pass (its `scripts/a11y.mjs`) runs axe-core
 * over every app it hosts, and from 0.1.18 on it found 48 nodes inside
 * `#graview-app` — the framework's markup — on every release, and tolerated
 * them as somebody else's. Nothing here ran axe on a hosted app, so nothing
 * here said so.
 *
 * This runs the same pass: axe-core with the same tags (WCAG 2.0, 2.1 and
 * 2.2 A and AA, and best practice), at a desk (1280×800) and a phone
 * (390×844), in light and in dark, on both faces, over
 *
 *   Cloud's two shapes of app, mounted the way Cloud mounts them: the embed
 *   over a compiled document inside `#graview-app` on a host's page that
 *   brings its own `<main>`, language and title and nothing else (the
 *   vendor template and the workshop). As Cloud does, what is inside
 *   `#graview-app` is the framework's, and so is whether the page says
 *   what it is (`page-has-heading-one`): every word on the page is the
 *   framework's to write.
 *
 *   a first look (`firstLook`) on Cloud's vendor app, on both faces, with
 *   each of its hints open in turn: axe holds with a hint open, each hint
 *   stands beside its control and never on it, inside the screen, the
 *   keyboard on it; on a phone at twice the text size it still fits; and
 *   Escape ends it with the keyboard given back.
 *
 *   a status board on Cloud's vendor app (the Pages face, at its place): at
 *   rest, with a card carried by the keyboard, with its menu's "Move to ›"
 *   open, and after a card is dragged — a move by the keyboard, the menu
 *   and a pointer, each scanned (Roadmap f-board-move-without-buttons).
 *
 *   the example apps (todo, seedbed, rota, discography, the desk), whole:
 *   every node on their pages is this repository's.
 *
 * A screen holds when axe finds nothing. The verdict names each rule that
 * fired, how many nodes, and where.
 *
 *   node scripts/verify-a11y.mjs [--quick] [--only=vendors,todo]
 *
 * `--quick` scans the desk in light and the phone in dark only.
 */
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const ONLY = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length).split(",").filter(Boolean);
/** Cloud's tags, exactly. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const VIEWPORTS = { desk: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const SCHEMES = ["light", "dark"];
const SWEEP = QUICK
  ? [["desk", "light"], ["phone", "dark"]]
  : Object.keys(VIEWPORTS).flatMap((size) => SCHEMES.map((scheme) => [size, scheme]));
const ROOT = "#graview-app";
/** Rules about the whole page that Cloud holds the framework to: every word on its shell is the framework's. */
const DOCUMENT_RULES = new Set(["page-has-heading-one"]);
const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");

const VENDORS = resolve(repoRoot, "scripts/fixtures/quiet/vendor-shortlist.template.json");
const WORKSHOP = resolve(repoRoot, "scripts/fixtures/desk-bar/workshop.gdd.json");
const WORKSHOP_SEED = resolve(repoRoot, "scripts/fixtures/desk-bar/workshop.seed.json");

/** Cloud's shell, as far as the framework can see it: a page with a main, a language and a title, and the app in `#graview-app`. */
const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>An app on a host's page</title>
<style>html,body{margin:0;height:100%}#graview-app{position:relative;height:100vh}</style></head>
<body><main><div id="graview-app"></div></main><script type="module" src="/entry.js"></script></body></html>`;

async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-a11y-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import vendors from ${JSON.stringify(VENDORS)};
        import workshop from ${JSON.stringify(WORKSHOP)};
        import workshopSeed from ${JSON.stringify(WORKSHOP_SEED)};
        const asked = new URLSearchParams(location.search);
        const isWorkshop = asked.get("doc") === "workshop";
        const compiled = compileDocumentWithoutCheck(isWorkshop ? workshop : vendors.document, { today: () => "2026-10-02" });
        if (!compiled.ok) throw new Error("the document did not compile");
        const seed = isWorkshop ? workshopSeed : vendors.seed;
        window.__handle = mount(document.getElementById("graview-app"), {
          app: compiled.app,
          seed: { nodes: seed.nodes, edges: seed.edges.map((edge, i) => ({ id: edge.id ?? "e" + i, ...edge })) },
          face: asked.get("face") ?? "graview",
          ...(asked.get("path") ? { path: asked.get("path") } : {}),
          // A first look, as Cloud turns it on for a new app: shown whatever this browser remembers.
          ...(asked.get("firstLook") ? { firstLook: { seen: false } } : {}),
          principal: { kind: "human", id: "u:owner", roles: ["owner"] },
          label: compiled.app.name,
          // As Cloud mounts it: the page IS the app, so its name is the page's one level-one heading.
          heading: 1,
          height: "100%",
          fonts: false,
          studio: false,
          bar: true,
        });
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
  writeFileSync(join(out, "index.html"), HOST_PAGE);
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
  await new Promise((ready) => host.listen(portFor("a11y-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/** The screens: Cloud's two shapes of app on its shell, then the examples whole, each on both faces. */
const hosted = (doc) =>
  ["graview", "pages"].map((face) => ({ name: `${doc} · ${face}`, group: doc, url: () => `${at("a11y-host")}/?doc=${doc}&face=${face}`, hosted: true }));
const example = (app, paths) =>
  paths.map((path) => ({ name: `${app} · ${path}`, group: app, app, url: () => `${at(app)}${path}${path.includes("?") ? "&" : "?"}today=2026-09-01`, hosted: false }));
/** The first look's screens: Cloud's vendor app on both faces, each hint opened in turn. */
const firstLook = ["scene", "pages"].map((face) => ({ name: `vendors · first look · ${face}`, group: "first-look", url: () => `${at("a11y-host")}/?doc=vendors&face=${face}&firstLook=1`, hosted: true, firstLook: true }));
/** A status board, moved three ways with axe run at each (Roadmap f-board-move-without-buttons). */
const board = { name: "vendors · a board moved", group: "board", url: () => `${at("a11y-host")}/?doc=vendors&face=pages&path=${encodeURIComponent("/places/vendors-by-status")}`, hosted: true, board: true };
const SCREENS = [
  ...hosted("vendors"),
  ...firstLook,
  board,
  ...hosted("workshop"),
  ...example("todo", ["/", "/pages", "/pages/tasks", "/pages/tasks/t-deposit", "/pages/problems", "/pages/search?q=the"]),
  ...example("seedbed", ["/", "/pages"]),
  ...example("rota", ["/", "/pages"]),
  ...example("discography", ["/", "/pages"]),
  ...example("launcher", ["/"]),
].filter((screen) => !ONLY || ONLY.includes(screen.group));

/** Ready: the hosted embed says it drew; an example says it is ready (`__<app>Ready`). Then the scene settles. */
async function ready(page, screen) {
  await page.waitForFunction(
    (hosted) => (hosted ? window.__ready === true : Object.keys(window).some((key) => /^__\w*Ready$/.test(key))),
    screen.hosted,
    { timeout: 60_000 },
  );
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1200);
}

/** The hint open now, and where it stands against its control and the screen; null when none is open. */
const hintNow = (page) =>
  page.evaluate(() => {
    const hint = document.querySelector('[data-testid="first-look"]');
    if (!hint) return null;
    const anchor = hint.getAttribute("data-first-look-anchor");
    const found = {
      faces: '[data-testid="app-faces"]',
      problems: '[data-testid="standing"], [data-testid="standing-link"]',
      activity: '[data-testid="activity-button"]',
      ask: '[data-testid="app-find"], [data-testid="app-find-open"]',
      find: '[data-testid="app-find"], [data-testid="app-find-open"]',
      profile: '[data-testid="profile-button"]',
      home: '[data-testid="app-home"]',
    }[anchor];
    const control = [...document.querySelectorAll(found)].find((one) => one.getBoundingClientRect().width > 1);
    const h = hint.getBoundingClientRect();
    const c = control?.getBoundingClientRect();
    const covers = !c || (h.left < c.right && h.right > c.left && h.top < c.bottom && h.bottom > c.top);
    const width = document.documentElement.clientWidth;
    const height = innerHeight;
    return {
      anchor,
      covers,
      fits: h.left >= 0 && h.top >= 0 && h.right <= width + 0.5 && h.bottom <= height + 0.5 && hint.scrollWidth <= hint.clientWidth + 1,
      keyboardOn: hint.contains(document.activeElement),
      title: hint.querySelector('[data-testid="first-look-title"]')?.textContent ?? "",
    };
  });

/** Waits for the first hint; null when none came. */
async function firstHint(page) {
  try {
    await page.waitForSelector('[data-testid="first-look"]', { timeout: 15_000 });
  } catch {
    return null;
  }
  await page.waitForTimeout(150);
  return hintNow(page);
}

/** axe over the page; each node marked as inside the framework's root or not. */
async function scan(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(
    async ([tags, root]) => {
      const result = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
      const host = document.querySelector(root);
      return result.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => {
          const last = n.target[n.target.length - 1];
          const el = typeof last === "string" ? document.querySelector(last) : null;
          return {
            target: n.target.join(" "),
            html: n.html.slice(0, 200),
            summary: (n.failureSummary ?? "").split("\n").slice(0, 3).join(" ").slice(0, 300),
            inRoot: Boolean(el && host && el !== host && host.contains(el)),
          };
        }),
      }));
    },
    [TAGS, ROOT],
  );
}

/**
 * A CARD MOVED THREE WAYS, axe run at each: at rest; carried by the keyboard
 * (Space, then Right) with its slot held open; with its menu's "Move to ›"
 * open; and after a drag onto another column. Says which steps it reached.
 */
async function boardMoves(page) {
  const scans = [...(await scan(page))];
  const CARD = "#graview-app [data-testid='columns-lens'] [data-graview-listed][draggable='true']";
  const steps = { card: false, carried: false, dropped: false, menu: false, dragged: false };
  const link = page.locator(`${CARD} .graview-spec-item-link`).first();
  if ((await link.count()) === 0) return { scans, steps };
  steps.card = true;
  const said = () => page.evaluate(() => document.querySelector('[data-testid="columns-announce"]')?.textContent ?? "");
  await link.focus();
  await page.keyboard.press(" ");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  steps.carried = / \d+ of \d+\.$/.test(await said()) && (await page.locator('[data-testid="columns-slot"]').count()) > 0;
  scans.push(...(await scan(page)));
  await page.keyboard.press(" ");
  await page.waitForTimeout(500);
  steps.dropped = (await said()).includes("dropped in");
  await page.keyboard.press("Shift+F10");
  await page.waitForTimeout(800);
  const row = page.locator('[data-testid="context-menu"] [data-menu-item="move-to"]');
  if ((await row.count()) > 0) {
    await row.click();
    await page.waitForTimeout(200);
    steps.menu = (await page.locator('[data-testid="context-menu"] [data-move-to]').count()) > 0;
    scans.push(...(await scan(page)));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  const drag = await page.evaluate((selector) => {
    const first = document.querySelector(selector);
    const from = first?.closest("[data-graview-column]")?.getAttribute("data-graview-column");
    const to = [...document.querySelectorAll("#graview-app [data-graview-column]")].map((column) => column.getAttribute("data-graview-column")).find((value) => value && value !== from);
    return first && to ? { id: first.getAttribute("data-graview-listed"), to } : null;
  }, CARD);
  if (drag) {
    const before = await page.evaluate(() => document.querySelector('[data-testid="columns-said"]')?.textContent ?? "");
    await page.dragAndDrop(`#graview-app [data-graview-listed="${drag.id}"]`, `#graview-app [data-graview-column="${drag.to}"]`).catch(() => {});
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => document.querySelector('[data-testid="columns-said"]')?.textContent ?? "");
    steps.dragged = after.startsWith("Moved") && after !== before;
    scans.push(...(await scan(page)));
  }
  return { scans, steps };
}

const servers = [];
/** What each board screen reached, step by step. */
const boards = [];
/** What each first-look screen found, hint by hint. */
const hints = [];
const largeText = [];
const escapes = [];
let host;
let browser;
const findings = [];
const scanned = [];
const errors = [];
try {
  if (SCREENS.some((screen) => screen.hosted)) host = await buildHost();
  for (const app of new Set(SCREENS.filter((screen) => screen.app).map((screen) => screen.app))) {
    servers.push(await serving(app, portFor(app), repoRoot));
  }
  browser = await launchEngine("chromium");
  for (const screen of SCREENS) {
    for (const [size, scheme] of SWEEP) {
      const context = await browser.newContext({ viewport: VIEWPORTS[size], colorScheme: scheme });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${screen.name} · ${size} · ${scheme}: ${error.message}`));
      const label = `${screen.name} · ${size} · ${scheme}`;
      try {
        await page.goto(screen.url(), { waitUntil: "load" });
        await ready(page, screen);
        /*
         * With a first look: every hint opened in turn, axe run with each
         * open, and Next pressed until Done.
         */
        const scans = [];
        if (screen.firstLook) {
          let shown = await firstHint(page);
          if (!shown) errors.push(`${label}: no first look was shown`);
          for (let turn = 0; shown && turn < 8; turn++) {
            hints.push({ screen: label, ...shown });
            scans.push(...(await scan(page)));
            const pressed = await page.evaluate(() => {
              const button = document.querySelector('[data-testid="first-look-next"], [data-testid="first-look-done"]');
              const done = button?.getAttribute("data-testid") === "first-look-done";
              button?.click();
              return done;
            });
            await page.waitForTimeout(200);
            shown = pressed ? null : await hintNow(page);
          }
        }
        if (screen.board) {
          const moved = await boardMoves(page);
          scans.push(...moved.scans);
          boards.push({ screen: label, ...moved.steps });
        }
        const violations = screen.firstLook || screen.board ? scans : await scan(page);
        let count = 0;
        for (const v of violations) {
          for (const node of v.nodes) {
            // On a host's page, only what the framework drew is the framework's (Cloud's attribution, exactly).
            if (screen.hosted && !node.inRoot && !DOCUMENT_RULES.has(v.rule)) continue;
            findings.push({ screen: label, rule: v.rule, impact: v.impact, help: v.help, target: node.target, html: node.html, summary: node.summary });
            count++;
          }
        }
        scanned.push({ screen: label, nodes: count });
      } catch (error) {
        errors.push(`${label}: ${error.message.split("\n")[0]}`);
      }
      await context.close();
    }
    /*
     * A PHONE AT THE LARGEST TEXT: the first look again, the page's text at
     * twice its size, each hint inside the screen; and Escape ends it with
     * the keyboard back in the app, not on <body>.
     */
    if (screen.firstLook) {
      const label = `${screen.name} · phone · largest text`;
      const context = await browser.newContext({ viewport: VIEWPORTS.phone, colorScheme: "light" });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.style.fontSize = "200%";
        });
      });
      try {
        await page.goto(screen.url(), { waitUntil: "load" });
        await ready(page, screen);
        let shown = await firstHint(page);
        if (!shown) errors.push(`${label}: no first look was shown`);
        for (let turn = 0; shown && turn < 8; turn++) {
          largeText.push({ screen: label, ...shown });
          const pressed = await page.evaluate(() => {
            const button = document.querySelector('[data-testid="first-look-next"], [data-testid="first-look-done"]');
            const done = button?.getAttribute("data-testid") === "first-look-done";
            button?.click();
            return done;
          });
          await page.waitForTimeout(200);
          shown = pressed ? null : await hintNow(page);
        }
        // Again, and ended with Escape.
        await page.goto(screen.url(), { waitUntil: "load" });
        await ready(page, screen);
        if (await firstHint(page)) {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          escapes.push({
            screen: label,
            ...(await page.evaluate(() => ({
              gone: document.querySelector('[data-testid="first-look"]') === null,
              keyboardInApp: document.activeElement !== null && document.activeElement !== document.body && document.querySelector("#graview-app").contains(document.activeElement),
            }))),
          });
        }
      } catch (error) {
        errors.push(`${label}: ${error.message.split("\n")[0]}`);
      }
      await context.close();
    }
  }
} finally {
  await browser?.close().catch(() => undefined);
  host?.stop();
  for (const server of servers) server.stop();
}

/** By rule: how many nodes, on which screens, and a few of them. */
const byRule = {};
for (const finding of findings) {
  const rule = (byRule[finding.rule] ??= { impact: finding.impact, help: finding.help, nodes: 0, screens: [], samples: [] });
  rule.nodes++;
  if (!rule.screens.includes(finding.screen)) rule.screens.push(finding.screen);
  if (rule.samples.length < 6 && !rule.samples.some((sample) => sample.target === finding.target)) {
    rule.samples.push({ target: finding.target, html: finding.html, summary: finding.summary });
  }
}
const hostedFindings = findings.filter((finding) => SCREENS.find((screen) => finding.screen.startsWith(`${screen.name} ·`))?.hosted);

const checks = {
  theFrameworksMarkupOnAHostsPagePassesAxe: {
    nodes: hostedFindings.length,
    rules: [...new Set(hostedFindings.map((finding) => finding.rule))],
    ok: scanned.length > 0 && hostedFindings.length === 0,
  },
  everyExampleAppPassesAxeOnBothFaces: {
    nodes: findings.length - hostedFindings.length,
    rules: [...new Set(findings.filter((finding) => !hostedFindings.includes(finding)).map((finding) => finding.rule))],
    ok: scanned.length > 0 && findings.length === hostedFindings.length,
  },
  aFirstLookPassesAxeWithEachHintOpen: {
    hints: hints.length,
    nodes: findings.filter((finding) => finding.screen.includes("first look")).length,
    ok: SCREENS.every((screen) => !screen.firstLook) || (hints.length > 0 && findings.every((finding) => !finding.screen.includes("first look"))),
  },
  aFirstLookPointsAtTheSwitchAndTheProblemsOnBothFaces: {
    faces: [...new Set(hints.map((hint) => hint.screen.replace(/ · (desk|phone).*/, "")))].map((screen) => ({ screen, anchors: [...new Set(hints.filter((hint) => hint.screen.startsWith(screen)).map((hint) => hint.anchor))] })),
    ok: SCREENS.every((screen) => !screen.firstLook) || SCREENS.filter((screen) => screen.firstLook).every((screen) => ["faces", "problems"].every((anchor) => hints.some((hint) => hint.screen.startsWith(screen.name) && hint.anchor === anchor))),
  },
  aHintNeverCoversItsControl: { covering: [...hints, ...largeText].filter((hint) => hint.covers).map((hint) => `${hint.screen} · ${hint.anchor}`), ok: [...hints, ...largeText].every((hint) => !hint.covers) },
  aHintFitsTheScreenAtDeskAndPhoneWidths: { over: hints.filter((hint) => !hint.fits).map((hint) => `${hint.screen} · ${hint.anchor}`), ok: hints.every((hint) => hint.fits) },
  aHintFitsAPhoneAtTheLargestText: {
    hints: largeText.length,
    over: largeText.filter((hint) => !hint.fits).map((hint) => `${hint.screen} · ${hint.anchor}`),
    ok: SCREENS.every((screen) => !screen.firstLook) || (largeText.length > 0 && largeText.every((hint) => hint.fits)),
  },
  theKeyboardIsOnEachHintAsItOpens: { off: hints.filter((hint) => !hint.keyboardOn).map((hint) => `${hint.screen} · ${hint.anchor}`), ok: hints.every((hint) => hint.keyboardOn) },
  escapeEndsTheFirstLookAndGivesTheKeyboardBack: {
    escapes,
    ok: SCREENS.every((screen) => !screen.firstLook) || (escapes.length === SCREENS.filter((screen) => screen.firstLook).length && escapes.every((one) => one.gone && one.keyboardInApp)),
  },
  aBoardMovedByTheKeyboardItsMenuAndAPointerPassesAxe: {
    boards,
    nodes: findings.filter((finding) => finding.screen.includes("a board moved")).length,
    ok: SCREENS.every((screen) => !screen.board) || (boards.length > 0 && boards.every((one) => one.card && one.carried && one.dropped && one.menu && one.dragged) && findings.every((finding) => !finding.screen.includes("a board moved"))),
  },
  everyScreenWasScanned: { scanned: scanned.length, expected: SCREENS.length * SWEEP.length, ok: scanned.length === SCREENS.length * SWEEP.length },
  noPageThrew: { errors, ok: errors.length === 0 },
};
const report = {
  at: new Date().toISOString(),
  tags: TAGS,
  sweep: SWEEP.map(([size, scheme]) => `${size} ${scheme}`),
  checks,
  byRule,
  scanned,
  firstLook: { hints, largeText },
  passed: Object.values(checks).every((check) => check.ok),
};
writeFileSync(resolve(repoRoot, "docs/a11y.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
for (const [rule, seen] of Object.entries(byRule)) process.stdout.write(`     ${rule} (${seen.impact}): ${seen.nodes} node(s) on ${seen.screens.length} screen(s)\n`);
process.stdout.write(`${findings.length} node(s) over ${scanned.length} screen(s)\n`);
process.exit(report.passed ? 0 : 1);
