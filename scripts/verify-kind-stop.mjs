#!/usr/bin/env node
/**
 * A KIND OPENS TO SOMETHING USEFUL.
 *
 * Going into a district the app drew no picture of — "open", a double
 * press, `#focus=aggregate:<kind>` — drew six chips and "+30 more" in a box
 * floating in an empty field, under a "⚠ 36" that was the number of rooms in
 * the warning tone (Nick, at the desk). It opens now to the kind's stop
 * (`packages/primitives/src/kind-stop.tsx`): what the set is, what is going
 * on in it in words, its creating act first, and a board, a calendar or a
 * table its data chooses, paged.
 *
 * This walks every kind of every example that has no picture of its own, at
 * a desk and a phone, light and dark, and judges each stop by what a person
 * gets from it: that it is there and fills its box, that nothing is a wall
 * of chips, that the first act is the first control, that problems are said
 * in words and open their rows, that a long list is paged and names records
 * rather than ids, that nothing scrolls sideways, that its targets are big
 * enough to press, and that axe finds nothing in it. Every page it opens is
 * also judged by the watch (the keyboard never left on <body>, no id shown).
 *
 *   node scripts/verify-kind-stop.mjs [--quick]
 *
 * Writes docs/kind-stop.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUICK = process.env["GRAVIEW_QUICK"] === "1" || process.argv.includes("--quick");
const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/*
 * The kinds of each example that have no declared picture: the ones whose
 * stop this is. A kind that gains a lens leaves the list by failing
 * "everyKindWithoutAPictureOpensToItsStop", by name.
 */
const APPS = [
  { app: "gauntlet", ready: "__graviewReady", query: "as=u-4f1c9a", kinds: ["room", "session", "speaker", "staff", "topic"] },
  { app: "todo", ready: "__todoReady", query: "", kinds: ["rule", "reason"] },
  { app: "seedbed", ready: "__seedbedReady", query: "", kinds: ["planting", "rotation", "rule"] },
  { app: "rota", ready: "__rotaReady", query: "", kinds: ["location", "rule"] },
  { app: "discography", ready: "__graviewReady", query: "", kinds: ["era", "theme"] },
];
const SWEEP = QUICK
  ? [
      [1440, "dark"],
      [390, "light"],
    ]
  : [
      [1440, "light"],
      [1440, "dark"],
      [390, "light"],
      [390, "dark"],
    ];

const report = { at: new Date().toISOString(), quick: QUICK, stops: [], walks: {}, pageErrors: [] };

