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
 * as Cloud mounts it (whole page, address routing, `?graview-one-face=1`):
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
 *   keysTypedInFindLeaveTheLevel    typed into Find, in the slot, they are
 *                                   words and the level stays;
 *   thePanelOptionSetsTheDesksPanel mounted with `panel: 0.6` the page
 *                                   beside the city is 60% of the window
 *                                   (55% unsaid), in the panel's gutter;
 *   noRibbonIsFilledAt…In…          at Nearby and City, in light and dark,
 *                                   every ribbon between districts is drawn
 *                                   with no fill, and a band at rest with
 *                                   the scheme's stroke opacity, which only
 *                                   the Scene's rules say: they come with
 *                                   the city, so no band is a black
 *                                   polygon on the ground;
 *   theCityDrawsAsUnderPagesAppAt…  at Nearby and City, in light and dark,
 *                                   every element of the city — a ribbon's
 *                                   band, a building's faces, a district's
 *                                   name — has the computed styles it has
 *                                   once the embed's sheets are put aside
 *                                   and `PagesApp`'s own (`themeCss`) is
 *                                   adopted, as the examples adopt it;
 *
 * And held to a box of somebody else's page, as `mount` draws it by default
 * under memory routing: graview.dev's docs page "This site, as an app"
 * (`docs/site/docs/site.html`, its built `chapters.js`), at the desk and
 * the phone:
 *
 *   theDocsPageShowsNoScenePagesSwitch   the app menu offers no Scene or
 *                                   Pages, and nothing on the page draws the
 *                                   old two faces' controls (the switch,
 *                                   Close the map, Reset view, From above,
 *                                   the zoom pill) or a scene face;
 *   theBarIsInsideTheBoxAt…         at Map, Nearby and Page the bar stands
 *                                   inside the box, at its top;
 *   nothingOfTheFacePaintsOutsideTheBoxAt…  the box clips what it holds
 *                                   (`contain: paint`), and no point of the
 *                                   window outside it lands on the face;
 *   mapWorksInTheBox, nearbyWorks…, pageWorks…  each level rests, from
 *                                   its key pressed inside the box, its
 *                                   control and (below Map) its page in the
 *                                   box;
 *   theBoxScrollsItsOwnPage         at Page a wheel over the page scrolls
 *                                   the page, and the window stays;
 *   theHostPageScrollsWithThePointerOutsideTheBox  and a wheel outside the
 *                                   box scrolls the host's page;
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
import { appFromOrCompile } from "../packages/core/dist/compiled.js";
import { themeBaseCss } from "../packages/primitives/dist/theme.js";
import { viewsCss } from "../packages/primitives/dist/views-css.js";
import { sceneCss, themeCss } from "../packages/primitives/dist/scene-css.js";
import { servePreview } from "../packages/ship/dist/index.js";
import { launchEngine } from "./lib/engine.mjs";
import { closeAppMenu } from "./lib/bar.mjs";
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
    await page.goto(`${url}/tasks?graview-one-face=1`, { waitUntil: "load" });
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
    // The app menu opened as a person opens it, its rows drawn, before the switch is looked for: a menu that never opened fails the claim.
    const menu = await page.locator('[data-testid="app-menu-open"]').locator("visible=true").first().click({ timeout: 5_000 }).then(
      async () => {
        // Its rows drawn (History, at least, where the one face leaves no Scene or Pages), before the switch is looked for.
        await page.locator('[data-testid="app-menu"] button').locator("visible=true").first().waitFor({ state: "visible", timeout: 10_000 });
        const rows = await page.locator('[data-testid="app-menu"]').locator("visible=true").first().evaluate((el) => el.querySelectorAll("button, a").length);
        const scene = await page.locator('[data-testid="app-face-scene"]').count();
        await closeAppMenu(page);
        return { opened: true, rows, scene };
      },
      (error) => ({ opened: false, rows: 0, scene: null, error: String(error?.message ?? error) }),
    );
    checks[at("drawsTheOneFace")] = { ...drawn, menu, ok: drawn.root === "pages" && drawn.oneFace === 1 && drawn.control === 1 && menu.opened && menu.rows > 0 && menu.scene === 0 };

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

    // Typed into Find, in the slot, the level keys are words: at Nearby, "1", "3" and "]" go into the box and the level stays.
    await blur(page);
    await page.keyboard.press("2");
    await restAt(page, 1);
    const opener = page.locator('[data-testid="app-find-open"]').locator("visible=true").first();
    if ((await opener.count()) > 0) await opener.click({ timeout: 5_000 });
    const box = page.locator('[data-graview-one-face-bar] [data-testid="find-box"], [data-graview-one-face-bar] [data-testid="nav-find"]').locator("visible=true").first();
    await box.click({ timeout: 5_000 });
    await page.keyboard.type("13]", { delay: 60 });
    await page.waitForTimeout(900);
    const typed = {
      value: await box.inputValue(),
      level: await page.evaluate(() => Number(document.querySelector("[data-graview-one-place]")?.getAttribute("data-graview-one-place"))),
      inBox: await box.evaluate((el) => document.activeElement === el),
    };
    checks[at("keysTypedInFindLeaveTheLevel")] = { ...typed, ok: typed.value.includes("13]") && typed.level === 1 && typed.inBox };
    await box.fill("");
    await blur(page);
  } catch (error) {
    checks[at("ran")] = { error: String(error?.stack ?? error), ok: false };
  } finally {
    await context.close();
  }
  return checks;
}

