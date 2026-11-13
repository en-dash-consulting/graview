#!/usr/bin/env node
/**
 * THE ONE FACE, MOUNTED WHOLE THROUGH THE EMBED (FR-239).
 *
 * Graview Cloud draws every app's page through `@graview/embed`'s `mount`,
 * not `PagesApp`. Mounted with `sceneUnderPages`, the routed face stands
 * over the Scene's own city as it does on the todo example
 * (`verify-one-face`), and the embed's own bar — the app's name, its places,
 * Find, the inbox, the host's Share and the person — stands in the one
 * face's slot (`[data-graview-one-face-bar]`), fixed at the window's top
 * above every layer of the face. Held here at a desk (1280 × 800) and on a
 * phone (390 × 844), over `graview preview` of a small team's tasks, mounted
 * as Cloud mounts it (whole page, address routing, `?city=1`):
 *
 *   drawsTheOneFace                 the one face is drawn, the embed's root is
 *                                   the pages', and the bar offers no switch
 *                                   to a scene;
 *   barStandsInTheSlot              the embed's one bar is inside the slot,
 *                                   and there is no other;
 *   barVisibleAndPressableAt…       at Page, Nearby and City every control
 *                                   of the bar is inside the window, and a
 *                                   press at its middle lands on it — nothing
 *                                   of the face over it — and the person's
 *                                   menu opens from it;
 *   pageKeepsItsRoomUnderTheBar     at Page the page's first words are below
 *                                   the bar, never under it;
 *   theWindowScrollsThePage         the page is in the window's flow: the
 *                                   window scrolls it, the bar stays;
 *   keysMoveTheLevels               1, 2, 3, [ and ] move the levels;
 *   noPageThrew.
 *
 *   node scripts/verify-embed-one-face.mjs
 *
 * Writes docs/embed-one-face.json.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryAdapter } from "../packages/core/dist/index.js";
import { servePreview } from "../packages/ship/dist/index.js";
import { launchEngine } from "./lib/engine.mjs";
import { portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = resolve(repoRoot, "packages/graview/dist/preview");
const DOCUMENT = "packages/core/tests/document/fixtures/tasks.gdd.json";
const PROFILES = [
  { name: "desk", options: { viewport: { width: 1280, height: 800 } } },
  { name: "phone", options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];
/** The bar's controls a person reaches at every level: each a selector, the first that is drawn counted. */
const CONTROLS = {
  name: '[data-testid="app-home"], [data-testid="app-name"]',
  places: '[data-testid="app-places-open"], [data-testid="app-places"], [data-testid="app-place-current"]',
  find: '[data-testid="app-find-open"], [data-testid="app-find"]',
  notices: '[data-testid="inbox-button"]',
  share: '[data-testid="app-share-open"]',
  person: '[data-testid="profile-button"]',
};
const LEVELS = ["Page", "Nearby", "City"];