/** What a stop says about itself, measured in the page. */
const measure = () => {
  const stop = document.querySelector('[data-testid="kind-stop"]');
  const focused = document.querySelector('[data-graview-view^="aggregate:"]');
  const chips = focused ? [...focused.querySelectorAll('[data-graview-primitive="chip"], [data-graview-primitive="roster"]')].filter((el) => !el.closest('[data-testid="kind-stop"]')).length : 0;
  const moreChip = focused ? [...focused.querySelectorAll("*")].some((el) => el.children.length === 0 && /^\+\d+ more$/.test(el.textContent?.trim() ?? "") && !el.closest('[data-testid="kind-stop"]')) : false;
  if (!stop) return { present: false, chips, moreChip };
  const box = stop.getBoundingClientRect();
  const host = focused?.getBoundingClientRect();
  const firstControl = stop.querySelector("button:not([disabled]), a[href], input, select, textarea");
  const coarse = matchMedia("(pointer: coarse)").matches;
  // Every target at least 24 pixels (WCAG 2.2's floor); the stop's own, 44 under a finger.
  const small = [...stop.querySelectorAll("button, a[href], input")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ el, at: el.getBoundingClientRect(), own: [...el.classList, ...(el.parentElement?.classList ?? [])].some((name) => name.startsWith("graview-kind-stop")) }))
    .filter(({ at, own }) => at.width > 0 && at.height > 0 && (Math.round(at.height) < (coarse && own ? 44 : 24) || Math.round(at.width) < 24))
    .map(({ el, at }) => `${el.getAttribute("data-testid") ?? el.textContent?.trim().slice(0, 24)} ${Math.round(at.width)}×${Math.round(at.height)}`);
  const cells = [...stop.querySelectorAll("table td, table th")].map((el) => el.textContent?.trim() ?? "");
  const heading = document.getElementById(stop.getAttribute("aria-labelledby") ?? "");
  // Contrast of a row's "⋯" glyph against the stop's ground, and whether its edge is drawn at rest.
  const rgb = (text) => (text.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ground = (el) => {
    for (let at = el; at; at = at.parentElement) {
      const c = rgb(getComputedStyle(at).backgroundColor);
      if (c.length === 3 || (c[3] ?? 1) > 0.5) return c;
    }
    return [255, 255, 255];
  };
  const acts = stop.querySelector('[data-testid="kind-stop-row-acts"]');
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const actsContrast = acts ? Math.round(ratio(rgb(getComputedStyle(acts).color), ground(acts)) * 100) / 100 : null;
  const actsEdge = acts ? getComputedStyle(acts).borderTopStyle !== "none" && rgb(getComputedStyle(acts).borderTopColor)[3] !== 0 && getComputedStyle(acts).borderTopColor !== "rgba(0, 0, 0, 0)" : null;
  const picks = stop.querySelectorAll('[data-testid="kind-stop-table"] tbody tr[data-graview-pick]').length;
  // Each row's box, where the seat may act on the kind at all; drawn on a desk, folded away under a finger until a long press.
  const boxes = stop.querySelectorAll('[data-testid="kind-stop-table"] tbody tr [data-graview-choose-box]').length;
  const boxesShown = [...stop.querySelectorAll('[data-testid="kind-stop-table"] tbody tr [data-graview-choose-box]')].filter((box) => box.getBoundingClientRect().width > 0).length;
  const holes = [...stop.querySelectorAll('[data-testid="kind-stop-table"] tbody td[data-label]')].filter((td) => (td.textContent ?? "").trim() === "").length;
  return {
    present: true,
    shape: stop.getAttribute("data-graview-shape"),
    named: heading?.tagName === "H2" && (heading.textContent ?? "").length > 0,
    fills: host ? Math.round((box.height / host.height) * 100) : null,
    primary: stop.querySelector('[data-testid="kind-stop-primary"]')?.textContent ?? null,
    primaryFirst: firstControl?.getAttribute("data-testid") === "kind-stop-primary",
    rows: stop.querySelectorAll('[data-testid="kind-stop-table"] tbody tr').length,
    paged: stop.querySelector('[data-testid="kind-stop-more"]') !== null,
    problems: stop.querySelector('[data-testid="kind-stop-problems"]')?.textContent ?? null,
    ids: cells.filter((text) => /^[a-z][a-z-]*:[\p{L}\p{N}-]+$/u.test(text)).slice(0, 3),
    sideways: document.documentElement.scrollWidth > innerWidth + 1,
    insideSideways: [stop, stop.querySelector('[data-testid="kind-stop-scroll"]')].some((box) => box && box.scrollWidth > box.clientWidth + 1),
    small: small.slice(0, 6),
    actsContrast,
    actsEdge,
    picks,
    boxes,
    boxesShown,
    coarse,
    holes,
    chips,
    moreChip,
  };
};