/*
 * THE MOUNT'S `panel` SETS THE DESK'S PANEL: mounted with `panel: 0.6`, the
 * page beside the city at Nearby is 60% of a 1280 window, says it is in the
 * panel and takes a panel's gutter; mounted without it, 55%.
 */
async function panelOption(browser, url, errors) {
  const widthAt = async (search) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`panel option: ${error.message}`));
    try {
      await page.goto(`${url}/tasks?graview-one-face=1${search}`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__graviewReady === true, null, { timeout: 60_000 });
      await page.waitForSelector("[data-graview-one-place]", { timeout: 30_000 });
      await blur(page);
      await page.keyboard.press("2");
      await restAt(page, 1);
      return await page.evaluate(() => {
        const sheet = document.querySelector("[data-graview-one-place]");
        return { width: Math.round(sheet.getBoundingClientRect().width), inPanel: sheet.hasAttribute("data-graview-in-panel"), gutter: getComputedStyle(sheet).getPropertyValue("--graview-gutter").trim() };
      });
    } finally {
      await context.close();
    }
  };
  const asked = await widthAt("&graview-one-face-panel=0.6");
  const unsaid = await widthAt("");
  return { asked, unsaid, ok: Math.abs(asked.width - 768) <= 1 && Math.abs(unsaid.width - 704) <= 1 && asked.inPanel && asked.gutter === "16px" };
}