if (!existsSync(resolve(PAGE, "index.html"))) {
  process.stderr.write("verify-embed-one-face: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

/** A small team's tasks, the todo example's size: enough to scroll a list. */
function tasksSeed() {
  const people = ["Ada", "Ben", "Cleo", "Dev"].map((label, at) => ({ id: `person-${at}`, kind: "person", label }));
  const verbs = ["Book", "Write", "Fix", "Plan"];
  const things = ["the venue", "the newsletter", "the gate", "the trip", "the hall", "the rota"];
  const tasks = Array.from({ length: 24 }, (_, at) => ({ id: `task-${at}`, kind: "task", label: `${verbs[at % 4]} ${things[Math.floor(at / 4)]}`, status: ["todo", "doing", "done"][at % 3] }));
  const edges = tasks.map((task, at) => ({ id: `e${at}`, kind: "assigned-to", from: task.id, to: people[at % 4].id }));
  return { nodes: [...tasks, ...people], edges };
}

/** Wait until the face rests at a level: the page says it and the camera is there. */
async function restAt(page, level, timeout = 10_000) {
  await page.waitForFunction(
    (want) => {
      const sheet = document.querySelector("[data-graview-one-place]");
      const city = document.querySelector('[data-testid="one-place-city"]');
      const now = Number(city?.getAttribute("data-graview-altitude-now") ?? (want === 0 ? 0 : -1));
      return Number(sheet?.getAttribute("data-graview-one-place")) === want && Math.abs(now - want) < 0.002;
    },
    level,
    { timeout },
  );
  await page.waitForTimeout(300);
}

/** Each of the bar's controls: drawn, inside the window, and the element a press at its middle lands on is it. */
const barAsSeen = (page) =>
  page.evaluate((controls) => {
    const out = {};
    for (const [name, selector] of Object.entries(controls)) {
      const el = [...document.querySelectorAll(selector)].find((one) => one.getBoundingClientRect().width > 0);
      if (!el) {
        out[name] = { drawn: false, ok: false };
        continue;
      }
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const inside = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5;
      const hit = document.elementFromPoint(x, y);
      const lands = hit !== null && (el === hit || el.contains(hit));
      const inSlot = el.closest("[data-graview-one-face-bar]") !== null;
      out[name] = { drawn: true, inside, lands, inSlot, hit: lands ? undefined : hit ? `${hit.tagName.toLowerCase()}${hit.getAttribute("data-testid") ? `[${hit.getAttribute("data-testid")}]` : ""}` : null, ok: inside && lands && inSlot };
    }
    return out;
  }, CONTROLS);

/** The person's menu opens from the bar, at this level, and is put away again. */
async function personMenuOpens(page) {
  const button = page.locator(CONTROLS.person).locator("visible=true").first();
  await button.click({ timeout: 5_000 });
  const opened = await page.locator('[data-testid="profile"]').locator("visible=true").first().waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  // Escape put the menu away; were it to have moved a level, the level is put back by the caller's next rest.
  return opened;
}

/** Off any control, so the keys are the page's. */
const blur = (page) => page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));