async function axe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (tags) => {
    const stop = document.querySelector('[data-testid="kind-stop"]');
    if (!stop) return [];
    const result = await window.axe.run(stop, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return result.violations.map((v) => ({ rule: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  }, TAGS);
}

const servers = [];
let browser;
try {
  for (const { app } of APPS) servers.push(await serving(app, portFor(app), repoRoot));
  browser = await launchEngine("chromium");
  for (const { app, ready, query, kinds } of APPS) {
    for (const [width, scheme] of SWEEP) {
      const phone = width < 600;
      const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, colorScheme: scheme, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
      const page = await context.newPage();
      page.on("pageerror", (error) => report.pageErrors.push(`${app} ${width} ${scheme}: ${String(error.message).slice(0, 200)}`));
      for (const kind of kinds) {
        const url = `${at(app)}/?theme=${scheme}${query ? `&${query}` : ""}#focus=${encodeURIComponent(`aggregate:${kind}`)}`;
        await page.goto(url, { waitUntil: "load", timeout: 120_000 });
        await page.waitForFunction((flag) => flag in window, ready, { timeout: 120_000 });
        await page.waitForSelector('[data-testid="kind-stop"]', { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(600);
        const measured = await page.evaluate(measure);
        const found = measured.present && (width === 1440 || !QUICK) ? await axe(page) : [];
        report.stops.push({ app, kind, width, scheme, ...measured, axe: found });
        process.stdout.write(`${measured.present ? "ok  " : "MISS"} ${app.padEnd(11)} ${kind.padEnd(9)} ${width} ${scheme.padEnd(5)} ${measured.shape ?? ""} ${measured.primary ?? ""}${found.length ? ` axe: ${found.map((one) => one.rule).join(",")}` : ""}\n`);
      }
      await context.close();
    }
  }

  /* ------------------------------------------------- what a person does in one */
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  let page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(`walk: ${String(error.message).slice(0, 200)}`));
  const open = async (hash) => {
    await page.goto(`${at("gauntlet")}/?theme=dark&as=u-4f1c9a${hash}`, { waitUntil: "load", timeout: 120_000 });
    await page.waitForFunction(() => "__graviewReady" in window, undefined, { timeout: 120_000 });
    await page.waitForSelector('[data-testid="kind-stop"]', { timeout: 15_000 });
    await page.waitForTimeout(500);
  };

  /*
   * ONE PANEL BESIDE THE MAP AT A TIME. With a lens open from altitude,
   * opening a kind that has none — a double press on its district, or Enter
   * on it — shows that kind's stop in the panel in the lens's place, the
   * address says so, the keyboard is on its heading, and Back returns to the
   * lens. Lens to lens, kind to lens and kind to kind alike.
   */
  const panels = () =>
    page.evaluate(() => ({
      hash: decodeURIComponent(location.hash),
      panels: [...document.querySelectorAll("[data-graview-map-panel]")].map((one) => one.getAttribute("data-testid")),
      stop: document.querySelector('[data-graview-map-panel] [data-testid="kind-stop"]')?.getAttribute("data-graview-kind-stop") ?? null,
      lens: document.querySelector('[data-testid="lens-panel"]')?.getAttribute("aria-label") ?? null,
      focus: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null,
      opened: document.querySelectorAll('[data-graview-view^="kind:"] .graview-kind-members').length,
      anyStop: document.querySelector('[data-testid="kind-stop"]') !== null,
    }));
  const openDistrict = async (kind, how = "double") => {
    const sign = page.locator(`[data-graview-past-edge="kind:${kind}"]`).first();
    if ((await sign.count()) > 0) {
      await sign.click();
      await page.waitForTimeout(600);
    }
    const card = page.locator(`[data-graview-view="kind:${kind}"]`).first();
    if (how === "double") {
      const box = await card.boundingBox();
      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      // From the keyboard: Enter chooses the district, Enter again opens it.
      await card.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(1500);
    return panels();
  };
  const pressLens = async (as) => {
    await page.locator(`[data-testid="app-place-scene:talk:${as}"]`).first().click();
    await page.waitForTimeout(1500);
    return panels();
  };
  for (const [width, scheme] of [
    [1440, "dark"],
    [390, "light"],
  ]) {
    const phone = width < 600;
    const one = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, colorScheme: scheme, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    const tab = await one.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(`swap ${width}: ${String(error.message).slice(0, 200)}`));
    const was = page;
    // eslint-disable-next-line no-global-assign
    page = tab;
    await tab.goto(`${at("gauntlet")}/?theme=${scheme}&as=u-4f1c9a#overview=1&focus=aggregate%3Atalk&in.view=the-timetable`, { waitUntil: "load", timeout: 120_000 });
    await tab.waitForFunction(() => "__graviewReady" in window, undefined, { timeout: 120_000 });
    await tab.waitForSelector('[data-testid="lens-panel"]', { timeout: 15_000 }).catch(() => undefined);
    await tab.waitForTimeout(1200);
    const swap = { lens: await panels() };
    swap.lensToKind = await openDistrict("room");
    swap.kindToKind = await openDistrict("staff", phone ? "double" : "keys");
    await tab.goBack();
    await tab.waitForTimeout(1200);
    swap.backToKind = await panels();
    await tab.goBack();
    await tab.waitForTimeout(1200);
    swap.backToLens = await panels();
    if (!phone) {
      // A kind's stop open from altitude, then a lens chosen on the bar: the lens is what is drawn, and no stop.
      await tab.goto(`${at("gauntlet")}/?theme=${scheme}&as=u-4f1c9a#overview=1&focus=aggregate%3Atopic`, { waitUntil: "load", timeout: 120_000 });
      await tab.waitForFunction(() => "__graviewReady" in window, undefined, { timeout: 120_000 });
      await tab.waitForSelector('[data-graview-map-panel] [data-testid="kind-stop"]', { timeout: 15_000 }).catch(() => undefined);
      await tab.waitForTimeout(1200);
      swap.kindToLens = await pressLens("what-the-talks-are-about").catch(async (error) => ({ error: String(error.message).split("\n")[0], seen: await tab.evaluate(() => [decodeURIComponent(location.hash), [...document.querySelectorAll("[data-testid^=drive-in]")].map((one) => one.getAttribute("data-testid"))]) }));
    }
    report.walks[`swap${width}`] = swap;
    page = was;
    await one.close();
  }

  // A problem opens its rows, in the rule's words.
  await open("#focus=aggregate%3Aroom");
  await page.click('[data-testid="kind-stop-problems"] button[aria-expanded]');
  await page.waitForSelector('[data-testid="kind-stop-problem-rows"] li', { timeout: 5000 }).catch(() => undefined);
  report.walks.problemRows = await page.evaluate(() => document.querySelector('[data-testid="kind-stop-problem-rows"]')?.textContent?.trim().slice(0, 160) ?? null);

  // A row is its record: right-clicked, its acts open as a record's do anywhere in the scene.
  await page.click('[data-testid="kind-stop-table"] tbody tr[data-graview-pick] td[data-label]', { button: "right" });
  await page.waitForSelector('[data-testid="context-menu"] [data-affordance]', { timeout: 5000 }).catch(() => undefined);
  report.walks.rowMenu = await page.evaluate(() => ({ open: document.querySelector('[data-testid="context-menu"] [data-affordance]') !== null, chosen: decodeURIComponent(location.hash) }));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // The creating act asks in place, and putting the ask away gives the keyboard back to the act.
  await page.click('[data-testid="kind-stop-primary"]');
  await page.waitForSelector('[data-testid="kind-stop-ask"]', { timeout: 5000 }).catch(() => undefined);
  report.walks.askOpened = await page.evaluate(() => document.querySelector('[data-testid="kind-stop-ask"]') !== null);
  const cancel = page.locator('[data-testid="kind-stop-ask"] button', { hasText: /cancel/i }).first();
  if ((await cancel.count()) > 0) await cancel.click();
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  report.walks.askPutAway = await page.evaluate(() => ({ gone: document.querySelector('[data-testid="kind-stop-ask"]') === null, focus: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName }));

  // A long list is a page at a time: the speakers, eleven hundred of them.
  await open("#focus=aggregate%3Aspeaker");
  const before = await page.evaluate(() => document.querySelectorAll('[data-testid="kind-stop-table"] tbody tr').length);
  await page.click('[data-testid="kind-stop-more"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => document.querySelectorAll('[data-testid="kind-stop-table"] tbody tr').length);
  report.walks.paged = { before, after };

  // A chip with its count narrows the list in one press: the staff by duty.
  await open("#focus=aggregate%3Astaff");
  const chip = page.locator('[data-testid="kind-arrange-chip"]').first();
  const chipSaid = (await chip.count()) > 0 ? await chip.textContent() : null;
  if (chipSaid) {
    await chip.click();
    await page.waitForTimeout(500);
  }
  report.walks.chip = { said: chipSaid, rows: await page.evaluate(() => document.querySelectorAll('[data-testid="kind-stop-table"] tbody tr').length) };

  // A row's name goes to its record.
  const first = page.locator('[data-testid="kind-stop-row-go"]').first();
  const name = await first.textContent();
  await first.click();
  await page.waitForTimeout(1500);
  report.walks.wentTo = { name, hash: decodeURIComponent(await page.evaluate(() => location.hash)) };

  /*
   * SEVERAL AT ONCE. A box at a row's start chooses it, Shift a range; the
   * bar says how many and offers what they share, and "Check them in" checks
   * in all three speakers as one change, which one take-back puts back. The
   * boxes' presses are not the scene's: nothing else is chosen or opened.
   * Escape puts the choice down and leaves the stop where it was.
   */
  await open("#focus=aggregate%3Aspeaker");
  const hashBefore = await page.evaluate(() => decodeURIComponent(location.hash));
  const boxes = page.locator('[data-testid="kind-stop-table"] tbody [data-graview-choose-box]');
  await boxes.nth(0).hover();
  await boxes.nth(0).click();
  await boxes.nth(2).hover();
  await boxes.nth(2).click({ modifiers: ["Shift"] });
  await page.waitForSelector('[data-testid="several-bar"]', { timeout: 10_000 }).catch(() => undefined);
  report.walks.several = {
    said: await page.locator('[data-testid="several-count"]').textContent({ timeout: 5_000 }).catch(() => null),
    acts: await page.locator('[data-testid="several-act"]').allTextContents(),
    hash: await page.evaluate(() => decodeURIComponent(location.hash)),
    hashBefore,
  };
  const checkIn = page.locator('[data-testid="several-act"][data-mutation="check-in"]');
  if ((await checkIn.count()) > 0) {
    await checkIn.click();
    await page.waitForTimeout(800);
    const offer = page.getByRole("button", { name: /Take back/ }).first();
    report.walks.several.acted = {
      bar: await page.locator('[data-testid="several-bar"]').count(),
      offer: (await offer.isVisible().catch(() => false)) ? await page.locator('[data-testid="notices-toasts"]').textContent().catch(() => null) : null,
      focus: await page.evaluate(() => (document.activeElement && document.activeElement !== document.body ? document.activeElement.getAttribute("data-testid") ?? document.activeElement.className ?? document.activeElement.tagName : "body")),
    };
    if (report.walks.several.acted.offer) {
      await offer.click();
      await page.waitForTimeout(600);
      report.walks.several.undone = await page.evaluate(() => document.body.textContent?.includes("Took back") ?? false);
    }
  }
  await boxes.nth(1).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  report.walks.several.one = await page.locator('[data-testid="several-count"]').textContent({ timeout: 5_000 }).catch(() => null);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  report.walks.several.putDown = { bar: await page.locator('[data-testid="several-bar"]').count(), stop: await page.locator('[data-testid="kind-stop"]').count(), hash: await page.evaluate(() => decodeURIComponent(location.hash)) };

  // The derived picture is kept as a lens: a place of its own, on the bar.
  await open("#focus=aggregate%3Aroom");
  await page.click('[data-testid="kind-stop-keep"]');
  await page.waitForTimeout(1500);
  report.walks.kept = await page.evaluate(() => ({ hash: decodeURIComponent(location.hash), onTheBar: document.body.textContent?.includes("Every room") ?? false }));
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("graview:lenses:")) localStorage.removeItem(key);
  });
  await context.close();
} catch (error) {
  report.error = String(error?.stack ?? error).slice(0, 600);
} finally {
  await browser?.close();
  for (const server of servers) server.stop();
}

const stops = report.stops;
const walks = report.walks;
report.checks = {
  // Every kind with no picture of its own opens to its stop, in every width and scheme.
  everyKindWithoutAPictureOpensToItsStop: stops.length > 0 && stops.every((one) => one.present),
  // None is six chips and "+30 more".
  noKindOpensToABareListOfChips: stops.every((one) => one.chips === 0 && !one.moreChip),
  // Its region is named by its heading, and it fills the box a lens fills.
  theStopIsNamedAndFillsItsBox: stops.every((one) => !one.present || (one.named && (one.fills ?? 0) >= 95)),
  // Where the seat may make one, the kind's creating act is the first control.
  thePrimaryActIsTheFirstControl: stops.every((one) => !one.present || one.primary === null || one.primaryFirst) && stops.some((one) => one.primary === "Add a room"),
  // A kind with a choice of states opens to a board with its states: seedbed's plantings.
  aKindWithAChoiceFieldOpensToABoard: stops.filter((one) => one.app === "seedbed" && one.kind === "planting").every((one) => one.shape === "board"),
  // Problems are said in words, in the rule's own, and open their rows.
  problemsAreSaidInWords: stops.filter((one) => one.app === "gauntlet" && one.kind === "room").every((one) => /problem/.test(one.problems ?? "") && /A workshop fits its room/.test(one.problems ?? "")) && typeof walks.problemRows === "string" && walks.problemRows.length > 0,
  // A long list is a page at a time, never a wall: fifty, then fifty more.
  aLongListIsPaged: stops.filter((one) => one.kind === "speaker").every((one) => one.rows === 50 && one.paged) && walks.paged?.before === 50 && walks.paged?.after === 100,
  // A chip with its count narrows in one press.
  aChipNarrowsInOnePress: /\d/.test(walks.chip?.said ?? "") && (walks.chip?.rows ?? 0) > 0 && walks.chip.rows < 34,
  // A table names records, never their ids.
  noIdIsShown: stops.every((one) => !one.present || (one.ids ?? []).length === 0),
  // With a lens open from altitude, opening a lens-less kind shows that kind's stop and no lens panel — one panel at a time, at a desk and a phone.
  withALensOpenOpeningAKindShowsItsStopAndNoLens: [1440, 390].every((width) => {
    const swap = walks[`swap${width}`];
    const only = (one, kind) => one?.stop === kind && one.panels.length === 1 && new RegExp(`focus=aggregate:${kind}(&|$)`).test(one.hash) && !one.hash.includes("in.view=") && one.opened === 0;
    return swap?.lens?.lens === "The timetable" && only(swap.lensToKind, "room") && only(swap.kindToKind, "staff");
  }),
  // Opened, the keyboard is on the stop's heading.
  theKeyboardLandsOnTheStopsHeading: [1440, 390].every((width) => walks[`swap${width}`]?.lensToKind?.focus === "kind-stop-title"),
  // Back returns kind to kind, then to the lens.
  backReturnsToWhatWasOpen: [1440, 390].every((width) => walks[`swap${width}`]?.backToKind?.stop === "room" && walks[`swap${width}`]?.backToLens?.lens === "The timetable" && walks[`swap${width}`]?.backToLens?.stop === null),
  // A lens pressed with a kind's stop open takes its place.
  aLensTakesAStopsPlace: Boolean(walks.swap1440?.kindToLens?.panels) && walks.swap1440.kindToLens.anyStop === false && walks.swap1440.kindToLens.hash.includes("focus=aggregate:talk") && walks.swap1440.kindToLens.hash.includes("in.view=what-the-talks-are-about"),
  // A row right-clicked opens its record's acts, as a record does anywhere.
  aRowOpensItsActsOnARightClick: walks.rowMenu?.open === true && /sel=room:/.test(walks.rowMenu?.chosen ?? ""),
  // Every row is its record to the scene (`data-graview-pick`), chosen and right-clicked as a record is.
  everyRowIsItsRecord: stops.every((one) => !one.present || one.rows === 0 || one.picks === one.rows),
  // A row's "⋯" is unmistakably a control: its glyph at 3:1 against the row at least, a visible edge at a desk; on a phone a quiet glyph in a 44-pixel target, no heavy box (verify-drive-in).
  aRowsActsAreVisible: stops.every((one) => !one.present || one.rows === 0 || (one.actsContrast >= 3 && (one.actsEdge || one.width < 600))),
  // An empty value is said, never a hole.
  noCellIsAHole: stops.every((one) => !one.present || one.holes === 0),
  // A row's name goes to its record.
  aRowGoesToItsRecord: /focus=staff:/.test(walks.wentTo?.hash ?? ""),
  // Where the seat may act on the kind, every row has a box on a desk, and none shows under a finger until a long press.
  everyRowHasItsBox: stops.every((one) => !one.present || one.rows === 0 || one.boxes === 0 || (one.boxes === one.rows && (one.coarse ? one.boxesShown === 0 : one.boxesShown === one.rows))) && stops.some((one) => one.boxes > 0),
  // Three speakers chosen by a box and Shift, said by count, with the act they share; the scene's own choice and place untouched.
  severalRowsAreChosenAndSaidByCount: walks.several?.said === "3 speakers chosen" && (walks.several?.acts ?? []).includes("Check them in") && walks.several?.hash === walks.several?.hashBefore,
  // "Check them in" checks in all three as one change, offered back as one, and taken back in one press.
  severalRowsAreOneChangeWithOneUndo: walks.several?.acted?.bar === 0 && /Check them in — 3 speakers/.test(walks.several?.acted?.offer ?? "") && walks.several?.undone === true && walks.several?.acted?.focus !== "body",
  // Space on a box chooses it; Escape puts the choice down and leaves the stop where it was.
  escapePutsTheChoiceDownAndKeepsTheStop: walks.several?.one === "1 speaker chosen" && walks.several?.putDown?.bar === 0 && walks.several?.putDown?.stop === 1 && walks.several?.putDown?.hash === walks.several?.hashBefore,
  // The act asks in place; put away, the keyboard is back on the act.
  theAskComesBackToItsAct: walks.askOpened === true && walks.askPutAway?.gone === true && walks.askPutAway?.focus === "kind-stop-primary",
  // Kept, the derived picture is a place of its own.
  theDerivedPictureIsKeptAsALens: walks.kept?.onTheBar === true,
  // Nothing scrolls sideways, at a desk or a phone.
  noSidewaysScroll: stops.every((one) => !one.present || (!one.sideways && !one.insideSideways)),
  // Every target is big enough: 24 pixels, 44 on a phone.
  targetsAreBigEnough: stops.every((one) => !one.present || one.small.length === 0),
  // axe finds nothing in it.
  axeFindsNothing: stops.every((one) => (one.axe ?? []).length === 0),
  noPageErrors: report.pageErrors.length === 0,
  nothingThrew: !report.error,
};
report.passed = Object.values(report.checks).every(Boolean);
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/kind-stop.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`\n${JSON.stringify(report.checks, null, 2)}\n\nwrote docs/kind-stop.json\n`);
process.exit(report.passed ? 0 : 1);