/** What the city's styles are read as: every property a sheet of the Scene's, the frame's or the city's own may set on what it draws. */
const STYLED = ["display", "visibility", "opacity", "fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width", "stroke-dasharray", "stroke-linejoin", "stroke-linecap", "paint-order", "color", "background-color", "background-image", "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "text-transform", "text-shadow", "border-top-width", "border-top-style", "border-top-color", "border-radius", "padding-top", "padding-left", "box-shadow", "filter", "mix-blend-mode", "pointer-events", "cursor"];
/** What the claim names by role, and where each is found in the city. */
const NAMED = {
  ribbonBand: '[data-testid="one-place-city"] .graview-ribbon-band',
  buildingRoof: '[data-testid="one-place-city"] .graview-building .graview-iso-roof',
  buildingLeft: '[data-testid="one-place-city"] .graview-building .graview-iso-left',
  buildingRight: '[data-testid="one-place-city"] .graview-building .graview-iso-right',
  districtName: '[data-testid="one-place-names"] .graview-one-place-district',
  districtNameButton: '[data-testid="one-place-names"] .graview-one-place-district button',
};

/** Every element the city draws — the Scene under the page and the districts' names over it — each with its computed styles. */
const cityStyles = (page) =>
  page.evaluate(
    ({ styled, named }) => {
      const read = (el) => {
        const style = getComputedStyle(el);
        return Object.fromEntries(styled.map((name) => [name, style.getPropertyValue(name)]));
      };
      const all = [...document.querySelectorAll('[data-testid="one-place-city"] *, [data-testid="one-place-names"] *')].filter((el) => el.tagName !== "STYLE");
      return {
        all: all.map((el) => ({ what: `${el.tagName.toLowerCase()}${el.getAttribute("class") ? `.${el.getAttribute("class").trim().split(/\s+/).join(".")}` : ""}`, style: read(el) })),
        named: Object.fromEntries(
          Object.entries(named).map(([role, selector]) => {
            const el = document.querySelector(selector);
            return [role, el ? read(el) : null];
          }),
        ),
        bands: [...document.querySelectorAll('[data-testid="one-place-city"] .graview-ribbon-band')].map((el) => {
          const style = getComputedStyle(el);
          const ribbon = el.closest(".graview-ribbon");
          return { fill: style.fill, strokeOpacity: style.strokeOpacity, at: ribbon?.hasAttribute("data-graview-lit") || ribbon?.hasAttribute("data-graview-receded") ? "marked" : "rest" };
        }),
      };
    },
    { styled: STYLED, named: NAMED },
  );

/** The embed's own sheets put aside, and `PagesApp`'s whole sheet adopted in their place, as the examples adopt it (`apps/todo/src/main.tsx`). */
const asUnderPagesApp = (page, sheets, whole) =>
  page.evaluate(
    ({ sheets, whole }) => {
      const put = [];
      for (const style of document.querySelectorAll("[data-graview-embed] style")) {
        if (sheets.includes(style.textContent)) {
          style.media = "not all";
          put.push(style);
        }
      }
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(whole);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      window.__graviewPutAside = { put, sheet };
      return put.length;
    },
    { sheets, whole },
  );

const backToTheEmbeds = (page) =>
  page.evaluate(() => {
    const { put, sheet } = window.__graviewPutAside;
    for (const style of put) style.media = "";
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((one) => one !== sheet);
  });

/*
 * THE ONE FACE'S CITY DRAWS WITH THE SCENE'S RULES. `PagesApp`'s page writes
 * `themeCss` — the frame's rules, the views' and the Scene's — where the
 * embed's frame writes the frame's and the views'. At Nearby and at the
 * City, in each scheme: no ribbon band is filled, and every element of the
 * city reads as it does once the embed's sheets are put aside and the whole
 * `themeCss` is adopted, as `PagesApp` is hosted. Motion is stilled for both
 * readings, so nothing is read halfway through a transition.
 */
async function sceneRules(browser, url, scheme, app, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme, reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`scene rules, ${scheme}: ${error.message}`));
  const checks = {};
  const Scheme = `${scheme[0].toUpperCase()}${scheme.slice(1)}`;
  try {
    await page.goto(`${url}/tasks?graview-one-face=1`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true, null, { timeout: 60_000 });
    await page.waitForSelector("[data-graview-one-place]", { timeout: 30_000 });
    await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
    const scope = await page.evaluate(() => [...document.querySelector("[data-graview-embed]").classList].find((one) => one.startsWith("graview-embed-")));
    const at = { scope: `.${scope}` };
    // The embed's own sheets, as it writes them: the frame's, the views', and the Scene's where it writes them.
    const sheets = [themeBaseCss(scheme, app.brand, at), viewsCss(at), sceneCss(scheme, at)];
    const whole = themeCss(scheme, app.brand);
    for (const [level, word] of [[1, "Nearby"], [2, "City"]]) {
      await blur(page);
      await page.keyboard.press(String(level + 1));
      await restAt(page, level);
      const embed = await cityStyles(page);
      // Unfilled, and drawn by the Scene's own rule: a band at rest takes the scheme's stroke opacity, which only `sceneCss` says (the element's own `fill="none"` alone would leave the fill right and the rest of the band unstyled).
      const restOpacity = scheme === "light" ? "0.2" : "0.3";
      const atRest = embed.bands.filter((band) => band.at === "rest");
      checks[`noRibbonIsFilledAt${word}In${Scheme}`] = {
        bands: embed.bands.length,
        filled: embed.bands.filter((band) => band.fill !== "none").map((band) => band.fill),
        notTheScenes: atRest.filter((band) => band.strokeOpacity !== restOpacity).map((band) => band.strokeOpacity),
        ok: embed.bands.length > 0 && embed.bands.every((band) => band.fill === "none") && atRest.length > 0 && atRest.every((band) => band.strokeOpacity === restOpacity),
      };
      const putAside = await asUnderPagesApp(page, sheets, whole);
      await page.waitForTimeout(150);
      const pagesApp = await cityStyles(page);
      await backToTheEmbeds(page);
      const differ = [];
      for (let i = 0; i < Math.min(embed.all.length, pagesApp.all.length); i++) {
        const one = embed.all[i];
        const other = pagesApp.all[i];
        for (const name of STYLED) if (one.style[name] !== other.style[name]) differ.push({ what: one.what, property: name, embed: one.style[name], pagesApp: other.style[name] });
      }
      const named = Object.fromEntries(
        Object.keys(NAMED).map((role) => {
          const one = embed.named[role];
          const other = pagesApp.named[role];
          const off = one && other ? STYLED.filter((name) => one[name] !== other[name]).map((name) => ({ property: name, embed: one[name], pagesApp: other[name] })) : null;
          return [role, { drawn: one !== null, same: off !== null && off.length === 0, ...(off && off.length > 0 ? { off } : {}) }];
        }),
      );
      checks[`theCityDrawsAsUnderPagesAppAt${word}In${Scheme}`] = {
        putAside,
        elements: { embed: embed.all.length, pagesApp: pagesApp.all.length },
        named,
        differ: differ.length,
        first: differ.slice(0, 12),
        ok: putAside === sheets.length && embed.all.length === pagesApp.all.length && differ.length === 0 && Object.values(named).every((one) => one.drawn && one.same),
      };
    }
  } catch (error) {
    checks[`sceneRulesRanIn${Scheme}`] = { error: String(error?.stack ?? error), ok: false };
  } finally {
    await context.close();
  }
  return checks;
}