async function profile(browser, url, { name, options }, errors) {
  const context = await browser.newContext({ ...options, colorScheme: "light", reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
  const checks = {};
  const at = (what) => `${what}On${name[0].toUpperCase()}${name.slice(1)}`;
  try {
    await page.goto(`${url}/tasks?city=1`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true, null, { timeout: 60_000 });
    // What Cloud hands the bar: its Share and a notification, so both stand on it.
    await page.evaluate(() => {
      window.__graview.setShare({ description: "Only you can open this app.", link: { label: "Sharing settings", href: "#sharing" } });
      window.__graview.setNotifications([{ id: "n1", title: "A task was assigned to you", needs: true }]);
    });
    await page.waitForSelector("[data-graview-one-place]", { timeout: 30_000 });
    await page.waitForSelector("[data-graview-one-face-bar] [data-graview-app-bar]", { timeout: 30_000 });
    await page.waitForTimeout(600);

    const drawn = await page.evaluate(() => ({
      root: document.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed") ?? null,
      oneFace: document.querySelectorAll("[data-graview-one-place]").length,
      control: document.querySelectorAll('[data-testid="altitude"]').length,
    }));
    const switches = await page.locator('[data-testid="app-menu-open"]').locator("visible=true").first().click({ timeout: 5_000 }).then(
      async () => {
        const count = await page.locator('[data-testid="app-face-scene"]').count();
        await page.keyboard.press("Escape");
        return count;
      },
      () => 0,
    );
    checks[at("drawsTheOneFace")] = { ...drawn, sceneSwitch: switches, ok: drawn.root === "pages" && drawn.oneFace === 1 && drawn.control === 1 && switches === 0 };

    const slot = await page.evaluate(() => ({
      bars: document.querySelectorAll("[data-graview-app-bar]").length,
      inSlot: document.querySelectorAll("[data-graview-one-face-bar] [data-graview-app-bar]").length,
      testid: document.querySelector('[data-graview-one-face-bar][data-testid="one-place-bar"]') !== null,
    }));
    checks[at("barStandsInTheSlot")] = { ...slot, ok: slot.bars === 1 && slot.inSlot === 1 && slot.testid };

    await restAt(page, 0);
    await blur(page);
    const room = await page.evaluate(() => {
      const bar = document.querySelector("[data-graview-one-face-bar]").getBoundingClientRect();
      const title = document.querySelector("[data-graview-one-place] h1, [data-graview-one-place] h2");
      const top = title ? title.getBoundingClientRect().top : null;
      return { barBottom: Math.round(bar.bottom), titleTop: top === null ? null : Math.round(top) };
    });
    checks[at("pageKeepsItsRoomUnderTheBar")] = { ...room, ok: room.titleTop !== null && room.titleTop >= room.barBottom - 0.5 };

    const scroll = await page.evaluate(async () => {
      const content = document.querySelector("[data-embed-content]");
      const tall = document.scrollingElement.scrollHeight;
      window.scrollTo({ top: 400, behavior: "instant" });
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const scrolled = window.scrollY;
      const barTop = document.querySelector("[data-graview-one-face-bar]").getBoundingClientRect().top;
      window.scrollTo({ top: 0, behavior: "instant" });
      return { overflow: getComputedStyle(content).overflowY, tall, window: window.innerHeight, scrolled, barTop: Math.round(barTop) };
    });
    checks[at("theWindowScrollsThePage")] = { ...scroll, ok: scroll.overflow === "visible" && scroll.tall > scroll.window && scroll.scrolled > 0 && scroll.barTop === 0 };

    for (const [level, word] of LEVELS.entries()) {
      await blur(page);
      await page.keyboard.press(String(level + 1));
      await restAt(page, level);
      const bar = await barAsSeen(page);
      const menu = await personMenuOpens(page);
      // Escape may come down a level once the menu is away: back to the level held.
      await blur(page);
      if (Number(await page.evaluate(() => document.querySelector("[data-graview-one-place]")?.getAttribute("data-graview-one-place"))) !== level) {
        await page.keyboard.press(String(level + 1));
        await restAt(page, level);
      }
      checks[at(`barVisibleAndPressableAt${word}`)] = { controls: bar, personMenuOpens: menu, ok: Object.values(bar).every((one) => one.ok) && menu };
    }

    const keys = [];
    await page.keyboard.press("1");
    await restAt(page, 0);
    for (const [key, want] of [["2", 1], ["3", 2], ["[", 1], ["]", 2], ["1", 0]]) {
      await blur(page);
      await page.keyboard.press(key);
      const rested = await restAt(page, want).then(() => true, () => false);
      keys.push({ key, want, rested });
    }
    checks[at("keysMoveTheLevels")] = { keys, ok: keys.every((one) => one.rested) };
  } catch (error) {
    checks[at("ran")] = { error: String(error?.stack ?? error), ok: false };
  } finally {
    await context.close();
  }
  return checks;
}

const report = { at: new Date().toISOString(), engine: "chromium", document: DOCUMENT, checks: {} };
const errors = [];
let browser;
let preview;
try {
  const document = JSON.parse(readFileSync(resolve(repoRoot, DOCUMENT), "utf8"));
  preview = await servePreview({ document, seed: tasksSeed(), page: PAGE, port: portFor("embed-one-face"), adapter: createMemoryAdapter() });
  const url = `http://localhost:${preview.served.port}`;
  browser = await launchEngine("chromium");
  for (const one of PROFILES) Object.assign(report.checks, await profile(browser, url, one, errors));
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  await preview?.close();
}

writeFileSync(resolve(repoRoot, "docs/embed-one-face.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.exit(report.passed ? 0 : 1);
