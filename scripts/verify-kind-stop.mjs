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
    insideSideways: stop.scrollWidth > stop.clientWidth + 1,
    small: small.slice(0, 6),
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
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(`walk: ${String(error.message).slice(0, 200)}`));
  const open = async (hash) => {
    await page.goto(`${at("gauntlet")}/?theme=dark&as=u-4f1c9a${hash}`, { waitUntil: "load", timeout: 120_000 });
    await page.waitForFunction(() => "__graviewReady" in window, undefined, { timeout: 120_000 });
    await page.waitForSelector('[data-testid="kind-stop"]', { timeout: 15_000 });
    await page.waitForTimeout(500);
  };

  // A problem opens its rows, in the rule's words.
  await open("#focus=aggregate%3Aroom");
  await page.click('[data-testid="kind-stop-problems"] button[aria-expanded]');
  await page.waitForSelector('[data-testid="kind-stop-problem-rows"] li', { timeout: 5000 }).catch(() => undefined);
  report.walks.problemRows = await page.evaluate(() => document.querySelector('[data-testid="kind-stop-problem-rows"]')?.textContent?.trim().slice(0, 160) ?? null);

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
  // A row's name goes to its record.
  aRowGoesToItsRecord: /focus=staff:/.test(walks.wentTo?.hash ?? ""),
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