/*
 * THE ONE FACE HELD TO A BOX OF SOMEBODY ELSE'S PAGE (Graview HQ
 * feature:f-one-face-by-default). graview.dev's docs page "This site, as an
 * app" (`docs/site/docs/site.html`) mounts the site's own declaration into
 * one element of it with `mount`, which draws the one face unless told
 * otherwise, and holds it to that element: at a desk and on a phone, the
 * docs page as it is published (`file://`, the built `chapters.js`).
 */
const SITE_PAGE = `file://${resolve(repoRoot, "docs/site/docs/site.html")}`;
const BOX = '[data-graview-document="site-app"]';

/** Wait until the boxed face rests at a level: its page says it and its camera is there. */
async function restInBox(page, level, timeout = 15_000) {
  await page.waitForFunction(
    ({ want, box }) => {
      const holder = document.querySelector(box);
      const sheet = holder?.querySelector("[data-graview-one-place]");
      const city = holder?.querySelector('[data-testid="one-place-city"]');
      const now = Number(city?.getAttribute("data-graview-altitude-now") ?? (want === 0 ? 0 : -1));
      return Number(sheet?.getAttribute("data-graview-one-place")) === want && Math.abs(now - want) < 0.002;
    },
    { want: level, box: BOX },
    { timeout },
  );
  await page.waitForTimeout(300);
}

/** A level asked for from inside the box, as a person does: the keyboard on its level control, then the level's key. */
async function levelInBox(page, level) {
  await page.evaluate((box) => {
    const inside = document.activeElement && document.querySelector(box)?.contains(document.activeElement);
    if (!inside) document.querySelector(`${box} [data-testid="altitude"] button`)?.focus({ preventScroll: true });
  }, BOX);
  await page.keyboard.press(String(level + 1));
  await restInBox(page, level);
}

