#!/usr/bin/env node
/**
 * THE SCENE'S MENU ON A PLACE AND IN A LIST'S COLUMN (Roadmap
 * f-make-any-page-better), driven in a real browser against the todo app.
 *
 * Nick, on the scene's "The lists", right-clicked by the Someday column:
 * the menu offered Chat alone — no Better UI — and said "Nothing can be done
 * with a list yet — nothing this app declares acts on it", of an app that
 * renames a list, notes why it is there and adds a task to it. The menu was
 * about every list at once.
 *
 *   aRightClickInAListsColumnInTheSceneOffersItsActs — a right-click in a
 *     list's column, between its tasks, is about that list: its acts (Add a
 *     task, Rename) are offered, and no sentence says nothing can be done.
 *   aRightClickOnAPlaceInTheSceneOffersBetterUiAndOpensThePanel — below the
 *     columns, on the place itself, ✨ Better UI is offered; the sentence
 *     about the acts says what is done to one list, never that the app
 *     declares nothing; and Better UI opens its panel on the place's page,
 *     saying it came from the scene.
 *
 *   node scripts/verify-scene-menu.mjs [--engine=chromium|webkit|firefox]
 *   GRAVIEW_SCENE_MENU_SHOTS=<dir> to keep pictures of each.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { deadline } from "./lib/deadline.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const SHOTS = process.env.GRAVIEW_SCENE_MENU_SHOTS;
const VERDICT = resolve(repoRoot, "docs/scene-menu.json");
const MENU = '[data-testid="context-menu"]';
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let app;
let browser;
const reach = deadline({
  verdict: VERDICT,
  report,
  cleanup: async () => {
    await browser?.close();
    app?.stop();
  },
});

/* A host's model that answers nothing, so the menu draws its two ways and nothing reaches a real model. */
const QUIET_AI = () => {
  window.__todoAi = {
    name: "quiet",
    fast: { model: "quiet-fast", decide: async () => ({ answers: {}, usage: { inputTokens: 0, outputTokens: 0 } }) },
    thinking: { model: "quiet-thinking", think: async () => ({ text: "{}" }) },
  };
  // The todo example's dev host: a change to the app composed and shown, which Better UI needs.
  window.__todoDevHost = true;
};

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${ENGINE}-${name}.png`) }).catch(() => undefined);
}

app = await serving("todo", portFor("todo"), repoRoot);
const errors = [];
try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(QUIET_AI);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 120_000 });
  await page.waitForFunction(() => [...document.querySelectorAll("section")].some((one) => one.textContent?.includes("Find someone who moves pianos")), null, { timeout: 60_000 });
  await page.waitForTimeout(800);

  /* A point inside Someday's column on no task and not its heading, and one below the columns, on the place. */
  const spots = await page.evaluate(() => {
    const find = (text) => [...document.querySelectorAll("*")].find((one) => one.children.length === 0 && one.textContent?.trim() === text);
    const section = find("Find someone who moves pianos")?.closest("section");
    if (!section) return null;
    const box = section.getBoundingClientRect();
    let gap = null;
    for (let y = box.top + 1; y < box.bottom && !gap; y += 1)
      for (let x = box.left + 1; x < box.right; x += 6) {
        const element = document.elementFromPoint(x, y);
        if (element && section.contains(element) && !element.closest("[data-graview-pick]")) {
          gap = { x: Math.round(x), y: Math.round(y) };
          break;
        }
      }
    return { gap, below: { x: Math.round(box.left + 20), y: Math.round(box.bottom + 30) } };
  });
  const menuAt = async (point) => {
    await page.mouse.click(point.x, point.y, { button: "right" });
    await page.waitForSelector(MENU, { timeout: 10_000 });
    await page.waitForSelector(`${MENU} [data-menu-mode="better"]`, { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    return page.evaluate((menu) => {
      const one = document.querySelector(menu);
      return {
        modes: [...(one?.querySelectorAll("[data-menu-mode]") ?? [])].map((each) => each.getAttribute("data-menu-mode")),
        acts: [...(one?.querySelectorAll('[data-testid="affordances"] li') ?? [])].map((each) => (each.textContent ?? "").replace(/[★☆]/g, "").trim()),
        empty: one?.querySelector('[data-testid="no-affordances"]')?.textContent ?? null,
      };
    }, MENU);
  };

  reach("aRightClickInAListsColumnInTheSceneOffersItsActs");
  {
    const column = spots?.gap ? await menuAt(spots.gap) : null;
    await shot(page, "column-menu");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    report.checks.aRightClickInAListsColumnInTheSceneOffersItsActs = {
      column,
      ok: column !== null && column.acts.some((one) => /^Add a task/.test(one)) && column.acts.some((one) => /^Rename/.test(one)) && column.empty === null,
    };
  }

  reach("aRightClickOnAPlaceInTheSceneOffersBetterUiAndOpensThePanel");
  {
    const place = spots ? await menuAt(spots.below) : null;
    await shot(page, "place-menu");
    const honest = place !== null && (place.empty === null || (!/declares|acts on/.test(place.empty) && /Right-click one list/.test(place.empty)));
    let panel = null;
    if (place?.modes.includes("better")) {
      await page.click(`${MENU} [data-menu-mode="better"]`);
      await page.waitForSelector('[data-testid="better-panel"]', { timeout: 60_000 }).catch(() => undefined);
      panel = await page.evaluate(() => {
        const one = document.querySelector('[data-testid="better-panel"]');
        return one ? { path: location.pathname, about: one.querySelector('[data-testid="better-about"]')?.textContent ?? null, says: (one.textContent ?? "").slice(0, 240) } : null;
      });
      await shot(page, "better-panel");
    }
    report.checks.aRightClickOnAPlaceInTheSceneOffersBetterUiAndOpensThePanel = {
      place,
      panel,
      ok: Boolean(place?.modes.includes("better")) && honest && panel !== null && /The lists/.test(panel.about ?? "") && /From the scene/.test(panel.says) && /\/pages\/places\/the-lists/.test(panel.path),
    };
  }

  reach.done();
  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  reach.done();
  if (!report.checks[reach.at()]) report.checks[reach.at()] = { ok: false, stopped: String(error) };
  report.stoppedAt = reach.at();
  report.pageErrors = errors;
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app?.stop();
}

writeFileSync(VERDICT, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/scene-menu.json\n`);
process.exit(report.passed ? 0 : 1);