/** What of the face is seen, read against the box: the bar, the page, the level control, and any point of the window outside the box that lands on the face. */
const boxAsSeen = (page) =>
  page.evaluate((box) => {
    const holder = document.querySelector(box);
    const root = holder?.querySelector("[data-graview-embed]");
    if (!root) return { mounted: false };
    const r = root.getBoundingClientRect();
    const within = (q) => q.width > 0 && q.left >= r.left - 0.5 && q.right <= r.right + 0.5 && q.top >= r.top - 0.5 && q.bottom <= r.bottom + 0.5;
    const rectOf = (selector) => {
      const el = root.querySelector(selector);
      if (!el) return null;
      const q = el.getBoundingClientRect();
      return { left: Math.round(q.left), top: Math.round(q.top), right: Math.round(q.right), bottom: Math.round(q.bottom), width: Math.round(q.width), inside: within(q) };
    };
    // Every point of the window, a grid 32 across, that is outside the box: none may land on anything of the face.
    const leaks = [];
    const W = document.documentElement.clientWidth;
    const H = window.innerHeight;
    for (let i = 0; i <= 32; i++) {
      for (let j = 0; j <= 32; j++) {
        const x = Math.min(W - 1, (W * i) / 32);
        const y = Math.min(H - 1, (H * j) / 32);
        if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit && root.contains(hit)) leaks.push({ x: Math.round(x), y: Math.round(y), hit: `${hit.tagName.toLowerCase()}${hit.getAttribute("data-testid") ? `[${hit.getAttribute("data-testid")}]` : ""}` });
      }
    }
    // What of the face's own layers stands outside the box, measured: each fixed layer it draws.
    const outside = [...root.querySelectorAll("*")]
      .filter((el) => getComputedStyle(el).position === "fixed" && !el.matches(":popover-open"))
      .map((el) => ({ el, q: el.getBoundingClientRect() }))
      .filter(({ q }) => q.width > 1 && q.height > 1 && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom) && !within(q))
      .map(({ el }) => el.getAttribute("data-testid") ?? el.tagName.toLowerCase());
    const style = getComputedStyle(root);
    return {
      mounted: true,
      box: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) },
      held: root.hasAttribute("data-graview-one-face-box"),
      contain: style.contain,
      bar: rectOf("[data-graview-one-face-bar]"),
      sheet: rectOf("[data-graview-one-place]"),
      control: rectOf('[data-testid="altitude"] [data-graview-one-face-dock], [data-testid="altitude"]'),
      leaks: leaks.slice(0, 12),
      leaked: leaks.length,
      // Clipped by the box, a layer larger than it is still drawn only inside it; one the box does not clip is a leak.
      clipped: style.contain.includes("paint"),
      outside: [...new Set(outside)].slice(0, 12),
    };
  }, BOX);

/** Whether the docs page anywhere offers the old two-face controls: the Scene/Pages switch, Close the map, Reset view, From above, the zoom pill. */
const twoFaceControls = (page) =>
  page.evaluate(() => {
    // What a person can see or reach: the one face keeps the Scene's own zoom under its city, put away (`display: none`).
    const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const words = /^(close the map|reset view|from above)$/i;
    const said = [...document.querySelectorAll("button, a, [role=button], [role=tab]")].filter((el) => shown(el) && words.test((el.getAttribute("aria-label") ?? el.textContent ?? "").trim())).map((el) => (el.getAttribute("aria-label") ?? el.textContent).trim());
    return {
      switches: [...document.querySelectorAll('[data-testid="app-faces"], [data-testid="app-face-scene"], [data-testid="app-face-pages"]')].filter(shown).length,
      zoom: [...document.querySelectorAll('[data-testid="zoom-pill"], [data-testid="zoom"], [data-testid="zoom-in"], [data-testid="from-above"]')].filter(shown).length,
      scenes: [...document.querySelectorAll("[data-graview-embed]")].filter((el) => el.getAttribute("data-graview-embed") !== "pages" && el.getAttribute("data-graview-embed") !== "picture").length,
      said,
    };
  });

async function boxed(browser, { name, options }, errors) {
  const context = await browser.newContext({ ...options, colorScheme: "light", reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`boxed, ${name}: ${error.message}`));
  const checks = {};
  const at = (what) => `${what}On${name[0].toUpperCase()}${name.slice(1)}`;
  try {
    await page.goto(SITE_PAGE, { waitUntil: "load" });
    await page.locator(BOX).scrollIntoViewIfNeeded();
    await page.waitForSelector(`${BOX} [data-graview-one-place]`, { timeout: 60_000 });
    await page.waitForSelector(`${BOX} [data-graview-one-face-bar] [data-graview-app-bar]`, { timeout: 30_000 });
    // The box a little way down the window, so the host's page stands above and below it.
    await page.evaluate((box) => {
      const el = document.querySelector(box);
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top - 160), behavior: "instant" });
    }, BOX);
    // graview.dev opens a frame on its page, its overview's stop the Map a level control away.
    await restInBox(page, 0, 30_000);

    // The app menu opened as a person opens it: no Scene, no Pages in it, and nothing of the old two faces anywhere on the docs page.
    const menu = await page.locator(`${BOX} [data-testid="app-menu-open"]`).locator("visible=true").first().click({ timeout: 5_000 }).then(
      async () => {
        await page.locator('[data-testid="app-menu"] button').locator("visible=true").first().waitFor({ state: "visible", timeout: 10_000 });
        const faces = await page.locator('[data-testid="app-face-scene"], [data-testid="app-face-pages"]').count();
        await closeAppMenu(page);
        return { opened: true, faces };
      },
      (error) => ({ opened: false, faces: null, error: String(error?.message ?? error) }),
    );
    const two = await twoFaceControls(page);
    checks[at("theDocsPageShowsNoScenePagesSwitch")] = { menu, ...two, ok: menu.opened && menu.faces === 0 && two.switches === 0 && two.zoom === 0 && two.scenes === 0 && two.said.length === 0 };

    for (const [level, word] of [[2, "Map"], [1, "Nearby"], [0, "Page"]]) {
      await levelInBox(page, level);
      const seen = await boxAsSeen(page);
      checks[at(`theBarIsInsideTheBoxAt${word}`)] = { box: seen.box, bar: seen.bar, ok: seen.mounted && seen.held && seen.bar?.inside === true && Math.abs(seen.bar.top - seen.box.top) <= 1 };
      checks[at(`nothingOfTheFacePaintsOutsideTheBoxAt${word}`)] = {
        box: seen.box,
        contain: seen.contain,
        leaked: seen.leaked,
        leaks: seen.leaks,
        outside: seen.outside,
        ok: seen.mounted && seen.clipped && seen.leaked === 0,
      };
      checks[at(`${word.toLowerCase()}WorksInTheBox`)] = {
        sheet: seen.sheet,
        control: seen.control,
        ok: seen.sheet !== null && seen.control?.inside === true && (level === 2 || seen.sheet.inside === true),
      };
    }

    // At Page, the page scrolls itself inside the box, and the host's window stays where it is.
    const inside = await page.evaluate((box) => {
      const sheet = document.querySelector(`${box} [data-graview-one-place]`).getBoundingClientRect();
      return { x: sheet.left + sheet.width / 2, y: sheet.top + Math.min(sheet.height / 2, 200) };
    }, BOX);
    const before = await page.evaluate((box) => ({ window: window.scrollY, sheet: document.querySelector(`${box} [data-graview-one-place]`).scrollTop }), BOX);
    await page.mouse.move(inside.x, inside.y);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(500);
    const afterInside = await page.evaluate((box) => ({ window: window.scrollY, sheet: document.querySelector(`${box} [data-graview-one-place]`).scrollTop }), BOX);
    checks[at("theBoxScrollsItsOwnPage")] = { before, after: afterInside, ok: afterInside.sheet > before.sheet && afterInside.window === before.window };

    // With the pointer outside the box, the host's page scrolls as it always did.
    const outsidePoint = await page.evaluate((box) => {
      const r = document.querySelector(box).getBoundingClientRect();
      return { x: Math.round(document.documentElement.clientWidth / 2), y: Math.max(4, Math.round(r.top) - 40) };
    }, BOX);
    await page.mouse.move(outsidePoint.x, outsidePoint.y);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    const afterOutside = await page.evaluate(() => window.scrollY);
    checks[at("theHostPageScrollsWithThePointerOutsideTheBox")] = { at: outsidePoint, before: afterInside.window, after: afterOutside, ok: afterOutside > afterInside.window };
  } catch (error) {
    checks[at("boxedRan")] = { error: String(error?.stack ?? error), ok: false };
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
  report.checks.thePanelOptionSetsTheDesksPanel = await panelOption(browser, url, errors).catch((error) => ({ error: String(error?.message ?? error), ok: false }));
  for (const one of PROFILES) Object.assign(report.checks, await boxed(browser, one, errors));
  const compiled = await appFromOrCompile({ document });
  if (!compiled.ok) throw new Error(`${DOCUMENT} does not compile`);
  for (const scheme of ["light", "dark"]) Object.assign(report.checks, await sceneRules(browser, url, scheme, compiled.app, errors));
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
